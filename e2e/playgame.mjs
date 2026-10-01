// Plays a full local game as the human, clicking through the UI. Usage:
//   node e2e/playgame.mjs <baseUrl> <game> <WxH> <outDir> [fast]
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const [base, game, size, out, fast] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.addInitScript((f) => {
  if (f) localStorage.setItem('chautari.settings', JSON.stringify({ reduceMotion: true, animSpeed: 1.5 }));
}, !!fast);
await page.goto(`${base}/#/play/${game}`);

const shot = async (name) => page.screenshot({ path: `${out}/${name}.png` });
const t0 = Date.now();
let shots = new Set();
let rounds = 0;
let finished = false;
while (Date.now() - t0 < 600000) {
  await page.waitForTimeout(250);
  if (await page.getByRole('button', { name: 'Rematch' }).count()) {
    await shot('gameover');
    finished = true;
    break;
  }
  const next = page.getByRole('button', { name: 'Next round' });
  if (await next.count()) {
    if (!shots.has('roundend')) { await shot('roundend'); shots.add('roundend'); }
    rounds++;
    await next.click();
    continue;
  }
  const place = page.getByRole('button', { name: 'Place bid' });
  if (await place.count()) {
    if (!shots.has('bid')) { await shot('bid'); shots.add('bid'); }
    await page.getByRole('radio', { name: '3', exact: true }).click();
    await place.click();
    continue;
  }
  const turn = await page.getByText('Your turn').count();
  if (turn) {
    const cards = page.locator('button[aria-pressed]');
    const n = await cards.count();
    let played = false;
    for (let i = n - 1; i >= 0; i--) {
      const c = cards.nth(i);
      const op = await c.evaluate((el) => Number(getComputedStyle(el).opacity));
      if (op > 0.9) {
        if (!shots.has('turn')) { await shot('turn'); shots.add('turn'); }
        await c.click({ position: { x: 8, y: 22 } });
        await page.waitForTimeout(80);
        await c.click({ position: { x: 8, y: 22 } });
        played = true;
        break;
      }
    }
    if (!played) await page.waitForTimeout(300);
    await page.waitForTimeout(300);
  }
}
console.log(JSON.stringify({ finished, rounds, seconds: Math.round((Date.now() - t0) / 1000), errors: errors.slice(0, 5) }));
await browser.close();
process.exit(finished && errors.length === 0 ? 0 : 1);
