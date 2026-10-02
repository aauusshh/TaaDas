import { sound } from '../sound/SoundManager';
import s from './Controls.module.css';

/** A physical-feeling switch: brass knob in a groove. */
export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={s.toggle}
      data-on={checked}
      onClick={() => {
        sound.play('tap');
        onChange(!checked);
      }}
    >
      <span className={s.knob} />
    </button>
  );
}

export function Stepper({
  value,
  min,
  max,
  step = 1,
  onChange,
  label,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className={s.stepper} role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`${label} minus`}
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - step))}
      >
        <span aria-hidden="true">&minus;</span>
      </button>
      <output className="num" aria-live="polite">
        {value}
      </output>
      <button
        type="button"
        aria-label={`${label} plus`}
        disabled={value >= max}
        onClick={() => onChange(Math.min(max, value + step))}
      >
        <span aria-hidden="true">+</span>
      </button>
    </div>
  );
}

export interface SegmentOption<T extends string | number> {
  value: T;
  label: string;
}

/** A sliding wooden bar with the active choice raised. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className={s.segmented} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          data-on={o.value === value}
          onClick={() => {
            sound.play('tap');
            onChange(o.value);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
