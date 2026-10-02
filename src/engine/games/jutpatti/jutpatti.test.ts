import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../../core/cards';
import { createRng } from '../../core/rng';
import { IllegalActionError } from '../../core/types';
import { makePlayers, simulate } from '../../sim/simulate';
import { jutPatti, type JPState } from './index';
import { defaultConfig, type JutPattiConfig } from './config';
import { allPairs, dealFits, jokerRank } from './rules';

let id = 0;
const c = (suit: Suit, rank: Rank): Card => ({ id: id++, suit, rank, copy: 0 });
const rng = createRng(2);

function S(over: Partial<JPState> & { hands: Card[][]; cfg?: Partial<JutPattiConfig> }): JPState {
  const n = over.hands.length;
  const { hands, cfg, ...rest } = over;
  return {
    n,
    config: { ...defaultConfig, ...(cfg ?? {}) } as JutPattiConfig,
    humans: Array(n).fill(true),
    levels: Array(n).fill('medium'),
    hands,
    stock: Array.from({ length: 12 }, () => c('C', 2)),
    discard: [],
    indicator: c('S', 5),
    jokerRank: 6,
    turn: 0,
    dealer: 0,
    phase: 'draw',
    drawnId: null,
    wins: Array(n).fill(0),
    chips: Array(n).fill(0),
    round: 0,
    lastWinner: null,
    ...rest,
  };
}

describe('jokers', () => {
  it('one rank above the indicator, wrapping K to A; or the same rank', () => {
    expect(jokerRank(c('S', 5), 'above')).toBe(6);
    expect(jokerRank(c('S', 13), 'above')).toBe(1);
    expect(jokerRank(c('S', 1), 'above')).toBe(2);
    expect(jokerRank(c('S', 9), 'same')).toBe(9);
  });
});

describe('pairs and winning', () => {
  it('pairs of the same rank, any suit', () => {
    const hand = [c('S', 3), c('H', 3), c('C', 9), c('D', 9)];
    expect(allPairs(hand, 6, false)).toBe(true);
    expect(allPairs([c('S', 3), c('H', 3), c('C', 9), c('D', 10)], 6, false)).toBe(false);
  });
  it('colors must match when the option is on', () => {
    const hand = [c('S', 3), c('H', 3), c('C', 9), c('D', 9)];
    expect(allPairs(hand, 6, true)).toBe(false);
    expect(allPairs([c('S', 3), c('C', 3), c('H', 9), c('D', 9)], 6, true)).toBe(true);
  });
  it('a joker pairs with anything and two jokers pair together', () => {
    expect(allPairs([c('S', 3), c('H', 6), c('C', 9), c('D', 9)], 6, false)).toBe(true);
    expect(allPairs([c('S', 6), c('H', 6), c('C', 9), c('D', 9)], 6, false)).toBe(true);
    expect(allPairs([c('S', 3), c('H', 4), c('C', 6), c('D', 9)], 6, false)).toBe(false);
  });
  it('an odd hand never wins; an even hand after drawing does (8 cards from a 7-card deal)', () => {
    expect(allPairs([c('S', 3), c('H', 3), c('C', 9)], 6, false)).toBe(false);
    const hand = [c('S', 2), c('H', 2), c('S', 3), c('H', 3), c('S', 4), c('H', 4), c('S', 7)];
    let s = S({ hands: [hand, [c('D', 1)]], discard: [c('C', 7)], stock: [c('D', 12)] });
    expect(rng).toBeTruthy();
    s = jutPatti.apply(s, 0, { type: 'draw', from: 'discard' }, rng).state;
    expect(s.hands[0]).toHaveLength(8);
    expect(jutPatti.legalActions(s, 0)[0]).toEqual({ type: 'declare' });
    const done = jutPatti.apply(s, 0, { type: 'declare' }, rng).state;
    expect(done.wins[0]).toBe(1);
  });
});

describe('turn flow', () => {
  it('first player must draw from the stock; taking the discard then discarding passes the turn', () => {
    const s = S({ hands: [[c('S', 2), c('H', 3), c('C', 4)], [c('D', 1)]] });
    expect(jutPatti.legalActions(s, 0)).toEqual([{ type: 'draw', from: 'stock' }]);
    const a = jutPatti.apply(s, 0, { type: 'draw', from: 'stock' }, rng).state;
    expect(a.phase).toBe('discard');
    expect(() => jutPatti.apply(a, 1, { type: 'draw', from: 'stock' }, rng)).toThrow(
      IllegalActionError,
    );
    const dropped = a.hands[0][0];
    const b = jutPatti.apply(a, 0, { type: 'discard', cardId: dropped.id }, rng).state;
    expect(b.turn).toBe(1);
    expect(b.discard[b.discard.length - 1].id).toBe(dropped.id);
    expect(jutPatti.legalActions(b, 1).map((x) => JSON.stringify(x))).toContain(
      '{"type":"draw","from":"discard"}',
    );
    const t = jutPatti.apply(b, 1, { type: 'draw', from: 'discard' }, rng).state;
    expect(t.hands[1].some((x) => x.id === dropped.id)).toBe(true);
  });
  it('empty stock reshuffles the discards except the top card', () => {
    let s = S({
      hands: [[c('S', 2), c('H', 3), c('C', 4)], [c('D', 1)]],
      stock: [],
      discard: [c('H', 8), c('H', 9), c('H', 10), c('H', 11)],
    });
    const topId = s.discard[3].id;
    s = jutPatti.apply(s, 0, { type: 'draw', from: 'stock' }, rng).state;
    expect(s.discard.map((x) => x.id)).toEqual([topId]);
    expect(s.stock).toHaveLength(2); // 3 reshuffled minus the one drawn
    expect(s.hands[0]).toHaveLength(4);
  });
  it('the deal is cut down when the stock would be too small', () => {
    expect(dealFits(6, 5)).toBe(true);
    expect(dealFits(6, 7)).toBe(false);
    const { state } = jutPatti.setup(
      makePlayers(6, createRng(1)),
      { ...defaultConfig, dealCount: 11 },
      createRng(4),
    );
    expect(state.hands[0]).toHaveLength(5);
    expect(state.stock.length).toBeGreaterThanOrEqual(10);
  });
});

describe('matches and sim', () => {
  it('first to the target wins the match; chips move when a stake is set', () => {
    const hands = [[c('S', 2), c('H', 2), c('S', 3), c('H', 3)], [c('D', 1)], [c('D', 5)]];
    let s = S({ hands, phase: 'discard', cfg: { target: 1, stake: 50 } });
    s = jutPatti.apply(s, 0, { type: 'declare' }, rng).state;
    expect(s.phase).toBe('over');
    const r = jutPatti.result(s)!;
    expect(r.winners).toEqual([0]);
    expect(r.chipDelta).toEqual([100, -50, -50]);
  });
  it('sim: 300 random games finish with 52 cards', () => {
    const r = simulate(jutPatti, { n: 300 });
    expect(r.failures).toEqual([]);
  }, 60000);
});
