import { rankAceHigh, type Card } from '../../engine/core/cards';

const SUIT_ORDER: Record<string, number> = { S: 0, H: 1, C: 2, D: 3, J: 4 };

/** Suits alternate black and red so neighbors are easy to tell apart; high cards first. */
export function sortBySuit(cards: Card[]): Card[] {
  return cards
    .slice()
    .sort((a, b) => SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit] || rankAceHigh(b) - rankAceHigh(a));
}

export function sortByRank(cards: Card[]): Card[] {
  return cards
    .slice()
    .sort((a, b) => rankAceHigh(b) - rankAceHigh(a) || SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit]);
}
