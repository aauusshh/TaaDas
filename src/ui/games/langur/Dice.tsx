import { useEffect, useState } from 'react';
import { effectiveReduceMotion } from '../../../storage/settings';
import { LBSymbol, SYMBOL_NAMES } from './Symbols';
import s from './Dice.module.css';

/** [rotateX, rotateY] that brings face k to the front of the cube. */
const FACE_ROT: [number, number][] = [
  [0, 0], // crown
  [0, 180], // flag
  [0, -90], // heart
  [0, 90], // spade
  [-90, 0], // diamond
  [90, 0], // club
];
const FACE_AT = [
  'translateZ(var(--h))',
  'rotateY(180deg) translateZ(var(--h))',
  'rotateY(90deg) translateZ(var(--h))',
  'rotateY(-90deg) translateZ(var(--h))',
  'rotateX(90deg) translateZ(var(--h))',
  'rotateX(-90deg) translateZ(var(--h))',
];

/** An ivory cube with an SVG symbol on every face. With `value`, it tumbles to show that face. */
export function Die3D({
  value,
  size = 44,
  index = 0,
}: {
  value: number | null;
  size?: number;
  index?: number;
}) {
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setSettled(false);
    if (value === null) return;
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setSettled(true)));
    return () => cancelAnimationFrame(r);
  }, [value]);
  const [rx, ry] = FACE_ROT[value ?? 0];
  const reduce = effectiveReduceMotion();
  const start = reduce ? [rx, ry] : [rx + 360 * (2 + (index % 2)), ry - 360 * (1 + (index % 3))];
  const [ax, ay] = settled || value === null ? [rx, ry] : start;
  return (
    <div
      className={s.scene}
      style={{ width: size, height: size, ['--h' as string]: `${size / 2}px` }}
    >
      <div
        className={s.cube}
        data-settled={settled}
        style={{
          transform: `rotateX(${ax}deg) rotateY(${ay}deg)`,
          transitionDelay: `${index * 40}ms`,
        }}
        role="img"
        aria-label={value === null ? 'die' : SYMBOL_NAMES[value]}
      >
        {FACE_AT.map((at, k) => (
          <div key={k} className={s.face} style={{ transform: at }}>
            <LBSymbol idx={k} size={size * 0.62} />
          </div>
        ))}
      </div>
    </div>
  );
}
