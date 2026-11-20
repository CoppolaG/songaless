// Legge catalogo.txt, trova ogni canzone su Deezer e scrive starter.js (i mazzi di base del gioco).
// Uso:  node build-starter.mjs        (le canzoni già trovate sono in .starter-cache.json)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const here = (f) => new URL('./' + f, import.meta.url);
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/\s-\s.*$/, ' ').replace(/\b(feat|ft)\.?\s.*$/, ' ')
  .replace(/[^a-z0-9]+/g, ' ').trim();
// per titoli in giapponese (dove norm() resta vuoto) confrontiamo il testo grezzo
const key = (s) => norm(s) || String(s || '').toLowerCase().replace(/[\s!！?？.,、。・\-~～()（）「」]/g, '');
const sameTitle = (a, b) => { const x = key(a); const y = key(b); return !!x && x === y; };
const sameArtist = (a, b) => { const x = key(a); const y = key(b); return !!x && !!y && (x.includes(y) || y.includes(x)); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const LIVE = /\blive\b|\bunplugged\b|karaoke|instrumental|remix|cover|tribute|acoustic|session|8-bit|piano|lofi|lo-fi/i;
const yearOf = (d) => { const y = parseInt(String(d || '').slice(0, 4), 10); return y >= 1900 && y <= 2100 ? y : null; };

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

async function find(artists, titles) {
  const queries = [];
  for (const a of artists) for (const t of titles) queries.push(`artist:"${a}" track:"${t}"`, `${a} ${t}`);
  for (const q of queries) {
    const res = (await dz('search', { q, limit: 25 })).data || [];
    const ok = res.filter((t) => t.readable !== false && t.preview
      && titles.some((x) => sameTitle(t.title_short || t.title, x))
      && artists.some((a) => sameArtist(t.artist?.name, a))
      && !LIVE.test(t.title) && !LIVE.test(t.album?.title || ''));
    if (ok.length) return { pick: ok.sort((a, b) => b.rank - a.rank)[0], all: ok };
  }
  return null;
}

// anno non indicato nel catalogo: il più vecchio tra gli album Deezer che contengono la canzone e MusicBrainz
async function guessYear(found, artist, title) {
  const years = [];
  for (const id of [...new Set(found.all.map((t) => t.album?.id))].slice(0, 6)) years.push(yearOf((await dz(`album/${id}`)).release_date));
  try {
    await sleep(1100);
    const q = `recording:"${title}" AND artist:"${artist}"`;
    const r = await fetch(`https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(q)}&limit=50&fmt=json`,
      { headers: { 'User-Agent': 'songaless-catalog-builder/1.0' } });
    if (r.ok) for (const x of (await r.json()).recordings || []) if (sameTitle(x.title, title)) years.push(yearOf(x['first-release-date']));
  } catch { /* basta Deezer */ }
  const ok = years.filter(Boolean);
  return ok.length ? Math.min(...ok) : null;
}

const rawCache = existsSync(here('.starter-cache.json')) ? JSON.parse(readFileSync(here('.starter-cache.json'), 'utf8')) : {};
// la cache è indicizzata per "artista | titolo" (le vecchie chiavi erano la riga intera)
const cache = {};
for (const [k, v] of Object.entries(rawCache)) { const c = k.split('|').map((x) => x.trim()); cache[c.length > 2 ? `${c[0]} | ${c[1]}` : k] = v; }
const decks = {};
let deck = null;
const missing = [];
for (const raw of readFileSync(here('catalogo.txt'), 'utf8').split(/\r?\n/)) {
  const line = raw.trim();
  const m = line.match(/^#\s*Mazzo:\s*(.+)$/i);
  if (m) { deck = m[1].trim(); decks[deck] = []; continue; }
  if (!line || line.startsWith('#') || !deck) continue;
  const [artistF, titleF, yearF, genre, workF] = line.split('|').map((s) => s.trim());
  const ckey = `${artistF} | ${titleF}`;
  const artists = artistF.split(' / ').map((s) => s.trim()).filter(Boolean);
  const titles = titleF.split(' / ').map((s) => s.trim()).filter(Boolean);
  let song = cache[ckey];
  if (!song) {
    const f = await find(artists, titles);
    if (!f) { missing.push(`${deck}: ${artistF} - ${titleF}`); console.log('✗', artistF, '-', titleF); continue; }
    const t = f.pick;
    const dzTitle = t.title_short || t.title;
    song = {
      id: t.id, title: norm(dzTitle) ? dzTitle : titles[0], artist: norm(t.artist.name) ? t.artist.name : artists[0],
      cover: t.album?.cover_medium || '', albumId: t.album?.id, rank: t.rank,
      year: +yearF || await guessYear(f, artists[0], titles[0]), genres: [genre || 'Pop'], meta: 1, yearManual: true,
    };
    cache[ckey] = song;
    console.log('✓', artistF, '-', titleF, '→', t.artist.name, '-', t.title, `(${song.year}, ${t.rank})`);
  }
  const work = workF ? workF.split(' / ').map((x) => x.trim()).filter(Boolean) : null;
  decks[deck].push({ ...song, year: +yearF || song.year, genres: [genre || 'Pop'], ...(work ? { work } : {}) });
}

writeFileSync(here('.starter-cache.json'), JSON.stringify(cache));
writeFileSync(here('starter.js'),
  '// Generato da build-starter.mjs a partire da catalogo.txt: non modificare a mano.\n' +
  `window.STARTER_VERSION = ${Date.now()};\n` +
  `window.STARTER_DECKS = ${JSON.stringify(decks)};\n`);
const total = Object.values(decks).reduce((n, d) => n + d.length, 0);
console.log(`\nScritte ${total} canzoni in starter.js`);
if (missing.length) console.log(`Non trovate (${missing.length}):\n` + missing.join('\n'));
