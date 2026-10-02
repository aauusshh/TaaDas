import { memo } from 'react';
import { isJoker, rankLabel, type Card, type Suit } from '../../engine/core/cards';
import { useSettings, type BackId } from '../../storage/settings';
import { ID } from './art/SvgDefs';

const PAPER = '#fbf8f1';
const INK = '#111111';

export function suitColor(suit: Suit, fourColor: boolean): string {
  if (suit === 'H') return '#c8102e';
  if (suit === 'S') return INK;
  if (suit === 'D') return fourColor ? '#1f5fbf' : '#c8102e';
  if (suit === 'C') return fourColor ? '#1e7b3c' : INK;
  return '#c8102e';
}

const SUIT_NAME: Record<Suit, string> = {
  S: 'spades',
  H: 'hearts',
  D: 'diamonds',
  C: 'clubs',
  J: 'joker',
};
const RANK_NAME: Record<number, string> = { 1: 'Ace', 11: 'Jack', 12: 'Queen', 13: 'King' };
export const cardAriaLabel = (c: Card) =>
  isJoker(c) ? 'Joker' : `${RANK_NAME[c.rank] ?? c.rank} of ${SUIT_NAME[c.suit]}`;

const L = 20;
const C = 31.5;
const R = 43;
type P = [number, number];
const PIPS: Record<number, P[]> = {
  2: [
    [C, 20],
    [C, 68],
  ],
  3: [
    [C, 20],
    [C, 44],
    [C, 68],
  ],
  4: [
    [L, 20],
    [R, 20],
    [L, 68],
    [R, 68],
  ],
  5: [
    [L, 20],
    [R, 20],
    [C, 44],
    [L, 68],
    [R, 68],
  ],
  6: [
    [L, 20],
    [R, 20],
    [L, 44],
    [R, 44],
    [L, 68],
    [R, 68],
  ],
  7: [
    [L, 20],
    [R, 20],
    [C, 32],
    [L, 44],
    [R, 44],
    [L, 68],
    [R, 68],
  ],
  8: [
    [L, 20],
    [R, 20],
    [C, 32],
    [L, 44],
    [R, 44],
    [C, 56],
    [L, 68],
    [R, 68],
  ],
  9: [
    [L, 20],
    [R, 20],
    [L, 36],
    [R, 36],
    [C, 44],
    [L, 52],
    [R, 52],
    [L, 68],
    [R, 68],
  ],
  10: [
    [L, 20],
    [R, 20],
    [C, 28],
    [L, 36],
    [R, 36],
    [L, 52],
    [R, 52],
    [C, 60],
    [L, 68],
    [R, 68],
  ],
};

function Pip({
  suit,
  x,
  y,
  size,
  flip,
}: {
  suit: Suit;
  x: number;
  y: number;
  size: number;
  flip?: boolean;
}) {
  const h = size / 2;
  return (
    <use
      href={`#${ID.pip(suit)}`}
      x={x - h}
      y={y - h}
      width={size}
      height={size}
      transform={flip ? `rotate(180 ${x} ${y})` : undefined}
    />
  );
}

function Corner({ card, color }: { card: Card; color: string }) {
  const label = rankLabel(card.rank);
  return (
    <g fill={color} aria-hidden="true">
      <text
        x="8.6"
        y="14.6"
        textAnchor="middle"
        fontSize={label.length > 1 ? 11.5 : 13}
        fontWeight="700"
        letterSpacing={label.length > 1 ? -0.7 : 0}
        fontFamily="var(--font-ui)"
      >
        {label}
      </text>
      <Pip suit={card.suit} x={8.6} y={22.2} size={8} />
    </g>
  );
}

const EMBLEM: Record<number, string> = { 11: ID.topi, 12: ID.lotus, 13: ID.crown };

function CourtHalf({ card, color }: { card: Card; color: string }) {
  return (
    <g color={color} fill={color}>
      <use href={`#${EMBLEM[card.rank]}`} x="20.5" y="20" width="22" height="16.5" />
      <Pip suit={card.suit} x={31.5} y={41} size={6.5} />
    </g>
  );
}

