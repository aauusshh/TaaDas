import { lazy, type ComponentType } from 'react';
import type { GameId } from '../engine/core/types';

/** The same short rules each table shows in its menu, so they can be read before sitting down. */
export const rulesPages: Partial<Record<GameId, ComponentType>> = {
  callbreak: lazy(() =>
    import('../ui/games/callbreak/CallBreakRules').then((m) => ({ default: m.CallBreakRules })),
  ),
  rangi: lazy(() =>
    import('../ui/games/rangi/RangiRules').then((m) => ({ default: m.RangiRules })),
  ),
  langurburja: lazy(() =>
    import('../ui/games/langur/LangurRules').then((m) => ({ default: m.LangurRules })),
  ),
  jutpatti: lazy(() =>
    import('../ui/games/drawdiscard/JutPattiRules').then((m) => ({ default: m.JutPattiRules })),
  ),
  dhumbal: lazy(() =>
    import('../ui/games/drawdiscard/DhumbalRules').then((m) => ({ default: m.DhumbalRules })),
  ),
  teenpatti: lazy(() =>
    import('../ui/games/chips/TeenPattiRules').then((m) => ({ default: m.TeenPattiRules })),
  ),
  kitti: lazy(() =>
    import('../ui/games/chips/KittiRules').then((m) => ({ default: m.KittiRules })),
  ),
  inbetween: lazy(() =>
    import('../ui/games/chips/InBetweenRules').then((m) => ({ default: m.InBetweenRules })),
  ),
  marriage: lazy(() =>
    import('../ui/games/marriage/MarriageRules').then((m) => ({ default: m.MarriageRules })),
  ),
};
