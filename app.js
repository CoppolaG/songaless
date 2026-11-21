'use strict';

/* ============ utilità ============ */
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// legge (senza valore) o salva; quando salva ritorna false se il browser non ha più spazio
function store(key, val) {
  try {
    if (val === undefined) return JSON.parse(localStorage.getItem('sq.' + key));
    localStorage.setItem('sq.' + key, JSON.stringify(val));
    return true;
  } catch { return val === undefined ? null : false; }
}

// normalizza un titolo per confrontarlo: minuscole, niente accenti, niente "(Remastered)", "- Live", "feat." ecc.
function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\(.*?\)|\[.*?\]/g, ' ')
    .replace(/\s-\s.*$/, ' ')
    .replace(/\b(feat|ft)\.?\s.*$/, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/* ============ Deezer (JSONP: l'API non ha CORS) ============ */
let jsonpCount = 0;
let lastCall = 0;
async function dz(path, params = {}) {
  // Deezer accetta ~50 richieste ogni 5 secondi: distanziamo le chiamate
  const wait = lastCall + 110 - Date.now();
  lastCall = Math.max(Date.now(), lastCall + 110);
  if (wait > 0) await sleep(wait);
  return new Promise((resolve, reject) => {
    const cb = '__dz' + (++jsonpCount);
    const q = new URLSearchParams({ ...params, output: 'jsonp', callback: cb });
    const s = document.createElement('script');
    s.src = `https://api.deezer.com/${path}${path.includes('?') ? '&' : '?'}${q}`;
    const timer = setTimeout(() => { cleanup(); reject(new Error('Deezer non risponde')); }, 12000);
    function cleanup() { clearTimeout(timer); delete window[cb]; s.remove(); }
    window[cb] = (data) => {
      cleanup();
      if (data && data.error) reject(new Error(data.error.message || 'Errore Deezer'));
      else resolve(data);
    };
    s.onerror = () => { cleanup(); reject(new Error('Errore di rete verso Deezer')); };
    document.head.append(s);
  });
}

const toSong = (t) => ({
  id: t.id,
  title: t.title_short || t.title,
  artist: t.artist?.name || '',
  cover: t.album?.cover_medium || t.album?.cover || '',
  albumId: t.album?.id,
  rank: t.rank,
});

async function dzFind(artist, title) {
  const tries = [
    `artist:"${artist}" track:"${title}"`,
    `${artist} ${title}`,
  ];
  for (const q of tries) {
    const r = await dz('search', { q, limit: 5 });
    const hit = (r.data || []).find((t) => t.readable !== false) || r.data?.[0];
    if (hit) return toSong(hit);
  }
  return null;
}

/* ============ Mazzi ============ */
let decks = store('decks') || {};
let active = new Set(store('active') || Object.keys(decks));
let storageWarned = false;
// più schede aperte: prima di salvare recupero quello che le altre hanno aggiunto, così nessuna cancella il lavoro dell'altra
// le eliminazioni sono condivise tra le schede, così un mazzo tolto non torna indietro
const deletedDecks = new Set(store('deletedDecks') || []); const deletedSongs = new Set(store('deletedSongs') || []);
const saveDeleted = () => { store('deletedDecks', [...deletedDecks]); store('deletedSongs', [...deletedSongs].slice(-600)); };
function mergeFromStorage() {
  (store('deletedDecks') || []).forEach((n) => deletedDecks.add(n));
  (store('deletedSongs') || []).forEach((k) => deletedSongs.add(k));
  let changed = false;
  for (const n of deletedDecks) if (decks[n]) { delete decks[n]; active.delete(n); changed = true; }
  for (const [n, list] of Object.entries(decks)) {
    const keep = list.filter((x) => !deletedSongs.has(n + '|' + x.id));
    if (keep.length !== list.length) { decks[n] = keep; changed = true; }
  }
  const stored = store('decks');
  if (!stored || typeof stored !== 'object') return changed;
  for (const [name, list] of Object.entries(stored)) {
    if (deletedDecks.has(name) || !Array.isArray(list)) continue;
    const isNew = !decks[name];
    const mine = decks[name] || (decks[name] = []);
    const byId = new Map(mine.map((x) => [String(x.id), x]));
    for (const song of list) {
      if (!song || song.id == null) continue;
      const have = byId.get(String(song.id));
      if (!have) { if (!deletedSongs.has(name + '|' + song.id)) { mine.push(song); byId.set(String(song.id), song); changed = true; } }
      else if (song.meta && !have.meta) { Object.assign(have, song); changed = true; } // catalogata dall'altra scheda
    }
    if (isNew && mine.length) { active.add(name); changed = true; }
  }
  return changed;
}
const saveDecks = () => {
  mergeFromStorage();
  const ok = store('decks', decks) && store('active', [...active]);
  if (!ok && !storageWarned) {
    storageWarned = true;
    alert('⚠️ La memoria del browser per questo sito è piena: le ultime modifiche ai mazzi NON sono state salvate e ricaricando andrebbero perse.\n\nEsporta subito i mazzi (Impostazioni → Mazzi e playlist → Esporta), poi togli qualche mazzo che non usi o le foto dei personaggi.');
  }
  return ok;
};

// riconosce film, cartoni e anime anche nelle playlist importate, confrontandole con il catalogo di base
let knownWorks = null;
const kKey = (x) => norm(x) || String(x || '').toLowerCase().replace(/\s+/g, '');
const mainArtist = (x) => kKey(String(x || '').split(/\s*(?:,|&|\bfeat\.?|\bft\.?)\s*/i)[0]);
function knownIndex() {
  if (knownWorks) return knownWorks;
  knownWorks = { byId: new Map(), byKey: new Map() };
  for (const list of Object.values(window.STARTER_DECKS || {})) for (const s of list) {
    if (!s.work?.length) continue;
    knownWorks.byId.set(String(s.id), s);
    knownWorks.byKey.set(kKey(s.title) + '|' + mainArtist(s.artist), s);
  }
  return knownWorks;
}
function applyKnown(song) {
  if (!song || song.work?.length) return false;
  const k = knownIndex();
  const hit = k.byId.get(String(song.id)) || k.byKey.get(kKey(song.title) + '|' + mainArtist(song.artist));
  if (!hit) return false;
  Object.assign(song, { work: hit.work, genres: hit.genres, year: hit.year, yearManual: true, meta: 1 });
  return true;
}
function recognizeKnownWorks() {
  const base = new Set(Object.keys(window.STARTER_DECKS || {}));
  let n = 0;
  for (const [name, list] of Object.entries(decks)) if (!base.has(name)) for (const s of list) if (applyKnown(s)) n++;
  if (n) saveDecks();
  return n;
}

function addToDeck(name, songs) {
  name = name.trim() || 'Senza nome';
  if (deletedDecks.delete(name)) saveDeleted();
  for (const sg of songs) if (sg && deletedSongs.delete(name + '|' + sg.id)) saveDeleted();
  const list = decks[name] || (decks[name] = []);
  // niente doppioni: stesso id, oppure stessa canzone in un'altra versione (live, remaster, feat…)
  const key = (s) => norm(s.title) + '|' + norm(s.artist);
  const ids = new Set(list.map((s) => s.id));
  const keys = new Set(list.map(key));
  let added = 0;
  for (const s of songs) {
    if (!s || ids.has(s.id) || keys.has(key(s))) continue;
    applyKnown(s);
    list.push(s); ids.add(s.id); keys.add(key(s)); added++;
  }
  active.add(name);
  saveDecks();
  renderDecks();
  enrichAll();
  return added;
}

/* ============ Catalogazione: anno originale, generi, popolarità ============ */
// Deezer dà generi e popolarità, ma spesso l'anno di una ristampa: lo incrociamo con MusicBrainz
const albumCache = new Map();
const getAlbum = (id) => {
  if (!albumCache.has(id)) albumCache.set(id, dz(`album/${id}`).catch(() => null));
  return albumCache.get(id);
};
const yearOf = (d) => { const y = parseInt(String(d || '').slice(0, 4), 10); return y >= 1900 && y <= 2100 ? y : null; };
const sameArtist = (a, b) => { a = norm(a); b = norm(b); return !!a && !!b && (a.includes(b) || b.includes(a)); };

let mbLast = 0;
async function mbEarliestYear(artist, title) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const wait = mbLast + 1500 - Date.now(); // MusicBrainz: massimo 1 richiesta al secondo
    mbLast = Math.max(Date.now(), mbLast + 1500);
    if (wait > 0) await sleep(wait);
    try {
      const clean = title.replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/\s-\s.*$/, '').replace(/"/g, '').trim() || title;
      const q = `recording:"${clean}" AND artist:"${artist.replace(/"/g, '')}"`;
      let r;
      // quando MusicBrainz rallenta risponde 503 senza CORS: fetch fallisce, aspettiamo e riproviamo
      try { r = await fetch(`https://musicbrainz.org/ws/2/recording?query=${encodeURIComponent(q)}&limit=50&fmt=json`); } catch { r = { status: 503 }; }
      if (r.status === 503) { mbLast = Date.now() + 2000 * (attempt + 1); continue; }
      if (!r.ok) return null;
      const d = await r.json();
      const years = (d.recordings || [])
        .filter((x) => norm(x.title) === norm(title) && (x['artist-credit'] || []).some((c) => sameArtist(c.name, artist)))
        .map((x) => yearOf(x['first-release-date'])).filter(Boolean);
      return years.length ? Math.min(...years) : null;
    } catch { return null; }
  }
  return null;
}

