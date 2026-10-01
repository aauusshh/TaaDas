const split = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const env = {
  base: import.meta.env.BASE_URL as string,
  turnUrls: split(import.meta.env.VITE_TURN_URLS as string | undefined),
  turnUsername: (import.meta.env.VITE_TURN_USERNAME as string | undefined) ?? '',
  turnCredential: (import.meta.env.VITE_TURN_CREDENTIAL as string | undefined) ?? '',
};

export const hasTurn = env.turnUrls.length > 0;
