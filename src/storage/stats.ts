import { create } from 'zustand';
import type { GameId } from '../engine/core/types';
import { loadJson, saveJson } from './safe';

export interface GameStats {
  played: number;
  wins: number;
}
export type AllStats = Partial<Record<GameId, GameStats>>;

export function recordResult(all: AllStats, game: GameId, won: boolean): AllStats {
  const cur = all[game] ?? { played: 0, wins: 0 };
  return { ...all, [game]: { played: cur.played + 1, wins: cur.wins + (won ? 1 : 0) } };
}

interface StatsStore {
  all: AllStats;
  record: (game: GameId, won: boolean) => void;
  reset: () => void;
}

export const useStats = create<StatsStore>((set, get) => ({
  all: loadJson<{ all: AllStats }>('stats', { all: {} }).all,
  record: (game, won) => {
    const all = recordResult(get().all, game, won);
    set({ all });
    saveJson('stats', { all });
  },
  reset: () => {
    set({ all: {} });
    saveJson('stats', { all: {} });
  },
}));
