import type { Card } from '../../core/cards';
import { shuffledDeck } from '../../core/deck';
import { ev, filterEventsDefault, type GameEvent, type ViewerSeat } from '../../core/events';
import type { Rng } from '../../core/rng';
import { nextSeat } from '../../core/seats';
import {
  compareHands,
  evaluate,
  evaluateWild,
  strengthPercentile,
  type Evaluated,
  type ThreeCardOptions,
} from '../../core/threeCard';
import {
  IllegalActionError,
  type Difficulty,
  type GameDefinition,
  type GameResult,
  type PlayerInfo,
  type Step,
} from '../../core/types';
import { configSchema, defaultConfig, presets, type TeenPattiConfig } from './config';

export type { TeenPattiConfig };

export type TPAction =
  | { type: 'look' }
  | { type: 'bet' }
  | { type: 'raise' }
  | { type: 'pack' }
  | { type: 'sideshow' }
  | { type: 'show' }
  | { type: 'accept' }
  | { type: 'refuse' }
  | { type: 'next' };

export interface TPState {
  n: number;
  config: TeenPattiConfig;
  humans: boolean[];
  levels: Difficulty[];
  hands: Card[][];
  /** playing this round (had at least the boot) */
  inRound: boolean[];
  seen: boolean[];
  packed: boolean[];
  blindTurns: number[];
  chips: number[];
  start: number[];
  /** chips each player put in this round */
  put: number[];
  pot: number;
  stake: number;
  turn: number;
  dealer: number;
  round: number;
  phase: 'bet' | 'sideshow' | 'roundEnd' | 'over';
  sideShow: { asker: number; target: number } | null;
  wildRank: number | null;
  /** hands revealed at a show, for the round summary */
  reveal: { seat: number; cards: Card[] }[];
  winners: number[];
  lastGain: number[];
  deck: Card[];
}

export interface TPView {
  seat: number | 'spectator';
  config: TeenPattiConfig;
  n: number;
  hand: Card[];
  handLabel: string | null;
  seen: boolean[];
  packed: boolean[];
  inRound: boolean[];
  blindTurns: number[];
  chips: number[];
  start: number[];
  put: number[];
  pot: number;
  stake: number;
  turn: number;
  dealer: number;
  round: number;
  rounds: number;
  phase: TPState['phase'];
  sideShow: { asker: number; target: number } | null;
  wildRank: number | null;
  reveal: TPState['reveal'];
  winners: number[];
  lastGain: number[];
  betCost: number;
  raiseCost: number;
  showCost: number;
  can: {
    look: boolean;
    bet: boolean;
    raise: boolean;
    pack: boolean;
    sideshow: boolean;
    show: boolean;
    accept: boolean;
    next: boolean;
  };
  /** after a side show: only the two players see both hands */
  sideShowPeek: { asker: Card[]; target: Card[]; askerPacked: boolean } | null;
}

const next = (s: Pick<TPState, 'n' | 'config'>, seat: number) =>
  nextSeat(seat, s.n, s.config.direction);
const wildFn = (s: Pick<TPState, 'config' | 'wildRank'>) => {
  if (s.config.variant === 'ak47') return (c: Card) => [1, 13, 4, 7].includes(c.rank);
  if (s.config.variant === 'joker' && s.wildRank !== null)
    return (c: Card) => c.rank === s.wildRank;
  return null;
};
const optsOf = (c: TeenPattiConfig): ThreeCardOptions => ({ a23: c.a23 });

/** Score a hand under the table's variant: higher is always better for the holder. */
export function handScore(s: Pick<TPState, 'config' | 'wildRank'>, cards: Card[]): Evaluated {
  const w = wildFn(s);
  const lowest = s.config.variant === 'muflis';
  const e = w
    ? evaluateWild(cards, w, optsOf(s.config), lowest)
    : evaluate(cards, optsOf(s.config));
  return e;
}
const better = (s: TPState, a: Card[], b: Card[]) =>
  compareHands(handScore(s, a), handScore(s, b), s.config.variant === 'muflis');

const alive = (s: TPState) =>
  Array.from({ length: s.n }, (_, i) => i).filter((i) => s.inRound[i] && !s.packed[i]);
