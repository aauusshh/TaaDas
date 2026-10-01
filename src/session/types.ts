import type { GameEvent, ViewerSeat } from '../engine/core/events';
import type { GameId, GameResult, PlayerInfo } from '../engine/core/types';

export interface SessionUpdate {
  version: number;
  /** raw engine events; filter per viewer with session.filterEvents */
  events: GameEvent[];
}

/** One interface for the UI, whether the game runs locally or over the network. */
export interface Session<V = unknown, A = unknown> {
  readonly gameId: GameId;
  readonly players: PlayerInfo[];
  getView(seat: ViewerSeat): V;
  filterEvents(events: GameEvent[], seat: ViewerSeat): GameEvent[];
  currentActors(): number[];
  legalActions(seat: number): A[];
  /** throws IllegalActionError when rejected */
  submit(seat: number, action: A): void;
  result(): GameResult | null;
  subscribe(fn: (u: SessionUpdate) => void): () => void;
  /** bots start acting; safe to call more than once */
  start(): void;
  /** local games: stop bots while a menu is open */
  pause(): void;
  resume(): void;
  /** events from setup (the deal), for the first animation */
  readonly initialEvents: GameEvent[];
  /** false between rounds / at game end */
  isPlayPhase(): boolean;
  /** turn timer for a seat, null when off or not their turn */
  getTimer(seat: number): { remainingMs: number; totalMs: number } | null;
  isAuto(seat: number): boolean;
  /** put a seat on or off Auto (a bot plays for it) */
  setAuto(seat: number, on: boolean): void;
  /** online sessions */
  readonly mySeat?: number;
  readonly generation?: number;
  getConn?(seat: number): 'good' | 'slow' | 'away';
  react?(id: string): void;
  onReaction?(fn: (seat: number | 'spectator', id: string) => void): () => void;
  dispose(): void;
}

export interface Snapshot {
  gameId: GameId;
  config: Record<string, boolean | number | string>;
  players: PlayerInfo[];
  state: unknown;
  rngState: number;
}
