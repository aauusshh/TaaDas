import type { Card, Rank, Suit } from './cards';

// Three-card hand evaluation shared by Teen Patti and Kitti.
// Categories, high to low: Trail, Pure sequence, Sequence, Color, Pair, High card.

export type Category = 'trail' | 'pure' | 'sequence' | 'color' | 'pair' | 'high';
export const CATEGORY_ORDER: Category[] = ['high', 'pair', 'color', 'sequence', 'pure', 'trail'];

export interface ThreeCardOptions {
  /** A-2-3 ranks second highest (default) or lowest of all sequences */
  a23: 'second' | 'lowest';
  /** Kitti: 2-3-5 of mixed suits beats everything */
  top235?: boolean;
}

export const defaultThreeCard: ThreeCardOptions = { a23: 'second' };

export interface Evaluated {
  category: Category;
  /** higher is better; comparable across all hands */
  score: number;
}

const hi = (r: number) => (r === 1 ? 14 : r);
const CAT_SCALE = 1_000_000;

/** Evaluate exactly three real cards. */
export function evaluate(
  cards: readonly Card[],
  opts: ThreeCardOptions = defaultThreeCard,
): Evaluated {
  if (cards.length !== 3) throw new Error('three cards needed');
  const ranks = cards.map((c) => hi(c.rank)).sort((a, b) => b - a);
  const raw = cards.map((c) => c.rank).sort((a, b) => a - b);
  const sameSuit = cards[0].suit === cards[1].suit && cards[1].suit === cards[2].suit;

  if (opts.top235 && raw[0] === 2 && raw[1] === 3 && raw[2] === 5 && !sameSuit) {
    return { category: 'trail', score: 7 * CAT_SCALE };
  }

  const trail = ranks[0] === ranks[1] && ranks[1] === ranks[2];
  if (trail) return { category: 'trail', score: 6 * CAT_SCALE + ranks[0] };

  // sequences: three consecutive ranks with Ace high (Q-K-A) or low (A-2-3); K-A-2 is not a sequence
  let seqKey = -1;
  if (new Set(raw).size === 3) {
    if (raw[0] === 1 && raw[1] === 2 && raw[2] === 3) seqKey = opts.a23 === 'second' ? 27 : 0;
    else if (raw[0] === 1 && raw[1] === 12 && raw[2] === 13)
      seqKey = 28; // Q-K-A, the highest
    else if (raw[2] - raw[0] === 2) seqKey = raw[2] * 2; // 2-3-4 up to J-Q-K
  }
  if (seqKey >= 0) {
    return sameSuit
      ? { category: 'pure', score: 5 * CAT_SCALE + seqKey }
      : { category: 'sequence', score: 4 * CAT_SCALE + seqKey };
  }
  const tie = (a: number[]) => a[0] * 225 + a[1] * 15 + a[2];
  if (sameSuit) return { category: 'color', score: 3 * CAT_SCALE + tie(ranks) };
  if (ranks[0] === ranks[1] || ranks[1] === ranks[2]) {
    const pair = ranks[0] === ranks[1] ? ranks[0] : ranks[1];
    const kicker = ranks[0] === ranks[1] ? ranks[2] : ranks[0];
    return { category: 'pair', score: 2 * CAT_SCALE + pair * 15 + kicker };
  }
  return { category: 'high', score: CAT_SCALE + tie(ranks) };
}

const SUITS: Exclude<Suit, 'J'>[] = ['S', 'H', 'D', 'C'];

/**
 * Best (or worst, for Muflis) hand when some cards are wild. A wild card becomes any card;
 * the hand is the best it can be. Brute force over substitutions, which is fine for 1-3 wilds.
 */
export function evaluateWild(
  cards: readonly Card[],
  isWild: (c: Card) => boolean,
  opts: ThreeCardOptions = defaultThreeCard,
  lowest = false,
): Evaluated {
  const fixed = cards.filter((c) => !isWild(c));
  const wilds = cards.length - fixed.length;
  if (wilds === 0) return evaluate(cards, opts);
  // shortcuts for the highest hand: two or three wilds always make a trail
  if (!lowest && wilds >= 2) {
    const r = wilds === 3 ? 1 : fixed[0].rank;
    return evaluate(
      [0, 1, 2].map((i) => ({ id: -10 - i, suit: SUITS[i], rank: r, copy: 0 })),
      opts,
    );
  }
  if (lowest && wilds === 3) {
    cachedWorst ??= bruteForce([], 3, opts, true);
    return cachedWorst;
  }
  return bruteForce(fixed, wilds, opts, lowest);
}

let cachedWorst: Evaluated | null = null;

function bruteForce(
  fixed: Card[],
  wilds: number,
  opts: ThreeCardOptions,
  lowest: boolean,
): Evaluated {
  let best: Evaluated | null = null;
  const pick = (e: Evaluated) => {
    if (!best || (lowest ? e.score < best.score : e.score > best.score)) best = e;
  };
  const sub = (chosen: Card[], left: number) => {
    if (left === 0) return pick(evaluate([...fixed, ...chosen], opts));
    for (let r = 1; r <= 13; r++)
      for (const s of SUITS)
        sub([...chosen, { id: -1 - chosen.length, suit: s, rank: r as Rank, copy: 0 }], left - 1);
  };
  sub([], wilds);
  return best!;
}

/** All 22,100 three-card hands scored once per option set, for percentile lookups. */
const tables = new Map<string, number[]>();
function scoreTable(opts: ThreeCardOptions): number[] {
  const key = `${opts.a23}|${opts.top235 ? 1 : 0}`;
  let t = tables.get(key);
  if (!t) {
    const deck: Card[] = [];
    let id = 0;
    for (const s of SUITS)
      for (let r = 1; r <= 13; r++) deck.push({ id: id++, suit: s, rank: r as Rank, copy: 0 });
    t = [];
    for (let a = 0; a < 52; a++)
      for (let b = a + 1; b < 52; b++)
        for (let c = b + 1; c < 52; c++) t.push(evaluate([deck[a], deck[b], deck[c]], opts).score);
    t.sort((x, y) => x - y);
    tables.set(key, t);
  }
  return t;
}

export function strengthPercentile(
  score: number,
  opts: ThreeCardOptions = defaultThreeCard,
): number {
  const t = scoreTable(opts);
  return lowerBound(t, score) / t.length;
}

function lowerBound(arr: number[], v: number): number {
  let lo = 0;
  let hi2 = arr.length;
  while (lo < hi2) {
    const mid = (lo + hi2) >> 1;
    if (arr[mid] < v) lo = mid + 1;
    else hi2 = mid;
  }
  return lo;
}

/** compare two hands: >0 when a is stronger */
export const compareHands = (a: Evaluated, b: Evaluated, lowest = false) =>
  lowest ? b.score - a.score : a.score - b.score;
