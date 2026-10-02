// Plays Marriage turns through the UI: draws and discards; checks the table renders. Usage: node e2e/playmarriage.mjs <baseUrl> <WxH> <outDir>
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
await page.getByRole('button', { name: 'Marriage' }).click();
await page.getByRole('button', { name: 'Play', exact: true }).click();
let turns = 0;
const t0 = Date.now();
while (Date.now() - t0 < Number(process.env.LIMIT ?? 90000) && turns < 12) {
  await page.waitForTimeout(300);
  const draw = page.getByRole('button', { name: 'Draw', exact: true });
  if ((await draw.count()) && (await draw.first().isEnabled())) {
    if (turns === 0) await page.screenshot({ path: `${out}/draw.png` });
    await draw.first().click();
    await page.waitForTimeout(500);
    const cards = page.locator('button[aria-pressed]');
    if (await cards.count()) {
      await cards.nth(0).click({ position: { x: 8, y: 22 } });
      if (turns === 0) await page.screenshot({ path: `${out}/selected.png` });
      const disc = page.getByRole('button', { name: 'Throw it', exact: true });
      if (await disc.count()) await disc.click();
      turns++;
    }
  }
  const arr = page.getByRole('button', { name: 'Arrange', exact: true });
  if (turns === 3 && (await arr.count())) {
    await arr.click();
    await page.screenshot({ path: `${out}/arranged.png` });
    turns++;
  }
}
console.log(
  JSON.stringify({
    turns,
    seconds: Math.round((Date.now() - t0) / 1000),
    errors: errors.slice(0, 5),
  }),
);
await browser.close();
process.exit(turns >= 3 && errors.length === 0 ? 0 : 1);
