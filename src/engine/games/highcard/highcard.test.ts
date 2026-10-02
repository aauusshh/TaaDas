import { describe, expect, it } from 'vitest';
import { createRng } from '../../core/rng';
import { IllegalActionError, defaultsFromSchema } from '../../core/types';
import { makePlayers, simulate } from '../../sim/simulate';
import { highCard } from './index';
import { LocalSession } from '../../../session/LocalSession';

const players = (n: number) => makePlayers(n, createRng(1));

describe('highcard', () => {
  it('rejects out-of-turn plays and cards not in hand', () => {
    const rng = createRng(3);
    const { state } = highCard.setup(players(3), highCard.defaultConfig, rng);
    expect(() => highCard.apply(state, 1, { cardId: state.hands[1][0].id }, rng)).toThrow(
      IllegalActionError,
    );
    expect(() => highCard.apply(state, 0, { cardId: 9999 }, rng)).toThrow(IllegalActionError);
  });
  it('view hides other hands', () => {
    const { state } = highCard.setup(players(3), highCard.defaultConfig, createRng(3));
    const v = highCard.view(state, 0);
    expect(v.hand).toEqual(state.hands[0]);
    expect(JSON.stringify(v)).not.toContain(JSON.stringify(state.hands[1][0]));
    expect(highCard.view(state, 'spectator').hand).toEqual([]);
  });
  it('defaults come from the schema', () => {
    expect(defaultsFromSchema(highCard.configSchema)).toEqual(highCard.defaultConfig);
  });
  it('sim: 300 random games finish with conserved cards', () => {
    const r = simulate(highCard, { n: 300 });
    expect(r.failures).toEqual([]);
  });
  it('LocalSession plays bots to the end and saves/restores', async () => {
    const saves: unknown[] = [];
    const ps = players(3);
    const s = new LocalSession({
      game: highCard,
      players: ps,
      config: highCard.defaultConfig,
      seed: 5,
      thinkMs: () => 0,
      onSave: (x) => saves.push(x),
    });
    const done = new Promise<void>((res) => {
      s.subscribe(() => s.result() && res());
    });
    s.start();
    await done;
    expect(s.result()!.winners.length).toBeGreaterThan(0);
    expect(saves.length).toBeGreaterThan(5);
    const snap = JSON.parse(JSON.stringify(s.snapshot()));
    const again = LocalSession.restore({ game: highCard, thinkMs: () => 0 }, snap);
    expect(again.result()).toEqual(s.result());
    s.dispose();
    again.dispose();
  });
});
