import type { Card } from '../../core/cards';
import { shuffledDeck } from '../../core/deck';
import { ev, filterEventsDefault, type GameEvent, type ViewerSeat } from '../../core/events';
import type { Rng } from '../../core/rng';
import { nextSeat } from '../../core/seats';
import {
  IllegalActionError,
  type Difficulty,
  type GameDefinition,
  type GameResult,
  type PlayerInfo,
  type Step,
} from '../../core/types';
import { configSchema, defaultConfig, presets, type InBetweenConfig } from './config';

export type { InBetweenConfig };

export type IBAction =
  | { type: 'ace'; high: boolean }
  | { type: 'bet'; amount: number }
  | { type: 'guess'; high: boolean; amount: number }
  | { type: 'pass' }
  | { type: 'next' };

export interface IBResult {
  seat: number;
  bet: number;
  third: Card;
  outcome: 'win' | 'lose' | 'double' | 'pass' | 'noGap';
  /** chips moved for the player (positive wins) */
  net: number;
}

export interface IBState {
  n: number;
  config: InBetweenConfig;
  humans: boolean[];
  levels: Difficulty[];
  deck: Card[];
  used: Card[];
  chips: number[];
  start: number[];
  pot: number;
  turn: number;
  /** completed turns */
  turns: number;
  posts: [Card, Card] | null;
  aceHigh: boolean | null;
  phase: 'ace' | 'bet' | 'guess' | 'result' | 'over';
  last: IBResult | null;
}

export interface IBView {
  seat: number | 'spectator';
  config: InBetweenConfig;
  n: number;
  chips: number[];
  start: number[];
  pot: number;
  turn: number;
  turns: number;
  totalTurns: number;
  posts: [Card, Card] | null;
  /** post values after any ace choice, null until known */
  values: [number, number] | null;
  deckCount: number;
  phase: IBState['phase'];
  last: IBResult | null;
  minBet: number;
  maxBet: number;
  canAce: boolean;
  canBet: boolean;
  canGuess: boolean;
  canPass: boolean;
  canNext: boolean;
}

const next = (s: Pick<IBState, 'n' | 'config'>, seat: number) =>
  nextSeat(seat, s.n, s.config.direction);

/** Rank value with Ace high (14) or low (1). */
const val = (c: Card, aceHigh: boolean) => (c.rank === 1 ? (aceHigh ? 14 : 1) : c.rank);

function postValues(s: IBState): [number, number] | null {
  if (!s.posts) return null;
  const [a, b] = s.posts;
  const ah = s.config.aceHigh ? true : s.aceHigh;
  if (a.rank === 1 && ah === null) return null;
  return [val(a, ah ?? true), val(b, true)];
}

const gapOf = (v: [number, number]) => Math.abs(v[0] - v[1]) - 1;

function totalTurns(s: Pick<IBState, 'n' | 'config'>) {
  return s.config.rounds * s.n;
}

function seatsWithChips(s: IBState) {
  return Array.from({ length: s.n }, (_, i) => i).filter((i) => s.chips[i] >= s.config.ante);
}

function maxBet(s: IBState, seat: number) {
  return Math.min(s.pot, s.chips[seat]);
}

function drawCard(s: IBState, rng: Rng, events: GameEvent[]): Card {
  if (s.deck.length < 3) {
    s.deck = rng.shuffle([...s.deck, ...s.used]);
    s.used = [];
    events.push(ev.note('reshuffle', { count: s.deck.length }));
  }
  return s.deck.pop()!;
}

/** Everybody antes when the pot is empty. */
function anteUp(s: IBState, events: GameEvent[]) {
  if (s.pot > 0) return;
  for (const i of seatsWithChips(s)) {
    s.chips[i] -= s.config.ante;
    s.pot += s.config.ante;
  }
  events.push(ev.note('ante', { amount: s.config.ante, pot: s.pot }));
}

/**
 * Deal the posts for the next player who has chips. Posts with no gap are passed over
 * automatically (at no cost) unless equal posts may be guessed.
 */
