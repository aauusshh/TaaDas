import { type Card, RANKS, SUITS } from './cards';
import type { Rng } from './rng';

export interface DeckOptions {
  /** number of 52-card decks */
  decks?: number;
  /** printed jokers per deck */
  jokersPerDeck?: number;
  /** drop these ranks (e.g. Teen Patti variants) */
  dropRanks?: number[];
  firstId?: number;
}

/** Ordered (unshuffled) deck. Card ids are unique: copy * 54 + index. */
export function makeDeck(opts: DeckOptions = {}): Card[] {
  const { decks = 1, jokersPerDeck = 0, dropRanks = [], firstId = 0 } = opts;
  const cards: Card[] = [];
  let id = firstId;
  for (let copy = 0; copy < decks; copy++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        if (dropRanks.includes(rank)) continue;
        cards.push({ id: id++, suit, rank, copy });
      }
    }
    for (let j = 0; j < jokersPerDeck; j++) cards.push({ id: id++, suit: 'J', rank: 0, copy });
  }
  return cards;
}

export function shuffledDeck(rng: Rng, opts: DeckOptions = {}): Card[] {
  return rng.shuffle(makeDeck(opts));
}

/** Deal `perHand` cards to each of `hands` hands, round-robin, from the top (end of array). */
export function dealRoundRobin(
  deck: Card[],
  hands: number,
  perHand: number,
): { hands: Card[][]; rest: Card[] } {
  const rest = deck.slice();
  const out: Card[][] = Array.from({ length: hands }, () => []);
  for (let i = 0; i < perHand; i++) {
    for (let h = 0; h < hands; h++) {
      const c = rest.pop();
      if (!c) throw new Error('deck ran out while dealing');
      out[h].push(c);
    }
  }
  return { hands: out, rest };
}
