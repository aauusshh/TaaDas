// Shared SVG symbols for every card. Mounted once; cards reference them with <use>.
// All art here is original: suits, court emblems (crown, lotus, dhaka topi), card backs.

export const ID = {
  grain: 'ch-grain',
  rtex: 'ch-rtex',
  pip: (s: string) => `ch-pip-${s}`,
  crown: 'ch-crown',
  lotus: 'ch-lotus',
  topi: 'ch-topi',
  mark: 'ch-mark',
  star: 'ch-star',
  back: (v: string) => `ch-back-${v}`,
} as const;

const BACKS: Record<string, [string, string]> = {
  dhaka: ['#b0243a', '#4a0e18'],
  indigo: ['#2b3a8c', '#121a4a'],
  forest: ['#1f6b4c', '#0c2e20'],
};

function star(points: number, outer: number, inner: number) {
  const pts: string[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    pts.push(`${(20 + r * Math.cos(a)).toFixed(2)},${(15 + r * Math.sin(a)).toFixed(2)}`);
  }
  return pts.join(' ');
}

export function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <defs>
        <pattern id={ID.grain} width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="3" r="0.5" fill="#6b5a3a" opacity="0.07" />
          <circle cx="9" cy="1.5" r="0.4" fill="#6b5a3a" opacity="0.06" />
          <circle cx="6" cy="8" r="0.55" fill="#6b5a3a" opacity="0.07" />
          <circle cx="12" cy="10" r="0.4" fill="#6b5a3a" opacity="0.06" />
          <circle cx="3.5" cy="12.5" r="0.45" fill="#6b5a3a" opacity="0.06" />
        </pattern>

        {/* faint dhaka-style diamonds on Rangi cards, about 8% */}
        <pattern id={ID.rtex} width="9" height="9" patternUnits="userSpaceOnUse">
          <path
            d="M4.5 0.8 8.2 4.5 4.5 8.2 0.8 4.5z"
            fill="none"
            stroke="#ffffff"
            strokeWidth="0.6"
            opacity="0.09"
          />
          <path d="M4.5 3.2 5.8 4.5 4.5 5.8 3.2 4.5z" fill="#ffffff" opacity="0.08" />
        </pattern>

        {/* suit pips, 100x100 box */}
        <symbol id={ID.pip('H')} viewBox="0 0 100 100">
          <path d="M50 92C22 68 4 50 4 31 4 15 16 6 29 6c9 0 17 5 21 14 4-9 12-14 21-14 13 0 25 9 25 25 0 19-18 37-46 61z" />
        </symbol>
        <symbol id={ID.pip('D')} viewBox="0 0 100 100">
          <path d="M50 2Q70 28 94 50 70 72 50 98 30 72 6 50 30 28 50 2z" />
        </symbol>
        <symbol id={ID.pip('S')} viewBox="0 0 100 100">
          <path d="M50 3C60 24 94 40 94 63c0 15-11 24-24 24-8 0-14-4-18-10 1 9 4 15 12 19H36c8-4 11-10 12-19-4 6-10 10-18 10-13 0-24-9-24-24C6 40 40 24 50 3z" />
        </symbol>
        <symbol id={ID.pip('C')} viewBox="0 0 100 100">
          <circle cx="50" cy="29" r="23" />
          <circle cx="27" cy="63" r="23" />
          <circle cx="73" cy="63" r="23" />
          <path d="M50 48C50 74 46 88 36 98h28C54 88 50 74 50 48z" />
        </symbol>

        {/* court emblems, 40x30 box. suit-colored shapes use currentColor, accents are brass */}
        <symbol id={ID.crown} viewBox="0 0 40 30">
          <path d="M4 25 2 7l10 8L20 3l8 12 10-8-2 18z" fill="currentColor" />
          <rect x="4" y="21" width="32" height="5" fill="#b8893a" />
          <circle cx="2" cy="7" r="2.2" fill="#b8893a" />
          <circle cx="20" cy="3" r="2.4" fill="#b8893a" />
          <circle cx="38" cy="7" r="2.2" fill="#b8893a" />
          <circle cx="12" cy="23.5" r="1.1" fill="#fbf8f1" />
          <circle cx="20" cy="23.5" r="1.1" fill="#fbf8f1" />
          <circle cx="28" cy="23.5" r="1.1" fill="#fbf8f1" />
        </symbol>
        <symbol id={ID.lotus} viewBox="0 0 40 30">
          <path
            d="M20 28C8 28 1 24 0 17c8-1 16 2 20 11zM20 28c12 0 19-4 20-11-8-1-16 2-20 11z"
            fill="#b8893a"
          />
          <path
            d="M20 28C10 26 4 19 4 9c8 2 14 8 16 19zM20 28c10-2 16-9 16-19-8 2-14 8-16 19z"
            fill="currentColor"
          />
          <path d="M20 3c6 8 6 17 0 25-6-8-6-17 0-25z" fill="currentColor" />
          <path d="M20 8c3 6 3 12 0 17-3-5-3-11 0-17z" fill="#fbf8f1" opacity="0.55" />
        </symbol>
        <symbol id={ID.topi} viewBox="0 0 40 30">
          <path d="M5 27V12C5 6 9 4 14 6l16 6c6 2 8 4 8 9v6z" fill="currentColor" />
          <path d="M5 20l5-4 5 4 5-4 5 4 5-4 5 4 3-2v13H5z" fill="#b8893a" />
          <path
            d="M5 24l5-3.5 5 3.5 5-3.5 5 3.5 5-3.5 5 3.5 3-2"
            fill="none"
            stroke="#fbf8f1"
            strokeWidth="1"
          />
          <circle cx="16" cy="9" r="1.3" fill="#b8893a" />
        </symbol>

        {/* the brand mark: a chautari, tree over a stone platform. 40x40 */}
        <symbol id={ID.mark} viewBox="0 0 40 40">
          <path d="M6 24c0-9 6-16 14-16s14 7 14 16z" fill="currentColor" />
          <rect x="18.4" y="22" width="3.2" height="9" fill="currentColor" />
          <rect x="6" y="31" width="28" height="4" rx="0.6" fill="currentColor" />
          <rect x="10" y="35" width="20" height="2.4" fill="currentColor" />
        </symbol>

        <symbol id={ID.star} viewBox="0 0 40 30">
          <polygon points={star(8, 14.5, 7)} fill="#b8893a" />
          <polygon points={star(8, 9, 4.5)} fill="currentColor" />
          <circle cx="20" cy="15" r="2.6" fill="#fbf8f1" />
        </symbol>

        {Object.entries(BACKS).map(([v, [a, b]]) => (
          <pattern key={v} id={ID.back(v)} width="10" height="10" patternUnits="userSpaceOnUse">
            <rect width="10" height="10" fill={a} />
            <path d="M5 0 10 5 5 10 0 5z" fill="none" stroke={b} strokeWidth="1.1" />
            <path d="M5 2.8 7.2 5 5 7.2 2.8 5z" fill={b} />
            <circle cx="0" cy="0" r="0.8" fill="#fbf8f1" />
            <circle cx="10" cy="0" r="0.8" fill="#fbf8f1" />
            <circle cx="0" cy="10" r="0.8" fill="#fbf8f1" />
            <circle cx="10" cy="10" r="0.8" fill="#fbf8f1" />
          </pattern>
        ))}
      </defs>
    </svg>
  );
}
