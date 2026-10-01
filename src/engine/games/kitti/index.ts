import type { Card } from '../../core/cards';
import { shuffledDeck } from '../../core/deck';
import { ev, filterEventsDefault, type GameEvent, type ViewerSeat } from '../../core/events';
import type { Rng } from '../../core/rng';
import { nextSeat } from '../../core/seats';
import { evaluate, type ThreeCardOptions } from '../../core/threeCard';
import {
  IllegalActionError,
  type Difficulty,
  type GameDefinition,
  type GameResult,
  type PlayerInfo,
  type Step,
} from '../../core/types';
import { configSchema, defaultConfig, presets, type KittiConfig } from './config';

export type { KittiConfig };

export type KAction =
  { type: 'arrange'; groups: number[][] } | { type: 'auto' } | { type: 'pack' } | { type: 'next' };

export interface Showdown {
  /** group index (0-2) of each seat, empty for packed seats */
  groups: Card[][][];
  /** winner seat of each show, null when nobody won it */
  showWinners: (number | null)[];
  winner: number | null;
  salami: boolean;
  payout: number[];
}

export interface KState {
  n: number;
  config: KittiConfig;
  humans: boolean[];
  levels: Difficulty[];
  hands: Card[][];
  groups: (number[][] | null)[];
  packed: boolean[];
  inRound: boolean[];
  chips: number[];
  start: number[];
  pot: number;
  dealer: number;
  round: number;
  phase: 'arrange' | 'roundEnd' | 'over';
  showdown: Showdown | null;
}

export interface KView {
  seat: number | 'spectator';
  config: KittiConfig;
  n: number;
  hand: Card[];
  submitted: boolean[];
  packed: boolean[];
  inRound: boolean[];
  chips: number[];
  start: number[];
  pot: number;
  dealer: number;
  round: number;
  rounds: number;
  phase: KState['phase'];
  showdown: Showdown | null;
  /** the arrangement the viewer has locked in, if any */
  mine: number[][] | null;
  canArrange: boolean;
  canPack: boolean;
  canNext: boolean;
}

const optsOf = (c: KittiConfig): ThreeCardOptions => ({ a23: c.a23, top235: c.top235 });
const scoreOf = (cards: Card[], c: KittiConfig) => evaluate(cards, optsOf(c)).score;

