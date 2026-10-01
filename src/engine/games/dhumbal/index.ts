import { isJoker, type Card } from '../../core/cards';
import { makeDeck } from '../../core/deck';
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
import { configSchema, defaultConfig, presets, type DhumbalConfig } from './config';
import {
  allThrows,
  cardValue,
  classifyThrow,
  handTotal,
  pickableFrom,
  type ThrowKind,
} from './rules';

export type { DhumbalConfig };

export type DAction =
  | { type: 'jhyap' }
  | { type: 'throw'; cardIds: number[] }
  | { type: 'pick'; from: 'stock' }
  | { type: 'pick'; from: 'discard'; cardId: number }
  | { type: 'bonus'; throw: boolean }
  | { type: 'next' };

interface Throw {
  cards: Card[];
  kind: ThrowKind;
  thrower: number;
}

interface Reveal {
  caller: number;
  hands: Card[][];
  totals: number[];
  counter: boolean;
  added: number[];
}

export interface DState {
  n: number;
  config: DhumbalConfig;
  humans: boolean[];
  levels: Difficulty[];
  hands: Card[][];
  stock: Card[];
  /** older throws, reshuffled into the stock when it runs out */
  discardPile: Card[];
  /** the previous throw: what the next player may pick from */
  pickable: Throw | null;
  /** my throw this turn, waiting for the pick */
  thrown: Throw | null;
  bonusId: number | null;
  turn: number;
  dealer: number;
  round: number;
  phase: 'turn' | 'pick' | 'bonus' | 'roundEnd' | 'over';
  turnsPlayed: number;
  scores: number[];
  eliminated: boolean[];
  roundScores: number[][];
  /** card ids everyone knows a player holds because they picked them from the throw */
  known: number[][];
  reveal: Reveal | null;
}

export interface DView {
  seat: number | 'spectator';
  config: DhumbalConfig;
  n: number;
  hand: Card[];
  handCounts: number[];
  total: number;
  stockCount: number;
  pickable: { cards: Card[]; kind: ThrowKind; thrower: number; pickIds: number[] } | null;
  thrown: Card[] | null;
  turn: number;
  dealer: number;
  round: number;
  phase: DState['phase'];
  scores: number[];
  eliminated: boolean[];
  roundScores: number[][];
  known: Card[][];
  reveal: Reveal | null;
  canJhyap: boolean;
  canPickStock: boolean;
  canBonus: boolean;
  canNext: boolean;
  bonusId: number | null;
  jhyapBlocked: 'first' | 'total' | null;
}

const active = (s: DState) =>
  Array.from({ length: s.n }, (_, i) => i).filter((i) => !s.eliminated[i]);

function nextActive(s: Pick<DState, 'n' | 'eliminated' | 'config'>, from: number): number {
  let x = from;
  for (let i = 0; i < s.n; i++) {
    x = nextSeat(x, s.n, s.config.direction);
    if (!s.eliminated[x]) return x;
  }
  return from;
}

function deal(
  prev: Pick<
    DState,
    'n' | 'config' | 'humans' | 'levels' | 'scores' | 'eliminated' | 'roundScores'
  >,
  round: number,
  dealer: number,
  rng: Rng,
): Step<DState> {
  const cfg = prev.config;
  const n = prev.n;
  const deck = rng.shuffle(makeDeck({ jokersPerDeck: cfg.jokers ? 2 : 0 }));
  const hands: Card[][] = Array.from({ length: n }, () => []);
  const seats = Array.from({ length: n }, (_, i) => i).filter((i) => !prev.eliminated[i]);
  for (let k = 0; k < cfg.handSize; k++) for (const i of seats) hands[i].push(deck.pop()!);
  const flip = deck.pop()!;
  const s: DState = {
    n,
    config: cfg,
    humans: prev.humans,
    levels: prev.levels,
    hands,
    stock: deck,
    discardPile: [],
    pickable: { cards: [flip], kind: 'single', thrower: -1 },
    thrown: null,
    bonusId: null,
    turn: 0,
    dealer,
    round,
    phase: 'turn',
    turnsPlayed: 0,
    scores: prev.scores,
    eliminated: prev.eliminated,
    roundScores: prev.roundScores,
    known: Array.from({ length: n }, () => []),
    reveal: null,
  };
  s.turn = nextActive(s, dealer);
  return {
    state: s,
    events: [
      ev.note('roundStart', { round, dealer }),
      ...seats.map((seat) => ev.deal(seat, hands[seat])),
      { type: 'flip', cards: [flip], from: { kind: 'deck' }, to: { kind: 'discard' } },
    ],
  };
}

