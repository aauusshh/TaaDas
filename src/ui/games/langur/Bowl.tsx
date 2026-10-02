import { useAnchor } from '../../anim/anchors';
import s from './Bowl.module.css';

export type BowlState = 'covered' | 'shaking' | 'lifted';

/** A brass bowl seen from above. The lid covers the dice until the banker lifts it. */
export function Bowl({ state, size = 132 }: { state: BowlState; size?: number }) {
  const ref = useAnchor('bowl');
  return (
    <div ref={ref} className={s.bowl} style={{ width: size, height: size }} data-state={state}>
      <svg viewBox="0 0 130 130" width={size} height={size} aria-hidden="true">
        <defs>
          <radialGradient id="bowlOuterG" cx="35%" cy="30%">
            <stop offset="0" stopColor="#e9c97c" />
            <stop offset="1" stopColor="#a47624" />
          </radialGradient>
          <radialGradient id="bowlInnerG" cx="55%" cy="65%">
            <stop offset="0" stopColor="#b2842e" />
            <stop offset="1" stopColor="#5a3d0e" />
          </radialGradient>
          <radialGradient id="lidG" cx="38%" cy="32%">
            <stop offset="0" stopColor="#f0d58d" />
            <stop offset="1" stopColor="#b88a2e" />
          </radialGradient>
        </defs>
        <circle cx="65" cy="68" r="60" fill="#5e400f" opacity="0.5" />
        <circle cx="65" cy="64" r="60" fill="url(#bowlOuterG)" />
        <circle
          cx="65"
          cy="64"
          r="60"
          fill="none"
          stroke="#f1dc9e"
          strokeWidth="1.6"
          opacity="0.7"
        />
        <circle cx="65" cy="64" r="50" fill="#8d6420" />
        <circle cx="65" cy="66" r="45" fill="url(#bowlInnerG)" />
        <g className={s.lid}>
          <circle cx="65" cy="64" r="44" fill="url(#lidG)" />
          <circle cx="65" cy="64" r="44" fill="none" stroke="#8a6320" strokeWidth="1.4" />
          <circle
            cx="65"
            cy="64"
            r="34"
            fill="none"
            stroke="#8a6320"
            strokeWidth="1"
            strokeDasharray="3 4"
          />
          <circle cx="65" cy="64" r="9" fill="#8a6320" />
          <circle cx="63.5" cy="62.5" r="6" fill="#e9c97c" />
        </g>
      </svg>
    </div>
  );
}
