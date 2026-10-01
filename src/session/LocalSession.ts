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
  onSave?: (snapshot: Snapshot) => void;
}

/** 500-1600 ms, shorter when the player runs animations faster. */
const defaultThink = (d: Difficulty) => {
  const base = 500 + Math.floor(Math.random() * (d === 'easy' ? 700 : 1100));
  return Math.round(base / useSettings.getState().animSpeed);
};

/** Runs the engine in this browser: bots plus humans sharing the device. */
export class LocalSession implements Session {
  private paused = false;
  readonly gameId;
  readonly players: PlayerInfo[];
  private game: AnyGame;
  private config: GameConfig;
  private rng: Rng;
  private state: unknown;
  private version = 0;
  private listeners = new Set<(u: SessionUpdate) => void>();
  private timers = new Map<number, ReturnType<typeof setTimeout>>();
  private auto = new Set<number>();
  private disposed = false;
  private think: (d: Difficulty) => number;
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
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
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
  getVersion() {
    return this.version;
  }
  getLastEvents() {
    return this.lastEvents;
  }

  isBotSeat(seat: number) {
    return this.players[seat].isBot || this.auto.has(seat);
  }
  setAuto(seat: number, on: boolean) {
    if (on) this.auto.add(seat);
    else this.auto.delete(seat);
    this.pump();
  }

  subscribe(fn: (u: SessionUpdate) => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  submit(seat: number, action: unknown) {
    if (this.disposed) return;
    if (!this.currentActors().includes(seat)) throw new IllegalActionError('not your turn');
    this.run(seat, action);
    this.pump();
  }

  private run(seat: number, action: unknown) {
    const step = this.game.apply(this.state, seat, action, this.rng);
    this.state = step.state;
    this.version++;
    this.lastEvents = step.events;
    this.save();
    const update = { version: this.version, events: step.events };
    for (const l of [...this.listeners]) l(update);
  }

  private pump() {
    if (this.disposed || this.paused || this.result()) return;
    for (const seat of this.currentActors()) {
      if (!this.isBotSeat(seat) || this.timers.has(seat)) continue;
      const delay = this.think(this.players[seat].difficulty);
      this.timers.set(
        seat,
        setTimeout(() => {
          this.timers.delete(seat);
          this.botMove(seat);
        }, delay),
      );
    }
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
    for (const t of this.timers.values()) clearTimeout(t);
    this.timers.clear();
    this.listeners.clear();
  }
}
