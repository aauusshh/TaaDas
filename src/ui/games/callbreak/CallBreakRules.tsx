import { useT } from '../../../i18n/t';
import { CardFace } from '../../cards/CardFace';
import type { Card, Rank, Suit } from '../../../engine/core/cards';
import s from './CallBreakRules.module.css';

const mk = (id: number, suit: Suit, rank: Rank): Card => ({ id: 9000 + id, suit, rank, copy: 0 });

export function CallBreakRules() {
  const t = useT();
  return (
    <div className={s.rules}>
      <p>{t('cb.rules.goal')}</p>
      <h3>{t('cb.rules.bidTitle')}</h3>
      <p>{t('cb.rules.bid')}</p>
      <h3>{t('cb.rules.playTitle')}</h3>
      <div className={s.demo} aria-hidden="true">
        {[mk(1, 'H', 8), mk(2, 'H', 12), mk(3, 'S', 2)].map((c) => (
          <div key={c.id} style={{ width: 46 }}>
            <CardFace card={c} />
          </div>
        ))}
      </div>
      <p>{t('cb.rules.play1')}</p>
      <p>{t('cb.rules.play2')}</p>
      <p>{t('cb.rules.win')}</p>
      <h3>{t('cb.rules.scoreTitle')}</h3>
      <p>{t('cb.rules.score')}</p>
    </div>
  );
}
