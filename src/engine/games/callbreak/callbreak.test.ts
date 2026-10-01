import { describe, expect, it } from 'vitest';
import type { Card, Rank, Suit } from '../../core/cards';
import { createRng } from '../../core/rng';
import { makePlayers, simulate } from '../../sim/simulate';
import { callBreak } from './index';
import { defaultConfig, type CallBreakConfig } from './config';
import { handOk, legalCards, scoreRound, trickWinner } from './rules';
import { estimateBid } from './bot';

let id = 0;
const c = (suit: Suit, rank: Rank): Card => ({ id: id++, suit, rank, copy: 0 });
const play = (seat: number, card: Card) => ({ seat, card });
const cfg = defaultConfig;
const ids = (cs: Card[]) => cs.map((x) => `${x.suit}${x.rank}`).sort();

describe('callbreak legality', () => {
  it('must beat the highest card of the led suit when possible', () => {
    const hand = [c('H', 3), c('H', 9), c('H', 12), c('D', 2)];
    const trick = [play(1, c('H', 8))];
    expect(ids(legalCards(hand, trick, cfg))).toEqual(['H12', 'H9']);
  });
  it('follows suit with any card when it cannot beat', () => {
    const hand = [c('H', 3), c('H', 4), c('D', 2)];
    expect(ids(legalCards(hand, [play(1, c('H', 12))], cfg))).toEqual(['H3', 'H4']);
  });
  it('no overtake needed once a spade has trumped the led suit', () => {
    const hand = [c('H', 3), c('H', 13), c('D', 2)];
    const trick = [play(1, c('H', 8)), play(2, c('S', 2))];
    expect(ids(legalCards(hand, trick, cfg))).toEqual(['H13', 'H3']);
  });
  it('must trump when void in the led suit', () => {
    const hand = [c('D', 3), c('S', 4), c('S', 9)];
    expect(ids(legalCards(hand, [play(1, c('H', 8))], cfg))).toEqual(['S4', 'S9']);
  });
  it('must overtrump when possible', () => {
    const hand = [c('D', 3), c('S', 4), c('S', 9)];
    const trick = [play(1, c('H', 8)), play(2, c('S', 6))];
    expect(ids(legalCards(hand, trick, cfg))).toEqual(['S9']);
  });
  it('still plays a spade when it cannot overtrump, unless the option is off', () => {
    const hand = [c('D', 3), c('S', 4), c('S', 5)];
    const trick = [play(1, c('H', 8)), play(2, c('S', 11))];
    expect(ids(legalCards(hand, trick, cfg))).toEqual(['S4', 'S5']);
    expect(legalCards(hand, trick, { mustTrumpWhenCantBeat: false })).toHaveLength(3);
  });
  it('void in led suit and no spades: anything', () => {
    const hand = [c('D', 3), c('C', 4)];
    expect(legalCards(hand, [play(1, c('H', 8))], cfg)).toHaveLength(2);
  });
  it('trick winner: highest spade, else highest of the led suit', () => {
    expect(
      trickWinner([
        play(0, c('H', 13)),
        play(1, c('S', 2)),
        play(2, c('H', 1)),
        play(3, c('D', 1)),
      ]),
    ).toBe(1);
    expect(
      trickWinner([
        play(0, c('H', 13)),
        play(1, c('H', 1)),
        play(2, c('D', 1)),
        play(3, c('H', 2)),
      ]),
    ).toBe(1);
  });
});

describe('callbreak scoring and dealing', () => {
  it('made, extra tricks, failed', () => {
    expect(scoreRound(4, 4, cfg)).toBe(4);
    expect(scoreRound(4, 6, cfg)).toBe(4.2);
    expect(scoreRound(4, 3, cfg)).toBe(-4);
  });
  it('8+ option scores 13', () => {
    const o: CallBreakConfig = { ...cfg, bonusBid8: true };
    expect(scoreRound(8, 8, o)).toBe(13);
    expect(scoreRound(7, 7, o)).toBe(7);
    expect(scoreRound(8, 7, o)).toBe(-8);
  });
  it('redeal rule detects hands with no spade / no face card', () => {
    const noSpade = [c('H', 2), c('D', 3)];
    expect(handOk(noSpade, cfg)).toBe(false);
    expect(handOk(noSpade, { ...cfg, redealNoSpade: false })).toBe(true);
    const lowSpades = [c('S', 2), c('H', 3)];
    expect(handOk(lowSpades, { ...cfg, redealNoFace: true })).toBe(false);
  });
  it('dealt hands always contain a spade when redeal is on', () => {
    for (let seed = 1; seed < 60; seed++) {
      const { state } = callBreak.setup(makePlayers(4, createRng(1)), cfg, createRng(seed));
      expect(state.hands.every((h) => h.some((x) => x.suit === 'S'))).toBe(true);
      expect(state.hands.every((h) => h.length === 13)).toBe(true);
    }
  });
  it('bid estimate is at least 1 and never above max', () => {
    expect(estimateBid([c('H', 2), c('D', 3)], 13)).toBe(1);
    const big = Array.from({ length: 13 }, (_, i) => c('S', (i + 1) as Rank));
    expect(estimateBid(big, 8)).toBe(8);
  });
});

describe('callbreak flow', () => {
  it('lead passes to the trick winner and a bad action throws', () => {
    const rng = createRng(11);
    const players = makePlayers(4, rng);
    let { state } = callBreak.setup(players, cfg, rng);
    for (let i = 0; i < 4; i++)
      state = callBreak.apply(state, state.turn, { type: 'bid', bid: 2 }, rng).state;
    expect(state.phase).toBe('playing');
    expect(() =>
      callBreak.apply(state, (state.turn + 1) % 4, { type: 'bid', bid: 2 }, rng),
    ).toThrow();
    for (let i = 0; i < 4; i++) {
      const seat = state.turn;
      const a = callBreak.legalActions(state, seat)[0];
      state = callBreak.apply(state, seat, a, rng).state;
    }
    expect(state.trick).toHaveLength(0);
    expect(state.turn).toBe(state.lastWinner);
    expect(state.leader).toBe(state.lastWinner);
  });
  it('views never expose other hands', () => {
    const { state } = callBreak.setup(makePlayers(4, createRng(2)), cfg, createRng(3));
    const v = callBreak.view(state, 0);
    const other = JSON.stringify(state.hands[1]);
    expect(JSON.stringify(v)).not.toContain(other);
  });
  it('sim: 500 random games finish, cards conserved', () => {
    const r = simulate(callBreak, { n: 500, players: 4 });
    expect(r.failures).toEqual([]);
  });
});