async function deezerMeta(s) {
  if (!s.albumId || s.rank == null) {
    const t = await dz(`track/${s.id}`);
    s.albumId = t.album?.id; s.rank = t.rank ?? 0;
  }
  const album = s.albumId ? await getAlbum(s.albumId) : null;
  const genres = (album?.genres?.data || []).map((g) => g.name);
  const years = [yearOf(album?.release_date)];
  // altre versioni della stessa canzone (l'album originale spesso c'è)
  try {
    const r = await dz('search', { q: `${s.artist} ${s.title}`, limit: 15 });
    const ids = [...new Set((r.data || [])
      .filter((t) => norm(t.title_short || t.title) === norm(s.title) && sameArtist(t.artist?.name, s.artist))
      .map((t) => t.album?.id).filter((id) => id && id !== s.albumId))].slice(0, 6);
    for (const id of ids) {
      const a = await getAlbum(id);
      years.push(yearOf(a?.release_date));
      if (!genres.length) genres.push(...(a?.genres?.data || []).map((g) => g.name));
    }
  } catch { /* basta l'album principale */ }
  return { genres, years };
}

let enriching = false;
async function enrichAll() {
  if (enriching) return;
  enriching = true;
  try {
    for (;;) {
      // la stessa canzone può stare in più mazzi: la cataloghiamo una volta sola
      const byId = new Map();
      for (const list of Object.values(decks)) for (const s of list) if (!s.meta) (byId.get(s.id) || byId.set(s.id, []).get(s.id)).push(s);
      const todo = [...byId.values()];
      const total = Object.values(decks).reduce((n, l) => n + l.length, 0);
      if (!todo.length) { enrichStatus(''); break; }
      const mins = Math.max(1, Math.round((todo.length * 1.7) / 60));
      enrichStatus(`🔎 Catalogate ${total - todo.length} canzoni su ${total} · ne mancano ${todo.length} (circa ${mins} min, solo mentre il sito è aperto)`);
      const copies = todo[0]; const s = copies[0];
      try {
        const [dzm, mbYear] = await Promise.all([deezerMeta(s), mbEarliestYear(s.artist, s.title)]);
        const year = Math.min(...[...dzm.years, mbYear].filter(Boolean)) ;
        const meta = {
          albumId: s.albumId, rank: s.rank ?? 0,
          genres: dzm.genres.length ? [...new Set(dzm.genres)] : ['Altro'],
          year: Number.isFinite(year) ? year : null, meta: 1,
        };
        for (const c of copies) { if (c.yearManual) meta.year = c.year; Object.assign(c, meta); }
      } catch {
        for (const c of copies) Object.assign(c, { genres: c.genres || ['Altro'], year: c.year ?? null, rank: c.rank ?? 0, meta: 1 });
      }
      saveDecks();
      if (!$('#screen-setup').classList.contains('hidden')) renderFilters();
    }
  } finally {
    enriching = false;
    renderDecks();
    if (!$('#screen-setup').classList.contains('hidden')) renderFilters();
  }
}
function enrichStatus(msg) { $$('.enrich-status').forEach((e) => { e.textContent = msg; }); }

