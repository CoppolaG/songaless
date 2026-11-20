// Controlla che ogni sprite in src/design/sprites.ts abbia righe tutte della stessa lunghezza.
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/design/sprites.ts', import.meta.url), 'utf8');
const blocks = src.matchAll(/export const (\w+) = sprite\(\[([\s\S]*?)\]/g);
let bad = 0;
for (const [, name, body] of blocks) {
  const rows = [...body.matchAll(/'([^']*)'/g)].map((m) => m[1]);
  const widths = new Set(rows.map((r) => r.length));
  if (widths.size > 1) { bad++; console.log(`✗ ${name}: larghezze ${[...widths].join(', ')}`); }
  else console.log(`✓ ${name} ${rows[0]?.length}x${rows.length}`);
}
process.exit(bad ? 1 : 0);
