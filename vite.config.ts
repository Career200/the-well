import { defineConfig } from 'vite';

export default defineConfig({
  // Project pages serve from https://career200.github.io/the-well/, so emitted
  // asset URLs need the repo prefix. Root-absolute '/assets/...' 404s there.
  base: '/the-well/',
  server: { port: 5173 },
  build: { target: 'es2022' },
});
