import { useEffect, useId, useState } from 'react';
import { useT } from '../../i18n/t';
import { haptic } from '../haptics';
import s from './StakeField.module.css';

export interface StakeFieldProps {
  label: string;
  value: number;
  onChange: (n: number) => void;
  /** amounts move in multiples of this */
  step: number;
  /** the biggest amount Max can jump to (already limited by chips and table maximum) */
  max: number;
  /** a message when this amount cannot be used, null when it is fine */
  check: (n: number) => string | null;
  /** smallest amount that is not 0 (going below it with minus clears the field) */
  min?: number;
  quick?: number[];
  disabled?: boolean;
}

/**
 * One stake: a number field that opens the number keypad, quick buttons, minus, Clear and Max.
 * An amount is only passed on when `check` accepts it; otherwise the reason is shown under the field.
 */
export function StakeField({
  label,
  value,
  onChange,
  step,
  max,
  check,
  min = step,
  quick = [5, 10, 50, 100],
  disabled,
}: StakeFieldProps) {
  const t = useT();
  const id = useId();
  const [draft, setDraft] = useState(value ? String(value) : '');
  const [error, setError] = useState<string | null>(null);

  // follow changes that come from outside (another symbol picked, Clear, a new round)
  useEffect(() => {
    setDraft(value ? String(value) : '');
    setError(null);
  }, [value, label]);

  const apply = (n: number) => {
    const why = check(n);
    if (why) {
      haptic(20);
      setError(why);
      return;
    }
    setError(null);
    setDraft(n ? String(n) : '');
    onChange(n);
  };

  const type = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '').slice(0, 9);
    setDraft(digits);
    apply(digits === '' ? 0 : Number(digits));
  };

  const top = Math.floor(max / step) * step;
  const plus = quick.filter((q) => q % step === 0);
  const minus = () => {
    const n = value - step;
    apply(n > 0 && n < min ? 0 : Math.max(0, n));
  };

  return (
    <div className={s.root} data-disabled={disabled}>
      <label className={s.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={`${s.input} num`}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        enterKeyHint="done"
        value={draft}
        placeholder="0"
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => type(e.target.value)}
      />
      <div className={s.buttons}>
        <button
          type="button"
          className={`${s.btn} num`}
          disabled={disabled || value <= 0}
          aria-label={t('stake.minus', { n: step })}
          onClick={minus}
        >
          &minus;{step}
        </button>
        {plus.map((q) => (
          <button
            key={q}
            type="button"
            className={`${s.btn} num`}
            disabled={disabled}
            aria-label={t('stake.plus', { n: q })}
            onClick={() => apply(value + q)}
          >
            +{q}
          </button>
        ))}
        <button
          type="button"
          className={s.btn}
          disabled={disabled || value <= 0}
          onClick={() => apply(0)}
        >
          {t('stake.clear')}
        </button>
        <button
          type="button"
          className={s.btn}
          data-strong
          disabled={disabled || top < min}
          onClick={() => apply(top)}
        >
          {t('stake.max')}
        </button>
      </div>
      <p id={`${id}-err`} className={s.error} role="alert" aria-live="assertive">
        {error ?? ''}
      </p>
    </div>
  );
}
