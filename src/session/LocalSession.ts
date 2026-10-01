import type { GameEvent, ViewerSeat } from '../engine/core/events';
import { createRng, restoreRng, type Rng } from '../engine/core/rng';
import {
  IllegalActionError,
  type AnyGame,
  type Difficulty,
  type GameConfig,
  type GameResult,
  type PlayerInfo,
} from '../engine/core/types';
import { useSettings } from '../storage/settings';
import type { Session, SessionUpdate, Snapshot } from './types';

export interface LocalSessionOptions {
  game: AnyGame;
  players: PlayerInfo[];
  config: GameConfig;
  seed?: number;
  /** milliseconds a bot "thinks"; return 0 in tests and sims */
  thinkMs?: (difficulty: Difficulty) => number;
  /** turn timer in seconds for human seats; 0 or undefined is off */
  timerSec?: number;
  onSave?: (snapshot: Snapshot) => void;
}

/** 500-1600 ms, shorter when the player runs animations faster. */
const defaultThink = (d: Difficulty) => {
  const base = 500 + Math.floor(Math.random() * (d === 'easy' ? 700 : 1100));
  return Math.round(base / useSettings.getState().animSpeed);
};

interface HumanTimer {
  total: number;
  /** wall-clock time the timer ends; null while paused */
  endsAt: number | null;
  remaining: number;
  handle: ReturnType<typeof setTimeout> | null;
}

/** Runs the engine in this browser: bots plus humans sharing the device. */
export class LocalSession implements Session {
  readonly gameId;
  readonly players: PlayerInfo[];
  private game: AnyGame;
  private config: GameConfig;
  private rng: Rng;
  private state: unknown;
  private version = 0;
  private listeners = new Set<(u: SessionUpdate) => void>();
  private botTimers = new Map<number, ReturnType<typeof setTimeout>>();
  private humanTimers = new Map<number, HumanTimer>();
  private timeouts = new Map<number, number>();
  private auto = new Set<number>();
  private paused = false;
  private disposed = false;
  private think: (d: Difficulty) => number;
  private timerMs: number;
  private onSave?: (s: Snapshot) => void;
  /** events from setup, delivered to the first subscriber so the UI can animate the deal */
  readonly initialEvents: GameEvent[];
  private lastEvents: GameEvent[] = [];

  constructor(opts: LocalSessionOptions, restored?: Snapshot) {
    this.game = opts.game;
    this.gameId = opts.game.id;
    this.players = opts.players;
    this.config = opts.config;
    this.think = opts.thinkMs ?? defaultThink;
    this.timerMs = (opts.timerSec ?? 0) * 1000;
    this.onSave = opts.onSave;
    if (restored) {
      this.state = restored.state;
      this.rng = restoreRng(restored.rngState);
      this.initialEvents = [];
    } else {
      this.rng = createRng(opts.seed ?? Date.now());
      const step = opts.game.setup(opts.players, opts.config, this.rng);
      this.state = step.state;
      this.initialEvents = step.events;
      this.lastEvents = step.events;
    }
    this.save();
  }

  static restore(opts: Omit<LocalSessionOptions, 'config' | 'players'>, snap: Snapshot) {
    return new LocalSession({ ...opts, players: snap.players, config: snap.config }, snap);
  }

  snapshot(): Snapshot {
    return {
      gameId: this.gameId,
      config: this.config,
      players: this.players,
      state: this.state,
      rngState: this.rng.getState(),
    };
  }

  private save() {
    try {
      this.onSave?.(this.snapshot());
    } catch {
      /* storage can fail; the game goes on */
    }
  }

  /** Call once the UI is ready; lets bots start acting. */
  start() {
    this.pump();
  }

  pause() {
    this.paused = true;
    for (const t of this.botTimers.values()) clearTimeout(t);
    this.botTimers.clear();
    const now = Date.now();
    for (const h of this.humanTimers.values()) {
      if (h.handle) clearTimeout(h.handle);
      h.handle = null;
      if (h.endsAt !== null) h.remaining = Math.max(0, h.endsAt - now);
      h.endsAt = null;
    }
  }
  resume() {
    this.paused = false;
    this.pump();
  }

