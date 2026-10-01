import { useT } from '../../../i18n/t';
import { RangiBack, RangiCard } from '../../cards/RangiCard';
import s from '../callbreak/CallBreakRules.module.css';

export function RangiRules() {
  const t = useT();
  const demo = [
    { color: 'sky' as const, value: 7 },
    { color: 'sindoor' as const, value: 'skip' as const },
    { color: 'marigold' as const, value: 'reverse' as const },
    { color: 'leaf' as const, value: 'draw2' as const },
    { value: 'wild' as const },
    { value: 'wild4' as const },
  ];
  return (
    <div className={s.rules}>
      <p>{t('rangi.rules.goal')}</p>
      <div className={s.demo} aria-hidden="true" style={{ flexWrap: 'wrap' }}>
        {demo.map((d, i) => (
          <div key={i} style={{ width: 46 }}>
            <RangiCard color={d.color} value={d.value} />
          </div>
        ))}
        <div style={{ width: 46 }}>
          <RangiBack />
        </div>
      </div>
      <h3>{t('rangi.rules.playTitle')}</h3>
      <p>{t('rangi.rules.play')}</p>
      <h3>{t('rangi.rules.actionsTitle')}</h3>
      <p>{t('rangi.rules.skip')}</p>
      <p>{t('rangi.rules.reverse')}</p>
      <p>{t('rangi.rules.draw2')}</p>
      <p>{t('rangi.rules.wild')}</p>
      <p>{t('rangi.rules.wild4')}</p>
      <h3>{t('rangi.rules.ekTitle')}</h3>
      <p>{t('rangi.rules.ek')}</p>
      <h3>{t('rangi.rules.scoreTitle')}</h3>
      <p>{t('rangi.rules.score')}</p>
    </div>
  );
}