function Face({ card, color }: { card: Card; color: string }) {
  if (isJoker(card)) {
    return (
      <g color="#c8102e" fill="#c8102e">
        <rect
          x="13"
          y="17"
          width="37"
          height="54"
          rx="2"
          fill="none"
          stroke="#b8893a"
          strokeWidth="0.8"
        />
        <use href={`#${ID.star}`} x="11.5" y="29" width="40" height="30" />
        <text
          x="31.5"
          y="26"
          textAnchor="middle"
          fontSize="6.5"
          fontWeight="700"
          letterSpacing="1.2"
          fontFamily="var(--font-ui)"
        >
          JOKER
        </text>
        <text
          x="31.5"
          y="66"
          textAnchor="middle"
          fontSize="6.5"
          fontWeight="700"
          letterSpacing="1.2"
          fontFamily="var(--font-ui)"
          transform="rotate(180 31.5 63.4)"
        >
          JOKER
        </text>
      </g>
    );
  }
  const rank = card.rank;
  if (rank >= 11) {
    return (
      <g>
        <rect
          x="13"
          y="17"
          width="37"
          height="54"
          rx="2"
          fill={PAPER}
          stroke="#b8893a"
          strokeWidth="0.8"
        />
        <polygon points="13,17 50,17 13,71" fill={color} opacity="0.07" />
        <line x1="13" y1="71" x2="50" y2="17" stroke="#b8893a" strokeWidth="0.5" />
        <CourtHalf card={card} color={color} />
        <g transform="rotate(180 31.5 44)">
          <CourtHalf card={card} color={color} />
        </g>
      </g>
    );
  }
  if (rank === 1) {
    const big = card.suit === 'S';
    const size = big ? 34 : 26;
    return (
      <g fill={color}>
        <Pip suit={card.suit} x={31.5} y={44} size={size} />
        {big && (
          <g color={PAPER}>
            <use href={`#${ID.mark}`} x="25.5" y="38" width="12" height="12" />
          </g>
        )}
      </g>
    );
  }
  return (
    <g fill={color}>
      {PIPS[rank].map(([x, y], i) => (
        <Pip key={i} suit={card.suit} x={x} y={y} size={12} flip={y > 44} />
      ))}
    </g>
  );
}

export interface CardFaceProps {
  card: Card;
  className?: string;
  style?: React.CSSProperties;
}

function CardFaceBase({ card, className, style }: CardFaceProps) {
  const fourColor = useSettings((s) => s.fourColor);
  const color = suitColor(card.suit, fourColor);
  return (
    <svg
      viewBox="0 0 63 88"
      className={className}
      style={{ display: 'block', width: '100%', height: 'auto', ...style }}
      role="img"
      aria-label={cardAriaLabel(card)}
    >
      <rect width="63" height="88" rx="3.6" fill={PAPER} />
      <rect width="63" height="88" rx="3.6" fill={`url(#${ID.grain})`} />
      <rect
        x="1.9"
        y="1.9"
        width="59.2"
        height="84.2"
        rx="2.4"
        fill="none"
        stroke="#d9cfba"
        strokeWidth="0.45"
      />
      <rect
        x="0.25"
        y="0.25"
        width="62.5"
        height="87.5"
        rx="3.4"
        fill="none"
        stroke="#0000001f"
        strokeWidth="0.5"
      />
      {!isJoker(card) && (
        <>
          <Corner card={card} color={color} />
          <g transform="rotate(180 31.5 44)">
            <Corner card={card} color={color} />
          </g>
        </>
      )}
      <Face card={card} color={color} />
    </svg>
  );
}
export const CardFace = memo(CardFaceBase);

export function CardBack({
  variant,
  className,
  style,
}: {
  variant?: BackId;
  className?: string;
  style?: React.CSSProperties;
}) {
  const setting = useSettings((s) => s.cardBack);
  const v = variant ?? setting;
  return (
    <svg
      viewBox="0 0 63 88"
      className={className}
      style={{ display: 'block', width: '100%', height: 'auto', ...style }}
      role="img"
      aria-label="Card back"
    >
      <rect width="63" height="88" rx="3.6" fill="#ffffff" />
      <rect x="3.5" y="3.5" width="56" height="81" rx="1.6" fill={`url(#${ID.back(v)})`} />
      <rect
        x="3.5"
        y="3.5"
        width="56"
        height="81"
        rx="1.6"
        fill="none"
        stroke="#ffffff"
        strokeWidth="0.9"
      />
      <rect
        x="6.2"
        y="6.2"
        width="50.6"
        height="75.6"
        rx="1"
        fill="none"
        stroke="#ffffff"
        strokeWidth="0.5"
      />
      <path d="M31.5 24 46 44 31.5 64 17 44z" fill="#ffffff" />
      <path d="M31.5 27.5 42.5 44 31.5 60.5 20.5 44z" fill={`url(#${ID.back(v)})`} />
      <path d="M31.5 33 38 44 31.5 55 25 44z" fill="#ffffff" />
      <rect
        x="0.25"
        y="0.25"
        width="62.5"
        height="87.5"
        rx="3.4"
        fill="none"
        stroke="#0000001f"
        strokeWidth="0.5"
      />
    </svg>
  );
}
