import { ev, filterEventsDefault, type GameEvent, type ViewerSeat } from '../../core/events';
import type { Rng } from '../../core/rng';
import {
  IllegalActionError,
  type GameDefinition,
  type GameResult,
  type PlayerInfo,
  type Step,
} from '../../core/types';
import { rangiBot } from './bot';
import { configSchema, defaultConfig, presets, type RangiConfig } from './config';
import {
  COLORS,
  DECK_SIZE,
  canStack,
  handPoints,
  identical,
  isWild,
  makeRangiDeck,
  matches,
  wild4Honest,
  type RCard,
  type RColor,
} from './rules';
import type { PlayOption, RangiAction, RangiState, RangiView } from './view';

export type { RangiAction, RangiState, RangiView, RangiConfig };

/** how often a bot forgets to call Ek, by level */
const FORGET: Record<string, number> = { easy: 0.3, medium: 0.05, hard: 0 };

const dirOf = (c: RangiConfig): 1 | -1 => (c.direction === 'cw' ? 1 : -1);
const next = (s: Pick<RangiState, 'n' | 'dir'>, from: number, steps = 1) =>
  (((from + s.dir * steps) % s.n) + s.n) % s.n;
const top = (s: RangiState) => s.discard[s.discard.length - 1];
/** Cards are never mutated, so copying the arrays is enough and much cheaper than a deep clone. */
const clone = (s: RangiState): RangiState => ({
  ...s,
  hands: s.hands.map((h) => h.slice()),
  draw: s.draw.slice(),
  discard: s.discard.slice(),
});
const actionKey = (a: RangiAction) =>
  a.type === 'play'
    ? `play|${a.cardId}|${a.color ?? ''}|${a.swapWith ?? ''}`
    : a.type === 'color'
      ? `color|${a.color}`
      : a.type;

const totals = (s: RangiState) =>
  Array.from({ length: s.n }, (_, i) => s.roundScores.reduce((t, r) => t + r[i], 0));

// ---------- drawing ----------

function canDrawAny(s: RangiState) {
  return s.draw.length + Math.max(0, s.discard.length - 1) > 0;
}

/** Draw `count` cards for `seat`; reshuffles the discard pile under the top card when needed. */
function drawCards(
  s: RangiState,
  seat: number,
  count: number,
  events: GameEvent[],
  rng: Rng,
): RCard[] {
  const got: RCard[] = [];
  for (let i = 0; i < count; i++) {
    if (s.draw.length === 0) {
      if (s.discard.length <= 1) break;
      const keep = s.discard.pop()!;
      s.draw = rng.shuffle(s.discard);
      s.discard = [keep];
      events.push(ev.note('reshuffle', { count: s.draw.length }));
    }
    const c = s.draw.pop()!;
    s.hands[seat].push(c);
    got.push(c);
  }
  if (got.length) {
    events.push({
      type: 'draw',
      seat,
      cards: got,
      from: { kind: 'deck' },
      to: { kind: 'hand', seat },
      visibleTo: [seat],
    });
  }
  return got;
}

// ---------- legality ----------

function playableNow(s: RangiState, seat: number, c: RCard): boolean {
  if (s.pending > 0) return canStack(c, s.pendingKind, s.config);
  if (c.value === 'wild4') {
    return s.config.challenge ? true : wild4Honest(s.hands[seat], s.color);
  }
  return matches(c, top(s), s.color);
}

function expandPlay(s: RangiState, seat: number, c: RCard, jump: boolean): RangiAction[] {
  const colors: (RColor | undefined)[] = isWild(c) ? [...COLORS] : [undefined];
  const swaps: (number | undefined)[] =
    s.config.sevenZero && c.value === 7 && s.n > 1
      ? Array.from({ length: s.n }, (_, i) => i).filter((i) => i !== seat)
      : [undefined];
  void jump;
  const out: RangiAction[] = [];
  for (const color of colors)
    for (const swapWith of swaps) {
      const a: RangiAction = { type: 'play', cardId: c.id };
      if (color) a.color = color;
      if (swapWith !== undefined) a.swapWith = swapWith;
      out.push(a);
    }
  return out;
}

