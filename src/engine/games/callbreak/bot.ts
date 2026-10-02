import { rankAceHigh, type Card } from '../../core/cards';
import type { Rng } from '../../core/rng';
import type { Difficulty } from '../../core/types';
import { winsSoFar } from './rules';
import type { CallBreakAction, CallBreakView } from './view';

/** Medium bid estimate from the notes in docs/rules/callbreak.md. */
export function estimateBid(hand: Card[], maxBid: number): number {
  const spades = hand.filter((c) => c.suit === 'S');
  const n = spades.length;
  let est = 0;
  for (const c of hand) {
    if (c.suit === 'S') {
      if (c.rank === 1) est += 1;
      else if (c.rank === 13 && n >= 2) est += 1;
      else if (c.rank === 12 && n >= 3) est += 1;
    } else {
      const len = hand.filter((x) => x.suit === c.suit).length;
      if (c.rank === 1) est += 1;
      else if (c.rank === 13 && len >= 2 && len <= 3) est += 0.5;
    }
  }
  if (n > 3) est += (n - 3) * 0.5;
  return Math.max(1, Math.min(maxBid, Math.round(est)));
}

const cost = (c: Card) => (c.suit === 'S' ? 20 : 0) + rankAceHigh(c);
const byCost = (a: Card, b: Card) => cost(a) - cost(b);

/** A card is "boss" when every higher card of its suit has been played or is in my hand. */
function isBoss(card: Card, v: CallBreakView): boolean {
  const gone = new Set<string>(
    [...v.played, ...v.hand, ...v.trick.map((p) => p.card)].map(cardKey),
  );
  for (let r = rankAceHigh(card) + 1; r <= 14; r++) {
    if (!gone.has(`${card.suit}${r}`)) return false;
  }
  return true;
}
const cardKey = (c: Card) => `${c.suit}${rankAceHigh(c)}`;

export function callBreakBot(
  v: CallBreakView,
  legal: CallBreakAction[],
  difficulty: Difficulty,
  rng: Rng,
): CallBreakAction {
  const first = legal[0];
  if (!first) throw new Error('bot has no legal action');
  if (first.type === 'next') return first;

  if (first.type === 'bid') {
    let bid = estimateBid(v.hand, v.config.maxBid);
    if (difficulty === 'easy') bid += rng.range(-1, 1);
    if (difficulty === 'hard') {
      const bossSpades = v.hand.filter((c) => c.suit === 'S' && isBoss(c, v)).length;
      if (bossSpades >= 3) bid += 1;
    }
    bid = Math.max(1, Math.min(v.config.maxBid, bid));
    const ok = legal.find((a) => a.type === 'bid' && a.bid === bid);
    return ok ?? first;
  }

  const byId = new Map(v.hand.map((c) => [c.id, c]));
  const cards = legal
    .filter((a): a is Extract<CallBreakAction, { type: 'play' }> => a.type === 'play')
    .map((a) => byId.get(a.cardId)!);
  const play = (c: Card): CallBreakAction => ({ type: 'play', cardId: c.id });
  if (cards.length === 1) return play(cards[0]);
  if (difficulty === 'easy' && rng.next() < 0.6) return play(rng.pick(cards));

  const me = v.seat as number;
  const need = (v.bids[me] ?? 1) - v.tricksWon[me];
  const sorted = cards.slice().sort(byCost);
  const leading = v.trick.length === 0;

  if (leading) {
    if (need > 0) {
      if (difficulty === 'hard') {
        const boss = sorted.filter((c) => isBoss(c, v) && c.suit !== 'S').pop();
        if (boss) return play(boss);
      }
      const nonSpade = sorted.filter((c) => c.suit !== 'S');
      if (nonSpade.length > 0) {
        const top = nonSpade[nonSpade.length - 1];
        if (rankAceHigh(top) >= 13 || difficulty === 'hard') return play(top);
      }
      return play(sorted[sorted.length - 1]);
    }
    const low = sorted.filter((c) => c.suit !== 'S');
    return play((low.length > 0 ? low : sorted)[0]);
  }

  const winners = sorted.filter((c) => winsSoFar(c, v.trick));
  if (need > 0) {
    if (winners.length > 0) return play(winners[0]);
    return play(sorted[0]);
  }
  const losers = sorted.filter((c) => !winsSoFar(c, v.trick));
  if (losers.length > 0) return play(losers[losers.length - 1]);
  return play(sorted[0]);
}