function setup(players: PlayerInfo[], config: DhumbalConfig, rng: Rng): Step<DState> {
  if (players.length < 2 || players.length > 7) throw new Error('Dhumbal needs 2 to 7 players');
  const cfg = { ...defaultConfig, ...config };
  return deal(
    {
      n: players.length,
      config: cfg,
      humans: players.map((p) => !p.isBot),
      levels: players.map((p) => p.difficulty),
      scores: Array(players.length).fill(0),
      eliminated: Array(players.length).fill(false),
      roundScores: [],
    },
    0,
    rng.int(players.length),
    rng,
  );
}

function jhyapBlocked(s: DState, seat: number): 'first' | 'total' | null {
  if (s.hands[seat].length === 0) return null;
  if (handTotal(s.hands[seat], s.config) > s.config.jhyapLimit) return 'total';
  if (s.config.noJhyapFirstRound && s.turnsPlayed < active(s).length) return 'first';
  return null;
}

function pickOptions(s: DState): { stock: boolean; cards: Card[] } {
  const stock = s.stock.length > 0 || s.discardPile.length + (s.pickable?.cards.length ?? 0) > 0;
  const cards = s.pickable ? pickableFrom(s.pickable.cards, s.pickable.kind, s.config) : [];
  return { stock, cards };
}

function legalActions(s: DState, seat: number): DAction[] {
  if (s.phase === 'over') return [];
  if (s.phase === 'roundEnd')
    return s.humans[seat] || !s.humans.some(Boolean) ? [{ type: 'next' }] : [];
  if (seat !== s.turn) return [];
  if (s.phase === 'turn') {
    const out: DAction[] = allThrows(s.hands[seat], s.config).map((t) => ({
      type: 'throw' as const,
      cardIds: t.ids,
    }));
    if (jhyapBlocked(s, seat) === null) out.unshift({ type: 'jhyap' });
    return out;
  }
  if (s.phase === 'pick') {
    const o = pickOptions(s);
    const out: DAction[] = [];
    if (o.stock) out.push({ type: 'pick', from: 'stock' });
    for (const c of o.cards) out.push({ type: 'pick', from: 'discard', cardId: c.id });
    return out;
  }
  return [
    { type: 'bonus', throw: true },
    { type: 'bonus', throw: false },
  ];
}

const keyOf = (a: DAction) =>
  a.type === 'throw'
    ? `throw|${[...a.cardIds].sort((x, y) => x - y).join(',')}`
    : a.type === 'pick'
      ? a.from === 'stock'
        ? 'pick|stock'
        : `pick|discard|${a.cardId}`
      : a.type === 'bonus'
        ? `bonus|${a.throw}`
        : a.type;

/** Safety net: a round that drags on for this many turns per player is closed by the lowest hand. */
const STALL_TURNS = 40;

function endTurn(s: DState, events: GameEvent[]) {
  s.turnsPlayed += 1;
  s.thrown = null;
  s.bonusId = null;
  s.phase = 'turn';
  s.turn = nextActive(s, s.turn);
  if (s.turnsPlayed >= STALL_TURNS * active(s).length) {
    const seats = active(s);
    const low = seats.reduce(
      (b, i) => (handTotal(s.hands[i], s.config) < handTotal(s.hands[b], s.config) ? i : b),
      seats[0],
    );
    resolveJhyap(s, low, events, true);
  }
}

