import { create } from 'zustand';
import { loadJson, saveJson } from './safe';

export type Lang = 'en' | 'ne';
export type ThemeId = 'classic' | 'dhaka' | 'sal' | 'tihar';
export type BackId = 'dhaka' | 'indigo' | 'forest';

export interface Settings {
  lang: Lang;
  /** true only after the person picked a language in Settings */
  languageChosenByUser: boolean;
  sound: boolean;
  volume: number;
  haptics: boolean;
  animSpeed: 0.5 | 1 | 1.5;
  reduceMotion: boolean;
  theme: ThemeId;
  cardBack: BackId;
  fourColor: boolean;
  leftHanded: boolean;
  showPlayable: boolean;
  autoSort: boolean;
}

export const defaultSettings: Settings = {
  lang: 'en',
  languageChosenByUser: false,
  sound: true,
  volume: 0.7,
  haptics: true,
  animSpeed: 1,
  reduceMotion: false,
  theme: 'classic',
  cardBack: 'dhaka',
  fourColor: false,
  leftHanded: false,
  showPlayable: true,
  autoSort: true,
};

interface SettingsStore extends Settings {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}

const prefersReduced = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export function applySettingsToDocument(s: Settings) {
  const root = document.documentElement;
  root.dataset.theme = s.theme;
  root.dataset.reduceMotion = String(s.reduceMotion || prefersReduced());
  root.lang = s.lang === 'ne' ? 'ne' : 'en';
  root.style.setProperty('--anim-speed', String(s.animSpeed));
}

/**
 * English unless the person chose another language themselves. A saved "ne" without the flag came from
 * an earlier default, so it goes back to English.
 */
export function migrateSettings(saved: Partial<Settings> | null | undefined): Settings {
  const merged = { ...defaultSettings, ...(saved ?? {}) };
  if (merged.languageChosenByUser !== true)
    return { ...merged, lang: 'en', languageChosenByUser: false };
  return merged;
}

const loaded = loadJson<Settings>('settings', defaultSettings);
const migrated = migrateSettings(loaded);
if (loaded.lang !== migrated.lang || loaded.languageChosenByUser !== migrated.languageChosenByUser)
  saveJson('settings', migrated);

export const useSettings = create<SettingsStore>((set, get) => ({
  ...migrated,
  set: (k, v) => {
    set({
      [k]: v,
      ...(k === 'lang' ? { languageChosenByUser: true } : {}),
    } as Partial<SettingsStore>);
    const { set: _s, ...rest } = get();
    void _s;
    saveJson('settings', rest);
    applySettingsToDocument(rest as Settings);
  },
}));

export function initSettings() {
  const { set: _s, ...rest } = useSettings.getState();
  void _s;
  applySettingsToDocument(rest as Settings);
}

export const effectiveReduceMotion = () => useSettings.getState().reduceMotion || prefersReduced();
