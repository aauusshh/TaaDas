import type { GameEvent, ViewerSeat } from '../engine/core/events';
import {
  IllegalActionError,
  type AnyGame,
  type Difficulty,
  type GameConfig,
  type GameResult,
  type PlayerInfo,
} from '../engine/core/types';
import { LocalSession } from '../session/LocalSession';
import type { Session, SessionUpdate, Snapshot } from '../session/types';
import { BOT_NAMES } from '../app/launch';
import {
  AWAY_GRACE_MS,
  MAX_ACTIONS_PER_SECOND,
  PROTOCOL_VERSION,
  REACTIONS,
  encode,
  parseClientMsg,
  type ClientMsg,
  type ConnState,
  type HostMsg,
  type Lobby,
  type LobbySeat,
} from './protocol';
import { newToken } from './roomCode';
import type { Connection, HostTransport } from './transport';

const BOT_AVATARS = ['danphe', 'tiger', 'rhino', 'diyo', 'kite', 'madal', 'momo', 'leopard'];
const HEARTBEAT_MS = 3000;
const SLOW_MS = 7000;
const AWAY_MS = 15000;

interface Slot {
  kind: LobbySeat['kind'];
  name: string;
  avatar: string;
  difficulty: Difficulty;
  ready: boolean;
  token: string | null;
  connId: string | null;
  awaySince: number | null;
}

interface ConnInfo {
  conn: Connection;
  seat: number | 'spectator' | null;
  lastSeen: number;
  actionTimes: number[];
  reactAt: number;
  seq: number;
}

export interface PersistedHost {
  v: 1;
  code: string;
  gameId: string;
  config: GameConfig;
  seats: Pick<Slot, 'kind' | 'name' | 'avatar' | 'difficulty' | 'token'>[];
  hostSeat: number;
  timerSec: number;
  locked: boolean;
  spectators: boolean;
  botsEnabled?: boolean;
  gen: number;
  started: boolean;
  snapshot: Snapshot | null;
}

export interface HostOptions {
  transport: HostTransport;
  game: AnyGame;
  code: string;
  config: GameConfig;
  seatCount: number;
  host: { name: string; avatar: string };
  timerSec?: number;
  spectators?: boolean;
  relay?: boolean;
  thinkMs?: (d: Difficulty) => number;
  persist?: (data: PersistedHost | null) => void;
  now?: () => number;
}

const emptySlot = (): Slot => ({
  kind: 'empty',
  name: '',
  avatar: 'yak',
  difficulty: 'medium',
  ready: false,
  token: null,
  connId: null,
  awaySince: null,
});

/**
 * The room owner's browser. Runs the engine, bots and timers, validates every action,
 * and sends each client only its own view.
 */
export class HostSession implements Session {
  readonly gameId;
  private game: AnyGame;
  private transport: HostTransport;
  private slots: Slot[];
  private conns = new Map<string, ConnInfo>();
  private inner: LocalSession | null = null;
  private innerUnsub: (() => void) | null = null;
  private listeners = new Set<(u: SessionUpdate) => void>();
  private lobbyListeners = new Set<(l: Lobby) => void>();
  private reactionListeners = new Set<(seat: number | 'spectator', id: string) => void>();
  private beat: ReturnType<typeof setInterval> | null = null;
  private closed = false;
  hostSeat = 0;
  generation = 0;
  code: string;
  config: GameConfig;
  timerSec: number;
  locked = false;
  botsEnabled = false;
  spectators: boolean;
  started = false;
  relay: boolean;
  private opts: HostOptions;
  private now: () => number;

  constructor(opts: HostOptions) {
    this.opts = opts;
    this.game = opts.game;
    this.gameId = opts.game.id;
    this.transport = opts.transport;
    this.code = opts.code;
    this.config = { ...opts.game.defaultConfig, ...opts.config };
    this.timerSec = opts.timerSec ?? 0;
    this.spectators = opts.spectators ?? true;
    this.relay = opts.relay ?? false;
    this.now = opts.now ?? (() => Date.now());
    this.slots = Array.from({ length: opts.seatCount }, emptySlot);
    this.slots[0] = {
      ...emptySlot(),
      kind: 'host',
      name: opts.host.name,
      avatar: opts.host.avatar,
      token: newToken(),
    };
  }