function apply(state: DState, seat: number, a: DAction, rng: Rng): Step<DState> {
  const s: DState = {
    ...state,
    hands: state.hands.map((h) => h.slice()),
    stock: state.stock.slice(),
    discardPile: state.discardPile.slice(),
    known: state.known.map((k) => k.slice()),
    scores: state.scores.slice(),
    eliminated: state.eliminated.slice(),
  };
  const legal = legalActions(s, seat);
  const sorted: DAction =
    a.type === 'throw' ? { type: 'throw', cardIds: [...a.cardIds].sort((x, y) => x - y) } : a;
  if (!legal.some((l) => keyOf(l) === keyOf(sorted)))
    throw new IllegalActionError('illegal action');
  const events: GameEvent[] = [];

  switch (a.type) {
    case 'next': {
      const dealer = nextActive(s, s.dealer);
      return deal(s, s.round + 1, dealer, rng);
    }
    case 'throw': {
      const cards = s.hands[seat].filter((c) => a.cardIds.includes(c.id));
      const cls = classifyThrow(cards, s.config)!;
      s.hands[seat] = s.hands[seat].filter((c) => !a.cardIds.includes(c.id));
      s.known[seat] = s.known[seat].filter((id) => !a.cardIds.includes(id));
      s.thrown = { cards: cls.ordered, kind: cls.kind, thrower: seat };
      s.phase = 'pick';
      events.push({
        type: 'throw',
        seat,
        cards: cls.ordered,
        from: { kind: 'hand', seat },
        to: { kind: 'table' },
        data: { kind: cls.kind },
      });
      // nothing to pick (cannot happen with a normal deck): the turn just ends
      const o = pickOptions(s);
      if (!o.stock && o.cards.length === 0) {
        s.pickable = s.thrown;
        endTurn(s, events);
      }
      return { state: s, events };
    }
    case 'pick': {
      const prev = s.pickable;
      let card: Card;
      if (a.from === 'stock') {
        if (s.stock.length === 0) {
          s.stock = rng.shuffle([...s.discardPile, ...(prev?.cards ?? [])]);
          s.discardPile = [];
          if (prev) prev.cards = [];
          events.push(ev.note('reshuffle', { count: s.stock.length }));
        }
        card = s.stock.pop()!;
        events.push({
          type: 'pick',
          seat,
          cards: [card],
          from: { kind: 'stock' },
          to: { kind: 'hand', seat },
          visibleTo: [seat],
          data: { from: 'stock' },
        });
      } else {
        card = prev!.cards.find((c) => c.id === a.cardId)!;
        s.known[seat].push(card.id);
        events.push({
          type: 'pick',
          seat,
          cards: [card],
          from: { kind: 'discard' },
          to: { kind: 'hand', seat },
          data: { from: 'discard' },
        });
      }
      s.hands[seat].push(card);
      if (prev) s.discardPile.push(...prev.cards.filter((c) => c.id !== card.id));
      const t = s.thrown!;
      s.pickable = { cards: t.cards, kind: t.kind, thrower: t.thrower };
      s.thrown = null;
      const sameRank =
        a.from === 'stock' &&
        s.config.throwAfterMatch &&
        t.kind !== 'run' &&
        t.cards.length < 4 &&
        !isJoker(card) &&
        t.cards.every((c) => !isJoker(c) && c.rank === card.rank);
      if (sameRank) {
        s.phase = 'bonus';
        s.bonusId = card.id;
      } else endTurn(s, events);
      return { state: s, events };
    }
    case 'bonus': {
      if (a.throw) {
        const card = s.hands[seat].find((c) => c.id === s.bonusId)!;
        s.hands[seat] = s.hands[seat].filter((c) => c.id !== card.id);
        const t = s.pickable!;
        s.pickable = { cards: [...t.cards, card], kind: 'set', thrower: t.thrower };
        events.push({
          type: 'throw',
          seat,
          cards: [card],
          from: { kind: 'hand', seat },
          to: { kind: 'table' },
          data: { kind: 'bonus' },
        });
      }
      endTurn(s, events);
      return { state: s, events };
    }
    case 'jhyap': {
      resolveJhyap(s, seat, events);
      return { state: s, events };
    }
  }
}

