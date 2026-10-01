import { create } from 'zustand';
import type { Difficulty, GameConfig, GameId, PlayerInfo } from '../engine/core/types';
import { useProfile } from '../storage/profile';

export const BOT_NAMES = [
  'Aarati',
  'Bibek',
  'Dawa',
  'Gita',
  'Hari',
  'Kabita',
  'Lhakpa',
  'Manish',
  'Nima',
  'Pooja',
  'Ram',
  'Sabina',
  'Sanjay',
  'Sushila',
  'Tenzing',
  'Usha',
  'Bishnu',
  'Anil',
  'Rekha',
  'Pemba',
];
const BOT_AVATARS = ['danphe', 'tiger', 'rhino', 'diyo', 'kite', 'madal', 'momo', 'leopard'];

export function makeBots(count: number, taken: string[] = [], difficulty: Difficulty = 'medium') {
  const pool = BOT_NAMES.filter((n) => !taken.includes(n));
  return Array.from({ length: count }, (_, i): PlayerInfo => ({
    id: `bot${i}`,
    name: pool[(i * 3 + 1) % pool.length],
    avatar: BOT_AVATARS[i % BOT_AVATARS.length],
    isBot: true,
    difficulty,
  }));
}

export function humanPlayer(): PlayerInfo {
  const p = useProfile.getState();
  return { id: 'you', name: p.name, avatar: p.avatar, isBot: false, difficulty: 'medium' };
}

export interface Launch {
  gameId: GameId;
  players: PlayerInfo[];
  config: GameConfig;
  hints: boolean;
  /** turn timer seconds, 0 = off */
  timerSec?: number;
  mode?: 'bots' | 'local' | 'online';
  seed?: number;
  /** restore a saved game instead of starting a new one */
  resume?: boolean;
}

interface LaunchStore {
  launch: Launch | null;
  set: (l: Launch | null) => void;
}
export const useLaunch = create<LaunchStore>((set) => ({
  launch: null,
  set: (launch) => set({ launch }),
}));

/** One human against bots with the default rules. */
export function quickStart(gameId: GameId, playerCount: number, config: GameConfig): Launch {
  const you = humanPlayer();
  return {
    gameId,
    players: [you, ...makeBots(playerCount - 1, [you.name])],
    config,
    hints: false,
  };
}
