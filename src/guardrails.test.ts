import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
const files = walk('src').filter(
  (f) => /\.(ts|tsx|json|css)$/.test(f) && !f.endsWith('guardrails.test.ts'),
);
const text = (f: string) => readFileSync(f, 'utf8');

describe('project guardrails', () => {
  it('never uses the other card game\u2019s name', () => {
    const hits = files.filter((f) => /\bUNO\b/.test(text(f)));
    expect(hits).toEqual([]);
  });
  it('has no payment or purchase code', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).join(' ');
    expect(deps).not.toMatch(/stripe|paypal|razorpay|esewa|khalti|braintree|square/i);
    const hits = files.filter((f) =>
      /\b(checkout|purchase|buy chips|cash out now|withdraw)\b/i.test(text(f)),
    );
    expect(hits).toEqual([]);
  });
  it('the engine uses no DOM, no network and no Math.random', () => {
    const engine = files.filter(
      (f) => f.split(sep).join('/').includes('src/engine/') && !f.endsWith('.test.ts'),
    );
    const bad = engine.filter((f) =>
      /\b(document|window|localStorage|fetch|WebSocket|Math\.random)\b/.test(text(f)),
    );
    expect(bad).toEqual([]);
  });
  it('every game screen shows the free-play chips note on game over', () => {
    const tables = files.filter((f) => /Table\.tsx$/.test(f));
    expect(tables.length).toBeGreaterThanOrEqual(9);
    const missing = tables.filter((f) => !text(f).includes("t('app.chipsNote')"));
    expect(missing.map((f) => f.split(sep).pop())).toEqual([]);
  });
});
