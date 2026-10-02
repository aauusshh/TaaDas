import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRng } from '../engine/core/rng';
import { highCard } from '../engine/games/highcard';
import { makePlayers } from '../engine/sim/simulate';
import { applyDailyTopUp, TOP_UP_TO } from '../storage/profile';
import { recordResult } from '../storage/stats';
import { LocalSession } from './LocalSession';

const humanFirst = () => {
  const ps = makePlayers(3, createRng(1));
  ps[0].isBot = false;
  return ps;
};

describe('LocalSession turn timer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('plays the timeout action, and puts the seat on Auto after two timeouts in a row', () => {
    const s = new LocalSession({
      game: highCard,
      players: humanFirst(),
      config: { rounds: 3, aceHigh: true },
      seed: 3,
      thinkMs: () => 0,
      timerSec: 10,
    });
    s.start();
    expect(s.getTimer(0)?.totalMs).toBe(10000);
    const v0 = s.getVersion();
    vi.advanceTimersByTime(10);
    vi.advanceTimersByTime(10000);
    expect(s.getVersion()).toBeGreaterThan(v0);
    expect(s.isAuto(0)).toBe(false);
    // bots reply, then it is seat 0 again
    vi.advanceTimersByTime(10);
    vi.advanceTimersByTime(10050);
    expect(s.isAuto(0)).toBe(true);
    s.setAuto(0, false);
    expect(s.isAuto(0)).toBe(false);
    s.dispose();
  });

  it('a manual move resets the timeout streak', () => {
    const s = new LocalSession({
      game: highCard,
      players: humanFirst(),
      config: { rounds: 4, aceHigh: true },
      seed: 3,
      thinkMs: () => 0,
      timerSec: 10,
    });
    s.start();
    vi.advanceTimersByTime(10000); // timeout #1
    vi.advanceTimersByTime(10);
    const legal = s.legalActions(0) as { cardId: number }[];
    s.submit(0, legal[0]); // human plays
    vi.advanceTimersByTime(10);
    vi.advanceTimersByTime(10050); // timeout again, but streak was reset
    expect(s.isAuto(0)).toBe(false);
    s.dispose();
  });

  it('pausing keeps the remaining time', () => {
    const s = new LocalSession({
      game: highCard,
      players: humanFirst(),
      config: { rounds: 3, aceHigh: true },
      seed: 3,
      thinkMs: () => 0,
      timerSec: 10,
    });
    s.start();
    vi.advanceTimersByTime(4000);
    s.pause();
    vi.advanceTimersByTime(20000);
    expect(s.getVersion()).toBe(0);
    expect(Math.round(s.getTimer(0)!.remainingMs / 1000)).toBe(6);
    s.resume();
    vi.advanceTimersByTime(6000);
    expect(s.getVersion()).toBeGreaterThan(0);
    s.dispose();
  });
});

describe('profile and stats', () => {
  it('tops up to 5000 once per day when below', () => {
    const p = { name: 'a', avatar: 'yak', chips: 120, lastTopUp: '2026-01-01', names: [] };
    const next = applyDailyTopUp(p, '2026-01-02');
    expect(next.chips).toBe(TOP_UP_TO);
    expect(applyDailyTopUp({ ...next, chips: 10 }, '2026-01-02').chips).toBe(10);
    expect(applyDailyTopUp({ ...p, chips: 9000 }, '2026-01-02').chips).toBe(9000);
  });
  it('records played and won', () => {
    let all = recordResult({}, 'callbreak', true);
    all = recordResult(all, 'callbreak', false);
    expect(all.callbreak).toEqual({ played: 2, wins: 1 });
  });
});
