import { effectiveReduceMotion, useSettings } from '../../storage/settings';

/** Scale a duration by the animation speed setting. Reduce motion turns flights into quick fades. */
export function dur(ms: number): number {
  if (effectiveReduceMotion()) return 120;
  return ms / useSettings.getState().animSpeed;
}

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type AnimTask = () => Promise<void> | void;

/**
 * Plays GameEvents one after another. The UI turns each event into a task; the queue
 * guarantees order and lets the screen know when everything has landed.
 */
export class AnimQueue {
  private tail: Promise<void> = Promise.resolve();
  private pending = 0;
  private idleWaiters: (() => void)[] = [];
  private cancelled = false;

  enqueue(task: AnimTask): Promise<void> {
    this.pending++;
    const run = this.tail.then(async () => {
      try {
        if (!this.cancelled) await task();
      } catch {
        /* an animation must never break the game */
      } finally {
        this.pending--;
        if (this.pending === 0) this.idleWaiters.splice(0).forEach((w) => w());
      }
    });
    this.tail = run;
    return run;
  }

  /** resolves when nothing is queued or running */
  idle(): Promise<void> {
    if (this.pending === 0) return Promise.resolve();
    return new Promise((r) => this.idleWaiters.push(r));
  }

  get busy() {
    return this.pending > 0;
  }

  /** drop queued tasks (e.g. leaving the table) */
  cancel() {
    this.cancelled = true;
  }
}
