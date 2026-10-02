import type { Card, Rank, Suit } from '../engine/core/cards';
import { CardFace } from '../ui/cards/CardFace';
import { RangiCard } from '../ui/cards/RangiCard';
import { brand } from '../config/brand';

const mk = (id: number, suit: Suit, rank: Rank): Card => ({ id: 9900 + id, suit, rank, copy: 0 });

/** Dev-only page: the 1200x630 link-preview image is screenshotted from here (scripts/make-assets.mjs). */
export function DevOg() {
  const fan = [mk(1, 'H', 12), mk(2, 'C', 11), mk(3, 'S', 13), mk(4, 'S', 1)];
  return (
    <div
      id="og"
      style={{
        width: 1200,
        height: 630,
        position: 'relative',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at 40% 40%, #1f5a45, #123a2c 85%)',
        boxShadow: 'inset 0 0 0 14px #5a3a22, inset 0 0 0 16px rgb(0 0 0 / 0.4)',
        color: '#f4f1e8',
      }}
    >
      <div style={{ position: 'absolute', left: 80, top: 150 }}>
        <div className="display" style={{ fontSize: 120, color: '#d8b26a', lineHeight: 1 }}>
          {brand.name}
        </div>
        <div style={{ fontSize: 38, marginTop: 24, maxWidth: 520, lineHeight: 1.25 }}>
          {brand.tagline}
        </div>
        <div style={{ fontSize: 26, marginTop: 30, color: '#a9bfb2' }}>
          Call Break &middot; Marriage &middot; Teen Patti &middot; Rangi &middot; Langur Burja
        </div>
      </div>
      {fan.map((c, i) => (
        <div
          key={c.id}
          style={{
            position: 'absolute',
            left: 700 + i * 82,
            top: 150 + Math.abs(i - 1.5) * 14,
            width: 190,
            transform: `rotate(${(i - 1.5) * 9}deg)`,
            transformOrigin: '50% 130%',
            boxShadow: '0 4px 10px rgb(0 0 0 / 0.5)',
            borderRadius: '5.7% / 4.1%',
          }}
        >
          <CardFace card={c} />
        </div>
      ))}
      <div
        style={{
          position: 'absolute',
          left: 760,
          top: 360,
          width: 150,
          transform: 'rotate(-8deg)',
          boxShadow: '0 4px 10px rgb(0 0 0 / 0.5)',
          borderRadius: '5.7% / 4.1%',
        }}
      >
        <RangiCard color="sindoor" value={7} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 900,
          top: 380,
          width: 150,
          transform: 'rotate(7deg)',
          boxShadow: '0 4px 10px rgb(0 0 0 / 0.5)',
          borderRadius: '5.7% / 4.1%',
        }}
      >
        <RangiCard color="sky" value="reverse" />
      </div>
    </div>
  );
}
