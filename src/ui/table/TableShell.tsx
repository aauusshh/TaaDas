import { useState, type ReactNode } from 'react';
import { BookOpen, Menu as MenuIcon } from 'lucide-react';
import type { Session } from '../../session/types';
import { useT } from '../../i18n/t';
import { BottomSheet, ConfirmDialog } from '../components/Overlays';
import { Button } from '../components/Button';
import { SettingsSheet } from '../../app/SettingsSheet';
import { ReactionBubbles, ReactionButton } from './Reactions';
import s from './TableShell.module.css';

/**
 * The felt, the wooden rim, and the corner controls every game shares.
 * Opening the menu pauses bots in local games.
 */
export function TableShell({
  session,
  children,
  overlay,
  ledger,
  rules,
  onLeave,
  isHost = false,
}: {
  session: Session;
  children: ReactNode;
  /** round result / game over layers */
  overlay?: ReactNode;
  ledger: ReactNode;
  rules?: ReactNode;
  onLeave: () => void;
  isHost?: boolean;
}) {
  const t = useT();
  const [menu, setMenu] = useState(false);
  const [book, setBook] = useState(false);
  const [settings, setSettings] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const openMenu = () => {
    session.pause();
    setMenu(true);
  };
  const closeMenu = () => {
    setMenu(false);
    session.resume();
  };

  return (
    <div className={s.rim}>
      <div className={s.felt}>
        {children}
        <button
          type="button"
          className={`${s.corner} ${s.left}`}
          aria-label={t('table.menu')}
          onClick={openMenu}
        >
          <MenuIcon size={22} aria-hidden="true" />
        </button>
        <ReactionButton session={session} />
        <button
          type="button"
          className={`${s.corner} ${s.right}`}
          aria-label={t('ledger.title')}
          onClick={() => setBook(true)}
        >
          <BookOpen size={22} aria-hidden="true" />
        </button>
      </div>
      <ReactionBubbles session={session} />
      {overlay}

      <BottomSheet open={menu} onClose={closeMenu} title={t('table.menu')}>
        <div className={s.menuList}>
          <Button tone="primary" onClick={closeMenu}>
            {t('table.resume')}
          </Button>
          {rules && (
            <Button
              onClick={() => {
                setMenu(false);
                setRulesOpen(true);
              }}
            >
              {t('common.rules')}
            </Button>
          )}
          <Button
            onClick={() => {
              setMenu(false);
              setSettings(true);
            }}
          >
            {t('common.settings')}
          </Button>
          <Button
            onClick={() => {
              setMenu(false);
              setConfirm(true);
            }}
          >
            {t('common.leaveTable')}
          </Button>
        </div>
      </BottomSheet>
      <BottomSheet open={book} onClose={() => setBook(false)} title={t('ledger.title')}>
        {ledger}
      </BottomSheet>
      <BottomSheet
        open={rulesOpen}
        onClose={() => {
          setRulesOpen(false);
          session.resume();
        }}
        title={t('common.rules')}
        tall
      >
        {rules}
      </BottomSheet>
      <SettingsSheet
        open={settings}
        onClose={() => {
          setSettings(false);
          session.resume();
        }}
      />
      <ConfirmDialog
        open={confirm}
        title={t('common.leaveTable')}
        body={isHost ? t('table.leaveHostBody') : t('table.leaveBody')}
        confirmLabel={t('common.leaveTable')}
        onConfirm={onLeave}
        onCancel={() => {
          setConfirm(false);
          session.resume();
        }}
      />
    </div>
  );
}
