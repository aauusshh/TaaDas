import { memo } from 'react';
import { ID } from './art/SvgDefs';

export type RangiColor = 'marigold' | 'sindoor' | 'neel' | 'pipal';
export type RangiValue = number | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild4';

export const RANGI_HEX: Record<RangiColor, string> = {
  marigold: '#e39b12',
  sindoor: '#c93a22',
  neel: '#2d58a8',
  pipal: '#2e7d4b',
};
const PAPER = '#fbf8f1';
const ORDER: RangiColor[] = ['marigold', 'sindoor', 'neel', 'pipal'];

/** Corner shapes so color is never the only signal. */
function Shape({
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
  if (color === 'marigold') return <circle cx={x} cy={y} r={h} fill={fill} />;
  if (color === 'sindoor')
    return <path d={`M${x} ${y - h}L${x + h} ${y + h}H${x - h}z`} fill={fill} />;
  if (color === 'neel')
    return (
      <rect x={x - h * 0.85} y={y - h * 0.85} width={s * 0.85} height={s * 0.85} fill={fill} />
    );
  return (
    <path
      d={`M${x} ${y - h}C${x + h * 1.2} ${y - h * 0.3} ${x + h * 1.2} ${y + h * 0.4} ${x} ${y + h}C${x - h * 1.2} ${y + h * 0.4} ${x - h * 1.2} ${y - h * 0.3} ${x} ${y - h}z`}
      fill={fill}
    />
  );
}

function Glyph({ value, color, ink }: { value: RangiValue; color: string; ink: string }) {
  if (typeof value === 'number') {
    return (
      <text
        x="31.5"
        y="56"
        textAnchor="middle"
        fontSize="30"
        fill={color}
        fontFamily="var(--font-display)"
      >
        {value}
      </text>
    );
  }
  if (value === 'skip') {
    return (
      <g fill="none" stroke={color} strokeWidth="4.2" strokeLinecap="round">
        <circle cx="31.5" cy="46" r="11" />
        <line x1="23.5" y1="54" x2="39.5" y2="38" />
      </g>
    );
  }
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
          x="21"
          y="36"
          width="12"
          height="17"
          rx="1.6"
          fill={color}
          transform="rotate(-12 27 44)"
        />
        <rect
          x="30"
          y="38"
          width="12"
          height="17"
          rx="1.6"
          fill={ink}
          stroke={PAPER}
          strokeWidth="1"
          transform="rotate(10 36 46)"
        />
        <text
          x="31.5"
          y="66"
          textAnchor="middle"
          fontSize="11"
          fontWeight="700"
          fill={color}
          fontFamily="var(--font-ui)"
        >
          +2
        </text>
      </g>
    );
  }
  const quarters = (
    <g>
      {ORDER.map((c, i) => (
        <path
          key={c}
          d={
            [
              'M31.5 46V32a14 14 0 0 1 14 14z',
              'M31.5 46H45.5a14 14 0 0 1-14 14z',
              'M31.5 46V60a14 14 0 0 1-14-14z',
              'M31.5 46H17.5a14 14 0 0 1 14-14z',
            ][i]
          }
          fill={RANGI_HEX[c]}
        />
      ))}
    </g>
  );
  if (value === 'wild') return quarters;
  return (
    <g>
      <g transform="translate(0 -3)">{quarters}</g>
      <text
        x="31.5"
        y="68"
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fill={ink}
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
  /** undefined for wild cards that haven't been given a color */
  color?: RangiColor;
  value: RangiValue;
  className?: string;
  style?: React.CSSProperties;
}

function RangiCardBase({ color, value, className, style }: RangiCardProps) {
  const field = color ? RANGI_HEX[color] : '#26262e';
  const ink = color ? field : '#26262e';
  const isWild = value === 'wild' || value === 'wild4';
  const corner = (
    <g fill={PAPER} aria-hidden="true">
      <text
        x="8.4"
        y="14.2"
        textAnchor="middle"
        fontSize={cornerText(value).length > 1 ? 9.5 : 12}
        fontWeight="700"
        fontFamily="var(--font-ui)"
      >
        {cornerText(value)}
      </text>
      {color && <Shape color={color} x={8.4} y={21} s={5.6} fill={PAPER} />}
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
      <rect x="2.6" y="2.6" width="57.8" height="82.8" rx="2.6" fill={field} />
      <rect
        x="2.6"
        y="2.6"
        width="57.8"
        height="82.8"
        rx="2.6"
        fill={`url(#${ID.grain})`}
        opacity="0.5"
      />
      {corner}
      <g transform="rotate(180 31.5 44)">{corner}</g>
      <path d="M13 72V45a18.5 18.5 0 0 1 37 0v27z" fill={PAPER} />
      <path
        d="M16.5 72V45a15 15 0 0 1 30 0v27"
        fill="none"
        stroke={field}
        strokeWidth="0.7"
        opacity="0.5"
      />
      <Glyph value={value} color={isWild ? ink : field} ink={isWild ? '#26262e' : field} />
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
      <rect x="2.6" y="2.6" width="57.8" height="82.8" rx="2.6" fill="#26262e" />
      <path d="M11 74V46a20.5 20.5 0 0 1 41 0v28z" fill="none" stroke={PAPER} strokeWidth="1.2" />
      {ORDER.map((c, i) => (
        <circle
          key={c}
          cx={22 + (i % 2) * 19}
          cy={40 + Math.floor(i / 2) * 13}
          r="5.4"
          fill={RANGI_HEX[c]}
        />
      ))}
      <use href={`#${ID.mark}`} x="25" y="9" width="13" height="13" color={PAPER} />
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
