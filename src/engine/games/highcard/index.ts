import { type Card, rankAceHigh } from '../../core/cards';
import { shuffledDeck, dealRoundRobin } from '../../core/deck';
import { ev, filterEventsDefault, type GameEvent, type ViewerSeat } from '../../core/events';
import type { Rng } from '../../core/rng';
import {
  IllegalActionError,
  type ConfigField,
  type Difficulty,
  type GameDefinition,
  type GameResult,
  type PlayerInfo,
  type Step,
} from '../../core/types';

// Tiny test game: each round every seat plays one card, highest wins the round.

export interface HighCardConfig extends Record<string, boolean | number | string> {
  rounds: number;
  aceHigh: boolean;
}
export interface HighCardState {
  n: number;
  hands: Card[][];
  played: (Card | null)[];
  wins: number[];
  round: number;
  rounds: number;
  aceHigh: boolean;
  turn: number;
  done: boolean;
}
export interface HighCardAction {
  cardId: number;
}
export interface HighCardView {
  seat: number | 'spectator';
  n: number;
  hand: Card[];
  handCounts: number[];
  played: (Card | null)[];
  wins: number[];
  round: number;
  rounds: number;
  turn: number;
  done: boolean;
}

const schema: ConfigField[] = [
  {
    key: 'rounds',
    type: 'number',
    labelKey: 'highcard.rounds',
    group: 'rules',
    default: 5,
    min: 1,
    max: 5,
  },
  { key: 'aceHigh', type: 'toggle', labelKey: 'highcard.aceHigh', group: 'rules', default: true },
];

const val = (s: { aceHigh: boolean }, c: Card) => (s.aceHigh ? rankAceHigh(c) : c.rank);

function setup(players: PlayerInfo[], config: HighCardConfig, rng: Rng): Step<HighCardState> {
  const n = players.length;
  const { hands } = dealRoundRobin(shuffledDeck(rng), n, config.rounds);
  const state: HighCardState = {
    n,
    hands,
    played: Array(n).fill(null),
    wins: Array(n).fill(0),
    round: 0,
    rounds: config.rounds,
    aceHigh: config.aceHigh,
    turn: 0,
    done: false,
  };
  return { state, events: hands.map((h, seat) => ev.deal(seat, h)) };
}

function apply(s: HighCardState, seat: number, a: HighCardAction): Step<HighCardState> {
  if (s.done || seat !== s.turn) throw new IllegalActionError('not your turn');
  const card = s.hands[seat].find((c) => c.id === a.cardId);
  if (!card) throw new IllegalActionError('card not in hand');
  const next: HighCardState = {
    ...s,
    hands: s.hands.map((h, i) => (i === seat ? h.filter((c) => c.id !== card.id) : h)),
    played: s.played.map((p, i) => (i === seat ? card : p)),
  };
  const events: GameEvent[] = [
    ev.move([card], { kind: 'hand', seat }, { kind: 'trick', seat }, seat),
  ];
  if (seat < s.n - 1) {
    next.turn = seat + 1;
    return { state: next, events };
  }
  let best = 0;
  next.played.forEach((c, i) => {
    if (c && val(s, c) > val(s, next.played[best]!)) best = i;
  });
  next.wins = next.wins.map((w, i) => (i === best ? w + 1 : w));
  events.push(ev.note('roundWon', { round: s.round }, best));
  next.played = Array(s.n).fill(null);
  next.round = s.round + 1;
  next.turn = 0;
  next.done = next.round >= s.rounds;
  if (next.done) events.push(ev.note('gameEnd'));
  return { state: next, events };
}

function legalActions(s: HighCardState, seat: number): HighCardAction[] {
  if (s.done || seat !== s.turn) return [];
  return s.hands[seat].map((c) => ({ cardId: c.id }));
}

function result(s: HighCardState): GameResult | null {
  if (!s.done) return null;
  const max = Math.max(...s.wins);
  return {
    scores: s.wins.slice(),
    winners: s.wins.flatMap((w, i) => (w === max ? [i] : [])),
  };
}

export const highCard: GameDefinition<HighCardState, HighCardAction, HighCardConfig, HighCardView> =
  {
    id: 'highcard',
    nameKey: 'game.highcard',
    minPlayers: 2,
    maxPlayers: 6,
    supports: { bots: true, passAndPlay: true, online: true },
    defaultConfig: { rounds: 5, aceHigh: true },
    configSchema: schema,
    presets: [{ id: 'standard', nameKey: 'preset.standard', config: {} }],
    setup,
    currentActors: (s) => (s.done ? [] : [s.turn]),
    legalActions,
    apply,
    view(s: HighCardState, seat: ViewerSeat): HighCardView {
      return {
        seat,
        n: s.n,
        hand: seat === 'spectator' ? [] : s.hands[seat],
        handCounts: s.hands.map((h) => h.length),
        played: s.played,
        wins: s.wins,
        round: s.round,
        rounds: s.rounds,
        turn: s.turn,
        done: s.done,
      };
    },
    filterEvents: filterEventsDefault,
    timeoutAction: (s, seat) => ({ cardId: s.hands[seat][0].id }),
    result,
    bot(view: HighCardView, legal: HighCardAction[], difficulty: Difficulty, rng: Rng) {
      if (difficulty === 'easy') return rng.pick(legal);
      const byId = new Map(view.hand.map((c) => [c.id, c]));
      return legal.reduce((best, a) =>
        rankAceHigh(byId.get(a.cardId)!) > rankAceHigh(byId.get(best.cardId)!) ? a : best,
      );
    },
    invariants(s) {
      const inHands = s.hands.reduce((t, h) => t + h.length, 0);
      const onTable = s.played.filter(Boolean).length;
      const dealt = s.n * s.rounds;
      const played = s.round * s.n;
      return inHands + onTable + played === dealt ? null : 'highcard: card count mismatch';
    },
  };
