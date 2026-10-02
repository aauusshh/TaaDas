import { createRng, type Rng } from '../core/rng';
import {
  randomConfig,
  type AnyGame,
  type Difficulty,
  type GameConfig,
  type PlayerInfo,
} from '../core/types';

export interface SimOptions {
  n: number;
  seed?: number;
  /** safety cap on actions per game */
  maxSteps?: number;
  /** override config (otherwise random from the schema) */
  config?: GameConfig;
  players?: number;
}

export interface SimReport {
  game: string;
  games: number;
  failures: { index: number; seed: number; error: string }[];
  avgSteps: number;
  maxSteps: number;
  winnerBySeat: number[];
  ms: number;
}

const DIFFS: Difficulty[] = ['easy', 'medium', 'hard'];

export function makePlayers(n: number, rng: Rng): PlayerInfo[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i}`,
    name: `Bot ${i + 1}`,
    avatar: 'yak',
    isBot: true,
    difficulty: rng.pick(DIFFS),
  }));
}

/** Plays one full game with bots only. Throws on any engine problem. */
export function playOneGame(
  game: AnyGame,
  players: PlayerInfo[],
  config: GameConfig,
  seed: number,
  maxSteps = 20000,
): { steps: number; winners: number[] } {
  const rng = createRng(seed);
  let { state } = game.setup(players, config, rng);
  const check = () => {
    const bad = game.invariants?.(state);
    if (bad) throw new Error(`invariant: ${bad}`);
  };
  check();
  let steps = 0;
  while (game.result(state) === null) {
    if (steps++ > maxSteps) throw new Error('game did not end within step cap');
    const actors = game.currentActors(state);
    if (actors.length === 0) throw new Error('no actors but game not finished');
    const seat = actors[rng.int(actors.length)];
    const legal = game.legalActions(state, seat);
    if (legal.length === 0) throw new Error(`seat ${seat} has no legal actions`);
    const action = game.bot(game.view(state, seat), legal, players[seat].difficulty, rng);
    state = game.apply(state, seat, action, rng).state;
    check();
  }
  return { steps, winners: game.result(state)!.winners };
}

export function simulate(game: AnyGame, opts: SimOptions): SimReport {
  const t0 = Date.now();
  const seed0 = opts.seed ?? 1;
  const report: SimReport = {
    game: game.id,
    games: opts.n,
    failures: [],
    avgSteps: 0,
    maxSteps: 0,
    winnerBySeat: Array(game.maxPlayers).fill(0),
    ms: 0,
  };
  let totalSteps = 0;
  for (let i = 0; i < opts.n; i++) {
    const seed = seed0 + i;
    const rng = createRng(seed * 7919);
    const count = opts.players ?? rng.range(game.minPlayers, game.maxPlayers);
    const config = opts.config ?? randomConfig(game.configSchema, rng);
    try {
      const { steps, winners } = playOneGame(game, makePlayers(count, rng), config, seed);
      totalSteps += steps;
      report.maxSteps = Math.max(report.maxSteps, steps);
      for (const w of winners) report.winnerBySeat[w]++;
    } catch (e) {
      report.failures.push({
        index: i,
        seed,
        error: `${(e as Error).message} (players=${count}, config=${JSON.stringify(config)})`,
      });
    }
  }
  report.avgSteps = Math.round(totalSteps / Math.max(1, opts.n - report.failures.length));
  report.ms = Date.now() - t0;
  return report;
}
