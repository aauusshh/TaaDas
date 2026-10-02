import { afterEach, describe, expect, it, vi } from 'vitest';
import { brand } from '../config/brand';
import { defaultSettings, migrateSettings } from './settings';

describe('language default and migration', () => {
  it('is English for everyone by default', () => {
    expect(defaultSettings.lang).toBe('en');
    expect(defaultSettings.languageChosenByUser).toBe(false);
    expect(migrateSettings(null).lang).toBe('en');
  });
  it('a saved "ne" without the flag becomes English', () => {
    expect(migrateSettings({ lang: 'ne' }).lang).toBe('en');
    expect(migrateSettings({ lang: 'ne', languageChosenByUser: false }).lang).toBe('en');
  });
  it('a saved "ne" with the flag stays Nepali, and a chosen English stays English', () => {
    expect(migrateSettings({ lang: 'ne', languageChosenByUser: true }).lang).toBe('ne');
    expect(migrateSettings({ lang: 'en', languageChosenByUser: true }).lang).toBe('en');
  });
});

describe('the settings store on load', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });
  const withStorage = (saved: unknown) => {
    const data = new Map<string, string>();
    data.set(`${brand.storagePrefix}.settings`, JSON.stringify(saved));
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    });
    return data;
  };
  it('overwrites an old saved "ne" and keeps a chosen one', async () => {
    vi.resetModules();
    const old = withStorage({ lang: 'ne', sound: false });
    const a = await import('./settings');
    expect(a.useSettings.getState().lang).toBe('en');
    expect(a.useSettings.getState().sound).toBe(false); // other settings are kept
    expect(JSON.parse(old.get(`${brand.storagePrefix}.settings`)!).lang).toBe('en');

    vi.resetModules();
    withStorage({ lang: 'ne', languageChosenByUser: true });
    const b = await import('./settings');
    expect(b.useSettings.getState().lang).toBe('ne');
  });
});