  getView(seat: ViewerSeat) {
    return this.game.view(this.state, seat);
  }
  filterEvents(events: GameEvent[], seat: ViewerSeat) {
    return this.game.filterEvents(events, seat);
  }
  currentActors() {
    return this.game.currentActors(this.state);
  }
  legalActions(seat: number) {
    return this.game.legalActions(this.state, seat);
  }
  result(): GameResult | null {
    return this.game.result(this.state);
  }
  isPlayPhase() {
    return this.game.isPlayPhase ? this.game.isPlayPhase(this.state) : true;
  }
  getVersion() {
    return this.version;
  }
  getLastEvents() {
    return this.lastEvents;
  }

  getTimer(seat: number) {
    const h = this.humanTimers.get(seat);
    if (!h) return null;
    const remainingMs = h.endsAt === null ? h.remaining : Math.max(0, h.endsAt - Date.now());
    return { remainingMs, totalMs: h.total };
  }

  isAuto(seat: number) {
    return this.auto.has(seat);
  }
  isBotSeat(seat: number) {
    return this.players[seat].isBot || this.auto.has(seat);
  }
  setAuto(seat: number, on: boolean) {
    if (on) this.auto.add(seat);
    else {
      this.auto.delete(seat);
      this.timeouts.set(seat, 0);
    }
    this.clearHumanTimer(seat);
    this.pump();
  }

  subscribe(fn: (u: SessionUpdate) => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  submit(seat: number, action: unknown) {
    if (this.disposed) return;
    if (!this.currentActors().includes(seat)) throw new IllegalActionError('not your turn');
    this.timeouts.set(seat, 0);
    this.run(seat, action);
    this.pump();
  }

  private run(seat: number, action: unknown) {
    this.clearHumanTimer(seat);
    const step = this.game.apply(this.state, seat, action, this.rng);
    this.state = step.state;
    this.version++;
    this.lastEvents = step.events;
    this.save();
    const update = { version: this.version, events: step.events };
    for (const l of [...this.listeners]) l(update);
  }

  private clearHumanTimer(seat: number) {
    const h = this.humanTimers.get(seat);
    if (h?.handle) clearTimeout(h.handle);
    this.humanTimers.delete(seat);
  }

  private pump() {
    if (this.disposed || this.result()) return;
    const actors = this.currentActors();
    // timers for seats that are no longer acting go away
    for (const seat of [...this.humanTimers.keys()])
      if (!actors.includes(seat)) this.clearHumanTimer(seat);
    if (this.paused) {
      return;
    }
    const playPhase = this.isPlayPhase();
    for (const seat of actors) {
      if (this.isBotSeat(seat)) {
        if (!playPhase && this.players[seat].isBot === false) continue;
        if (this.botTimers.has(seat)) continue;
        const delay = this.think(this.players[seat].difficulty);
        this.botTimers.set(
          seat,
          setTimeout(() => {
            this.botTimers.delete(seat);
            this.botMove(seat);
          }, delay),
        );
      } else if (this.timerMs > 0 && playPhase) {
        this.armHumanTimer(seat);
      }
    }
  }

  private armHumanTimer(seat: number) {
    let h = this.humanTimers.get(seat);
    if (!h) {
      h = { total: this.timerMs, endsAt: null, remaining: this.timerMs, handle: null };
      this.humanTimers.set(seat, h);
    }
    if (h.handle) return;
    h.endsAt = Date.now() + h.remaining;
    h.handle = setTimeout(() => this.onTimeout(seat), h.remaining);
  }

  private onTimeout(seat: number) {
    this.clearHumanTimer(seat);
    if (this.disposed || this.paused || !this.currentActors().includes(seat)) return;
    const n = (this.timeouts.get(seat) ?? 0) + 1;
    this.timeouts.set(seat, n);
    if (n >= 2) this.auto.add(seat);
    const action = this.game.timeoutAction(this.state, seat);
    this.run(seat, action);
    this.pump();
  }

  private botMove(seat: number) {
    if (this.disposed || this.paused || !this.currentActors().includes(seat)) return;
    const legal = this.legalActions(seat);
    if (legal.length === 0) return;
    const action = this.game.bot(
      this.game.view(this.state, seat),
      legal,
      this.players[seat].difficulty,
      this.rng,
    );
    this.run(seat, action);
    this.pump();
  }

  dispose() {
    this.disposed = true;
    for (const t of this.botTimers.values()) clearTimeout(t);
    this.botTimers.clear();
    for (const h of this.humanTimers.values()) if (h.handle) clearTimeout(h.handle);
    this.humanTimers.clear();
    this.listeners.clear();
  }
}
