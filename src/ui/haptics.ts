import { useSettings } from '../storage/settings';

/** Vibrate briefly if the setting is on and the browser allows it (needs a prior tap). */
export function haptic(ms: number) {
  if (!useSettings.getState().haptics) return;
  try {
    if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}
