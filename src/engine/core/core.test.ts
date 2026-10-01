import { describe, expect, it } from 'vitest';
import { createRng, restoreRng } from './rng';
import { makeDeck, dealRoundRobin, shuffledDeck } from './deck';
import { filterEventsDefault, ev } from './events';
import { nextSeat, orderFrom } from './seats';
import { cardLabel, rankAceHigh } from './cards';

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });
  it('can be saved and restored mid-stream', () => {
    const a = createRng('hello');
    a.next();
    a.next();
    const b = restoreRng(a.getState());
    expect(a.next()).toBe(b.next());
    expect(a.int(100)).toBe(b.int(100));
  });
  it('int stays in range and shuffle is a permutation', () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
    }
    const out = r.shuffle([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort()).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it('shuffle is roughly uniform on first position', () => {
    const r = createRng(99);
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < 4000; i++) counts[r.shuffle([0, 1, 2, 3])[0]]++;
    for (const c of counts) expect(Math.abs(c - 1000)).toBeLessThan(150);
  });
});

describe('deck', () => {
  it('has 52 unique cards, and unique ids across 3 decks with jokers', () => {
    expect(makeDeck()).toHaveLength(52);
    const d = makeDeck({ decks: 3, jokersPerDeck: 2 });
    expect(d).toHaveLength(3 * 54);
    expect(new Set(d.map((c) => c.id)).size).toBe(d.length);
  });
  it('deals round robin and conserves cards', () => {
    const deck = shuffledDeck(createRng(1));
    const { hands, rest } = dealRoundRobin(deck, 4, 13);
    expect(hands.every((h) => h.length === 13)).toBe(true);
    expect(rest).toHaveLength(0);
    expect(new Set(hands.flat().map((c) => c.id)).size).toBe(52);
  });
  it('labels and ace-high', () => {
    const ace = makeDeck()[0];
    expect(cardLabel(ace)).toBe('AS');
    expect(rankAceHigh(ace)).toBe(14);
  });
});

describe('events', () => {
  it('hides private cards from other seats but not from the owner or public events', () => {
    const cards = makeDeck().slice(0, 3);
    const events = [
      ev.deal(1, cards),
      ev.move(cards.slice(0, 1), { kind: 'hand', seat: 1 }, { kind: 'trick', seat: 1 }),
    ];
    const forOwner = filterEventsDefault(events, 1);
    const forOther = filterEventsDefault(events, 2);
    expect(forOwner[0].cards).toHaveLength(3);
    expect(forOther[0].cards).toBeUndefined();
    expect(forOther[0].count).toBe(3);
    expect(forOther[1].cards).toHaveLength(1);
    expect(filterEventsDefault(events, 'spectator')[0].cards).toBeUndefined();
  });
});

describe('seats', () => {
  it('counter-clockwise by default', () => {
    expect(nextSeat(0, 4)).toBe(3);
    expect(nextSeat(0, 4, 'cw')).toBe(1);
    expect(orderFrom(1, 4)).toEqual([0, 3, 2, 1]);
  });
});