window.addEventListener('storage', (e) => {
  if (!['sq.decks', 'sq.deletedDecks', 'sq.deletedSongs'].includes(e.key)) return;
  if (mergeFromStorage()) {
    renderDecks();
    if (!document.getElementById('screen-setup').classList.contains('hidden')) renderFilters();
    enrichAll();
  }
});

const openDecks = new Set();
function renderDecks() {
  const el = $('#deck-list');
  const names = Object.keys(decks).sort();
  $('#deck-names').innerHTML = names.map((n) => `<option value="${esc(n)}">`).join('');
  if (!names.length) { el.innerHTML = '<p class="muted">Nessun mazzo ancora: aggiungi delle canzoni qui sotto.</p>'; return; }
  el.innerHTML = names.map((n) => `
    <div class="deck" data-deck="${esc(n)}">
      <input type="checkbox" ${active.has(n) ? 'checked' : ''} aria-label="Usa ${esc(n)}">
      <span class="name">${esc(n)}</span>
      <span class="count">${decks[n].length} canzoni</span>
      <button data-act="toggle">${openDecks.has(n) ? 'Chiudi' : 'Vedi'}</button>
      <button data-act="delete" class="ghost">Elimina</button>
    </div>
    ${openDecks.has(n) ? `<ul class="deck-songs">${decks[n].map((s) => `
      <li><span>${esc(s.artist)} – ${esc(s.title)}</span>
        <span class="song-meta">${s.meta ? `${esc((s.genres || []).join(', '))} ·` : '…'}
          <button class="year-btn" data-year-song="${s.id}" title="Correggi l'anno">${s.year || '????'}</button>
          <button data-del-song="${s.id}" data-deck="${esc(n)}" title="Togli">✕</button></span></li>`).join('')}</ul>` : ''}
  `).join('');
}

$('#deck-list').addEventListener('click', (e) => {
  const yearBtn = e.target.closest('[data-year-song]');
  if (yearBtn) {
    const id = yearBtn.dataset.yearSong;
    const y = yearOf(prompt('Anno di uscita originale:', yearBtn.textContent.replace(/\?/g, '')));
    if (!y) return;
    for (const list of Object.values(decks)) for (const s of list) if (String(s.id) === id) Object.assign(s, { year: y, yearManual: true });
    saveDecks(); renderDecks(); return;
  }
  const songBtn = e.target.closest('[data-del-song]');
  if (songBtn) {
    const n = songBtn.dataset.deck;
    deletedSongs.add(n + '|' + songBtn.dataset.delSong); saveDeleted();
    decks[n] = decks[n].filter((s) => String(s.id) !== songBtn.dataset.delSong);
    saveDecks(); renderDecks(); return;
  }
  const row = e.target.closest('.deck');
  if (!row) return;
  const n = row.dataset.deck;
  if (e.target.type === 'checkbox') {
    e.target.checked ? active.add(n) : active.delete(n);
    saveDecks(); return;
  }
  const act = e.target.dataset.act;
  if (act === 'toggle') { openDecks.has(n) ? openDecks.delete(n) : openDecks.add(n); renderDecks(); }
  if (act === 'delete' && confirm(`Eliminare il mazzo "${n}"?`)) { deletedDecks.add(n); saveDeleted(); delete decks[n]; active.delete(n); saveDecks(); renderDecks(); }
});

