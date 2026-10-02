import { isJoker, isRed, type Card, type Rank, type Suit } from '../../core/cards';

// Marriage rules: maal roles relative to the joker card, valid sets, and the meld solver.

export type Role = 'tiplu' | 'poplu' | 'jhiplu' | 'alter' | 'joker' | 'man' | null;

const SUITS: Exclude<Suit, 'J'>[] = ['S', 'H', 'D', 'C'];
const suitIndex = (s: Suit) => SUITS.indexOf(s as Exclude<Suit, 'J'>);
const wrap = (r: number) => (r < 1 ? 13 : r > 13 ? 1 : r);

export interface Ctx {
  /** the hidden joker card, or null when the player has not seen it */
  joker: Card | null;
  /** id of the Superman card, if the table plays with one */
  supermanId: number | null;
}

/** What this card is worth as maal relative to the joker card. Printed jokers are "man". */
export function roleOf(c: Card, joker: Card): Role {
  if (isJoker(c)) return 'man';
  if (c.rank === joker.rank && c.suit === joker.suit) return 'tiplu';
  if (c.suit === joker.suit && c.rank === wrap(joker.rank + 1)) return 'poplu';
  if (c.suit === joker.suit && c.rank === wrap(joker.rank - 1)) return 'jhiplu';
  if (c.rank === joker.rank && c.suit !== joker.suit) {
    return isRed(c) === isRed(joker) ? 'alter' : 'joker';
  }
  return null;
}

/** After seeing, every role counts as wild in sequences and trials. */
export const isWildCapable = (c: Card, ctx: Ctx) =>
  ctx.joker !== null && !isJoker(c) && roleOf(c, ctx.joker) !== null;

export const isSuperman = (c: Card, ctx: Ctx) => ctx.supermanId !== null && c.id === ctx.supermanId;
/** printed jokers other than Superman, wild once seen */
export const isMan = (c: Card, ctx: Ctx) => isJoker(c) && !isSuperman(c, ctx);

export type MeldType = 'pure' | 'tunnela' | 'trial' | 'sequence' | 'marriage';
export interface Meld {
  type: MeldType;
  /** a run in position order; trials and tunnelas in any order */
  cards: Card[];
}

const kindOf = (c: Card) => suitIndex(c.suit) * 13 + (c.rank - 1);
const posKind = (s: number, p: number) => s * 13 + ((p === 14 ? 1 : p) - 1);

// ---------- the solver ----------

interface Slot {
  /** natural kind, or a wild source */
  nat?: number;
  man?: true;
  sup?: true;
  flex?: number;
}
interface AMeld {
  type: 'pure' | 'tunnela' | 'trial' | 'sequence';
  slots: Slot[];
}

export interface SolveOptions {
  /** wild cards (Man, Superman, maal cards) may stand in; false before the player has seen */
  allowWild: boolean;
  /** only pure sequences and tunnelas (the first show) */
  pureOnly: boolean;
}

/**
 * Split all of `cards` into valid sets, or return null. Pure sequences and tunnelas never use wilds
 * except Superman in a pure sequence. Cards that can be wild are also natural cards.
 */