/** The 280 splits of nine positions into three groups of three, as bit masks. Built once. */
let MASKS: [number, number, number][] | null = null;
function splitMasks(): [number, number, number][] {
  if (MASKS) return MASKS;
  const out: [number, number, number][] = [];
  const bits = (m: number) => [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((i) => m & (1 << i));
  const triples: number[] = [];
  for (let m = 0; m < 512; m++) if (bits(m).length === 3) triples.push(m);
  for (const x of triples) {
    if (!(x & 1)) continue; // the first group always holds position 0
    const rest = 511 & ~x;
    const low = rest & -rest; // the second group holds the lowest remaining position
    for (const y of triples) {
      if ((y & x) !== 0 || !(y & low) || (y & ~rest) !== 0) continue;
      out.push([x, y, rest & ~y]);
    }
  }
  MASKS = out;
  return out;
}

const cardsOf = (hand: Card[], mask: number) => hand.filter((_, i) => mask & (1 << i));

/** All 280 ways to split nine cards into three unordered groups of three. */
export function allSplits(hand: Card[]): Card[][][] {
  return splitMasks().map((m) => m.map((x) => cardsOf(hand, x)));
}

/** Score every three-card group of the hand once. */
function groupScores(hand: Card[], cfg: KittiConfig): Map<number, number> {
  const map = new Map<number, number>();
  for (const m of splitMasks())
    for (const x of m) if (!map.has(x)) map.set(x, scoreOf(cardsOf(hand, x), cfg));
  return map;
}

/** Medium: the split whose strongest group is best, then the next, in descending order. */
export function bestSplit(hand: Card[], cfg: KittiConfig): Card[][] {
  const scores = groupScores(hand, cfg);
  let best: [number, number, number] | null = null;
  let bestKey: number[] = [];
  for (const m of splitMasks()) {
    const ordered = m.slice().sort((x, y) => scores.get(y)! - scores.get(x)!) as [
      number,
      number,
      number,
    ];
    const key = ordered.map((x) => scores.get(x)!);
    let better = !best;
    if (best) {
      for (let i = 0; i < 3; i++) {
        if (key[i] !== bestKey[i]) {
          better = key[i] > bestKey[i];
          break;
        }
      }
    }
    if (better) {
      best = ordered;
      bestKey = key;
    }
  }
  return best!.map((x) => cardsOf(hand, x));
}

function validGroups(hand: Card[], groups: number[][], cfg: KittiConfig): Card[][] | null {
  if (groups.length !== 3 || groups.some((g) => g.length !== 3)) return null;
  const flat = groups.flat();
  if (new Set(flat).size !== 9) return null;
  const byId = new Map(hand.map((c) => [c.id, c]));
  const cards = groups.map((g) => g.map((id) => byId.get(id)));
  if (cards.some((g) => g.some((c) => !c))) return null;
  const real = cards as Card[][];
  if (cfg.descending) {
    const sc = real.map((g) => scoreOf(g, cfg));
    if (!(sc[0] >= sc[1] && sc[1] >= sc[2])) return null;
  }
  return real;
}

function funded(chips: number[], boot: number) {
  return chips.map((c) => c >= boot);
}

function deal(
  prev: Pick<KState, 'n' | 'config' | 'humans' | 'levels' | 'chips' | 'start' | 'pot'>,
  round: number,
  dealer: number,
  rng: Rng,
): Step<KState> {
  const cfg = prev.config;
  const n = prev.n;
  const ok = funded(prev.chips, cfg.boot);
  const chips = prev.chips.slice();
  let pot = prev.pot;
  for (let i = 0; i < n; i++)
    if (ok[i]) {
      chips[i] -= cfg.boot;
      pot += cfg.boot;
    }
  const deck = shuffledDeck(rng);
  const hands: Card[][] = Array.from({ length: n }, () => []);
  for (let k = 0; k < 9; k++) for (let i = 0; i < n; i++) if (ok[i]) hands[i].push(deck.pop()!);
  const s: KState = {
    n,
    config: cfg,
    humans: prev.humans,
    levels: prev.levels,
    hands,
    groups: Array(n).fill(null),
    packed: ok.map((x) => !x),
    inRound: ok,
    chips,
    start: prev.start,
    pot,
    dealer,
    round,
    phase: 'arrange',
    showdown: null,
  };
  return {
    state: s,
    events: [
      ev.note('roundStart', { round, dealer, boot: cfg.boot, pot }),
      ...hands.map((h, seat) => (ok[seat] ? ev.deal(seat, h) : ev.note('sitOut', undefined, seat))),
    ],
  };
}

function setup(players: PlayerInfo[], config: KittiConfig, rng: Rng): Step<KState> {
  if (players.length < 2 || players.length > 5) throw new Error('Kitti needs 2 to 5 players');
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
      pot: 0,
    },
    0,
    rng.int(n),
    rng,
  );
}

const waiting = (s: KState) =>
  Array.from({ length: s.n }, (_, i) => i).filter(
    (i) => s.inRound[i] && !s.packed[i] && s.groups[i] === null,
  );

function legalActions(s: KState, seat: number): KAction[] {
  if (s.phase === 'over') return [];
  if (s.phase === 'roundEnd')
    return s.humans[seat] || !s.humans.some(Boolean) ? [{ type: 'next' }] : [];
  if (!waiting(s).includes(seat)) return [];
  // arranging has too many combinations to list; apply() validates any arrangement
  const out: KAction[] = [{ type: 'auto' }];
  if (s.config.packFirst) out.push({ type: 'pack' });
  return out;
}

function currentActors(s: KState): number[] {
  if (s.phase === 'over') return [];
  if (s.phase === 'roundEnd') {
    const hs = Array.from({ length: s.n }, (_, i) => i).filter((i) => s.humans[i]);
    return hs.length ? hs : [0];
  }
  return waiting(s);
}

