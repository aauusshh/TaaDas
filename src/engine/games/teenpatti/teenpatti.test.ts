import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../../core/cards';
import { createRng } from '../../core/rng';
import { IllegalActionError } from '../../core/types';
import { simulate } from '../../sim/simulate';
import { handScore, teenPatti, type TPAction, type TPState } from './index';
import { defaultConfig, type TeenPattiConfig } from './config';

let id = 0;
const c = (suit: Suit, rank: Rank): Card => ({ id: id++, suit, rank, copy: 0 });
const rng = createRng(4);
const cfgOf = (o: Partial<TeenPattiConfig> = {}) => ({ ...defaultConfig, ...o }) as TeenPattiConfig;

function S(over: Partial<TPState> & { hands: Card[][]; cfg?: Partial<TeenPattiConfig> }): TPState {
  const n = over.hands.length;
  const { hands, cfg, ...rest } = over;
  const config = cfgOf({ direction: 'cw', ...cfg });
  const chips = Array(n).fill(1000);
  const put = Array(n).fill(config.boot);
  return {
    n,
    config,
    humans: Array(n).fill(true),
    levels: Array(n).fill('medium'),
    hands,
    inRound: Array(n).fill(true),
    seen: Array(n).fill(false),
    packed: Array(n).fill(false),
    blindTurns: Array(n).fill(0),
    chips,
    start: Array(n).fill(1000 + config.boot),
    put,
    pot: config.boot * n,
    stake: config.boot,
    turn: 0,
    dealer: n - 1,
    round: 0,
    phase: 'bet',
    sideShow: null,
    wildRank: null,
    reveal: [],
    winners: [],
    lastGain: Array(n).fill(0),
    deck: [],
    ...rest,
  };
}
const step = (s: TPState, seat: number, a: TPAction) => teenPatti.apply(s, seat, a, rng).state;
const trail = () => [c('S', 9), c('H', 9), c('D', 9)];
const junk = () => [c('S', 2), c('H', 5), c('D', 9)];
const pair = () => [c('S', 6), c('H', 6), c('D', 9)];

describe('stake math', () => {
  it('blind pays S, seen pays 2S; raising doubles the stake', () => {
    let s = S({ hands: [junk(), junk(), junk()] });
    s = step(s, 0, { type: 'bet' }); // blind chaal: S = 10
    expect(s.chips[0]).toBe(990);
    expect(s.pot).toBe(40);
    s = step(s, 1, { type: 'look' });
    s = step(s, 1, { type: 'bet' }); // seen: 2S = 20
    expect(s.chips[1]).toBe(980);
    s = step(s, 2, { type: 'raise' }); // blind raise: 2S = 20, stake becomes 20
    expect(s.chips[2]).toBe(980);
    expect(s.stake).toBe(20);
    s = step(s, 0, { type: 'look' });
    s = step(s, 0, { type: 'raise' }); // seen raise: 4S = 80, stake becomes 40
    expect(s.chips[0]).toBe(990 - 80);
    expect(s.stake).toBe(40);
  });
  it('the stake cannot pass the maximum', () => {
    const s = S({ hands: [junk(), junk(), junk()], stake: 1280, cfg: { maxStakeMult: 128 } });
    expect(teenPatti.legalActions(s, 0).some((a) => a.type === 'raise')).toBe(false);
  });
  it('a blind player must look after the maximum number of blind turns', () => {
    let s = S({ hands: [junk(), junk(), junk()], cfg: { maxBlind: 1 } });
    s = step(s, 0, { type: 'bet' });
    s = step(s, 1, { type: 'bet' });
    s = step(s, 2, { type: 'bet' });
    expect(s.turn).toBe(0);
    expect(s.seen[0]).toBe(true); // forced to look
    expect(teenPatti.legalActions(s, 0).some((a) => a.type === 'look')).toBe(false);
  });
  it('out-of-turn and unaffordable actions are rejected', () => {
    const s = S({ hands: [junk(), junk(), junk()] });
    expect(() => step(s, 1, { type: 'bet' })).toThrow(IllegalActionError);
    const poor = S({ hands: [junk(), junk(), junk()], chips: [5, 1000, 1000] });
    expect(teenPatti.legalActions(poor, 0).map((a) => a.type)).toEqual(['look', 'pack']);
  });
});

