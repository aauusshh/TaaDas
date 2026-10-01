import type { AnyGame, GameId } from './core/types';

type Loader = () => Promise<AnyGame>;

/** Each game is lazy-loaded so the first screen stays small. Add new games here. */
const loaders: Partial<Record<GameId, Loader>> = {
  highcard: async () => (await import('./games/highcard')).highCard,
  callbreak: async () => (await import('./games/callbreak')).callBreak,
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
