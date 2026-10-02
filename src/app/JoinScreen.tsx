import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useT } from '../i18n/t';
import { isValidCode, normalizeCode } from '../net/roomCode';
import { loadToken } from '../storage/rooms';
import { Button } from '../ui/components/Button';
import { joinRoom } from './roomStore';
import s from './RoomScreen.module.css';

// One join per (code, attempt, mode): React may run the effect twice, and a second hello would take a second seat.
const joins = new Map<string, Promise<unknown>>();

type Phase = 'connecting' | 'failed';

export function JoinScreen() {
  const { code: raw } = useParams();
  const code = normalizeCode(raw ?? '');
  const t = useT();
  const nav = useNavigate();
  const [phase, setPhase] = useState<Phase>('connecting');
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [spectate, setSpectate] = useState(false);

  useEffect(() => {
    if (!isValidCode(code)) {
      setPhase('failed');
      setError('badcode');
      return;
    }
    setPhase('connecting');
    let live = true;
    const key = `${code}:${attempt}:${spectate}`;
    let p = joins.get(key);
    if (!p) {
      p = joinRoom(code, { token: loadToken(code), spectate });
      joins.set(key, p);
      p.then(
        () => setTimeout(() => joins.delete(key), 1000),
        () => joins.delete(key),
      );
    }
    p.then(() => live && nav(`/room/${code}`, { replace: true })).catch((e: Error) => {
      if (!live) return;
      setError(e.message);
      setPhase('failed');
    });
    return () => {
      live = false;
    };
  }, [code, attempt, spectate, nav]);

  const known = ['full', 'locked', 'started', 'not-found', 'timeout', 'badcode', 'version'];
  const key = known.includes(error) ? error : 'generic';
  const canWatch = error === 'full' || error === 'locked' || error === 'started';

  return (
    <main className={s.join}>
      <p>{t('room.joining')}</p>
      <span className={s.joinCode} aria-label={code.split('').join(' ')}>
        {code}
      </span>
      {phase === 'connecting' ? (
        <p>{t('room.connecting')}</p>
      ) : (
        <>
          <h1 className="display">{t('room.joinFailed')}</h1>
          <p>{t(`room.err.${key}`, { code })}</p>
          <div className={s.actions}>
            {canWatch && (
              <Button
                tone="primary"
                onClick={() => {
                  setSpectate(true);
                  setAttempt((a) => a + 1);
                }}
              >
                {t('room.watch')}
              </Button>
            )}
            {error !== 'badcode' && (
              <Button onClick={() => setAttempt((a) => a + 1)}>{t('room.tryAgain')}</Button>
            )}
            <Button tone="quiet" onClick={() => nav('/', { replace: true })}>
              {t('common.home')}
            </Button>
          </div>
        </>
      )}
    </main>
  );
}
