import type { ReactNode } from 'react';
import { Avatar } from '../components/Avatar';
import { useAnchor } from '../anim/anchors';
import { useT } from '../../i18n/t';
import s from './Seat.module.css';

export type ConnState = 'good' | 'slow' | 'away';

export interface SeatProps {
  seat: number;
  name: string;
  avatar: string;
  isBot?: boolean;
  /** chips or score shown under the name */
  value?: number | string;
  /** game info such as a bid: "2/4" */
  info?: string;
  isTurn?: boolean;
  /** ms left on the turn timer; omit when timer is off */
  timerMs?: number;
  timerTotalMs?: number;
  dealer?: boolean;
  auto?: boolean;
  conn?: ConnState;
  you?: boolean;
  children?: ReactNode;
}

const R = 25;
const CIRC = 2 * Math.PI * R;

export function TurnRing({
  active,
  timerMs,
  totalMs,
}: {
  active: boolean;
  timerMs?: number;
  totalMs?: number;
}) {
  const left = timerMs !== undefined && totalMs ? Math.max(0, Math.min(1, timerMs / totalMs)) : 1;
  return (
    <svg className={s.ring} viewBox="0 0 56 56" aria-hidden="true">
      <circle cx="28" cy="28" r={R} className={s.ringTrack} />
      {active && (
        <circle
          key={`${timerMs ?? 'x'}`}
          cx="28"
          cy="28"
          r={R}
          className={s.ringArc}
          transform="rotate(-90 28 28)"
          strokeDasharray={CIRC}
          strokeDashoffset={CIRC * (1 - left)}
          style={
            timerMs !== undefined
              ? ({
                  '--from': CIRC * (1 - left),
                  '--to': CIRC,
                  animationDuration: `${timerMs}ms`,
                } as React.CSSProperties)
              : undefined
          }
          data-draining={timerMs !== undefined}
        />
      )}
    </svg>
  );
}

export function Seat(p: SeatProps) {
  const t = useT();
  const ref = useAnchor(`seat:${p.seat}`);
  return (
    <div className={s.seat} data-turn={p.isTurn} data-you={p.you}>
      <div ref={ref} className={s.avatarWrap}>
        <TurnRing active={!!p.isTurn} timerMs={p.timerMs} totalMs={p.timerTotalMs} />
        <div className={s.avatar}>
          <Avatar id={p.avatar} size={44} />
        </div>
        {p.dealer && (
          <span className={s.dealer} title="Dealer">
            D
          </span>
        )}
        {p.conn && (
          <span className={s.conn} data-state={p.conn} aria-label={`Connection ${p.conn}`} />
        )}
      </div>
      <div className={s.text}>
        <span className={s.name}>
          {p.name}
          {p.isBot && <span className={s.tag}>{t('common.bot')}</span>}
          {p.auto && <span className={s.tag}>{t('common.auto')}</span>}
        </span>
        {(p.value !== undefined || p.info) && (
          <span className={`${s.value} num`}>
            {p.value !== undefined && (
              <b>{typeof p.value === 'number' ? p.value.toLocaleString('en-US') : p.value}</b>
            )}
            {p.info && <i>{p.info}</i>}
          </span>
        )}
      </div>
      {p.children}
    </div>
  );
}