describe('packing and the show', () => {
  it('everyone else packing gives the pot to the last player', () => {
    let s = S({ hands: [junk(), junk(), junk()] });
    s = step(s, 0, { type: 'pack' });
    s = step(s, 1, { type: 'pack' });
    expect(s.phase).toBe('roundEnd');
    expect(s.winners).toEqual([2]);
    expect(s.chips[2]).toBe(1000 + 30);
    expect(teenPatti.invariants!(s)).toBeNull();
  });
  it('show is only for two players; seen pays 2S, blind pays S; better hand wins the pot', () => {
    let s = S({ hands: [pair(), trail(), junk()], packed: [false, false, true] });
    expect(teenPatti.legalActions(s, 0).some((a) => a.type === 'show')).toBe(true);
    expect(teenPatti.legalActions(s, 0).some((a) => a.type === 'bet')).toBe(false);
    s = step(s, 0, { type: 'show' }); // blind: pays S = 10
    expect(s.chips[1]).toBe(1000 + 30 + 10);
    expect(s.winners).toEqual([1]);
    expect(s.chips[0]).toBe(990);
    let t = S({
      hands: [pair(), trail(), junk()],
      packed: [false, false, true],
      seen: [true, false, false],
    });
    t = step(t, 0, { type: 'show' });
    expect(t.chips[0]).toBe(1000 - 20);
    expect(teenPatti.invariants!(t)).toBeNull();
  });
  it('an exact tie: the asker loses by default, or the pot splits', () => {
    const a = [c('S', 9), c('H', 9), c('D', 4)];
    const b = [c('C', 9), c('D', 9), c('H', 4)];
    const asker = step(S({ hands: [a, b, junk()], packed: [false, false, true] }), 0, {
      type: 'show',
    });
    expect(asker.winners).toEqual([1]);
    const split = step(
      S({ hands: [a, b, junk()], packed: [false, false, true], cfg: { tieShow: 'split' } }),
      0,
      { type: 'show' },
    );
    expect(split.winners.sort()).toEqual([0, 1]);
    expect(teenPatti.invariants!(split)).toBeNull();
  });
  it('reaching the pot limit forces a show of everyone left', () => {
    const s = S({
      hands: [pair(), trail(), junk()],
      pot: 10240,
      stake: 10,
      chips: [1000, 1000, 1000],
      start: [1000 + 3400 + 10, 1000 + 3400 + 10, 1000 + 3400 + 10],
    });
    const n = step(s, 0, { type: 'bet' });
    expect(n.phase).toBe('roundEnd');
    expect(n.winners).toEqual([1]);
  });
});

