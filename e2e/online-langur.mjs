// @online: host banks, a client bets; both screens reach the same roll result. Usage: node e2e/online-langur.mjs <baseUrl> <outDir>
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const [base, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const errors = [];
const mk = async (name) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true });
  await ctx.addInitScript(() =>
    localStorage.setItem('chautari.settings', JSON.stringify({ reduceMotion: true, animSpeed: 1.5 })),
  );
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`));
  return page;
};
const host = await mk('host');
const client = await mk('client');
const fail = async (m) => {
  console.log('FAIL', m, errors.slice(0, 5));
  await host.screenshot({ path: `${out}/lb-fail-host.png` }).catch(() => undefined);
  await client.screenshot({ path: `${out}/lb-fail-client.png` }).catch(() => undefined);
  await browser.close();
  process.exit(1);
};

await host.goto(`${base}/#/`);
await host.getByRole('button', { name: 'Langur Burja' }).click();
await host.getByRole('radio', { name: 'Online room' }).click();
await host.getByLabel('Rules', { exact: true }).selectOption({ label: 'Short game' });
await host.getByRole('button', { name: 'Create room' }).click();
await host.waitForURL(/#\/room\/[A-Z0-9]{5}/, { timeout: 30000 });
const code = host.url().match(/room\/([A-Z0-9]{5})/)[1];

await client.goto(`${base}/#/join/${code}`);
await client.getByRole('button', { name: "I'm ready" }).click({ timeout: 30000 });
const start = host.getByRole('button', { name: 'Start game' });
for (let i = 0; i < 40 && (await start.isDisabled()); i++) await host.waitForTimeout(250);
await start.click();

// the client bets and locks; the host (banker) closes betting and shakes
await client.getByText('Place your bets').waitFor({ timeout: 20000 });
await client.getByRole('button', { name: 'Heart', exact: true }).click();
await client.getByRole('button', { name: 'Lock bets' }).click();
await host.getByRole('button', { name: 'Shake' }).click({ timeout: 20000 });

const summaryText = async (page) => {
  await page.getByRole('button', { name: 'Next round' }).or(page.getByText('Waiting for the next round')).first().waitFor({ timeout: 20000 });
  return (await page.getByRole('dialog').innerText()).replace(/\s+/g, ' ');
};
const [h, c] = await Promise.all([summaryText(host), summaryText(client)]);
await host.screenshot({ path: `${out}/lb-host-summary.png` });
await client.screenshot({ path: `${out}/lb-client-summary.png` });
const strip = (s) => s.replace(/Next round|Waiting for the next round/g, '').trim();
if (strip(h) !== strip(c)) await fail(`screens disagree:\n${h}\n${c}`);
console.log(JSON.stringify({ ok: true, code, summary: strip(h).slice(0, 120), errors: errors.slice(0, 5) }));
await browser.close();
