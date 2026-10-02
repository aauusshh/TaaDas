/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/** Fill %VITE_SITE_URL% in index.html (link previews need an absolute URL). */
function siteUrl(url: string): Plugin {
  return {
    name: 'site-url',
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', url.replace(/\/$/, '')),
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const base = process.env.VITE_BASE ?? env.VITE_BASE ?? '/';
  const site = process.env.VITE_SITE_URL ?? env.VITE_SITE_URL ?? '';
  return {
    base,
    plugins: [
      react(),
      siteUrl(site),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['icons/*.png', 'icons/mark.svg', 'og.png'],
        manifest: {
          name: 'Chautari',
          short_name: 'Chautari',
          description:
            'Nepali card and dice games: play with bots, on one phone, or with friends online.',
          start_url: base,
          scope: base,
          display: 'standalone',
          orientation: 'any',
          background_color: '#123a2c',
          theme_color: '#14402f',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            {
              src: 'icons/maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // single-player and pass-and-play work offline: cache the app, fonts and every game chunk
          globPatterns: ['**/*.{js,css,html,woff,woff2,png,svg,mp3,ogg}'],
          navigateFallback: `${base}index.html`,
          maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        },
        devOptions: { enabled: false },
      }),
    ],
    test: {
      environment: 'node',
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    },
  };
});