/* ============ Import ============ */
const status = (msg) => { $('#import-status').textContent = msg; };
const deckName = () => {
  const n = $('#deck-name').value.trim();
  if (!n) { status('Dai prima un nome al mazzo.'); $('#deck-name').focus(); }
  return n;
};

$$('.tab').forEach((t) => t.addEventListener('click', () => {
  $$('.tab').forEach((x) => x.classList.toggle('active', x === t));
  $$('.tab-panel').forEach((p) => p.classList.toggle('hidden', p.dataset.panel !== t.dataset.tab));
}));

async function runImport(btn, fn) {
  btn.disabled = true;
  try { await fn(); } catch (err) { status('⚠️ ' + err.message); } finally { btn.disabled = false; }
}

$('#dz-import').addEventListener('click', (e) => runImport(e.target, async () => {
  const name = deckName(); if (!name) return;
  const m = $('#dz-playlist').value.match(/playlist\/(\d+)/) || $('#dz-playlist').value.match(/^\s*(\d+)\s*$/);
  if (!m) throw new Error('Link non valido. Usa il link completo tipo deezer.com/it/playlist/123456 (non quello corto link.deezer.com).');
  const songs = [];
  let index = 0;
  for (;;) {
    status(`Leggo la playlist… ${songs.length} canzoni`);
    const r = await dz(`playlist/${m[1]}/tracks`, { limit: 100, index });
    const page = (r.data || []).filter((t) => t.readable !== false).map(toSong);
    songs.push(...page);
    if (!r.next || !r.data?.length) break;
    index += 100;
  }
  const added = addToDeck(name, songs);
  status(`✅ Aggiunte ${added} canzoni a "${name}".`);
}));

$('#artist-import').addEventListener('click', (e) => runImport(e.target, async () => {
  const name = deckName(); if (!name) return;
  const artists = $('#artist-list').value.split('\n').map((s) => s.trim()).filter(Boolean);
  const n = Math.min(50, Math.max(1, +$('#artist-n').value || 15));
  if (!artists.length) throw new Error('Scrivi almeno un artista.');
  let total = 0; const missing = [];
  for (const a of artists) {
    status(`Cerco ${a}…`);
    const r = await dz('search/artist', { q: a, limit: 10 });
    // tra gli omonimi prendiamo quello con più fan (es. "Queen" ha decine di omonimi)
    const exact = (r.data || []).filter((x) => norm(x.name) === norm(a));
    const art = (exact.length ? exact : (r.data || []).slice(0, 1)).sort((x, y) => (y.nb_fan || 0) - (x.nb_fan || 0))[0];
    if (!art) { missing.push(a); continue; }
    const top = await dz(`artist/${art.id}/top`, { limit: n });
    total += addToDeck(name, (top.data || []).map(toSong));
  }
  status(`✅ Aggiunte ${total} canzoni a "${name}".` + (missing.length ? `\nNon trovati: ${missing.join(', ')}` : ''));
}));

$('#manual-import').addEventListener('click', (e) => runImport(e.target, async () => {
  const name = deckName(); if (!name) return;
  const lines = $('#manual-list').value.split('\n').map((s) => s.trim()).filter(Boolean);
  if (!lines.length) throw new Error('Scrivi almeno una canzone.');
  const found = []; const missing = [];
  for (const [i, line] of lines.entries()) {
    status(`Cerco ${i + 1}/${lines.length}: ${line}`);
    const [artist, ...rest] = line.split(/\s+[-–—]\s+/);
    const title = rest.join(' - ');
    let s = null;
    if (title) s = await dzFind(artist, title);
    else { const hit = (await dz('search', { q: line, limit: 1 })).data?.[0]; if (hit) s = toSong(hit); }
    if (s) found.push(s); else missing.push(line);
  }
  const added = addToDeck(name, found);
  status(`✅ Aggiunte ${added} canzoni a "${name}".` + (missing.length ? `\nNon trovate:\n${missing.join('\n')}` : ''));
}));

/* ============ Spotify (login PKCE, solo per leggere le playlist) ============ */
const SP_REDIRECT = location.origin + location.pathname;
$('#sp-redirect').textContent = SP_REDIRECT;
$('#sp-client').value = store('spClient') || '';

const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

