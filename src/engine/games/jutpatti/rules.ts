import { isRed, type Card } from '../../core/cards';
import type { JutPattiConfig } from './config';

/** Rank that counts as joker: one above the indicator (K goes to A), or the same rank. */
export function jokerRank(indicator: Card, mode: JutPattiConfig['jokerMode']): number {
  if (mode === 'same') return indicator.rank;
  return indicator.rank === 13 ? 1 : indicator.rank + 1;
}

export const isJoker = (c: Card, jr: number) => c.rank === jr;

/**
 * Can the whole hand be split into pairs? Same rank (and the same color when pairColor is on).
 * A joker pairs with any card; two jokers pair together.
 */
export function allPairs(hand: Card[], jr: number, pairColor: boolean): boolean {
  if (hand.length === 0 || hand.length % 2 !== 0) return false;
  const jokers = hand.filter((c) => isJoker(c, jr)).length;
  const groups = new Map<string, number>();
  for (const c of hand) {
    if (isJoker(c, jr)) continue;
    const key = pairColor ? `${c.rank}${isRed(c) ? 'r' : 'b'}` : String(c.rank);
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  let singles = 0;
  for (const n of groups.values()) singles += n % 2;
  return singles <= jokers && (jokers - singles) % 2 === 0;
}

/** How many unmatched singles the hand has, with jokers as helpers: a rough "distance to winning". */
export function unmatched(hand: Card[], jr: number, pairColor: boolean): number {
  const jokers = hand.filter((c) => isJoker(c, jr)).length;
  const groups = new Map<string, number>();
  for (const c of hand) {
    if (isJoker(c, jr)) continue;
    const key = pairColor ? `${c.rank}${isRed(c) ? 'r' : 'b'}` : String(c.rank);
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }
  let singles = 0;
  for (const n of groups.values()) singles += n % 2;
  return Math.max(0, singles - jokers) + ((jokers - Math.min(jokers, singles)) % 2);
}

/** Block deals that leave fewer than 10 cards in the stock (after the indicator). */
export const dealFits = (players: number, deal: number) => 52 - players * deal - 1 >= 10;
