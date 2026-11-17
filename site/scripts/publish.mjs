// Copies the built homepage and its files from dist/ to the repository root (GitHub Pages serves the root).
// Run after `npm run build`. Only the paths listed below are replaced; everything else in the root is left alone.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = resolve(here, '..', 'dist');
const root = resolve(here, '..', '..');

for (const item of ['index.html', '_astro', 'assets', 'privacy', 'terms']) {
  const from = resolve(dist, item);
  if (!existsSync(from)) throw new Error(`missing build output: dist/${item}`);
  rmSync(resolve(root, item), { recursive: true, force: true });
  cpSync(from, resolve(root, item), { recursive: true });
}
console.log('Published dist/ to the site root.');
