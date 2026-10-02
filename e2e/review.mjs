// Screenshots for the design self-review. Usage: node e2e/review.mjs <baseUrl> <outDir>
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const [base, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const mk = async (w, h, settings) => {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true });
  await ctx.addInitScript(
    (s) => localStorage.setItem('chautari.settings', JSON.stringify(s)),
    settings,
  );
  return ctx.newPage();
};
// Nepali home, portrait
let p = await mk(360, 740, { lang: 'ne', reduceMotion: true });
await p.goto(`${base}/#/`);
await p.waitForTimeout(600);
await p.screenshot({ path: `${out}/home-ne.png` });
// setup sheet with rules for Call Break
await p.getByRole('button', { name: 'कल ब्रेक' }).click();
await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/setup-ne.png` });
await p.getByRole('button', { name: 'नियम', exact: true }).first().click();
await p.waitForTimeout(500);
await p.screenshot({ path: `${out}/rules-ne.png` });
// Tihar night theme, English, Langur Burja
p = await mk(360, 740, { theme: 'tihar', reduceMotion: true });
await p.goto(`${base}/#/`);
await p.getByRole('button', { name: 'Langur Burja' }).click();
await p.getByRole('button', { name: 'Practice', exact: false }).click();
await p.waitForTimeout(1500);
await p.screenshot({ path: `${out}/langur-tihar.png` });
await browser.close();