  /** Start listening for clients. Rejects with 'code-taken' if the room code is in use. */
  async open() {
    await this.transport.listen(this.code);
    this.transport.onConnection((c) => this.accept(c));
    this.beat = setInterval(() => this.heartbeat(), HEARTBEAT_MS);
    this.persist();
  }

  static async restore(
    opts: Omit<HostOptions, 'seatCount' | 'config' | 'code'>,
    data: PersistedHost,
  ) {
    const h = new HostSession({
      ...opts,
      code: data.code,
      config: data.config,
      seatCount: data.seats.length,
      timerSec: data.timerSec,
      spectators: data.spectators,
    });
    h.slots = data.seats.map((s) => ({
      ...emptySlot(),
      ...s,
      // humans are away until they reconnect with their token
      awaySince: s.kind === 'human' ? Date.now() : null,
    }));
    h.hostSeat = data.hostSeat;
    h.locked = data.locked;
    h.botsEnabled = data.botsEnabled ?? data.seats.some((s) => s.kind === 'bot');
    h.generation = data.gen;
    await h.open();
    if (data.started && data.snapshot) {
      h.started = true;
      h.attachInner(
        LocalSession.restore(
          {
            game: opts.game,
            timerSec: data.timerSec,
            thinkMs: opts.thinkMs,
            onSave: (s) => h.persist(s),
          },
          data.snapshot,
        ),
      );
      h.slots.forEach((s, i) => s.kind === 'human' && h.inner!.setAuto(i, true));
    }
    return h;
  }

  // ---------- lobby ----------

  private connState(slot: Slot): ConnState {
    if (slot.kind === 'bot' || slot.kind === 'empty') return 'good';
    if (slot.kind === 'host') return 'good';
    if (!slot.connId) return 'away';
    const info = this.conns.get(slot.connId);
    if (!info) return 'away';
    return this.now() - info.lastSeen > SLOW_MS ? 'slow' : 'good';
  }

  getLobby(): Lobby {
    return {
      code: this.code,
      gameId: this.gameId,
      config: this.config,
      seats: this.slots.map((s) => ({
        kind: s.kind,
        name: s.name,
        avatar: s.avatar,
        ready: s.kind === 'host' ? true : s.ready,
        conn: this.connState(s),
        difficulty: s.difficulty,
      })),
      hostSeat: this.hostSeat,
      timerSec: this.timerSec,
      locked: this.locked,
      spectators: this.spectators,
      spectatorCount: [...this.conns.values()].filter((c) => c.seat === 'spectator').length,
      started: this.started,
      gen: this.generation,
      relay: this.relay,
      botsEnabled: this.botsEnabled,
      maxPlayers: this.slots.length,
      minPlayers: this.game.minPlayers,
      gameMax: this.game.maxPlayers,
    };
  }

  subscribeLobby(fn: (l: Lobby) => void) {
    this.lobbyListeners.add(fn);
    return () => {
      this.lobbyListeners.delete(fn);
    };
  }

  private lobbyChanged() {
    const lobby = this.getLobby();
    this.lobbyListeners.forEach((f) => f(lobby));
    for (const info of this.conns.values())
      if (info.seat !== null) this.send(info, { t: 'lobby', lobby });
    this.persist();
  }

  seatInfo(i: number) {
    return this.slots[i];
  }
  get seatCount() {
    return this.slots.length;
  }

  /** Put the seats in a new order (old indices), dropping the rest, and keep every pointer to a seat right. */
  private reseat(order: number[]) {
    const to = new Map(order.map((from, i) => [from, i]));
    this.slots = order.map((from) => this.slots[from]);
    this.hostSeat = to.get(this.hostSeat) ?? 0;
    for (const info of this.conns.values())
      if (typeof info.seat === 'number') info.seat = to.get(info.seat) ?? null;
  }

  /** Change how many seats the room holds. Never drops a seated player. */
  setSeatCount(n: number) {
    if (this.started) return;
    const filled = this.slots.flatMap((s, i) => (s.kind === 'empty' ? [] : [i]));
    const want = Math.max(
      filled.length,
      Math.min(this.game.maxPlayers, Math.max(this.game.minPlayers, Math.round(n))),
    );
    if (want === this.slots.length) return;
    const empties = this.slots.flatMap((s, i) => (s.kind === 'empty' ? [i] : []));
    if (want > this.slots.length) {
      this.slots = [...this.slots, ...Array.from({ length: want - this.slots.length }, emptySlot)];
    } else {
      // drop empty seats from the end, so seated players keep their places
      const drop = new Set(empties.slice(-(this.slots.length - want)));
      this.reseat(this.slots.flatMap((_, i) => (drop.has(i) ? [] : [i])));
    }
    this.lobbyChanged();
  }

