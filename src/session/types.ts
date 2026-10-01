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
  dispose(): void;
}

export interface Snapshot {
  gameId: GameId;
  config: Record<string, boolean | number | string>;
  players: PlayerInfo[];
  state: unknown;
  rngState: number;
}
