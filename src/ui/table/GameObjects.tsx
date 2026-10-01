import type { Card, Rank, Suit } from '../../engine/core/cards';
import { CardFace } from '../cards/CardFace';
import { RangiCard } from '../cards/RangiCard';
import { ID } from '../cards/art/SvgDefs';
import type { GameId } from '../../engine/core/types';

let uid = 1000;
const mk = (suit: Suit, rank: Rank): Card => ({ id: uid++, suit, rank, copy: 0 });

function Fan({
  cards,
  w,
  spread = 14,
  lift = 0,
}: {
  cards: Card[];
  w: number;
  spread?: number;
  lift?: number;
}) {
  const n = cards.length;
  return (
    <div style={{ position: 'relative', width: w * (1 + (n - 1) * 0.42), height: w / 0.7159 + 10 }}>
      {cards.map((c, i) => {
        const t = n === 1 ? 0 : i / (n - 1) - 0.5;
        return (
          <div
            key={c.id}
            style={{
              position: 'absolute',
              left: i * w * 0.42,
              top: 5 + Math.abs(t) * 8 - lift,
              width: w,
              transform: `rotate(${t * spread * 2}deg)`,
              transformOrigin: '50% 130%',
              boxShadow: '0 1px 2px rgb(0 0 0 / 0.5)',
              borderRadius: '5.7% / 4.1%',
            }}
          >
            <CardFace card={c} />
          </div>
        );
      })}
    </div>
  );
}

function Die({
  sym,
  x,
  y,
  rot,
  size = 34,
}: {
  sym: 'H' | 'S' | 'D' | 'C';
  x: number;
  y: number;
  rot: number;
  size?: number;
}) {
  const red = sym === 'H' || sym === 'D';
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot})`}>
      <rect
        x={-size / 2}
        y={-size / 2}
        width={size}
        height={size}
        rx="6"
        fill="#f6efdc"
        stroke="#cdbf9c"
        strokeWidth="1"
      />
      <use
        href={`#${ID.pip(sym)}`}
        x={-size * 0.3}
        y={-size * 0.3}
        width={size * 0.6}
        height={size * 0.6}
        fill={red ? '#c8102e' : '#161616'}
      />
    </g>
  );
}

function Bowl() {
  return (
    <svg viewBox="0 0 130 120" width="132" height="120" aria-hidden="true">
      <ellipse cx="65" cy="64" rx="58" ry="54" fill="#6f4d14" />
      <circle cx="65" cy="60" r="56" fill="url(#bowlOuter)" />
      <circle cx="65" cy="60" r="47" fill="#8d6420" />
      <circle cx="65" cy="62" r="42" fill="url(#bowlInner)" />
      <circle cx="65" cy="60" r="56" fill="none" stroke="#e8c677" strokeWidth="1.5" opacity="0.7" />
      <Die sym="H" x={52} y={58} rot={-14} />
      <Die sym="S" x={80} y={66} rot={18} />
      <defs>
        <radialGradient id="bowlOuter" cx="35%" cy="30%">
          <stop offset="0" stopColor="#e6c476" />
          <stop offset="1" stopColor="#a87a28" />
        </radialGradient>
        <radialGradient id="bowlInner" cx="55%" cy="65%">
          <stop offset="0" stopColor="#a67a2a" />
          <stop offset="1" stopColor="#5e400f" />
        </radialGradient>
      </defs>
    </svg>
  );
}

function Between() {
  return (
    <div style={{ position: 'relative', width: 150, height: 112 }}>
      {[
        { c: mk('C', 3), x: 0, r: -8 },
        { c: mk('D', 11), x: 90, r: 7 },
      ].map(({ c, x, r }) => (
        <div
          key={c.id}
          style={{
            position: 'absolute',
            left: x,
            top: 10,
            width: 58,
            transform: `rotate(${r}deg)`,
            boxShadow: '0 1px 2px rgb(0 0 0 / 0.5)',
            borderRadius: '5.7% / 4.1%',
          }}
        >
          <CardFace card={c} />
        </div>
      ))}
      <div
        style={{
          position: 'absolute',
          left: 46,
          top: 0,
          width: 58,
          transform: 'rotate(2deg)',
          boxShadow: '0 2px 3px rgb(0 0 0 / 0.55)',
          borderRadius: '5.7% / 4.1%',
          zIndex: 2,
        }}
      >
        <CardFace card={mk('S', 7)} />
      </div>
    </div>
  );
}

const ART: Record<string, () => JSX.Element> = {
  callbreak: () => <Fan w={62} cards={[mk('H', 12), mk('C', 11), mk('S', 13), mk('S', 1)]} />,
  marriage: () => <Fan w={64} spread={9} cards={[mk('H', 6), mk('H', 7), mk('H', 8)]} />,
  teenpatti: () => <Fan w={66} spread={11} cards={[mk('S', 7), mk('H', 7), mk('D', 7)]} />,
  dhumbal: () => (
    <Fan w={56} spread={12} cards={[mk('C', 2), mk('D', 2), mk('S', 9), mk('H', 1)]} />
  ),
  jutpatti: () => <Fan w={64} spread={10} cards={[mk('H', 11), mk('H', 12), mk('H', 13)]} />,
  kitti: () => <Fan w={62} spread={13} cards={[mk('C', 9), mk('D', 9), mk('S', 4)]} />,
  inbetween: () => <Between />,
  rangi: () => (
    <div style={{ position: 'relative', width: 150, height: 112 }}>
      {[
        { c: 'sky' as const, v: 7, x: 0, r: -10 },
        { c: 'sindoor' as const, v: 'skip' as const, x: 36, r: 0 },
        { c: 'marigold' as const, v: 4, x: 72, r: 11 },
      ].map(({ c, v, x, r }, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: x,
            top: 8,
            width: 62,
            transform: `rotate(${r}deg)`,
            transformOrigin: '50% 130%',
            boxShadow: '0 1px 2px rgb(0 0 0 / 0.5)',
            borderRadius: '5.7% / 4.1%',
          }}
        >
          <RangiCard color={c} value={v} />
        </div>
      ))}
    </div>
  ),
  langurburja: () => <Bowl />,
};

export function GameObject({ id }: { id: GameId | string }) {
  const Art = ART[id];
  return Art ? <Art /> : null;
}
