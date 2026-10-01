export type Suit = 'S' | 'H' | 'D' | 'C' | 'J';
/** 1 = Ace, 11 = Jack, 12 = Queen, 13 = King, 0 = printed joker */
export type Rank = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

export interface Card {
  /** unique across the whole game, even with several decks */
  id: number;
  suit: Suit;
  rank: Rank;
  /** which physical deck (0-based) */
  copy: number;
}

export const SUITS: readonly Exclude<Suit, 'J'>[] = ['S', 'H', 'D', 'C'];
export const RANKS: readonly Exclude<Rank, 0>[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];

export const isJoker = (c: Card) => c.suit === 'J';
export const isRed = (c: Card) => c.suit === 'H' || c.suit === 'D';
export const sameFace = (a: Card, b: Card) => a.suit === b.suit && a.rank === b.rank;

/** Ace high rank value (A=14). Jokers 15. */
export const rankAceHigh = (c: Card) => (isJoker(c) ? 15 : c.rank === 1 ? 14 : c.rank);

const RANK_LABEL: Record<number, string> = { 0: 'Jk', 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
export const rankLabel = (r: Rank) => RANK_LABEL[r] ?? String(r);
export const cardLabel = (c: Card) => (isJoker(c) ? 'Jk' : `${rankLabel(c.rank)}${c.suit}`);