function startTurn(s: IBState, rng: Rng, events: GameEvent[]) {
  for (let guard = 0; guard < 4 * s.n + 8; guard++) {
    if (s.turns >= totalTurns(s) || seatsWithChips(s).length < 2) {
      s.phase = 'over';
      s.posts = null;
      events.push(ev.note('gameEnd'));
      return;
    }
    while (s.chips[s.turn] <= 0) s.turn = next(s, s.turn);
    anteUp(s, events);
    if (s.pot === 0) {
      s.phase = 'over';
      events.push(ev.note('gameEnd'));
      return;
    }
    const a = drawCard(s, rng, events);
    const b = drawCard(s, rng, events);
    s.posts = [a, b];
    s.aceHigh = s.config.aceHigh ? true : null;
    events.push({
      type: 'posts',
      seat: s.turn,
      cards: [a, b],
      from: { kind: 'deck' },
      to: { kind: 'table' },
    });
    if (a.rank === 1 && !s.config.aceHigh) {
      s.phase = 'ace';
      return;
    }
    const v = postValues(s)!;
    const g = gapOf(v);
    if (g >= 1) {
      s.phase = 'bet';
      return;
    }
    if (g === -1 && s.config.equalPosts === 'guess') {
      s.phase = 'guess';
      return;
    }
    // consecutive or equal posts: no gap, the turn is passed at no cost
    events.push(ev.note('noGap', undefined, s.turn));
    s.used.push(a, b);
    s.turns += 1;
    s.turn = next(s, s.turn);
  }
}

function setup(players: PlayerInfo[], config: InBetweenConfig, rng: Rng): Step<IBState> {
  if (players.length < 2 || players.length > 8) throw new Error('In Between needs 2 to 8 players');
  const cfg = { ...defaultConfig, ...config };
  const n = players.length;
  const s: IBState = {
    n,
    config: cfg,
    humans: players.map((p) => !p.isBot),
    levels: players.map((p) => p.difficulty),
    deck: shuffledDeck(rng),
    used: [],
    chips: Array(n).fill(cfg.startChips),
    start: Array(n).fill(cfg.startChips),
    pot: 0,
    turn: rng.int(n),
    turns: 0,
    posts: null,
    aceHigh: null,
    phase: 'bet',
    last: null,
  };
  const events: GameEvent[] = [ev.note('roundStart', { round: 0 })];
  startTurn(s, rng, events);
  return { state: s, events };
}

function betAmounts(s: IBState, seat: number): number[] {
  const cap = maxBet(s, seat);
  const min = Math.min(s.config.minBet, cap);
  if (cap < 1) return [];
  const out = new Set<number>();
  for (let v = s.config.minBet; v <= cap; v += s.config.minBet) out.add(v);
  out.add(cap);
  if (out.size === 0) out.add(min);
  return [...out].sort((a, b) => a - b);
}

function legalActions(s: IBState, seat: number): IBAction[] {
  if (s.phase === 'over') return [];
  if (s.phase === 'result')
    return s.humans[seat] || !s.humans.some(Boolean) ? [{ type: 'next' }] : [];
  if (seat !== s.turn) return [];
  if (s.phase === 'ace')
    return [
      { type: 'ace', high: true },
      { type: 'ace', high: false },
    ];
  const out: IBAction[] = [];
  if (s.phase === 'bet')
    for (const amount of betAmounts(s, seat)) out.push({ type: 'bet', amount });
  if (s.phase === 'guess')
    for (const amount of betAmounts(s, seat)) {
      out.push({ type: 'guess', high: true, amount }, { type: 'guess', high: false, amount });
    }
  out.push({ type: 'pass' });
  return out;
}

function finishTurn(s: IBState, res: IBResult, rng: Rng, events: GameEvent[]) {
  const drawn = res.outcome === 'win' || res.outcome === 'lose' || res.outcome === 'double';
  s.used.push(...s.posts!, ...(drawn ? [res.third] : []));
  s.posts = null;
  s.last = res;
  s.turns += 1;
  s.turn = next(s, s.turn);
  startTurn(s, rng, events);
}