describe('side show', () => {
  const seenAll = (extra: Partial<TPState> = {}) =>
    S({ hands: [pair(), junk(), trail()], seen: [true, true, true], turn: 2, ...extra });
  it('needs a seen asker, a seen previous player and more than two players', () => {
    const s = seenAll();
    expect(teenPatti.legalActions(s, 2).some((a) => a.type === 'sideshow')).toBe(true);
    const blindPrev = seenAll({ seen: [true, false, true] });
    expect(teenPatti.legalActions(blindPrev, 2).some((a) => a.type === 'sideshow')).toBe(false);
    const two = seenAll({ packed: [false, true, false] });
    expect(teenPatti.legalActions(two, 2).some((a) => a.type === 'sideshow')).toBe(false);
  });
  it('accept: the lower hand packs; refuse: nothing happens; tie: the asker packs', () => {
    // seat 2 (trail) asks seat 1 (junk), who is next in previous order? previous of seat 2 is seat 1 (ccw: seat+2->1)
    const s = seenAll();
    const asked = step(s, 2, { type: 'sideshow' });
    expect(asked.phase).toBe('sideshow');
    expect(asked.sideShow).toEqual({ asker: 2, target: 1 });
    expect(teenPatti.currentActors(asked)).toEqual([1]);
    expect(asked.chips[2]).toBe(1000 - 20);
    const accepted = step(asked, 1, { type: 'accept' });
    expect(accepted.packed[1]).toBe(true); // junk loses to a trail
    expect(accepted.packed[2]).toBe(false);
    expect(accepted.phase).toBe('bet');
    const refused = step(asked, 1, { type: 'refuse' });
    expect(refused.packed).toEqual([false, false, false]);
    expect(refused.turn).not.toBe(2);
    // tie: both pair of 9s
    const tie = S({
      hands: [junk(), [c('S', 9), c('H', 9), c('D', 4)], [c('C', 9), c('D', 9), c('H', 4)]],
      seen: [true, true, true],
      turn: 2,
    });
    const t2 = step(step(tie, 2, { type: 'sideshow' }), 1, { type: 'accept' });
    expect(t2.packed[2]).toBe(true);
  });
  it('only the two players are told the hands', () => {
    const asked = step(seenAll(), 2, { type: 'sideshow' });
    const r = teenPatti.apply(asked, 1, { type: 'accept' }, rng);
    const ev = r.events.find((e) => e.type === 'sideshowResult')!;
    expect(ev.visibleTo).toEqual([2, 1]);
    const forOther = teenPatti.filterEvents([ev], 0)[0];
    expect(forOther.cards).toBeUndefined();
  });
});

describe('variants', () => {
  it('muflis: the lowest hand wins the show', () => {
    const s = S({
      hands: [pair(), junk(), junk()],
      packed: [false, false, true],
      cfg: { variant: 'muflis' },
    });
    const r = step(s, 0, { type: 'show' });
    expect(r.winners).toEqual([1]);
  });
  it('AK47 and joker make cards wild and evaluate to the best hand', () => {
    const ak = { config: cfgOf({ variant: 'ak47' }), wildRank: null };
    expect(handScore(ak, [c('S', 1), c('H', 13), c('D', 4)]).category).toBe('trail');
    expect(handScore(ak, [c('S', 5), c('H', 5), c('D', 7)]).category).toBe('trail');
    const jk = { config: cfgOf({ variant: 'joker' }), wildRank: 9 };
    expect(handScore(jk, [c('S', 2), c('H', 2), c('D', 9)]).category).toBe('trail');
    expect(
      handScore({ config: cfgOf(), wildRank: null }, [c('S', 2), c('H', 2), c('D', 9)]).category,
    ).toBe('pair');
  });
  it('players without the boot sit out the next hand', () => {
    const s = S({ hands: [junk(), junk(), junk()], chips: [5, 500, 500] });
    const r = teenPatti.apply({ ...s, phase: 'roundEnd' }, 0, { type: 'next' }, rng).state;
    expect(r.inRound).toEqual([false, true, true]);
    expect(r.hands[0]).toHaveLength(0);
  });
});

describe('views and sim', () => {
  it('a blind player has no hand in their view; looking reveals it only to them', () => {
    const { state } = teenPatti.setup(
      Array.from({ length: 3 }, (_, i) => ({
        id: `p${i}`,
        name: `P${i}`,
        avatar: 'yak',
        isBot: false,
        difficulty: 'medium' as const,
      })),
      defaultConfig,
      createRng(8),
    );
    expect(teenPatti.view(state, state.turn).hand).toEqual([]);
    const r = teenPatti.apply(state, state.turn, { type: 'look' }, rng);
    expect(teenPatti.view(r.state, state.turn).hand).toHaveLength(3);
    expect(teenPatti.view(r.state, (state.turn + 1) % 3).hand).toEqual([]);
    const look = r.events.find((e) => e.type === 'look')!;
    expect(teenPatti.filterEvents([look], (state.turn + 1) % 3)[0].cards).toBeUndefined();
  });
  it('sim: 250 random games end with chips conserved', () => {
    const r = simulate(teenPatti, { n: 250 });
    expect(r.failures).toEqual([]);
  }, 60000);
});
