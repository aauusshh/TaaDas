import type { Snapshot } from '../session/types';
import type { GameConfig, GameId } from '../engine/core/types';
import { loadRaw, removeKey, saveJson } from './safe';

export interface SavedGame {
  snapshot: Snapshot;
  meta: { hints: boolean; timerSec: number };
  savedAt: number;
}

const KEY = 'save';

export const loadSave = (): SavedGame | null => {
  const s = loadRaw<SavedGame>(KEY);
  return s && s.snapshot && s.snapshot.gameId ? s : null;
};
export const writeSave = (snapshot: Snapshot, meta: SavedGame['meta']) =>
  saveJson(KEY, { snapshot, meta, savedAt: Date.now() } satisfies SavedGame);
export const clearSave = () => removeKey(KEY);

export interface HouseRule {
  id: string;
  name: string;
  config: Partial<GameConfig>;
}
const houseKey = (g: GameId) => `house.${g}`;
export const loadHouseRules = (g: GameId): HouseRule[] => loadRaw<HouseRule[]>(houseKey(g)) ?? [];
export const saveHouseRules = (g: GameId, rules: HouseRule[]) => saveJson(houseKey(g), rules);

export interface SetupMemory {
  mode: 'bots' | 'local' | 'online';
  count: number;
  timerSec: number;
  hints: boolean;
  difficulty: 'easy' | 'medium' | 'hard';
  config: GameConfig;
}
export const loadSetup = (g: GameId) => loadRaw<SetupMemory>(`setup.${g}`);
export const saveSetup = (g: GameId, m: SetupMemory) => saveJson(`setup.${g}`, m);
