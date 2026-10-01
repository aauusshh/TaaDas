import { useT } from '../../i18n/t';
import type { PlayerInfo } from '../../engine/core/types';
import { Avatar } from '../components/Avatar';
import { Button } from '../components/Button';
import s from './PassCover.module.css';

/** Full-screen cover for pass-and-play: nothing about the table is visible until the next player taps. */
export function PassCover({ player, onReveal }: { player: PlayerInfo; onReveal: () => void }) {
  const t = useT();
  return (
    <div
      className={s.cover}
      role="dialog"
      aria-modal="true"
      aria-label={t('pass.title', { name: player.name })}
    >
      <Avatar id={player.avatar} size={84} />
      <h2 className="display">{t('pass.title', { name: player.name })}</h2>
      <p>{t('pass.body')}</p>
      <Button tone="primary" onClick={onReveal}>
        {t('pass.show')}
      </Button>
    </div>
  );
}
