import type { Card } from '../../core/cards';
import { shuffledDeck } from '../../core/deck';
import { ev, filterEventsDefault, type GameEvent, type ViewerSeat } from '../../core/events';
import type { Rng } from '../../core/rng';
import { nextSeat, type Direction } from '../../core/seats';
import {
  IllegalActionError,
  type Difficulty,
  type GameDefinition,
  type GameResult,
  type PlayerInfo,
  type Step,
} from '../../core/types';
import { configSchema, defaultConfig, presets, type JutPattiConfig } from './config';
import { allPairs, dealFits, jokerRank, unmatched } from './rules';

export type { JutPattiConfig };

export type JPAction =
  | { type: 'draw'; from: 'stock' | 'discard' }
  | { type: 'discard'; cardId: number }
  | { type: 'declare' }
  | { type: 'next' };

export interface JPState {
  n: number;
  config: JutPattiConfig;
  humans: boolean[];
  levels: Difficulty[];
  hands: Card[][];
  stock: Card[];
  discard: Card[];
  indicator: Card;
  jokerRank: number;
  turn: number;
  dealer: number;
  phase: 'draw' | 'discard' | 'roundEnd' | 'over';
  /** the card just drawn this turn, so the UI can show it */
  drawnId: number | null;
  wins: number[];
  chips: number[];
  round: number;
  lastWinner: number | null;
}

export interface JPView {
  seat: number | 'spectator';
  config: JutPattiConfig;
  n: number;
  hand: Card[];
  handCounts: number[];
  stockCount: number;
  top: Card | null;
  tail: Card[];
  indicator: Card;
  jokerRank: number;
  turn: number;
  dealer: number;
  phase: JPState['phase'];
  drawnId: number | null;
  wins: number[];
  chips: number[];
  round: number;
  lastWinner: number | null;
  canDrawStock: boolean;
  canDrawDiscard: boolean;
  canDeclare: boolean;
  canNext: boolean;
  discardable: number[];
}

const dirOf = (s: Pick<JPState, 'config'>): Direction => s.config.direction;
const next = (s: JPState, seat: number) => nextSeat(seat, s.n, dirOf(s));

function deal(
  prev: Pick<JPState, 'n' | 'config' | 'humans' | 'levels' | 'wins' | 'chips'>,
  round: number,
  dealer: number,
  rng: Rng,
): Step<JPState> {
  const cfg = prev.config;
  const n = prev.n;
  const per = [11, 9, 7, 5].find((d) => d <= cfg.dealCount && dealFits(n, d)) ?? 5;
  const deck = shuffledDeck(rng);
  const hands: Card[][] = Array.from({ length: n }, () => []);
  for (let k = 0; k < per; k++) for (let i = 0; i < n; i++) hands[i].push(deck.pop()!);
  // the indicator is turned face up and tucked under the stock
  const indicator = deck.shift()!;
  const s: JPState = {
    n,
    config: cfg,
    humans: prev.humans,
    levels: prev.levels,
    hands,
    stock: deck,
    discard: [],
    indicator,
    jokerRank: jokerRank(indicator, cfg.jokerMode),
    turn: nextSeat(dealer, n, cfg.direction),
    dealer,
    phase: 'draw',
    drawnId: null,
    wins: prev.wins,
    chips: prev.chips,
    round,
    lastWinner: null,
  };
  return {
    state: s,
    events: [
      ev.note('roundStart', { round, dealer, jokerRank: s.jokerRank }),
      ...hands.map((h, seat) => ev.deal(seat, h)),
      { type: 'indicator', cards: [indicator], from: { kind: 'deck' }, to: { kind: 'stock' } },
    ],
  };
}

function setup(players: PlayerInfo[], config: JutPattiConfig, rng: Rng): Step<JPState> {
  if (players.length < 2 || players.length > 6) throw new Error('Jut Patti needs 2 to 6 players');
  const cfg = { ...defaultConfig, ...config };
  return deal(
    {
      n: players.length,
      config: cfg,
      humans: players.map((p) => !p.isBot),
      levels: players.map((p) => p.difficulty),
      wins: Array(players.length).fill(0),
      chips: Array(players.length).fill(0),
    },
    0,
    rng.int(players.length),
    rng,
  );
}

function canDeclareNow(s: JPState, seat: number) {
  return (
    s.phase === 'discard' &&
    seat === s.turn &&
    allPairs(s.hands[seat], s.jokerRank, s.config.pairColor)
  );
}

