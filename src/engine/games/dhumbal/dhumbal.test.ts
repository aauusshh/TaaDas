import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../../core/cards';
import { createRng } from '../../core/rng';
import { IllegalActionError } from '../../core/types';
import { makePlayers, simulate } from '../../sim/simulate';
import { dhumbal, type DAction, type DState } from './index';
import { defaultConfig, type DhumbalConfig } from './config';
import { cardValue, classifyThrow, handTotal, pickableFrom } from './rules';

let id = 0;
const c = (suit: Suit, rank: Rank): Card => ({ id: id++, suit, rank, copy: 0 });
const joker = (): Card => ({ id: id++, suit: 'J', rank: 0, copy: 0 });
const rng = createRng(9);
const cfgOf = (o: Partial<DhumbalConfig> = {}) => ({ ...defaultConfig, ...o }) as DhumbalConfig;

function S(over: Partial<DState> & { hands: Card[][]; cfg?: Partial<DhumbalConfig> }): DState {
  const n = over.hands.length;
  const { hands, cfg, ...rest } = over;
  return {
    n,
    config: cfgOf(cfg),
    humans: Array(n).fill(true),
    levels: Array(n).fill('medium'),
    hands,
    stock: Array.from({ length: 10 }, () => c('C', 9)),
    discardPile: [],
    pickable: { cards: [c('D', 6)], kind: 'single', thrower: -1 },
    thrown: null,
    bonusId: null,
    turn: 0,
    dealer: 0,
    round: 0,
    phase: 'turn',
    turnsPlayed: 99,
    scores: Array(n).fill(0),
    eliminated: Array(n).fill(false),
    roundScores: [],
    known: Array.from({ length: n }, () => []),
    reveal: null,
    ...rest,
  };
}
const step = (s: DState, seat: number, a: DAction) => dhumbal.apply(s, seat, a, rng).state;
const ids = (cs: Card[]) => cs.map((x) => x.id);

describe('card values', () => {
  it('A=1, 2-10 face, J/Q/K 11/12/13 or all 10, joker 0', () => {
    const hand = [c('S', 1), c('S', 10), c('S', 11), c('S', 12), c('S', 13), joker()];
    expect(handTotal(hand, { jqk10: false })).toBe(1 + 10 + 11 + 12 + 13);
    expect(handTotal(hand, { jqk10: true })).toBe(1 + 10 + 10 + 10 + 10);
    expect(cardValue(joker(), { jqk10: false })).toBe(0);
  });
});

describe('throws', () => {
  const noWild = { jokersWild: false };
  it('single, sets of 2-4, runs of 3+ in one suit', () => {
    expect(classifyThrow([c('S', 5)], noWild)?.kind).toBe('single');
    expect(classifyThrow([c('S', 5), c('H', 5)], noWild)?.kind).toBe('set');
    expect(classifyThrow([c('S', 5), c('H', 5), c('D', 5), c('C', 5)], noWild)?.kind).toBe('set');
    expect(classifyThrow([c('S', 5), c('S', 6), c('S', 7)], noWild)?.kind).toBe('run');
    expect(
      classifyThrow([c('S', 7), c('S', 5), c('S', 6)], noWild)?.ordered.map((x) => x.rank),
    ).toEqual([5, 6, 7]);
  });
  it('rejects mixed suits, gaps, short runs, Ace high and mixed ranks', () => {
    expect(classifyThrow([c('S', 5), c('H', 6), c('S', 7)], noWild)).toBeNull();
    expect(classifyThrow([c('S', 5), c('S', 6), c('S', 8)], noWild)).toBeNull();
    expect(classifyThrow([c('S', 5), c('S', 6)], noWild)).toBeNull();
    expect(classifyThrow([c('S', 12), c('S', 13), c('S', 1)], noWild)).toBeNull(); // Ace is low only
    expect(classifyThrow([c('S', 1), c('S', 2), c('S', 3)], noWild)?.kind).toBe('run');
    expect(classifyThrow([c('S', 5), c('H', 6)], noWild)).toBeNull();
  });
  it('jokers fill a set or run only when wild', () => {
    const wild = { jokersWild: true };
    expect(classifyThrow([c('S', 5), joker()], noWild)).toBeNull();
    expect(classifyThrow([c('S', 5), joker()], wild)?.kind).toBe('set');
    const run = classifyThrow([c('S', 5), joker(), c('S', 7)], wild);
    expect(run?.kind).toBe('run');
    expect(run?.ordered[1].suit).toBe('J');
    expect(classifyThrow([c('S', 5), c('S', 6), joker()], wild)?.kind).toBe('run');
  });
  it('the engine rejects an illegal throw and a throw out of turn', () => {
    const a = c('S', 5);
    const b = c('H', 8);
    const s = S({ hands: [[a, b, c('C', 2)], [c('D', 1)]] });
    expect(() => step(s, 0, { type: 'throw', cardIds: [a.id, b.id] })).toThrow(IllegalActionError);
    expect(() => step(s, 1, { type: 'throw', cardIds: [s.hands[1][0].id] })).toThrow(
      IllegalActionError,
    );
  });
});

