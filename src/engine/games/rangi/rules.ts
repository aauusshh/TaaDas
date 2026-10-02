import type { GameCard } from '../../core/events';
import type { RangiConfig } from './config';

export type RColor = 'sindoor' | 'marigold' | 'sky' | 'leaf';
export type RValue = number | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';

export interface RCard extends GameCard {
  id: number;
  color: RColor | 'wild';
  value: RValue;
}

export const COLORS: readonly RColor[] = ['sindoor', 'marigold', 'sky', 'leaf'];
export const DECK_SIZE = 108;

export function makeRangiDeck(): RCard[] {
  const cards: RCard[] = [];
  let id = 0;
  for (const color of COLORS) {
    cards.push({ id: id++, color, value: 0 });
    for (let v = 1; v <= 9; v++)
      for (let k = 0; k < 2; k++) cards.push({ id: id++, color, value: v });
    for (const value of ['skip', 'reverse', 'draw2'] as const)
      for (let k = 0; k < 2; k++) cards.push({ id: id++, color, value });
  }
  for (let k = 0; k < 4; k++) cards.push({ id: id++, color: 'wild', value: 'wild' });
  for (let k = 0; k < 4; k++) cards.push({ id: id++, color: 'wild', value: 'wild4' });
  return cards;
}

export const isWild = (c: RCard) => c.value === 'wild' || c.value === 'wild4';
export const isAction = (c: RCard) => typeof c.value !== 'number';

/** Points a card is worth against the player holding it when someone goes out. */
export function cardPoints(c: RCard): number {
  if (typeof c.value === 'number') return c.value;
  return c.value === 'wild' || c.value === 'wild4' ? 50 : 20;
}

export const handPoints = (hand: RCard[]) => hand.reduce((t, c) => t + cardPoints(c), 0);

/** Plays on the top card by color, number or symbol; wilds always. */
export function matches(card: RCard, top: RCard, color: RColor): boolean {
  if (isWild(card)) return true;
  return card.color === color || card.value === top.value;
}

export type PendingKind = 'draw2' | 'wild4' | null;

export function canStack(
  card: RCard,
  kind: PendingKind,
  cfg: Pick<RangiConfig, 'stackMixed'>,
): boolean {
  if (kind === 'draw2') return card.value === 'draw2' || (cfg.stackMixed && card.value === 'wild4');
  if (kind === 'wild4') return card.value === 'wild4' || (cfg.stackMixed && card.value === 'draw2');
  return false;
}

/** Wild Draw Four is honest only when you hold nothing of the color in play. */
export const wild4Honest = (hand: RCard[], color: RColor) => !hand.some((c) => c.color === color);

/** Identical card for jump-in: same color and same value, not a wild. */
export const identical = (a: RCard, b: RCard) =>
  !isWild(a) && a.color === b.color && a.value === b.value;
