import type { ReactNode } from 'react';
import { Petals } from './Petals';
import s from './ResultPanel.module.css';

/** Round result and game over share this paper-on-felt panel. */
export function ResultPanel({
  title,
  subtitle,
  big,
  celebrate,
  children,
  actions,
  note,
}: {
  title: string;
  subtitle?: string;
  /** game over: the winner's name in the display face */
  big?: boolean;
  celebrate?: boolean;
  children: ReactNode;
  actions: ReactNode;
  note?: string;
}) {
  return (
    <div className={s.scrim}>
      {celebrate && <Petals />}
      <section className={s.panel} role="dialog" aria-modal="true" aria-label={title}>
        <h2 className={`${s.title} ${big ? s.big : ''} display`}>{title}</h2>
        {subtitle && <p className={s.sub}>{subtitle}</p>}
        <div className={s.body}>{children}</div>
        {note && <p className={s.note}>{note}</p>}
        <div className={s.actions}>{actions}</div>
      </section>
    </div>
  );
}
