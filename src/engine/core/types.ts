import type { GameEvent, ViewerSeat } from './events';
import type { Rng } from './rng';

export type GameId =
  | 'highcard'
  | 'callbreak'
  | 'marriage'
  | 'teenpatti'
  | 'dhumbal'
  | 'jutpatti'
  | 'kitti'
  | 'inbetween'
  | 'rangi'
  | 'langurburja';

export type Difficulty = 'easy' | 'medium' | 'hard';

export interface PlayerInfo {
  id: string;
  name: string;
  avatar: string;
  isBot: boolean;
  difficulty: Difficulty;
}

export class IllegalActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IllegalActionError';
  }
}

export type Step<S> = { state: S; events: GameEvent[] };

export type ConfigValue = boolean | number | string;
export type GameConfig = Record<string, ConfigValue>;

export interface ConfigOption {
  value: ConfigValue;
  labelKey: string;
}

export type ConfigField = {
  key: string;
  labelKey: string;
  /** setup screen section */
  group: string;
  hintKey?: string;
} & (
  | { type: 'toggle'; default: boolean }
  | { type: 'select'; default: ConfigValue; options: ConfigOption[] }
  | { type: 'number'; default: number; min: number; max: number; step?: number }
);

export interface GameResult {
  /** one score per seat (higher is better unless lowerIsBetter) */
  scores: number[];
  winners: number[];
  lowerIsBetter?: boolean;
  /** chip delta per seat for chip games; sums to zero */
  chipDelta?: number[];
}

export interface Preset<C> {
  id: string;
  nameKey: string;
  config: Partial<C>;
}

export interface GameDefinition<
  S = unknown,
  A = unknown,
  C extends GameConfig = GameConfig,
  V = unknown,
> {
  id: GameId;
  nameKey: string;
  minPlayers: number;
  maxPlayers: number;
  supports: { bots: boolean; passAndPlay: boolean; online: boolean };
  defaultConfig: C;
  configSchema: ConfigField[];
  presets: Preset<C>[];
  setup(players: PlayerInfo[], config: C, rng: Rng): Step<S>;
  /** seats allowed to act now (several during betting / arranging); empty when over */
  currentActors(state: S): number[];
  legalActions(state: S, seat: number): A[];
  /** pure; throws IllegalActionError */
  apply(state: S, seat: number, action: A, rng: Rng): Step<S>;
  /** hides secrets */
  view(state: S, seat: ViewerSeat): V;
  filterEvents(events: GameEvent[], seat: ViewerSeat): GameEvent[];
  timeoutAction(state: S, seat: number): A;
  result(state: S): GameResult | null;
  bot(view: V, legal: A[], difficulty: Difficulty, rng: Rng): A;
  /** everyone plays on one shared screen (no pass-and-play cover) */
  sharedScreen?: boolean;
  /** config the setup screen forces for a play mode (e.g. the house banks when playing alone) */
  modeConfig?(mode: 'bots' | 'local' | 'online'): Partial<C>;
  /** seats whose turn timer runs now (default: the first actor) */
  timerSeats?(state: S): number[];
  /** false between rounds and at game end: no turn timer, no pass-and-play cover (default true) */
  isPlayPhase?(state: S): boolean;
  /** sim only: return a message when state is inconsistent (card count, chip total, ...) */
  invariants?(state: S): string | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGame = GameDefinition<any, any, any, any>;

export function defaultsFromSchema(schema: ConfigField[]): GameConfig {
  const out: GameConfig = {};
  for (const f of schema) out[f.key] = f.default;
  return out;
}

export function randomConfig(schema: ConfigField[], rng: Rng): GameConfig {
  const out: GameConfig = {};
  for (const f of schema) {
    if (f.type === 'toggle') out[f.key] = rng.next() < 0.5;
    else if (f.type === 'select') out[f.key] = rng.pick(f.options).value;
    else out[f.key] = rng.range(f.min, f.max);
  }
  return out;
}
