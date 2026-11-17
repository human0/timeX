import { defineConfig } from 'astro/config';

// The homepage is served at the domain root. Build output goes to dist/, and
// scripts/publish.mjs copies the homepage, its assets and the legal pages to the repository root.
export default defineConfig({
  site: 'https://timexchange.co.za',
  base: '/',
  outDir: 'dist',
  build: { format: 'directory' },
});