describe('picking', () => {
  it('after a throw you pick the stock or a card of the previous throw; a run offers only its ends', () => {
    const prev = [c('S', 4), c('S', 5), c('S', 6)];
    const a = c('H', 9);
    let s = S({
      hands: [[a, c('C', 2)], [c('D', 1)]],
      pickable: { cards: prev, kind: 'run', thrower: 1 },
    });
    s = step(s, 0, { type: 'throw', cardIds: [a.id] });
    const picks = dhumbal.legalActions(s, 0);
    expect(picks.filter((x) => x.type === 'pick' && x.from === 'discard')).toHaveLength(2);
    expect(picks.some((x) => x.type === 'pick' && x.from === 'stock')).toBe(true);
    expect(() => step(s, 0, { type: 'pick', from: 'discard', cardId: prev[1].id })).toThrow(
      IllegalActionError,
    );
    const n = step(s, 0, { type: 'pick', from: 'discard', cardId: prev[2].id });
    expect(n.hands[0].some((x) => x.id === prev[2].id)).toBe(true);
    expect(n.pickable!.cards.map((x) => x.id)).toEqual([a.id]);
    expect(n.turn).toBe(1);
    expect(n.known[0]).toContain(prev[2].id);
    // the config opens up the middle card
    expect(pickableFrom(prev, 'run', { pickAnyFromRun: true })).toHaveLength(3);
    expect(pickableFrom(prev, 'set', { pickAnyFromRun: false })).toHaveLength(3);
  });
  it('throw-after-match: a stock card of the rank just thrown may go out at once', () => {
    const a = c('H', 9);
    const same = c('S', 9);
    let s = S({
      hands: [[a, c('C', 2)], [c('D', 1)]],
      stock: [same],
      cfg: { throwAfterMatch: true },
    });
    s = step(s, 0, { type: 'throw', cardIds: [a.id] });
    s = step(s, 0, { type: 'pick', from: 'stock' });
    expect(s.phase).toBe('bonus');
    s = step(s, 0, { type: 'bonus', throw: true });
    expect(s.hands[0]).toHaveLength(1);
    expect(s.pickable!.cards.map((x) => x.id)).toEqual([a.id, same.id]);
    expect(s.turn).toBe(1);
  });
  it('an empty stock reshuffles the older throws', () => {
    const a = c('H', 9);
    let s = S({
      hands: [[a, c('C', 2)], [c('D', 1)]],
      stock: [],
      discardPile: [c('S', 3), c('S', 4), c('S', 5)],
    });
    s = step(s, 0, { type: 'throw', cardIds: [a.id] });
    s = step(s, 0, { type: 'pick', from: 'stock' });
    expect(s.hands[0]).toHaveLength(2);
    expect(s.stock.length + s.discardPile.length).toBeGreaterThan(0);
    const total = (x: DState) =>
      x.hands.flat().length +
      x.stock.length +
      x.discardPile.length +
      (x.pickable?.cards.length ?? 0);
    expect(total(s)).toBe(7); // 3 in hands, 1 thrown, 4 in stock and older throws, minus nothing lost
  });
});

