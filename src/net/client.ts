import type { GameEvent, ViewerSeat } from '../engine/core/events';
import type { GameId, GameResult, PlayerInfo } from '../engine/core/types';
import type { Session, SessionUpdate } from '../session/types';
import {
  AWAY_GRACE_MS,
  PROTOCOL_VERSION,
  encode,
  parseHostMsg,
  type ClientMsg,
  type ConnState,
  type HostMsg,
  type Lobby,
} from './protocol';
import type { ClientTransport, Connection } from './transport';

export type ClientState =
  'connecting' | 'lobby' | 'playing' | 'waitingHost' | 'closed' | 'kicked' | 'error';

export interface ClientOptions {
  transport: ClientTransport;
  code: string;
  name: string;
  avatar: string;
  token?: string | null;
  spectate?: boolean;
  onToken?: (token: string) => void;
  retryMs?: number;
  graceMs?: number;
  pingMs?: number;
  connectTimeoutMs?: number;
}

type HostView = Extract<HostMsg, { t: 'view' }>;

export class ClientSession implements Session {
  state: ClientState = 'connecting';
  lobby: Lobby | null = null;
  seat: number | 'spectator' | null = null;
  error: { code: string; message?: string } | null = null;
  results: unknown = null;
  /** when the host has been gone, the time we give up */
  deadline = 0;
  generation = 0;

  private conn: Connection | null = null;
  private last: HostView | null = null;
  private receivedAt = 0;
  private token: string | null;
  private seq = 0;
  private listeners = new Set<(u: SessionUpdate) => void>();
  private stateListeners = new Set<() => void>();
  private reactionListeners = new Set<(seat: number | 'spectator', id: string) => void>();
  private errorListeners = new Set<(code: string, message?: string) => void>();
  private pending: GameEvent[] = [];
  private frozen = false;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;
  private welcomed: ((ok: boolean) => void) | null = null;
  private version = 0;
  private opts: ClientOptions;
  private _initial: GameEvent[] = [];

  constructor(opts: ClientOptions) {
    this.opts = opts;
    this.token = opts.token ?? null;
  }

  get gameId(): GameId {
    return (this.lobby?.gameId ?? 'callbreak') as GameId;
  }
  get mySeat(): number {
    return typeof this.seat === 'number' ? this.seat : 0;
  }
  get players(): PlayerInfo[] {
    return (this.lobby?.seats ?? []).map((s, i) => ({
      id: `p${i}`,
      name: s.name || `Seat ${i + 1}`,
      avatar: s.avatar,
      isBot: s.kind === 'bot',
      difficulty: s.difficulty,
    }));
  }
  get initialEvents(): GameEvent[] {
    return this._initial;
  }