function legalActions(s: JPState, seat: number): JPAction[] {
  if (s.phase === 'over') return [];
  if (s.phase === 'roundEnd')
    return s.humans[seat] || !s.humans.some(Boolean) ? [{ type: 'next' }] : [];
  if (seat !== s.turn) return [];
  if (s.phase === 'draw') {
    const out: JPAction[] = [];
    if (s.stock.length + Math.max(0, s.discard.length - 1) > 0)
      out.push({ type: 'draw', from: 'stock' });
    if (s.discard.length > 0) out.push({ type: 'draw', from: 'discard' });
    return out;
  }
  const out: JPAction[] = s.hands[seat].map((c) => ({ type: 'discard' as const, cardId: c.id }));
  if (canDeclareNow(s, seat)) out.unshift({ type: 'declare' });
  return out;
}

function apply(state: JPState, seat: number, a: JPAction, rng: Rng): Step<JPState> {
  const s: JPState = {
    ...state,
    hands: state.hands.map((h) => h.slice()),
    stock: state.stock.slice(),
    discard: state.discard.slice(),
    wins: state.wins.slice(),
    chips: state.chips.slice(),
  };
  const legal = legalActions(s, seat);
  const key = (x: JPAction) =>
    x.type === 'draw' ? `draw|${x.from}` : x.type === 'discard' ? `discard|${x.cardId}` : x.type;
  if (!legal.some((l) => key(l) === key(a))) throw new IllegalActionError('illegal action');
  const events: GameEvent[] = [];

  switch (a.type) {
    case 'next':
      return deal(s, s.round + 1, next(s, s.dealer), rng);
    case 'draw': {
      let card: Card;
      if (a.from === 'discard') {
        card = s.discard.pop()!;
        events.push(ev.move([card], { kind: 'discard' }, { kind: 'hand', seat }, seat));
      } else {
        if (s.stock.length === 0) {
          // shuffle the discards except the top card; the indicator stays where it is
          const keep = s.discard.pop()!;
          s.stock = rng.shuffle(s.discard);
          s.discard = [keep];
          events.push(ev.note('reshuffle', { count: s.stock.length }));
        }
        card = s.stock.pop()!;
        events.push({
          type: 'draw',
          seat,
          cards: [card],
          from: { kind: 'stock' },
          to: { kind: 'hand', seat },
          visibleTo: [seat],
        });
      }
      s.hands[seat].push(card);
      s.drawnId = card.id;
      s.phase = 'discard';
      return { state: s, events };
    }
    case 'discard': {
      const card = s.hands[seat].find((c) => c.id === a.cardId)!;
      s.hands[seat] = s.hands[seat].filter((c) => c.id !== card.id);
      s.discard.push(card);
      s.drawnId = null;
      s.phase = 'draw';
      s.turn = next(s, seat);
      events.push(ev.move([card], { kind: 'hand', seat }, { kind: 'discard' }, seat));
      return { state: s, events };
    }
    case 'declare': {
      s.wins[seat] += 1;
      s.lastWinner = seat;
      s.drawnId = null;
      if (s.config.stake > 0) {
        for (let i = 0; i < s.n; i++) {
          if (i === seat) s.chips[i] += s.config.stake * (s.n - 1);
          else s.chips[i] -= s.config.stake;
        }
      }
      events.push(ev.note('declare', { hand: s.hands[seat], jokerRank: s.jokerRank }, seat));
      s.phase = s.wins[seat] >= s.config.target ? 'over' : 'roundEnd';
      events.push(ev.note('roundEnd', { winner: seat, wins: s.wins }, seat));
      if (s.phase === 'over') events.push(ev.note('gameEnd'));
      return { state: s, events };
    }
  }
}

function view(s: JPState, seat: ViewerSeat): JPView {
  const legal = seat === 'spectator' ? [] : legalActions(s, seat);
  return {
    seat,
    config: s.config,
    n: s.n,
    hand: seat === 'spectator' ? [] : s.hands[seat],
    handCounts: s.hands.map((h) => h.length),
    stockCount: s.stock.length,
    top: s.discard[s.discard.length - 1] ?? null,
    tail: s.discard.slice(-3),
    indicator: s.indicator,
    jokerRank: s.jokerRank,
    turn: s.turn,
    dealer: s.dealer,
    phase: s.phase,
    drawnId: seat !== 'spectator' && seat === s.turn ? s.drawnId : null,
    wins: s.wins,
    chips: s.chips,
    round: s.round,
    lastWinner: s.lastWinner,
    canDrawStock: legal.some((a) => a.type === 'draw' && a.from === 'stock'),
    canDrawDiscard: legal.some((a) => a.type === 'draw' && a.from === 'discard'),
    canDeclare: legal.some((a) => a.type === 'declare'),
    canNext: legal.some((a) => a.type === 'next'),
    discardable: legal.flatMap((a) => (a.type === 'discard' ? [a.cardId] : [])),
  };
}

