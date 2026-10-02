import { useEffect, useState } from 'react';
import { MessageCircle } from 'lucide-react';
import type { Session } from '../../session/types';
import { REACTIONS } from '../../net/protocol';
import { useT } from '../../i18n/t';
import { anchorRect } from '../anim/anchors';
import { BottomSheet } from '../components/Overlays';
import s from './Reactions.module.css';

/** Emoji appear only here, as player reactions. */
const EMOJI: Record<string, string> = {
  'emoji.clap': '\u{1F44F}',
  'emoji.laugh': '\u{1F602}',
  'emoji.wow': '\u{1F62E}',
  'emoji.cry': '\u{1F622}',
  'emoji.fire': '\u{1F525}',
  'emoji.thumbs': '\u{1F44D}',
};

interface Bubble {
  key: number;
  id: string;
  x: number;
  y: number;
}

let nextKey = 1;

export function ReactionButton({ session }: { session: Session }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  if (!session.react) return null;
  return (
    <>
      <button
        type="button"
        className={s.btn}
        aria-label={t('reaction.open')}
        onClick={() => setOpen(true)}
      >
        <MessageCircle size={22} aria-hidden="true" />
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t('reaction.open')}>
        <div className={s.grid}>
          {REACTIONS.map((id) => (
            <button
              key={id}
              type="button"
              className={s.choice}
              data-emoji={id.startsWith('emoji')}
              onClick={() => {
                session.react?.(id);
                setOpen(false);
              }}
            >
              {id.startsWith('emoji') ? EMOJI[id] : t(`reaction.${id}`)}
            </button>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}

export function ReactionBubbles({ session }: { session: Session }) {
  const t = useT();
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  useEffect(() => {
    if (!session.onReaction) return;
    return session.onReaction((seat, id) => {
      const r = typeof seat === 'number' ? anchorRect(`seat:${seat}`) : null;
      const b: Bubble = {
        key: nextKey++,
        id,
        x: r ? r.x + r.w / 2 : window.innerWidth / 2,
        y: r ? r.y : 80,
      };
      setBubbles((bs) => [...bs.slice(-3), b]);
      setTimeout(() => setBubbles((bs) => bs.filter((x) => x.key !== b.key)), 2600);
    });
  }, [session]);
  return (
    <div className={s.layer} aria-live="polite">
      {bubbles.map((b) => (
        <div key={b.key} className={s.bubble} style={{ left: b.x, top: b.y }}>
          {b.id.startsWith('emoji') ? EMOJI[b.id] : t(`reaction.${b.id}`)}
        </div>
      ))}
    </div>
  );
}
