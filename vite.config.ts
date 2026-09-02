import { defineConfig } from 'vite';

export default defineConfig({
  // Pages serves from /the-well/, so asset URLs need the repo prefix;
  // root-absolute '/assets/...' 404s there.
  base: '/the-well/',
  server: { port: 5173 },
  build: { target: 'es2022' },
});
