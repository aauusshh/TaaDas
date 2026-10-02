import { ev, filterEventsDefault, type GameEvent, type ViewerSeat } from '../../core/events';
import type { Rng } from '../../core/rng';
import {
  IllegalActionError,
  type Difficulty,
  type GameDefinition,
  type GameResult,
  type PlayerInfo,
  type Step,
} from '../../core/types';
import { configSchema, defaultConfig, presets, type LangurConfig } from './config';

export type { LangurConfig };

export type LBAction =
  /** set the stake on one symbol to exactly this amount (0 takes it back) */
  | { type: 'setBet'; symbol: number; amount: number }
  | { type: 'ready' }
  | { type: 'close' }
  | { type: 'roll' }
  | { type: 'next' };

export interface LBState {
  n: number;
  config: LangurConfig;
  humans: boolean[];
  levels: Difficulty[];
  banker: number;
  chips: number[];
  start: number[];
  phase: 'betting' | 'rolling' | 'summary' | 'over';
  /** stake per seat per symbol */
  bets: number[][];
  ready: boolean[];
  dice: number[] | null;
  /** net chips each seat won or lost in the latest roll */
  net: number[];
  history: { dice: number[]; counts: number[] }[];
  round: number;
  /** rounds played with the current banker */
  bankerRounds: number;
}

