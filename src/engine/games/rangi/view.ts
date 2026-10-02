import type { RangiConfig } from './config';
import type { PendingKind, RCard, RColor } from './rules';

export type RangiAction =
  | { type: 'play'; cardId: number; color?: RColor; swapWith?: number }
  | { type: 'draw' }
  | { type: 'pass' }
  | { type: 'color'; color: RColor }
  | { type: 'challenge' }
  | { type: 'accept' }
  | { type: 'ek' }
  | { type: 'caught' }
  | { type: 'next' };

export interface RangiState {
  n: number;
  config: RangiConfig;
  humans: boolean[];
  levels: ('easy' | 'medium' | 'hard')[];
  hands: RCard[][];
  draw: RCard[];
  discard: RCard[];
  color: RColor;
  dir: 1 | -1;
  turn: number;
  dealer: number;
  round: number;
  phase: 'play' | 'color' | 'challenge' | 'roundEnd' | 'over';
  pending: number;
  pendingKind: PendingKind;
  /** the card the current player just drew and may still play */
  drawnId: number | null;
  ek: { seat: number; called: boolean } | null;
  challenge: { offender: number; target: number; legal: boolean } | null;
  /** points awarded each finished round, one entry per seat */
  roundScores: number[][];
  lastWinner: number | null;
  stall: number;
}

export interface PlayOption {
  cardId: number;
  needsColor: boolean;
  /** seats to swap with (seven-zero); empty when the card has no swap */
  swapTargets: number[];
  /** playing it out of turn */
  jumpIn: boolean;
}

export interface RangiView {
  seat: number | 'spectator';
  config: RangiConfig;
  n: number;
  hand: RCard[];
  handCounts: number[];
  top: RCard | null;
  /** last few discards, oldest first */
  tail: RCard[];
  drawCount: number;
  color: RColor;
  dir: 1 | -1;
  turn: number;
  dealer: number;
  round: number;
  phase: RangiState['phase'];
  pending: number;
  pendingKind: PendingKind;
  drawnId: number | null;
  ek: { seat: number; called: boolean } | null;
  challenge: { offender: number; target: number } | null;
  roundScores: number[][];
  totals: number[];
  lastWinner: number | null;
  /** what the viewer may do right now */
  plays: PlayOption[];
  canDraw: boolean;
  canPass: boolean;
  canChallenge: boolean;
  canEk: boolean;
  canCatch: boolean;
  canNext: boolean;
  mustChooseColor: boolean;
}
