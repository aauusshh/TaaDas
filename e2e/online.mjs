// @online: two browser contexts play Call Break through the PeerJS cloud.
// Usage: node e2e/online.mjs <baseUrl> <outDir>
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const [base, out] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const errors = [];
const mk = async (name) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`));
  return page;
};
const host = await mk('host');
const client = await mk('client');
const fail = async (m) => {
  console.log('FAIL', m, errors.slice(0, 5));
  await host.screenshot({ path: `${out}/fail-host.png` }).catch(() => undefined);
  await client.screenshot({ path: `${out}/fail-client.png` }).catch(() => undefined);
  await browser.close();
  process.exit(1);
};

// host creates a room
await host.goto(`${base}/#/`);
await host.getByRole('button', { name: 'Call Break' }).click();
await host.getByRole('radio', { name: 'Online room' }).click();
await host.getByRole('button', { name: 'Create room' }).click();
await host.waitForURL(/#\/room\/[A-Z0-9]{5}/, { timeout: 30000 });
const code = host.url().match(/room\/([A-Z0-9]{5})/)[1];
await host.screenshot({ path: `${out}/host-lobby.png` });

// client joins by link
await client.goto(`${base}/#/join/${code}`);
try {
  await client.getByRole('button', { name: "I'm ready" }).click({ timeout: 30000 });
} catch {
  await fail('client never reached the lobby: ' + (await client.locator('body').innerText()).slice(0, 300));
}
await client.screenshot({ path: `${out}/client-lobby.png` });
const startBtn = host.getByRole('button', { name: 'Start game' });
await host.waitForFunction(() => !document.querySelector('button[disabled]:not([aria-label])') || true);
for (let i = 0; i < 40 && (await startBtn.isDisabled()); i++) await host.waitForTimeout(250);
if (await startBtn.isDisabled()) await fail('start button never enabled');
await startBtn.click();

const act = async (page) => {
  const place = page.getByRole('button', { name: 'Place bid' });
  if (await place.count()) {
    await page.getByRole('radio', { name: '3', exact: true }).click();
    await place.click();
    return 'bid';
  }
  if (await page.getByText('Your turn').count()) {
    const cards = page.locator('button[aria-pressed]');
    for (let i = (await cards.count()) - 1; i >= 0; i--) {
      const c = cards.nth(i);
      if ((await c.evaluate((el) => Number(getComputedStyle(el).opacity))) > 0.9) {
        await c.click({ position: { x: 8, y: 22 } });
        await page.waitForTimeout(80);
        await c.click({ position: { x: 8, y: 22 } });
        return 'play';
      }
    }
  }
  return null;
};

const plays = { host: 0, client: 0 };
const t0 = Date.now();
let shot = false;
while ((plays.host < 3 || plays.client < 3) && Date.now() - t0 < 150000) {
  for (const [name, page] of [['host', host], ['client', client]]) {
    const r = await act(page);
    if (r === 'play') plays[name]++;
  }
  if (!shot && plays.client >= 1) {
    await client.screenshot({ path: `${out}/client-table.png` });
    await host.screenshot({ path: `${out}/host-table.png` });
    shot = true;
  }
  await host.waitForTimeout(400);
}
if (plays.host < 3 || plays.client < 3) await fail(`not enough plays ${JSON.stringify(plays)}`);

// hidden info: no card still held by another seat appears in anything the client received
const seatBefore = await client.evaluate(() => window.__client.seat);
const leaked = await (async () => {
  const log = await client.evaluate(() => window.__netLog);
  const ids = new Set(log.flatMap((m) => [...m.matchAll(/"id":(\d+),"suit"/g)].map((x) => Number(x[1]))));
  const others = await host.evaluate((seat) => {
    const h = window.__host;
    const out = [];
    for (let s = 0; s < 4; s++) if (s !== seat) out.push(...h.getView(s).hand.map((c) => c.id));
    return out;
  }, seatBefore);
  return others.filter((id) => ids.has(id));
})();
if (leaked.length) await fail(`client saw cards held by others: ${leaked}`);

// reload gives the same seat back
await client.reload();
await client.waitForFunction(() => window.__client && window.__client.state === 'playing', null, { timeout: 30000 });
const seatAfter = await client.evaluate(() => window.__client.seat);
if (seatAfter !== seatBefore) await fail(`seat changed ${seatBefore} -> ${seatAfter}`);
await client.waitForTimeout(1500);
await client.screenshot({ path: `${out}/client-reloaded.png` });

console.log(JSON.stringify({ ok: true, code, plays, seat: seatAfter, errors: errors.slice(0, 5) }));
await browser.close();
