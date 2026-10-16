import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';

export default defineConfig({
  plugins: [svelte()],
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
