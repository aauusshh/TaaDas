// Plays Langur Burja solo through the UI (house banks, bot bettors). Usage: node e2e/playlangur.mjs <baseUrl> <WxH> <outDir>
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const [base, size, out] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.addInitScript(() =>
  localStorage.setItem('chautari.settings', JSON.stringify({ reduceMotion: true, animSpeed: 1.5 })),
);
await page.goto(`${base}/#/`);
await page.getByRole('button', { name: 'Langur Burja' }).click();
await page.getByLabel('Rules', { exact: true }).selectOption({ label: 'Short game' });
await page.getByRole('button', { name: 'Play', exact: true }).click();

const t0 = Date.now();
const shots = new Set();
let rounds = 0;
let finished = false;
while (Date.now() - t0 < 200000) {
  await page.waitForTimeout(250);
  if (await page.getByRole('button', { name: 'Rematch' }).count()) {
    await page.screenshot({ path: `${out}/over.png` });
    finished = true;
    break;
  }
  const next = page.getByRole('button', { name: 'Next round' });
  if (await next.count()) {
    if (!shots.has('summary')) {
      await page.screenshot({ path: `${out}/summary.png` });
      shots.add('summary');
    }
    rounds++;
    await next.click();
    continue;
  }
  if (await page.getByText('Place your bets').count()) {
    const lock = page.getByRole('button', { name: 'Lock bets' });
    for (const name of ['Heart', 'Crown']) {
      const sq = page.getByRole('button', { name, exact: true });
      if (await sq.isEnabled()) {
        await sq.click();
        await sq.click();
      }
    }
    if (!shots.has('betting')) {
      await page.screenshot({ path: `${out}/betting.png` });
      shots.add('betting');
    }
    if (await lock.isEnabled()) await lock.click();
  }
}
console.log(JSON.stringify({ finished, rounds, seconds: Math.round((Date.now() - t0) / 1000), errors: errors.slice(0, 5) }));
await browser.close();
process.exit(finished && errors.length === 0 ? 0 : 1);
