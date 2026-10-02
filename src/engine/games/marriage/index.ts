import { isJoker, rankAceHigh, type Card } from '../../core/cards';
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
import { configSchema, defaultConfig, presets, type MarriageConfig } from './config';
import {
  countDublees,
  findShow,
  isMarriage,
  roleOf,
  solve,
  validateShow,
  type Ctx,
  type Meld,
} from './rules';

export type { MarriageConfig };

export type MAction =
  | { type: 'draw'; from: 'stock' | 'discard' }
  | { type: 'show'; sets: number[][] }
  | { type: 'discard'; cardId: number }
  | { type: 'declare'; cardId: number }
  | { type: 'next' };

export interface Settlement {
  winner: number | null;
  route: 'sequence' | 'dublee' | null;
  maal: number[];
  /** points won or lost this round, zero-sum */
  points: number[];
  chips: number[];
  breakdown: { seat: number; lines: { label: string; pts: number }[]; seen: boolean }[];
  joker: Card;
}

export interface MState {
  n: number;
  config: MarriageConfig;
  humans: boolean[];
  levels: Difficulty[];
  hands: Card[][];
  shown: Card[][][];
  route: ('sequence' | 'dublee' | null)[];
  seen: boolean[];
  stock: Card[];
  discard: Card[];
  joker: Card;
  supermanId: number | null;
  turn: number;
  dealer: number;
  round: number;
  phase: 'draw' | 'discard' | 'roundEnd' | 'over';
  drawn: { from: 'stock' | 'discard'; cardId: number } | null;
  mustShow: number | null;
  turns: number;
  chips: number[];
  start: number[];
  last: Settlement | null;
}

export interface MView {
  seat: number | 'spectator';
  config: MarriageConfig;
  n: number;
  hand: Card[];
  handCounts: number[];
  shown: Card[][][];
  route: MState['route'];
  seen: boolean[];
  /** the joker card: visible to players who have seen, and to everyone at the end of a round */
  joker: Card | null;
  supermanId: number | null;
  stockCount: number;
  top: Card | null;
  tail: Card[];
  turn: number;
  dealer: number;
  round: number;
  rounds: number;
  phase: MState['phase'];
  drawn: MState['drawn'];
  mustShow: number | null;
  chips: number[];
  start: number[];
  last: Settlement | null;
  canDrawStock: boolean;
  canDrawDiscard: boolean;
  canNext: boolean;
}

const STALL_TURNS = 70;
const next = (s: Pick<MState, 'n' | 'config'>, seat: number) =>
  nextSeat(seat, s.n, s.config.direction);
const ctxFor = (s: MState, seat: number): Ctx => ({
  joker: s.seen[seat] ? s.joker : null,
  supermanId: s.supermanId,
});
const solveSeen = (cards: Card[], ctx: Ctx) =>
  solve(cards, ctx, { allowWild: true, pureOnly: false });
const allCards = (s: MState, seat: number) => [...s.hands[seat], ...s.shown[seat].flat()];

// ---------- scoring ----------

const POPLU = [2, 5, 10];
const ALTER = [5, 15, 25];
const at = (table: number[], copies: number) => (copies <= 0 ? 0 : table[Math.min(copies, 3) - 1]);

/** Maal points for the cards a player holds: marriages first, then copies of each role. */
export function maalLines(
  cards: Card[],
  joker: Card,
  cfg: MarriageConfig,
  tunnelas: number,
): { label: string; pts: number }[] {
  const count = { tiplu: 0, poplu: 0, jhiplu: 0, alter: 0, man: 0 };
  for (const c of cards) {
    const r = roleOf(c, joker);
    if (r && r in count) count[r as keyof typeof count]++;
  }
  const lines: { label: string; pts: number }[] = [];
  const marriages = Math.min(count.tiplu, count.poplu, count.jhiplu);
  if (marriages > 0) {
    lines.push({ label: `marriage x${marriages}`, pts: marriages * cfg.marriagePts });
    count.tiplu -= marriages;
    count.poplu -= marriages;
    count.jhiplu -= marriages;
  }
  if (count.tiplu)
    lines.push({ label: `tiplu x${count.tiplu}`, pts: count.tiplu * cfg.tipluPerCopy });
  if (count.poplu) lines.push({ label: `poplu x${count.poplu}`, pts: at(POPLU, count.poplu) });
  if (count.jhiplu) lines.push({ label: `jhiplu x${count.jhiplu}`, pts: at(POPLU, count.jhiplu) });
  if (count.alter) lines.push({ label: `alter x${count.alter}`, pts: at(ALTER, count.alter) });
  if (count.man && cfg.manPts)
    lines.push({ label: `man x${count.man}`, pts: count.man * cfg.manPts });
  if (tunnelas) lines.push({ label: `tunnela x${tunnelas}`, pts: tunnelas * cfg.tunnelaPts });
  return lines;
}

