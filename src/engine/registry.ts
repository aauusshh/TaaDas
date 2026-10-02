import type { AnyGame, GameId } from './core/types';

type Loader = () => Promise<AnyGame>;

/** Each game is lazy-loaded so the first screen stays small. Add new games here. */
const loaders: Partial<Record<GameId, Loader>> = {
  highcard: async () => (await import('./games/highcard')).highCard,
  callbreak: async () => (await import('./games/callbreak')).callBreak,
  rangi: async () => (await import('./games/rangi')).rangi,
  dhumbal: async () => (await import('./games/dhumbal')).dhumbal,
  teenpatti: async () => (await import('./games/teenpatti')).teenPatti,
  kitti: async () => (await import('./games/kitti')).kitti,
  inbetween: async () => (await import('./games/inbetween')).inBetween,
  marriage: async () => (await import('./games/marriage')).marriage,
  jutpatti: async () => (await import('./games/jutpatti')).jutPatti,
  langurburja: async () => (await import('./games/langurburja')).langurBurja,
};

export const registerGame = (id: GameId, loader: Loader) => {
  loaders[id] = loader;
};

export const availableGameIds = (): GameId[] => Object.keys(loaders) as GameId[];

export async function loadGame(id: GameId): Promise<AnyGame> {
  const loader = loaders[id];
  if (!loader) throw new Error(`unknown game: ${id}`);
  return loader();
}