const prevAlive = (s: TPState, seat: number) => {
  let x = seat;
  for (let i = 0; i < s.n; i++) {
    x = nextSeat(x, s.n, s.config.direction === 'ccw' ? 'cw' : 'ccw');
    if (s.inRound[x] && !s.packed[x]) return x;
  }
  return seat;
};
const nextAlive = (s: TPState, seat: number) => {
  let x = seat;
  for (let i = 0; i < s.n; i++) {
    x = next(s, x);
    if (s.inRound[x] && !s.packed[x]) return x;
  }
  return seat;
};

const betCost = (s: TPState, seat: number) => (s.seen[seat] ? 2 : 1) * s.stake;
const raiseCost = (s: TPState, seat: number) => (s.seen[seat] ? 4 : 2) * s.stake;

function legalActions(s: TPState, seat: number): TPAction[] {
  if (s.phase === 'over') return [];
  if (s.phase === 'roundEnd')
    return s.humans[seat] || !s.humans.some(Boolean) ? [{ type: 'next' }] : [];
  if (s.phase === 'sideshow') {
    return s.sideShow && seat === s.sideShow.target ? [{ type: 'accept' }, { type: 'refuse' }] : [];
  }
  if (seat !== s.turn || !s.inRound[seat] || s.packed[seat]) return [];
  const out: TPAction[] = [];
  const left = alive(s).length;
  if (!s.seen[seat]) out.push({ type: 'look' });
  const chips = s.chips[seat];
  const maxStake = s.config.maxStakeMult * s.config.boot;
  if (left === 2) {
    if (chips >= betCost(s, seat)) out.push({ type: 'show' });
  } else if (chips >= betCost(s, seat)) {
    out.push({ type: 'bet' });
  }
  if (left > 2 && chips >= raiseCost(s, seat) && s.stake * 2 <= maxStake)
    out.push({ type: 'raise' });
  if (left === 2 && chips >= raiseCost(s, seat) && s.stake * 2 <= maxStake)
    out.push({ type: 'raise' });
  if (
    left > 2 &&
    s.config.sideShow &&
    s.seen[seat] &&
    chips >= betCost(s, seat) &&
    s.seen[prevAlive(s, seat)]
  )
    out.push({ type: 'sideshow' });
  out.push({ type: 'pack' });
  return out;
}

function currentActors(s: TPState): number[] {
  if (s.phase === 'over') return [];
  if (s.phase === 'roundEnd') {
    const hs = Array.from({ length: s.n }, (_, i) => i).filter((i) => s.humans[i]);
    return hs.length ? hs : [0];
  }
  if (s.phase === 'sideshow') return s.sideShow ? [s.sideShow.target] : [];
  return [s.turn];
}

function funded(s: Pick<TPState, 'chips' | 'config'>) {
  return s.chips.map((c) => c >= s.config.boot);
}

function dealRound(
  prev: Pick<TPState, 'n' | 'config' | 'humans' | 'levels' | 'chips' | 'start'>,
  round: number,
  dealer: number,
  rng: Rng,
): Step<TPState> {
  const cfg = prev.config;
  const n = prev.n;
  const ok = funded(prev);
  const deck = shuffledDeck(rng);
  const hands: Card[][] = Array.from({ length: n }, () => []);
  const chips = prev.chips.slice();
  let pot = 0;
  const put = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (!ok[i]) continue;
    chips[i] -= cfg.boot;
    put[i] = cfg.boot;
    pot += cfg.boot;
  }
  for (let k = 0; k < 3; k++) for (let i = 0; i < n; i++) if (ok[i]) hands[i].push(deck.pop()!);
  let wildRank: number | null = null;
  const events: GameEvent[] = [ev.note('roundStart', { round, dealer, boot: cfg.boot })];
  if (cfg.variant === 'joker') {
    const j = deck.pop()!;
    wildRank = j.rank;
    events.push({ type: 'joker', cards: [j], from: { kind: 'deck' }, to: { kind: 'table' } });
  }
  for (let i = 0; i < n; i++)
    if (ok[i])
      events.push({
        type: 'deal',
        seat: i,
        count: 3,
        from: { kind: 'deck' },
        to: { kind: 'hand', seat: i },
      });
  const s: TPState = {
    n,
    config: cfg,
    humans: prev.humans,
    levels: prev.levels,
    hands,
    inRound: ok,
    seen: Array(n).fill(false),
    packed: ok.map((x) => !x),
    blindTurns: Array(n).fill(0),
    chips,
    start: prev.start,
    put,
    pot,
    stake: cfg.boot,
    turn: 0,
    dealer,
    round,
    phase: 'bet',
    sideShow: null,
    wildRank,
    reveal: [],
    winners: [],
    lastGain: Array(n).fill(0),
    deck,
  };
  let first = next(s, dealer);
  for (let i = 0; i < n && !ok[first]; i++) first = next(s, first);
  s.turn = first;
  return { state: s, events };
}