function tunnelaCount(sets: Card[][], joker: Card): number {
  return sets.filter(
    (st) =>
      st.length === 3 &&
      st.every((c) => !isJoker(c) && c.rank === st[0].rank && c.suit === st[0].suit) &&
      roleOf(st[0], joker) === null,
  ).length;
}

function settle(s: MState, winner: number | null, finalMelds: Meld[] | null): Settlement {
  const n = s.n;
  const cfg = s.config;
  const maal = Array(n).fill(0);
  const breakdown: Settlement['breakdown'] = [];
  for (let i = 0; i < n; i++) {
    const cards = allCards(s, i);
    const sets = i === winner && finalMelds ? finalMelds.map((m) => m.cards) : s.shown[i];
    const lines = maalLines(cards, s.joker, cfg, tunnelaCount(sets, s.joker));
    maal[i] = lines.reduce((t, l) => t + l.pts, 0);
    breakdown.push({ seat: i, lines, seen: s.seen[i] });
  }
  // unseen players: classic keeps their maal, kidnap hands it to the winner, murder voids it
  const counted = maal.slice();
  for (let i = 0; i < n; i++) {
    if (s.seen[i]) continue;
    if (winner === null || cfg.mode === 'murder') counted[i] = 0;
    else if (cfg.mode === 'kidnap') {
      counted[winner] += maal[i];
      counted[i] = 0;
    }
  }
  const M = counted.reduce((a, b) => a + b, 0);
  const points = counted.map((m) => m * n - M);
  if (winner !== null) {
    for (let i = 0; i < n; i++) {
      if (i === winner) continue;
      let pay = s.seen[i] ? cfg.bonusSeen : cfg.bonusUnseen;
      if (s.route[winner] === 'dublee') pay += cfg.dubleeBonus;
      points[i] -= pay;
      points[winner] += pay;
    }
  }
  const chips = points.map((p) => p * cfg.chipValue);
  return {
    winner,
    route: winner === null ? null : s.route[winner],
    maal,
    points,
    chips,
    breakdown,
    joker: s.joker,
  };
}

// ---------- setup ----------

function deal(
  prev: Pick<MState, 'n' | 'config' | 'humans' | 'levels' | 'chips' | 'start'>,
  round: number,
  dealer: number,
  rng: Rng,
): Step<MState> {
  const cfg = prev.config;
  const n = prev.n;
  const base = makeDeck({ decks: 3 });
  let id = base.length;
  const extra: Card[] = [];
  for (let i = 0; i < cfg.men; i++) extra.push({ id: id++, suit: 'J', rank: 0, copy: 0 });
  let supermanId: number | null = null;
  if (cfg.superman) {
    supermanId = id;
    extra.push({ id, suit: 'J', rank: 0, copy: 0 });
  }
  const deck = rng.shuffle([...base, ...extra]);
  // the joker card is set aside face down; it is never a printed joker
  const ji = deck.findIndex((c) => !isJoker(c));
  const joker = deck.splice(ji, 1)[0];
  const hands: Card[][] = Array.from({ length: n }, () => []);
  for (let k = 0; k < 21; k++) for (let i = 0; i < n; i++) hands[i].push(deck.pop()!);
  const top = deck.pop()!;
  const s: MState = {
    n,
    config: cfg,
    humans: prev.humans,
    levels: prev.levels,
    hands,
    shown: Array.from({ length: n }, () => []),
    route: Array(n).fill(null),
    seen: Array(n).fill(false),
    stock: deck,
    discard: [top],
    joker,
    supermanId,
    turn: nextSeat(dealer, n, cfg.direction),
    dealer,
    round,
    phase: 'draw',
    drawn: null,
    mustShow: null,
    turns: 0,
    chips: prev.chips,
    start: prev.start,
    last: null,
  };
  return {
    state: s,
    events: [
      ev.note('roundStart', { round, dealer }),
      ...hands.map((h, seat) => ev.deal(seat, h)),
      { type: 'flip', cards: [top], from: { kind: 'deck' }, to: { kind: 'discard' } },
    ],
  };
}

