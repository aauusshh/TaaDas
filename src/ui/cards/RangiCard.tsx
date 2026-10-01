import { memo } from 'react';
import { ID } from './art/SvgDefs';

export type RangiColor = 'sindoor' | 'marigold' | 'sky' | 'leaf';
export type RangiValue = number | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';

export const RANGI_COLORS: readonly RangiColor[] = ['sindoor', 'marigold', 'sky', 'leaf'];
export const RANGI_HEX: Record<RangiColor, string> = {
  sindoor: '#d2232a',
  marigold: '#f2a900',
  sky: '#1c6dd0',
  leaf: '#2e9a4f',
};
const PAPER = '#fbf8f1';
const BLACK = '#1b1b21';

/** Corner symbols (sun, flower, mountain, leaf) so color is never the only signal. */
export function RangiSymbol({
  color,
  x,
  y,
  s,
  fill,
}: {
  color: RangiColor;
  x: number;
  y: number;
  s: number;
  fill: string;
}) {
  const h = s / 2;
  if (color === 'sindoor') {
    return (
      <g fill={fill} stroke={fill} strokeWidth={s * 0.1} strokeLinecap="round">
        <circle cx={x} cy={y} r={h * 0.52} stroke="none" />
        {Array.from({ length: 8 }, (_, i) => {
          const a = (i * Math.PI) / 4;
          return (
            <line
              key={i}
              x1={x + Math.cos(a) * h * 0.72}
              y1={y + Math.sin(a) * h * 0.72}
              x2={x + Math.cos(a) * h}
              y2={y + Math.sin(a) * h}
            />
          );
        })}
      </g>
    );
  }
  if (color === 'marigold') {
    return (
      <g fill={fill}>
        {Array.from({ length: 5 }, (_, i) => {
          const a = (i * 2 * Math.PI) / 5 - Math.PI / 2;
          return (
            <circle
              key={i}
              cx={x + Math.cos(a) * h * 0.55}
              cy={y + Math.sin(a) * h * 0.55}
              r={h * 0.45}
            />
          );
        })}
      </g>
    );
  }
  if (color === 'sky') {
    return (
      <path
        d={`M${x - h} ${y + h * 0.8}L${x - h * 0.25} ${y - h * 0.6}L${x + h * 0.15} ${y + h * 0.05}L${x + h * 0.5} ${y - h * 0.3}L${x + h} ${y + h * 0.8}z`}
        fill={fill}
      />
    );
  }
  return (
    <g>
      <path
        d={`M${x - h * 0.85} ${y + h * 0.85}C${x - h * 1.05} ${y - h * 0.3} ${x - h * 0.2} ${y - h} ${x + h * 0.95} ${y - h * 0.9}C${x + h} ${y + h * 0.2} ${x + h * 0.3} ${y + h * 0.95} ${x - h * 0.85} ${y + h * 0.85}z`}
        fill={fill}
      />
    </g>
  );
}

/** Raised open palm: the Skip icon. */
function Palm({ fill }: { fill: string }) {
  return (
    <g fill={fill}>
      <rect x="24.6" y="30" width="3.2" height="17" rx="1.6" />
      <rect x="28.4" y="26.5" width="3.2" height="20.5" rx="1.6" />
      <rect x="32.2" y="28" width="3.2" height="19" rx="1.6" />
      <rect x="36" y="32" width="3" height="15" rx="1.5" />
      <path d="M24.6 44h14.4v6.5c0 4.5-3.2 8-7.2 8s-7.2-3.5-7.2-8z" />
      <rect x="19.4" y="42" width="3.4" height="12" rx="1.7" transform="rotate(-38 21 48)" />
    </g>
  );
}

function Mandala({ r = 12 }: { r?: number }) {
  return (
    <g>
      {RANGI_COLORS.map((c, i) => (
        <ellipse
          key={c}
          cx="31.5"
          cy={44 - r * 0.62}
          rx={r * 0.46}
          ry={r * 0.78}
          fill={RANGI_HEX[c]}
          transform={`rotate(${i * 90} 31.5 44)`}
        />
      ))}
      <circle cx="31.5" cy="44" r={r * 0.3} fill={PAPER} />
      <circle cx="31.5" cy="44" r={r * 0.3} fill="none" stroke={BLACK} strokeWidth="0.6" />
    </g>
  );
}

