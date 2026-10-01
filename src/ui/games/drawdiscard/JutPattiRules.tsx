import { useT } from '../../../i18n/t';
import { CardFace } from '../../cards/CardFace';
import type { Card, Rank, Suit } from '../../../engine/core/cards';
import s from '../callbreak/CallBreakRules.module.css';

const mk = (id: number, suit: Suit, rank: Rank): Card => ({ id: 9500 + id, suit, rank, copy: 0 });

export function JutPattiRules() {
  const t = useT();
  return (
    <div className={s.rules}>
      <p>{t('jp.rules.goal')}</p>
      <div className={s.demo} aria-hidden="true">
        {[mk(1, 'S', 7), mk(2, 'D', 7), mk(3, 'H', 12), mk(4, 'C', 12)].map((c) => (
          <div key={c.id} style={{ width: 46 }}>
            <CardFace card={c} />
          </div>
        ))}
      </div>
      <h3>{t('jp.rules.turnTitle')}</h3>
      <p>{t('jp.rules.turn')}</p>
      <h3>{t('jp.rules.jokerTitle')}</h3>
      <p>{t('jp.rules.joker')}</p>
      <h3>{t('jp.rules.scoreTitle')}</h3>
      <p>{t('jp.rules.score')}</p>
    </div>
  );
}
