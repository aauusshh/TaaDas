import { describe, expect, it } from 'vitest';
import en from './en.json';
import ne from './ne.json';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('translations', () => {
  it('every English key has a Nepali string and the other way around', () => {
    const missingNe = Object.keys(en).filter((k) => !(k in ne));
    const extraNe = Object.keys(ne).filter((k) => !(k in en));
    expect(missingNe).toEqual([]);
    expect(extraNe).toEqual([]);
  });
  it('placeholders match between languages', () => {
    const bad = Object.keys(en).filter(
      (k) =>
        k in ne &&
        placeholders((en as Record<string, string>)[k]).join() !==
          placeholders((ne as Record<string, string>)[k]).join(),
    );
    expect(bad).toEqual([]);
  });
  it('Nepali strings keep digits as 0-9', () => {
    const devanagariDigits = Object.entries(ne).filter(([, v]) =>
      /[\u0966-\u096F]/.test(v as string),
    );
    expect(devanagariDigits.map(([k]) => k)).toEqual([]);
  });
  it('no emoji in UI strings except the reaction emoji', () => {
    const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    expect(
      Object.entries(en)
        .filter(([, v]) => emoji.test(v as string))
        .map(([k]) => k),
    ).toEqual([]);
  });
});
