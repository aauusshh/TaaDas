import type { PersistedHost } from '../net/host';
import { loadRaw, removeKey, saveJson } from './safe';

/** The seat token a client keeps so the host can give the same seat back. */
export const loadToken = (code: string) =>
  loadRaw<{ token: string }>(`room.${code}`)?.token ?? null;
export const saveToken = (code: string, token: string) => saveJson(`room.${code}`, { token });
export const clearToken = (code: string) => removeKey(`room.${code}`);

/** The host keeps the room so reopening the link resumes it. */
export const loadHostRoom = (): PersistedHost | null => {
  const d = loadRaw<PersistedHost>('online.host');
  return d && d.v === 1 && d.code ? d : null;
};
export const saveHostRoom = (d: PersistedHost | null) =>
  d ? saveJson('online.host', d) : removeKey('online.host');
