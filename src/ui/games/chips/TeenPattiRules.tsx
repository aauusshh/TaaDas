import { useT } from '../../../i18n/t';
import { CardFace } from '../../cards/CardFace';
import type { Card, Rank, Suit } from '../../../engine/core/cards';
import s from '../callbreak/CallBreakRules.module.css';

const mk = (id: number, suit: Suit, rank: Rank): Card => ({ id: 9700 + id, suit, rank, copy: 0 });

export function TeenPattiRules() {
  const t = useT();
  const rows: [string, Card[]][] = [
    ['trail', [mk(1, 'S', 9), mk(2, 'H', 9), mk(3, 'D', 9)]],
    ['pure', [mk(4, 'S', 5), mk(5, 'S', 6), mk(6, 'S', 7)]],
    ['sequence', [mk(7, 'S', 5), mk(8, 'H', 6), mk(9, 'D', 7)]],
    ['color', [mk(10, 'H', 2), mk(11, 'H', 9), mk(12, 'H', 13)]],
    ['pair', [mk(13, 'S', 6), mk(14, 'H', 6), mk(15, 'D', 11)]],
    ['high', [mk(16, 'S', 1), mk(17, 'H', 9), mk(18, 'D', 4)]],
  ];
  return (
    <div className={s.rules}>
      <p>{t('tp.rules.goal')}</p>
      <h3>{t('tp.rules.rankTitle')}</h3>
      {rows.map(([k, cards]) => (
        <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '6px 0' }}>
          <div style={{ display: 'flex', gap: 3 }} aria-hidden="true">
            {cards.map((c) => (
              <div key={c.id} style={{ width: 34 }}>
                <CardFace card={c} />
              </div>
            ))}
          </div>
          <span>{t(`tp.cat.${k}`)}</span>
        </div>
      ))}
      <p>{t('tp.rules.seq')}</p>
      <h3>{t('tp.rules.betTitle')}</h3>
      <p>{t('tp.rules.bet')}</p>
      <p>{t('tp.rules.side')}</p>
      <p>{t('tp.rules.show')}</p>
    </div>
  );
}
