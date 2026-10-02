import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../../core/cards';
import { createRng } from '../../core/rng';
import { IllegalActionError } from '../../core/types';
import { makePlayers, simulate } from '../../sim/simulate';
import { defaultConfig, type MarriageConfig } from './config';
import { finishingDiscards, maalLines, marriage, type MAction, type MState } from './index';
import { solve } from './rules';

let id = 5000;
const c = (suit: Suit, rank: Rank): Card => ({ id: id++, suit, rank, copy: 0 });
const run = (suit: Suit, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => c(suit, (from + i) as Rank));
const rng = createRng(2);
const cfgOf = (o: Partial<MarriageConfig> = {}) =>
  ({ ...defaultConfig, direction: 'cw', ...o }) as MarriageConfig;
const joker = c('H', 9); // tiplu 9H, poplu 10H, jhiplu 8H, alter 9D, ordinary jokers 9S and 9C

function S(over: Partial<MState> & { hands: Card[][]; cfg?: Partial<MarriageConfig> }): MState {
  const n = over.hands.length;
  const { hands, cfg, ...rest } = over;
  const config = cfgOf(cfg);
  const filler = Array.from({ length: 40 }, (_, i) =>
    c((['S', 'C'] as Suit[])[i % 2], (((i * 7) % 13) + 1) as Rank),
  );
  return {
    n,
    config,
    humans: Array(n).fill(true),
    levels: Array(n).fill('medium'),
    hands,
    shown: Array.from({ length: n }, () => []),
    route: Array(n).fill(null),
    seen: Array(n).fill(false),
    stock: filler,
    discard: [c('D', 2)],
    joker,
    supermanId: null,
    turn: 0,
    dealer: n - 1,
    round: 0,
    phase: 'draw',
    drawn: null,
    mustShow: null,
    turns: 0,
    chips: Array(n).fill(1000),
    start: Array(n).fill(1000),
    last: null,
    ...rest,
  };
}
const step = (s: MState, seat: number, a: MAction) => marriage.apply(s, seat, a, rng).state;
const ids = (cs: Card[]) => cs.map((x) => x.id);

describe('setup', () => {
  it('21 cards each, joker card set aside, 156 cards in total', () => {
    const { state } = marriage.setup(makePlayers(4, createRng(1)), defaultConfig, createRng(3));
    expect(state.hands.every((h) => h.length === 21)).toBe(true);
    expect(marriage.invariants!(state)).toBeNull();
    expect(state.joker.suit).not.toBe('J');
    const v = marriage.view(state, 0);
    expect(v.joker).toBeNull();
    expect(JSON.stringify(v)).not.toContain(`"id":${state.hands[1][0].id},`);
  });
  it('Man cards and Superman join the deck when enabled', () => {
    const { state } = marriage.setup(
      makePlayers(3, createRng(1)),
      { ...defaultConfig, men: 2, superman: true },
      createRng(4),
    );
    expect(marriage.invariants!(state)).toBeNull();
    expect(state.supermanId).not.toBeNull();
  });
});

