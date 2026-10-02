import type { Rng } from '../../core/rng';
import type { Difficulty } from '../../core/types';
import { COLORS, cardPoints, isWild, type RCard, type RColor } from './rules';
import type { RangiAction, RangiView } from './view';

const CATCH: Record<Difficulty, number> = { easy: 0.1, medium: 0.5, hard: 0.9 };
const CHALLENGE: Record<Difficulty, number> = { easy: 0.1, medium: 0.3, hard: 0.35 };

type Play = Extract<RangiAction, { type: 'play' }>;

/** The color I hold most of, ignoring the card being played. */
function bestColor(hand: RCard[], except: number, rng: Rng): RColor {
  const counts = new Map<RColor, number>();
  for (const c of hand)
    if (c.id !== except && c.color !== 'wild') counts.set(c.color, (counts.get(c.color) ?? 0) + 1);
  let best: RColor[] = [];
  let max = 0;
  for (const col of COLORS) {
    const n = counts.get(col) ?? 0;
    if (n > max) {
      max = n;
      best = [col];
    } else if (n === max && max > 0) best.push(col);
  }
  return best.length ? rng.pick(best) : rng.pick([...COLORS]);
}

export function rangiBot(
  v: RangiView,
  legal: RangiAction[],
  level: Difficulty,
  rng: Rng,
): RangiAction {
  const first = legal[0];
  if (!first) throw new Error('bot has no legal action');
  const find = <T extends RangiAction['type']>(t: T) =>
    legal.find((a): a is Extract<RangiAction, { type: T }> => a.type === t);

  const next = find('next');
  if (next) return next;

  const colors = legal.filter(
    (a): a is Extract<RangiAction, { type: 'color' }> => a.type === 'color',
  );
  if (colors.length) {
    const hand = v.hand;
    const best = bestColor(hand, -1, rng);
    return colors.find((c) => c.color === best) ?? colors[0];
  }

  if (find('challenge')) {
    let p = CHALLENGE[level];
    const off = v.challenge?.offender;
    if (level !== 'easy' && off !== undefined && v.handCounts[off] >= 5) p += 0.2;
    return rng.next() < p ? { type: 'challenge' } : { type: 'accept' };
  }

  const caught = find('caught');
  if (caught && rng.next() < CATCH[level]) return caught;
  const ek = find('ek');
  if (ek) return ek;

  const plays = legal.filter((a): a is Play => a.type === 'play');
  if (plays.length === 0) return find('draw') ?? find('pass') ?? first;
  if (v.pending > 0 && level === 'easy' && rng.next() < 0.3) return find('draw') ?? plays[0];

  const byId = new Map(v.hand.map((c) => [c.id, c]));
  const cardIds = [...new Set(plays.map((p) => p.cardId))];
  const nextSeat = (((v.turn + v.dir) % v.n) + v.n) % v.n;
  const nextCount = v.handCounts[nextSeat];

  const score = (id: number) => {
    const c = byId.get(id)!;
    let sc = cardPoints(c);
    if (isWild(c)) sc -= v.hand.length <= 2 ? 0 : 60;
    if (typeof c.value !== 'number' && !isWild(c) && nextCount <= 3) sc += 60;
    if (c.value === 'wild4' && nextCount <= 2) sc += 80;
    if (c.color !== 'wild') sc += v.hand.filter((x) => x.color === c.color).length * 2;
    if (v.pending > 0) sc += 100; // stacking is always better than eating the pile
    return sc + rng.next();
  };

  let pick: number;
  if (level === 'easy' && rng.next() < 0.4) pick = rng.pick(cardIds);
  else pick = cardIds.reduce((b, id) => (score(id) > score(b) ? id : b));

  const variants = plays.filter((p) => p.cardId === pick);
  let chosen = variants[0];
  if (variants.some((p) => p.color)) {
    const col = bestColor(v.hand, pick, rng);
    chosen = variants.find((p) => p.color === col) ?? chosen;
  }
  if (variants.some((p) => p.swapWith !== undefined)) {
    let target = variants[0].swapWith!;
    for (const p of variants)
      if (v.handCounts[p.swapWith!] < v.handCounts[target]) target = p.swapWith!;
    chosen = variants.find((p) => p.swapWith === target) ?? chosen;
  }
  return chosen;
}
