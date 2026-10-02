import { useT } from '../../../i18n/t';
import s from '../callbreak/CallBreakRules.module.css';

export function MarriageRules() {
  const t = useT();
  return (
    <div className={s.rules}>
      <p>{t('mg.rules.goal')}</p>
      <h3>{t('mg.rules.turnTitle')}</h3>
      <p>{t('mg.rules.turn')}</p>
      <h3>{t('mg.rules.setsTitle')}</h3>
      <p>{t('mg.rules.pure')}</p>
      <p>{t('mg.rules.trial')}</p>
      <h3>{t('mg.rules.seeTitle')}</h3>
      <p>{t('mg.rules.see')}</p>
      <p>{t('mg.rules.maal')}</p>
      <h3>{t('mg.rules.dubleeTitle')}</h3>
      <p>{t('mg.rules.dublee')}</p>
      <h3>{t('mg.rules.scoreTitle')}</h3>
      <p>{t('mg.rules.score')}</p>
    </div>
  );
}
