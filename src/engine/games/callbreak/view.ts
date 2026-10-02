import type { Card } from '../../core/cards';
import type { CallBreakConfig } from './config';
import type { TrickPlay } from './rules';

export type CallBreakAction =
  { type: 'bid'; bid: number } | { type: 'play'; cardId: number } | { type: 'next' };

export interface CallBreakState {
  n: 4;
  config: CallBreakConfig;
  humans: boolean[];
  dealer: number;
  round: number;
  hands: Card[][];
  bids: (number | null)[];
  tricksWon: number[];
  trick: TrickPlay[];
  leader: number;
  turn: number;
  phase: 'bidding' | 'playing' | 'roundEnd' | 'over';
  /** per completed round, one score per seat */
  roundScores: number[][];
  lastTrick: TrickPlay[] | null;
  lastWinner: number | null;
  /** cards from completed tricks this round (public) */
  played: Card[];
}

export interface CallBreakView {
  seat: number | 'spectator';
  config: CallBreakConfig;
  dealer: number;
  round: number;
  rounds: number;
  hand: Card[];
  handCounts: number[];
  bids: (number | null)[];
  tricksWon: number[];
  trick: TrickPlay[];
  leader: number;
  turn: number;
  phase: CallBreakState['phase'];
  roundScores: number[][];
  totals: number[];
  lastTrick: TrickPlay[] | null;
  lastWinner: number | null;
  played: Card[];
  /** card ids the viewer may play right now */
  legalIds: number[];
  /** bids the viewer may make right now */
  legalBids: number[];
}