export function solve(cards: Card[], ctx: Ctx, opts: SolveOptions): Meld[] | null {
  const counts = new Array<number>(52).fill(0);
  const byKind: Card[][] = Array.from({ length: 52 }, () => []);
  const men: Card[] = [];
  const sups: Card[] = [];
  const flex = new Array<boolean>(52).fill(false);
  for (const c of cards) {
    if (isJoker(c)) {
      if (isSuperman(c, ctx)) sups.push(c);
      else men.push(c);
      continue;
    }
    const k = kindOf(c);
    counts[k]++;
    byKind[k].push(c);
    if (opts.allowWild && isWildCapable(c, ctx)) flex[k] = true;
  }
  if (!opts.allowWild && men.length > 0) return null; // a Man card cannot be used before seeing
  // naturals that cannot be wild first, so wild-capable cards are only used as natural or filler late
  const order = [
    ...Array.from({ length: 52 }, (_, k) => k).filter((k) => !flex[k]),
    ...Array.from({ length: 52 }, (_, k) => k).filter((k) => flex[k]),
  ];
  const failed = new Set<string>();
  let wildOk = false; // pure sequences are tried first so marriages stay pure

  const rec = (cnt: number[], wm: number, ws: number): AMeld[] | null => {
    let k0 = -1;
    for (const k of order) {
      if (cnt[k] > 0) {
        k0 = k;
        break;
      }
    }
    if (k0 < 0) return wm + ws === 0 ? [] : null;
    const key = `${cnt.join('')}|${wm}|${ws}`;
    if (failed.has(key)) return null;
    const s0 = Math.floor(k0 / 13);
    const r0 = (k0 % 13) + 1;

    // helper: take a filler wild from the pool; returns a new state or null
    const take = (
      c2: number[],
      m: number,
      s: number,
      allowMan: boolean,
    ): { c: number[]; m: number; s: number; slot: Slot } | null => {
      if (allowMan && m > 0) return { c: c2, m: m - 1, s, slot: { man: true } };
      if (s > 0) return { c: c2, m, s: s - 1, slot: { sup: true } };
      if (!allowMan) return null;
      for (let k = 51; k >= 0; k--) {
        if (flex[k] && c2[k] > 0 && !(k === k0 && c2[k] < 1)) {
          const c3 = c2.slice();
          c3[k]--;
          return { c: c3, m, s, slot: { flex: k } };
        }
      }
      return null;
    };

    // runs through this card, as natural. positions 1..14 where 14 is the high Ace
    const positions = r0 === 1 ? [1, 14] : [r0];
    for (const p0 of positions) {
      for (let a = Math.max(1, p0 - 13); a <= p0; a++) {
        for (let b = p0; b <= 14 && b - a + 1 <= 13; b++) {
          if (b - a + 1 < 3) continue;
          if (a === 1 && b === 14) continue;
          for (const wilds of wildOk ? [false, true] : [false]) {
            let c2 = cnt.slice();
            let m = wm;
            let s = ws;
            const slots: Slot[] = [];
            let ok = true;
            let usedWild = false;
            for (let p = a; p <= b && ok; p++) {
              const k = posKind(s0, p);
              if (c2[k] > 0) {
                c2[k]--;
                slots.push({ nat: k });
              } else if (!wilds && s > 0) {
                // Superman fills a gap in a pure sequence
                s--;
                slots.push({ sup: true });
              } else if (wilds) {
                const t = take(c2, m, s, true);
                if (!t) ok = false;
                else {
                  c2 = t.c;
                  m = t.m;
                  s = t.s;
                  slots.push(t.slot);
                  usedWild = true;
                }
              } else ok = false;
            }
            if (!ok) continue;
            if (wilds && !usedWild && slots.every((x) => x.nat !== undefined)) continue; // same as the pure version
            if (!slots.some((x) => x.nat === k0)) continue;
            const type = slots.every((x) => x.nat !== undefined || x.sup) ? 'pure' : 'sequence';
            const rest = rec(c2, m, s);
            if (rest) return [{ type, slots }, ...rest];
          }
        }
      }
    }

    // a tunnela: three identical cards
    if (cnt[k0] >= 3) {
      const c2 = cnt.slice();
      c2[k0] -= 3;
      const rest = rec(c2, wm, ws);
      if (rest)
        return [{ type: 'tunnela', slots: [{ nat: k0 }, { nat: k0 }, { nat: k0 }] }, ...rest];
    }

    // a trial: the same rank in different suits, wilds filling in (after seeing)
    if (wildOk || (opts.allowWild && !opts.pureOnly)) {
      const others = [0, 1, 2, 3].filter((s) => s !== s0 && cnt[s * 13 + (r0 - 1)] > 0);
      const subsets: number[][] = [[]];
      for (const s of others) for (const sub of subsets.slice()) subsets.push([...sub, s]);
      subsets.sort((x, y) => y.length - x.length);
      for (const sub of subsets) {
        const naturals = 1 + sub.length;
        for (const size of [3, 4]) {
          const need = size - naturals;
          if (need < 0) continue;
          let c2 = cnt.slice();
          c2[k0]--;
          for (const s of sub) c2[s * 13 + (r0 - 1)]--;
          const slots: Slot[] = [{ nat: k0 }, ...sub.map((s) => ({ nat: s * 13 + (r0 - 1) }))];
          let m = wm;
          let sp = ws;
          let ok = true;
          for (let i = 0; i < need && ok; i++) {
            const t = take(c2, m, sp, true);
            if (!t) ok = false;
            else {
              c2 = t.c;
              m = t.m;
              sp = t.s;
              slots.push(t.slot);
            }
          }
          if (!ok) continue;
          const rest = rec(c2, m, sp);
          if (rest) return [{ type: 'trial', slots }, ...rest];
        }
      }
    }

    failed.add(key);
    return null;
  };

  let abstract = rec(counts, men.length, sups.length);
  if (!abstract && opts.allowWild && !opts.pureOnly) {
    wildOk = true;
    failed.clear();
    abstract = rec(counts, men.length, sups.length);
  }
  if (!abstract) return null;

  // rebuild real cards for each abstract meld
  const pool = byKind.map((a) => a.slice());
  const manPool = men.slice();
  const supPool = sups.slice();
  const melds: Meld[] = abstract.map((m) => {
    const cs = m.slots.map((slot) => {
      if (slot.nat !== undefined) return pool[slot.nat].pop()!;
      if (slot.flex !== undefined) return pool[slot.flex].pop()!;
      if (slot.man) return manPool.pop()!;
      return supPool.pop()!;
    });
    return { type: m.type, cards: cs };
  });
  // leftover wild cards are absorbed into a meld that can take them
  const leftovers = [...manPool, ...supPool];
  for (const w of leftovers) {
    const host = melds.find(
      (m) =>
        (m.type === 'sequence' || m.type === 'pure') &&
        m.cards.length < 14 &&
        (isSuperman(w, ctx) || m.type === 'sequence' || true),
    );
    if (!host) return null;
    host.cards.push(w);
    if (!isSuperman(w, ctx)) host.type = 'sequence';
  }
  return melds.map((m) => ({ ...m, type: isMarriage(m, ctx) ? 'marriage' : m.type }));
}

