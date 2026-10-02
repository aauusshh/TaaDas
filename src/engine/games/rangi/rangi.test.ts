import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { IllegalActionError } from '../../core/types';
import { makePlayers, simulate } from '../../sim/simulate';
import { rangi } from './index';
import { defaultConfig, type RangiConfig } from './config';
import { cardPoints, makeRangiDeck, type RCard, type RColor, type RValue } from './rules';
import type { RangiAction, RangiState } from './view';

let nid = 1000;
const c = (color: RColor | 'wild', value: RValue): RCard => ({ id: nid++, color, value });
const filler = (n: number) => Array.from({ length: n }, () => c('leaf', 1));

function S(
  over: Partial<RangiState> & { hands: RCard[][]; cfg?: Partial<RangiConfig> },
): RangiState {
  const n = over.hands.length;
  const draw = Array.from({ length: 30 }, () => c('sky', 5));
  const base: RangiState = {
    n,
    config: { ...defaultConfig, ...(over.cfg ?? {}) } as RangiConfig,
    humans: Array(n).fill(true),
    levels: Array(n).fill('medium'),
    hands: over.hands,
    draw,
    discard: [c('sindoor', 5)],
    color: 'sindoor',
    dir: 1,
    turn: 0,
    dealer: 0,
    round: 0,
    phase: 'play',
    pending: 0,
    pendingKind: null,
    drawnId: null,
    ek: null,
    challenge: null,
    roundScores: [],
    lastWinner: null,
    stall: 0,
  };
  const { hands: _h, cfg: _c, ...rest } = over;
  void _h;
  void _c;
  return { ...base, ...rest };
}
const rng = createRng(5);
const play = (
  card: RCard,
  extra: Partial<Extract<RangiAction, { type: 'play' }>> = {},
): RangiAction => ({
  type: 'play',
  cardId: card.id,
  ...extra,
});
const step = (s: RangiState, seat: number, a: RangiAction) => rangi.apply(s, seat, a, rng).state;

describe('rangi deck and setup', () => {
  it('has 108 cards with the right composition', () => {
    const d = makeRangiDeck();
    expect(d).toHaveLength(108);
    expect(new Set(d.map((x) => x.id)).size).toBe(108);
    expect(d.filter((x) => x.value === 0)).toHaveLength(4);
    expect(d.filter((x) => x.value === 7)).toHaveLength(8);
    expect(d.filter((x) => x.value === 'skip')).toHaveLength(8);
    expect(d.filter((x) => x.value === 'wild')).toHaveLength(4);
    expect(d.filter((x) => x.value === 'wild4')).toHaveLength(4);
  });
  it('deals 7 each and never starts on a Wild Draw Four', () => {
    for (let seed = 1; seed < 80; seed++) {
      const { state } = rangi.setup(makePlayers(4, createRng(1)), defaultConfig, createRng(seed));
      expect(state.discard[0].value).not.toBe('wild4');
      const total = state.hands.reduce((t, h) => t + h.length, 0) + state.draw.length + 1;
      expect(total).toBe(108);
    }
  });
  it('first card effects land on the first player', () => {
    const find = (value: RValue) => {
      for (let seed = 1; seed < 3000; seed++) {
        const r = rangi.setup(makePlayers(4, createRng(1)), defaultConfig, createRng(seed));
        if (r.state.discard[0].value === value) return r.state;
      }
      throw new Error('no seed');
    };
    const first = (s: RangiState) => (((s.dealer + s.dir) % 4) + 4) % 4;
    const skip = find('skip');
    expect(skip.turn).toBe((first(skip) + 1) % 4);
    const rev = find('reverse');
    expect(rev.dir).toBe(-1);
    expect(rev.turn).toBe(rev.dealer);
    const d2 = find('draw2');
    expect(d2.hands[first(d2)]).toHaveLength(9);
    const w = find('wild');
    expect(w.phase).toBe('color');
    expect(rangi.legalActions(w, w.turn)).toHaveLength(4);
  });
});

