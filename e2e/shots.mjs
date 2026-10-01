// Usage: node e2e/shots.mjs <baseUrl> <outDir> <name:route:WxH[:full]> ...
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const [base, out, ...specs] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const spec of specs) {
  const [name, route, size, full] = spec.split(':');
  const [w, h] = size.split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(`${base}/#${route}`);
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: full === 'full' });
  console.log(name, errors.length ? 'ERRORS: ' + errors.join(' | ') : 'ok');
  await ctx.close();
}
await browser.close();
