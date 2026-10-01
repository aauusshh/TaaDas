import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { motion } from 'motion/react';
import type { Card } from '../../engine/core/cards';
import { CardFace } from '../cards/CardFace';
import { useAnchor } from '../anim/anchors';
import { effectiveReduceMotion } from '../../storage/settings';
import s from './Hand.module.css';

export interface HandProps {
  cards: Card[];
  /** card width in px */
  cardWidth: number;
  selectedId?: number | null;
  /** when set, cards not in it dim to 55% and cannot be played */
  playableIds?: ReadonlySet<number> | null;
  onSelect?: (id: number | null) => void;
  onPlay?: (id: number) => void;
  seat?: number;
  /** extra space inserted after these card ids (grouped sets in Marriage) */
  gapAfter?: ReadonlySet<number>;
  disabled?: boolean;
}

const SPREAD_DEG = 12;

function HandCard({
  card,
  x,
  y,
  rot,
  z,
  cardWidth,
  lifted,
  dim,
  selected,
  onTap,
  onDrop,
  disabled,
}: {
  card: Card;
  x: number;
  y: number;
  rot: number;
  z: number;
  cardWidth: number;
  lifted: number;
  dim: boolean;
  selected: boolean;
  onTap: () => void;
  onDrop: () => void;
  disabled: boolean;
}) {
  const ref = useAnchor(`card:${card.id}`);
  const reduce = effectiveReduceMotion();
  return (
    <motion.button
      ref={ref}
      type="button"
      className={s.card}
      aria-pressed={selected}
      aria-label={undefined}
      style={{ width: cardWidth, zIndex: z, transformOrigin: '50% 140%' }}
      initial={false}
      animate={{ x, y: y - lifted, rotate: rot, opacity: dim ? 0.55 : 1 }}
      transition={reduce ? { duration: 0.1 } : { type: 'spring', stiffness: 400, damping: 30 }}
      drag={!disabled && !dim}
      dragSnapToOrigin
      dragElastic={0.5}
      dragTransition={{ bounceStiffness: 400, bounceDamping: 30 }}
      whileDrag={{ scale: 1.06, zIndex: 100 }}
      onDragEnd={(_, info) => {
        if (info.offset.y < -70) onDrop();
      }}
      onClick={onTap}
      tabIndex={selected ? 0 : -1}
    >
      <CardFace card={card} />
    </motion.button>
  );
}

export function Hand({
  cards,
  cardWidth,
  selectedId = null,
  playableIds = null,
  onSelect,
  onPlay,
  seat,
  gapAfter,
  disabled = false,
}: HandProps) {
  const box = useRef<HTMLDivElement | null>(null);
  const anchor = useAnchor(`hand:${seat ?? 0}`);
  const [w, setW] = useState(320);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const n = cards.length;
  const gap = gapAfter ? cards.filter((c, i) => gapAfter.has(c.id) && i < n - 1).length * 10 : 0;
  const ideal = cardWidth * 0.4;
  const step = n > 1 ? Math.min(ideal, (w - cardWidth - gap) / (n - 1)) : 0;
  const total = step * (n - 1) + cardWidth + gap;
  const startX = (w - total) / 2;
  const height = cardWidth / 0.7159;

  let extra = 0;
  const placed = cards.map((c, i) => {
    const t = n > 1 ? i / (n - 1) : 0.5;
    const edge = (2 * t - 1) ** 2;
    const x = startX + i * step + extra;
    if (gapAfter?.has(c.id)) extra += 10;
    return { c, x, y: edge * Math.min(14, cardWidth * 0.18), rot: (t - 0.5) * SPREAD_DEG };
  });

  const focusMove = (dir: -1 | 1) => {
    if (!onSelect || n === 0) return;
    const i = cards.findIndex((c) => c.id === selectedId);
    const next = i < 0 ? (dir > 0 ? 0 : n - 1) : Math.max(0, Math.min(n - 1, i + dir));
    onSelect(cards[next].id);
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      focusMove(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      focusMove(-1);
    } else if (e.key === 'Enter' && selectedId != null) {
      e.preventDefault();
      if (!playableIds || playableIds.has(selectedId)) onPlay?.(selectedId);
    } else if (e.key === 'Escape') onSelect?.(null);
  };

  return (
    <div
      ref={(el) => {
        box.current = el;
        anchor(el);
      }}
      className={s.hand}
      style={{ height: height + 28 }}
      role="group"
      aria-label="Your hand"
      onKeyDown={onKey}
    >
      {placed.map(({ c, x, y, rot }, i) => {
        const playable = !playableIds || playableIds.has(c.id);
        const selected = c.id === selectedId;
        return (
          <HandCard
            key={c.id}
            card={c}
            x={x}
            y={y + 22}
            rot={rot}
            z={selected ? 60 : i}
            cardWidth={cardWidth}
            lifted={selected ? 16 : playableIds && playable ? 6 : 0}
            dim={!!playableIds && !playable}
            selected={selected}
            disabled={disabled}
            onTap={() => {
              if (disabled) return;
              if (selected && playable) onPlay?.(c.id);
              else onSelect?.(c.id);
            }}
            onDrop={() => playable && !disabled && onPlay?.(c.id)}
          />
        );
      })}
    </div>
  );
}
