// Plays Teen Patti, Kitti or In Between as the human through the UI. Usage: node e2e/playchips.mjs <baseUrl> <teenpatti|kitti|inbetween> <WxH> <outDir>
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const [base, game, size, out] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
fs.mkdirSync(out, { recursive: true });
const NAMES = { teenpatti: 'Teen Patti', kitti: 'Kitti', inbetween: 'In Between' };
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
await page.getByRole('button', { name: NAMES[game] }).click();
if (game === 'inbetween')
  await page.getByLabel('Rules', { exact: true }).selectOption({ label: 'Short game' });
await page.getByRole('button', { name: 'Play', exact: true }).click();

const btn = (name) => page.getByRole('button', { name });
const click = async (name) => {
  const b = btn(name);
  if ((await b.count()) && (await b.first().isEnabled())) {
    await b.first().click();
    return true;
  }
  return false;
};
const t0 = Date.now();
const shots = new Set();
let moves = 0;
let finished = false;
while (Date.now() - t0 < Number(process.env.LIMIT ?? 230000)) {
  await page.waitForTimeout(230);
  if (await btn('Rematch').count()) {
    await page.screenshot({ path: `${out}/over.png` });
    finished = true;
    break;
  }
  if (await click('Next round')) continue;
  if (await click(/^OK$/)) continue;
  if (game === 'teenpatti') {
    if (await click('Refuse')) continue;
    if (await click(/^Show \d/)) {
      moves++;
      continue;
    }
    if ((await btn(/^(Blind|Chaal) \d/).count()) || (await btn('Look').count())) {
      if (!shots.has('turn')) {
        await page.screenshot({ path: `${out}/turn.png` });
        shots.add('turn');
      }
      if (moves % 4 < 2 && (await click(/^(Blind|Chaal) \d/))) {
        moves++;
        continue;
      }
      if (await click('Pack')) moves++;
    }
  } else if (game === 'kitti') {
    if (await btn('Auto arrange').count()) {
      if (!shots.has('turn')) {
        await page.screenshot({ path: `${out}/turn.png` });
        shots.add('turn');
      }
      await click('Auto arrange');
      await page.waitForTimeout(150);
      if (!shots.has('arranged')) {
        await page.screenshot({ path: `${out}/arranged.png` });
        shots.add('arranged');
      }
      if (await click('Confirm')) moves++;
    }
  } else {
    if (await click('Ace low')) continue;
    if (await click(/^Higher \d/)) {
      moves++;
      continue;
    }
    if (await btn(/^Bet \d/).count()) {
      if (!shots.has('turn')) {
        await page.screenshot({ path: `${out}/turn.png` });
        shots.add('turn');
      }
      if (await click(/^Bet \d/)) moves++;
      continue;
    }
    if (await click('Pass')) moves++;
  }
}
if (!finished) await page.screenshot({ path: `${out}/stuck.png` });
console.log(
  JSON.stringify({
    finished,
    moves,
    seconds: Math.round((Date.now() - t0) / 1000),
    errors: errors.slice(0, 5),
  }),
);
await browser.close();
process.exit(finished && errors.length === 0 ? 0 : 1);
