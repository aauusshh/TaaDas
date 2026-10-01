import { isJoker, type Card, type Rank } from '../../core/cards';
import type { DhumbalConfig } from './config';

export type ThrowKind = 'single' | 'set' | 'run';

export interface Classified {
  kind: ThrowKind;
  /** a run in position order (low to high, jokers in the spots they stand for); sets and singles in given order */
  ordered: Card[];
}

export function cardValue(c: Card, cfg: Pick<DhumbalConfig, 'jqk10'>): number {
  if (isJoker(c)) return 0;
  if (c.rank >= 11) return cfg.jqk10 ? 10 : c.rank;
  return c.rank;
}

export const handTotal = (hand: Card[], cfg: Pick<DhumbalConfig, 'jqk10'>) =>
  hand.reduce((t, c) => t + cardValue(c, cfg), 0);

type ThrowCfg = Pick<DhumbalConfig, 'jokersWild'>;

/** A legal throw is one card, 2-4 of a rank, or a run of 3+ in one suit (Ace low only). */
export function classifyThrow(cards: Card[], cfg: ThrowCfg): Classified | null {
  const n = cards.length;
  if (n === 0) return null;
  if (n === 1) return { kind: 'single', ordered: cards };
  const jokers = cards.filter((c) => isJoker(c));
  const real = cards.filter((c) => !isJoker(c));

  if (n <= 4) {
    if (real.length === 0) return { kind: 'set', ordered: cards };
    if (real.every((c) => c.rank === real[0].rank) && (jokers.length === 0 || cfg.jokersWild)) {
      return { kind: 'set', ordered: [...real, ...jokers] };
    }
  }

  if (n >= 3 && real.length > 0 && (jokers.length === 0 || cfg.jokersWild)) {
    const suit = real[0].suit;
    if (!real.every((c) => c.suit === suit)) return null;
    const ranks = real.map((c) => c.rank).sort((a, b) => a - b);
    if (new Set(ranks).size !== ranks.length) return null;
    const lo = ranks[0];
    const hi = ranks[ranks.length - 1];
    const span = hi - lo + 1;
    if (span > n || n > 13) return null;
    const gaps = span - real.length;
    const extra = jokers.length - gaps;
    if (extra < 0 || 13 - hi + (lo - 1) < extra) return null;
    // lay the run out: extend upward first, then downward
    const up = Math.min(extra, 13 - hi);
    const down = extra - up;
    const start = lo - down;
    const byRank = new Map(real.map((c) => [c.rank, c]));
    const spare = jokers.slice();
    const ordered: Card[] = [];
    for (let r = start; r < start + n; r++) ordered.push(byRank.get(r as Rank) ?? spare.shift()!);
    return { kind: 'run', ordered };
  }
  return null;
}

/** Cards a player may pick from the previous throw. */
export function pickableFrom(
  throwCards: Card[],
  kind: ThrowKind,
  cfg: Pick<DhumbalConfig, 'pickAnyFromRun'>,
): Card[] {
  if (kind !== 'run' || cfg.pickAnyFromRun) return throwCards;
  return [throwCards[0], throwCards[throwCards.length - 1]];
}

/** Every legal throw from a hand, as lists of card ids. */
export function allThrows(hand: Card[], cfg: ThrowCfg): { ids: number[]; c: Classified }[] {
  const out: { ids: number[]; c: Classified }[] = [];
  const n = hand.length;
  if (n > 13)
    return hand.map((c) => ({ ids: [c.id], c: { kind: 'single' as const, ordered: [c] } }));
  for (let mask = 1; mask < 1 << n; mask++) {
    const cards: Card[] = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) cards.push(hand[i]);
    const c = classifyThrow(cards, cfg);
    if (c) out.push({ ids: cards.map((x) => x.id), c });
  }
  return out;
}