function apply(state: IBState, seat: number, a: IBAction, rng: Rng): Step<IBState> {
  const s: IBState = {
    ...state,
    deck: state.deck.slice(),
    used: state.used.slice(),
    chips: state.chips.slice(),
  };
  const events: GameEvent[] = [];
  if (a.type === 'next') {
    if (s.phase !== 'result') throw new IllegalActionError('not between turns');
    return { state: s, events };
  }
  if (seat !== s.turn || s.phase === 'over') throw new IllegalActionError('not your turn');

  if (a.type === 'ace') {
    if (s.phase !== 'ace') throw new IllegalActionError('no ace to place');
    s.aceHigh = a.high;
    events.push(ev.note('aceChoice', { high: a.high }, seat));
    const v = postValues(s)!;
    const g = gapOf(v);
    if (g >= 1) s.phase = 'bet';
    else if (g === -1 && s.config.equalPosts === 'guess') s.phase = 'guess';
    else {
      events.push(ev.note('noGap', undefined, seat));
      const third = s.posts![1];
      finishTurn(s, { seat, bet: 0, third, outcome: 'noGap', net: 0 }, rng, events);
    }
    return { state: s, events };
  }

  if (a.type === 'pass') {
    if (s.phase !== 'bet' && s.phase !== 'guess') throw new IllegalActionError('cannot pass now');
    events.push(ev.note('pass', undefined, seat));
    const third = s.posts![1];
    finishTurn(s, { seat, bet: 0, third, outcome: 'pass', net: 0 }, rng, events);
    return { state: s, events };
  }

  const isGuess = a.type === 'guess';
  if ((isGuess && s.phase !== 'guess') || (!isGuess && s.phase !== 'bet'))
    throw new IllegalActionError('wrong kind of bet');
  const bet = a.amount;
  if (
    !Number.isInteger(bet) ||
    bet < Math.min(s.config.minBet, maxBet(s, seat)) ||
    bet > maxBet(s, seat) ||
    bet < 1
  )
    throw new IllegalActionError('bet out of range');

  const third = drawCard(s, rng, events);
  events.push({
    type: 'third',
    seat,
    cards: [third],
    from: { kind: 'deck' },
    to: { kind: 'table' },
    data: { bet },
  });
  const v = postValues(s)!;
  const t = val(third, s.aceHigh ?? true);
  let outcome: IBResult['outcome'];
  let net: number;
  if (isGuess) {
    const post = v[0];
    if (t === post) {
      outcome = 'double';
      net = -Math.min(2 * bet, s.chips[seat]);
    } else if (t > post === a.high) {
      outcome = 'win';
      net = bet;
    } else {
      outcome = 'lose';
      net = -bet;
    }
  } else {
    const lo = Math.min(v[0], v[1]);
    const hiV = Math.max(v[0], v[1]);
    if (t > lo && t < hiV) {
      outcome = 'win';
      net = bet;
    } else if (t === lo || t === hiV) {
      outcome = 'double';
      net = -Math.min(2 * bet, s.chips[seat]);
    } else {
      outcome = 'lose';
      net = -bet;
    }
  }
  s.chips[seat] += net;
  s.pot -= net;
  events.push(ev.note('result', { outcome, net, bet }, seat));
  finishTurn(s, { seat, bet, third, outcome, net }, rng, events);
  return { state: s, events };
}

function view(s: IBState, seat: ViewerSeat): IBView {
  const legal = seat === 'spectator' ? [] : legalActions(s, seat);
  const amounts = legal.flatMap((x) => (x.type === 'bet' || x.type === 'guess' ? [x.amount] : []));
  return {
    seat,
    config: s.config,
    n: s.n,
    chips: s.chips,
    start: s.start,
    pot: s.pot,
    turn: s.turn,
    turns: s.turns,
    totalTurns: totalTurns(s),
    posts: s.posts,
    values: postValues(s),
    deckCount: s.deck.length,
    phase: s.phase,
    last: s.last,
    minBet: amounts.length ? Math.min(...amounts) : 0,
    maxBet: amounts.length ? Math.max(...amounts) : 0,
    canAce: legal.some((a) => a.type === 'ace'),
    canBet: legal.some((a) => a.type === 'bet'),
    canGuess: legal.some((a) => a.type === 'guess'),
    canPass: legal.some((a) => a.type === 'pass'),
    canNext: legal.some((a) => a.type === 'next'),
  };
}

