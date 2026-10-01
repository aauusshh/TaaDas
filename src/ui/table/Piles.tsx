import type { CSSProperties } from 'react';
import type { Card } from '../../engine/core/cards';
import { CardBack, CardFace } from '../cards/CardFace';
import { useAnchor } from '../anim/anchors';
import s from './Piles.module.css';

/** deterministic pseudo-random in [-1, 1] from a card id, so a pile looks hand-placed but never jitters */
const jitter = (id: number, salt: number) => Math.sin(id * 12.9898 + salt * 78.233) * 0.5 * 2;

export function DrawPile({
  count,
  cardWidth,
  anchorKey = 'deck',
  onClick,
  label,
}: {
  count: number;
  cardWidth: number;
  anchorKey?: string;
  onClick?: () => void;
  label?: string;
}) {
  const ref = useAnchor(anchorKey);
  const layers = count <= 0 ? 0 : Math.min(5, Math.max(1, Math.ceil(count / 10)));
  const h = cardWidth / 0.7159;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      ref={ref as never}
      className={s.pile}
      style={{ width: cardWidth + 8, height: h + 8 } as CSSProperties}
      onClick={onClick}
      aria-label={label ?? `Draw pile, ${count} cards`}
      type={onClick ? 'button' : undefined}
    >
      {layers === 0 && <div className={s.empty} style={{ width: cardWidth, height: h }} />}
      {Array.from({ length: layers }, (_, i) => (
        <div
          key={i}
          className={s.layer}
          style={{ width: cardWidth, left: (layers - 1 - i) * 1.5, top: (layers - 1 - i) * 1.5 }}
        >
          <CardBack />
        </div>
      ))}
      <span className={`${s.count} num`}>{count}</span>
    </Tag>
  );
}

export function DiscardPile({
  cards,
  cardWidth,
  anchorKey = 'discard',
  onClick,
}: {
  /** oldest first; the last card is on top */
  cards: Card[];
  cardWidth: number;
  anchorKey?: string;
  onClick?: () => void;
}) {
  const ref = useAnchor(anchorKey);
  const h = cardWidth / 0.7159;
  const shown = cards.slice(-3);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      ref={ref as never}
      className={s.pile}
      style={{ width: cardWidth + 16, height: h + 16 } as CSSProperties}
      onClick={onClick}
      aria-label="Discard pile"
      type={onClick ? 'button' : undefined}
    >
      {shown.length === 0 && (
        <div className={s.empty} style={{ width: cardWidth, height: h, left: 8, top: 8 }} />
      )}
      {shown.map((c, i) => {
        const top = i === shown.length - 1;
        const rot = top ? jitter(c.id, 1) * 3 : jitter(c.id, 2) * 6;
        return (
          <div
            key={c.id}
            className={s.layer}
            style={{
              width: cardWidth,
              left: 8 + (top ? 0 : jitter(c.id, 3) * 4),
              top: 8 + (top ? 0 : jitter(c.id, 4) * 4),
              transform: `rotate(${rot}deg)`,
            }}
          >
            <CardFace card={c} />
          </div>
        );
      })}
    </Tag>
  );
}

/** A little stack of backs with a count: how opponents' hands are shown. */
export function BackStack({ count, cardWidth }: { count: number; cardWidth: number }) {
  const shown = Math.min(3, count);
  return (
    <div className={s.backs} style={{ width: cardWidth + 8, height: cardWidth / 0.7159 + 4 }}>
      {Array.from({ length: shown }, (_, i) => (
        <div
          key={i}
          className={s.layer}
          style={{ width: cardWidth, left: i * 3, top: 0, transform: `rotate(${(i - 1) * 4}deg)` }}
        >
          <CardBack />
        </div>
      ))}
      <span className={`${s.count} num`}>{count}</span>
    </div>
  );
}