describe('legality', () => {
  it('matches color, number or symbol, or a wild; nothing else', () => {
    const red9 = c('sindoor', 9);
    const blue5 = c('sky', 5);
    const blue3 = c('sky', 3);
    const wild = c('wild', 'wild');
    const s = S({ hands: [[red9, blue5, blue3, wild], filler(3)] });
    const ids = rangi
      .legalActions(s, 0)
      .filter((a) => a.type === 'play')
      .map((a) => (a as { cardId: number }).cardId);
    expect(ids).toContain(red9.id); // color
    expect(ids).toContain(blue5.id); // number
    expect(ids).not.toContain(blue3.id);
    expect(ids).toContain(wild.id);
    expect(() => step(s, 0, play(blue3))).toThrow(IllegalActionError);
    expect(() => step(s, 1, { type: 'draw' })).toThrow(IllegalActionError);
  });
  it('a wild needs a color and sets it', () => {
    const wild = c('wild', 'wild');
    const s = S({ hands: [[wild, c('leaf', 2)], filler(3)] });
    expect(() => step(s, 0, play(wild))).toThrow(IllegalActionError);
    const n = step(s, 0, play(wild, { color: 'marigold' }));
    expect(n.color).toBe('marigold');
    expect(n.turn).toBe(1);
  });
  it('draw 1: may play the drawn card if it fits, otherwise the turn passes', () => {
    const s = S({ hands: [[c('leaf', 2)], filler(3)] });
    s.draw.push(c('sindoor', 7)); // fits
    const a = step(s, 0, { type: 'draw' });
    expect(a.turn).toBe(0);
    expect(a.drawnId).not.toBeNull();
    expect(rangi.legalActions(a, 0).map((x) => x.type)).toEqual(['play', 'pass']);
    const b = step(a, 0, { type: 'pass' });
    expect(b.turn).toBe(1);
    const s2 = S({ hands: [[c('leaf', 2)], filler(3)] });
    s2.draw.push(c('sky', 7)); // does not fit
    expect(step(s2, 0, { type: 'draw' }).turn).toBe(1);
  });
  it('mustPlay hides Draw while a card is playable; drawUntilPlay keeps drawing', () => {
    const s = S({ hands: [[c('sindoor', 2)], filler(3)], cfg: { mustPlay: true } });
    expect(rangi.legalActions(s, 0).some((a) => a.type === 'draw')).toBe(false);
    const d = S({ hands: [[c('leaf', 2)], filler(3)], cfg: { drawUntilPlay: true } });
    d.draw.push(c('sindoor', 8), c('sky', 1), c('sky', 2)); // pops 'sky 2', 'sky 1', then red 8
    const r = step(d, 0, { type: 'draw' });
    expect(r.hands[0]).toHaveLength(4);
    expect(r.drawnId).not.toBeNull();
  });
});

describe('action cards', () => {
  it('skip, draw two, reverse', () => {
    const skip = c('sindoor', 'skip');
    expect(
      step(S({ hands: [[skip, c('leaf', 1)], filler(3), filler(3)] }), 0, play(skip)).turn,
    ).toBe(2);
    const d2 = c('sindoor', 'draw2');
    const n = step(S({ hands: [[d2, c('leaf', 1)], filler(3), filler(3)] }), 0, play(d2));
    expect(n.hands[1]).toHaveLength(5);
    expect(n.turn).toBe(2);
    const rev = c('sindoor', 'reverse');
    const r = step(S({ hands: [[rev, c('leaf', 1)], filler(3), filler(3)] }), 0, play(rev));
    expect(r.dir).toBe(-1);
    expect(r.turn).toBe(2);
  });
  it('reverse with two players acts as skip', () => {
    const rev = c('sindoor', 'reverse');
    const r = step(S({ hands: [[rev, c('leaf', 1)], filler(3)] }), 0, play(rev));
    expect(r.turn).toBe(0);
  });
});

