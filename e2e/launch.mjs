// Launch-phase screenshots: node e2e/launch.mjs <baseUrl> <outDir>
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const [base, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
for (const [name, w, h, route] of [
  ['home-p', 360, 740, '/'],
  ['about-p', 360, 740, '/about'],
  ['home-l', 740, 360, '/'],
  ['privacy-d', 1366, 768, '/privacy'],
]) {
  const p = await (await b.newContext({ viewport: { width: w, height: h } })).newPage();
  await p.goto(`${base}/#${route}`);
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/${name}.png`, fullPage: name === 'home-p' });
}
await b.close();
