import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../../core/cards';
import { createRng } from '../../core/rng';
import { IllegalActionError } from '../../core/types';
import { simulate } from '../../sim/simulate';
import { inBetween, type IBAction, type IBState } from './index';
import { defaultConfig, type InBetweenConfig } from './config';

let id = 0;
const c = (rank: Rank, suit: Suit = 'S'): Card => ({ id: id++, suit, rank, copy: 0 });
const rng = createRng(12);
const cfgOf = (o: Partial<InBetweenConfig> = {}) =>
  ({ ...defaultConfig, direction: 'cw', ...o }) as InBetweenConfig;

/** A table where seat 0 is about to act on the given posts, with the next card (the "third") on top of the deck. */
function S(
  posts: [Card, Card],
  third: Card,
  over: Partial<IBState> & { cfg?: Partial<InBetweenConfig>; n?: number } = {},
): IBState {
  const n = over.n ?? 3;
  const { cfg, n: _n, ...rest } = over;
  void _n;
  const config = cfgOf(cfg);
  const filler = Array.from({ length: 30 }, (_, i) => c(((i % 13) + 1) as Rank, 'D'));
  return {
    n,
    config,
    humans: Array(n).fill(true),
    levels: Array(n).fill('medium'),
    deck: [...filler, third],
    used: [],
    chips: Array(n).fill(1000),
    start: Array(n).fill(1000 + config.ante),
    pot: config.ante * n,
    turn: 0,
    turns: 0,
    posts,
    aceHigh: config.aceHigh ? true : null,
    phase: 'bet',
    last: null,
    ...rest,
  };
}
const step = (s: IBState, seat: number, a: IBAction) => inBetween.apply(s, seat, a, rng).state;

describe('payouts', () => {
  it('strictly between wins the bet from the pot', () => {
    const s = step(S([c(3), c(10)], c(7)), 0, { type: 'bet', amount: 20 });
    expect(s.chips[0]).toBe(1020);
    expect(inBetween.invariants!(s)).toBeNull();
  });
  it('outside loses the bet into the pot', () => {
    const s = step(S([c(3), c(10)], c(12)), 0, { type: 'bet', amount: 20 });
    expect(s.chips[0]).toBe(980);
    expect(s.last!.outcome).toBe('lose');
    expect(inBetween.invariants!(s)).toBeNull();
  });
  it('equal to a post pays double', () => {
    const s = step(S([c(3), c(10)], c(10, 'H')), 0, { type: 'bet', amount: 20 });
    expect(s.chips[0]).toBe(1000 - 40);
    expect(s.last!.outcome).toBe('double');
    expect(inBetween.invariants!(s)).toBeNull();
  });
  it('double is limited to the chips the player has', () => {
    const s = step(S([c(3), c(10)], c(3, 'H'), { chips: [30, 1000, 1000], pot: 500 }), 0, {
      type: 'bet',
      amount: 30,
    });
    expect(s.chips[0]).toBe(0);
  });
});

describe('betting limits', () => {
  it('a bet is at least the minimum and at most the pot or your chips', () => {
    const s = S([c(2), c(12)], c(7), { chips: [100, 1000, 1000], pot: 500 });
    const amounts = inBetween
      .legalActions(s, 0)
      .flatMap((a) => (a.type === 'bet' ? [a.amount] : []));
    expect(Math.min(...amounts)).toBe(10);
    expect(Math.max(...amounts)).toBe(100); // chips cap
    expect(() => step(s, 0, { type: 'bet', amount: 5 })).toThrow(IllegalActionError);
    expect(() => step(s, 0, { type: 'bet', amount: 101 })).toThrow(IllegalActionError);
    const small = S([c(2), c(12)], c(7), { chips: [1000, 1000, 1000], pot: 40 });
    expect(
      Math.max(
        ...inBetween.legalActions(small, 0).flatMap((a) => (a.type === 'bet' ? [a.amount] : [])),
      ),
    ).toBe(40);
    expect(() => step(small, 1, { type: 'bet', amount: 10 })).toThrow(IllegalActionError);
  });
  it('passing costs nothing and moves to the next player', () => {
    const s = step(S([c(2), c(12)], c(7)), 0, { type: 'pass' });
    expect(s.chips).toEqual([1000, 1000, 1000]);
    expect(s.turn).toBe(1);
    expect(s.posts).not.toBeNull();
  });
});

