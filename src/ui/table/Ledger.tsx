import type { PlayerInfo } from '../../engine/core/types';
import { useT } from '../../i18n/t';
import s from './Ledger.module.css';

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** A ruled notebook page, because families keep scores on paper. */
export function Ledger({
  players,
  rounds,
  totals,
  highlight,
  rowLabel,
}: {
  players: PlayerInfo[];
  /** one array of per-seat scores for each finished round */
  rounds: number[][];
  totals: number[];
  highlight?: number[];
  rowLabel?: (i: number) => string;
}) {
  const t = useT();
  return (
    <div
      className={s.page}
      role="table"
      aria-label={t('ledger.title')}
      style={{ ['--cols' as string]: players.length }}
    >
      <div className={s.head} role="row">
        <span className={s.corner} role="columnheader" />
        {players.map((p, i) => (
          <span key={p.id} role="columnheader" className={s.name} data-win={highlight?.includes(i)}>
            {p.name}
          </span>
        ))}
      </div>
      {rounds.map((r, i) => (
        <div key={i} className={s.row} role="row">
          <span className={`${s.label} num`} role="rowheader">
            {rowLabel ? rowLabel(i) : i + 1}
          </span>
          {r.map((v, seat) => (
            <span key={seat} role="cell" className={`${s.cell} num`} data-neg={v < 0}>
              {fmt(v)}
            </span>
          ))}
        </div>
      ))}
      {rounds.length === 0 && <p className={s.empty}>{t('ledger.empty')}</p>}
      <div className={`${s.row} ${s.total}`} role="row">
        <span className={s.label} role="rowheader">
          {t('ledger.total')}
        </span>
        {totals.map((v, seat) => (
          <span
            key={seat}
            role="cell"
            className={`${s.cell} num`}
            data-neg={v < 0}
            data-win={highlight?.includes(seat)}
          >
            {fmt(Math.round(v * 10) / 10)}
          </span>
        ))}
      </div>
    </div>
  );
}
