import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';
import { version } from './package.json';

/**
 * Link-preview tags need absolute URLs: the Pages deploy passes the site's public address as
 * SITE_URL. Without it (dev, local preview) `%SITE_URL%` falls back to the base path.
 */
function siteUrl(): Plugin {
  let url = process.env.SITE_URL?.replace(/\/?$/, '/');
  return {
    name: 'site-url',
    configResolved: (config) => {
      url ??= config.base;
    },
    transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', url ?? '/'),
  };
}

export default defineConfig({
  plugins: [
    svelte(),
    // The page title carries the game version (package.json is its single source).
    {
      name: 'app-version-title',
      transformIndexHtml: (html) => html.replaceAll('%APP_VERSION%', version),
    },
    siteUrl(),
  ],
  build: {
    // The manifest lets tools/reportSize.ts prove what the game entry can reach.
    manifest: true,
    rollupOptions: {
      // Two ordinary pages: the game and the Music Lab (sound architecture §8). No router.
      input: { main: path.resolve('index.html'), lab: path.resolve('music-lab/index.html') },
    },
  },
  resolve: {
    alias: {
      '@game': path.resolve('src/game'),
      '@ui': path.resolve('src/ui'),
      '@content': path.resolve('src/content'),
      '@app': path.resolve('src/app'),
      '@world': path.resolve('src/world'),
      '@persistence': path.resolve('src/persistence'),
    },
  },
});