/** Everyone shows their hand and the round is scored. `forced` ends a stalled round with no penalty. */
function resolveJhyap(s: DState, seat: number, events: GameEvent[], forced = false) {
  const totals = s.hands.map((h, i) => (s.eliminated[i] ? 0 : handTotal(h, s.config)));
  const others = active(s).filter((i) => i !== seat);
  const mine = totals[seat];
  const counter = !forced && others.some((i) => totals[i] <= mine);
  const added: number[] = Array(s.n).fill(0);
  if (!counter) {
    for (const i of others) added[i] = totals[i];
  } else {
    added[seat] = mine + s.config.counterPenalty;
    const lowest = Math.min(...others.map((i) => totals[i]));
    for (const i of others) added[i] = totals[i] === lowest ? 0 : totals[i];
  }
  s.scores = s.scores.map((x, i) => x + added[i]);
  s.roundScores = [...s.roundScores, added];
  s.reveal = { caller: seat, hands: s.hands.map((h) => h.slice()), totals, counter, added };
  events.push(ev.note('jhyap', { ...s.reveal, forced }, seat));
  let over: boolean;
  if (s.config.fixedRounds > 0) over = s.round + 1 >= s.config.fixedRounds;
  else {
    s.eliminated = s.eliminated.map((e, i) => e || s.scores[i] > s.config.eliminateAt);
    over = active(s).length <= 1;
  }
  s.phase = over ? 'over' : 'roundEnd';
  s.thrown = null;
  s.bonusId = null;
  events.push(ev.note('roundEnd', { added, scores: s.scores }));
  if (over) events.push(ev.note('gameEnd'));
}

function view(s: DState, seat: ViewerSeat): DView {
  const legal = seat === 'spectator' ? [] : legalActions(s, seat);
  const hand = seat === 'spectator' ? [] : s.hands[seat];
  const pick =
    s.pickable && s.phase === 'pick'
      ? pickableFrom(s.pickable.cards, s.pickable.kind, s.config)
      : [];
  const byId = new Map(s.hands.flat().map((c) => [c.id, c]));
  return {
    seat,
    config: s.config,
    n: s.n,
    hand,
    handCounts: s.hands.map((h) => h.length),
    total: handTotal(hand, s.config),
    stockCount: s.stock.length,
    pickable: s.pickable
      ? {
          cards: s.pickable.cards,
          kind: s.pickable.kind,
          thrower: s.pickable.thrower,
          pickIds: seat !== 'spectator' && seat === s.turn ? pick.map((c) => c.id) : [],
        }
      : null,
    thrown: s.thrown ? s.thrown.cards : null,
    turn: s.turn,
    dealer: s.dealer,
    round: s.round,
    phase: s.phase,
    scores: s.scores,
    eliminated: s.eliminated,
    roundScores: s.roundScores,
    known: s.known.map((ids) => ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []))),
    reveal: s.reveal,
    canJhyap: legal.some((a) => a.type === 'jhyap'),
    canPickStock: legal.some((a) => a.type === 'pick' && a.from === 'stock'),
    canBonus: legal.some((a) => a.type === 'bonus'),
    canNext: legal.some((a) => a.type === 'next'),
    bonusId: seat === s.turn ? s.bonusId : null,
    jhyapBlocked:
      seat !== 'spectator' && seat === s.turn && s.phase === 'turn' ? jhyapBlocked(s, seat) : null,
  };
}

function result(s: DState): GameResult | null {
  if (s.phase !== 'over') return null;
  const pool = s.config.fixedRounds > 0 ? s.scores.map((_, i) => i) : active(s);
  const best = Math.min(...pool.map((i) => s.scores[i]));
  return {
    scores: s.scores.slice(),
    winners: pool.filter((i) => s.scores[i] === best),
    lowerIsBetter: true,
  };
}

/** Estimated lowest hand total among opponents, using what they were seen picking up. */
function estimateOpp(v: DView, level: Difficulty): number {
  const avg = level === 'hard' ? 5 : 5.5;
  let low = Infinity;
  for (let i = 0; i < v.n; i++) {
    if (i === v.seat || v.eliminated[i] || v.handCounts[i] === 0) continue;
    const known = v.known[i].reduce((t, c) => t + cardValue(c, v.config), 0);
    const unknown = Math.max(0, v.handCounts[i] - v.known[i].length);
    low = Math.min(low, known + unknown * avg);
  }
  return low;
}

