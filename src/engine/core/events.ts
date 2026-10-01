import type { Card } from './cards';

export type ZoneKind =
  | 'deck'
  | 'stock'
  | 'discard'
  | 'hand'
  | 'trick'
  | 'table'
  | 'pot'
  | 'bank'
  | 'mat'
  | 'melds'
  | 'chips';

export interface Zone {
  kind: ZoneKind;
  seat?: number;
  index?: number;
}

/**
 * Describes what physically happened. The UI animates events in order.
 * `cards` and `secret` are only delivered to seats in `visibleTo` (everyone when undefined);
 * other seats get `count` instead.
 */
export interface GameEvent {
  type: string;
  seat?: number;
  cards?: Card[];
  count?: number;
  from?: Zone;
  to?: Zone;
  visibleTo?: number[];
  data?: Record<string, unknown>;
  secret?: Record<string, unknown>;
}

export type ViewerSeat = number | 'spectator';

export function filterEventsDefault(events: GameEvent[], seat: ViewerSeat): GameEvent[] {
  return events.map((e) => {
    if (!e.visibleTo || (seat !== 'spectator' && e.visibleTo.includes(seat))) return e;
    const hidden: GameEvent = { ...e };
    if (e.cards) {
      hidden.count = e.cards.length;
      delete hidden.cards;
    }
    delete hidden.secret;
    delete hidden.visibleTo;
    return hidden;
  });
}

export const ev = {
  deal: (seat: number, cards: Card[], from: Zone = { kind: 'deck' }): GameEvent => ({
    type: 'deal',
    seat,
    cards,
    from,
    to: { kind: 'hand', seat },
    visibleTo: [seat],
  }),
  move: (cards: Card[], from: Zone, to: Zone, seat?: number, visibleTo?: number[]): GameEvent => ({
    type: 'move',
    seat,
    cards,
    from,
    to,
    visibleTo,
  }),
  note: (type: string, data?: Record<string, unknown>, seat?: number): GameEvent => ({
    type,
    seat,
    data,
  }),
};
