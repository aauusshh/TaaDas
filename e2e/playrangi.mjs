// Plays one full round of Rangi as the human through the UI. Usage: node e2e/playrangi.mjs <baseUrl> <WxH> <outDir>
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
await page.getByRole('button', { name: 'Rangi' }).click();
await page.getByLabel('Rules', { exact: true }).selectOption({ label: 'One round' });
await page.getByRole('button', { name: 'Play', exact: true }).click();

const click = async (name) => {
  const b = page.getByRole('button', { name, exact: true });
  if (await b.count()) {
    await b.first().click();
    return true;
  }
  return false;
};
const t0 = Date.now();
const shots = new Set();
let moves = 0;
let finished = false;
while (Date.now() - t0 < 240000) {
  await page.waitForTimeout(200);
  if (await page.getByRole('button', { name: 'Rematch' }).count()) {
    await page.screenshot({ path: `${out}/over.png` });
    finished = true;
    break;
  }
  if (await click('Take 4')) continue;
  if (await click('Accept')) continue;
  const colorBtn = page.getByRole('button', { name: /^(Sindoor|Marigold|Sky|Leaf)/ });
  if (await colorBtn.count()) {
    await colorBtn.first().click();
    continue;
  }
  const swap = page.locator('button', { hasText: /\(\d+\)/ });
  if (await swap.count()) {
    await swap.first().click();
    continue;
  }
  if (await click('Ek!')) continue;
  if (await page.getByText(/Your turn|Play it or keep it|Stack a draw card/).count()) {
    if (!shots.has('turn')) {
      await page.screenshot({ path: `${out}/turn.png` });
      shots.add('turn');
    }
    const cards = page.locator('button[aria-pressed]');
    let played = false;
    for (let i = (await cards.count()) - 1; i >= 0 && !played; i--) {
      const c = cards.nth(i);
      if ((await c.evaluate((el) => Number(getComputedStyle(el).opacity))) > 0.9) {
        await c.click({ position: { x: 8, y: 22 } });
        await page.waitForTimeout(60);
        await c.click({ position: { x: 8, y: 22 } });
        played = true;
        moves++;
      }
    }
    if (!played) {
      if (await click('Keep it')) continue;
      if (await click('Pass')) continue;
      await click('Draw');
    }
    await page.waitForTimeout(250);
  }
}
console.log(JSON.stringify({ finished, moves, seconds: Math.round((Date.now() - t0) / 1000), errors: errors.slice(0, 5) }));
await browser.close();
process.exit(finished && errors.length === 0 ? 0 : 1);
