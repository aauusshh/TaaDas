import { lazy, type ComponentType } from 'react';
import type { GameId } from '../engine/core/types';
import type { TableProps } from '../ui/games/types';
import { useT } from '../i18n/t';

/** One lazy table component per game. Add new games here. */
export const tables: Partial<Record<GameId, ComponentType<TableProps>>> = {
  callbreak: lazy(() => import('../ui/games/callbreak/CallBreakTable')),
  rangi: lazy(() => import('../ui/games/rangi/RangiTable')),
  langurburja: lazy(() => import('../ui/games/langur/LangurTable')),
  jutpatti: lazy(() => import('../ui/games/drawdiscard/JutPattiTable')),
  teenpatti: lazy(() => import('../ui/games/chips/TeenPattiTable')),
  kitti: lazy(() => import('../ui/games/chips/KittiTable')),
  inbetween: lazy(() => import('../ui/games/chips/InBetweenTable')),
  dhumbal: lazy(() => import('../ui/games/drawdiscard/DhumbalTable')),
};

export function Loading() {
  const t = useT();
  return (
    <main style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
      {t('common.loading')}
    </main>
  );
}