/** A marriage is jhiplu, tiplu and poplu of the tiplu suit together in one pure sequence. */
export function isMarriage(m: Meld, ctx: Ctx): boolean {
  if (m.type !== 'pure' || !ctx.joker) return false;
  const j = ctx.joker;
  const roles = new Set(
    m.cards.map((c) => (isJoker(c) ? '' : c.suit === j.suit ? roleOf(c, j) : '')),
  );
  return roles.has('tiplu') && roles.has('poplu') && roles.has('jhiplu');
}

// ---------- showing ----------

const identical = (a: Card, b: Card) => a.suit === b.suit && a.rank === b.rank && !isJoker(a);

export interface ShownSets {
  route: 'sequence' | 'dublee';
  sets: Card[][];
}

/**
 * Validate a first show. Sequence route: at least `min` pure sequences or tunnelas, nothing left over.
 * Dublee route: at least `min` pairs of identical cards (two printed jokers count when `jokerDublee`).
 */
export function validateShow(
  sets: Card[][],
  ctx: Ctx,
  min: { sequences: number; dublees: number },
  jokerDublee: boolean,
): ShownSets | null {
  if (sets.length === 0) return null;
  if (sets.every((s) => s.length === 2)) {
    const ok = sets.every(
      (s) => identical(s[0], s[1]) || (jokerDublee && isJoker(s[0]) && isJoker(s[1])),
    );
    return ok && sets.length >= min.dublees ? { route: 'dublee', sets } : null;
  }
  if (sets.length < min.sequences) return null;
  for (const s of sets) {
    const melds = solve(
      s,
      { joker: null, supermanId: ctx.supermanId },
      { allowWild: false, pureOnly: true },
    );
    if (!melds || melds.length !== 1) return null;
  }
  return { route: 'sequence', sets };
}

/** Find `min` disjoint pure sets that include `must` (a card id), for taking the discard before seeing. */
export function findShow(
  cards: Card[],
  ctx: Ctx,
  min: number,
  must: number | null,
): Card[][] | null {
  const noWild: Ctx = { joker: null, supermanId: ctx.supermanId };
  // candidate pure sets: every subset-free run or tunnela built from the cards
  const byKind: Card[][] = Array.from({ length: 52 }, () => []);
  const sups = cards.filter((c) => isSuperman(c, ctx));
  for (const c of cards) if (!isJoker(c)) byKind[kindOf(c)].push(c);
  const cands: Card[][] = [];
  for (let s = 0; s < 4; s++) {
    for (let a = 1; a <= 12; a++) {
      for (let b = a + 2; b <= 14 && b - a + 1 <= 13; b++) {
        if (a === 1 && b === 14) continue;
        let gaps = 0;
        const run: Card[] = [];
        let ok = true;
        for (let p = a; p <= b; p++) {
          const k = posKind(s, p);
          if (byKind[k].length > 0) run.push(byKind[k][0]);
          else if (gaps < sups.length) {
            run.push(sups[gaps]);
            gaps++;
          } else {
            ok = false;
            break;
          }
        }
        if (ok && b - a + 1 <= 5) cands.push(run);
        else if (ok) cands.push(run.slice(0, 5));
      }
    }
  }
  for (let k = 0; k < 52; k++) if (byKind[k].length >= 3) cands.push(byKind[k].slice(0, 3));
  void noWild;
  const used = new Set<number>();
  const pick = (start: number, chosen: Card[][]): Card[][] | null => {
    if (chosen.length >= min && (must === null || chosen.some((s) => s.some((c) => c.id === must))))
      return chosen;
    for (let i = start; i < cands.length; i++) {
      const set = cands[i];
      if (set.some((c) => used.has(c.id))) continue;
      set.forEach((c) => used.add(c.id));
      const r = pick(i + 1, [...chosen, set]);
      set.forEach((c) => used.delete(c.id));
      if (r) return r;
    }
    return null;
  };
  // sets with the required card first
  if (must !== null)
    cands.sort(
      (x, y) => Number(y.some((c) => c.id === must)) - Number(x.some((c) => c.id === must)),
    );
  return pick(0, []);
}

// ---------- dublees ----------

/** Pairs of identical cards in a pile; with `jokerDublee` two printed jokers make one pair. */
export function countDublees(cards: Card[], jokerDublee: boolean): number {
  const counts = new Map<number, number>();
  let jokers = 0;
  for (const c of cards) {
    if (isJoker(c)) jokers++;
    else counts.set(kindOf(c), (counts.get(kindOf(c)) ?? 0) + 1);
  }
  let pairs = 0;
  for (const n of counts.values()) pairs += Math.floor(n / 2);
  return pairs + (jokerDublee ? Math.floor(jokers / 2) : 0);
}

export type { Rank };
