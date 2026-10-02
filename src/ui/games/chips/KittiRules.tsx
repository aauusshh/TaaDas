import { useT } from '../../../i18n/t';
import s from '../callbreak/CallBreakRules.module.css';

export function KittiRules() {
  const t = useT();
  return (
    <div className={s.rules}>
      <p>{t('kt.rules.goal')}</p>
      <h3>{t('kt.rules.arrangeTitle')}</h3>
      <p>{t('kt.rules.arrange')}</p>
      <h3>{t('kt.rules.showTitle')}</h3>
      <p>{t('kt.rules.show')}</p>
      <p>{t('kt.rules.win')}</p>
      <h3>{t('tp.rules.rankTitle')}</h3>
      <p>{t('kt.rules.rank')}</p>
    </div>
  );
}
