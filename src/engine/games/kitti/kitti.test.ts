import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../../core/cards';
import { createRng } from '../../core/rng';
import { IllegalActionError } from '../../core/types';
import { simulate } from '../../sim/simulate';
import { allSplits, bestSplit, kitti, type KAction, type KState } from './index';
import { defaultConfig, type KittiConfig } from './config';

let id = 0;
const c = (suit: Suit, rank: Rank): Card => ({ id: id++, suit, rank, copy: 0 });
const rng = createRng(6);
const cfgOf = (o: Partial<KittiConfig> = {}) => ({ ...defaultConfig, ...o }) as KittiConfig;
const ids = (cs: Card[]) => cs.map((x) => x.id);

function S(over: Partial<KState> & { hands: Card[][]; cfg?: Partial<KittiConfig> }): KState {
  const n = over.hands.length;
  const { hands, cfg, ...rest } = over;
  const config = cfgOf({ direction: 'cw', ...cfg });
  return {
    n,
    config,
    humans: Array(n).fill(true),
    levels: Array(n).fill('medium'),
    hands,
    groups: Array(n).fill(null),
    packed: Array(n).fill(false),
    inRound: Array(n).fill(true),
    chips: Array(n).fill(1000),
    start: Array(n).fill(1000 + config.boot),
    pot: config.boot * n,
    dealer: n - 1,
    round: 0,
    phase: 'arrange',
    showdown: null,
    ...rest,
  };
}
const step = (s: KState, seat: number, a: KAction) => kitti.apply(s, seat, a, rng).state;
const arrange = (s: KState, seat: number, groups: Card[][]) =>
  step(s, seat, { type: 'arrange', groups: groups.map(ids) });

// three groups: strong, medium, weak
const strong = () => [c('S', 1), c('H', 1), c('D', 1)]; // trail of aces
const medium = () => [c('S', 9), c('H', 9), c('D', 4)];
const weak = () => [c('S', 2), c('H', 5), c('D', 8)];
const hand = (g: Card[][]) => g.flat();

describe('splits', () => {
  it('there are exactly 280 ways to split nine cards into three groups of three', () => {
    const cards = Array.from({ length: 9 }, (_, i) => c('S', (i + 1) as Rank));
    const splits = allSplits(cards);
    expect(splits).toHaveLength(280);
    expect(
      new Set(
        splits.map((sp) =>
          sp
            .map((g) => ids(g).sort().join(''))
            .sort()
            .join('|'),
        ),
      ).size,
    ).toBe(280);
    for (const sp of splits) expect(new Set(sp.flat().map((x) => x.id)).size).toBe(9);
  });
  it('the medium split puts the strongest group first', () => {
    const g = [strong(), medium(), weak()];
    const split = bestSplit(hand(g), cfgOf());
    expect(ids(split[0]).sort()).toEqual(ids(g[0]).sort());
  });
});

describe('arranging', () => {
  it('rejects arrangements that are not a partition of your hand', () => {
    const g = [strong(), medium(), weak()];
    const s = S({ hands: [hand(g), hand([medium(), weak(), medium()])] });
    expect(() =>
      step(s, 0, {
        type: 'arrange',
        groups: [
          [1, 2, 3],
          [4, 5, 6],
          [7, 8, 9],
        ],
      }),
    ).toThrow(IllegalActionError);
    const dup = [ids(g[0]), ids(g[0]), ids(g[2])];
    expect(() => step(s, 0, { type: 'arrange', groups: dup })).toThrow(IllegalActionError);
  });
  it('descending order can be required', () => {
    const g = [strong(), medium(), weak()];
    const s = S({
      hands: [hand(g), hand([medium(), weak(), medium()])],
      cfg: { descending: true },
    });
    expect(() => arrange(s, 0, [g[2], g[1], g[0]])).toThrow(IllegalActionError);
    expect(arrange(s, 0, [g[0], g[1], g[2]]).groups[0]).not.toBeNull();
  });
  it('auto arranges the best split (this is what a timeout does)', () => {
    const g = [strong(), medium(), weak()];
    const s = S({ hands: [hand(g), hand([medium(), weak(), medium()])] });
    const n = step(s, 0, { type: 'auto' });
    expect(n.groups[0]![0].sort()).toEqual(ids(g[0]).sort());
    expect(kitti.timeoutAction(s, 0)).toEqual({ type: 'auto' });
  });
});

