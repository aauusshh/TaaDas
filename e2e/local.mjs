// Checks setup sheet, pass-and-play cover, and reload-resume. Usage: node e2e/local.mjs <baseUrl> <outDir>
import { chromium } from '@playwright/test';
import fs from 'node:fs';
const [base, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
const fail = (m) => {
  console.log('FAIL', m, errors);
  process.exit(1);
};

await page.goto(`${base}/#/`);
await page.getByRole('button', { name: 'Call Break' }).click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${out}/setup.png` });
if (!(await page.getByText('Play with bots').count())) fail('no setup sheet');

// pass-and-play: second player is a person
await page.getByRole('radio', { name: 'Same device' }).click();
await page.getByRole('radio', { name: 'Person' }).nth(1).click();
await page.screenshot({ path: `${out}/setup-local.png` });
await page.getByRole('button', { name: 'Play', exact: true }).click();
await page.waitForTimeout(500);
// either the first actor is seat 0 (cover for you) or a bot goes first
let cover = false;
for (let i = 0; i < 60 && !cover; i++) {
  cover = (await page.getByRole('dialog').filter({ hasText: 'Pass to' }).count()) > 0;
  if (!cover) await page.waitForTimeout(500);
}
if (!cover) fail('pass cover never appeared');
await page.screenshot({ path: `${out}/cover.png` });
await page.getByRole('button', { name: 'Show my cards' }).click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/after-reveal.png` });

// reload resumes
await page.reload();
await page.waitForTimeout(800);
await page.goto(`${base}/#/`);
await page.waitForTimeout(600);
const cont = page.getByRole('button', { name: /Continue Call Break/ });
if (!(await cont.count())) fail('no continue button after reload');
await page.screenshot({ path: `${out}/home-continue.png` });
await cont.click();
await page.waitForTimeout(1500);
await page.screenshot({ path: `${out}/resumed.png` });
console.log(JSON.stringify({ ok: true, errors }));
await browser.close();
