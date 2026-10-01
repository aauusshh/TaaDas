import { useT } from '../../../i18n/t';
import { CardFace } from '../../cards/CardFace';
import type { Card, Rank, Suit } from '../../../engine/core/cards';
import s from '../callbreak/CallBreakRules.module.css';

const mk = (id: number, suit: Suit, rank: Rank): Card => ({ id: 9600 + id, suit, rank, copy: 0 });

export function DhumbalRules() {
  const t = useT();
  return (
    <div className={s.rules}>
      <p>{t('dh.rules.goal')}</p>
      <div className={s.demo} aria-hidden="true">
        {[mk(1, 'S', 4), mk(2, 'S', 5), mk(3, 'S', 6), mk(4, 'H', 9), mk(5, 'D', 9)].map((c) => (
          <div key={c.id} style={{ width: 44 }}>
            <CardFace card={c} />
          </div>
        ))}
      </div>
      <h3>{t('dh.rules.turnTitle')}</h3>
      <p>{t('dh.rules.turn')}</p>
      <p>{t('dh.rules.throws')}</p>
      <p>{t('dh.rules.pick')}</p>
      <h3>{t('dh.rules.jhyapTitle')}</h3>
      <p>{t('dh.rules.jhyap')}</p>
      <p>{t('dh.rules.counter')}</p>
      <h3>{t('dh.rules.gameTitle')}</h3>
      <p>{t('dh.rules.game')}</p>
    </div>
  );
}