$('#sp-login').addEventListener('click', async () => {
  const clientId = $('#sp-client').value.trim();
  if (!clientId) { status('Incolla il Client ID della tua app Spotify.'); return; }
  if (!window.isSecureContext) { status('⚠️ Apri il sito da http://127.0.0.1:8000 (non da file o localhost) per usare Spotify.'); return; }
  store('spClient', clientId);
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const state = b64url(crypto.getRandomValues(new Uint8Array(12)));
  sessionStorage.setItem('spVerifier', verifier);
  sessionStorage.setItem('spState', state);
  location.href = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
    client_id: clientId, response_type: 'code', redirect_uri: SP_REDIRECT, state,
    scope: 'playlist-read-private playlist-read-collaborative',
    code_challenge_method: 'S256', code_challenge: challenge,
  });
});

async function spToken(body) {
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: store('spClient'), ...body }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error('Spotify: ' + (d.error_description || d.error));
  store('spAuth', { token: d.access_token, refresh: d.refresh_token || store('spAuth')?.refresh, exp: Date.now() + d.expires_in * 1000 - 60000 });
}

async function spHandleRedirect() {
  const p = new URLSearchParams(location.search);
  if (!p.has('code') && !p.has('error')) return;
  history.replaceState(null, '', SP_REDIRECT);
  go('settings', { tab: 'decks' });
  $('.tab[data-tab="spotify"]').click();
  if (p.get('error')) { status('Accesso Spotify annullato.'); return; }
  if (p.get('state') !== sessionStorage.getItem('spState')) { status('⚠️ Accesso Spotify non valido, riprova.'); return; }
  try {
    await spToken({ grant_type: 'authorization_code', code: p.get('code'), redirect_uri: SP_REDIRECT, code_verifier: sessionStorage.getItem('spVerifier') });
  } catch (err) { status('⚠️ ' + err.message); }
}

async function sp(path) {
  let auth = store('spAuth');
  if (!auth) throw new Error('Accedi prima a Spotify.');
  if (Date.now() > auth.exp && auth.refresh) { await spToken({ grant_type: 'refresh_token', refresh_token: auth.refresh }); auth = store('spAuth'); }
  const r = await fetch(path.startsWith('http') ? path : 'https://api.spotify.com/v1/' + path, { headers: { Authorization: 'Bearer ' + auth.token } });
  if (r.status === 401) { store('spAuth', null); spRender(); throw new Error('Sessione Spotify scaduta, accedi di nuovo.'); }
  if (!r.ok) { const e = new Error(`Spotify ha risposto ${r.status}`); e.status = r.status; throw e; }
  return r.json();
}

async function spRender() {
  const logged = !!store('spAuth');
  $('#sp-logged-out').classList.toggle('hidden', logged);
  $('#sp-logged-in').classList.toggle('hidden', !logged);
  if (!logged) return;
  try {
    const lists = [];
    let url = 'me/playlists?limit=50';
    while (url) { const d = await sp(url); lists.push(...d.items.filter(Boolean)); url = d.next; }
    $('#sp-playlists').innerHTML = lists.map((pl) => `<option value="${pl.id}">${esc(pl.name)}</option>`).join('');
  } catch (err) { status('⚠️ ' + err.message); }
}

$('#sp-logout').addEventListener('click', () => { store('spAuth', null); spRender(); });

$('#sp-import').addEventListener('click', (e) => runImport(e.target, async () => {
  const name = deckName(); if (!name) return;
  const id = $('#sp-playlists').value;
  // Spotify sta passando da /tracks a /items: proviamo prima il nuovo
  let items = [];
  for (const ep of ['items', 'tracks']) {
    try {
      let url = `playlists/${id}/${ep}?limit=50`;
      items = [];
      while (url) { status(`Leggo la playlist Spotify… ${items.length}`); const d = await sp(url); items.push(...d.items); url = d.next; }
      break;
    } catch (err) { if (ep === 'tracks' || ![403, 404].includes(err.status)) throw err; }
  }
  const tracks = items.map((it) => it.item || it.track).filter((t) => t && t.type !== 'episode' && t.name);
  const found = []; const missing = [];
  for (const [i, t] of tracks.entries()) {
    const artist = t.artists?.[0]?.name || '';
    status(`Cerco su Deezer ${i + 1}/${tracks.length}: ${artist} – ${t.name}`);
    let s = null;
    const isrc = t.external_ids?.isrc;
    if (isrc) { try { const d = await dz(`track/isrc:${isrc}`); if (d.id) s = toSong(d); } catch { /* proviamo con la ricerca */ } }
    if (!s) s = await dzFind(artist, t.name.replace(/\s-\s.*$/, ''));
    s ? found.push(s) : missing.push(`${artist} – ${t.name}`);
  }
  const added = addToDeck(name, found);
  status(`✅ Aggiunte ${added} canzoni a "${name}".` + (missing.length ? `\nNon trovate su Deezer:\n${missing.join('\n')}` : ''));
}));

