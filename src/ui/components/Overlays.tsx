import { useEffect, useRef, type ReactNode } from 'react';
import { create } from 'zustand';
import { X } from 'lucide-react';
import { useT } from '../../i18n/t';
import { Button } from './Button';
import s from './Overlays.module.css';

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
}

/** Slides up from the bottom edge. Used for setup, rules, settings. */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  tall,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  tall?: boolean;
}) {
  const t = useT();
  const first = useRef<HTMLButtonElement | null>(null);
  useEscape(open, onClose);
  useEffect(() => {
    if (open) first.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div className={s.scrim} onClick={onClose}>
      <section
        className={`${s.sheet} ${tall ? s.tall : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header className={s.sheetHead}>
          <h2 className="display">{title}</h2>
          <button
            ref={first}
            type="button"
            className={s.close}
            aria-label={t('common.close')}
            onClick={onClose}
          >
            <X size={22} aria-hidden="true" />
          </button>
        </header>
        <div className={s.sheetBody}>{children}</div>
      </section>
    </div>
  );
}

export function Dialog({
  open,
  title,
  children,
  actions,
  onClose,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  actions: ReactNode;
  onClose?: () => void;
}) {
  useEscape(open, () => onClose?.());
  if (!open) return null;
  return (
    <div className={`${s.scrim} ${s.center}`} onClick={onClose}>
      <section
        className={s.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="display">{title}</h2>
        {children && <div className={s.dialogBody}>{children}</div>}
        <div className={s.dialogActions}>{actions}</div>
      </section>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useT();
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onCancel}
      actions={
        <>
          <Button tone="quiet" onClick={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button tone="primary" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {body}
    </Dialog>
  );
}

interface ToastStore {
  message: string | null;
  show: (m: string, ms?: number) => void;
}
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export const useToast = create<ToastStore>((set) => ({
  message: null,
  show: (message, ms = 2600) => {
    set({ message });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ message: null }), ms);
  },
}));

export function ToastHost() {
  const message = useToast((x) => x.message);
  return (
    <div className={s.toastHost} role="status" aria-live="polite">
      {message && <div className={s.toast}>{message}</div>}
    </div>
  );
}
