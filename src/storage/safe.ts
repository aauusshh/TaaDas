import { brand } from '../config/brand';

const key = (k: string) => `${brand.storagePrefix}.${k}`;

export function loadJson<T>(k: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key(k));
    return raw ? ({ ...fallback, ...JSON.parse(raw) } as T) : fallback;
  } catch {
    return fallback;
  }
}

export function loadRaw<T>(k: string): T | null {
  try {
    const raw = localStorage.getItem(key(k));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveJson(k: string, value: unknown): void {
  try {
    localStorage.setItem(key(k), JSON.stringify(value));
  } catch {
    /* private mode or full storage: keep going without saving */
  }
}

export function removeKey(k: string): void {
  try {
    localStorage.removeItem(key(k));
  } catch {
    /* ignore */
  }
}
