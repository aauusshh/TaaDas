// Generates the PWA icons and the Open Graph image from SVG art.
// Needs the dev server running: npm run dev (in the background), then: node scripts/make-assets.mjs http://localhost:5173
import { chromium } from '@playwright/test';
import fs from 'node:fs';

const base = process.argv[2] ?? 'http://localhost:5173';
fs.mkdirSync('public/icons', { recursive: true });

// the chautari mark: a tree over a stone platform
const mark = (size, pad) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="g" cx="40%" cy="35%" r="80%">
      <stop offset="0" stop-color="#1f5a45"/><stop offset="1" stop-color="#0d2c20"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#g)"/>
  <g transform="translate(${pad} ${pad}) scale(${(512 - 2 * pad) / 40 / 12.8})" fill="#d8b26a">
    <g transform="scale(12.8)">
      <path d="M6 24c0-9 6-16 14-16s14 7 14 16z"/>
      <rect x="18.4" y="22" width="3.2" height="9"/>
      <rect x="6" y="31" width="28" height="4" rx="0.6"/>
      <rect x="10" y="35" width="20" height="2.4"/>
    </g>
  </g>
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage();

const icon = async (file, size, pad) => {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<body style="margin:0">${mark(size, pad)}</body>`);
  await page.screenshot({ path: file });
  console.log('wrote', file);
};
await icon('public/icons/icon-192.png', 192, 40);
await icon('public/icons/icon-512.png', 512, 90);
// maskable icons keep the mark inside the central 80% safe zone
await icon('public/icons/maskable-512.png', 512, 130);
await icon('public/icons/apple-touch-icon.png', 180, 36);

await page.setContent(`<body style="margin:0">${mark(512, 90)}</body>`);
fs.writeFileSync('public/icons/mark.svg', mark(512, 90).trim());

await page.setViewportSize({ width: 1200, height: 630 });
await page.goto(`${base}/#/dev/og`);
await page.waitForSelector('#og');
await page.waitForTimeout(800);
await page.locator('#og').screenshot({ path: 'public/og.png' });
console.log('wrote public/og.png');
await browser.close();