  /** Switch bots on or off. Turning them off sends the bots away. */
  setBotsEnabled(v: boolean) {
    if (this.started || this.botsEnabled === v) return;
    this.botsEnabled = v;
    if (!v) this.slots = this.slots.map((s) => (s.kind === 'bot' ? emptySlot() : s));
    this.lobbyChanged();
  }

  /** Add one bot in the first free seat. */
  addBotNext(difficulty: Difficulty = 'medium') {
    const seat = this.slots.findIndex((s) => s.kind === 'empty');
    if (seat >= 0) this.addBot(seat, difficulty);
  }
  /** Remove the bot in the last seat that has one. */
  removeBotLast() {
    const seat = this.slots.map((s) => s.kind).lastIndexOf('bot');
    if (seat >= 0) this.removeBot(seat);
  }

  addBot(seat: number, difficulty: Difficulty = 'medium') {
    if (this.started || !this.botsEnabled || this.slots[seat]?.kind !== 'empty') return;
    const used = new Set(this.slots.map((s) => s.name));
    const name = BOT_NAMES.find((n) => !used.has(n)) ?? `Bot ${seat + 1}`;
    this.slots[seat] = {
      ...emptySlot(),
      kind: 'bot',
      name,
      avatar: BOT_AVATARS[seat % BOT_AVATARS.length],
      difficulty,
      ready: true,
    };
    this.lobbyChanged();
  }
  removeBot(seat: number) {
    if (this.started || this.slots[seat]?.kind !== 'bot') return;
    this.slots[seat] = emptySlot();
    this.lobbyChanged();
  }
  setBotDifficulty(seat: number, d: Difficulty) {
    if (this.slots[seat]?.kind !== 'bot') return;
    this.slots[seat].difficulty = d;
    this.lobbyChanged();
  }
  swapSeats(a: number, b: number) {
    if (this.started || a === b || !this.slots[a] || !this.slots[b]) return;
    [this.slots[a], this.slots[b]] = [this.slots[b], this.slots[a]];
    if (this.hostSeat === a) this.hostSeat = b;
    else if (this.hostSeat === b) this.hostSeat = a;
    for (const info of this.conns.values()) {
      if (info.seat === a) info.seat = b;
      else if (info.seat === b) info.seat = a;
    }
    this.lobbyChanged();
  }
  kick(seat: number) {
    const s = this.slots[seat];
    if (!s || s.kind !== 'human') return;
    const info = s.connId ? this.conns.get(s.connId) : undefined;
    if (info) {
      this.send(info, { t: 'kicked' });
      info.seat = null;
      info.conn.close();
    }
    if (this.started) {
      this.slots[seat] = {
        ...emptySlot(),
        kind: 'bot',
        name: s.name,
        avatar: s.avatar,
        ready: true,
      };
      this.inner?.setAuto(seat, true);
    } else {
      this.slots[seat] = emptySlot();
    }
    this.lobbyChanged();
  }
  setLocked(v: boolean) {
    this.locked = v;
    this.lobbyChanged();
  }
  setSpectators(v: boolean) {
    this.spectators = v;
    this.lobbyChanged();
  }
  setTimer(sec: number) {
    if (this.started) return;
    this.timerSec = sec;
    this.lobbyChanged();
  }
  setConfig(config: GameConfig) {
    if (this.started) return;
    this.config = { ...this.game.defaultConfig, ...config };
    this.lobbyChanged();
  }
  setHostProfile(name: string, avatar: string) {
    const s = this.slots[this.hostSeat];
    s.name = name.slice(0, 16);
    s.avatar = avatar;
    this.lobbyChanged();
  }

  /** all seated people are ready and there are enough seats to play */
  canStart() {
    if (this.started) return false;
    const filled = this.slots.filter((s) => s.kind !== 'empty').length;
    const humansReady = this.slots.every((s) => s.kind !== 'human' || (s.ready && s.connId));
    return filled >= this.game.minPlayers && humansReady;
  }

