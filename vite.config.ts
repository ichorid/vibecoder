import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'node:path';

export default defineConfig({
  plugins: [svelte()],
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