function setup(players: PlayerInfo[], config: TeenPattiConfig, rng: Rng): Step<TPState> {
  if (players.length < 2 || players.length > 7) throw new Error('Teen Patti needs 2 to 7 players');
  const cfg = { ...defaultConfig, ...config };
  const n = players.length;
  return dealRound(
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

function pay(s: TPState, seat: number, amount: number) {
  s.chips[seat] -= amount;
  s.put[seat] += amount;
  s.pot += amount;
}

function finishRound(s: TPState, winners: number[], events: GameEvent[]) {
  const share = Math.floor(s.pot / winners.length);
  let rest = s.pot - share * winners.length;
  const gain = Array(s.n).fill(0);
  for (const w of winners) {
    const g = share + (rest > 0 ? 1 : 0);
    if (rest > 0) rest -= 1;
    s.chips[w] += g;
    gain[w] = g;
  }
  s.lastGain = gain.map((g, i) => g - s.put[i]);
  s.winners = winners;
  s.pot = 0;
  s.phase = 'roundEnd';
  s.sideShow = null;
  const left = funded(s).filter(Boolean).length;
  const over = s.round + 1 >= s.config.rounds || left < 2;
  if (over) s.phase = 'over';
  events.push(ev.note('roundEnd', { winners, gain: s.lastGain }));
  if (over) events.push(ev.note('gameEnd'));
}

function autoLook(s: TPState, events: GameEvent[]) {
  const t = s.turn;
  if (!s.seen[t] && s.blindTurns[t] >= s.config.maxBlind) {
    s.seen[t] = true;
    events.push({
      type: 'look',
      seat: t,
      cards: s.hands[t],
      visibleTo: [t],
      data: { forced: true },
    });
  }
}

function passTurn(s: TPState, from: number, events: GameEvent[]) {
  s.turn = nextAlive(s, from);
  autoLook(s, events);
}

function checkPotLimit(s: TPState, events: GameEvent[]): boolean {
  if (s.pot < s.config.potLimitMult * s.config.boot) return false;
  const seats = alive(s);
  showdown(s, seats, events, null);
  return true;
}

/** Compare the given hands; best wins (muflis: lowest). Exact ties split, or the asker loses when set. */
function showdown(s: TPState, seats: number[], events: GameEvent[], asker: number | null) {
  s.reveal = seats.map((seat) => ({ seat, cards: s.hands[seat] }));
  events.push({
    type: 'show',
    data: { seats },
    cards: seats.flatMap((i) => s.hands[i]),
  });
  let best = seats[0];
  for (const seat of seats.slice(1)) if (better(s, s.hands[seat], s.hands[best]) > 0) best = seat;
  let winners = seats.filter((seat) => better(s, s.hands[seat], s.hands[best]) === 0);
  if (winners.length > 1 && asker !== null && s.config.tieShow === 'asker') {
    winners = winners.filter((w) => w !== asker);
    if (winners.length === 0) winners = [best];
  }
  finishRound(s, winners, events);
}

function apply(state: TPState, seat: number, a: TPAction, rng: Rng): Step<TPState> {
  const s: TPState = {
    ...state,
    seen: state.seen.slice(),
    packed: state.packed.slice(),
    blindTurns: state.blindTurns.slice(),
    chips: state.chips.slice(),
    put: state.put.slice(),
    reveal: [],
  };
  const legal = legalActions(s, seat);
  if (!legal.some((l) => l.type === a.type)) throw new IllegalActionError('illegal action');
  const events: GameEvent[] = [];

  switch (a.type) {
    case 'next':
      return dealRound(s, s.round + 1, nextSeat(s.dealer, s.n, s.config.direction), rng);
    case 'look':
      s.seen[seat] = true;
      events.push({ type: 'look', seat, cards: s.hands[seat], visibleTo: [seat] });
      return { state: s, events };
    case 'pack': {
      s.packed[seat] = true;
      events.push(ev.note('pack', undefined, seat));
      const left = alive(s);
      if (left.length === 1) {
        finishRound(s, left, events);
        return { state: s, events };
      }
      passTurn(s, seat, events);
      return { state: s, events };
    }
    case 'bet': {
      const cost = betCost(s, seat);
      pay(s, seat, cost);
      if (!s.seen[seat]) s.blindTurns[seat] += 1;
      events.push(ev.note('bet', { amount: cost, blind: !s.seen[seat] }, seat));
      if (checkPotLimit(s, events)) return { state: s, events };
      passTurn(s, seat, events);
      return { state: s, events };
    }
    case 'raise': {
      const cost = raiseCost(s, seat);
      pay(s, seat, cost);
      s.stake *= 2;
      if (!s.seen[seat]) s.blindTurns[seat] += 1;
      events.push(ev.note('raise', { amount: cost, stake: s.stake, blind: !s.seen[seat] }, seat));
      if (checkPotLimit(s, events)) return { state: s, events };
      passTurn(s, seat, events);
      return { state: s, events };
    }
    case 'show': {
      const cost = betCost(s, seat);
      pay(s, seat, cost);
      events.push(ev.note('showCall', { amount: cost }, seat));
      showdown(s, alive(s), events, seat);
      return { state: s, events };
    }
    case 'sideshow': {
      pay(s, seat, betCost(s, seat));
      s.sideShow = { asker: seat, target: prevAlive(s, seat) };
      s.phase = 'sideshow';
      events.push(
        ev.note('sideshowAsk', { target: s.sideShow.target, amount: betCost(s, seat) }, seat),
      );
      return { state: s, events };
    }
    case 'refuse':
    case 'accept': {
      const { asker, target } = s.sideShow!;
      s.sideShow = null;
      s.phase = 'bet';
      if (a.type === 'refuse') {
        events.push(ev.note('sideshowRefused', undefined, target));
      } else {
        const cmp = better(s, s.hands[asker], s.hands[target]);
        const loser = cmp > 0 ? target : asker; // a tie packs the asker
        s.packed[loser] = true;
        events.push({
          type: 'sideshowResult',
          seat: asker,
          cards: [...s.hands[asker], ...s.hands[target]],
          visibleTo: [asker, target],
          data: { asker, target, loser },
        });
        events.push(ev.note('pack', { bySideShow: true }, loser));
      }
      const left = alive(s);
      if (left.length === 1) {
        finishRound(s, left, events);
        return { state: s, events };
      }
      passTurn(s, asker, events);
      return { state: s, events };
    }
  }
}

function view(s: TPState, seat: ViewerSeat): TPView {
  const legal = seat === 'spectator' ? [] : legalActions(s, seat);
  const has = (t: TPAction['type']) => legal.some((a) => a.type === t);
  const mine = seat !== 'spectator' && s.seen[seat] ? s.hands[seat] : [];
  const showdownDone = s.phase === 'roundEnd' || s.phase === 'over';
  return {
    seat,
    config: s.config,
    n: s.n,
    hand:
      showdownDone && seat !== 'spectator' && s.reveal.some((r) => r.seat === seat)
        ? s.hands[seat]
        : mine,
    handLabel: mine.length === 3 ? evaluateLabel(s, mine) : null,
    seen: s.seen,
    packed: s.packed,
    inRound: s.inRound,
    blindTurns: s.blindTurns,
    chips: s.chips,
    start: s.start,
    put: s.put,
    pot: s.pot,
    stake: s.stake,
    turn: s.turn,
    dealer: s.dealer,
    round: s.round,
    rounds: s.config.rounds,
    phase: s.phase,
    sideShow: s.sideShow,
    wildRank: s.wildRank,
    reveal: showdownDone ? s.reveal : [],
    winners: s.winners,
    lastGain: s.lastGain,
    betCost: seat !== 'spectator' ? betCost(s, seat) : 0,
    raiseCost: seat !== 'spectator' ? raiseCost(s, seat) : 0,
    showCost: seat !== 'spectator' ? betCost(s, seat) : 0,
    can: {
      look: has('look'),
      bet: has('bet'),
      raise: has('raise'),
      pack: has('pack'),
      sideshow: has('sideshow'),
      show: has('show'),
      accept: has('accept'),
      next: has('next'),
    },
    sideShowPeek: null,
  };
}

function evaluateLabel(s: TPState, cards: Card[]): string {
  return handScore(s, cards).category;
}

function result(s: TPState): GameResult | null {
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

const PACK_AT: Record<Difficulty, number> = { easy: 0.3, medium: 0.4, hard: 0.42 };
const RAISE_AT: Record<Difficulty, number> = { easy: 0.88, medium: 0.8, hard: 0.76 };

function percentileOf(v: TPView): number {
  if (v.hand.length !== 3) return 0.5;
  const score = handScore({ config: v.config, wildRank: v.wildRank }, v.hand).score;
  const pct = strengthPercentile(score, { a23: v.config.a23 });
  return v.config.variant === 'muflis' ? 1 - pct : pct;
}

function bot(v: TPView, legal: TPAction[], level: Difficulty, rng: Rng): TPAction {
  const first = legal[0];
  if (!first) throw new Error('bot has no legal action');
  const has = (t: TPAction['type']) => legal.some((a) => a.type === t);
  const act = (t: TPAction['type']): TPAction => ({ type: t }) as TPAction;
  if (has('next')) return act('next');
  const me = v.seat as number;

  if (has('accept')) return percentileOf(v) > 0.5 ? act('accept') : act('refuse');

  // blind play: a few turns, then look
  if (!v.seen[me] && has('look')) {
    const blindFor = 1 + ((me + v.round) % 3);
    const tooRich = v.stake >= v.config.boot * 8;
    if (v.blindTurns[me] >= blindFor || tooRich || rng.next() < 0.15) return act('look');
    if (has('bet')) return act('bet');
    if (has('show')) return act('show');
    return act('look');
  }

  const pct = percentileOf(v);
  const stakeRatio = v.stake / v.config.boot;
  const packAt = PACK_AT[level] + Math.min(0.25, Math.log2(Math.max(1, stakeRatio)) * 0.04);
  const bluff = level === 'hard' && rng.next() < 0.08;
  if (pct < packAt && !bluff && has('pack')) {
    // a nearly free show when two are left is still worth it
    if (!(has('show') && v.showCost <= v.config.boot && pct > 0.25)) return act('pack');
  }
  if (has('show')) return pct > 0.45 || bluff ? act('show') : act('pack');
  if (has('raise') && (pct > RAISE_AT[level] || bluff) && rng.next() < 0.6) return act('raise');
  if (has('sideshow') && level !== 'easy' && pct > 0.6 && rng.next() < 0.3) return act('sideshow');
  if (has('bet')) return act('bet');
  return has('pack') ? act('pack') : first;
}

export const teenPatti: GameDefinition<TPState, TPAction, TeenPattiConfig, TPView> = {
  id: 'teenpatti',
  nameKey: 'game.teenpatti',
  minPlayers: 2,
  maxPlayers: 7,
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
    if (s.phase === 'sideshow') return { type: 'refuse' };
    const legal = legalActions(s, seat);
    if (s.config.autoChaal && legal.some((a) => a.type === 'bet')) return { type: 'bet' };
    return { type: 'pack' };
  },
  result,
  isPlayPhase: (s) => s.phase === 'bet' || s.phase === 'sideshow',
  bot,
  invariants(s) {
    const total = s.chips.reduce((a, b) => a + b, 0) + s.pot;
    const expected = s.start.reduce((a, b) => a + b, 0);
    if (total !== expected) return `teenpatti: chips not conserved ${total}/${expected}`;
    if (s.chips.some((c) => c < 0)) return 'teenpatti: negative chips';
    return null;
  },
};