describe('showing and the discard rule', () => {
  const pureHand = () => [
    ...run('S', 3, 5),
    ...run('D', 9, 11),
    c('C', 7),
    c('C', 7),
    c('C', 7),
    c('H', 2),
    c('H', 13),
    c('S', 12),
    c('D', 1),
    c('D', 4),
    c('C', 12),
    c('S', 1),
    c('H', 5),
    c('C', 3),
  ];
  it('showing three pure sets makes a player seen; fewer is rejected', () => {
    const hand = pureHand();
    let s = S({
      hands: [hand, pureHand()],
      phase: 'discard',
      drawn: { from: 'stock', cardId: -1 },
    });
    const sets = [hand.slice(0, 3), hand.slice(3, 6), hand.slice(6, 9)].map(ids);
    expect(() => step(s, 0, { type: 'show', sets: sets.slice(0, 2) })).toThrow(IllegalActionError);
    s = step(s, 0, { type: 'show', sets });
    expect(s.seen[0]).toBe(true);
    expect(s.route[0]).toBe('sequence');
    expect(s.hands[0]).toHaveLength(hand.length - 9);
    expect(marriage.view(s, 0).joker).not.toBeNull();
    expect(marriage.view(s, 1).joker).toBeNull();
    expect(() => step(s, 0, { type: 'show', sets })).toThrow(IllegalActionError);
  });
  it('an unseen player may take the discard only if it completes a show this turn', () => {
    const need = c('S', 6);
    const hand = [
      ...run('S', 3, 5),
      ...run('D', 9, 11),
      c('C', 7),
      c('C', 7),
      c('C', 7),
      c('H', 2),
      c('H', 13),
    ];
    let s = S({ hands: [hand, hand.slice()], discard: [need] });
    expect(marriage.legalActions(s, 0).some((a) => a.type === 'draw' && a.from === 'discard')).toBe(
      true,
    );
    s = step(s, 0, { type: 'draw', from: 'discard' });
    expect(s.mustShow).toBe(need.id);
    expect(() => step(s, 0, { type: 'discard', cardId: s.hands[0][0].id })).toThrow(
      IllegalActionError,
    );
    const useless = S({ hands: [hand, hand.slice()], discard: [c('H', 12)] });
    expect(
      marriage.legalActions(useless, 0).some((a) => a.type === 'draw' && a.from === 'discard'),
    ).toBe(false);
    expect(() => step(useless, 0, { type: 'draw', from: 'discard' })).toThrow(IllegalActionError);
  });
  it('seven identical pairs start the dublee route', () => {
    const pairs = Array.from({ length: 7 }, (_, i) => [
      c('S', (i + 1) as Rank),
      c('S', (i + 1) as Rank),
    ]);
    const hand = [
      ...pairs.flat(),
      c('H', 2),
      c('H', 5),
      c('D', 8),
      c('D', 12),
      c('C', 3),
      c('C', 9),
      c('C', 11),
    ];
    const s = step(S({ hands: [hand, hand.slice()], phase: 'discard' }), 0, {
      type: 'show',
      sets: pairs.map(ids),
    });
    expect(s.route[0]).toBe('dublee');
  });
});

describe('finishing', () => {
  it('declaring needs all cards in valid sets: shown sets plus hand', () => {
    const shown = [run('S', 3, 5), run('D', 9, 11), [c('C', 7), c('C', 7), c('C', 7)]];
    const hand = [...run('H', 2, 4), ...run('S', 10, 12), ...run('D', 1, 3), c('C', 13)];
    const s = S({
      hands: [hand, hand.slice()],
      shown: [shown, []],
      seen: [true, false],
      route: ['sequence', null],
      phase: 'discard',
    });
    const win = step(s, 0, { type: 'declare', cardId: hand[hand.length - 1].id });
    expect(win.phase).toBe('roundEnd');
    expect(win.last!.winner).toBe(0);
    expect(() => step(s, 0, { type: 'declare', cardId: hand[0].id })).toThrow(IllegalActionError);
    expect(
      finishingDiscards(hand, shown, 'sequence', { joker, supermanId: null }, cfgOf()),
    ).toEqual([hand[hand.length - 1].id]);
  });
  it('maal cards are wild after seeing', () => {
    const wild = c('H', 10);
    const cards = [c('S', 2), wild, c('S', 4), ...run('H', 2, 4)];
    const melds = solve(cards, { joker, supermanId: null }, { allowWild: true, pureOnly: false });
    expect(melds).not.toBeNull();
  });
  it('declaring before showing is rejected', () => {
    const hand = Array.from({ length: 22 }, (_, i) => c('S', ((i % 13) + 1) as Rank));
    expect(() =>
      step(S({ hands: [hand, hand.slice()], phase: 'discard' }), 0, {
        type: 'declare',
        cardId: hand[0].id,
      }),
    ).toThrow(IllegalActionError);
  });
});

