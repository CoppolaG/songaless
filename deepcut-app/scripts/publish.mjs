// Compila il sito per GitHub Pages e lo copia nella cartella ../deepcut
// (servita su https://coppolag.github.io/songaless/deepcut/).
// Uso: npm run publish   — poi commit e push del repository.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const site = resolve(app, '..', 'deepcut');
const root = resolve(app, '..');

execSync('npx next build', {
  cwd: app,
  stdio: 'inherit',
  env: { ...process.env, NEXT_PUBLIC_BASE_PATH: '/songaless/deepcut' },
});

if (existsSync(site)) rmSync(site, { recursive: true, force: true });
cpSync(resolve(app, 'out'), site, { recursive: true });

// GitHub Pages usa Jekyll, che ignora le cartelle che iniziano con "_" (come _next).
writeFileSync(resolve(root, '.nojekyll'), '');

console.log(`\nSito copiato in ${site}`);