function turnActions(s: RangiState, seat: number): RangiAction[] {
  const hand = s.hands[seat];
  if (s.drawnId !== null) {
    const c = hand.find((x) => x.id === s.drawnId);
    const plays = c && playableNow(s, seat, c) ? expandPlay(s, seat, c, false) : [];
    return [...plays, { type: 'pass' }];
  }
  const plays = hand
    .filter((c) => playableNow(s, seat, c))
    .flatMap((c) => expandPlay(s, seat, c, false));
  const out: RangiAction[] = [...plays];
  const mustPlay = s.config.mustPlay && s.pending === 0 && plays.length > 0;
  if (s.pending > 0 || (!mustPlay && canDrawAny(s))) out.push({ type: 'draw' });
  if (out.length === 0) out.push({ type: 'pass' });
  return out;
}

function legalActions(s: RangiState, seat: number): RangiAction[] {
  if (s.phase === 'over') return [];
  if (s.phase === 'roundEnd')
    return s.humans[seat] || !s.humans.some(Boolean) ? [{ type: 'next' }] : [];
  if (s.phase === 'color')
    return seat === s.turn ? COLORS.map((color) => ({ type: 'color' as const, color })) : [];
  if (s.phase === 'challenge')
    return s.challenge && seat === s.challenge.target
      ? [{ type: 'challenge' }, { type: 'accept' }]
      : [];
  const out: RangiAction[] = [];
  if (seat === s.turn) out.push(...turnActions(s, seat));
  else if (s.config.jumpIn && s.humans[seat] && s.pending === 0 && s.drawnId === null) {
    const t = top(s);
    for (const c of s.hands[seat]) if (identical(c, t)) out.push(...expandPlay(s, seat, c, true));
  }
  if (s.ek) {
    if (seat === s.ek.seat && !s.ek.called) out.push({ type: 'ek' });
    if (seat !== s.ek.seat && (s.humans[seat] || seat === s.turn)) out.push({ type: 'caught' });
  }
  return out;
}

function currentActors(s: RangiState): number[] {
  if (s.phase === 'over') return [];
  if (s.phase === 'roundEnd') {
    const hs = Array.from({ length: s.n }, (_, i) => i).filter((i) => s.humans[i]);
    return hs.length ? hs : [0];
  }
  if (s.phase === 'color') return [s.turn];
  if (s.phase === 'challenge') return s.challenge ? [s.challenge.target] : [];
  const actors = [s.turn];
  for (let i = 0; i < s.n; i++) {
    if (i !== s.turn && s.humans[i] && legalActions(s, i).length > 0) actors.push(i);
  }
  return actors;
}

// ---------- rounds ----------

function startRound(
  prev: Pick<RangiState, 'n' | 'config' | 'humans' | 'levels' | 'roundScores'>,
  round: number,
  dealer: number,
  rng: Rng,
): Step<RangiState> {
  const cfg = prev.config;
  const n = prev.n;
  const dir = dirOf(cfg);
  const draw = rng.shuffle(makeRangiDeck());
  const hands: RCard[][] = Array.from({ length: n }, () => []);
  const first = (((dealer + dir) % n) + n) % n;
  for (let k = 0; k < cfg.startCards; k++)
    for (let j = 0; j < n; j++) {
      const seat = (((first + dir * j) % n) + n) % n;
      hands[seat].push(draw.pop()!);
    }
  let flip = draw.pop()!;
  while (flip.value === 'wild4') {
    draw.splice(rng.int(draw.length + 1), 0, flip);
    flip = draw.pop()!;
  }
  const s: RangiState = {
    n,
    config: cfg,
    humans: prev.humans,
    levels: prev.levels,
    hands,
    draw,
    discard: [flip],
    color: flip.color === 'wild' ? 'sindoor' : flip.color,
    dir,
    turn: first,
    dealer,
    round,
    phase: 'play',
    pending: 0,
    pendingKind: null,
    drawnId: null,
    ek: null,
    challenge: null,
    roundScores: prev.roundScores,
    lastWinner: null,
    stall: 0,
  };
  const events: GameEvent[] = [
    ev.note('roundStart', { round, dealer }),
    ...hands.map((h, seat) => ev.deal(seat, h)),
    { type: 'flip', cards: [flip], from: { kind: 'deck' }, to: { kind: 'discard' } },
  ];
  // the first card's effect lands on the first player
  switch (flip.value) {
    case 'skip':
      s.turn = next(s, first);
      events.push(ev.note('skip', undefined, first));
      break;
    case 'reverse':
      s.dir = (s.dir * -1) as 1 | -1;
      s.turn = dealer;
      events.push(ev.note('reverse'));
      break;
    case 'draw2':
      drawCards(s, first, 2, events, rng);
      s.turn = next(s, first);
      break;
    case 'wild':
      s.phase = 'color';
      break;
    default:
      break;
  }
  return { state: s, events };
}

