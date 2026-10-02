import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { brand } from '../config/brand';
import { useT } from '../i18n/t';
import s from './ProfileScreen.module.css';

const PARAGRAPHS: Record<'about' | 'terms' | 'privacy', number> = {
  about: 4,
  terms: 6,
  privacy: 6,
};

/** About, Terms and Privacy: short, plain pages that always carry the chips note. */
export function InfoPage({ page }: { page: 'about' | 'terms' | 'privacy' }) {
  const t = useT();
  return (
    <main className={s.page}>
      <header className={s.head}>
        <Link to="/" className={s.back} aria-label={t('common.back')}>
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        <h1 className="display">{t(`info.${page}.title`)}</h1>
      </header>
      <section className={s.card}>
        {Array.from({ length: PARAGRAPHS[page] }, (_, i) => (
          <p key={i} style={{ margin: '0 0 10px' }}>
            {t(`info.${page}.p${i + 1}`, { brand: brand.name })}
          </p>
        ))}
        <p className={s.small} style={{ marginTop: 14 }}>
          {t('app.chipsNote')}
        </p>
      </section>
      <nav className={s.card} aria-label={t('info.more')}>
        {(['about', 'terms', 'privacy'] as const)
          .filter((p) => p !== page)
          .map((p) => (
            <Link
              key={p}
              to={`/${p}`}
              style={{
                display: 'block',
                padding: '10px 0',
                color: 'var(--brass-light)',
                fontWeight: 600,
              }}
            >
              {t(`info.${p}.title`)}
            </Link>
          ))}
      </nav>
    </main>
  );
}
