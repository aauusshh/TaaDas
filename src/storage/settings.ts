import { create } from 'zustand';
import { loadJson, saveJson } from './safe';

export type Lang = 'en' | 'ne';
export type ThemeId = 'classic' | 'dhaka' | 'sal' | 'tihar';
export type BackId = 'dhaka' | 'indigo' | 'forest';

export interface Settings {
  lang: Lang;
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
  lang: 'ne',
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

export const useSettings = create<SettingsStore>((set, get) => ({
  ...loadJson<Settings>('settings', defaultSettings),
  set: (k, v) => {
    set({ [k]: v } as Partial<SettingsStore>);
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