/* ============ Audio: Web Audio per una durata precisa al millisecondo ============ */
const player = {
  ctx: null, buffer: null, el: null, node: null, timer: null, master: null,
  volume: (() => { const v = store('volume'); return typeof v === 'number' ? Math.min(1, Math.max(0, v)) : 0.9; })(),
  setVolume(v) {
    this.volume = Math.min(1, Math.max(0, +v || 0)); store('volume', this.volume);
    if (this.master) this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.02);
    if (this.el) this.el.volume = this.volume;
  },
  async load(url) {
    this.stop(); this.buffer = null; this.el = null;
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error();
      const data = await r.arrayBuffer();
      this.ctx = this.ctx || new AudioContext();
      this.buffer = await this.ctx.decodeAudioData(data);
    } catch {
      // ripiego se il download diretto è bloccato: elemento <audio> (meno preciso)
      this.el = new Audio(url);
      this.el.preload = 'auto';
      await new Promise((res, rej) => { this.el.oncanplaythrough = res; this.el.onerror = () => rej(new Error('Anteprima non disponibile')); });
    }
  },
  get duration() { return this.buffer ? this.buffer.duration : (this.el?.duration || 30); },
  get precise() { return !!this.buffer; },
  play(offset, dur, onEnd) {
    this.stop();
    if (this.buffer) {
      const ctx = this.ctx; ctx.resume();
      const t = ctx.currentTime + 0.03;
      const gain = ctx.createGain();
      const fade = Math.min(0.005, dur / 4); // micro-dissolvenza per evitare il "click"
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(1, t + fade);
      gain.gain.setValueAtTime(1, t + dur - fade);
      gain.gain.linearRampToValueAtTime(0, t + dur);
      const src = ctx.createBufferSource();
      src.buffer = this.buffer;
      if (!this.analyser) { // per il visualizzatore attorno al pulsante play
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 128;
        this.analyser.connect(ctx.destination);
        this.master = ctx.createGain(); // volume generale
        this.master.gain.value = this.volume;
        this.master.connect(this.analyser);
      }
      src.connect(gain).connect(this.master);
      src.start(t, offset, dur);
      src.onended = () => { if (this.node === src) { this.node = null; onEnd?.(); } };
      this.node = src;
    } else if (this.el) {
      this.el.volume = this.volume;
      this.el.currentTime = offset;
      this.el.play();
      this.timer = setTimeout(() => { this.el.pause(); onEnd?.(); }, dur * 1000);
    }
  },
  stop() {
    if (this.node) { const n = this.node; this.node = null; try { n.stop(); } catch { /* già fermo */ } }
    if (this.el) this.el.pause();
    clearTimeout(this.timer);
  },
};

function activePool() {
  const seen = new Set(); const pool = [];
  for (const n of active) for (const s of decks[n] || []) if (!seen.has(s.id)) { seen.add(s.id); pool.push(s); }
  return pool;
}

/* ============ Filtri ============ */
const WORLD_HIT = 800000; // "rank" Deezer: Bohemian Rhapsody ~960k, Levitating ~900k
const MIN_DECADE_CHIP = 1990; // le epoche prima degli anni 90 non compaiono come categoria
// sezioni per genere: i nomi di Deezer ("Pop internazionale", "Trap", "Electro"…) raggruppati in poche famiglie
const BUCKETS = [
  { id: 'rap', icon: '🎤', name: 'Rap / Hip Hop', re: /rap|hip ?hop|trap|drill|grime/i },
  { id: 'rnb', icon: '💜', name: 'R&B e Soul', re: /r&b|rnb|soul|funk/i },
  { id: 'rock', icon: '🎸', name: 'Rock', re: /rock|metal|punk|grunge/i },
  { id: 'dance', icon: '💃', name: 'Dance ed Elettronica', re: /dance|electro|elettronica|house|techno|edm|disco/i },
  { id: 'alt', icon: '🌀', name: 'Alternative e Indie', re: /alternative|indie/i },
  { id: 'latin', icon: '🌶️', name: 'Latina', re: /latin|reggaeton|salsa/i },
  { id: 'reggae', icon: '🌴', name: 'Reggae', re: /reggae|dancehall/i },
  { id: 'jazz', icon: '🎷', name: 'Jazz e Blues', re: /jazz|blues|swing/i },
  { id: 'it', icon: '🇮🇹', name: 'Musica italiana', re: /italian/i },
  { id: 'pop', icon: '🎵', name: 'Pop', re: /pop/i },
];
const NO_BUCKET = /sigle|colonne sonore|film/i; // sigle e film hanno già le loro categorie
function bucketOf(s) {
  const gs = s.genres || [];
  if (!gs.length || gs.some((g) => NO_BUCKET.test(g))) return null;
  for (const b of BUCKETS) if (gs.some((g) => b.re.test(g))) return b.id;
  return null;
}
let filters = { decks: [], decades: [], genres: [], artists: [], pop: 'all', buckets: [], ...(store('filters') || {}) };
const saveFilters = () => { store('filters', filters); renderFilters(); };
const decadeOf = (y) => (y ? Math.floor(y / 10) * 10 : null);
const decadeLabel = (d) => (d < 2000 ? `Anni ${String(d).slice(2)}` : `Anni ${d}`);

// le canzoni più ascoltate (40%) di ciascun artista
function topPerArtist(pool) {
  const by = new Map();
  for (const s of pool) { const k = norm(s.artist); (by.get(k) || by.set(k, []).get(k)).push(s); }
  const top = new Set();
  for (const list of by.values()) {
    list.sort((a, b) => (b.rank || 0) - (a.rank || 0));
    list.slice(0, Math.ceil(list.length * 0.4)).forEach((s) => top.add(s.id));
  }
  return top;
}

