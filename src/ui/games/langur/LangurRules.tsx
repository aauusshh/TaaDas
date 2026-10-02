import { useT } from '../../../i18n/t';
import { LBSymbol } from './Symbols';
import s from '../callbreak/CallBreakRules.module.css';

export function LangurRules() {
  const t = useT();
  return (
    <div className={s.rules}>
      <p>{t('lb.rules.goal')}</p>
      <div className={s.demo} aria-hidden="true" style={{ flexWrap: 'wrap' }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <span key={i} style={{ background: '#f1e8d0', borderRadius: 4, padding: 4 }}>
            <LBSymbol idx={i} size={34} />
          </span>
        ))}
      </div>
      <h3>{t('lb.rules.betTitle')}</h3>
      <p>{t('lb.rules.bet')}</p>
      <h3>{t('lb.rules.rollTitle')}</h3>
      <p>{t('lb.rules.roll')}</p>
      <h3>{t('lb.rules.payTitle')}</h3>
      <p>{t('lb.rules.pay')}</p>
    </div>
  );
}
