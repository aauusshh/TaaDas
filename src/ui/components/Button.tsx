import type { ButtonHTMLAttributes } from 'react';
import { sound } from '../sound/SoundManager';
import s from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary: brass; plain: outlined; quiet: text only */
  tone?: 'primary' | 'plain' | 'quiet';
  size?: 'normal' | 'small';
}

export function Button({
  tone = 'plain',
  size = 'normal',
  className,
  onClick,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={`${s.btn} ${s[tone]} ${size === 'small' ? s.small : ''} ${className ?? ''}`}
      onClick={(e) => {
        sound.play('tap');
        onClick?.(e);
      }}
    />
  );
}
