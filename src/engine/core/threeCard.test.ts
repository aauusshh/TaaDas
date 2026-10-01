import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from './cards';
import { compareHands, evaluate, evaluateWild, strengthPercentile } from './threeCard';

let id = 0;
const c = (suit: Suit, rank: Rank): Card => ({ id: id++, suit, rank, copy: 0 });
const hand = (...xs: [Suit, Rank][]) => xs.map(([s, r]) => c(s, r));
const ev = (cards: Card[], o?: Parameters<typeof evaluate>[1]) => evaluate(cards, o);

describe('category order', () => {
  it('trail > pure sequence > sequence > color > pair > high card', () => {
    const trail = ev(hand(['S', 2], ['H', 2], ['D', 2]));
    const pure = ev(hand(['S', 5], ['S', 6], ['S', 7]));
    const seq = ev(hand(['S', 5], ['H', 6], ['D', 7]));
    const color = ev(hand(['S', 2], ['S', 9], ['S', 13]));
    const pair = ev(hand(['S', 1], ['H', 1], ['D', 9]));
    const high = ev(hand(['S', 1], ['H', 13], ['D', 9]));
    const order = [trail, pure, seq, color, pair, high];
    for (let i = 0; i < order.length - 1; i++)
      expect(order[i].score).toBeGreaterThan(order[i + 1].score);
    expect(trail.category).toBe('trail');
    expect(pure.category).toBe('pure');
    expect(color.category).toBe('color');
  });
  it('AAA beats 222; a lower trail loses to a higher one', () => {
    expect(ev(hand(['S', 1], ['H', 1], ['D', 1])).score).toBeGreaterThan(
      ev(hand(['S', 13], ['H', 13], ['D', 13])).score,
    );
    expect(ev(hand(['S', 3], ['H', 3], ['D', 3])).score).toBeGreaterThan(
      ev(hand(['S', 2], ['H', 2], ['D', 2])).score,
    );
  });
});

describe('sequences', () => {
  const akq = hand(['S', 1], ['H', 13], ['D', 12]);
  const a23 = hand(['S', 1], ['H', 2], ['D', 3]);
  const kqj = hand(['S', 13], ['H', 12], ['D', 11]);
  const s234 = hand(['S', 2], ['H', 3], ['D', 4]);
  it('A-K-Q highest, A-2-3 second, then K-Q-J (default)', () => {
    expect(ev(akq).score).toBeGreaterThan(ev(a23).score);
    expect(ev(a23).score).toBeGreaterThan(ev(kqj).score);
    expect(ev(kqj).score).toBeGreaterThan(ev(s234).score);
  });
  it('A-2-3 can be the lowest instead', () => {
    expect(ev(a23, { a23: 'lowest' }).score).toBeLessThan(ev(s234, { a23: 'lowest' }).score);
    expect(ev(a23, { a23: 'lowest' }).category).toBe('sequence');
  });
  it('K-A-2 is not a sequence', () => {
    expect(ev(hand(['S', 13], ['H', 1], ['D', 2])).category).toBe('high');
  });
});

describe('tie breaks', () => {
  it('pair rank first, then the kicker; suits never matter', () => {
    const a = ev(hand(['S', 9], ['H', 9], ['D', 4]));
    const b = ev(hand(['C', 9], ['D', 9], ['S', 5]));
    const lowPair = ev(hand(['S', 8], ['H', 8], ['D', 13]));
    expect(b.score).toBeGreaterThan(a.score);
    expect(a.score).toBeGreaterThan(lowPair.score);
    expect(ev(hand(['S', 9], ['H', 9], ['D', 4])).score).toBe(
      ev(hand(['C', 9], ['D', 9], ['H', 4])).score,
    );
  });
  it('high cards compare from the top down', () => {
    const a = ev(hand(['S', 1], ['H', 9], ['D', 4]));
    const b = ev(hand(['S', 1], ['H', 9], ['D', 3]));
    expect(a.score).toBeGreaterThan(b.score);
  });
  it('muflis flips the comparison', () => {
    const strong = ev(hand(['S', 1], ['H', 1], ['D', 1]));
    const weak = ev(hand(['S', 2], ['H', 5], ['D', 9]));
    expect(compareHands(strong, weak, false)).toBeGreaterThan(0);
    expect(compareHands(strong, weak, true)).toBeLessThan(0);
  });
  it('2-3-5 of mixed suits tops everything when enabled', () => {
    const odd = hand(['S', 2], ['H', 3], ['D', 5]);
    const trailA = hand(['S', 1], ['H', 1], ['D', 1]);
    expect(ev(odd, { a23: 'second', top235: true }).score).toBeGreaterThan(ev(trailA).score);
    expect(ev(odd).category).toBe('high');
    expect(ev(hand(['S', 2], ['S', 3], ['S', 5]), { a23: 'second', top235: true }).category).toBe(
      'color',
    );
  });
});

describe('wild cards and percentiles', () => {
  it('a wild card becomes the best possible card', () => {
    const wildJ = (x: Card) => x.rank === 11;
    const h = hand(['S', 5], ['H', 5], ['D', 11]); // pair of 5s + wild -> trail
    expect(evaluateWild(h, wildJ).category).toBe('trail');
    const two = hand(['S', 1], ['S', 13], ['D', 11]); // A K + wild same suit -> pure Q-K-A
    expect(evaluateWild(two, wildJ).category).toBe('pure');
    expect(evaluateWild(hand(['S', 4], ['H', 9], ['D', 11]), wildJ).category).toBe('pair');
    // muflis: wilds make the hand as weak as possible
    expect(evaluateWild(hand(['S', 4], ['H', 9], ['D', 11]), wildJ, undefined, true).category).toBe(
      'high',
    );
  });
  it('percentile is 0 for the worst hand and near 1 for the best', () => {
    const worst = ev(hand(['S', 2], ['H', 3], ['D', 5]));
    const best = ev(hand(['S', 1], ['H', 1], ['D', 1]));
    expect(strengthPercentile(worst.score)).toBeLessThan(0.01);
    expect(strengthPercentile(best.score)).toBeGreaterThan(0.99);
    const pairPct = strengthPercentile(ev(hand(['S', 9], ['H', 9], ['D', 4])).score);
    expect(pairPct).toBeGreaterThan(0.7);
    expect(pairPct).toBeLessThan(0.95);
  });
});