function endRound(s: RangiState, winner: number, events: GameEvent[]) {
  const points = s.hands.map((h, i) => (i === winner ? 0 : handPoints(h)));
  const won = points.reduce((a, b) => a + b, 0);
  const row = points.map((_, i) => (i === winner ? won : 0));
  s.roundScores = [...s.roundScores, row];
  s.lastWinner = winner;
  s.ek = null;
  s.challenge = null;
  s.pending = 0;
  s.pendingKind = null;
  s.drawnId = null;
  const tot = totals(s);
  const over = s.config.target === 0 || tot[winner] >= s.config.target;
  s.phase = over ? 'over' : 'roundEnd';
  events.push(ev.note('roundEnd', { winner, points: row, totals: tot }, winner));
  if (over) events.push(ev.note('gameEnd'));
}

// ---------- applying actions ----------

function applyPlay(
  s: RangiState,
  seat: number,
  a: Extract<RangiAction, { type: 'play' }>,
  rng: Rng,
  events: GameEvent[],
) {
  const hand = s.hands[seat];
  const card = hand.find((c) => c.id === a.cardId)!;
  const handBefore = hand.slice();
  const prevColor = s.color;
  const wasTurn = seat === s.turn;
  s.hands[seat] = hand.filter((c) => c.id !== card.id);
  s.discard.push(card);
  s.color = isWild(card) ? (a.color as RColor) : (card.color as RColor);
  s.drawnId = null;
  s.stall = 0;
  if (wasTurn) s.ek = null;
  events.push({
    type: 'play',
    seat,
    cards: [card],
    from: { kind: 'hand', seat },
    to: { kind: 'discard' },
    data: { color: s.color, jumpIn: !wasTurn },
  });
  if (!wasTurn) events.push(ev.note('jumpIn', undefined, seat));

  const emptied = s.hands[seat].length === 0;
  let skip = false;
  let penalty = 0;
  switch (card.value) {
    case 'skip':
      skip = true;
      events.push(ev.note('skip', undefined, next(s, seat)));
      break;
    case 'reverse':
      s.dir = (s.dir * -1) as 1 | -1;
      events.push(ev.note('reverse'));
      if (s.n === 2) skip = true;
      break;
    case 'draw2':
      if (s.config.stacking && !emptied) {
        s.pending += 2;
        s.pendingKind = 'draw2';
      } else penalty = 2;
      break;
    case 'wild4':
      if (emptied) penalty = 4;
      else if (s.config.challenge) {
        s.challenge = {
          offender: seat,
          target: next(s, seat),
          legal: wild4Honest(handBefore, prevColor),
        };
        s.phase = 'challenge';
        s.turn = s.challenge.target;
        events.push(ev.note('challengeOpen', undefined, seat));
        return;
      } else if (s.config.stacking) {
        s.pending += 4;
        s.pendingKind = 'wild4';
      } else penalty = 4;
      break;
    default:
      break;
  }
  if (s.config.sevenZero && !emptied) {
    if (card.value === 7 && a.swapWith !== undefined) {
      [s.hands[seat], s.hands[a.swapWith]] = [s.hands[a.swapWith], s.hands[seat]];
      events.push(ev.note('swap', { with: a.swapWith }, seat));
    } else if (card.value === 0) {
      const old = s.hands.map((h) => h);
      for (let i = 0; i < s.n; i++) s.hands[next(s, i)] = old[i];
      events.push(ev.note('rotateHands', { dir: s.dir }));
    }
  }
  const target = next(s, seat);
  if (penalty > 0) {
    drawCards(s, target, penalty, events, rng);
    s.turn = next(s, seat, 2);
  } else if (skip) s.turn = next(s, seat, 2);
  else s.turn = target;

  if (emptied) {
    endRound(s, seat, events);
    return;
  }
  // "Ek!" chance: humans must call it; bots call it themselves, easy ones forget now and then
  s.ek = null;
  if (s.config.callEk && s.hands[seat].length === 1) {
    const forgets = FORGET[s.levels[seat]] ?? 0;
    if (s.humans[seat] || rng.next() < forgets) s.ek = { seat, called: false };
    else events.push(ev.note('ek', undefined, seat));
  }
}

