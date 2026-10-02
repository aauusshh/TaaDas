// English-by-default check: node e2e/english.mjs <baseUrl> <outDir>
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const [base, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true });
// an old saved setting from the Nepali-default build
await ctx.addInitScript(() => {
  if (!localStorage.getItem('chautari.seeded')) {
    localStorage.setItem('chautari.settings', JSON.stringify({ lang: 'ne', sound: true }));
    localStorage.setItem('chautari.seeded', '1');
  }
});
const p = await ctx.newPage();
await p.goto(`${base}/#/`);
await p.waitForTimeout(800);
await p.screenshot({ path: `${out}/1-home.png` });
await p.getByRole('button', { name: /Langur/ }).click();
await p.getByRole('radio', { name: /Online/ }).click();
await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/2-setup-online.png` });
await p.goto(`${base}/#/`);
await p.reload();
await p.waitForTimeout(600);
await p.getByRole('button', { name: /Langur/ }).click();
await p.getByRole('button', { name: /practice/i }).first().click();
await p.waitForTimeout(1200);
await p.getByRole('textbox').fill('50');
await p.waitForTimeout(300);
await p.screenshot({ path: `${out}/3-langur.png` });
await b.close();
