// Screenshots for the stake control and Nepali-first names: node e2e/stakes.mjs <baseUrl> <outDir>
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const [base, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const open = async (w, h) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: true });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto(`${base}/#/`);
  await p.waitForTimeout(700);
  return p;
};
let p = await open(360, 740);
await p.screenshot({ path: `${out}/1-home.png` });
await p.getByRole('button', { name: /Langur/ }).click();
await p.waitForTimeout(500);
await p
  .getByRole('button', { name: 'Online' })
  .or(p.getByRole('radio', { name: /Online|अनलाइन/ }))
  .first()
  .click();
await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/2-setup-online.png` });
// practice round
p = await open(360, 740);
await p.getByRole('button', { name: /Langur/ }).click();
await p
  .getByRole('button', { name: /Practice|अभ्यास/ })
  .first()
  .click();
await p.waitForTimeout(1200);
const field = p.getByRole('textbox');
await field.fill('7');
await p.waitForTimeout(200);
await p.screenshot({ path: `${out}/3-error-p.png` });
await field.fill('50');
await p
  .getByRole('button', { name: /^\+10$|10 थप्नुहोस्/ })
  .first()
  .click();
await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/4-bet-p.png` });
const l = await open(740, 360);
await l.getByRole('button', { name: /Langur/ }).click();
await l
  .getByRole('button', { name: /Practice|अभ्यास/ })
  .first()
  .click();
await l.waitForTimeout(1200);
await l.getByRole('textbox').fill('50');
await l.waitForTimeout(300);
await l.screenshot({ path: `${out}/5-bet-l.png` });
// lock and roll to see the summary
await p
  .getByRole('button', { name: /Lock|बन्द/ })
  .first()
  .click()
  .catch(() => {});
await p.waitForTimeout(9000);
await p.screenshot({ path: `${out}/6-summary-p.png` });
await b.close();
