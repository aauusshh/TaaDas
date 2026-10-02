import { create } from 'zustand';
import type { ClientSession } from '../net/client';
import type { HostSession } from '../net/host';
import { makeRoomCode } from '../net/roomCode';
import { loadGame } from '../engine/registry';
import type { GameConfig, GameId } from '../engine/core/types';
import { hasTurn } from '../config/env';
import { loadHostRoom, saveHostRoom, saveToken } from '../storage/rooms';
import { useProfile } from '../storage/profile';

interface RoomStore {
  host: HostSession | null;
  client: ClientSession | null;
  setHost: (h: HostSession | null) => void;
  setClient: (c: ClientSession | null) => void;
}
export const useRoom = create<RoomStore>((set) => ({
  host: null,
  client: null,
  setHost: (host) => set({ host }),
  setClient: (client) => set({ client }),
}));

export async function createRoom(opts: {
  gameId: GameId;
  config: GameConfig;
  seatCount: number;
  timerSec: number;
  relay?: boolean;
}): Promise<HostSession> {
  const game = await loadGame(opts.gameId);
  const [{ HostSession: Host }, { peerTransport }] = await Promise.all([
    import('../net/host'),
    import('../net/peerTransport'),
  ]);
  const p = useProfile.getState();
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const host = new Host({
      transport: peerTransport(!!opts.relay && hasTurn).host(),
      game,
      code: makeRoomCode(),
      config: opts.config,
      seatCount: opts.seatCount,
      host: { name: p.name, avatar: p.avatar },
      timerSec: opts.timerSec,
      relay: !!opts.relay && hasTurn,
      persist: saveHostRoom,
    });
    try {
      await host.open();
      useRoom.getState().host?.dispose();
      useRoom.getState().setHost(host);
      if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__host = host;
      return host;
    } catch (e) {
      lastErr = e;
      host.dispose();
      if ((e as Error).message !== 'code-taken') break;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('error');
}

/** Reopen a room this browser was hosting. */
export async function resumeRoom(): Promise<HostSession | null> {
  const data = loadHostRoom();
  if (!data) return null;
  const game = await loadGame(data.gameId as GameId);
  const [{ HostSession: Host }, { peerTransport }] = await Promise.all([
    import('../net/host'),
    import('../net/peerTransport'),
  ]);
  const host = await Host.restore(
    {
      transport: peerTransport(false).host(),
      game,
      host: { name: '', avatar: '' },
      persist: saveHostRoom,
    },
    data,
  );
  useRoom.getState().setHost(host);
  return host;
}

export async function joinRoom(
  code: string,
  opts: { token: string | null; spectate?: boolean },
): Promise<ClientSession> {
  const [{ ClientSession: Client }, { peerTransport }] = await Promise.all([
    import('../net/client'),
    import('../net/peerTransport'),
  ]);
  const p = useProfile.getState();
  const client = new Client({
    transport: peerTransport(false).client(),
    code,
    name: p.name,
    avatar: p.avatar,
    token: opts.token,
    spectate: opts.spectate,
    onToken: (t) => saveToken(code, t),
  });
  await client.join();
  useRoom.getState().client?.dispose();
  useRoom.getState().setClient(client);
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__client = client;
  return client;
}
