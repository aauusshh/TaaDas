import type { ReactNode } from 'react';

export const AVATAR_IDS = [
  'yak',
  'danphe',
  'rhododendron',
  'mountain',
  'tiger',
  'rhino',
  'bell',
  'diyo',
  'marigold',
  'momo',
  'flags',
  'leopard',
  'kite',
  'madal',
  'dhaka',
  'sun',
] as const;
export type AvatarId = (typeof AVATAR_IDS)[number];

const F = '#fbf8f1';
const B = '#e0b862';

const BG: Record<AvatarId, string> = {
  yak: '#6a4a2c',
  danphe: '#2a5a8a',
  rhododendron: '#a8283c',
  mountain: '#3b4f7a',
  tiger: '#b8601c',
  rhino: '#5d6b66',
  bell: '#8a6a1e',
  diyo: '#7a2a1c',
  marigold: '#b87a10',
  momo: '#4a6b4a',
  flags: '#2a3a5a',
  leopard: '#6a5a3a',
  kite: '#2e6a6a',
  madal: '#6a2e3a',
  dhaka: '#8a1f33',
  sun: '#9a4a14',
};

const art: Record<AvatarId, ReactNode> = {
  yak: (
    <g>
      <path d="M12 17C5 15 3 9 6 5c1 5 4 7 9 8zM28 17c7-2 9-8 6-12-1 5-4 7-9 8z" fill={F} />
      <ellipse cx="20" cy="23" rx="9.5" ry="11" fill="#2e1e10" />
      <path d="M11 20c1-6 5-8 9-8s8 2 9 8c-3-2-6-2-9-2s-6 0-9 2z" fill="#2e1e10" />
      <ellipse cx="20" cy="31" rx="5.5" ry="3.8" fill={B} />
      <circle cx="16" cy="22" r="1.4" fill={F} />
      <circle cx="24" cy="22" r="1.4" fill={F} />
      <circle cx="18.2" cy="31" r="0.8" fill="#2e1e10" />
      <circle cx="21.8" cy="31" r="0.8" fill="#2e1e10" />
    </g>
  ),
  danphe: (
    <g>
      {[0, 1, 2, 3, 4].map((i) => (
        <path
          key={i}
          d={`M17 30L${6 + i * 3.4} 37`}
          stroke={['#2f8f6f', '#3b6fd0', '#d8a020', '#2f8f6f', '#3b6fd0'][i]}
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      ))}
      <ellipse cx="19" cy="24" rx="8" ry="10" fill="#3b6fd0" />
      <path d="M13 22c4 2 8 2 12-1" stroke="#2f8f6f" strokeWidth="3" fill="none" />
      <circle cx="24" cy="12" r="5" fill="#2f8f6f" />
      <path d="M28 12l5 1.5-5 2z" fill={B} />
      <path
        d="M22 8l-2-4M24 7l0-4.5M26 8l2-3.5"
        stroke={F}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <circle cx="26" cy="11" r="0.9" fill="#111" />
    </g>
  ),
  rhododendron: (
    <g>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse
          key={a}
          cx="20"
          cy="11.5"
          rx="5.8"
          ry="8"
          fill={F}
          transform={`rotate(${a} 20 20)`}
        />
      ))}
      {[0, 72, 144, 216, 288].map((a) => (
        <path
          key={a}
          d="M20 17v-5"
          stroke="#a8283c"
          strokeWidth="0.9"
          transform={`rotate(${a} 20 20)`}
        />
      ))}
      <circle cx="20" cy="20" r="3.2" fill={B} />
    </g>
  ),
  mountain: (
    <g>
      <path d="M2 33 15 9l9 15 4-6 10 15z" fill="#1d2a45" />
      <path d="M15 9l-5 9 4-2.5 3 3 2-4zM28 18l-3 5 3-1.6 2.5 1.6z" fill={F} />
      <circle cx="31" cy="9" r="3" fill={B} />
    </g>
  ),
  tiger: (
    <g>
      <circle cx="9.5" cy="11" r="4" fill="#e8872a" />
      <circle cx="30.5" cy="11" r="4" fill="#e8872a" />
      <circle cx="20" cy="22" r="13.5" fill="#e8872a" />
      <path
        d="M6.5 19l5 1.5M6 24l5 0M7.5 29l5-2M33.5 19l-5 1.5M34 24h-5M32.5 29l-5-2M20 9v6"
        stroke="#2a1608"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <ellipse cx="20" cy="28" rx="6.5" ry="5" fill={F} />
      <circle cx="14.5" cy="21" r="1.5" fill="#2a1608" />
      <circle cx="25.5" cy="21" r="1.5" fill="#2a1608" />
      <path d="M17.5 25h5l-2.5 3z" fill="#2a1608" />
    </g>
  ),
  rhino: (
    <g>
      <path
        d="M4 26c0-8 6-14 15-14 6 0 11 2 14 7l3 8c0 4-3 6-7 6H12c-5 0-8-3-8-7z"
        fill="#8a9a94"
      />
      <path d="M31 19c3-1 4 0 5 2" stroke="#8a9a94" strokeWidth="0" />
      <path d="M8 24C5 18 8 8 17 6c-2 4-3 7-3 11z" fill={F} />
      <path d="M30 16c-1-3-1-6 1-8 2 2 1 5 0 8z" fill="#6c7a74" />
      <circle cx="25" cy="21" r="1.4" fill="#111" />
      <path d="M12 34l1 3h4l-1-3M26 34l0 3h4l-1-3" fill="#6c7a74" />
    </g>
  ),
  bell: (
    <g>
      <rect x="18.5" y="3" width="3" height="5" fill={F} />
      <path d="M9 31C9 19 12 11 20 8c8 3 11 11 11 23z" fill={B} />
      <path d="M9 31h22v2.6H9z" fill={F} />
      <path d="M12 21h16M11 26h18" stroke="#7a5a14" strokeWidth="1.2" />
      <circle cx="20" cy="35.4" r="2.2" fill={F} />
    </g>
  ),
  diyo: (
    <g>
      <path d="M20 4c6 7 5 13 0 16-5-3-6-9 0-16z" fill="#ffc94a" />
      <path d="M20 10c2.5 3.5 2 6 0 8-2-2-2.5-4.5 0-8z" fill="#f0762a" />
      <path d="M6 24c4 0 6 0 8 0h12c2 0 4 0 8 0-1 8-7 13-14 13S7 32 6 24z" fill={F} />
      <path d="M12 29c5 2.5 11 2.5 16 0" stroke="#b8893a" strokeWidth="1.4" fill="none" />
    </g>
  ),
  marigold: (
    <g>
      {Array.from({ length: 12 }, (_, i) => (
        <circle
          key={i}
          cx="20"
          cy="9.5"
          r="4.6"
          fill={i % 2 ? '#f6b21a' : '#f08a14'}
          transform={`rotate(${i * 30} 20 20)`}
        />
      ))}
      <circle cx="20" cy="20" r="6.5" fill="#f6b21a" />
      <circle cx="20" cy="20" r="3" fill="#c46a0a" />
    </g>
  ),
  momo: (
    <g>
      <path d="M5 29C5 15 14 10 20 10s15 5 15 19c0 2-3 3-5 3H10c-2 0-5-1-5-3z" fill={F} />
      <path d="M20 10l-9 21M20 10l-4 21M20 10l4 21M20 10l9 21" stroke="#b9ac90" strokeWidth="1.2" />
      <circle cx="20" cy="9.5" r="2" fill="#b9ac90" />
    </g>
  ),
  flags: (
    <g>
      <path d="M2 12Q20 20 38 12" stroke={F} strokeWidth="1.2" fill="none" />
      {['#2f6fd0', F, '#d83a2a', '#2f9a5a', '#f2c230'].map((c, i) => {
        const x = 5 + i * 7;
        const y = 13.3 + Math.sin(((x - 2) / 36) * Math.PI) * 4.1;
        return <path key={c} d={`M${x} ${y}h6l0 10-3-2.2-3 2.2z`} fill={c} />;
      })}
      <path d="M4 32h32" stroke="#6b7a9a" strokeWidth="1" />
    </g>
  ),
  leopard: (
    <g>
      <circle cx="10" cy="11.5" r="4" fill="#d8c8a0" />
      <circle cx="30" cy="11.5" r="4" fill="#d8c8a0" />
      <circle cx="20" cy="22" r="13.5" fill="#e6d8b4" />
      {[
        [11, 19],
        [29, 19],
        [13, 28],
        [27, 28],
        [20, 12],
        [8, 25],
        [32, 25],
      ].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="2" fill="none" stroke="#4a3a22" strokeWidth="1.4" />
      ))}
      <circle cx="15" cy="21" r="1.4" fill="#4a3a22" />
      <circle cx="25" cy="21" r="1.4" fill="#4a3a22" />
      <path d="M17.5 25.5h5l-2.5 2.8z" fill="#4a3a22" />
    </g>
  ),
  kite: (
    <g>
      <path d="M22 4l10 13-10 14-10-14z" fill="#e8c24a" />
      <path d="M22 4v27M12 17h20" stroke="#2e6a6a" strokeWidth="1.1" />
      <path d="M22 4l10 13-10 0z M12 17l10 0 0 14z" fill="#d83a2a" opacity="0.9" />
      <path
        d="M22 31c-3 3 3 4 0 7M22 33l-3-1M22 36l3-1"
        stroke={F}
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />
    </g>
  ),
  madal: (
    <g>
      <path d="M6 14c6-2.5 22-2.5 28 0l0 12c-6 2.5-22 2.5-28 0z" fill="#c8923a" />
      <ellipse cx="6.4" cy="20" rx="3" ry="7.2" fill={F} />
      <ellipse cx="33.6" cy="20" rx="3" ry="7.2" fill={F} />
      <path
        d="M12 13.5l4 12.5 4-12.5 4 12.5 4-12.5"
        stroke="#3a1a12"
        strokeWidth="1.3"
        fill="none"
      />
      <path d="M10 18h20" stroke="#3a1a12" strokeWidth="0.6" />
    </g>
  ),
  dhaka: (
    <g>
      <path d="M20 4l16 16-16 16L4 20z" fill={F} />
      <path d="M20 9l11 11-11 11L9 20z" fill="#8a1f33" />
      <path d="M20 14l6 6-6 6-6-6z" fill={B} />
      <path d="M20 18l2 2-2 2-2-2z" fill="#8a1f33" />
      <path d="M4 20h4M32 20h4M20 4v3M20 33v3" stroke={F} strokeWidth="1.4" />
    </g>
  ),
  sun: (
    <g>
      {Array.from({ length: 12 }, (_, i) => (
        <path
          key={i}
          d="M20 3.5v6"
          stroke="#f6c84a"
          strokeWidth="2.2"
          strokeLinecap="round"
          transform={`rotate(${i * 30} 20 20)`}
        />
      ))}
      <circle cx="20" cy="20" r="8.5" fill="#f6c84a" />
      <circle cx="20" cy="20" r="5.2" fill="#e8872a" />
    </g>
  ),
};

export function Avatar({ id, size = 40 }: { id: string; size?: number }) {
  const key = (AVATAR_IDS as readonly string[]).includes(id) ? (id as AvatarId) : 'yak';
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      aria-hidden="true"
      style={{ display: 'block', borderRadius: '50%' }}
    >
      <circle cx="20" cy="20" r="20" fill={BG[key]} />
      {art[key]}
    </svg>
  );
}