// base della partita: i mazzi scelti dalla categoria, altrimenti quelli spuntati
function basePool() {
  const names = filters.decks.filter((n) => decks[n]);
  if (!names.length) return activePool();
  const seen = new Set(); const pool = [];
  for (const n of names) for (const s of decks[n]) if (!seen.has(s.id)) { seen.add(s.id); pool.push(s); }
  return pool;
}

function filteredPool() {
  const pool = basePool();
  const top = ['top', 'deep'].includes(filters.pop) ? topPerArtist(pool) : null;
  return pool.filter((s) => {
    if (filters.decades.length && !filters.decades.includes(decadeOf(s.year))) return false;
    if (filters.genres.length && !(s.genres || []).some((g) => filters.genres.includes(g))) return false;
    if (filters.buckets.length && !filters.buckets.includes(bucketOf(s))) return false;
    if (filters.artists.length && !filters.artists.some((a) => norm(a) === norm(s.artist))) return false;
    if (filters.pop === 'world' && !((s.rank || 0) >= WORLD_HIT)) return false;
    if (filters.pop === 'top' && !top.has(s.id)) return false;
    if (filters.pop === 'deep' && top.has(s.id)) return false;
    return true;
  });
}

function countBy(pool, keysOf) {
  const m = new Map();
  for (const s of pool) for (const k of keysOf(s)) if (k != null) m.set(k, (m.get(k) || 0) + 1);
  return m;
}

const CATEGORIES = [
  { id: 'tutto', icon: '🎲', name: 'Tutto', desc: 'Dai mazzi spuntati', f: {} },
  { id: 'storiche', icon: '🏆', name: 'Hit storiche', desc: 'Successi mondiali fino al 1999', f: { decades: [1950, 1960, 1970, 1980, 1990], pop: 'world' } },
  { id: 'recenti', icon: '🔥', name: 'Successi recenti', desc: 'Dal 2010 a oggi', f: { decades: [2010, 2020], pop: 'top' } },
  { id: 'italiane', icon: '🇮🇹', name: 'Italiane', desc: 'Da Modugno a Olly', f: { decks: ['Musica italiana'] } },
  { id: 'internazionali', icon: '🌍', name: 'Internazionali', desc: 'Dagli anni 60 al 2025', f: { decks: ['Hit internazionali'] } },
  { id: 'sigle', icon: '📺', name: 'Sigle cartoni', desc: 'Cartoni italiani e anime', f: { decks: ['Sigle cartoni e anime'] } },
  { id: 'anime', icon: '🇯🇵', name: 'Anime', desc: "Le sigle più famose: indovina l'anime", f: { decks: ['Anime'] } },
  { id: 'film', icon: '🎬', name: 'Film e Disney', desc: 'Colonne sonore', f: { decks: ['Film e Disney'] } },
  { id: 'sensational', icon: '🎤', name: 'Sensational', desc: 'Rap americano', f: { decks: ['Sensational'] } },
  { id: 'chicche', icon: '💎', name: 'Chicche', desc: 'Le meno famose', f: { pop: 'deep' } },
];
// categorie fisse + una per ogni mazzo che hai importato tu
function allCategories() {
  const base = new Set(Object.keys(window.STARTER_DECKS || {}));
  const mine = Object.keys(decks).filter((n) => !base.has(n) && decks[n].length).sort()
    .map((n) => ({ id: 'deck:' + n, icon: '📁', name: n, desc: `${decks[n].length} canzoni · tuo mazzo`, f: { decks: [n] } }));
  return CATEGORIES.concat(mine);
}
const catFilters = (c) => ({ decks: [], decades: [], genres: [], artists: [], pop: 'all', buckets: [], ...structuredClone(c.f) });
const sameFilters = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function renderFilters() {
  const pool = basePool();
  $('#f-categories').innerHTML = allCategories().map((c) => {
    const on = sameFilters(filters, catFilters(c));
    const missing = c.f.decks && !c.f.decks.some((n) => decks[n]);
    return `<button class="cat ${on ? 'on' : ''}" data-cat="${esc(c.id)}" ${missing ? 'disabled title="Mazzo non presente"' : ''}>
      <span class="cat-icon">${c.icon}</span><span class="cat-name">${esc(c.name)}</span><span class="cat-desc">${esc(c.desc)}</span></button>`;
  }).join('');

  const bk = countBy(activePool(), (s) => [bucketOf(s)]);
  $('#f-buckets').innerHTML = BUCKETS.filter((b) => bk.get(b.id)).map((b) => {
    const on = sameFilters(filters, catFilters({ f: { buckets: [b.id] } }));
    return `<button class="cat small-cat ${on ? 'on' : ''}" data-bucket="${b.id}"><span class="cat-icon">${b.icon}</span><span class="cat-name">${b.name}</span><span class="cat-desc">${bk.get(b.id)} canzoni</span></button>`;
  }).join('') || '<span class="muted small">Appariranno quando le canzoni saranno catalogate.</span>';

  const decs = countBy(pool, (s) => [decadeOf(s.year)]);
  $('#f-decades').innerHTML = [...decs.keys()].filter((d) => d >= MIN_DECADE_CHIP).sort((a, b) => a - b).map((d) =>
    `<span class="chip toggle ${filters.decades.includes(d) ? 'on' : ''}" data-decade="${d}">${decadeLabel(d)} <small>${decs.get(d)}</small></span>`).join('')
    || '<span class="muted small">Appariranno quando le canzoni saranno catalogate.</span>';

  const gens = countBy(pool, (s) => s.genres || []);
  for (const g of filters.genres) if (!gens.has(g)) gens.set(g, 0);
  $('#f-genres').innerHTML = [...gens.entries()].sort((a, b) => b[1] - a[1]).map(([g, n]) =>
    `<span class="chip toggle ${filters.genres.includes(g) ? 'on' : ''}" data-genre="${esc(g)}">${esc(g)} <small>${n}</small></span>`).join('')
    || '<span class="muted small">Appariranno quando le canzoni saranno catalogate.</span>';

  const arts = countBy(pool, (s) => [s.artist]);
  $('#f-artist-list').innerHTML = [...arts.keys()].sort().map((a) => `<option value="${esc(a)}">`).join('');
  $('#f-artists').innerHTML = filters.artists.map((a, i) => `<span class="chip">${esc(a)}<button data-art="${i}" title="Togli">✕</button></span>`).join('');
  $('#f-pop').value = filters.pop;

  const n = filteredPool().length;
  const pending = pool.filter((s) => !s.meta).length;
  $('#filter-count').textContent = `${n} canzoni pronte` + (pending ? ` · ${pending} ancora da catalogare (in corso)` : '');
  renderSummary();
}

