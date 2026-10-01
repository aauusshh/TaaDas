import en from './en.json';
import ne from './ne.json';
import { useSettings, type Lang } from '../storage/settings';

const dicts: Record<Lang, Record<string, string>> = { en, ne };

export function translate(lang: Lang, key: string, params?: Record<string, string | number>) {
  let s = dicts[lang][key] ?? dicts.en[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

export function t(key: string, params?: Record<string, string | number>) {
  return translate(useSettings.getState().lang, key, params);
}

/** React hook: re-renders when the language changes. */
export function useT() {
  const lang = useSettings((s) => s.lang);
  return (key: string, params?: Record<string, string | number>) => translate(lang, key, params);
}
