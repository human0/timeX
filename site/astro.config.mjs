import { defineConfig } from 'astro/config';

// Built output goes to ../new so GitHub Pages serves it at timexchange.co.za/new/ with no extra setup.
export default defineConfig({
  site: 'https://timexchange.co.za',
  base: '/new/',
  outDir: '../new',
  build: { format: 'file' },
});