  startGame() {
    if (!this.canStart()) return false;
    // seats nobody took are dropped: bots only play when the host added them
    this.reseat(this.slots.flatMap((s, i) => (s.kind === 'empty' ? [] : [i])));
    this.started = true;
    this.newGame();
    this.lobbyChanged();
    return true;
  }

  private buildPlayers(): PlayerInfo[] {
    return this.slots.map((s, i) => ({
      id: `p${i}`,
      name: s.name,
      avatar: s.avatar,
      isBot: s.kind === 'bot',
      difficulty: s.difficulty,
    }));
  }

  private newGame() {
    this.innerUnsub?.();
    this.inner?.dispose();
    const inner = new LocalSession({
      game: this.game,
      players: this.buildPlayers(),
      config: this.config,
      timerSec: this.timerSec,
      thinkMs: this.opts.thinkMs,
      onSave: (s) => this.persist(s),
    });
    this.attachInner(inner);
    for (const info of this.conns.values())
      if (info.seat !== null) this.sendView(info, inner.initialEvents);
  }

  /** Host asks for another game with the same table. */
  rematch() {
    if (!this.started || !this.inner?.result()) return false;
    this.generation++;
    this.newGame();
    this.lobbyChanged();
    return true;
  }

  private attachInner(inner: LocalSession) {
    this.inner = inner;
    this.innerUnsub = inner.subscribe((u) => {
      this.listeners.forEach((f) => f(u));
      for (const info of this.conns.values()) if (info.seat !== null) this.sendView(info, u.events);
    });
  }

  // ---------- connections ----------

  private accept(conn: Connection) {
    const info: ConnInfo = {
      conn,
      seat: null,
      lastSeen: this.now(),
      actionTimes: [],
      reactAt: 0,
      seq: 0,
    };
    this.conns.set(conn.id, info);
    conn.onMessage((raw) => this.onRaw(info, raw));
    conn.onClose(() => this.onClose(info));
  }

  private send(info: ConnInfo, msg: HostMsg) {
    try {
      info.conn.send(encode(msg));
    } catch {
      /* too large or closed: nothing sensible to do */
    }
  }

  private onRaw(info: ConnInfo, raw: string) {
    info.lastSeen = this.now();
    const msg = parseClientMsg(raw);
    if (!msg) return this.send(info, { t: 'error', code: 'bad_message' });
    if (msg.t === 'ping') return this.send(info, { t: 'pong' });
    if (msg.t === 'hello') return this.onHello(info, msg);
    if (info.seat === null) return;
    switch (msg.t) {
      case 'ready':
        if (
          typeof info.seat === 'number' &&
          this.slots[info.seat]?.kind === 'human' &&
          !this.started
        ) {
          this.slots[info.seat].ready = msg.on;
          this.lobbyChanged();
        }
        return;
      case 'profile':
        if (
          typeof info.seat === 'number' &&
          !this.started &&
          this.slots[info.seat]?.kind === 'human'
        ) {
          this.slots[info.seat].name = msg.name;
          this.slots[info.seat].avatar = msg.avatar;
          this.lobbyChanged();
        }
        return;
      case 'back':
        if (typeof info.seat === 'number') this.inner?.setAuto(info.seat, false);
        return;
      case 'react':
        return this.onReact(info, msg.id);
      case 'action':
        return this.onAction(info, msg.action);
    }
  }