describe('wild draw four and challenge', () => {
  const honestState = (cfg: Partial<RangiConfig> = {}) => {
    const w4 = c('wild', 'wild4');
    return { w4, s: S({ hands: [[w4, c('leaf', 3)], filler(3), filler(3)], cfg }) };
  };
  const dishonestState = (cfg: Partial<RangiConfig> = {}) => {
    const w4 = c('wild', 'wild4');
    return {
      w4,
      s: S({ hands: [[w4, c('sindoor', 3), c('leaf', 3)], filler(3), filler(3)], cfg }),
    };
  };
  it('opens a challenge for the next player', () => {
    const { w4, s } = honestState();
    const n = step(s, 0, play(w4, { color: 'sky' }));
    expect(n.phase).toBe('challenge');
    expect(rangi.legalActions(n, 1).map((a) => a.type)).toEqual(['challenge', 'accept']);
    expect(rangi.legalActions(n, 2)).toEqual([]);
  });
  it('accepting draws four and skips', () => {
    const { w4, s } = honestState();
    const n = step(step(s, 0, play(w4, { color: 'sky' })), 1, { type: 'accept' });
    expect(n.hands[1]).toHaveLength(7);
    expect(n.turn).toBe(2);
    expect(n.color).toBe('sky');
  });
  it('a failed challenge (it was legal): challenger draws six', () => {
    const { w4, s } = honestState();
    const n = step(step(s, 0, play(w4, { color: 'sky' })), 1, { type: 'challenge' });
    expect(n.hands[1]).toHaveLength(9);
    expect(n.turn).toBe(2);
  });
  it('a good challenge (it was illegal): the player who bluffed draws four', () => {
    const { w4, s } = dishonestState();
    const n = step(step(s, 0, play(w4, { color: 'sky' })), 1, { type: 'challenge' });
    expect(n.hands[0]).toHaveLength(2 + 4);
    expect(n.hands[1]).toHaveLength(3);
    expect(n.turn).toBe(1); // the challenger plays normally
  });
  it('with challenges off it is only playable with no card of the current color', () => {
    const h = honestState({ challenge: false });
    expect(rangi.legalActions(h.s, 0).some((a) => a.type === 'play' && a.cardId === h.w4.id)).toBe(
      true,
    );
    const d = dishonestState({ challenge: false });
    expect(rangi.legalActions(d.s, 0).some((a) => a.type === 'play' && a.cardId === d.w4.id)).toBe(
      false,
    );
    const n = step(h.s, 0, play(h.w4, { color: 'sky' }));
    expect(n.hands[1]).toHaveLength(7);
  });
});

describe('Ek and Caught', () => {
  const lastTwo = () => {
    const a = c('sindoor', 2);
    return { a, s: S({ hands: [[a, c('leaf', 3)], filler(3), filler(3)] }) };
  };
  it('going down to one card opens the window; calling Ek closes it', () => {
    const { a, s } = lastTwo();
    const n = step(s, 0, play(a));
    expect(n.ek).toEqual({ seat: 0, called: false });
    expect(rangi.currentActors(n)).toEqual([1, 0, 2]);
    expect(rangi.legalActions(n, 0).map((x) => x.type)).toEqual(['ek']);
    const called = step(n, 0, { type: 'ek' });
    expect(called.ek).toBeNull();
    expect(() => step(called, 2, { type: 'caught' })).toThrow(IllegalActionError);
  });
  it('another player catching first makes the forgetful player draw two', () => {
    const { a, s } = lastTwo();
    const n = step(s, 0, play(a));
    const caught = step(n, 2, { type: 'caught' });
    expect(caught.hands[0]).toHaveLength(3);
    expect(caught.ek).toBeNull();
    expect(() => step(caught, 0, { type: 'ek' })).toThrow(IllegalActionError);
  });
  it('the next player acting closes the window', () => {
    const { a, s } = lastTwo();
    const n = step(s, 0, play(a));
    const after = step(n, 1, { type: 'draw' });
    expect(after.ek).toBeNull();
  });
  it('can be switched off', () => {
    const a = c('sindoor', 2);
    const s = S({ hands: [[a, c('leaf', 3)], filler(3)], cfg: { callEk: false } });
    expect(step(s, 0, play(a)).ek).toBeNull();
  });
});