describe('scoring', () => {
  it('copies of each maal card, and a marriage replaces the three cards', () => {
    const cfg = cfgOf();
    const lines = (cards: Card[]) => maalLines(cards, joker, cfg, 0).reduce((t, l) => t + l.pts, 0);
    expect(lines([c('H', 9)])).toBe(3);
    expect(lines([c('H', 9), c('H', 9)])).toBe(6);
    expect(lines([c('H', 10), c('H', 10)])).toBe(5);
    expect(lines([c('H', 8)])).toBe(2);
    expect(lines([c('D', 9), c('D', 9), c('D', 9)])).toBe(25);
    expect(lines([c('S', 9)])).toBe(0);
    expect(lines([c('H', 8), c('H', 9), c('H', 10)])).toBe(10);
    expect(
      maalLines([c('S', 7), c('S', 7), c('S', 7)], joker, cfg, 1).reduce((t, l) => t + l.pts, 0),
    ).toBe(5);
  });
  it('a king tiplu wraps: the poplu is the ace', () => {
    const k = c('H', 13);
    expect(maalLines([c('H', 1)], k, cfgOf(), 0)[0].pts).toBe(2);
    expect(maalLines([c('H', 12)], k, cfgOf(), 0)[0].pts).toBe(2);
  });

  const finish = (cfg: Partial<MarriageConfig>, seenOther: boolean) => {
    const shown = [run('S', 3, 5), run('D', 3, 5), [c('C', 7), c('C', 7), c('C', 7)]];
    const winnerHand = [
      ...run('H', 2, 4),
      ...run('S', 10, 12),
      ...run('C', 1, 3),
      c('D', 7),
      c('D', 7),
      c('D', 7),
      c('D', 13),
    ];
    const other = [c('D', 9), c('H', 8), c('S', 2)];
    return step(
      S({
        hands: [winnerHand, other, other.slice()],
        shown: [shown, [], []],
        seen: [true, seenOther, false],
        route: ['sequence', seenOther ? 'sequence' : null, null],
        phase: 'discard',
        cfg,
      }),
      0,
      { type: 'declare', cardId: winnerHand[winnerHand.length - 1].id },
    );
  };
  it('settlement is zero-sum with the 3 / 10 winner bonus', () => {
    const r = finish({}, true).last!;
    expect(r.points.reduce((a, b) => a + b, 0)).toBe(0);
    expect(r.chips.reduce((a, b) => a + b, 0)).toBe(0);
    expect(r.winner).toBe(0);
    const M = r.maal.reduce((a, b) => a + b, 0);
    expect(r.points[1]).toBe(r.maal[1] * 3 - M - 3);
    expect(r.points[2]).toBe(r.maal[2] * 3 - M - 10);
  });
  it('classic keeps unseen maal, kidnap gives it to the winner, murder voids it', () => {
    const classic = finish({ mode: 'classic' }, true).last!;
    const kidnap = finish({ mode: 'kidnap' }, true).last!;
    const murder = finish({ mode: 'murder' }, true).last!;
    for (const r of [classic, kidnap, murder]) expect(r.points.reduce((a, b) => a + b, 0)).toBe(0);
    expect(classic.maal[2]).toBeGreaterThan(0);
    expect(kidnap.points[0]).toBeGreaterThan(classic.points[0]);
    expect(kidnap.points[2]).toBeLessThan(classic.points[2]);
    expect(murder.points[0]).toBeGreaterThan(classic.points[0] - 1000);
  });
});

describe('turns and sim', () => {
  it('draw, then discard passes the turn; out-of-turn is rejected', () => {
    const mk = (suit: Suit) =>
      Array.from({ length: 21 }, (_, i) => c(suit, ((i % 13) + 1) as Rank));
    let s = S({ hands: [mk('C'), mk('S')] });
    expect(() => step(s, 1, { type: 'draw', from: 'stock' })).toThrow(IllegalActionError);
    s = step(s, 0, { type: 'draw', from: 'stock' });
    expect(s.hands[0]).toHaveLength(22);
    s = step(s, 0, { type: 'discard', cardId: s.hands[0][0].id });
    expect(s.turn).toBe(1);
    expect(s.phase).toBe('draw');
  });
  it('sim: 25 random games end with the whole deck accounted for', () => {
    const r = simulate(marriage, { n: 25 });
    expect(r.failures).toEqual([]);
  }, 120000);
});
