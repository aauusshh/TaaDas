import { useAnchor } from '../anim/anchors';
import s from './ChipStack.module.css';

export const DENOMS = [
  { v: 1000, color: '#1c1c1f', edge: '#fbf8f1', text: '#fbf8f1' },
  { v: 500, color: '#1f7a4d', edge: '#fbf8f1', text: '#fbf8f1' },
  { v: 100, color: '#2158a8', edge: '#fbf8f1', text: '#fbf8f1' },
  { v: 50, color: '#b8262c', edge: '#fbf8f1', text: '#fbf8f1' },
  { v: 10, color: '#f1ede2', edge: '#b8262c', text: '#6b5a3a' },
] as const;

/** Break an amount into chips, largest first; below 10 shows a single white chip. */
export function chipsFor(amount: number, max = 14) {
  const out: (typeof DENOMS)[number][] = [];
  let left = Math.max(0, Math.floor(amount));
  for (const d of DENOMS) {
    while (left >= d.v && out.length < max) {
      out.push(d);
      left -= d.v;
    }
  }
  if (out.length === 0 && amount > 0) out.push(DENOMS[4]);
  return out;
}

function Chip({ d, i, size }: { d: (typeof DENOMS)[number]; i: number; size: number }) {
  const dx = Math.sin(i * 9.1) * 1.4;
  return (
    <div
      className={s.chip}
      style={{
        width: size,
        height: size,
        bottom: i * 3.4,
        left: `calc(50% - ${size / 2}px + ${dx}px)`,
        background: `repeating-conic-gradient(${d.edge} 0 14deg, ${d.color} 14deg 45deg)`,
      }}
    >
      <div className={s.face} style={{ background: d.color, color: d.text, inset: size * 0.16 }} />
    </div>
  );
}

export function ChipStack({
  amount,
  size = 34,
  label = true,
  anchorKey,
}: {
  amount: number;
  size?: number;
  label?: boolean;
  anchorKey?: string;
}) {
  const ref = useAnchor(anchorKey ?? '__unused');
  const chips = chipsFor(amount);
  const top = chips.length * 3.4 + size * 0.5;
  return (
    <div
      ref={anchorKey ? ref : undefined}
      className={s.stack}
      style={{ width: size + 6, height: top + 6 }}
    >
      {chips.map((d, i) => (
        <Chip key={i} d={d} i={i} size={size} />
      ))}
      {label && <span className={`${s.amount} num`}>{amount.toLocaleString('en-US')}</span>}
    </div>
  );
}
