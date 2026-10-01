import { dealRoundRobin, shuffledDeck } from '../../core/deck';
import { ev, filterEventsDefault, type GameEvent, type ViewerSeat } from '../../core/events';
import type { Rng } from '../../core/rng';
import { nextSeat } from '../../core/seats';
import {
  IllegalActionError,
  type GameDefinition,
  type GameResult,
  type PlayerInfo,
  type Step,
} from '../../core/types';
import { callBreakBot } from './bot';
import { configSchema, defaultConfig, presets, type CallBreakConfig } from './config';
import { handOk, legalCards, scoreRound, trickWinner } from './rules';
import type { CallBreakAction, CallBreakState, CallBreakView } from './view';

export type { CallBreakAction, CallBreakState, CallBreakView, CallBreakConfig };

const round1 = (x: number) => Math.round(x * 10) / 10;

function dealHands(rng: Rng, cfg: CallBreakConfig) {
  for (let tries = 0; tries < 200; tries++) {
    const { hands } = dealRoundRobin(shuffledDeck(rng), 4, 13);
    if (hands.every((h) => handOk(h, cfg))) return hands;
  }
  return dealRoundRobin(shuffledDeck(rng), 4, 13).hands;
}

function startRound(
  prev: Pick<CallBreakState, 'n' | 'config' | 'humans' | 'roundScores'>,
  round: number,
  dealer: number,
  rng: Rng,
): Step<CallBreakState> {
  const hands = dealHands(rng, prev.config);
  const first = nextSeat(dealer, 4, prev.config.direction);
  const state: CallBreakState = {
    n: 4,
    config: prev.config,
    humans: prev.humans,
    dealer,
    round,
    hands,
    bids: [null, null, null, null],
    tricksWon: [0, 0, 0, 0],
    trick: [],
    leader: first,
    turn: first,
    phase: 'bidding',
    roundScores: prev.roundScores,
    lastTrick: null,
    lastWinner: null,
    played: [],
  };
  const events: GameEvent[] = [
    ev.note('roundStart', { round, dealer }),
    ...hands.map((h, seat) => ev.deal(seat, h)),
  ];
  return { state, events };
}

const totals = (s: CallBreakState) =>
  [0, 1, 2, 3].map((seat) => round1(s.roundScores.reduce((t, r) => t + r[seat], 0)));

function setup(players: PlayerInfo[], config: CallBreakConfig, rng: Rng): Step<CallBreakState> {
  if (players.length !== 4) throw new Error('Call Break needs exactly 4 players');
  const dealer = rng.int(4);
  return startRound(
    { n: 4, config, humans: players.map((p) => !p.isBot), roundScores: [] },
    0,
    dealer,
    rng,
  );
}

function legalFor(s: CallBreakState, seat: number) {
  return legalCards(s.hands[seat], s.trick, s.config);
}

function apply(
  s: CallBreakState,
  seat: number,
  a: CallBreakAction,
  rng: Rng,
): Step<CallBreakState> {
  if (a.type === 'next') {
    if (s.phase !== 'roundEnd') throw new IllegalActionError('round is not finished');
    return startRound(s, s.round + 1, nextSeat(s.dealer, 4, s.config.direction), rng);
  }
  if (seat !== s.turn) throw new IllegalActionError('not your turn');

  if (a.type === 'bid') {
    if (s.phase !== 'bidding') throw new IllegalActionError('not bidding');
    if (!Number.isInteger(a.bid) || a.bid < 1 || a.bid > s.config.maxBid)
      throw new IllegalActionError('bid out of range');
    const bids = s.bids.map((b, i) => (i === seat ? a.bid : b));
    const events = [ev.note('bid', { bid: a.bid }, seat)];
    const done = bids.every((b) => b !== null);
    const next: CallBreakState = {
      ...s,
      bids,
      phase: done ? 'playing' : 'bidding',
      turn: done ? s.leader : nextSeat(seat, 4, s.config.direction),
    };
    if (done) events.push(ev.note('playStart', undefined, s.leader));
    return { state: next, events };
  }

  if (s.phase !== 'playing') throw new IllegalActionError('not playing');
  const card = s.hands[seat].find((c) => c.id === a.cardId);
  if (!card) throw new IllegalActionError('card not in hand');
  if (!legalFor(s, seat).some((c) => c.id === card.id))
    throw new IllegalActionError('illegal card');

  const hands = s.hands.map((h, i) => (i === seat ? h.filter((c) => c.id !== card.id) : h));
  const trick = [...s.trick, { seat, card }];
  const events: GameEvent[] = [
    ev.move([card], { kind: 'hand', seat }, { kind: 'trick', seat }, seat),
  ];
  if (trick.length < 4) {
    return {
      state: { ...s, hands, trick, turn: nextSeat(seat, 4, s.config.direction) },
      events,
    };
  }
  const winner = trickWinner(trick);
  const tricksWon = s.tricksWon.map((t, i) => (i === winner ? t + 1 : t));
  events.push(ev.note('trickWon', { cards: trick.map((p) => p.card.id) }, winner));
  const played = [...s.played, ...trick.map((p) => p.card)];
  const next: CallBreakState = {
    ...s,
    hands,
    trick: [],
    tricksWon,
    leader: winner,
    turn: winner,
    lastTrick: trick,
    lastWinner: winner,
    played,
  };
  if (hands.every((h) => h.length === 0)) {
    const scores = [0, 1, 2, 3].map((i) => scoreRound(s.bids[i]!, tricksWon[i], s.config));
    next.roundScores = [...s.roundScores, scores];
    next.phase = next.roundScores.length >= s.config.rounds ? 'over' : 'roundEnd';
    events.push(ev.note('roundEnd', { scores, tricksWon, bids: s.bids }));
    if (next.phase === 'over') events.push(ev.note('gameEnd'));
  }
  return { state: next, events };
}

