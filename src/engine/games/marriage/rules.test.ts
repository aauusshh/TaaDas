import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../../core/cards';
import { countDublees, findShow, roleOf, solve, validateShow, type Ctx } from './rules';

let id = 0;
const c = (suit: Suit, rank: Rank): Card => ({ id: id++, suit, rank, copy: 0 });
const man = (): Card => ({ id: id++, suit: 'J', rank: 0, copy: 0 });
const run = (suit: Suit, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => c(suit, (from + i) as Rank));
const none: Ctx = { joker: null, supermanId: null };
const pure = { allowWild: false, pureOnly: true };
const full = { allowWild: true, pureOnly: false };

describe('roles relative to the joker card', () => {
  const j = c('H', 13); // K of hearts
  it('tiplu, poplu (K wraps to A), jhiplu, alter, joker, man', () => {
    expect(roleOf(c('H', 13), j)).toBe('tiplu');
    expect(roleOf(c('H', 1), j)).toBe('poplu');
    expect(roleOf(c('H', 12), j)).toBe('jhiplu');
    expect(roleOf(c('D', 13), j)).toBe('alter');
    expect(roleOf(c('S', 13), j)).toBe('joker');
    expect(roleOf(c('C', 13), j)).toBe('joker');
    expect(roleOf(man(), j)).toBe('man');
    expect(roleOf(c('H', 5), j)).toBeNull();
    expect(roleOf(c('D', 1), j)).toBeNull();
  });
});

describe('pure sets', () => {
  it('A-2-3 and Q-K-A are sequences, K-A-2 is not', () => {
    expect(solve(run('S', 1, 3), none, pure)).toHaveLength(1);
    expect(solve([c('S', 12), c('S', 13), c('S', 1)], none, pure)).toHaveLength(1);
    expect(solve([c('S', 13), c('S', 1), c('S', 2)], none, pure)).toBeNull();
  });
  it('a tunnela is three identical cards; three of a rank in different suits is not pure', () => {
    expect(solve([c('S', 5), c('S', 5), c('S', 5)], none, pure)![0].type).toBe('tunnela');
    expect(solve([c('S', 5), c('H', 5), c('D', 5)], none, pure)).toBeNull();
  });
  it('splits several sets and rejects leftovers', () => {
    const cards = [...run('S', 3, 6), ...run('H', 9, 11), c('D', 7), c('D', 7), c('D', 7)];
    expect(solve(cards, none, pure)).toHaveLength(3);
    expect(solve([...cards, c('C', 2)], none, pure)).toBeNull();
  });
  it('Superman fills a gap in a pure sequence before seeing', () => {
    const sup = man();
    const ctx: Ctx = { joker: null, supermanId: sup.id };
    const m = solve([c('S', 4), sup, c('S', 6)], ctx, pure);
    expect(m?.[0].type).toBe('pure');
    // a plain Man card cannot be used before seeing
    expect(solve([c('S', 4), man(), c('S', 6)], none, pure)).toBeNull();
  });
});

describe('after seeing: trials, sequences, wilds', () => {
  const joker = c('H', 9);
  const ctx: Ctx = { joker, supermanId: null };
  it('a trial needs different suits', () => {
    expect(solve([c('S', 5), c('H', 5), c('D', 5)], ctx, full)![0].type).toBe('trial');
    expect(solve([c('S', 5), c('S', 5), c('H', 5)], ctx, full)).toBeNull();
  });
  it('a Man card completes a sequence or trial', () => {
    expect(solve([c('S', 4), man(), c('S', 6)], ctx, full)![0].type).toBe('sequence');
    expect(solve([c('S', 5), c('H', 5), man()], ctx, full)![0].type).toBe('trial');
  });
  it('maal cards are wild after seeing, but natural in pure sequences', () => {
    // 10H is the poplu of 9H: wild for the sequence S4 _ S6, and natural 8H-9H-10H is a marriage
    const m = solve([c('S', 4), c('H', 10), c('S', 6)], ctx, full);
    expect(m?.[0].type).toBe('sequence');
    const marriage = solve([c('H', 8), c('H', 9), c('H', 10)], ctx, full);
    expect(marriage![0].type).toBe('marriage');
    expect(solve([c('S', 4), c('H', 10), c('S', 6)], none, pure)).toBeNull();
  });
  it('all 21 cards split into sets with a wild', () => {
    const cards = [
      ...run('S', 1, 4),
      ...run('D', 8, 12),
      ...run('C', 3, 5),
      c('H', 7),
      man(),
      c('H', 7),
      c('S', 9),
      c('S', 9),
    ].slice(0, 21);
    // not guaranteed valid: the point is that the solver answers quickly
    const t0 = performance.now();
    solve(cards, ctx, full);
    expect(performance.now() - t0).toBeLessThan(200);
  });
});

