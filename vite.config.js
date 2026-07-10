import { defineConfig } from 'vite';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Multi-page Vite app: `index.html` is the original Dungeon Forge procedural
// generator demo; `game.html` is Onco Defense, the tower defense game built
// on top of it (see docs/GAME_DESIGN.md). `base: './'` makes the production
// build path-relative, so the contents of `dist/` can be dropped onto any
// static host (Netlify, GitHub Pages, itch.io, a plain folder) and just
// work — no server config required.
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        game: resolve(__dirname, 'game.html'),
      },
    },
  },
});