function result(s: IBState): GameResult | null {
  if (s.phase !== 'over') return null;
  const delta = s.chips.map((c, i) => c - s.start[i]);
  // chips left in the pot are shared out of the table's total: everyone is compared by their own balance
  const max = Math.max(...delta);
  return {
    scores: s.chips.slice(),
    winners: delta.flatMap((d, i) => (d === max ? [i] : [])),
    chipDelta: delta,
  };
}

/** Bet in proportion to the chance the next card lands strictly between. */
function bot(v: IBView, legal: IBAction[], level: Difficulty, rng: Rng): IBAction {
  const first = legal[0];
  if (!first) throw new Error('bot has no legal action');
  if (first.type === 'next') return first;
  if (first.type === 'ace') {
    // an Ace is usually best as low unless the other post is small
    const other = v.posts ? v.posts[1].rank : 7;
    return { type: 'ace', high: other > 8 ? false : level === 'easy' ? rng.next() < 0.5 : true };
  }
  const values = v.values;
  if (!values) return legal.find((a) => a.type === 'pass') ?? first;
  const gap = gapOf(values);
  const pass = legal.find((a) => a.type === 'pass')!;
  const bets = legal.filter((a): a is Extract<IBAction, { type: 'bet' }> => a.type === 'bet');
  const guesses = legal.filter(
    (a): a is Extract<IBAction, { type: 'guess' }> => a.type === 'guess',
  );

  if (guesses.length) {
    if (level === 'easy' && rng.next() < 0.5) return pass;
    const post = values[0];
    const high = post <= 7;
    const chance = high ? (14 - post) / 13 : (post - 1) / 13;
    const amounts = [...new Set(guesses.map((g) => g.amount))];
    const want = Math.max(v.config.minBet, Math.floor(v.pot * (chance - 0.45) * 2));
    const amount = amounts.reduce(
      (b, x) => (Math.abs(x - want) < Math.abs(b - want) ? x : b),
      amounts[0],
    );
    return chance > 0.5 ? { type: 'guess', high, amount } : pass;
  }
  if (bets.length === 0) return pass;
  // chance: ranks strictly between times four suits out of 52 (hard players would count the deck)
  const chance = Math.min(0.95, (gap * 4) / 51);
  if (level !== 'easy' && gap < 4) return pass;
  if (level === 'easy' && gap < 2 && rng.next() < 0.7) return pass;
  const amounts = bets.map((b) => b.amount);
  const frac = level === 'easy' ? 0.15 : level === 'medium' ? chance * 0.6 : chance * 0.8;
  const want = Math.max(v.config.minBet, Math.floor(v.pot * frac));
  const amount = amounts.reduce(
    (b, x) => (Math.abs(x - want) < Math.abs(b - want) ? x : b),
    amounts[0],
  );
  return { type: 'bet', amount };
}

export const inBetween: GameDefinition<IBState, IBAction, InBetweenConfig, IBView> = {
  id: 'inbetween',
  nameKey: 'game.inbetween',
  minPlayers: 2,
  maxPlayers: 8,
  supports: { bots: true, passAndPlay: true, online: true },
  defaultConfig,
  configSchema,
  presets,
  setup,
  currentActors: (s) => (s.phase === 'over' ? [] : [s.turn]),
  legalActions,
  apply,
  view,
  filterEvents: filterEventsDefault,
  timeoutAction(s) {
    if (s.phase === 'ace') return { type: 'ace', high: false };
    return { type: 'pass' };
  },
  result,
  isPlayPhase: (s) => s.phase !== 'over',
  bot,
  invariants(s) {
    const total = s.chips.reduce((a, b) => a + b, 0) + s.pot;
    if (total !== s.start.reduce((a, b) => a + b, 0)) return 'inbetween: chips not conserved';
    if (s.chips.some((c) => c < 0)) return 'inbetween: negative chips';
    const cards = [...s.deck, ...s.used, ...(s.posts ?? [])];
    if (new Set(cards.map((c) => c.id)).size !== cards.length) return 'inbetween: duplicate card';
    return null;
  },
};