function setup(players: PlayerInfo[], config: MarriageConfig, rng: Rng): Step<MState> {
  if (players.length < 2 || players.length > 5) throw new Error('Marriage needs 2 to 5 players');
  const cfg = { ...defaultConfig, ...config };
  const n = players.length;
  return deal(
    {
      n,
      config: cfg,
      humans: players.map((p) => !p.isBot),
      levels: players.map((p) => p.difficulty),
      chips: Array(n).fill(cfg.startChips),
      start: Array(n).fill(cfg.startChips),
    },
    0,
    rng.int(n),
    rng,
  );
}

// ---------- legality ----------

/** May this player take the top of the discard pile right now? */
function canTakeDiscard(s: MState, seat: number): boolean {
  const top = s.discard[s.discard.length - 1];
  if (!top) return false;
  if (!s.seen[seat]) {
    return findShow([...s.hands[seat], top], ctxFor(s, seat), s.config.showSets, top.id) !== null;
  }
  if (s.route[seat] === 'dublee') {
    return (
      countDublees([...allCards(s, seat), top], s.config.jokerDublee) >= s.config.showDublees + 1
    );
  }
  return true;
}

function legalActions(s: MState, seat: number): MAction[] {
  if (s.phase === 'over') return [];
  if (s.phase === 'roundEnd')
    return s.humans[seat] || !s.humans.some(Boolean) ? [{ type: 'next' }] : [];
  if (seat !== s.turn) return [];
  if (s.phase === 'draw') {
    const out: MAction[] = [];
    if (s.stock.length + Math.max(0, s.discard.length - 1) > 0)
      out.push({ type: 'draw', from: 'stock' });
    if (canTakeDiscard(s, seat)) out.push({ type: 'draw', from: 'discard' });
    return out;
  }
  if (s.mustShow !== null) {
    const show = findShow(s.hands[seat], ctxFor(s, seat), s.config.showSets, s.mustShow);
    return show ? [{ type: 'show', sets: show.map((st) => st.map((c) => c.id)) }] : [];
  }
  return s.hands[seat].map((c) => ({ type: 'discard' as const, cardId: c.id }));
}

function currentActors(s: MState): number[] {
  if (s.phase === 'over') return [];
  if (s.phase === 'roundEnd') {
    const hs = Array.from({ length: s.n }, (_, i) => i).filter((i) => s.humans[i]);
    return hs.length ? hs : [0];
  }
  return [s.turn];
}

/** Which discards would let this seen player finish? Used by the UI and the bots. */
export function finishingDiscards(
  hand: Card[],
  shown: Card[][],
  route: 'sequence' | 'dublee' | null,
  ctx: Ctx,
  cfg: MarriageConfig,
): number[] {
  if (route === null || !ctx.joker) return [];
  const out: number[] = [];
  const shownCards = shown.flat();
  for (const c of hand) {
    const rest = [...hand.filter((x) => x.id !== c.id), ...shownCards];
    if (route === 'dublee') {
      if (countDublees(rest, cfg.jokerDublee) >= cfg.showDublees + 1) out.push(c.id);
    } else if (solveSeen(rest, ctx)) out.push(c.id);
  }
  return out;
}

function endRound(s: MState, settlement: Settlement, events: GameEvent[]) {
  s.last = settlement;
  s.chips = s.chips.map((c, i) => c + settlement.chips[i]);
  s.phase = s.round + 1 >= s.config.rounds ? 'over' : 'roundEnd';
  events.push(ev.note('roundEnd', { winner: settlement.winner, points: settlement.points }));
  if (s.phase === 'over') events.push(ev.note('gameEnd'));
}