function applyStep(state: RangiState, seat: number, a: RangiAction, rng: Rng): Step<RangiState> {
  const s = clone(state);
  const events: GameEvent[] = [];
  const legal = legalActions(s, seat);
  if (!legal.some((l) => actionKey(l) === actionKey(a)))
    throw new IllegalActionError('illegal action');

  switch (a.type) {
    case 'next':
      return startRound(s, s.round + 1, next(s, s.dealer), rng);
    case 'color':
      s.color = a.color;
      s.phase = 'play';
      events.push(ev.note('color', { color: a.color }, seat));
      return { state: s, events };
    case 'ek':
      s.ek = null;
      events.push(ev.note('ek', undefined, seat));
      return { state: s, events };
    case 'caught': {
      const victim = s.ek!.seat;
      s.ek = null;
      events.push(ev.note('caught', { by: seat }, victim));
      drawCards(s, victim, 2, events, rng);
      return { state: s, events };
    }
    case 'challenge': {
      const ch = s.challenge!;
      s.challenge = null;
      s.phase = 'play';
      events.push(ev.note('challenge', { legal: ch.legal, offender: ch.offender }, ch.target));
      if (!ch.legal) {
        drawCards(s, ch.offender, 4, events, rng);
        s.turn = ch.target;
      } else {
        drawCards(s, ch.target, 6, events, rng);
        s.turn = next(s, ch.target);
      }
      return { state: s, events };
    }
    case 'accept': {
      const ch = s.challenge!;
      s.challenge = null;
      s.phase = 'play';
      events.push(ev.note('accept', undefined, ch.target));
      if (s.config.stacking) {
        s.pending += 4;
        s.pendingKind = 'wild4';
        s.turn = ch.target;
      } else {
        drawCards(s, ch.target, 4, events, rng);
        s.turn = next(s, ch.target);
      }
      return { state: s, events };
    }
    case 'pass':
      s.ek = null;
      if (s.drawnId === null) s.stall++;
      s.drawnId = null;
      s.turn = next(s, seat);
      events.push(ev.note('pass', undefined, seat));
      if (s.stall >= s.n * 2) {
        // nobody can play and nothing is left to draw: fewest cards wins
        let best = 0;
        for (let i = 1; i < s.n; i++) {
          const ci = s.hands[i].length;
          const cb = s.hands[best].length;
          if (ci < cb || (ci === cb && handPoints(s.hands[i]) < handPoints(s.hands[best])))
            best = i;
        }
        endRound(s, best, events);
      }
      return { state: s, events };
    case 'draw': {
      s.ek = null;
      s.stall = 0;
      if (s.pending > 0) {
        const got = drawCards(s, seat, s.pending, events, rng);
        events.push(ev.note('penalty', { count: got.length }, seat));
        s.pending = 0;
        s.pendingKind = null;
        s.turn = next(s, seat);
        return { state: s, events };
      }
      let last: RCard | undefined;
      for (;;) {
        const got = drawCards(s, seat, 1, events, rng);
        last = got[0];
        if (!last) break;
        if (!s.config.drawUntilPlay || playableNow(s, seat, last)) break;
      }
      if (last && playableNow(s, seat, last)) s.drawnId = last.id;
      else s.turn = next(s, seat);
      return { state: s, events };
    }
    case 'play': {
      applyPlay(s, seat, a, rng, events);
      return { state: s, events };
    }
  }
}

// ---------- view ----------