function result(s: JPState): GameResult | null {
  if (s.phase !== 'over') return null;
  const max = Math.max(...s.wins);
  return {
    scores: s.wins.slice(),
    winners: s.wins.flatMap((w, i) => (w === max ? [i] : [])),
    chipDelta: s.config.stake > 0 ? s.chips.slice() : undefined,
  };
}

/** Keep pairs and jokers; throw the card with the least chance of ever pairing. */
function bot(v: JPView, legal: JPAction[], level: Difficulty, rng: Rng): JPAction {
  const first = legal[0];
  if (!first) throw new Error('bot has no legal action');
  if (first.type === 'next') return first;
  if (legal.some((a) => a.type === 'declare')) return { type: 'declare' };
  const jr = v.jokerRank;
  const pc = v.config.pairColor;

  if (first.type === 'draw') {
    const top = v.top;
    const canDiscard = legal.some((a) => a.type === 'draw' && a.from === 'discard');
    if (top && canDiscard && level !== 'easy') {
      const wantsIt =
        top.rank === jr ||
        v.hand.some(
          (c) =>
            c.rank === top.rank &&
            (!pc ||
              c.suit === top.suit ||
              (c.suit === 'H' || c.suit === 'D') === (top.suit === 'H' || top.suit === 'D')),
        );
      if (wantsIt) return { type: 'draw', from: 'discard' };
    }
    return legal.find((a) => a.type === 'draw' && a.from === 'stock') ?? first;
  }

  const discards = legal.filter(
    (a): a is Extract<JPAction, { type: 'discard' }> => a.type === 'discard',
  );
  const byId = new Map(v.hand.map((c) => [c.id, c]));
  if (level === 'easy' && rng.next() < 0.5) return rng.pick(discards);
  // pick the discard that leaves the fewest unmatched singles; never throw a joker unless forced
  let best = discards[0];
  let bestScore = Infinity;
  for (const d of discards) {
    const c = byId.get(d.cardId)!;
    const rest = v.hand.filter((x) => x.id !== c.id);
    let score = unmatched(rest, jr, pc) * 10;
    if (c.rank === jr) score += 50;
    // a rank already seen in the discard pile is less likely to come back
    const dead = v.tail.filter((t) => t.rank === c.rank).length;
    score -= dead;
    score += rng.next();
    if (score < bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

export const jutPatti: GameDefinition<JPState, JPAction, JutPattiConfig, JPView> = {
  id: 'jutpatti',
  nameKey: 'game.jutpatti',
  minPlayers: 2,
  maxPlayers: 6,
  supports: { bots: true, passAndPlay: true, online: true },
  defaultConfig,
  configSchema,
  presets,
  setup,
  currentActors: (s) =>
    s.phase === 'over'
      ? []
      : s.phase === 'roundEnd'
        ? (() => {
            const hs = Array.from({ length: s.n }, (_, i) => i).filter((i) => s.humans[i]);
            return hs.length ? hs : [0];
          })()
        : [s.turn],
  legalActions,
  apply,
  view,
  filterEvents: filterEventsDefault,
  timeoutAction(s, seat) {
    if (s.phase === 'roundEnd') return { type: 'next' };
    if (s.phase === 'draw') return { type: 'draw', from: 'stock' };
    const hand = s.hands[seat];
    const pick = hand.find((c) => c.id === s.drawnId) ?? hand[hand.length - 1];
    return { type: 'discard', cardId: pick.id };
  },
  result,
  isPlayPhase: (s) => s.phase === 'draw' || s.phase === 'discard',
  bot,
  invariants(s) {
    const all = [...s.hands.flat(), ...s.stock, ...s.discard, s.indicator];
    if (all.length !== 52) return `jutpatti: card count ${all.length}`;
    if (new Set(all.map((c) => c.id)).size !== 52) return 'jutpatti: duplicate card';
    return null;
  },
};