/** Compare the three shows, decide the winner and move chips. */
function showdown(s: KState, events: GameEvent[]) {
  const seats = Array.from({ length: s.n }, (_, i) => i).filter(
    (i) => s.inRound[i] && !s.packed[i],
  );
  const cfg = s.config;
  const groups: Card[][][] = Array.from({ length: s.n }, () => []);
  for (const seat of seats) {
    const byId = new Map(s.hands[seat].map((c) => [c.id, c]));
    groups[seat] = s.groups[seat]!.map((g) => g.map((id) => byId.get(id)!));
  }
  const order = seats.slice().sort((a, b) => {
    const da = (a - s.dealer + s.n) % s.n;
    const db = (b - s.dealer + s.n) % s.n;
    return cfg.direction === 'ccw' ? db - da : da - db;
  });
  const showWinners: (number | null)[] = [];
  for (let k = 0; k < 3; k++) {
    const scores = seats.map((seat) => scoreOf(groups[seat][k], cfg));
    const best = Math.max(...scores);
    const tied = seats.filter((_, i) => scores[i] === best);
    if (tied.length === 1) showWinners.push(tied[0]);
    else if (cfg.tieRule === 'earlier') showWinners.push(order.find((x) => tied.includes(x))!);
    else showWinners.push(null);
  }
  const wins = Array(s.n).fill(0);
  showWinners.forEach((w) => w !== null && wins[w]++);
  let winner: number | null = null;
  for (const seat of seats) {
    const w = showWinners.map((x) => x === seat);
    const ok =
      cfg.winRule === 'any2'
        ? wins[seat] >= 2
        : (w[0] && w[1]) || (w[1] && w[2]) || wins[seat] === 3;
    if (ok) winner = seat;
  }
  const salami = winner !== null && wins[winner] === 3;
  const payout = Array(s.n).fill(0);
  if (winner !== null) {
    payout[winner] = s.pot;
    s.chips[winner] += s.pot;
    s.pot = 0;
    if (salami && cfg.salamiBonus) {
      for (const seat of seats) {
        if (seat === winner) continue;
        const extra = Math.min(cfg.boot, s.chips[seat]);
        s.chips[seat] -= extra;
        s.chips[winner] += extra;
        payout[seat] -= extra;
        payout[winner] += extra;
      }
    }
  }
  s.showdown = { groups, showWinners, winner, salami, payout };
  const left = funded(s.chips, cfg.boot).filter(Boolean).length;
  const over = s.round + 1 >= cfg.rounds || left < 2;
  s.phase = over ? 'over' : 'roundEnd';
  events.push(ev.note('showdown', { showWinners, winner, salami, kitti: winner === null }));
  if (over) events.push(ev.note('gameEnd'));
}

function apply(state: KState, seat: number, a: KAction, rng: Rng): Step<KState> {
  const s: KState = {
    ...state,
    groups: state.groups.slice(),
    packed: state.packed.slice(),
    chips: state.chips.slice(),
  };
  const events: GameEvent[] = [];

  if (a.type === 'next') {
    if (!legalActions(s, seat).some((l) => l.type === 'next'))
      throw new IllegalActionError('illegal action');
    return deal(s, s.round + 1, nextSeat(s.dealer, s.n, s.config.direction), rng);
  }
  if (!waiting(s).includes(seat)) throw new IllegalActionError('not your turn');

  if (a.type === 'pack') {
    if (!s.config.packFirst) throw new IllegalActionError('packing is off');
    s.packed[seat] = true;
    events.push(ev.note('pack', undefined, seat));
  } else if (a.type === 'auto') {
    const split = bestSplit(s.hands[seat], s.config);
    s.groups[seat] = split.map((g) => g.map((c) => c.id));
    events.push(ev.note('arranged', { auto: true }, seat));
  } else {
    const ok = validGroups(s.hands[seat], a.groups, s.config);
    if (!ok) throw new IllegalActionError('invalid arrangement');
    s.groups[seat] = a.groups.map((g) => g.slice());
    events.push(ev.note('arranged', undefined, seat));
  }

  const left = Array.from({ length: s.n }, (_, i) => i).filter((i) => s.inRound[i] && !s.packed[i]);
  if (left.length === 1) {
    // everyone else packed: the last player takes the pot without a show
    s.chips[left[0]] += s.pot;
    const payout = Array(s.n).fill(0);
    payout[left[0]] = s.pot;
    s.pot = 0;
    s.showdown = {
      groups: Array.from({ length: s.n }, () => []),
      showWinners: [null, null, null],
      winner: left[0],
      salami: false,
      payout,
    };
    const funds = funded(s.chips, s.config.boot).filter(Boolean).length;
    const over = s.round + 1 >= s.config.rounds || funds < 2;
    s.phase = over ? 'over' : 'roundEnd';
    events.push(ev.note('showdown', { winner: left[0], noShow: true }));
    if (over) events.push(ev.note('gameEnd'));
    return { state: s, events };
  }
  if (waiting(s).length === 0) showdown(s, events);
  return { state: s, events };
}