function view(s: RangiState, seat: ViewerSeat): RangiView {
  const legal = seat === 'spectator' ? [] : legalActions(s, seat);
  const plays: PlayOption[] = [];
  for (const a of legal) {
    if (a.type !== 'play') continue;
    let p = plays.find((x) => x.cardId === a.cardId);
    if (!p) {
      p = { cardId: a.cardId, needsColor: false, swapTargets: [], jumpIn: seat !== s.turn };
      plays.push(p);
    }
    if (a.color) p.needsColor = true;
    if (a.swapWith !== undefined && !p.swapTargets.includes(a.swapWith))
      p.swapTargets.push(a.swapWith);
  }
  const ownDrawn = seat !== 'spectator' && seat === s.turn ? s.drawnId : null;
  return {
    seat,
    config: s.config,
    n: s.n,
    hand: seat === 'spectator' ? [] : s.hands[seat],
    handCounts: s.hands.map((h) => h.length),
    top: top(s) ?? null,
    tail: s.discard.slice(-3),
    drawCount: s.draw.length,
    color: s.color,
    dir: s.dir,
    turn: s.turn,
    dealer: s.dealer,
    round: s.round,
    phase: s.phase,
    pending: s.pending,
    pendingKind: s.pendingKind,
    drawnId: ownDrawn,
    ek: s.ek,
    challenge: s.challenge ? { offender: s.challenge.offender, target: s.challenge.target } : null,
    roundScores: s.roundScores,
    totals: totals(s),
    lastWinner: s.lastWinner,
    plays,
    canDraw: legal.some((a) => a.type === 'draw'),
    canPass: legal.some((a) => a.type === 'pass'),
    canChallenge: legal.some((a) => a.type === 'challenge'),
    canEk: legal.some((a) => a.type === 'ek'),
    canCatch: legal.some((a) => a.type === 'caught'),
    canNext: legal.some((a) => a.type === 'next'),
    mustChooseColor: legal.some((a) => a.type === 'color'),
  };
}

function setup(players: PlayerInfo[], config: RangiConfig, rng: Rng): Step<RangiState> {
  if (players.length < 2 || players.length > 10) throw new Error('Rangi needs 2 to 10 players');
  const cfg = { ...defaultConfig, ...config };
  const dealer = rng.int(players.length);
  return startRound(
    {
      n: players.length,
      config: cfg,
      humans: players.map((p) => !p.isBot),
      levels: players.map((p) => p.difficulty),
      roundScores: [],
    },
    0,
    dealer,
    rng,
  );
}

function result(s: RangiState): GameResult | null {
  if (s.phase !== 'over') return null;
  const scores = totals(s);
  const max = Math.max(...scores);
  return { scores, winners: scores.flatMap((x, i) => (x === max ? [i] : [])) };
}

export const rangi: GameDefinition<RangiState, RangiAction, RangiConfig, RangiView> = {
  id: 'rangi',
  nameKey: 'game.rangi',
  minPlayers: 2,
  maxPlayers: 10,
  supports: { bots: true, passAndPlay: true, online: true },
  defaultConfig,
  configSchema,
  presets,
  setup,
  currentActors,
  legalActions,
  apply: (s, seat, a, rng) => applyStep(s, seat, a, rng),
  view,
  filterEvents: filterEventsDefault,
  timeoutAction(s, seat) {
    if (s.phase === 'roundEnd') return { type: 'next' };
    if (s.phase === 'color') return { type: 'color', color: 'sindoor' };
    if (s.phase === 'challenge') return { type: 'accept' };
    if (seat !== s.turn) return legalActions(s, seat)[0] ?? { type: 'pass' };
    const acts = turnActions(s, seat);
    if (s.drawnId !== null) return { type: 'pass' };
    if (s.config.mustPlay) {
      const p = acts.find((x) => x.type === 'play');
      if (p) return p;
    }
    return acts.find((x) => x.type === 'draw') ?? acts[0];
  },
  result,
  isPlayPhase: (s) => s.phase === 'play' || s.phase === 'color' || s.phase === 'challenge',
  bot: rangiBot,
  invariants(s) {
    const all = [...s.hands.flat(), ...s.draw, ...s.discard];
    if (all.length !== DECK_SIZE) return `rangi: card count ${all.length}`;
    if (new Set(all.map((c) => c.id)).size !== DECK_SIZE) return 'rangi: duplicate card';
    if (s.discard.length === 0) return 'rangi: empty discard';
    return null;
  },
};

// kept for tests that need to drive a specific situation
export const internals = { startRound, endRound, legalActions, currentActors, playableNow, next };