export interface LBView {
  seat: number | 'spectator';
  config: LangurConfig;
  n: number;
  banker: number;
  chips: number[];
  start: number[];
  phase: LBState['phase'];
  round: number;
  rounds: number;
  bets: number[][];
  staked: number[];
  ready: boolean[];
  dice: number[] | null;
  counts: number[] | null;
  net: number[];
  history: LBState['history'];
  canReady: boolean;
  canClose: boolean;
  canRoll: boolean;
  canNext: boolean;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const isBettor = (s: LBState, seat: number) => seat !== s.banker;

/** Total returned per unit staked when `count` dice show the symbol. */
export function returnsFor(count: number, cfg: LangurConfig): number {
  if (count <= 0) return 0;
  return (cfg as unknown as Record<string, number>)[`pay${Math.min(6, count)}`];
}

/** Net chips for one stake on one symbol: what comes back minus the stake. */
export function payoutFor(count: number, stake: number, cfg: LangurConfig): number {
  return stake * (returnsFor(count, cfg) - 1);
}

/** Why a stake cannot be set, or null when it is fine. */
export function stakeProblem(
  s: Pick<LBState, 'config' | 'chips' | 'bets'>,
  seat: number,
  symbol: number,
  amount: number,
): 'whole' | 'step' | 'min' | 'max' | 'chips' | null {
  const { step, minBet, maxBet } = s.config;
  if (!Number.isInteger(amount) || amount < 0) return 'whole';
  if (amount === 0) return null;
  if (amount % step !== 0) return 'step';
  if (amount < minBet) return 'min';
  if (amount > maxBet) return 'max';
  const others = sum(s.bets[seat]) - s.bets[seat][symbol];
  if (others + amount > s.chips[seat]) return 'chips';
  return null;
}

export function settle(
  bets: number[][],
  dice: number[],
  banker: number,
  cfg: LangurConfig,
): { net: number[]; counts: number[] } {
  const counts = [0, 0, 0, 0, 0, 0];
  for (const d of dice) counts[d]++;
  const net = bets.map((row, seat) => {
    if (seat === banker) return 0;
    return row.reduce(
      (t, stake, sym) => (stake > 0 ? t + payoutFor(counts[sym], stake, cfg) : t),
      0,
    );
  });
  net[banker] = -sum(net);
  return { net, counts };
}

function bankerFor(cfg: LangurConfig, n: number) {
  return cfg.houseBanks ? n - 1 : 0;
}

function actionsFor(s: LBState, seat: number): LBAction[] {
  const out: LBAction[] = [];
  if (s.phase === 'betting') {
    if (isBettor(s, seat) && !s.ready[seat]) {
      // any stake is legal when stakeProblem allows it; the list only names the take-backs
      for (let sym = 0; sym < 6; sym++)
        if (s.bets[seat][sym] > 0) out.push({ type: 'setBet', symbol: sym, amount: 0 });
      out.push({ type: 'ready' });
    }
    if (seat === s.banker && s.humans[seat]) out.push({ type: 'close' });
  } else if (s.phase === 'rolling') {
    if (seat === s.banker) out.push({ type: 'roll' });
  } else if (s.phase === 'summary') {
    if (s.humans[seat] || !s.humans.some(Boolean)) out.push({ type: 'next' });
  }
  return out;
}

function startRound(s: LBState): GameEvent[] {
  s.phase = 'betting';
  s.bets = Array.from({ length: s.n }, () => Array(6).fill(0));
  s.ready = Array.from({ length: s.n }, (_, i) => i === s.banker);
  s.dice = null;
  s.net = Array(s.n).fill(0);
  return [ev.note('roundStart', { round: s.round, banker: s.banker })];
}

function setup(players: PlayerInfo[], config: LangurConfig): Step<LBState> {
  if (players.length < 2 || players.length > 11)
    throw new Error('Langur Burja needs 2 to 11 players');
  const cfg = { ...defaultConfig, ...config };
  const n = players.length;
  const s: LBState = {
    n,
    config: cfg,
    humans: players.map((p) => !p.isBot),
    levels: players.map((p) => p.difficulty),
    banker: bankerFor(cfg, n),
    chips: Array(n).fill(cfg.startChips),
    start: Array(n).fill(cfg.startChips),
    phase: 'betting',
    bets: [],
    ready: [],
    dice: null,
    net: Array(n).fill(0),
    history: [],
    round: 0,
    bankerRounds: 0,
  };
  const events = startRound(s);
  return { state: s, events };
}

function currentActors(s: LBState): number[] {
  if (s.phase === 'over') return [];
  if (s.phase === 'betting') {
    const out: number[] = [];
    for (let i = 0; i < s.n; i++) if (isBettor(s, i) && !s.ready[i]) out.push(i);
    if (s.humans[s.banker]) out.unshift(s.banker);
    return out;
  }
  if (s.phase === 'rolling') return [s.banker];
  const hs = Array.from({ length: s.n }, (_, i) => i).filter((i) => s.humans[i]);
  return hs.length ? hs : [s.banker];
}

function closeBetting(s: LBState, events: GameEvent[]) {
  s.ready = s.ready.map(() => true);
  s.phase = 'rolling';
  events.push(ev.note('close'));
}

function apply(state: LBState, seat: number, a: LBAction, rng: Rng): Step<LBState> {
  const s: LBState = {
    ...state,
    chips: state.chips.slice(),
    bets: state.bets.map((r) => r.slice()),
    ready: state.ready.slice(),
    history: state.history,
  };
  const legal = actionsFor(s, seat);
  const events: GameEvent[] = [];
  if (a.type === 'setBet') {
    const open = s.phase === 'betting' && isBettor(s, seat) && !s.ready[seat];
    const sym = Number(a.symbol);
    if (!open || !Number.isInteger(sym) || sym < 0 || sym > 5)
      throw new IllegalActionError('illegal action');
    const why = stakeProblem(s, seat, sym, a.amount);
    if (why) throw new IllegalActionError(`stake: ${why}`);
    s.bets[seat][sym] = a.amount;
    events.push(ev.note('bet', { symbol: sym, amount: a.amount }, seat));
    return { state: s, events };
  }
  if (!legal.some((x) => x.type === a.type)) throw new IllegalActionError('illegal action');

  switch (a.type) {
    case 'ready':
      s.ready[seat] = true;
      events.push(ev.note('ready', undefined, seat));
      if (s.ready.every(Boolean)) closeBetting(s, events);
      return { state: s, events };
    case 'close':
      closeBetting(s, events);
      return { state: s, events };
    case 'roll': {
      // the host's rng decides, and only now that betting is closed
      const dice = Array.from({ length: 6 }, () => rng.int(6));
      const { net, counts } = settle(s.bets, dice, s.banker, s.config);
      s.chips = s.chips.map((c, i) => c + net[i]);
      s.dice = dice;
      s.net = net;
      s.history = [...s.history, { dice, counts }].slice(-20);
      s.phase = s.round + 1 >= s.config.rounds ? 'over' : 'summary';
      events.push(ev.note('roll', { dice, counts }, seat));
      events.push(ev.note('payout', { net }));
      if (s.phase === 'over') events.push(ev.note('gameEnd'));
      return { state: s, events };
    }
    case 'next': {
      s.round += 1;
      s.bankerRounds += 1;
      if (s.config.bankerRotate > 0 && s.bankerRounds >= s.config.bankerRotate) {
        s.banker = (s.banker + 1) % s.n;
        s.bankerRounds = 0;
        events.push(ev.note('banker', undefined, s.banker));
      }
      events.push(...startRound(s));
      return { state: s, events };
    }
  }
}

function view(s: LBState, seat: ViewerSeat): LBView {
  const legal = seat === 'spectator' ? [] : actionsFor(s, seat);
  return {
    seat,
    config: s.config,
    n: s.n,
    banker: s.banker,
    chips: s.chips,
    start: s.start,
    phase: s.phase,
    round: s.round,
    rounds: s.config.rounds,
    bets: s.bets,
    staked: s.bets.map(sum),
    ready: s.ready,
    dice: s.dice,
    counts: s.dice ? (s.history[s.history.length - 1]?.counts ?? null) : null,
    net: s.net,
    history: s.history,
    canReady: legal.some((a) => a.type === 'ready'),
    canClose: legal.some((a) => a.type === 'close'),
    canRoll: legal.some((a) => a.type === 'roll'),
    canNext: legal.some((a) => a.type === 'next'),
  };
}

function result(s: LBState): GameResult | null {
  if (s.phase !== 'over') return null;
  const delta = s.chips.map((c, i) => c - s.start[i]);
  const max = Math.max(...delta);
  return {
    scores: s.chips.slice(),
    winners: delta.flatMap((d, i) => (d === max ? [i] : [])),
    chipDelta: delta,
  };
}

/** Small random bets on one to three symbols; sometimes follow the most frequent recent symbol. */
function bot(v: LBView, legal: LBAction[], level: Difficulty, rng: Rng): LBAction {
  const first = legal[0];
  if (!first) throw new Error('bot has no legal action');
  const find = (t: LBAction['type']) => legal.find((a) => a.type === t);
  if (find('next')) return find('next')!;
  if (find('roll')) return find('roll')!;
  if (find('close') && !find('ready')) return find('close')!;
  const me = v.seat as number;
  const mine = v.bets[me];
  const { minBet, maxBet, step } = v.config;
  const left = v.chips[me] - mine.reduce((x, y) => x + y, 0);

  const placed = mine.filter((b) => b > 0).length;
  const want = 1 + ((v.round + me) % 3);
  if (placed < want && left >= minBet) {
    const recent = v.history.slice(-5);
    const totals = [0, 0, 0, 0, 0, 0];
    for (const h of recent) h.counts.forEach((c, i) => (totals[i] += c));
    const follow = level !== 'easy' && recent.length > 0 && (v.round + me) % 3 === 0;
    const hot = totals.indexOf(Math.max(...totals));
    const fresh = [0, 1, 2, 3, 4, 5].filter((i) => mine[i] === 0);
    const sym = follow && fresh.includes(hot) ? hot : rng.pick(fresh);
    // a small stake: one to four times the minimum, kept on the step and inside the limits
    const cap = Math.min(maxBet, left, minBet * 4);
    const units = Math.max(1, Math.floor(cap / step));
    let amount = (1 + rng.int(units)) * step;
    if (amount < minBet) amount = Math.ceil(minBet / step) * step;
    if (amount <= cap) return { type: 'setBet', symbol: sym, amount };
  }
  return find('ready') ?? first;
}

export const langurBurja: GameDefinition<LBState, LBAction, LangurConfig, LBView> = {
  id: 'langurburja',
  nameKey: 'game.langurburja',
  minPlayers: 2,
  maxPlayers: 11,
  supports: { bots: true, passAndPlay: true, online: true },
  defaultConfig,
  configSchema,
  presets,
  sharedScreen: true,
  modeConfig: (mode) => ({ houseBanks: mode === 'bots' }),
  setup: (players, config) => setup(players, config),
  currentActors,
  legalActions: actionsFor,
  apply,
  view,
  filterEvents: filterEventsDefault,
  timerSeats: (s) =>
    s.phase === 'betting'
      ? Array.from({ length: s.n }, (_, i) => i).filter(
          (i) => isBettor(s, i) && !s.ready[i] && s.humans[i],
        )
      : s.phase === 'rolling'
        ? [s.banker]
        : [],
  timeoutAction(s, seat) {
    if (s.phase === 'betting') {
      const ready = actionsFor(s, seat).find((a) => a.type === 'ready');
      return ready ?? { type: 'close' };
    }
    if (s.phase === 'rolling') return { type: 'roll' };
    return { type: 'next' };
  },
  result,
  isPlayPhase: (s) => s.phase === 'betting' || s.phase === 'rolling',
  bot,
  invariants(s) {
    if (sum(s.chips) !== sum(s.start)) return 'langurburja: chips not conserved';
    return null;
  },
};