  private onHello(info: ConnInfo, msg: Extract<ClientMsg, { t: 'hello' }>) {
    if (msg.v !== PROTOCOL_VERSION) return this.send(info, { t: 'error', code: 'version' });
    // reconnect with a token: same seat back
    if (msg.token) {
      const i = this.slots.findIndex((s) => s.token === msg.token && s.kind !== 'bot');
      if (i >= 0) {
        const slot = this.slots[i];
        const stale = slot.connId ? this.conns.get(slot.connId) : undefined;
        if (stale && stale !== info) {
          stale.seat = null;
          stale.conn.close();
        }
        slot.connId = info.conn.id;
        slot.awaySince = null;
        info.seat = i;
        this.send(info, {
          t: 'welcome',
          v: PROTOCOL_VERSION,
          seat: i,
          token: slot.token!,
          lobby: this.getLobby(),
        });
        if (this.inner) {
          if (slot.kind === 'human') this.inner.setAuto(i, false);
          this.sendView(info, []);
        }
        this.lobbyChanged();
        return;
      }
    }
    const wantsWatch = !!msg.spectate;
    const free = this.slots.findIndex((s) => s.kind === 'empty');
    const canSeat = !wantsWatch && !this.locked && !this.started && free >= 0;
    if (canSeat) {
      const token = newToken();
      this.slots[free] = {
        ...emptySlot(),
        kind: 'human',
        name: msg.name,
        avatar: msg.avatar,
        token,
        connId: info.conn.id,
      };
      info.seat = free;
      this.send(info, {
        t: 'welcome',
        v: PROTOCOL_VERSION,
        seat: free,
        token,
        lobby: this.getLobby(),
      });
      this.lobbyChanged();
      return;
    }
    if (this.spectators) {
      info.seat = 'spectator';
      this.send(info, {
        t: 'welcome',
        v: PROTOCOL_VERSION,
        seat: 'spectator',
        token: '',
        lobby: this.getLobby(),
      });
      if (this.inner) this.sendView(info, []);
      this.lobbyChanged();
      return;
    }
    const reason = this.locked ? 'locked' : this.started ? 'started' : 'full';
    this.send(info, { t: 'error', code: reason });
    info.conn.close();
  }

  private onAction(info: ConnInfo, action: unknown) {
    if (!this.inner || typeof info.seat !== 'number')
      return this.send(info, { t: 'error', code: 'not_playing' });
    const t = this.now();
    info.actionTimes = info.actionTimes.filter((x) => t - x < 1000);
    if (info.actionTimes.length >= MAX_ACTIONS_PER_SECOND)
      return this.send(info, { t: 'error', code: 'rate' });
    info.actionTimes.push(t);
    try {
      this.inner.submit(info.seat, action);
    } catch (e) {
      this.send(info, {
        t: 'error',
        code: 'illegal',
        message: e instanceof IllegalActionError ? e.message : 'invalid action',
      });
      // resync so the client's screen matches the table
      this.sendView(info, []);
    }
  }

  private onReact(info: ConnInfo, id: string) {
    const t = this.now();
    if (t - info.reactAt < 800 || !(REACTIONS as readonly string[]).includes(id)) return;
    info.reactAt = t;
    this.broadcastReaction(info.seat as number | 'spectator', id);
  }

  private broadcastReaction(seat: number | 'spectator', id: string) {
    this.reactionListeners.forEach((f) => f(seat, id));
    for (const c of this.conns.values())
      if (c.seat !== null) this.send(c, { t: 'reaction', seat, id });
  }

  private onClose(info: ConnInfo) {
    this.conns.delete(info.conn.id);
    if (this.closed || typeof info.seat !== 'number') {
      if (info.seat === 'spectator') this.lobbyChanged();
      return;
    }
    const slot = this.slots[info.seat];
    if (!slot || slot.connId !== info.conn.id) return;
    slot.connId = null;
    slot.awaySince = this.now();
    slot.ready = this.started ? slot.ready : false;
    if (this.inner && slot.kind === 'human') this.inner.setAuto(info.seat, true);
    this.lobbyChanged();
  }

  private heartbeat() {
    const t = this.now();
    for (const info of [...this.conns.values()]) {
      if (info.seat !== null && t - info.lastSeen > AWAY_MS) info.conn.close();
    }
    let changed = false;
    this.slots.forEach((s, i) => {
      if (s.kind === 'human' && s.awaySince !== null && t - s.awaySince > AWAY_GRACE_MS) {
        if (this.started) {
          this.slots[i] = {
            ...emptySlot(),
            kind: 'bot',
            name: s.name,
            avatar: s.avatar,
            ready: true,
          };
        } else {
          this.slots[i] = emptySlot();
        }
        changed = true;
      }
    });
    if (changed) this.lobbyChanged();
    else if (this.lobbyListeners.size > 0 || this.conns.size > 0) this.lobbyChanged();
  }

  // ---------- views ----------

  private envelope(seat: ViewerSeat) {
    const inner = this.inner!;
    const actors = inner.currentActors();
    return {
      actors,
      playPhase: inner.isPlayPhase(),
      auto: this.slots.flatMap((_, i) => (inner.isAuto(i) ? [i] : [])),
      timers: actors.flatMap((a) => {
        const tm = inner.getTimer(a);
        return tm ? [{ seat: a, ...tm }] : [];
      }),
      conn: this.slots.map((s) => this.connState(s)),
      result: inner.result(),
      view: inner.getView(seat),
    };
  }

