import { rankAceHigh, type Card, type Suit } from '../../core/cards';
import type { CallBreakConfig } from './config';

export interface TrickPlay {
  seat: number;
  card: Card;
}

const hi = (c: Card) => rankAceHigh(c);

/** Which of `hand` may be played into `trick` (cards in play order). */
export function legalCards(
  hand: Card[],
  trick: TrickPlay[],
  cfg: Pick<CallBreakConfig, 'mustTrumpWhenCantBeat'>,
): Card[] {
  if (trick.length === 0) return hand.slice();
  const led: Suit = trick[0].card.suit;
  const spadesIn = trick.filter((p) => p.card.suit === 'S');
  const ofLed = hand.filter((c) => c.suit === led);
  if (ofLed.length > 0) {
    if (led !== 'S' && spadesIn.length > 0) return ofLed; // already trumped: just follow suit
    const best = Math.max(...trick.filter((p) => p.card.suit === led).map((p) => hi(p.card)));
    const higher = ofLed.filter((c) => hi(c) > best);
    return higher.length > 0 ? higher : ofLed;
  }
  const spades = hand.filter((c) => c.suit === 'S');
  if (spades.length === 0) return hand.slice();
  if (spadesIn.length > 0) {
    const best = Math.max(...spadesIn.map((p) => hi(p.card)));
    const higher = spades.filter((c) => hi(c) > best);
    if (higher.length > 0) return higher;
    return cfg.mustTrumpWhenCantBeat ? spades : hand.slice();
  }
  return spades;
}

/** Seat that wins the trick: highest spade, else highest card of the led suit. */
export function trickWinner(trick: TrickPlay[]): number {
  const led = trick[0].card.suit;
  const spades = trick.filter((p) => p.card.suit === 'S');
  const pool = spades.length > 0 ? spades : trick.filter((p) => p.card.suit === led);
  return pool.reduce((b, p) => (hi(p.card) > hi(b.card) ? p : b)).seat;
}

/** Would `card` currently be winning if played now (before the remaining players act)? */
export function winsSoFar(card: Card, trick: TrickPlay[]): boolean {
  return trickWinner([...trick, { seat: -1, card }]) === -1;
}

export function scoreRound(bid: number, won: number, cfg: CallBreakConfig): number {
  if (won >= bid) {
    if (cfg.bonusBid8 && bid >= 8) return 13;
    return Math.round((bid + (won - bid) * 0.1) * 10) / 10;
  }
  return -bid;
}

export function handOk(hand: Card[], cfg: CallBreakConfig): boolean {
  if (cfg.redealNoSpade && !hand.some((c) => c.suit === 'S')) return false;
  if (cfg.redealNoFace && !hand.some((c) => c.rank >= 11 || c.rank === 1)) return false;
  return true;
}