describe('Jhyap', () => {
  it('needs a total within the limit, and is blocked in the first round of turns', () => {
    const low = [c('S', 2), c('H', 3)];
    const high = [c('S', 13), c('H', 12)];
    expect(dhumbal.legalActions(S({ hands: [high, low] }), 0).some((x) => x.type === 'jhyap')).toBe(
      false,
    );
    expect(dhumbal.legalActions(S({ hands: [low, high] }), 0).some((x) => x.type === 'jhyap')).toBe(
      true,
    );
    const first = S({ hands: [low, high], turnsPlayed: 0 });
    expect(dhumbal.legalActions(first, 0).some((x) => x.type === 'jhyap')).toBe(false);
    expect(dhumbal.view(first, 0).jhyapBlocked).toBe('first');
    const allowed = S({ hands: [low, high], turnsPlayed: 0, cfg: { noJhyapFirstRound: false } });
    expect(dhumbal.legalActions(allowed, 0).some((x) => x.type === 'jhyap')).toBe(true);
    const limit = S({ hands: [[c('S', 6), c('H', 6)], high], cfg: { jhyapLimit: 10 } });
    expect(dhumbal.legalActions(limit, 0).some((x) => x.type === 'jhyap')).toBe(false);
    expect(
      dhumbal
        .legalActions(S({ hands: [[c('S', 6), c('H', 6)], high], cfg: { jhyapLimit: 13 } }), 0)
        .some((x) => x.type === 'jhyap'),
    ).toBe(true);
  });
  it('strictly lowest caller scores 0, everyone else adds their total', () => {
    const s = step(S({ hands: [[c('S', 2), c('H', 2)], [c('S', 9)], [c('S', 7), c('H', 7)]] }), 0, {
      type: 'jhyap',
    });
    expect(s.scores).toEqual([0, 9, 14]);
    expect(s.reveal!.counter).toBe(false);
  });
  it('counter-jhyap: equal or lower beats the caller, who adds total plus the penalty', () => {
    const tie = step(
      S({ hands: [[c('S', 3), c('H', 2)], [c('S', 5)], [c('S', 9), c('H', 9)]] }),
      0,
      { type: 'jhyap' },
    );
    expect(tie.reveal!.counter).toBe(true); // 5 == 5
    expect(tie.scores).toEqual([5 + 25, 0, 18]);
    const lower = step(S({ hands: [[c('S', 3), c('H', 2)], [c('S', 1)], [c('S', 2)]] }), 0, {
      type: 'jhyap',
    });
    expect(lower.scores).toEqual([5 + 25, 0, 2]);
    const twoLowest = step(S({ hands: [[c('S', 6)], [c('S', 2)], [c('S', 2)], [c('S', 8)]] }), 0, {
      type: 'jhyap',
    });
    expect(twoLowest.scores).toEqual([6 + 25, 0, 0, 8]);
  });
});

describe('rounds and elimination', () => {
  const callerWins = (scores: number[], cfg: Partial<DhumbalConfig> = {}) =>
    step(S({ hands: [[c('S', 1)], [c('S', 9)], [c('S', 8)]], scores, cfg }), 0, { type: 'jhyap' });
  it('over the limit is out; exactly on the limit stays', () => {
    const out = callerWins([0, 95, 50]); // seat 1 adds 9 -> 104
    expect(out.eliminated).toEqual([false, true, false]);
    const edge = callerWins([0, 91, 50]); // 100 exactly
    expect(edge.eliminated).toEqual([false, false, false]);
    expect(edge.phase).toBe('roundEnd');
  });
  it('the last player standing wins; fixed rounds go to the lowest total', () => {
    const over = callerWins([0, 95, 95]);
    expect(over.phase).toBe('over');
    expect(dhumbal.result(over)!.winners).toEqual([0]);
    const fixed = callerWins([40, 10, 20], { fixedRounds: 1 });
    expect(fixed.phase).toBe('over');
    expect(dhumbal.result(fixed)!.winners).toEqual([1]);
    const next = callerWins([0, 10, 20]);
    const again = step(next, 0, { type: 'next' });
    expect(again.round).toBe(1);
    expect(again.hands.every((h) => h.length === 5)).toBe(true);
  });
  it('eliminated players are skipped', () => {
    const hands = [[c('S', 1), c('S', 2)], [c('S', 9)], [c('S', 8), c('H', 8)]];
    const s = S({ hands, eliminated: [false, true, false] });
    const t = step(s, 0, { type: 'throw', cardIds: [hands[0][0].id] });
    const u = step(t, 0, { type: 'pick', from: 'stock' });
    expect(u.turn).toBe(2);
  });
});

describe('sim', () => {
  it('250 random games finish with the whole deck accounted for', () => {
    const r = simulate(dhumbal, { n: 250 });
    expect(r.failures).toEqual([]);
    void ids;
    void makePlayers;
  }, 60000);
});