function view(s: CallBreakState, seat: ViewerSeat): CallBreakView {
  const mine = seat === 'spectator' ? [] : s.hands[seat];
  const myTurn = seat !== 'spectator' && s.turn === seat;
  return {
    seat,
    config: s.config,
    dealer: s.dealer,
    round: s.round,
    rounds: s.config.rounds,
    hand: mine,
    handCounts: s.hands.map((h) => h.length),
    bids: s.bids,
    tricksWon: s.tricksWon,
    trick: s.trick,
    leader: s.leader,
    turn: s.turn,
    phase: s.phase,
    roundScores: s.roundScores,
    totals: totals(s),
    lastTrick: s.lastTrick,
    lastWinner: s.lastWinner,
    played: s.played,
    legalIds:
      myTurn && s.phase === 'playing' ? legalCards(mine, s.trick, s.config).map((c) => c.id) : [],
    legalBids:
      myTurn && s.phase === 'bidding'
        ? Array.from({ length: s.config.maxBid }, (_, i) => i + 1)
        : [],
  };
}

function legalActions(s: CallBreakState, seat: number): CallBreakAction[] {
  if (s.phase === 'roundEnd')
    return s.humans[seat] || !s.humans.some(Boolean) ? [{ type: 'next' }] : [];
  if (s.phase === 'over' || seat !== s.turn) return [];
  if (s.phase === 'bidding')
    return Array.from({ length: s.config.maxBid }, (_, i) => ({
      type: 'bid' as const,
      bid: i + 1,
    }));
  return legalFor(s, seat).map((c) => ({ type: 'play' as const, cardId: c.id }));
}

function currentActors(s: CallBreakState): number[] {
  if (s.phase === 'over') return [];
  if (s.phase === 'roundEnd') {
    const humans = [0, 1, 2, 3].filter((i) => s.humans[i]);
    return humans.length > 0 ? humans : [0];
  }
  return [s.turn];
}

function result(s: CallBreakState): GameResult | null {
  if (s.phase !== 'over') return null;
  const scores = totals(s);
  const max = Math.max(...scores);
  return { scores, winners: scores.flatMap((x, i) => (x === max ? [i] : [])) };
}

export const callBreak: GameDefinition<
  CallBreakState,
  CallBreakAction,
  CallBreakConfig,
  CallBreakView
> = {
  id: 'callbreak',
  nameKey: 'game.callbreak',
  minPlayers: 4,
  maxPlayers: 4,
  supports: { bots: true, passAndPlay: true, online: true },
  defaultConfig,
  configSchema,
  presets,
  setup,
  currentActors,
  legalActions,
  apply,
  view,
  filterEvents: filterEventsDefault,
  timeoutAction(s, seat) {
    if (s.phase === 'roundEnd') return { type: 'next' };
    if (s.phase === 'bidding') return { type: 'bid', bid: 1 };
    return { type: 'play', cardId: legalFor(s, seat)[0].id };
  },
  result,
  bot: callBreakBot,
  invariants(s) {
    const inHands = s.hands.reduce((t, h) => t + h.length, 0);
    const ids = [...s.hands.flat(), ...s.trick.map((p) => p.card), ...s.played].map((c) => c.id);
    if (inHands + s.trick.length + s.played.length !== 52) return 'callbreak: card count';
    if (new Set(ids).size !== 52) return 'callbreak: duplicate card';
    if (s.tricksWon.reduce((a, b) => a + b, 0) !== s.played.length / 4)
      return 'callbreak: trick count';
    return null;
  },
};
