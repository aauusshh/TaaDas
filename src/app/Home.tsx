import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { availableGameIds } from '../engine/registry';
import { Settings as SettingsIcon } from 'lucide-react';
import { brand } from '../config/brand';
import { useT } from '../i18n/t';
import { useProfile } from '../storage/profile';
import { Avatar } from '../ui/components/Avatar';
import { Button } from '../ui/components/Button';
import { BottomSheet } from '../ui/components/Overlays';
import { SetupSheet } from './SetupSheet';
import { loadSave } from '../storage/saves';
import { useLaunch } from './launch';
import type { GameId } from '../engine/core/types';
import { GameObject } from '../ui/table/GameObjects';
import { sound } from '../ui/sound/SoundManager';
import { SettingsSheet } from './SettingsSheet';
import s from './Home.module.css';

const GAMES = [
  { id: 'callbreak', tilt: -2, drop: 0 },
  { id: 'rangi', tilt: 1.5, drop: 26 },
  { id: 'marriage', tilt: 2, drop: 6 },
  { id: 'langurburja', tilt: -1.5, drop: 30 },
  { id: 'teenpatti', tilt: -1, drop: 2 },
  { id: 'dhumbal', tilt: 2.5, drop: 22 },
  { id: 'jutpatti', tilt: -2.5, drop: 4 },
  { id: 'kitti', tilt: 1, drop: 24 },
  { id: 'inbetween', tilt: -1, drop: 0 },
] as const;

export function Home() {
  const t = useT();
  const nav = useNavigate();
  const profile = useProfile();
  const [open, setOpen] = useState<string | null>(null);
  const [settings, setSettings] = useState(false);
  const [code, setCode] = useState('');
  const saved = useMemo(() => loadSave(), []);
  const setLaunch = useLaunch((l) => l.set);

  return (
    <div className={s.table} onPointerDown={() => sound.unlock()}>
      <header className={s.top}>
        <button
          type="button"
          className={s.profile}
          aria-label={t('home.profile')}
          onClick={() => nav('/profile')}
        >
          <Avatar id={profile.avatar} size={40} />
          <span className={s.who}>
            <b>{profile.name}</b>
            <span className="num">
              {profile.chips.toLocaleString('en-US')} {t('home.chips')}
            </span>
          </span>
        </button>
        <h1 className={`${s.brand} display`}>{brand.name}</h1>
        <button
          type="button"
          className={s.gear}
          aria-label={t('common.settings')}
          onClick={() => setSettings(true)}
        >
          <SettingsIcon size={24} aria-hidden="true" />
        </button>
      </header>

      <main className={s.surface}>
        {GAMES.map((g) => (
          <button
            key={g.id}
            type="button"
            className={s.object}
            style={{ transform: `rotate(${g.tilt}deg)`, marginTop: g.drop }}
            onClick={() => {
              sound.play('place');
              setOpen(g.id);
            }}
          >
            <span className={s.art}>
              <GameObject id={g.id} />
            </span>
            <span className={s.tag}>{t(`game.${g.id}`)}</span>
          </button>
        ))}
      </main>

      <footer className={s.join}>
        {saved && (
          <Button
            tone="primary"
            className={s.continue}
            onClick={() => {
              setLaunch({
                gameId: saved.snapshot.gameId,
                players: saved.snapshot.players,
                config: saved.snapshot.config,
                hints: saved.meta.hints,
                timerSec: saved.meta.timerSec,
                resume: true,
              });
              nav('/play/' + saved.snapshot.gameId);
            }}
          >
            {t('home.continueGame', { game: t(`game.${saved.snapshot.gameId}`) })}
          </Button>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code.length === 5) nav(`/join/${code}`);
          }}
        >
          <label className="visually-hidden" htmlFor="room-code">
            {t('home.roomCode')}
          </label>
          <input
            id="room-code"
            className={`${s.code} num`}
            value={code}
            maxLength={5}
            placeholder={t('home.roomCode')}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          />
          <Button tone="primary" type="submit" disabled={code.length !== 5}>
            {t('home.joinRoom')}
          </Button>
        </form>
        <p className={s.note}>{t('app.chipsNote')}</p>
      </footer>

      {open && availableGameIds().includes(open as GameId) && (
        <SetupSheet gameId={open as GameId} onClose={() => setOpen(null)} />
      )}
      {open && !availableGameIds().includes(open as GameId) && (
        <BottomSheet open onClose={() => setOpen(null)} title={t(`game.${open}`)}>
          <p style={{ marginTop: 0 }}>{t(`game.${open}.blurb`)}</p>
          <p style={{ color: 'var(--panel-muted)' }}>{t('home.comingSoon')}</p>
        </BottomSheet>
      )}
      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
    </div>
  );
}
