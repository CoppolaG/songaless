// Legge catalogo.txt, trova ogni canzone su Deezer e scrive starter.js (i mazzi di base del gioco).
// Uso:  node build-starter.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/\s-\s.*$/, ' ').replace(/\b(feat|ft)\.?\s.*$/, ' ')
  .replace(/[^a-z0-9]+/g, ' ').trim();
const sameArtist = (a, b) => { a = norm(a); b = norm(b); return !!a && !!b && (a.includes(b) || b.includes(a)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LIVE = /\blive\b|\bunplugged\b|karaoke|instrumental|remix|cover|tribute|acoustic|session/i;

async function dz(path, params = {}) {
  for (let i = 0; i < 4; i++) {
    await sleep(130); // Deezer: ~50 richieste ogni 5 secondi
    const r = await fetch(`https://api.deezer.com/${path}?${new URLSearchParams(params)}`);
    const d = await r.json();
    if (d.error?.code === 4) { await sleep(3000); continue; } // quota superata
    return d;
  }
  return {};
}

async function find(artist, title) {
  const queries = [`artist:"${artist}" track:"${title}"`, `${artist} ${title}`];
  for (const q of queries) {
    const res = (await dz('search', { q, limit: 25 })).data || [];
    const ok = res.filter((t) => t.readable !== false && t.preview
      && norm(t.title_short || t.title) === norm(title)
      && !LIVE.test(t.title) && !LIVE.test(t.album?.title || ''));
    const byArtist = ok.filter((t) => sameArtist(t.artist?.name, artist));
    const pick = (byArtist.length ? byArtist : []).sort((a, b) => b.rank - a.rank)[0];
    if (pick) return pick;
  }
  return null;
}

const decks = {};
let deck = null;
const missing = [];
const lines = readFileSync(new URL('./catalogo.txt', import.meta.url), 'utf8').split(/\r?\n/);
for (const raw of lines) {
  const line = raw.trim();
  const m = line.match(/^#\s*Mazzo:\s*(.+)$/i);
  if (m) { deck = m[1].trim(); decks[deck] = []; continue; }
  if (!line || line.startsWith('#') || !deck) continue;
  const [artist, title, year, genre] = line.split('|').map((s) => s.trim());
  const t = await find(artist, title);
  if (!t) { missing.push(`${deck}: ${artist} - ${title}`); console.log('✗', artist, '-', title); continue; }
  decks[deck].push({
    id: t.id, title: t.title_short || t.title, artist: t.artist.name,
    cover: t.album?.cover_medium || '', albumId: t.album?.id, rank: t.rank,
    year: +year, genres: [genre || 'Pop'], meta: 1, yearManual: true,
  });
  console.log('✓', artist, '-', title, '→', t.artist.name, '-', t.title, `(${t.rank})`);
}

writeFileSync(new URL('./starter.js', import.meta.url),
  '// Generato da build-starter.mjs a partire da catalogo.txt: non modificare a mano.\n' +
  `window.STARTER_DECKS = ${JSON.stringify(decks)};\n`);
const total = Object.values(decks).reduce((n, d) => n + d.length, 0);
console.log(`\nScritte ${total} canzoni in starter.js`);
if (missing.length) console.log(`Non trovate (${missing.length}):\n` + missing.join('\n'));