$('#f-buckets').addEventListener('click', (e) => {
  const b = e.target.closest('[data-bucket]'); if (!b) return;
  filters = catFilters({ f: { buckets: [b.dataset.bucket] } }); saveFilters();
});
$('#f-categories').addEventListener('click', (e) => {
  const b = e.target.closest('[data-cat]'); if (!b || b.disabled) return;
  filters = catFilters(allCategories().find((c) => c.id === b.dataset.cat)); saveFilters();
});
$('#f-decades').addEventListener('click', (e) => {
  const c = e.target.closest('[data-decade]'); if (!c) return;
  const d = +c.dataset.decade;
  filters.decades = filters.decades.includes(d) ? filters.decades.filter((x) => x !== d) : [...filters.decades, d];
  saveFilters();
});
$('#f-genres').addEventListener('click', (e) => {
  const c = e.target.closest('[data-genre]'); if (!c) return;
  const g = c.dataset.genre;
  filters.genres = filters.genres.includes(g) ? filters.genres.filter((x) => x !== g) : [...filters.genres, g];
  saveFilters();
});
$('#f-artist-add').addEventListener('click', () => {
  const a = $('#f-artist-input').value.trim();
  if (a && !filters.artists.some((x) => norm(x) === norm(a))) filters.artists.push(a);
  $('#f-artist-input').value = ''; saveFilters();
});
$('#f-artist-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#f-artist-add').click(); });
$('#f-artists').addEventListener('click', (e) => {
  if (e.target.dataset.art === undefined) return;
  filters.artists.splice(+e.target.dataset.art, 1); saveFilters();
});
$('#f-pop').addEventListener('change', (e) => { filters.pop = e.target.value; saveFilters(); });


/* ============ Esporta / importa mazzi ============ */
$('#deck-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ app: 'indovina-la-canzone', version: 1, decks }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mazzi-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
$('#deck-import-btn').addEventListener('click', () => $('#deck-import-file').click());
$('#deck-import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const incoming = data.decks || data;
    let total = 0;
    for (const [name, songs] of Object.entries(incoming)) {
      if (!Array.isArray(songs)) continue;
      total += addToDeck(name, songs.filter((s) => s && s.id && s.title).map((s) => ({ ...s })));
    }
    alert(`Importate ${total} canzoni.`);
  } catch { alert('File non valido.'); }
});

/* ============ Mazzi di base (starter.js, generato da catalogo.txt) ============ */
// aggiunge le canzoni mancanti dei mazzi di base e aggiorna anno/genere di quelle già presenti
function loadStarter() {
  let total = 0;
  for (const [name, songs] of Object.entries(window.STARTER_DECKS || {})) {
    const byId = new Map((decks[name] || []).map((s) => [String(s.id), s]));
    for (const s of songs) { const old = byId.get(String(s.id)); if (old) Object.assign(old, { year: s.year, genres: s.genres, yearManual: true, meta: 1, ...(s.work ? { work: s.work } : {}) }); }
    total += addToDeck(name, songs.map((s) => ({ ...s })));
  }
  saveDecks();
  store('starterLoaded', true);
  store('starterVersion', window.STARTER_VERSION || 1);
  return total;
}
$('#deck-starter').addEventListener('click', () => {
  const n = loadStarter();
  alert(n ? `Aggiunte ${n} canzoni dai mazzi di base.` : 'I mazzi di base sono già tutti presenti.');
});