  private sendView(info: ConnInfo, events: GameEvent[]) {
    if (!this.inner || info.seat === null) return;
    const seat: ViewerSeat = info.seat;
    const env = this.envelope(seat);
    this.send(info, {
      t: 'view',
      gen: this.generation,
      seq: ++info.seq,
      seat,
      view: env.view,
      events: this.inner.filterEvents(events, seat) as { type: string }[],
      actors: env.actors,
      playPhase: env.playPhase,
      auto: env.auto,
      timers: env.timers,
      conn: env.conn,
      result: env.result,
    });
  }

  // ---------- persistence ----------

  private persist(snapshot?: Snapshot) {
    if (this.closed || !this.opts.persist) return;
    const snap = snapshot ?? this.inner?.snapshot() ?? null;
    this.opts.persist({
      v: 1,
      code: this.code,
      gameId: this.gameId,
      config: this.config,
      seats: this.slots.map(({ kind, name, avatar, difficulty, token }) => ({
        kind,
        name,
        avatar,
        difficulty,
        token,
      })),
      hostSeat: this.hostSeat,
      timerSec: this.timerSec,
      locked: this.locked,
      spectators: this.spectators,
      botsEnabled: this.botsEnabled,
      gen: this.generation,
      started: this.started,
      snapshot: snap,
    });
  }

  // ---------- Session (the host's own screen) ----------

  get mySeat() {
    return this.hostSeat;
  }
  get players() {
    return this.playersList();
  }
  private playersList(): PlayerInfo[] {
    return this.inner ? this.inner.players : this.playersFromSlots();
  }
  private playersFromSlots(): PlayerInfo[] {
    return this.slots.map((s, i) => ({
      id: `p${i}`,
      name: s.name || `Seat ${i + 1}`,
      avatar: s.avatar,
      isBot: s.kind === 'bot',
      difficulty: s.difficulty,
    }));
  }
  get initialEvents(): GameEvent[] {
    return this.inner?.initialEvents ?? [];
  }
  private need() {
    if (!this.inner) throw new Error('the game has not started');
    return this.inner;
  }
  getView(seat: ViewerSeat) {
    return this.need().getView(seat);
  }
  filterEvents(events: GameEvent[], seat: ViewerSeat) {
    return this.need().filterEvents(events, seat);
  }
  currentActors() {
    return this.inner ? this.inner.currentActors() : [];
  }
  legalActions(seat: number) {
    return this.inner ? this.inner.legalActions(seat) : [];
  }
  submit(seat: number, action: unknown) {
    this.need().submit(seat, action);
  }
  result(): GameResult | null {
    return this.inner ? this.inner.result() : null;
  }
  isPlayPhase() {
    return this.inner ? this.inner.isPlayPhase() : false;
  }
  getTimer(seat: number) {
    return this.inner ? this.inner.getTimer(seat) : null;
  }
  isAuto(seat: number) {
    return this.inner ? this.inner.isAuto(seat) : false;
  }
  setAuto(seat: number, on: boolean) {
    this.inner?.setAuto(seat, on);
  }
  getConn(seat: number) {
    return this.connState(this.slots[seat]);
  }
  subscribe(fn: (u: SessionUpdate) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  start() {
    this.inner?.start();
  }
  pause() {
    /* online games never pause: other people are waiting */
  }
  resume() {
    /* see pause */
  }
  react(id: string) {
    if ((REACTIONS as readonly string[]).includes(id)) this.broadcastReaction(this.hostSeat, id);
  }
  onReaction(fn: (seat: number | 'spectator', id: string) => void) {
    this.reactionListeners.add(fn);
    return () => {
      this.reactionListeners.delete(fn);
    };
  }

  /** end the room for everyone */
  close() {
    if (this.closed) return;
    const results = this.inner?.result() ?? null;
    for (const info of this.conns.values()) this.send(info, { t: 'closed', results });
    this.closed = true;
    if (this.beat) clearInterval(this.beat);
    this.innerUnsub?.();
    this.inner?.dispose();
    for (const info of [...this.conns.values()]) info.conn.close();
    this.transport.close();
    this.opts.persist?.(null);
  }
  dispose() {
    this.close();
  }
}
