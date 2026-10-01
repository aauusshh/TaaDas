import { useEffect, useRef, useState } from 'react';
import type { GameEvent } from '../../engine/core/events';
import type { Session } from '../../session/types';
import { AnimQueue } from './queue';

export interface RunArgs<V> {
  /** events already filtered for this viewer */
  events: GameEvent[];
  /** what is on screen now (null before the first update lands) */
  prev: V | null;
  /** the view after these events */
  next: V;
}

/**
 * Keeps a "shown" view that trails the real one: each session update is turned into animations
 * by `run`, and the shown view only changes when they have landed.
 */
export function useAnimatedView<V>(
  session: Session,
  seat: number,
  run: (a: RunArgs<V>) => Promise<void>,
): { shown: V | null; busy: boolean } {
  const [shown, setShown] = useState<V | null>(null);
  const [busy, setBusy] = useState(true);
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    const queue = new AnimQueue();
    let current: V | null = null;
    let pending = 0;
    const handle = (events: GameEvent[]) => {
      const next = session.getView(seat) as V;
      const filtered = session.filterEvents(events, seat);
      pending++;
      setBusy(true);
      void queue.enqueue(async () => {
        try {
          await runRef.current({ events: filtered, prev: current, next });
        } finally {
          current = next;
          setShown(next);
          pending--;
          if (pending === 0) setBusy(false);
        }
      });
    };
    handle(session.initialEvents);
    const unsub = session.subscribe((u) => handle(u.events));
    session.start();
    return () => {
      unsub();
      queue.cancel();
    };
  }, [session, seat]);

  return { shown, busy };
}
