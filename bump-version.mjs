// Aggiunge un numero di versione ai file CSS/JS in index.html (es. app.js?v=abc123),
// così dopo un aggiornamento i browser scaricano i file nuovi invece di usare quelli in memoria.
// Uso:  node bump-version.mjs   (prima di pubblicare)
import { readFileSync, writeFileSync } from 'node:fs';

const file = new URL('./index.html', import.meta.url);
const v = Date.now().toString(36);
let html = readFileSync(file, 'utf8');
let n = 0;
html = html.replace(/(href|src)="((?:style\.css|starter\.js|app\.js|chars\.js|ragdoll\.js|game\.js|fx\.js))(\?v=[^"]*)?"/g, (m, attr, name) => {
  n++;
  return `${attr}="${name}?v=${v}"`;
});
writeFileSync(file, html);
console.log(`Versione ${v} applicata a ${n} file`);