describe('house rules', () => {
  it('stacking: draw two on draw two, then the unlucky player eats the pile', () => {
    const d1 = c('sindoor', 'draw2');
    const d2 = c('sky', 'draw2');
    let s = S({
      hands: [[d1, c('leaf', 2), c('leaf', 4)], [d2, c('leaf', 3)], filler(3)],
      cfg: { stacking: true },
    });
    s = step(s, 0, play(d1));
    expect(s.pending).toBe(2);
    expect(s.turn).toBe(1);
    // seat 1 may only stack or draw
    const kinds = rangi.legalActions(s, 1).map((a) => a.type);
    expect(kinds.sort()).toEqual(['draw', 'play']);
    s = step(s, 1, play(d2));
    expect(s.pending).toBe(4);
    s = step(s, 2, { type: 'draw' });
    expect(s.hands[2]).toHaveLength(7);
    expect(s.pending).toBe(0);
    expect(s.turn).toBe(0);
  });
  it('mixed stacking lets a Wild Draw Four ride on a Draw Two', () => {
    const d1 = c('sindoor', 'draw2');
    const w4 = c('wild', 'wild4');
    const base = (mixed: boolean) =>
      step(
        S({
          hands: [[d1, c('leaf', 2)], [w4, c('leaf', 3)], filler(3)],
          cfg: { stacking: true, stackMixed: mixed, challenge: false },
        }),
        0,
        play(d1),
      );
    expect(rangi.legalActions(base(true), 1).some((a) => a.type === 'play')).toBe(true);
    expect(rangi.legalActions(base(false), 1).some((a) => a.type === 'play')).toBe(false);
  });
  it('seven swaps hands with a chosen player, zero rotates every hand', () => {
    const seven = c('sindoor', 7);
    const mine = [seven, c('leaf', 2), c('leaf', 3)];
    const theirs = [c('sky', 1)];
    let s = S({ hands: [mine, theirs, filler(2)], cfg: { sevenZero: true } });
    expect(rangi.legalActions(s, 0).filter((a) => a.type === 'play')).toHaveLength(2); // swap with 1 or 2
    expect(() => step(s, 0, play(seven))).toThrow(IllegalActionError);
    s = step(s, 0, play(seven, { swapWith: 1 }));
    expect(s.hands[0]).toHaveLength(1);
    expect(s.hands[1]).toHaveLength(2);
    const zero = c('sindoor', 0);
    const z = step(
      S({
        hands: [[zero, c('leaf', 2)], [c('sky', 1)], [c('sky', 2), c('sky', 3)]],
        cfg: { sevenZero: true },
      }),
      0,
      play(zero),
    );
    expect(z.hands.map((h) => h.length)).toEqual([2, 1, 1]); // [after play 1,1,2] passed forward
  });
  it('jump-in: an identical card plays out of turn and moves the turn', () => {
    const twin = c('sindoor', 5);
    const s = S({ hands: [filler(3), filler(3), [twin, c('sky', 8)]], cfg: { jumpIn: true } });
    const legal = rangi.legalActions(s, 2);
    expect(legal.some((a) => a.type === 'play' && a.cardId === twin.id)).toBe(true);
    expect(rangi.currentActors(s)).toContain(2);
    const n = step(s, 2, play(twin));
    expect(n.turn).toBe(0); // play continues after seat 2
    const off = S({ hands: [filler(3), filler(3), [twin, c('sky', 8)]], cfg: { jumpIn: false } });
    expect(rangi.legalActions(off, 2)).toEqual([]);
  });
});

describe('scoring and rounds', () => {
  it('points: numbers face value, actions 20, wilds 50', () => {
    expect(cardPoints(c('leaf', 7))).toBe(7);
    expect(cardPoints(c('leaf', 'skip'))).toBe(20);
    expect(cardPoints(c('leaf', 'draw2'))).toBe(20);
    expect(cardPoints(c('wild', 'wild4'))).toBe(50);
  });
  it('going out scores everyone else’s hands and can end the game at the target', () => {
    const last = c('sindoor', 4);
    const s = S({
      hands: [[last], [c('leaf', 9), c('wild', 'wild')], [c('leaf', 'skip')]],
      cfg: { target: 0 },
    });
    const n = step(s, 0, play(last));
    expect(n.phase).toBe('over');
    expect(n.roundScores[0]).toEqual([9 + 50 + 20, 0, 0]);
    expect(rangi.result(n)!.winners).toEqual([0]);
    const multi = step(S({ hands: [[last], [c('leaf', 9)]], cfg: { target: 500 } }), 0, play(last));
    expect(multi.phase).toBe('roundEnd');
    const again = step(multi, 0, { type: 'next' });
    expect(again.round).toBe(1);
    expect(again.roundScores).toHaveLength(1);
    expect(again.hands.every((h) => h.length === 7)).toBe(true);
  });
});

describe('views and sim', () => {
  it('a view never contains other hands or the draw order', () => {
    const { state } = rangi.setup(makePlayers(4, createRng(1)), defaultConfig, createRng(9));
    const v = rangi.view(state, 0);
    const json = JSON.stringify(v);
    for (const card of state.hands[1])
      if (!state.hands[0].includes(card)) expect(json).not.toContain(`"id":${card.id},`);
    expect(json).not.toContain('"draw":[');
    expect(v.hand).toEqual(state.hands[0]);
  });
  it('sim: 150 random games with random house rules finish with 108 cards', () => {
    const r = simulate(rangi, { n: 150 });
    expect(r.failures).toEqual([]);
  }, 60000);
});
