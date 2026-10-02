import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useT } from '../i18n/t';
import { useProfile } from '../storage/profile';
import { useStats } from '../storage/stats';
import { Avatar, AVATAR_IDS } from '../ui/components/Avatar';
import { Button } from '../ui/components/Button';
import type { GameId } from '../engine/core/types';
import s from './ProfileScreen.module.css';

const LISTED: GameId[] = [
  'callbreak',
  'marriage',
  'teenpatti',
  'dhumbal',
  'jutpatti',
  'kitti',
  'inbetween',
  'rangi',
  'langurburja',
];

export function ProfileScreen() {
  const t = useT();
  const p = useProfile();
  const stats = useStats();
  const played = LISTED.filter((g) => stats.all[g]);
  return (
    <main className={s.page}>
      <header className={s.head}>
        <Link to="/" className={s.back} aria-label={t('common.back')}>
          <ArrowLeft size={22} aria-hidden="true" />
        </Link>
        <h1 className="display">{t('home.profile')}</h1>
      </header>

      <section className={s.card}>
        <label className={s.label} htmlFor="pname">
          {t('profile.name')}
        </label>
        <input
          id="pname"
          className={s.input}
          value={p.name}
          maxLength={16}
          onChange={(e) => p.patch({ name: e.target.value.slice(0, 16) })}
          onBlur={() => !p.name.trim() && p.patch({ name: 'Guest' })}
        />
        <span className={s.label}>{t('profile.avatar')}</span>
        <div className={s.avatars} role="radiogroup" aria-label={t('profile.avatar')}>
          {AVATAR_IDS.map((a) => (
            <button
              key={a}
              type="button"
              role="radio"
              aria-checked={p.avatar === a}
              aria-label={t(`avatar.${a}`)}
              data-on={p.avatar === a}
              className={s.avatarBtn}
              onClick={() => p.patch({ avatar: a })}
            >
              <Avatar id={a} size={48} />
            </button>
          ))}
        </div>
      </section>

      <section className={s.card}>
        <div className={s.chipsRow}>
          <span className={s.label}>{t('home.chips')}</span>
          <b className="num">{p.chips.toLocaleString('en-US')}</b>
        </div>
        <p className={s.small}>{t('app.chipsNote')}</p>
      </section>

      <section className={s.card}>
        <h2 className={s.h2}>{t('profile.stats')}</h2>
        {played.length === 0 ? (
          <p className={s.small}>{t('profile.noStats')}</p>
        ) : (
          <table className={s.table}>
            <thead>
              <tr>
                <th />
                <th>{t('profile.played')}</th>
                <th>{t('profile.won')}</th>
              </tr>
            </thead>
            <tbody>
              {played.map((g) => (
                <tr key={g}>
                  <td>{t(`game.${g}`)}</td>
                  <td className="num">{stats.all[g]!.played}</td>
                  <td className="num">{stats.all[g]!.wins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {played.length > 0 && (
          <Button size="small" tone="quiet" onClick={() => stats.reset()}>
            {t('profile.reset')}
          </Button>
        )}
      </section>
    </main>
  );
}