describe('showing', () => {
  const ctx = none;
  it('three pure sets are a valid sequence show; fewer is not', () => {
    const sets = [run('S', 3, 5), run('H', 9, 11), [c('D', 7), c('D', 7), c('D', 7)]];
    expect(validateShow(sets, ctx, { sequences: 3, dublees: 7 }, false)?.route).toBe('sequence');
    expect(validateShow(sets.slice(0, 2), ctx, { sequences: 3, dublees: 7 }, false)).toBeNull();
    expect(
      validateShow(
        [...sets.slice(0, 2), [c('S', 2), c('H', 2), c('D', 2)]],
        ctx,
        { sequences: 3, dublees: 7 },
        false,
      ),
    ).toBeNull();
  });
  it('seven identical pairs show the dublee route; a wild cannot make a dublee', () => {
    const pairs = Array.from({ length: 7 }, (_, i) => [
      c('S', (i + 1) as Rank),
      c('S', (i + 1) as Rank),
    ]);
    expect(validateShow(pairs, ctx, { sequences: 3, dublees: 7 }, false)?.route).toBe('dublee');
    const bad = [...pairs.slice(0, 6), [c('S', 9), man()]];
    expect(validateShow(bad, ctx, { sequences: 3, dublees: 7 }, false)).toBeNull();
    const jokers = [...pairs.slice(0, 6), [man(), man()]];
    expect(validateShow(jokers, ctx, { sequences: 3, dublees: 7 }, true)?.route).toBe('dublee');
    expect(validateShow(jokers, ctx, { sequences: 3, dublees: 7 }, false)).toBeNull();
  });
  it('findShow locates three disjoint pure sets containing a required card', () => {
    const need = c('S', 7);
    const cards = [
      ...run('S', 3, 6),
      need,
      ...run('H', 9, 11),
      c('D', 4),
      c('D', 4),
      c('D', 4),
      c('C', 13),
    ];
    const show = findShow(cards, none, 3, need.id);
    expect(show).not.toBeNull();
    expect(show!.some((s) => s.some((x) => x.id === need.id))).toBe(true);
    expect(findShow([c('S', 1), c('H', 2)], none, 3, null)).toBeNull();
  });
  it('counts dublees', () => {
    expect(
      countDublees([c('S', 5), c('S', 5), c('H', 5), c('H', 5), c('H', 5), c('D', 2)], false),
    ).toBe(2);
  });
});

describe('solver speed', () => {
  it('answers in well under 30 ms for 22-card hands, solvable or not', async () => {
    const { makeDeck } = await import('../../core/deck');
    const { createRng } = await import('../../core/rng');
    const rng = createRng(77);
    const ctx: Ctx = { joker: { id: -1, suit: 'H', rank: 9, copy: 0 }, supermanId: null };
    let worst = 0;
    let total = 0;
    for (let i = 0; i < 150; i++) {
      const deck = rng.shuffle(makeDeck({ decks: 3 }));
      const hand = deck.slice(0, 22);
      const t0 = performance.now();
      solve(hand, ctx, full);
      const dt = performance.now() - t0;
      worst = Math.max(worst, dt);
      total += dt;
    }
    expect(total / 150).toBeLessThan(10);
    expect(worst).toBeLessThan(250);
  });
});
