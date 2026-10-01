import { lazy, type ComponentType } from 'react';
import type { GameId } from '../engine/core/types';
import type { TableProps } from '../ui/games/types';
import { useT } from '../i18n/t';

/** One lazy table component per game. Add new games here. */
export const tables: Partial<Record<GameId, ComponentType<TableProps>>> = {
  callbreak: lazy(() => import('../ui/games/callbreak/CallBreakTable')),
};

export function Loading() {
  const t = useT();
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
      {t('common.loading')}
    </main>
  );
}
