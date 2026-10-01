// Plays Jut Patti or Dhumbal as the human through the UI. Usage: node e2e/playdraw.mjs <baseUrl> <jutpatti|dhumbal> <WxH> <outDir>
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const [base, game, size, out] = process.argv.slice(2);
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
await page.getByRole('button', { name: game === 'jutpatti' ? 'Jut Patti' : 'Dhumbal' }).click();
await page.getByLabel('Rules', { exact: true }).selectOption({ label: game === 'jutpatti' ? 'One round' : 'Five rounds' });
await page.getByRole('button', { name: 'Play', exact: true }).click();

const has = (name) => page.getByRole('button', { name, exact: true });
const click = async (name) => {
  const b = has(name);
  if ((await b.count()) && (await b.first().isEnabled())) {
    await b.first().click();
    return true;
  }
  return false;
};
const firstCard = async () => {
  const cards = page.locator('button[aria-pressed]');
  if (!(await cards.count())) return false;
  await cards.first().click({ position: { x: 8, y: 22 } });
  return true;
};
const t0 = Date.now();
const shots = new Set();
let moves = 0;
let finished = false;
while (Date.now() - t0 < 220000) {
  await page.waitForTimeout(220);
  if (await has('Rematch').count()) {
    await page.screenshot({ path: `${out}/over.png` });
    finished = true;
    break;
  }
  if (await click('Next round')) {
    if (!shots.has('round')) {
      shots.add('round');
    }
    continue;
  }
  if (game === 'jutpatti') {
    if (await click('Declare')) continue;
    const draw = await page.getByText(/Draw from the stock/).count();
    if (draw) {
      if (!shots.has('turn')) {
        await page.screenshot({ path: `${out}/turn.png` });
        shots.add('turn');
      }
      if (await click('Draw')) moves++;
      continue;
    }
    if (await page.getByText(/Throw one card away/).count()) {
      if (await firstCard()) {
        await page.waitForTimeout(80);
        await click('Throw it');
        moves++;
      }
    }
  } else {
    if (await click('Pick')) {
      moves++;
      continue;
    }
    if (await click('Keep it')) continue;
    if (await page.getByText(/Throw cards, or call Jhyap/).count()) {
      if (!shots.has('turn')) {
        await page.screenshot({ path: `${out}/turn.png` });
        shots.add('turn');
      }
      if (await click('Jhyap')) continue;
      if (await firstCard()) {
        await page.waitForTimeout(80);
        if (await click('Throw')) moves++;
      }
    }
  }
}
console.log(JSON.stringify({ finished, moves, seconds: Math.round((Date.now() - t0) / 1000), errors: errors.slice(0, 5) }));
await browser.close();
process.exit(finished && errors.length === 0 ? 0 : 1);