function bot(v: DView, legal: DAction[], level: Difficulty, rng: Rng): DAction {
  const first = legal[0];
  if (!first) throw new Error('bot has no legal action');
  if (first.type === 'next') return first;
  if (first.type === 'bonus') return { type: 'bonus', throw: true };
  const cfg = v.config;

  if (legal.some((a) => a.type === 'throw' || a.type === 'jhyap')) {
    if (legal.some((a) => a.type === 'jhyap')) {
      const margin = level === 'hard' ? 2 : level === 'medium' ? 1 : -3;
      const sure = v.total <= (level === 'easy' ? Math.min(cfg.jhyapLimit, 4) : 3);
      if (sure || v.total < estimateOpp(v, level) - margin) {
        if (level !== 'easy' || rng.next() < 0.7) return { type: 'jhyap' };
      }
    }
    const throws = legal.filter(
      (a): a is Extract<DAction, { type: 'throw' }> => a.type === 'throw',
    );
    if (throws.length === 0) return { type: 'jhyap' };
    const byId = new Map(v.hand.map((c) => [c.id, c]));
    if (level === 'easy' && rng.next() < 0.4) return rng.pick(throws);
    let best = throws[0];
    let bestScore = -Infinity;
    for (const t of throws) {
      const cards = t.cardIds.map((id) => byId.get(id)!);
      const removed = cards.reduce((x, c) => x + cardValue(c, cfg), 0);
      // keep cards that can pair up later; prefer throwing more cards for the same weight
      const rest = v.hand.filter((c) => !t.cardIds.includes(c.id));
      const pairs = rest.filter((c) => rest.some((d) => d.id !== c.id && d.rank === c.rank)).length;
      const score =
        removed * 2 +
        cards.length * 0.5 +
        pairs * (level === 'hard' ? 1.5 : 0.7) +
        rng.next() * 0.3;
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    return best;
  }

  // picking: a low card, or one that matches something I hold; otherwise the stock
  const picks = legal.filter(
    (a): a is Extract<DAction, { type: 'pick'; from: 'discard' }> =>
      a.type === 'pick' && a.from === 'discard',
  );
  const stock = legal.find((a) => a.type === 'pick' && a.from === 'stock');
  if (level !== 'easy' || rng.next() < 0.5) {
    const cards = v.pickable?.cards ?? [];
    let best: (typeof picks)[number] | null = null;
    let bestScore = 0;
    for (const p of picks) {
      const c = cards.find((x) => x.id === p.cardId)!;
      const val = cardValue(c, cfg);
      const matches = v.hand.filter((h) => h.rank === c.rank && !isJoker(c)).length;
      const run = v.hand.some((h) => h.suit === c.suit && Math.abs(h.rank - c.rank) === 1) ? 1 : 0;
      let score = (val <= 3 ? 4 - val : 0) + matches * 3 + run;
      if (isJoker(c)) score += 5;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best && bestScore >= 3) return best;
  }
  return stock ?? picks[0] ?? first;
}

export const dhumbal: GameDefinition<DState, DAction, DhumbalConfig, DView> = {
  id: 'dhumbal',
  nameKey: 'game.dhumbal',
  minPlayers: 2,
  maxPlayers: 7,
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
            const hs = active(s).filter((i) => s.humans[i]);
            return hs.length ? hs : [active(s)[0]];
          })()
        : [s.turn],
  legalActions,
  apply,
  view,
  filterEvents: filterEventsDefault,
  timeoutAction(s, seat) {
    if (s.phase === 'roundEnd') return { type: 'next' };
    if (s.phase === 'bonus') return { type: 'bonus', throw: false };
    if (s.phase === 'pick') return { type: 'pick', from: 'stock' };
    // throw the highest single card
    const hand = s.hands[seat]
      .slice()
      .sort((a, b) => cardValue(b, s.config) - cardValue(a, s.config));
    return { type: 'throw', cardIds: [hand[0].id] };
  },
  result,
  isPlayPhase: (s) => s.phase === 'turn' || s.phase === 'pick' || s.phase === 'bonus',
  bot,
  invariants(s) {
    const expected = s.config.jokers ? 54 : 52;
    const all = [
      ...s.hands.flat(),
      ...s.stock,
      ...s.discardPile,
      ...(s.pickable?.cards ?? []),
      ...(s.thrown?.cards ?? []),
    ];
    if (all.length !== expected) return `dhumbal: card count ${all.length}/${expected}`;
    if (new Set(all.map((c) => c.id)).size !== expected) return 'dhumbal: duplicate card';
    return null;
  },
};
