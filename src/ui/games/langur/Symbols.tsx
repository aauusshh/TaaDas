import { ID } from '../../cards/art/SvgDefs';

const RED = '#c0182b';
const INK = '#1a1a1a';

/** Crown, Flag, Heart, Spade, Diamond, Club: the six faces. */
export const SYMBOL_COLOR = [RED, INK, RED, INK, RED, INK] as const;
export const SYMBOL_NAMES = ['crown', 'flag', 'heart', 'spade', 'diamond', 'club'] as const;
const PIPS = [null, null, 'H', 'S', 'D', 'C'] as const;

export function Flag() {
  return (
    <g>
      <rect x="9" y="4" width="2.6" height="32" rx="1.2" />
      <path d="M11.6 5.5 31 13.5 11.6 21z" />
      <path d="M11.6 18.5 34 27.5 11.6 35z" />
    </g>
  );
}

/** One symbol drawn in a 40x40 box. */
export function LBSymbol({
  idx,
  size = 40,
  color,
}: {
  idx: number;
  size?: number;
  color?: string;
}) {
  const c = color ?? SYMBOL_COLOR[idx];
  const pip = PIPS[idx];
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      style={{ display: 'block', color: c }}
      fill={c}
      aria-hidden="true"
    >
      {idx === 0 && <use href={`#${ID.crown}`} x="2" y="6" width="36" height="27" />}
      {idx === 1 && <Flag />}
      {pip && <use href={`#${ID.pip(pip)}`} x="3" y="3" width="34" height="34" />}
    </svg>
  );
}