  /** Connect and say hello. Resolves once the host has welcomed us. */
  join(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.welcomed = (ok) => (ok ? resolve() : reject(new Error(this.error?.code ?? 'error')));
      void this.open();
    });
  }

  private setState(s: ClientState) {
    if (this.state === s) return;
    this.state = s;
    this.stateListeners.forEach((f) => f());
  }
  subscribeState(fn: () => void) {
    this.stateListeners.add(fn);
    return () => {
      this.stateListeners.delete(fn);
    };
  }
  onError(fn: (code: string, message?: string) => void) {
    this.errorListeners.add(fn);
    return () => {
      this.errorListeners.delete(fn);
    };
  }

  private async open() {
    if (this.disposed) return;
    try {
      const conn = await this.opts.transport.connect(this.opts.code, this.opts.connectTimeoutMs);
      if (this.disposed) return conn.close();
      this.conn = conn;
      conn.onMessage((raw) => this.onRaw(raw));
      conn.onClose(() => this.onClose(conn));
      this.sendMsg({
        t: 'hello',
        v: PROTOCOL_VERSION,
        name: this.opts.name,
        avatar: this.opts.avatar,
        token: this.token ?? undefined,
        spectate: this.opts.spectate,
      });
      this.pingTimer = setInterval(() => this.sendMsg({ t: 'ping' }), this.opts.pingMs ?? 4000);
    } catch (e) {
      const code = (e as Error).message;
      if (this.state === 'waitingHost') this.scheduleRetry();
      else this.fail(code === 'not-found' ? 'not-found' : code);
    }
  }

  private fail(code: string, message?: string) {
    this.error = { code, message };
    this.setState('error');
    this.welcomed?.(false);
    this.welcomed = null;
  }

  private sendMsg(m: ClientMsg) {
    try {
      this.conn?.send(encode(m));
    } catch {
      /* closed */
    }
  }

  private onClose(conn: Connection) {
    if (conn !== this.conn || this.disposed) return;
    this.conn = null;
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.state === 'closed' || this.state === 'kicked' || this.state === 'error') return;
    if (this.state === 'connecting' && !this.token) return this.fail('lost');
    this.deadline = Date.now() + (this.opts.graceMs ?? AWAY_GRACE_MS);
    this.setState('waitingHost');
    this.scheduleRetry();
  }

  private scheduleRetry() {
    if (this.disposed) return;
    if (Date.now() > this.deadline) {
      this.setState('closed');
      return;
    }
    this.retryTimer = setTimeout(() => void this.open(), this.opts.retryMs ?? 3000);
  }

  private onRaw(raw: string) {
    if (import.meta.env.DEV) {
      const w = window as unknown as { __netLog?: string[] };
      (w.__netLog ??= []).push(raw);
    }
    const msg = parseHostMsg(raw);
    if (!msg) return;
    switch (msg.t) {
      case 'welcome':
        this.seat = msg.seat;
        this.lobby = msg.lobby;
        this.generation = msg.lobby.gen;
        if (msg.token) {
          this.token = msg.token;
          this.opts.onToken?.(msg.token);
        }
        this.setState(msg.lobby.started ? 'playing' : 'lobby');
        this.welcomed?.(true);
        this.welcomed = null;
        return;
      case 'lobby':
        this.lobby = msg.lobby;
        if (msg.lobby.started && this.state === 'lobby') this.setState('playing');
        if (!msg.lobby.started && this.state === 'playing') {
          this.setState('lobby');
        }
        this.stateListeners.forEach((f) => f());
        return;
      case 'view':
        return this.onView(msg);
      case 'error':
        if (this.state === 'connecting') return this.fail(msg.code, msg.message);
        this.errorListeners.forEach((f) => f(msg.code, msg.message));
        return;
      case 'kicked':
        this.setState('kicked');
        return;
      case 'closed':
        this.results = msg.results;
        this.setState('closed');
        return;
      case 'hostPaused':
        return;
      case 'reaction':
        this.reactionListeners.forEach((f) => f(msg.seat, msg.id));
        return;
      case 'pong':
        return;
    }
  }

  private onView(msg: HostView) {
    if (msg.gen !== this.generation || !this.last) {
      // a new game at the same table: start the animation record over
      if (msg.gen !== this.generation) this.generation = msg.gen;
      this.pending = [];
      this.frozen = false;
      this._initial = this.pending;
    }
    this.last = msg;
    this.receivedAt = Date.now();
    if (this.state === 'lobby') this.setState('playing');
    if (!this.frozen && this.listeners.size === 0) {
      this.pending.push(...(msg.events as GameEvent[]));
    } else {
      this.frozen = true;
      this.version++;
      const u = { version: this.version, events: msg.events as GameEvent[] };
      for (const l of [...this.listeners]) l(u);
    }
    this.stateListeners.forEach((f) => f());
  }

  // ---- lobby actions ----
  setReady(on: boolean) {
    this.sendMsg({ t: 'ready', on });
  }
  updateProfile(name: string, avatar: string) {
    this.sendMsg({ t: 'profile', name, avatar });
  }

  // ---- Session ----
  getView(seat: ViewerSeat) {
    void seat;
    return this.last ? this.last.view : null;
  }
  filterEvents(events: GameEvent[]) {
    return events; // the host already filtered them for us
  }
  currentActors() {
    return this.last?.actors ?? [];
  }
  legalActions() {
    return [];
  }
  submit(seat: number, action: unknown) {
    void seat;
    this.sendMsg({ t: 'action', seq: ++this.seq, action });
  }
  result(): GameResult | null {
    return (this.last?.result as GameResult | null) ?? null;
  }
  isPlayPhase() {
    return this.last?.playPhase ?? false;
  }
  getTimer(seat: number) {
    const t = this.last?.timers.find((x) => x.seat === seat);
    if (!t) return null;
    return {
      remainingMs: Math.max(0, t.remainingMs - (Date.now() - this.receivedAt)),
      totalMs: t.totalMs,
    };
  }
  isAuto(seat: number) {
    return this.last?.auto.includes(seat) ?? false;
  }
  setAuto(seat: number, on: boolean) {
    if (!on && seat === this.seat) this.sendMsg({ t: 'back' });
  }
  getConn(seat: number): ConnState {
    return this.last?.conn[seat] ?? 'good';
  }
  subscribe(fn: (u: SessionUpdate) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  start() {
    /* the host runs the bots */
  }
  pause() {
    /* online games never pause */
  }
  resume() {
    /* see pause */
  }
  react(id: string) {
    this.sendMsg({ t: 'react', id: id as never });
  }
  onReaction(fn: (seat: number | 'spectator', id: string) => void) {
    this.reactionListeners.add(fn);
    return () => {
      this.reactionListeners.delete(fn);
    };
  }

  leave() {
    this.dispose();
  }
  dispose() {
    this.disposed = true;
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.conn?.close();
    this.conn = null;
    this.listeners.clear();
    this.stateListeners.clear();
  }
}