function Glyph({ value, color }: { value: RangiValue; color: string }) {
  if (typeof value === 'number') {
    return (
      <text
        x="31.5"
        y="55.2"
        textAnchor="middle"
        fontSize="31"
        fill={color}
        fontFamily="var(--font-display)"
      >
        {value}
      </text>
    );
  }
  if (value === 'skip') return <Palm fill={color} />;
  if (value === 'reverse') {
    return (
      <g fill="none" stroke={color} strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 43a11 11 0 0 1 19-5" />
        <path d="M42 31v8h-8" />
        <path d="M42 49a11 11 0 0 1-19 5" />
        <path d="M21 61v-8h8" />
      </g>
    );
  }
  if (value === 'draw2') {
    return (
      <g>
        <rect
          x="22"
          y="31"
          width="12"
          height="17"
          rx="1.8"
          fill={color}
          transform="rotate(-12 28 40)"
        />
        <rect
          x="29"
          y="33"
          width="12"
          height="17"
          rx="1.8"
          fill={color}
          stroke={PAPER}
          strokeWidth="1.2"
          transform="rotate(9 35 42)"
        />
        <text
          x="31.5"
          y="63"
          textAnchor="middle"
          fontSize="12"
          fontWeight="700"
          fill={color}
          fontFamily="var(--font-ui)"
        >
          +2
        </text>
      </g>
    );
  }
  if (value === 'wild') return <Mandala r={13} />;
  return (
    <g>
      <g transform="translate(0 -4) scale(1)">
        <Mandala r={11} />
      </g>
      <text
        x="31.5"
        y="64"
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fill={BLACK}
        fontFamily="var(--font-ui)"
      >
        +4
      </text>
    </g>
  );
}

const label = (v: RangiValue) =>
  typeof v === 'number'
    ? String(v)
    : {
        skip: 'Skip',
        reverse: 'Reverse',
        draw2: 'Draw two',
        wild: 'Wild',
        wild4: 'Wild draw four',
      }[v];

const cornerText = (v: RangiValue) =>
  typeof v === 'number'
    ? String(v)
    : { skip: 'S', reverse: 'R', draw2: '+2', wild: 'W', wild4: '+4' }[v];

export interface RangiCardProps {
  /** wild cards have no color */
  color?: RangiColor;
  value: RangiValue;
  className?: string;
  style?: React.CSSProperties;
}

function RangiCardBase({ color, value, className, style }: RangiCardProps) {
  const field = color ? RANGI_HEX[color] : BLACK;
  const corner = (
    <g fill={PAPER} aria-hidden="true">
      <text
        x="8.4"
        y="14"
        textAnchor="middle"
        fontSize={cornerText(value).length > 1 ? 9 : 11.5}
        fontWeight="700"
        fontFamily="var(--font-ui)"
      >
        {cornerText(value)}
      </text>
      {color ? (
        <RangiSymbol color={color} x={8.4} y={21.4} s={6.4} fill={PAPER} />
      ) : (
        <circle cx="8.4" cy="21" r="2.6" fill={PAPER} opacity="0.9" />
      )}
    </g>
  );
  return (
    <svg
      viewBox="0 0 63 88"
      className={className}
      style={{ display: 'block', width: '100%', height: 'auto', ...style }}
      role="img"
      aria-label={`${color ? color + ' ' : ''}${label(value)}`}
    >
      <rect width="63" height="88" rx="4" fill={PAPER} />
      <rect x="2.6" y="2.6" width="57.8" height="82.8" rx="2.8" fill={field} />
      <rect x="2.6" y="2.6" width="57.8" height="82.8" rx="2.8" fill={`url(#${ID.rtex})`} />
      {corner}
      <g transform="rotate(180 31.5 44)">{corner}</g>
      <rect x="12.5" y="21" width="38" height="46" rx="7" fill={PAPER} />
      <rect
        x="14.5"
        y="23"
        width="34"
        height="42"
        rx="5"
        fill="none"
        stroke={field}
        strokeWidth="0.6"
        opacity="0.45"
      />
      <Glyph value={value} color={color ? field : BLACK} />
      <rect
        x="0.25"
        y="0.25"
        width="62.5"
        height="87.5"
        rx="3.8"
        fill="none"
        stroke="#0000001f"
        strokeWidth="0.5"
      />
    </svg>
  );
}
export const RangiCard = memo(RangiCardBase);

export function RangiBack({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 63 88"
      className={className}
      style={{ display: 'block', width: '100%', height: 'auto', ...style }}
      role="img"
      aria-label="Rangi card back"
    >
      <rect width="63" height="88" rx="4" fill={PAPER} />
      <rect x="2.6" y="2.6" width="57.8" height="82.8" rx="2.8" fill={BLACK} />
      <rect
        x="6"
        y="6"
        width="51"
        height="76"
        rx="2"
        fill="none"
        stroke={PAPER}
        strokeWidth="0.5"
        opacity="0.5"
      />
      {RANGI_COLORS.map((c, i) => (
        <line
          key={c}
          x1={8 + i * 12.75}
          y1="9"
          x2={8 + (i + 1) * 12.75}
          y2="9"
          stroke={RANGI_HEX[c]}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      ))}
      {RANGI_COLORS.map((c, i) => (
        <line
          key={c}
          x1={8 + i * 12.75}
          y1="79"
          x2={8 + (i + 1) * 12.75}
          y2="79"
          stroke={RANGI_HEX[c]}
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      ))}
      <text
        x="31.5"
        y="47"
        textAnchor="middle"
        fontSize="13"
        fill={PAPER}
        fontFamily="var(--font-display)"
        transform="rotate(-90 31.5 44)"
        letterSpacing="1"
      >
        Rangi
      </text>
      <rect
        x="0.25"
        y="0.25"
        width="62.5"
        height="87.5"
        rx="3.8"
        fill="none"
        stroke="#0000001f"
        strokeWidth="0.5"
      />
    </svg>
  );
}