function view(s: KState, seat: ViewerSeat): KView {
  const legal = seat === 'spectator' ? [] : legalActions(s, seat);
  return {
    seat,
    config: s.config,
    n: s.n,
    hand: seat === 'spectator' ? [] : s.hands[seat],
    submitted: s.groups.map((g) => g !== null),
    packed: s.packed,
    inRound: s.inRound,
    chips: s.chips,
    start: s.start,
    pot: s.pot,
    dealer: s.dealer,
    round: s.round,
    rounds: s.config.rounds,
    phase: s.phase,
    showdown: s.showdown,
    mine: seat === 'spectator' ? null : s.groups[seat],
    canArrange: legal.some((a) => a.type === 'auto'),
    canPack: legal.some((a) => a.type === 'pack'),
    canNext: legal.some((a) => a.type === 'next'),
  };
}

function result(s: KState): GameResult | null {
  if (s.phase !== 'over') return null;
  const delta = s.chips.map((c, i) => c - s.start[i]);
  const max = Math.max(...delta);
  return {
    scores: s.chips.slice(),
    winners: delta.flatMap((d, i) => (d === max ? [i] : [])),
    chipDelta: delta,
  };
}

function bot(v: KView, legal: KAction[], level: Difficulty, rng: Rng): KAction {
  const first = legal[0];
  if (!first) throw new Error('bot has no legal action');
  if (first.type === 'next') return first;
  const hand = v.hand;
  if (hand.length !== 9) return first;
  let groups: Card[][];
  if (level === 'easy') {
    const shuffled = rng.shuffle(hand);
    groups = [shuffled.slice(0, 3), shuffled.slice(3, 6), shuffled.slice(6)];
  } else if (level === 'medium') groups = bestSplit(hand, v.config);
  else groups = sampledSplit(hand, v.config, rng);
  const ids = groups.map((g) => g.map((c) => c.id));
  // the descending option can reject a hand-picked order: fall back to the safe split
  if (v.config.descending) {
    const sc = groups.map((g) => scoreOf(g, v.config));
    if (!(sc[0] >= sc[1] && sc[1] >= sc[2])) return { type: 'auto' };
  }
  return { type: 'arrange', groups: ids };
}

/** Hard: choose the split with the best chance of winning two shows against random opponents. */
function sampledSplit(hand: Card[], cfg: KittiConfig, rng: Rng): Card[][] {
  const mine = new Set(hand.map((c) => c.id));
  const pool = shuffledDeck(rng).filter((c) => !mine.has(c.id));
  const opponents = 2;
  const samples: Card[][][] = [];
  for (let k = 0; k < 24; k++) {
    const take = rng.shuffle(pool).slice(0, 9 * opponents);
    for (let o = 0; o < opponents; o++) {
      const h = take.slice(o * 9, o * 9 + 9);
      samples.push(
        [h.slice(0, 3), h.slice(3, 6), h.slice(6, 9)].sort(
          (x, y) => scoreOf(y, cfg) - scoreOf(x, cfg),
        ),
      );
    }
  }
  let best: Card[][] | null = null;
  let bestP = -1;
  const scores = groupScores(hand, cfg);
  const cands = splitMasks()
    .map((m) => m.slice().sort((x, y) => scores.get(y)! - scores.get(x)!))
    .sort((p, q) => scores.get(q[0])! - scores.get(p[0])!)
    .slice(0, 40)
    .map((m) => m.map((x) => cardsOf(hand, x)));
  for (const split of cands) {
    const sc = split.map((g) => scoreOf(g, cfg));
    let wins = 0;
    for (let k = 0; k < samples.length; k += opponents) {
      let showsWon = 0;
      for (let g = 0; g < 3; g++) {
        let beaten = true;
        for (let o = 0; o < opponents; o++)
          if (scoreOf(samples[k + o][g], cfg) >= sc[g]) beaten = false;
        if (beaten) showsWon++;
      }
      if (showsWon >= 2) wins++;
    }
    if (wins > bestP) {
      bestP = wins;
      best = split;
    }
  }
  return best ?? bestSplit(hand, cfg);
}

export const kitti: GameDefinition<KState, KAction, KittiConfig, KView> = {
  id: 'kitti',
  nameKey: 'game.kitti',
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
  timerSeats: (s) => (s.phase === 'arrange' ? waiting(s).filter((i) => s.humans[i]) : []),
  timeoutAction(s) {
    if (s.phase === 'roundEnd') return { type: 'next' };
    return { type: 'auto' };
  },
  result,
  isPlayPhase: (s) => s.phase === 'arrange',
  bot,
  invariants(s) {
    const total = s.chips.reduce((a, b) => a + b, 0) + s.pot;
    if (total !== s.start.reduce((a, b) => a + b, 0)) return 'kitti: chips not conserved';
    if (s.chips.some((c) => c < 0)) return 'kitti: negative chips';
    return null;
  },
};