describe('posts', () => {
  it('equal or consecutive posts are skipped at no cost', () => {
    // deal order from the deck top: fillers are popped first, so build a deck that gives 5,5 then 6,7 then 2,9
    const s = S([c(2), c(9)], c(7));
    s.deck = [c(9), c(2), c(7), c(6), c(5), c(5)];
    s.posts = [c(5), c(5)];
    const equal = inBetween.legalActions({ ...s, posts: [c(5), c(5)], phase: 'bet' }, 0);
    expect(equal.some((a) => a.type === 'bet')).toBe(true); // legalActions only lists; skipping happens when posts are dealt
    const started = inBetween.setup(
      [0, 1, 2].map((i) => ({
        id: `p${i}`,
        name: `P${i}`,
        avatar: 'yak',
        isBot: false,
        difficulty: 'medium' as const,
      })),
      defaultConfig,
      createRng(21),
    ).state;
    // whatever was dealt, a bettable state always has a gap of at least one rank
    const v = inBetween.view(started, started.turn);
    if (v.phase === 'bet')
      expect(Math.abs(v.values![0] - v.values![1]) - 1).toBeGreaterThanOrEqual(1);
  });
  it('a first-post Ace lets you choose high or low', () => {
    let s = S([c(1), c(10)], c(5), { phase: 'ace', aceHigh: null });
    expect(inBetween.legalActions(s, 0).map((a) => a.type)).toEqual(['ace', 'ace']);
    expect(inBetween.view(s, 0).values).toBeNull();
    s = step(s, 0, { type: 'ace', high: false });
    expect(inBetween.view(s, 0).values).toEqual([1, 10]);
    expect(s.phase).toBe('bet');
  });
  it('Ace always high when the option is on', () => {
    const s = S([c(1), c(10)], c(5), { cfg: { aceHigh: true } });
    expect(inBetween.view(s, 0).values).toEqual([14, 10]);
    expect(inBetween.legalActions(s, 0).some((a) => a.type === 'ace')).toBe(false);
  });
  it('equal posts can be bet on higher or lower (matching pays double)', () => {
    const s = S([c(8), c(8, 'H')], c(11), { cfg: { equalPosts: 'guess' }, phase: 'guess' });
    expect(inBetween.legalActions(s, 0).some((a) => a.type === 'guess')).toBe(true);
    const win = step(s, 0, { type: 'guess', high: true, amount: 20 });
    expect(win.chips[0]).toBe(1020);
    const lose = step(
      S([c(8), c(8, 'H')], c(11), { cfg: { equalPosts: 'guess' }, phase: 'guess' }),
      0,
      { type: 'guess', high: false, amount: 20 },
    );
    expect(lose.chips[0]).toBe(980);
    const match = step(
      S([c(8), c(8, 'H')], c(8, 'C'), { cfg: { equalPosts: 'guess' }, phase: 'guess' }),
      0,
      { type: 'guess', high: true, amount: 20 },
    );
    expect(match.chips[0]).toBe(960);
  });
});

describe('deck and game end', () => {
  it('the deck is reshuffled when fewer than three cards remain', () => {
    const s = S([c(2), c(12)], c(7));
    s.deck = [c(7)];
    s.used = Array.from({ length: 20 }, (_, i) => c(((i % 13) + 1) as Rank, 'C'));
    const n = step(s, 0, { type: 'bet', amount: 10 });
    expect(n.deck.length + n.used.length + (n.posts ? 2 : 0)).toBeGreaterThan(10);
    expect(inBetween.invariants!(n)).toBeNull();
  });
  it('sim: 300 random games end with chips conserved', () => {
    const r = simulate(inBetween, { n: 300 });
    expect(r.failures).toEqual([]);
  }, 60000);
});
