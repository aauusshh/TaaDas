import { brand } from '../config/brand';

export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 5;

/** 5 characters, no look-alikes (no I, L, O, 0, 1). */
export function makeRoomCode(random: (n: number) => number = secureInt): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET[random(CODE_ALPHABET.length)];
  return out;
}

function secureInt(n: number): number {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return a[0] % n;
}

export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .replace(new RegExp(`[^${CODE_ALPHABET}]`, 'g'), '')
    .slice(0, CODE_LENGTH);
}

export const isValidCode = (code: string) =>
  code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c));

export const peerIdFor = (code: string) => `${brand.peerPrefix}-${code}`;

export const joinLink = (code: string, origin = location.origin + location.pathname) =>
  `${origin}#/join/${code}`;

export function newToken(): string {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
}
