import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { IllegalActionError } from '../../core/types';
import { makePlayers, simulate } from '../../sim/simulate';
import { langurBurja, payoutFor, returnsFor, settle, type LBAction, type LBState } from './index';
import { defaultConfig, type LangurConfig } from './config';

const rng = createRng(3);
const players = (n: number, humans = n) =>
  makePlayers(n, createRng(1)).map((p, i) => ({ ...p, isBot: i >= humans }));
const mk = (n = 3, cfg: Partial<LangurConfig> = {}, humans = n) =>
  langurBurja.setup(players(n, humans), { ...defaultConfig, ...cfg } as LangurConfig, rng).state;
const step = (s: LBState, seat: number, a: LBAction) => langurBurja.apply(s, seat, a, rng).state;

describe('payout math', () => {
  it('stake 100: 0 or 1 matching dice lose it, 2 double, 3 treble, 6 pay six times', () => {
    const cfg = defaultConfig;
    expect(payoutFor(0, 100, cfg)).toBe(-100);
    expect(payoutFor(1, 100, cfg)).toBe(-100); // one die does not pay: nothing comes back
    expect(payoutFor(2, 100, cfg)).toBe(100); // 200 back, profit 100
    expect(payoutFor(3, 100, cfg)).toBe(200); // 300 back, profit 200
    expect(payoutFor(4, 100, cfg)).toBe(300);
    expect(payoutFor(5, 100, cfg)).toBe(400);
    expect(payoutFor(6, 100, cfg)).toBe(500); // 600 back
    expect(returnsFor(1, cfg)).toBe(0);
    expect(returnsFor(2, cfg)).toBe(2);
  });
  it('an edited table is applied, and a one-die row can return the stake', () => {
    const cfg = { ...defaultConfig, pay1: 1, pay2: 3, pay3: 10 };
    expect(payoutFor(1, 50, cfg)).toBe(0);
    expect(payoutFor(2, 50, cfg)).toBe(100);
    expect(payoutFor(3, 50, cfg)).toBe(450);
    expect(payoutFor(0, 50, cfg)).toBe(-50);
  });
  it('multiple bets per player settle independently and the banker takes the other side', () => {
    // seat 0 banker; seat 1 bets 100 crown + 50 flag; dice: three crowns, no flag
    const bets = [Array(6).fill(0), [100, 50, 0, 0, 0, 0], [0, 0, 200, 0, 0, 0]];
    const { net, counts } = settle(bets, [0, 0, 0, 2, 3, 4], 0, defaultConfig);
    expect(counts).toEqual([3, 0, 1, 1, 1, 0]);
    expect(net[1]).toBe(200 - 50);
    expect(net[2]).toBe(-200); // a lone die loses the stake
    expect(net[0]).toBe(-(150 - 200));
    expect(net.reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe('a round', () => {
  it('stakes: any amount on the step, limits, own-chips cap and locks hold', () => {
    let s = mk(3);
    expect(s.banker).toBe(0);
    s = step(s, 1, { type: 'setBet', symbol: 2, amount: 135 });
    expect(langurBurja.view(s, 1).staked[1]).toBe(135);
    s = step(s, 1, { type: 'setBet', symbol: 2, amount: 75 }); // edit freely
    expect(s.bets[1][2]).toBe(75);
    const bad =
      (a: number, sym = 2) =>
      () =>
        step(s, 1, { type: 'setBet', symbol: sym, amount: a });
    expect(bad(1001)).toThrow(IllegalActionError); // over the maximum
    expect(bad(7)).toThrow(IllegalActionError); // off the step of 5
    expect(bad(-5)).toThrow(IllegalActionError);
    expect(bad(5.5)).toThrow(IllegalActionError);
    expect(bad(5000, 3)).toThrow(IllegalActionError);
    s = step(s, 1, { type: 'setBet', symbol: 2, amount: 0 }); // take it back
    expect(s.bets[1][2]).toBe(0);
    // total across symbols cannot pass the player's chips
    let r = mk(3, { maxBet: 5000, startChips: 1000 });
    r = step(r, 1, { type: 'setBet', symbol: 0, amount: 600 });
    expect(() => step(r, 1, { type: 'setBet', symbol: 1, amount: 405 })).toThrow(
      IllegalActionError,
    );
    r = step(r, 1, { type: 'setBet', symbol: 1, amount: 400 });
    expect(langurBurja.view(r, 1).staked[1]).toBe(1000);
    // the banker cannot bet
    expect(() => step(s, 0, { type: 'setBet', symbol: 0, amount: 10 })).toThrow(IllegalActionError);
    // minimum and step are host settings
    const m = mk(3, { minBet: 50, step: 10 });
    expect(() => step(m, 1, { type: 'setBet', symbol: 0, amount: 40 })).toThrow(IllegalActionError);
    expect(step(m, 1, { type: 'setBet', symbol: 0, amount: 60 }).bets[1][0]).toBe(60);
  });

  it('bets are locked once a player is ready, and after betting closes', () => {
    let s = mk(3);
    s = step(s, 1, { type: 'setBet', symbol: 0, amount: 100 });
    s = step(s, 1, { type: 'ready' });
    expect(() => step(s, 1, { type: 'setBet', symbol: 1, amount: 10 })).toThrow(IllegalActionError);
    s = step(s, 2, { type: 'ready' });
    expect(s.phase).toBe('rolling'); // everyone ready closes betting
    expect(() => step(s, 2, { type: 'setBet', symbol: 1, amount: 10 })).toThrow(IllegalActionError);
    expect(() => step(s, 1, { type: 'roll' })).toThrow(IllegalActionError); // only the banker rolls
  });

  it('the banker can close betting early', () => {
    let s = mk(3);
    s = step(s, 1, { type: 'setBet', symbol: 0, amount: 100 });
    expect(langurBurja.legalActions(s, 0).map((a) => a.type)).toEqual(['close']);
    s = step(s, 0, { type: 'close' });
    expect(s.phase).toBe('rolling');
    expect(() => step(s, 2, { type: 'setBet', symbol: 0, amount: 10 })).toThrow(IllegalActionError);
  });

  it('rolling settles chips, conserves the total, and the next round starts clean', () => {
    let s = mk(3);
    s = step(s, 1, { type: 'setBet', symbol: 0, amount: 100 });
    s = step(s, 1, { type: 'setBet', symbol: 3, amount: 50 });
    s = step(s, 0, { type: 'close' });
    const before = s.chips.reduce((a, b) => a + b, 0);
    s = step(s, 0, { type: 'roll' });
    expect(s.dice).toHaveLength(6);
    expect(s.chips.reduce((a, b) => a + b, 0)).toBe(before);
    expect(s.net.reduce((a, b) => a + b, 0)).toBe(0);
    expect(s.history).toHaveLength(1);
    expect(s.phase).toBe('summary');
    const n = step(s, 0, { type: 'next' });
    expect(n.round).toBe(1);
    expect(n.phase).toBe('betting');
    expect(n.bets.flat().every((b) => b === 0)).toBe(true);
    expect(n.dice).toBeNull();
  });

  it('the roll is not in the state before betting closes (views never carry dice early)', () => {
    let s = mk(3);
    s = step(s, 1, { type: 'setBet', symbol: 0, amount: 100 });
    expect(langurBurja.view(s, 1).dice).toBeNull();
    s = step(s, 0, { type: 'close' });
    expect(langurBurja.view(s, 2).dice).toBeNull();
    expect(JSON.stringify(langurBurja.view(s, 2))).not.toContain('"counts":[');
  });

  it('banker rotates every N rounds, and the game ends after the set rounds', () => {
    let s = mk(3, { bankerRotate: 1, rounds: 2 });
    s = step(s, 0, { type: 'close' });
    s = step(s, 0, { type: 'roll' });
    s = step(s, 0, { type: 'next' });
    expect(s.banker).toBe(1);
    s = step(s, 1, { type: 'close' });
    s = step(s, 1, { type: 'roll' });
    expect(s.phase).toBe('over');
    const r = langurBurja.result(s)!;
    expect(r.chipDelta!.reduce((a, b) => a + b, 0)).toBe(0);
  });

  it('house banks when playing alone: banker is the last seat', () => {
    const s = mk(4, { houseBanks: true }, 1);
    expect(s.banker).toBe(3);
    expect(langurBurja.modeConfig!('bots')).toEqual({ houseBanks: true });
    expect(langurBurja.modeConfig!('local')).toEqual({ houseBanks: false });
  });
});

describe('sim', () => {
  it('300 random games end with chips conserved', () => {
    const r = simulate(langurBurja, { n: 300 });
    expect(r.failures).toEqual([]);
  }, 60000);
});
