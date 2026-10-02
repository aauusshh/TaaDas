import { useT } from '../../../i18n/t';
import s from '../callbreak/CallBreakRules.module.css';

export function InBetweenRules() {
  const t = useT();
  return (
    <div className={s.rules}>
      <p>{t('ib.rules.goal')}</p>
      <h3>{t('ib.rules.turnTitle')}</h3>
      <p>{t('ib.rules.turn')}</p>
      <h3>{t('ib.rules.payTitle')}</h3>
      <p>{t('ib.rules.pay')}</p>
      <p>{t('ib.rules.ace')}</p>
    </div>
  );
}