function apply(state: MState, seat: number, a: MAction, rng: Rng): Step<MState> {
  const s: MState = {
    ...state,
    hands: state.hands.map((h) => h.slice()),
    shown: state.shown.map((x) => x.slice()),
    route: state.route.slice(),
    seen: state.seen.slice(),
    stock: state.stock.slice(),
    discard: state.discard.slice(),
    chips: state.chips.slice(),
  };
  const events: GameEvent[] = [];
  if (a.type === 'next') {
    if (s.phase !== 'roundEnd') throw new IllegalActionError('round is not finished');
    return deal(s, s.round + 1, next(s, s.dealer), rng);
  }
  if (seat !== s.turn || s.phase === 'over' || s.phase === 'roundEnd')
    throw new IllegalActionError('not your turn');

  if (a.type === 'draw') {
    if (s.phase !== 'draw') throw new IllegalActionError('already drawn');
    let card: Card;
    if (a.from === 'discard') {
      if (!canTakeDiscard(s, seat)) throw new IllegalActionError('you cannot take that card');
      card = s.discard.pop()!;
      events.push(ev.move([card], { kind: 'discard' }, { kind: 'hand', seat }, seat));
      if (!s.seen[seat]) s.mustShow = card.id;
    } else {
      if (s.stock.length === 0) {
        if (s.discard.length <= 1) throw new IllegalActionError('nothing to draw');
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
    s.drawn = { from: a.from, cardId: card.id };
    s.phase = 'discard';
    return { state: s, events };
  }

  if (s.phase !== 'discard') throw new IllegalActionError('draw first');

  if (a.type === 'show') {
    if (s.seen[seat]) throw new IllegalActionError('already shown');
    const byId = new Map(s.hands[seat].map((c) => [c.id, c]));
    const sets: Card[][] = [];
    const used = new Set<number>();
    for (const ids of a.sets) {
      const cs = ids.map((id) => byId.get(id));
      if (cs.some((c) => !c) || ids.some((id) => used.has(id)))
        throw new IllegalActionError('bad cards');
      ids.forEach((id) => used.add(id));
      sets.push(cs as Card[]);
    }
    const ctx = { joker: null, supermanId: s.supermanId };
    const ok = validateShow(
      sets,
      ctx,
      { sequences: s.config.showSets, dublees: s.config.showDublees },
      s.config.jokerDublee,
    );
    if (!ok) throw new IllegalActionError('those cards are not a valid show');
    if (s.mustShow !== null && !used.has(s.mustShow))
      throw new IllegalActionError('show must use the card you took');
    s.hands[seat] = s.hands[seat].filter((c) => !used.has(c.id));
    s.shown[seat] = sets;
    s.route[seat] = ok.route;
    s.seen[seat] = true;
    s.mustShow = null;
    events.push({
      type: 'show',
      seat,
      cards: sets.flat(),
      data: { route: ok.route, sets: sets.map((st) => st.map((c) => c.id)) },
    });
    return { state: s, events };
  }

  if (s.mustShow !== null) throw new IllegalActionError('you took the discard: show first');
  const card = s.hands[seat].find((c) => c.id === a.cardId);
  if (!card) throw new IllegalActionError('card not in hand');
  s.hands[seat] = s.hands[seat].filter((c) => c.id !== card.id);

  if (a.type === 'declare') {
    if (!s.seen[seat]) throw new IllegalActionError('show first');
    const ctx = ctxFor(s, seat);
    const rest = [...s.hands[seat], ...s.shown[seat].flat()];
    let melds: Meld[] | null = null;
    if (s.route[seat] === 'dublee') {
      if (countDublees(rest, s.config.jokerDublee) < s.config.showDublees + 1)
        throw new IllegalActionError('not finished');
    } else {
      melds = solveSeen(rest, ctx);
      if (!melds) throw new IllegalActionError('not finished');
    }
    s.discard.push(card);
    events.push(ev.move([card], { kind: 'hand', seat }, { kind: 'discard' }, seat));
    events.push({ type: 'declare', seat, cards: rest, data: { route: s.route[seat] } });
    endRound(s, settle(s, seat, melds), events);
    return { state: s, events };
  }

  // discard
  s.discard.push(card);
  s.drawn = null;
  s.phase = 'draw';
  s.turns += 1;
  s.turn = next(s, seat);
  events.push(ev.move([card], { kind: 'hand', seat }, { kind: 'discard' }, seat));
  if (s.turns >= STALL_TURNS * s.n) {
    events.push(ev.note('stalled'));
    endRound(s, settle(s, null, null), events);
  }
  return { state: s, events };
}

function view(s: MState, seat: ViewerSeat): MView {
  const legal = seat === 'spectator' ? [] : legalActions(s, seat);
  const over = s.phase === 'roundEnd' || s.phase === 'over';
  return {
    seat,
    config: s.config,
    n: s.n,
    hand: seat === 'spectator' ? [] : s.hands[seat],
    handCounts: s.hands.map((h) => h.length),
    shown: s.shown,
    route: s.route,
    seen: s.seen,
    joker: over || (seat !== 'spectator' && s.seen[seat]) ? s.joker : null,
    supermanId: s.supermanId,
    stockCount: s.stock.length,
    top: s.discard[s.discard.length - 1] ?? null,
    tail: s.discard.slice(-3),
    turn: s.turn,
    dealer: s.dealer,
    round: s.round,
    rounds: s.config.rounds,
    phase: s.phase,
    drawn: seat !== 'spectator' && seat === s.turn ? s.drawn : null,
    mustShow: seat !== 'spectator' && seat === s.turn ? s.mustShow : null,
    chips: s.chips,
    start: s.start,
    last: s.last,
    canDrawStock: legal.some((a) => a.type === 'draw' && a.from === 'stock'),
    canDrawDiscard: legal.some((a) => a.type === 'draw' && a.from === 'discard'),
    canNext: legal.some((a) => a.type === 'next'),
  };
}

function result(s: MState): GameResult | null {
  if (s.phase !== 'over') return null;
  const delta = s.chips.map((c, i) => c - s.start[i]);
  const max = Math.max(...delta);
  return {
    scores: s.chips.slice(),
    winners: delta.flatMap((d, i) => (d === max ? [i] : [])),
    chipDelta: delta,
  };
}

// ---------- bots ----------

/** Greedy estimate of how many cards are not part of any set. Cheap enough to call often. */
export function unmatchedEstimate(cards: Card[], ctx: Ctx): number {
  const SU = ['S', 'H', 'D', 'C'];
  const cnt = new Array<number>(52).fill(0);
  let wilds = 0;
  for (const c of cards) {
    if (isJoker(c)) wilds++;
    else cnt[SU.indexOf(c.suit) * 13 + c.rank - 1]++;
  }
  const flexUsed: number[] = [];
  void flexUsed;
  // runs of three or more, longest first
  for (let s = 0; s < 4; s++) {
    for (let guard = 0; guard < 8; guard++) {
      let best: [number, number] | null = null;
      for (let a = 1; a <= 14; a++) {
        let b = a;
        while (
          b < 14 &&
          cnt[s * 13 + ((b + 1 === 14 ? 1 : b + 1) - 1)] > 0 &&
          !(a === 1 && b + 1 === 14)
        )
          b++;
        if (
          cnt[s * 13 + ((a === 14 ? 1 : a) - 1)] > 0 &&
          b - a + 1 >= 3 &&
          (!best || b - a > best[1] - best[0])
        )
          best = [a, b];
      }
      if (!best) break;
      for (let p = best[0]; p <= best[1]; p++) cnt[s * 13 + ((p === 14 ? 1 : p) - 1)]--;
    }
  }
  for (let k = 0; k < 52; k++) while (cnt[k] >= 3) cnt[k] -= 3;
  for (let r = 0; r < 13; r++) {
    const suits = [0, 1, 2, 3].filter((s) => cnt[s * 13 + r] > 0);
    if (suits.length >= 3) for (const s of suits.slice(0, 3)) cnt[s * 13 + r]--;
  }
  // fill two-card gaps with wilds
  for (let s = 0; s < 4 && wilds > 0; s++) {
    for (let r = 0; r < 12 && wilds > 0; r++) {
      const a = s * 13 + r;
      if (cnt[a] > 0 && cnt[a + 1] > 0) {
        cnt[a]--;
        cnt[a + 1]--;
        wilds--;
      } else if (r < 11 && cnt[a] > 0 && cnt[a + 2] > 0) {
        cnt[a]--;
        cnt[a + 2]--;
        wilds--;
      }
    }
  }
  void ctx;
  return cnt.reduce((t, x) => t + x, 0);
}

function bot(v: MView, legal: MAction[], level: Difficulty, rng: Rng): MAction {
  const first = legal[0];
  if (!first) throw new Error('bot has no legal action');
  if (first.type === 'next') return first;
  const me = v.seat as number;
  const ctx: Ctx = { joker: v.joker, supermanId: v.supermanId };
  const seen = v.seen[me];

  if (first.type === 'draw') {
    const canDiscard = legal.some((a) => a.type === 'draw' && a.from === 'discard');
    if (canDiscard && v.top && level !== 'easy') {
      if (!seen) return { type: 'draw', from: 'discard' }; // only allowed when it completes a show
      const cur = unmatchedEstimate(v.hand, ctx);
      const withIt = unmatchedEstimate([...v.hand, v.top], ctx);
      if (withIt <= cur) return { type: 'draw', from: 'discard' };
    }
    return legal.find((a) => a.type === 'draw' && a.from === 'stock') ?? first;
  }

  if (first.type === 'show' && v.mustShow !== null) return first;

  if (!seen) {
    // dublee route when the hand is full of pairs, otherwise the first three pure sets
    const dub = countDublees(v.hand, v.config.jokerDublee);
    if (dub >= v.config.showDublees && level !== 'easy') {
      const byKey = new Map<string, Card[]>();
      for (const c of v.hand) {
        const k = `${c.suit}${c.rank}`;
        byKey.set(k, [...(byKey.get(k) ?? []), c]);
      }
      const pairs = [...byKey.values()].filter((g) => g.length >= 2).map((g) => g.slice(0, 2));
      if (pairs.length >= v.config.showDublees)
        return {
          type: 'show',
          sets: pairs.slice(0, v.config.showDublees).map((p) => p.map((c) => c.id)),
        };
    }
    const show = findShow(v.hand, ctx, v.config.showSets, null);
    if (show && level !== 'easy')
      return { type: 'show', sets: show.map((st) => st.map((c) => c.id)) };
  } else if (level !== 'easy') {
    const win = finishingDiscards(v.hand, v.shown[me], v.route[me], ctx, v.config);
    if (win.length) return { type: 'declare', cardId: win[0] };
  }

  const discards = legal.filter(
    (a): a is Extract<MAction, { type: 'discard' }> => a.type === 'discard',
  );
  if (level === 'easy' && rng.next() < 0.5) return rng.pick(discards);
  const byId = new Map(v.hand.map((c) => [c.id, c]));
  let best = discards[0];
  let bestScore = Infinity;
  for (const d of discards) {
    const c = byId.get(d.cardId)!;
    const rest = v.hand.filter((x) => x.id !== c.id);
    let score = unmatchedEstimate(rest, ctx) * 10;
    // never throw a maal card or a wild once seen
    if (ctx.joker && roleOf(c, ctx.joker) !== null) score += 25;
    if (isJoker(c)) score += 40;
    score -= rankAceHigh(c) * 0.3; // between equals, throw the high card
    score += rng.next() * 0.5;
    if (score < bestScore) {
      bestScore = score;
      best = d;
    }
  }
  return best;
}

export const marriage: GameDefinition<MState, MAction, MarriageConfig, MView> = {
  id: 'marriage',
  nameKey: 'game.marriage',
  minPlayers: 2,
  maxPlayers: 5,
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
    if (s.phase === 'draw') return { type: 'draw', from: 'stock' };
    const hand = s.hands[seat];
    const pick =
      hand.find((c) => c.id === s.drawn?.cardId && s.drawn.from === 'stock') ??
      hand[hand.length - 1];
    if (s.mustShow !== null) {
      const show = findShow(hand, ctxFor(s, seat), s.config.showSets, s.mustShow);
      if (show) return { type: 'show', sets: show.map((st) => st.map((c) => c.id)) };
    }
    return { type: 'discard', cardId: pick.id };
  },
  result,
  isPlayPhase: (s) => s.phase === 'draw' || s.phase === 'discard',
  bot,
  invariants(s) {
    const all = [...s.hands.flat(), ...s.shown.flat(2), ...s.stock, ...s.discard, s.joker];
    const expected = 156 + s.config.men + (s.config.superman ? 1 : 0);
    if (all.length !== expected) return `marriage: card count ${all.length}/${expected}`;
    if (new Set(all.map((c) => c.id)).size !== expected) return 'marriage: duplicate card';
    if (s.chips.reduce((a, b) => a + b, 0) !== s.start.reduce((a, b) => a + b, 0))
      return 'marriage: chips not conserved';
    return null;
  },
};

export { isMarriage };