describe('showdown', () => {
  const duel = (a: Card[][], b: Card[][], cfg: Partial<KittiConfig> = {}) => {
    let s = S({ hands: [hand(a), hand(b)], cfg });
    s = arrange(s, 0, a);
    return arrange(s, 1, b);
  };
  it('winning two shows takes the pot', () => {
    const r = duel(
      [strong(), medium(), weak()],
      [
        [c('S', 4), c('H', 7), c('D', 11)],
        [c('S', 12), c('H', 12), c('D', 3)],
        [c('S', 13), c('H', 13), c('D', 6)],
      ],
    );
    expect(r.showdown!.showWinners).toEqual([0, 1, 1]);
    expect(r.showdown!.winner).toBe(1);
    expect(r.chips[1]).toBe(1000 + 20);
    expect(r.phase).toBe('roundEnd');
    expect(kitti.invariants!(r)).toBeNull();
  });
  it('winning all three is a salami: the others pay an extra boot', () => {
    const r = duel(
      [strong(), [c('S', 13), c('H', 13), c('D', 2)], [c('S', 12), c('H', 12), c('D', 2)]],
      [
        [c('S', 3), c('H', 6), c('D', 9)],
        [c('S', 4), c('H', 7), c('D', 11)],
        [c('S', 5), c('H', 8), c('D', 10)],
      ],
    );
    expect(r.showdown!.salami).toBe(true);
    expect(r.chips[0]).toBe(1000 + 20 + 10);
    expect(r.chips[1]).toBe(1000 - 10);
    const off = duel(
      [strong(), [c('S', 13), c('H', 13), c('D', 2)], [c('S', 12), c('H', 12), c('D', 2)]],
      [
        [c('S', 3), c('H', 6), c('D', 9)],
        [c('S', 4), c('H', 7), c('D', 11)],
        [c('S', 5), c('H', 8), c('D', 10)],
      ],
      { salamiBonus: false },
    );
    expect(off.chips[0]).toBe(1000 + 20);
  });
  it('ties: nobody wins the show by default, or the earlier player in turn order', () => {
    const a = [
      [c('S', 9), c('H', 9), c('D', 4)],
      [c('S', 2), c('H', 5), c('D', 8)],
      [c('S', 13), c('H', 13), c('D', 6)],
    ];
    const b = [
      [c('C', 9), c('D', 9), c('H', 4)],
      [c('C', 3), c('D', 6), c('H', 9)],
      [c('S', 1), c('H', 1), c('D', 3)],
    ];
    const none = duel(a, b);
    expect(none.showdown!.showWinners[0]).toBeNull();
    const earlier = duel(a, b, { tieRule: 'earlier' });
    expect(earlier.showdown!.showWinners[0]).not.toBeNull();
  });
  it('kitti: nobody wins two shows, so the pot carries to the next hand', () => {
    const a = [
      [c('S', 9), c('H', 9), c('D', 4)],
      [c('S', 2), c('H', 5), c('D', 8)],
      [c('S', 13), c('H', 13), c('D', 6)],
    ];
    const b = [
      [c('C', 9), c('D', 9), c('H', 4)],
      [c('C', 3), c('D', 6), c('H', 9)],
      [c('S', 3), c('H', 3), c('D', 8)],
    ];
    const r = duel(a, b);
    expect(r.showdown!.winner).toBeNull();
    expect(r.pot).toBe(20);
    const next = kitti.apply(r, 0, { type: 'next' }, rng).state;
    expect(next.pot).toBe(20 + 20); // carried pot plus new boots
    expect(next.round).toBe(1);
  });
  it('2 in a row can be required instead of any 2 of 3', () => {
    // seat 1 wins shows 1 and 3 only
    const a = [
      [c('S', 4), c('H', 7), c('D', 11)],
      [c('S', 12), c('H', 12), c('D', 3)],
      [c('S', 5), c('H', 8), c('D', 9)],
    ];
    const b = [
      [c('S', 13), c('H', 13), c('D', 2)],
      [c('S', 3), c('H', 6), c('D', 9)],
      [c('S', 1), c('H', 1), c('D', 3)],
    ];
    const any = duel(a, b);
    expect(any.showdown!.winner).toBe(1);
    const run = duel(a, b, { winRule: 'run2' });
    expect(run.showdown!.winner).toBeNull();
  });
  it('packing first loses only the boot, and the last player takes the pot', () => {
    let s = S({
      hands: [hand([strong(), medium(), weak()]), hand([medium(), weak(), medium()])],
      cfg: { packFirst: true },
    });
    s = step(s, 1, { type: 'pack' });
    s = step(s, 0, { type: 'auto' });
    expect(s.phase).toBe('roundEnd');
    expect(s.chips).toEqual([1000 + 20, 1000]);
    expect(kitti.invariants!(s)).toBeNull();
  });
});

describe('views and sim', () => {
  it('no one sees another hand or arrangement', () => {
    const { state } = kitti.setup(
      Array.from({ length: 3 }, (_, i) => ({
        id: `p${i}`,
        name: `P${i}`,
        avatar: 'yak',
        isBot: false,
        difficulty: 'medium' as const,
      })),
      defaultConfig,
      createRng(5),
    );
    const v = kitti.view(state, 0);
    expect(v.hand).toHaveLength(9);
    expect(JSON.stringify(v)).not.toContain(JSON.stringify(state.hands[1][0]));
  });
  it('sim: 200 random games end with chips conserved', () => {
    const r = simulate(kitti, { n: 200 });
    expect(r.failures).toEqual([]);
  }, 60000);
});
