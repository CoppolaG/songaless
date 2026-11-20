'use strict';
/* Gioco: modalità "stesso schermo", stanze online (PeerJS), canzoni segnate.
   Usa da app.js: $, $$, esc, store, shuffle, dz, toSong, norm, player, decks, activePool, basePool,
   filteredPool, renderFilters, renderDecks, loadStarter, addToDeck, spHandleRedirect, spRender, enrichAll.
   Le animazioni stanno in fx.js (window.fx), usato solo se presente. */

let mode = 'local'; // 'local' | 'online'
const FX = (name, ...args) => window.fx?.[name]?.(...args);

function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg; t.classList.remove('hidden');
  FX('pop', t);
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add('hidden'), ms);
}

// confronto risposta: stesso id Deezer, oppure stesso titolo e artista (anche per titoli in giapponese)
const keyOf = (s) => norm(s) || String(s || '').toLowerCase().replace(/\s+/g, '');
/* ---- genere e "indovina l'opera" per film, cartoni e anime ---- */
const GENRE_INFO = {
  'Sigle cartoni': { label: '📺 Sigla di un cartone', cls: 'cartoon', ask: 'il cartone', of: 'del cartone', icon: '📺' },
  'Sigle anime': { label: '🇯🇵 Sigla anime', cls: 'anime', ask: "l'anime", of: "dell'anime", icon: '🇯🇵' },
  'Colonne sonore': { label: '🎬 Colonna sonora di un film', cls: 'film', ask: 'il film', of: 'del film', icon: '🎬' },
  "Film d'animazione": { label: "🏰 Film d'animazione", cls: 'film', ask: 'il film', of: 'del film', icon: '🏰' },
};
const genreInfo = (g) => GENRE_INFO[g] || { label: g ? `🎵 ${g}` : '', cls: '', ask: null, of: '', icon: '🎬' };
const workKey = (x) => keyOf(String(x || '').replace(/^(il|lo|la|i|gli|le|l'|the|un|una|uno)\s+/i, '').replace(/^l'/i, ''));
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}
// accetta anche piccoli errori di battitura ("naurto") e titoli quasi completi
function matchWork(guess, work) {
  const g = workKey(guess);
  if (g.length < 2) return false;
  return (work || []).some((w) => {
    const k = workKey(w);
    return k === g || (g.length >= 4 && k.includes(g) && g.length >= k.length * 0.5) || (k.length > 5 && lev(g, k) <= 2);
  });
}
// titoli proposti mentre si scrive: tutte le opere dei mazzi + titoli "esca", così la lista non svela la risposta
const DECOY_WORKS = ['Coco', 'Encanto', 'Oceania', 'Rapunzel', 'La bella e la bestia', 'Il libro della giungla', 'Mulan', 'Pocahontas', 'Hercules', 'Up', 'Cars',
  'Alla ricerca di Nemo', 'Inside Out', 'Gli Incredibili', 'Ratatouille', 'Madagascar', "L'era glaciale", 'Cattivissimo me', 'Kung Fu Panda', 'Star Wars',
  'Harry Potter', 'Il Signore degli Anelli', 'Jurassic Park', 'Grease', 'La La Land', 'Guardiani della Galassia', 'Avengers', 'Spider-Man', 'Batman',
  'Pirati dei Caraibi', 'Il gladiatore', 'Interstellar', 'Mission: Impossible', 'Footloose', 'Pretty Woman', 'Forrest Gump', 'Matrix', 'Il padrino',
  'Ken il guerriero', 'Holly e Benji', 'Lupin III', 'Candy Candy', "Jeeg Robot d'acciaio", 'Mazinga Z', 'Dragon Ball Z', 'Dragon Ball Super', 'Hunter x Hunter',
  'Bleach', 'Fairy Tail', 'Haikyu!!', 'Sword Art Online', 'Tokyo Revengers', 'Blue Lock', 'Frieren', 'Solo Leveling', 'Mob Psycho 100', 'Inuyasha',
  'Card Captor Sakura', 'Lamù', "L'incantevole Creamy", 'Hello! Spank', 'Remi', 'Dr. Slump e Arale', 'Gundam', "Le bizzarre avventure di JoJo", 'Yattaman',
  'Tom & Jerry', 'I Simpson', 'SpongeBob', 'Winx Club', 'W.I.T.C.H.', 'Totally Spies', 'Ben 10', 'Gormiti', 'Mila e Shiro 2', 'Lilo & Stitch', 'Zootropolis', 'Wish'];
function allWorks() {
  const m = new Map();
  for (const list of Object.values(decks)) for (const x of list) if (x.work?.length) m.set(workKey(x.work[0]), { title: x.work[0], alias: x.work });
  for (const d of DECOY_WORKS) if (!m.has(workKey(d))) m.set(workKey(d), { title: d, alias: [d] });
  return [...m.values()];
}

function isCorrect(pick, song) {
  if (!pick || !song) return false;
  if (song.work?.length) return pick.work != null && matchWork(pick.work, song.work);
  if (String(pick.id) === String(song.id)) return true;
  const t = keyOf(pick.title);
  return !!t && t === keyOf(song.title) && keyOf(pick.artist) === keyOf(song.artist);
}

/* ============ Navigazione ============ */
const currentScreen = () => $$('.screen').find((s) => !s.classList.contains('hidden'))?.id.replace('screen-', '');
function go(name, opts = {}) {
  if (name !== 'game') { player.stop(); if (R?.av) { R.av.destroy(); R.av = null; } }
  const el = $('#screen-' + name);
  $$('.screen').forEach((s) => s.classList.toggle('hidden', s !== el));
  if (name === 'setup') { renderSetup(); renderFilters(); }
  if (name === 'home') renderHome();
  if (name === 'settings') setSettingsTab(opts.tab || 'rules');
  if (name === 'saved') renderSaved();
  if (name === 'stats') renderStats();
  if (name === 'chars') { renderChars(); if (opts.who) { ceWho = opts.who; renderChars(); } }
  else if (typeof ceStage !== 'undefined' && ceStage) { ceStage.destroy(); ceStage = null; ceRag = null; }
  window.lenis ? window.lenis.scrollTo(0, { immediate: true }) : window.scrollTo(0, 0);
  FX('screenIn', el);
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (!b) return;
  if (currentScreen() === 'game' && !confirm('Uscire dalla partita in corso?')) return;
  if (currentScreen() === 'game' || currentScreen() === 'end') {
    hideReveal(true);
    if (net.role === 'guest') net.leave();
    if (mode === 'local') game = null;
  }
  go(b.dataset.go, { tab: b.dataset.tab });
});
$$('[data-mode]').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; go('setup'); }));

/* ============ Home ============ */
function renderHome() {
  const o = readOpts(false);
  $('#qt-rules').textContent = `${o.steps.length} durate · da ${o.steps[0]}s · ${o.rounds} round`;
  const n = Object.keys(decks).length;
  $('#qt-decks').textContent = `${n} mazz${n === 1 ? 'o' : 'i'} · ${activePool().length} canzoni`;
  const s = saved.length;
  $('#qt-saved').textContent = s ? `${s} canzon${s === 1 ? 'e' : 'i'}` : 'Ancora nessuna';
  const g = Object.values(stats).reduce((n, x) => n + x.songs, 0);
  $('#qt-stats').textContent = g ? `${g} canzoni giocate` : 'Gioca per vederle';
}

/* ============ Impostazioni: regole ============ */
function setSettingsTab(tab) {
  $$('.seg-tab').forEach((t) => t.classList.toggle('active', t.dataset.stab === tab));
  $$('.stab').forEach((p) => p.classList.toggle('hidden', p.dataset.stabPanel !== tab));
  const act = $(`.seg-tab[data-stab="${tab}"]`);
  const ind = $('.seg-ind');
  if (act) { ind.style.width = act.offsetWidth + 'px'; ind.style.transform = `translateX(${act.offsetLeft - 4}px)`; }
}
$$('.seg-tab').forEach((t) => t.addEventListener('click', () => { setSettingsTab(t.dataset.stab); FX('screenIn', $(`[data-stab-panel="${t.dataset.stab}"]`)); }));

const savedOpts = store('opts');
if (savedOpts) {
  if (savedOpts.rounds) $('#opt-rounds').value = savedOpts.rounds;
  if (savedOpts.songs) $('#opt-songs').value = savedOpts.songs;
  if (savedOpts.steps) $('#opt-steps').value = savedOpts.steps;
  if (savedOpts.start) $('#opt-start').value = savedOpts.start;
  if (savedOpts.time) $('#opt-time').value = savedOpts.time;
}
function readOpts(save = true) {
  let steps = $('#opt-steps').value.split(/[,;\s]+/).map(Number).filter((n) => n > 0 && n <= 29).sort((a, b) => a - b);
  if (!steps.length) steps = [0.1, 0.5, 1, 2, 4, 8, 15];
  const o = {
    rounds: Math.max(1, Math.min(50, +$('#opt-rounds').value || 5)),
    songs: Math.max(1, Math.min(100, +$('#opt-songs').value || 10)),
    steps, start: $('#opt-start').value, time: +$('#opt-time').value || 30,
  };
  if (save) store('opts', { ...o, steps: $('#opt-steps').value });
  return o;
}
$('#opt-sfx').value = store('sfx') === false ? 'off' : 'on';
$('#opt-sfx').addEventListener('change', (e) => { store('sfx', e.target.value === 'on'); toast('Impostazione salvata', 1200); });
$('#opt-gore').value = store('gore') || 'tanto';
$('#opt-gore').addEventListener('change', (e) => { store('gore', e.target.value); toast('Impostazione salvata', 1200); });
['#opt-rounds', '#opt-songs', '#opt-steps', '#opt-start', '#opt-time'].forEach((s) =>
  $(s).addEventListener('change', () => { readOpts(true); toast('Regole salvate', 1200); }));

/* ============ Giocatori già registrati ============ */
const DEFAULT_ROSTER = ['peppe', 'trazio', 'cava', 'gg', 'nicola', 'nasir'];
let roster = store('roster') || DEFAULT_ROSTER.slice();
let players = (store('players') || []).filter((p) => roster.includes(p));
const saveRoster = () => { store('roster', roster); store('players', players); };

function rosterChips(selected, removable) {
  return roster.map((n) => `<span class="chip toggle ${selected.includes(n) ? 'on' : ''}" data-name="${esc(n)}">${esc(n)}${removable ? `<span class="x" data-del="${esc(n)}" title="Togli dalla lista">✕</span>` : ''}</span>`).join('');
}
function renderPlayers() {
  $('#roster').innerHTML = rosterChips(players, true);
  renderSummary();
  if (typeof renderModes === 'function' && gmode !== 'classic') renderModes();
}
$('#roster').addEventListener('click', (e) => {
  const del = e.target.closest('[data-del]');
  if (del) {
    const n = del.dataset.del;
    if (!confirm(`Togliere "${n}" dalla lista dei giocatori?`)) return;
    roster = roster.filter((x) => x !== n); players = players.filter((x) => x !== n);
    saveRoster(); renderPlayers(); return;
  }
  const c = e.target.closest('[data-name]'); if (!c) return;
  const n = c.dataset.name;
  players = players.includes(n) ? players.filter((x) => x !== n) : [...players, n];
  saveRoster(); renderPlayers();
  FX('pop', $(`#roster [data-name="${CSS.escape(n)}"]`));
});
$('#player-add').addEventListener('click', () => {
  const n = $('#player-name').value.trim().slice(0, 20);
  if (!n) return;
  if (!roster.some((x) => x.toLowerCase() === n.toLowerCase())) roster.push(n);
  const real = roster.find((x) => x.toLowerCase() === n.toLowerCase());
  if (!players.includes(real)) players.push(real);
  $('#player-name').value = ''; saveRoster(); renderPlayers();
});
$('#player-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#player-add').click(); });

// scelta rapida del proprio nome (host e chi entra dal link)
function bindNamePicker(listSel, inputSel) {
  $(listSel).addEventListener('click', (e) => {
    const c = e.target.closest('[data-name]'); if (!c) return;
    $(inputSel).value = c.dataset.name;
    $$(`${listSel} .chip`).forEach((x) => x.classList.toggle('on', x === c));
  });
  $(inputSel).addEventListener('input', () => $$(`${listSel} .chip`).forEach((x) => x.classList.toggle('on', x.dataset.name === $(inputSel).value.trim())));
}
bindNamePicker('#host-roster', '#host-name');
bindNamePicker('#join-roster', '#join-name');

/* ============ Preparazione partita ============ */
function renderSetup() {
  const online = mode === 'online';
  $('#setup-title').textContent = online ? 'Partita online' : 'Stesso schermo';
  $('#setup-local').classList.toggle('hidden', online);
  $('#setup-online').classList.toggle('hidden', !online);
  const me = $('#host-name').value || store('myName') || '';
  $('#host-name').value = me;
  $('#host-roster').innerHTML = rosterChips([me], false);
  renderPlayers(); renderRoom(); renderModes();
}
function renderSummary() {
  const o = readOpts(false);
  let who;
  if (mode === 'online') who = net.role === 'host' ? `${net.players.size} in stanza · ${o.songs} canzoni` : 'crea la stanza';
  else if (typeof gmode !== 'undefined' && gmode === 'classic') who = '🎶 tutti insieme, una canzone dopo l\'altra';
  else who = players.length ? `${players.length} giocator${players.length === 1 ? 'e' : 'i'} · ${o.rounds} round a testa` : 'scegli chi gioca';
  $('#setup-summary').textContent = who;
}

/* ============ Modalità sfida: ognuno sceglie un artista o un genere ============ */
let gmode = store('gmode') || 'classic'; // classic | shared | own
let picksText = store('picks') || {};
const participants = () => (mode === 'online' ? (net.role === 'host' ? [...net.players.values()].map((p) => p.name) : []) : players.slice());
const bucketLabel = (b) => `${b.icon} ${b.name}`;
function parsePick(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  const k = norm(t.replace(/^\p{Extended_Pictographic}\s*/u, ''));
  const b = BUCKETS.find((x) => norm(x.name) === k || norm(bucketLabel(x)) === norm(t) || norm(x.name).split(' ')[0] === k);
  if (b) return { type: 'bucket', id: b.id, label: bucketLabel(b) };
  return { type: 'artist', name: t.slice(0, 60), label: `👤 ${t.slice(0, 60)}` };
}
function renderModes() {
  $$('.gmode').forEach((b) => b.classList.toggle('on', b.dataset.gmode === gmode));
  $('#setup-local').classList.toggle('hidden', mode === 'online' || gmode === 'classic');
  $$('#s-atype [data-atype]').forEach((b) => b.classList.toggle('on', b.dataset.atype === atype));
  $('#buzz-opt').classList.toggle('hidden', mode !== 'online' || gmode === 'own');
  $('#opt-buzzer').checked = store('buzzer') === true;
  const ch = gmode !== 'classic';
  $('#setup-cat').classList.toggle('hidden', ch);
  $('#picks').classList.toggle('hidden', !ch);
  if (!ch) return;
  // suggerimenti: generi e artisti presenti nei mazzi (i più numerosi prima)
  const arts = new Map();
  for (const s of Object.values(decks).flat()) arts.set(s.artist, (arts.get(s.artist) || 0) + 1);
  $('#pick-list').innerHTML = BUCKETS.map((b) => `<option value="${esc(bucketLabel(b))}">`).join('')
    + [...arts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 400).map(([a]) => `<option value="${esc(a)}">`).join('');
  const who = participants();
  $('#picks').innerHTML = who.length
    ? who.map((n) => `<div class="pick-row">${Ragdoll.portrait(lookByName(n), 30)}<b>${esc(n)}</b><input data-pick-for="${esc(n)}" list="pick-list" placeholder="Artista o genere (es. Drake, 🎤 Rap / Hip Hop)" value="${esc(picksText[n] || '')}"></div>`).join('')
      + '<p class="muted small">Per un artista uso le sue canzoni nei mazzi più le sue più famose su Deezer, quindi vanno bene anche artisti che non sono nei mazzi.</p>'
    : `<p class="muted small">${mode === 'online' ? 'Crea la stanza: qui compariranno i giocatori, e tu scegli per ognuno.' : 'Prima tocca i nomi di chi gioca.'}</p>`;
}
$$('.gmode').forEach((b) => b.addEventListener('click', () => { gmode = b.dataset.gmode; store('gmode', gmode); renderModes(); renderSummary(); }));
$('#picks').addEventListener('input', (e) => {
  const n = e.target.dataset.pickFor; if (!n) return;
  picksText[n] = e.target.value; store('picks', picksText);
});

// canzoni per una scelta: dai mazzi + (per un artista) le sue più famose su Deezer
const NOT_ORIGINAL = /\blive\b|remix|acoustic|instrumental|karaoke|sped up|slowed|versione/i;
async function pickPool(pick) {
  const out = []; const seen = new Set();
  const add = (s) => { const k = `${norm(s.title)}|${norm(s.artist)}`; if (!s.id || seen.has(String(s.id)) || seen.has(k)) return; seen.add(String(s.id)); seen.add(k); out.push(s); };
  const everything = Object.values(decks).flat();
  if (pick.type === 'bucket') { everything.filter((s) => bucketOf(s) === pick.id).forEach(add); return out; }
  const a = norm(pick.name);
  everything.filter((s) => { const sa = norm(s.artist); return sa === a || (a.length > 3 && sa.includes(a)); }).forEach(add);
  try {
    const r = await dz('search/artist', { q: pick.name, limit: 10 });
    const exact = (r.data || []).filter((x) => norm(x.name) === a);
    const art = (exact.length ? exact : (r.data || []).slice(0, 1)).sort((x, y) => (y.nb_fan || 0) - (x.nb_fan || 0))[0];
    if (art) {
      const top = await dz(`artist/${art.id}/top`, { limit: 50 });
      (top.data || []).filter((t) => t.readable !== false && !NOT_ORIGINAL.test(t.title)).map(toSong).forEach(add);
    }
  } catch { /* basta quello che c'è nei mazzi */ }
  return out;
}
// prepara la sfida: null se manca qualcosa (e lo spiega)
async function buildChallenge() {
  const who = participants();
  const picks = {}; const pools = {};
  for (const n of who) {
    const p = parsePick(picksText[n]);
    if (!p) { alert(`${n} deve scegliere un artista o un genere.`); return null; }
    picks[n] = p;
  }
  $('#game-start').disabled = true; $('#game-start').textContent = 'Preparo la sfida…';
  try {
    for (const n of who) pools[n] = await pickPool(picks[n]);
  } finally { $('#game-start').disabled = false; $('#game-start').textContent = 'Inizia la partita'; }
  const poor = who.filter((n) => pools[n].length < 3);
  if (poor.length) { alert(`Troppo poche canzoni per: ${poor.map((n) => `${n} (${picks[n].label})`).join(', ')}. Prova un'altra scelta.`); return null; }
  let shared = null;
  if (gmode === 'shared') {
    const seen = new Set(); shared = [];
    for (const n of who) for (const s of pools[n]) if (!seen.has(String(s.id))) { seen.add(String(s.id)); shared.push(s); }
  }
  return { gmode, picks, pools, shared };
}

$('#game-start').addEventListener('click', async () => {
  const o = readOpts();
  player.ctx = player.ctx || new AudioContext(); // sbloccato da questo clic
  player.ctx.resume();
  if (mode === 'local' && gmode !== 'classic' && !players.length) { alert('Tocca i nomi di chi gioca.'); return; }
  if (mode === 'online' && net.role !== 'host') { alert('Prima crea la stanza.'); return; }
  let ch = null;
  if (gmode === 'classic') {
    if (!basePool().length) { alert('Non ci sono canzoni: aggiungi o spunta un mazzo.'); go('settings', { tab: 'decks' }); return; }
    if (!filteredPool().length) { alert('Nessuna canzone corrisponde a categoria e filtri: allargali un po\'.'); return; }
  } else {
    ch = await buildChallenge();
    if (!ch) return;
  }
  if (mode === 'local') localStart(o, ch); else hostStart(o, ch);
});

// sceglie una canzone con anteprima disponibile (l'URL dell'anteprima scade: lo chiediamo fresco)
async function pickSong(state) {
  for (let attempt = 0; attempt < 6; attempt++) {
    if (!state.queue.length) state.queue = shuffle(state.pool);
    const song = state.queue.pop();
    try {
      const t = await dz(`track/${song.id}`);
      if (t.preview) return { ...song, ...toSong(t), title: song.title, artist: song.artist, year: song.year, genres: song.genres, preview: t.preview };
    } catch { /* non disponibile: ne provo un'altra */ }
  }
  throw new Error('Non riesco a caricare canzoni. Controlla la connessione.');
}

/* ============ Round: interfaccia comune ============ */
let R = null; // round di chi gioca su questo dispositivo

// barra del tempo continua: le tacche sono le durate, distanziate con la radice quadrata così si vedono anche 0,1 e 0,5 s
const tlPos = (t) => Math.sqrt(Math.max(0, t) / R.steps[R.steps.length - 1]) * 100;
const tlFmt = (t) => `${String(+t.toFixed(2)).replace('.', ',')} s`;
function renderSteps() {
  const box = $('#g-steps');
  if (box.dataset.round !== String(R.id)) { // costruita una volta per round, poi solo aggiornata (così le transizioni restano fluide)
    box.dataset.round = String(R.id);
    box.innerHTML = `<div class="tl">
      <div class="tl-track">
        <div class="tl-unlocked"></div><div class="tl-fill"></div>
        ${R.steps.map((t, i) => `<span class="tl-tick" data-i="${i}" style="left:${tlPos(t)}%"></span>`).join('')}
        <span class="tl-head"></span>
      </div>
      <div class="tl-labels">${R.steps.map((t, i) => `<span data-i="${i}" style="left:${tlPos(t)}%">${tlFmt(t)}</span>`).join('')}</div>
    </div>`;
  }
  const cur = R.done ? R.steps[R.steps.length - 1] : R.steps[R.step];
  box.querySelector('.tl-unlocked').style.width = `${tlPos(cur)}%`;
  box.querySelectorAll('.tl-tick, .tl-labels span').forEach((el) => {
    const i = +el.dataset.i;
    el.classList.toggle('done', R.done || i < R.step);
    el.classList.toggle('current', !R.done && i === R.step);
  });
  const last = R.step >= R.steps.length - 1;
  $('#g-skip').textContent = last ? 'Salta' : `Salta (+${+(R.steps[R.step + 1] - R.steps[R.step]).toFixed(2)}s)`;
  $('#g-skip').disabled = last || R.done;
  $('#g-play-label').innerHTML = R.done ? '' : `Ascolta <b>${R.steps[R.step]} s</b>`;
  renderHints();
}

function renderAttempts() {
  $('#g-attempts').innerHTML = R.steps.map((s, i) => {
    const a = R.attempts[i];
    if (!a) return `<li><span class="t">${s}s</span></li>`;
    const ico = a.type === 'right' ? '✓' : a.type === 'wrong' ? '✗' : '⏭';
    return `<li class="${a.type}"><span class="t">${s}s</span><span class="ico">${ico}</span><span>${esc(a.text)}</span></li>`;
  }).join('');
}

// cont = true: riparte da dove si era fermato e suona solo il pezzo nuovo
function playSnippet(cont = false) {
  if (!R || R.done || $('#g-play').disabled) return;
  const from = cont === true && R.step > 0 ? R.steps[R.step - 1] : 0;
  const dur = R.steps[R.step] - from;
  const btn = $('#g-play');
  btn.classList.add('playing');
  FX('punch', btn);
  const stop = animateTimeline(from, from + dur);
  player.play(R.offset + from, dur, () => { btn.classList.remove('playing'); stop(); });
}
$('#g-play').addEventListener('click', playSnippet);

// cursore che scorre sulla barra mentre suona (da "from" a "to" secondi)
let tlRaf = null;
function animateTimeline(from, to) {
  cancelAnimationFrame(tlRaf);
  const fill = $('#g-steps .tl-fill'); const head = $('#g-steps .tl-head');
  if (!fill || !head) return () => {};
  const t0 = performance.now() + 30; // il suono parte 30 ms dopo
  head.classList.add('on');
  const set = (t) => { fill.style.width = `${tlPos(t)}%`; head.style.left = `${tlPos(t)}%`; };
  set(from);
  const step = (now) => {
    const t = Math.min(to, from + Math.max(0, now - t0) / 1000);
    set(t);
    if (t < to) tlRaf = requestAnimationFrame(step);
  };
  tlRaf = requestAnimationFrame(step);
  return () => { cancelAnimationFrame(tlRaf); set(to); head.classList.remove('on'); };
}

function setFeedback(msg, cls = '') {
  const f = $('#g-feedback'); f.textContent = msg; f.className = 'feedback ' + cls;
}

async function startRoundUI({ label, turn, who, streak = 0, steps, offset, preview, time, genre = '', workMode = false, atype: at = 'title', hints = null, buzzer = false }) {
  clearInterval(roundTimer);
  hideReveal(true);
  const prevAv = R?.av;
  const gi = genreInfo(genre);
  R = { id: (R?.id || 0) + 1, steps, step: 0, offset, done: false, attempts: [], hits: 0, who, av: prevAv, workMode: workMode && at === 'title', gi, atype: at, hints, buzzer, holding: false, buzzLocked: false };
  clearInterval(buzzTick);
  if (currentScreen() !== 'game') go('game');
  $('#g-round').textContent = label;
  $('#g-turn').textContent = turn || '';
  $('#g-genre').textContent = gi.label;
  $('#g-genre').className = 'genre-pill ' + gi.cls;
  setAnswerUI();
  FX('pop', $('#g-genre'));
  if (R.av) R.av.destroy?.();
  R.av = null; R.rag = null;
  if (who && Ragdoll.available) { R.av = Ragdoll.stage($('#g-avatar'), { w: 150, h: 175 }); R.rag = Ragdoll.addRag(R.av, lookByName(who), 75, 1); }
  else $('#g-avatar').innerHTML = who ? Ragdoll.portrait(lookByName(who), 80) : '';
  $('#g-streak').textContent = `🔥 ${streak}`;
  $('#g-streak').classList.toggle('hidden', streak < 2);
  FX('pop', $('#g-avatar'));
  $('#g-guess-area').classList.remove('hidden');
  $('#g-guess').value = ''; hideSuggest(); setAnswerUI();
  $('#g-play').disabled = true;
  setFeedback('Carico la canzone…');
  renderSteps(); renderAttempts();
  FX('roundIn');
  if (time) startTimer(time); else $('#g-timer').classList.add('hidden');
  try {
    await player.load(preview);
    if (R.offset < 0) R.offset = Math.random() * Math.max(0, player.duration - steps[steps.length - 1] - 0.5);
    $('#g-play').disabled = false;
    setFeedback(player.precise ? '' : 'Riproduzione in modalità meno precisa');
    if (!R.buzzer) $('#g-guess').focus({ preventScroll: true });
    else setFeedback('Ascolta e premi 🔔 quando la sai!');
  } catch { setFeedback('⚠️ Anteprima non disponibile', 'bad'); }
}

let roundTimer = null;
function startTimer(sec) {
  const end = Date.now() + sec * 1000;
  const el = $('#g-timer');
  el.classList.remove('hidden', 'low');
  const tick = () => {
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    el.textContent = `${left}s`;
    el.classList.toggle('low', left <= 5);
    if (left <= 0) {
      clearInterval(roundTimer);
      if (R && !R.done) { R.done = true; lockRound(); setFeedback('⏱️ Tempo scaduto · aspetta gli altri…', 'bad'); renderSteps(); }
    }
  };
  tick();
  roundTimer = setInterval(tick, 250);
}
function lockRound() { $('#g-guess-area').classList.add('hidden'); hideSuggest(); }

// risposta (giudice locale o host) a un tentativo
function handleVerdict(v) {
  if (!R || R.done) return;
  const label = v.kind === 'guess' ? v.title : v.kind === 'skip' ? 'Saltato' : v.kind === 'timeout' ? 'Tempo scaduto' : 'Mi arrendo';
  const dirTxt = v.dir ? (v.dir === 'up' ? ' · 📈 più recente' : ' · 📉 più vecchia') : '';
  R.holding = false; clearInterval(buzzTick);
  R.attempts[R.step] = { type: v.ok ? 'right' : v.kind === 'guess' ? 'wrong' : 'skip', text: label };
  if (!v.ok && v.kind !== 'giveup') { R.hits++; Ragdoll.damage(R.rag, R.hits); } // perde un pezzo
  if (v.ok) {
    R.done = true;
    setFeedback(`${v.exact ? '🎯 Anno esatto!' : '✓ Indovinata'} in ${R.steps[R.step]} s! +${v.pts}`, 'ok');
  } else if (v.done) {
    R.done = true;
    setFeedback(v.kind === 'giveup' ? 'Ti sei arreso' : v.kind === 'timeout' ? '⏱️ Tempo scaduto: sei fuori per questa canzone' : v.out ? `✗ Non è "${v.title}"${dirTxt}: sei fuori per questa canzone` : `Tentativi finiti${dirTxt}`, 'bad');
  } else {
    R.step = v.step;
    setFeedback(v.kind === 'guess' ? `✗ Non è "${v.title}"${dirTxt}` : '', 'bad');
    setAnswerUI();
    if (v.kind === 'guess') FX('shake', $('#g-guess'));
  }
  renderSteps(); renderAttempts();
  FX('attemptIn', $$('#g-attempts li')[R.attempts.length - 1]);
  if (R.done) {
    lockRound();
    if (mode === 'online') $('#g-feedback').textContent += ' · aspetta gli altri…';
  } else {
    setTimeout(() => playSnippet(true), 380); // sbagliato o saltato: continua da dove si era fermato
  }
}

function act(msg) {
  if (!R || R.done || R.spectator) return;
  if (mode === 'local') localHandle(msg);
  else if (net.role === 'host') hostHandle('host', msg);
  else net.send(msg);
}
$('#g-skip').addEventListener('click', () => act({ t: 'skip' }));
$('#g-giveup').addEventListener('click', () => act({ t: 'giveup' }));
function guess(pick) {
  hideSuggest(); $('#g-guess').value = '';
  let p;
  if (pick.year != null) p = { year: String(pick.year).slice(0, 4) };
  else if (pick.artistName != null) p = { artistName: String(pick.artistName).slice(0, 80) };
  else if (pick.work != null) p = { work: String(pick.work).slice(0, 120) };
  else p = { id: pick.id, title: pick.title, artist: pick.artist };
  act({ t: 'guess', pick: p });
}

function renderScores(list, el = $('#g-scores')) {
  el.innerHTML = [...list].sort((a, b) => b.score - a.score)
    .map((p) => `<li data-name="${esc(p.name)}"><span class="mini-av">${Ragdoll.portrait(lookByName(p.name), 22)}</span>${esc(p.name)}${p.streak >= 2 ? `<em class="fire">🔥${p.streak}</em>` : ''}<span data-score="${p.score}">${p.score}</span></li>`).join('');
  FX('countScores', el);
}

// aspetto di un giocatore: online quello arrivato dalla stanza, altrimenti quello salvato su questo dispositivo
const lookByName = (name) => (mode === 'online' && net.looks[name] ? net.looks[name] : Chars.lookFor(name));

/* ============ Statistiche personali ============ */
const CAT_NAMES = Object.fromEntries(CATEGORIES.map((c) => [c.id, `${c.icon} ${c.name}`]));
const catIdNow = () => CATEGORIES.find((c) => sameFilters(filters, catFilters(c)))?.id || 'custom';
let stats = store('stats') || {};
const statOf = (name) => {
  const k = String(name).toLowerCase();
  return (stats[k] = stats[k] || { name, games: 0, wins: 0, songs: 0, correct: 0, sumT: 0, fastest: null, bestStreak: 0, cats: {}, deaths: {} });
};
const saveStats = () => store('stats', stats);
function recordRound(name, { ok, t, song, cat, streak }) {
  const s = statOf(name);
  s.songs++;
  const c = (s.cats[cat] = s.cats[cat] || { songs: 0, correct: 0 });
  c.songs++;
  if (ok) {
    s.correct++; c.correct++; s.sumT += t;
    if (!s.fastest || t < s.fastest.t) s.fastest = { t, title: song.title, artist: song.artist };
  }
  s.bestStreak = Math.max(s.bestStreak, streak || 0);
  saveStats();
}
function recordDeath(name, type) { const s = statOf(name); s.deaths[type] = (s.deaths[type] || 0) + 1; saveStats(); }
function recordGame(name, won) { const s = statOf(name); s.games++; if (won) s.wins++; saveStats(); }

function renderStats() {
  const names = [...new Set([...roster.map((n) => n.toLowerCase()), ...Object.keys(stats)])];
  $('#stats-list').innerHTML = names.map((k) => {
    const s = stats[k] || { name: roster.find((n) => n.toLowerCase() === k) || k, games: 0, wins: 0, songs: 0, correct: 0, sumT: 0, fastest: null, bestStreak: 0, cats: {}, deaths: {} };
    const acc = s.songs ? Math.round((s.correct / s.songs) * 100) : 0;
    const avg = s.correct ? (s.sumT / s.correct).toFixed(1) : '–';
    const best = Object.entries(s.cats).filter(([, c]) => c.songs >= 3).sort((a, b) => b[1].correct / b[1].songs - a[1].correct / a[1].songs)[0];
    const deaths = Object.values(s.deaths).reduce((a, b) => a + b, 0);
    const favDeath = Object.entries(s.deaths).sort((a, b) => b[1] - a[1])[0];
    return `<div class="stat-card spot">
      <div class="stat-head">${Ragdoll.portrait(Chars.lookFor(s.name), 56)}<div><h3>${esc(s.name)}</h3><span class="muted small">${s.games} partite · ${s.wins} vinte</span></div>
        <button class="reroll" data-editchar="${esc(s.name)}" title="Modifica personaggio e faccia">✏️</button></div>
      <div class="stat-nums">
        <div><b>${acc}%</b><span>indovinate</span></div>
        <div><b>${avg}${s.correct ? 's' : ''}</b><span>tempo medio</span></div>
        <div><b>🔥${s.bestStreak}</b><span>serie record</span></div>
      </div>
      <ul class="stat-more">
        <li>Canzoni giocate: <b>${s.songs}</b> · indovinate: <b>${s.correct}</b></li>
        ${s.fastest ? `<li>Più veloce: <b>${esc(s.fastest.title)}</b> in <b>${s.fastest.t}s</b></li>` : ''}
        ${best ? `<li>Categoria migliore: <b>${esc(CAT_NAMES[best[0]] || 'Personalizzata')}</b> (${Math.round((best[1].correct / best[1].songs) * 100)}%)</li>` : ''}
        <li>Morti: <b>💀 ${deaths}</b>${favDeath ? ` · più spesso <b>${esc(Ragdoll.SHORT[favDeath[0]] || favDeath[0])}</b>` : ''}</li>
      </ul>
    </div>`;
  }).join('') || '<div class="empty">Ancora nessuna statistica: gioca una partita!</div>';
  FX('stagger', $$('#stats-list > *'));
}
$('#stats-list').addEventListener('click', (e) => {
  const ed = e.target.closest('[data-editchar]');
  if (ed) { go('chars', { who: ed.dataset.editchar }); return; }
  const b = e.target.closest('[data-reroll]'); if (!b) return;
  Chars.setLook(b.dataset.reroll, Chars.randomLook(Chars.lookFor(b.dataset.reroll)));
  renderStats();
});
let photoFor = null;
$('#stats-list').addEventListener('click', (e) => {
  const p = e.target.closest('[data-photo]');
  if (p) { photoFor = p.dataset.photo; $('#photo-file').click(); return; }
  const n = e.target.closest('[data-nophoto]');
  if (n) { const l = Chars.lookFor(n.dataset.nophoto); delete l.photo; Chars.setLook(n.dataset.nophoto, l); renderStats(); }
});
$('#photo-file').addEventListener('change', async (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f || !photoFor) return;
  try { const photo = await Chars.photoFromFile(f); Chars.setLook(photoFor, { ...Chars.lookFor(photoFor), photo }); renderStats(); toast('Faccia aggiornata 📷'); }
  catch { toast('Non riesco a leggere questa immagine'); }
});
$('#stats-reset').addEventListener('click', () => {
  if (!confirm('Azzerare tutte le statistiche?')) return;
  stats = {}; saveStats(); renderStats();
});

/* ============ Rivelazione con animazione ============ */
let revealSong = null; let revealRaf = null; let revealStage = null;
// actors: [{ name, look, ok, hits, record }] → i personaggini sul palco (vivi che ballano, gli altri fatti fuori)
function showReveal(song, { ok, text, results = null, canNext = true, nextLabel = 'Prossima canzone', actors = [], streak = 0 }) {
  if (R) R.done = true;
  lockRound(); clearInterval(roundTimer); $('#g-timer').classList.add('hidden');
  revealSong = song;
  $('#rv-result').textContent = text;
  $('#rv-result').className = 'rv-result ' + (ok ? 'ok' : 'bad');
  revealStage?.destroy();
  revealStage = null;
  const rags = [];
  $('#rv-stage').classList.toggle('hidden', !actors.length);
  if (actors.length && Ragdoll.available) {
    const W = Math.max(260, Math.min(376, innerWidth - 76));
    const sc = actors.length > 4 ? 0.62 : actors.length > 2 ? 0.75 : 0.95;
    revealStage = Ragdoll.stage($('#rv-stage'), { w: W, h: 200 });
    actors.forEach((a, i) => rags.push(Ragdoll.addRag(revealStage, a.look || lookByName(a.name), (W / (actors.length + 1)) * (i + 1), sc, Math.min(8, a.hits || 0))));
    if (actors.length > 1) $('#rv-stage').insertAdjacentHTML('beforeend', `<div class="stage-names">${actors.map((a) => `<span>${esc(a.name)}</span>`).join('')}</div>`);
  }
  const cap = $('#rv-caption');
  cap.textContent = streak >= 2 && ok ? `🔥 Serie di ${streak} di fila!` : '';
  cap.className = 'rv-caption good';
  setTimeout(() => {
    const deathsTxt = [];
    actors.forEach((a, i) => {
      const rg = rags[i];
      if (a.ok) { Ragdoll.dance(rg); return; }
      const type = Ragdoll.kill(rg);
      if (a.record) recordDeath(a.name, type);
      deathsTxt.push(`${a.name} ${Ragdoll.LABEL[type]}`);
    });
    if (deathsTxt.length) {
      cap.className = 'rv-caption';
      cap.textContent = actors.length === 1 ? `💀 ${deathsTxt[0]}` : `💀 ${deathsTxt.length === 1 ? deathsTxt[0] : `${deathsTxt.length} vittime`}`;
    }
    if (ok && streak >= 3) FX('fire');
  }, 650);
  $('#rv-cover').src = song.cover || '';
  const work = Array.isArray(song.work) && song.work.length ? String(song.work[0]) : '';
  $('#rv-title').textContent = work || song.title;
  $('#rv-artist').textContent = work ? `“${song.title}” · ${song.artist}${song.year ? ' · ' + song.year : ''}` : `${song.artist}${song.year ? ' · ' + song.year : ''}`;
  $('#rv-results').classList.toggle('hidden', !results);
  if (results) {
    $('#rv-results').innerHTML = results.map((r) =>
      `<li><span>${esc(r.name)}</span>${r.ok ? `<span class="ok">${r.t}s · +${r.pts}</span>` : '<span class="no">—</span>'}</li>`).join('');
  }
  $('#rv-next').disabled = !canNext;
  $('#rv-next').textContent = nextLabel;
  updateSaveBtn();
  $('#reveal').classList.remove('hidden');
  window.lenis?.stop();
  FX('revealIn', ok);
  // si sente la canzone dall'inizio dell'anteprima
  player.stop();
  const dur = Math.max(1, player.duration - 0.2);
  const disc = $('.rv-disc'); disc.classList.add('spinning');
  const bar = $('#rv-bar'); const t0 = performance.now();
  player.play(0, dur, () => disc.classList.remove('spinning'));
  cancelAnimationFrame(revealRaf);
  const step = (t) => {
    const p = Math.min(1, (t - t0) / (dur * 1000));
    bar.style.width = (p * 100) + '%';
    if (p < 1 && !$('#reveal').classList.contains('hidden')) revealRaf = requestAnimationFrame(step);
  };
  revealRaf = requestAnimationFrame(step);
}
function hideReveal(instant) {
  if ($('#reveal').classList.contains('hidden')) return;
  const old = revealStage; revealStage = null; // distruggiamo solo questo palco, non quello della prossima rivelazione
  setTimeout(() => old?.destroy(), instant ? 0 : 400);
  cancelAnimationFrame(revealRaf);
  player.stop();
  window.lenis?.start();
  if (instant || !window.fx) { $('#reveal').classList.add('hidden'); return; }
  FX('revealOut', () => $('#reveal').classList.add('hidden'));
}
$('#rv-next').addEventListener('click', () => {
  if (mode === 'local' && game) { hideReveal(); localNextRound(); }
  else if (mode === 'online' && net.role === 'host') hostNext();
});

/* ============ Canzoni segnate ============ */
let saved = store('saved') || [];
const isSaved = (id) => saved.some((s) => String(s.id) === String(id));
function toggleSaved(song) {
  if (isSaved(song.id)) saved = saved.filter((s) => String(s.id) !== String(song.id));
  else saved.unshift({ id: song.id, title: song.title, artist: song.artist, cover: song.cover, year: song.year || null, at: Date.now() });
  store('saved', saved);
  updateBadge();
}
function updateSaveBtn() {
  const on = revealSong && isSaved(revealSong.id);
  $('#rv-save').textContent = on ? '★ Segnata' : '☆ Segna';
  $('#rv-save').classList.toggle('saved', !!on);
}
$('#rv-save').addEventListener('click', () => {
  if (!revealSong) return;
  toggleSaved(revealSong); updateSaveBtn();
  if (isSaved(revealSong.id)) { toast('Aggiunta alle canzoni segnate ⭐'); FX('starBurst', $('#rv-save')); }
});
function updateBadge() {
  const b = $('#saved-badge');
  b.textContent = saved.length; b.classList.toggle('hidden', !saved.length);
}
const spotifyLink = (s) => `https://open.spotify.com/search/${encodeURIComponent(`${s.title} ${s.artist}`)}`;
const youtubeLink = (s) => `https://www.youtube.com/results?search_query=${encodeURIComponent(`${s.artist} ${s.title}`)}`;
function renderSaved() {
  $('#saved-list').innerHTML = saved.length ? saved.map((s) => `
    <div class="saved-card" data-id="${s.id}">
      <div class="cover"><img src="${esc(s.cover)}" alt="" loading="lazy"><button class="sc-play" data-play="${s.id}" aria-label="Ascolta">▶</button></div>
      <div><div class="t">${esc(s.title)}</div><div class="a">${esc(s.artist)}${s.year ? ' · ' + s.year : ''}</div></div>
      <div class="links">
        <a href="${spotifyLink(s)}" target="_blank" rel="noopener">Spotify</a>
        <a href="https://www.deezer.com/track/${encodeURIComponent(s.id)}" target="_blank" rel="noopener">Deezer</a>
        <a href="${youtubeLink(s)}" target="_blank" rel="noopener">YouTube</a>
        <button data-unsave="${s.id}">Togli</button>
      </div>
    </div>`).join('') : '<div class="empty">Ancora nessuna canzone segnata.<br>Durante le partite premi <b>☆ Segna</b> quando esce una canzone che ti piace.</div>';
  FX('stagger', $$('#saved-list > *'));
}
let savedPlaying = null;
$('#saved-list').addEventListener('click', async (e) => {
  const un = e.target.closest('[data-unsave]');
  if (un) { saved = saved.filter((s) => String(s.id) !== un.dataset.unsave); store('saved', saved); updateBadge(); renderSaved(); return; }
  const pl = e.target.closest('[data-play]');
  if (!pl) return;
  if (savedPlaying === pl.dataset.play) { player.stop(); savedPlaying = null; pl.textContent = '▶'; return; }
  $$('.sc-play').forEach((b) => { b.textContent = '▶'; });
  pl.textContent = '…';
  try {
    player.ctx = player.ctx || new AudioContext(); player.ctx.resume();
    const t = await dz(`track/${pl.dataset.play}`);
    await player.load(t.preview);
    savedPlaying = pl.dataset.play; pl.textContent = '❚❚';
    player.play(0, player.duration - 0.2, () => { if (savedPlaying === pl.dataset.play) { savedPlaying = null; pl.textContent = '▶'; } });
  } catch { pl.textContent = '▶'; toast('Anteprima non disponibile'); }
});
$('#saved-copy').addEventListener('click', async () => {
  const text = saved.map((s) => `${s.artist} - ${s.title}`).join('\n');
  try { await navigator.clipboard.writeText(text); toast('Elenco copiato: incollalo dove vuoi'); } catch { prompt('Copia l\'elenco:', text); }
});
$('#saved-deck').addEventListener('click', () => {
  if (!saved.length) return;
  const n = addToDeck('Canzoni segnate', saved.map((s) => ({ id: s.id, title: s.title, artist: s.artist, cover: s.cover, year: s.year })));
  toast(n ? `Mazzo "Canzoni segnate": +${n} canzoni` : 'Sono già tutte nel mazzo "Canzoni segnate"');
});
$('#saved-clear').addEventListener('click', () => {
  if (!saved.length || !confirm('Svuotare le canzoni segnate?')) return;
  saved = []; store('saved', saved); updateBadge(); renderSaved();
});

let lastEnd = null;
const lookOf = (p) => lookByName(p.name);
function showEnd(scores, history, canRestart, title = null) {
  player.stop(); clearInterval(roundTimer); hideReveal(true);
  go('end');
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  lastEnd = { sorted };
  const best = sorted[0]?.score || 0;
  const tied = sorted.filter((p) => p.score === best);
  $('#end-winner').textContent = title || !sorted.length ? (title || 'Fine') : best === 0 ? '😶 Nessuno ha fatto punti' : tied.length > 1 ? `🤝 Pareggio tra ${tied.map((p) => p.name).join(' e ')}!` : `🏆 Vince ${sorted[0].name}!`;
  // podio: secondo, primo, terzo
  $('#podium').innerHTML = [1, 0, 2].map((i) => {
    const p = sorted[i];
    if (!p) return `<div class="pod p${i + 1} empty"></div>`;
    return `<div class="pod p${i + 1}">
      ${i === 0 ? '<span class="crown">👑</span>' : ''}
      ${Ragdoll.portrait(lookOf(p), i === 0 ? 76 : 60)}
      <span class="who">${esc(p.name)}</span><span class="pts">${p.score} punti</span>
      <div class="step">${i + 1}</div></div>`;
  }).join('');
  const rest = sorted.slice(3);
  $('#end-scores').classList.toggle('hidden', !rest.length);
  renderScores(rest, $('#end-scores'));
  $('#end-scores').style.counterReset = 'pos 3';
  $('#end-history').innerHTML = history.map((h) => `<li>${esc(h.artist)} – ${esc(h.title)}${h.note ? ` <em>(${esc(h.note)})</em>` : ''}</li>`).join('');
  $('#end-again').classList.toggle('hidden', !canRestart);
  $('#end-wait').classList.toggle('hidden', canRestart);
  FX('podium');
  // il primo balla, il terzo fa una brutta fine
  setTimeout(() => {
    FX('podiumChars');
  }, 1600);
}

// immagine della classifica da mandare nel gruppo
function svgImage(look, size) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img); img.onerror = () => res(null);
    img.src = Ragdoll.portraitURL(look, size);
  });
}
const siteLabel = () => (location.host + location.pathname).replace(/\/+$/, '');
$('#end-image').addEventListener('click', async () => {
  if (!lastEnd) return;
  const sorted = lastEnd.sorted;
  const W = 1080; const H = 1350;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const bg = x.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#1a1236'); bg.addColorStop(1, '#09090d');
  x.fillStyle = bg; x.fillRect(0, 0, W, H);
  [['rgba(124,92,255,.35)', 180, 160, 520], ['rgba(255,77,141,.25)', 920, 1100, 560]].forEach(([col, cx, cy, r]) => {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, col); g.addColorStop(1, 'transparent');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  });
  await document.fonts.ready;
  x.textAlign = 'center';
  x.fillStyle = '#ffd426'; x.font = '900 78px Outfit, sans-serif'; x.fillText('Indovina la Canzone', W / 2, 140);
  x.fillStyle = '#9393a3'; x.font = '500 34px Outfit, sans-serif';
  x.fillText(new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' }), W / 2, 196);
  const slots = [
    { i: 1, cx: 260, h: 250, col: ['#e5e7eb', '#9ca3af'] },
    { i: 0, cx: 540, h: 360, col: ['#ffe066', '#f5b700'] },
    { i: 2, cx: 820, h: 180, col: ['#f0a46b', '#b45309'] },
  ];
  const base = 1040;
  for (const sl of slots) {
    const p = sorted[sl.i]; if (!p) continue;
    const g = x.createLinearGradient(0, base - sl.h, 0, base); g.addColorStop(0, sl.col[0]); g.addColorStop(1, sl.col[1]);
    x.fillStyle = g; x.beginPath(); x.roundRect(sl.cx - 130, base - sl.h, 260, sl.h, [28, 28, 8, 8]); x.fill();
    x.fillStyle = 'rgba(0,0,0,.5)'; x.font = '900 96px Outfit, sans-serif'; x.fillText(String(sl.i + 1), sl.cx, base - sl.h + 110);
    const img = await svgImage(lookOf(p), sl.i === 0 ? 190 : 160);
    if (img) x.drawImage(img, sl.cx - img.width / 2, base - sl.h - img.height - 110);
    x.fillStyle = '#f5f5f7'; x.font = '800 46px Outfit, sans-serif';
    x.fillText(p.name.charAt(0).toUpperCase() + p.name.slice(1), sl.cx, base - sl.h - 62);
    x.fillStyle = '#ffd426'; x.font = '700 34px Outfit, sans-serif'; x.fillText(`${p.score} punti`, sl.cx, base - sl.h - 20);
    if (sl.i === 0) { x.font = '80px serif'; x.fillText('👑', sl.cx, base - sl.h - (img ? img.height : 0) - 110); }
  }
  x.textAlign = 'left'; x.font = '600 38px Outfit, sans-serif';
  sorted.slice(3, 7).forEach((p, k) => {
    x.fillStyle = '#9393a3'; x.fillText(`${k + 4}.`, 220, 1120 + k * 52);
    x.fillStyle = '#f5f5f7'; x.fillText(p.name, 290, 1120 + k * 52);
    x.textAlign = 'right'; x.fillText(String(p.score), 860, 1120 + k * 52); x.textAlign = 'left';
  });
  x.textAlign = 'center'; x.fillStyle = 'rgba(255,255,255,.45)'; x.font = '500 28px Outfit, sans-serif';
  x.fillText(siteLabel(), W / 2, H - 40);
  c.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = `classifica-${new Date().toISOString().slice(0, 10)}.png`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, 'image/png');
});
$('#end-again').addEventListener('click', () => go('setup'));

/* ============ Modalità stesso schermo ============ */
let game = null;
const localScores = () => Object.entries(game.scores).map(([name, score]) => ({ name, score, streak: game.streak[name] || 0 }));
function localStart(o, ch = null) {
  const group = !ch; // modalità classica sullo stesso schermo: tutti insieme, senza turni
  const ps = group ? ['Voi'] : players.slice();
  game = {
    ...o, atype, group, total: group ? Infinity : o.rounds * ps.length, round: 0, played: 0, okCount: 0, players: ps, cat: ch ? 'sfida' : catIdNow(),
    scores: Object.fromEntries(ps.map((p) => [p, 0])), streak: {},
    pool: poolFor(atype, ch?.shared || filteredPool()), queue: [], history: [], ch,
  };
  if (!game.pool.length && ch?.gmode !== 'own') { game = null; alert('Nessuna canzone adatta (per "Anno" servono canzoni con l\'anno già catalogato).'); return; }
  game.queue = shuffle(game.pool);
  if (ch?.gmode === 'own') game.own = Object.fromEntries(game.players.map((p) => { const pool = poolFor(atype, ch.pools[p]); return [p, { pool, queue: shuffle(pool) }]; }));
  localNextRound();
}
function endLocalGame() {
  if (!game) return;
  if (game.group) {
    showEnd([], game.history, true, `🎶 Avete indovinato ${game.okCount} canzon${game.okCount === 1 ? 'e' : 'i'} su ${game.played}`);
    return;
  }
  const sc = localScores();
  const top = Math.max(...sc.map((p) => p.score));
  sc.forEach((p) => recordGame(p.name, p.score === top && top > 0));
  showEnd(sc, game.history, true);
}
async function localNextRound() {
  if (game.round >= game.total) { endLocalGame(); return; }
  game.round++;
  game.player = game.players[(game.round - 1) % game.players.length];
  renderScores(localScores());
  $('#g-scores-title').textContent = game.group ? 'Il gruppo' : 'Classifica';
  $('#g-online-players').classList.add('hidden');
  try { game.song = await pickSong(game.own ? game.own[game.player] : game); } catch (err) { go('game'); setFeedback('⚠️ ' + err.message, 'bad'); return; }
  const pk = game.ch?.picks[game.player];
  await startRoundUI({
    label: game.group ? `Canzone ${game.round} · ✓ ${game.okCount}/${game.played}` : `Round ${game.round}/${game.total}`,
    turn: game.group ? '🎶 Tutti insieme' : `Tocca a ${game.player}${game.own && pk ? ` · ${pk.label}` : ''}`, who: game.player, streak: game.streak[game.player] || 0,
    atype: game.atype, hints: makeHints(game.song, game.atype),
    steps: game.steps, offset: game.start === 'random' ? -1 : 0, preview: game.song.preview,
    genre: game.song.genres?.[0] || '', workMode: !!game.song.work?.length,
  });
}
function localHandle(msg) {
  const last = R.step >= R.steps.length - 1;
  let v;
  const j = msg.t === 'guess' ? judge(msg.pick, game.song, R.atype) : null;
  if (j?.ok) v = { kind: 'guess', ok: true, pts: R.steps.length - R.step + (j.exact ? 2 : 0), title: j.label, exact: j.exact };
  else if (msg.t === 'giveup') v = { kind: 'giveup', ok: false, done: true };
  else if (msg.t === 'guess' || msg.t === 'skip') v = { kind: msg.t, ok: false, done: last, step: R.step + 1, title: j?.label, dir: j?.dir };
  else return;
  const stepAt = R.step;
  handleVerdict(v);
  if (!R.done) return;
  const who = game.player;
  const pts = v.ok ? v.pts : 0;
  game.scores[who] += pts;
  game.streak[who] = v.ok ? (game.streak[who] || 0) + 1 : 0;
  const streak = game.streak[who];
  game.played++; if (v.ok) game.okCount++;
  if (!game.group) recordRound(who, { ok: v.ok, t: R.steps[stepAt], song: game.song, cat: game.cat, streak });
  game.history.push({ ...game.song, note: `${who}: ${v.ok ? `${R.steps[stepAt]}s, +${pts}` : 'non indovinata'}` });
  renderScores(localScores());
  const hits = R.hits;
  setTimeout(() => showReveal(game.song, {
    ok: v.ok, streak,
    text: game.group ? (v.ok ? `🎉 Indovinata in ${R.steps[stepAt]} s!` : '💩 Non l\'avete indovinata') : v.ok ? `🎉 ${who} l'ha indovinata in ${R.steps[stepAt]} s · +${pts}` : `💩 ${who} non l'ha indovinata`,
    nextLabel: game.round >= game.total ? 'Classifica finale' : 'Prossima canzone',
    actors: [{ name: who, ok: v.ok, hits, record: !game.group }],
  }), 450);
}

/* ============ Modalità online (PeerJS: connessione diretta tra i browser) ============ */
const PEER_PREFIX = 'indovinalacanzone-';
const net = {
  role: null, peer: null, conn: null, code: null, myName: '',
  players: new Map(), // solo host: id -> { id, name, conn, score }
  looks: {}, // nome -> aspetto, per tutti
  send(msg) { try { this.conn?.open && this.conn.send(msg); } catch { /* connessione chiusa */ } },
  leave() {
    try { this.peer?.destroy(); } catch { /* già chiusa */ }
    Object.assign(this, { role: null, peer: null, conn: null, code: null });
    this.players = new Map();
    if (hg) { clearTimeout(hg.timer); clearInterval(hg.nextTimer); }
  },
};
const newCode = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const roomLink = (code) => `${location.origin}${location.pathname}?stanza=${code}`;
const isLocalHost = () => ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);

/* ---------- host ---------- */
let hg = null;

function renderRoom() {
  const open = net.role === 'host';
  $('#room-create').classList.toggle('hidden', open);
  $('#room-info').classList.toggle('hidden', !open);
  if (!open) return;
  $('#room-link').value = roomLink(net.code);
  $('#room-code').textContent = net.code;
  $('#room-players').innerHTML = [...net.players.values()].map((p) =>
    `<span class="chip ${p.id === 'host' ? 'me' : ''}">${esc(p.name)}${p.id === 'host' ? ' (tu)' : ''}</span>`).join('');
  renderSummary();
  if (gmode !== 'classic') renderModes();
}

$('#room-open').addEventListener('click', () => {
  if (typeof Peer === 'undefined') { $('#room-status').textContent = '⚠️ Libreria per le stanze non caricata: controlla la connessione.'; return; }
  const name = $('#host-name').value.trim().slice(0, 20);
  if (!name) { $('#room-status').textContent = 'Tocca il tuo nome o scrivilo.'; return; }
  store('myName', name);
  net.myName = name;
  $('#room-open').disabled = true;
  $('#room-status').textContent = 'Creo la stanza…';
  const open = (tries) => {
    const code = newCode();
    const peer = new Peer(PEER_PREFIX + code, { debug: 0 });
    peer.on('open', () => {
      Object.assign(net, { role: 'host', peer, code });
      net.players = new Map([['host', { id: 'host', name, conn: null, score: 0, streak: 0, look: Chars.lookFor(name) }]]);
      net.looks = { [name]: Chars.lookFor(name) };
      $('#room-status').textContent = isLocalHost()
        ? '⚠️ Sei sulla versione locale (127.0.0.1): per gli amici usa il sito online.'
        : '';
      $('#room-open').disabled = false;
      renderRoom();
      FX('screenIn', $('#room-info'));
    });
    peer.on('connection', hostOnConnection);
    peer.on('error', (err) => {
      if (err.type === 'unavailable-id' && tries < 3) { peer.destroy(); open(tries + 1); return; }
      if (net.role !== 'host') { $('#room-open').disabled = false; $('#room-status').textContent = '⚠️ Non riesco a creare la stanza: ' + (err.type || err.message); }
    });
    peer.on('disconnected', () => { if (net.peer === peer && !peer.destroyed) peer.reconnect(); });
  };
  open(0);
});
$('#room-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#room-link').value); toast('Link copiato! Mandalo agli amici'); }
  catch { $('#room-link').select(); toast('Seleziona e copia il link'); }
});

function hostOnConnection(conn) {
  conn.on('data', (msg) => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'join') {
      const base = String(msg.name || 'Ospite').slice(0, 20).trim() || 'Ospite';
      let name = base;
      const names = new Set([...net.players.values()].map((p) => p.name.toLowerCase()));
      for (let i = 2; names.has(name.toLowerCase()); i++) name = `${base.slice(0, 17)} ${i}`;
      net.players.set(conn.peer, { id: conn.peer, name, conn, score: 0, streak: 0, look: Chars.clean(msg.look, name) });
      conn.send({ t: 'welcome', name });
      broadcastLobby(); renderRoom();
      broadcast({ t: 'looks', looks: Object.fromEntries([...net.players.values()].map((p) => [p.name, p.look])) });
      toast(`${name} è entrato`);
      if (hg && hg.status !== 'end') sendStatus();
      return;
    }
    if (net.players.has(conn.peer)) hostHandle(conn.peer, msg);
  });
  conn.on('close', () => {
    const p = net.players.get(conn.peer);
    if (!p) return;
    net.players.delete(conn.peer);
    hg?.st.delete(conn.peer);
    toast(`${p.name} è uscito`);
    broadcastLobby(); renderRoom();
    if (hg?.status === 'playing') { sendStatus(); checkRoundEnd(); }
  });
}

function sendTo(p, msg) {
  if (p.id === 'host') setTimeout(() => clientOnMessage(msg), 0);
  else { try { p.conn.open && p.conn.send(msg); } catch { /* uscito */ } }
}
const broadcast = (msg) => net.players.forEach((p) => sendTo(p, msg));
const scoreList = () => [...net.players.values()].map((p) => ({ name: p.name, score: p.score, streak: p.streak }));
function broadcastLobby() { broadcast({ t: 'lobby', players: [...net.players.values()].map((p) => p.name) }); }

function sendStatus() {
  const list = [...net.players.values()].map((p) => {
    const s = hg?.st.get(p.id);
    return { name: p.name, score: p.score, streak: p.streak, state: !s ? 'wait' : s.ok ? 'ok' : s.done ? 'out' : 'play', t: s?.ok ? hg.steps[s.step] : null };
  });
  broadcast({ t: 'status', players: list });
}

function hostStart(o, ch = null) {
  net.players.forEach((p) => { p.score = 0; p.streak = 0; });
  hg = { ...o, atype, buzzer: store('buzzer') === true && ch?.gmode !== 'own', cat: ch ? 'sfida' : catIdNow(), total: o.songs, n: 0, pool: poolFor(atype, ch?.shared || filteredPool()), queue: [], history: [], st: new Map(), status: 'loading', ch };
  if (!hg.pool.length && ch?.gmode !== 'own') { hg = null; alert('Nessuna canzone adatta (per "Anno" servono canzoni con l\'anno già catalogato).'); return; }
  hg.queue = shuffle(hg.pool);
  if (ch?.gmode === 'own') {
    // a turno: ogni canzone è della scelta di un giocatore, e risponde solo lui
    hg.order = Object.keys(ch.pools);
    hg.own = Object.fromEntries(hg.order.map((n) => { const pool = poolFor(atype, ch.pools[n]); return [n, { pool, queue: shuffle(pool) }]; }));
    hg.total = Math.ceil(o.songs / hg.order.length) * hg.order.length;
  }
  hostNextRound();
}

async function hostNextRound() {
  clearInterval(hg.nextTimer);
  hg.n++;
  hg.status = 'loading';
  let owner = null; let ownerId = null;
  if (hg.own) {
    // salta chi è uscito dalla stanza
    for (let k = 0; k < hg.order.length && !ownerId; k++) {
      owner = hg.order[(hg.n - 1 + k) % hg.order.length];
      ownerId = [...net.players.values()].find((p) => p.name === owner)?.id || null;
    }
    if (!ownerId) { toast('Non c\'è più nessuno in stanza', 4000); return; }
  }
  try { hg.song = await pickSong(hg.own ? hg.own[owner] : hg); } catch (err) { toast(err.message, 5000); return; }
  hg.offset = hg.start === 'random' ? Math.random() * Math.max(0, 29.5 - hg.steps[hg.steps.length - 1]) : 0;
  const ids = ownerId ? [ownerId] : [...net.players.keys()];
  hg.st = new Map(ids.map((id) => [id, { step: 0, done: false, ok: false, pts: 0, hits: 0 }]));
  hg.firstOk = false;
  hg.buzz = { holder: null, timer: null };
  hg.status = 'playing';
  const streaks = Object.fromEntries([...net.players.values()].map((p) => [p.name, p.streak]));
  broadcast({ t: 'round', n: hg.n, total: hg.total, steps: hg.steps, offset: hg.offset, preview: hg.song.preview, time: hg.time, streaks, genre: hg.song.genres?.[0] || '', workMode: !!hg.song.work?.length, owner, pickLabel: owner ? hg.ch.picks[owner].label : '', atype: hg.atype, hints: makeHints(hg.song, hg.atype), buzzer: hg.buzzer });
  sendStatus();
  clearTimeout(hg.timer);
  hg.timer = setTimeout(hostEndRound, (hg.time + 2) * 1000); // 2 s di margine per il caricamento
}

function hostHandle(pid, msg) {
  if (!hg || hg.status !== 'playing') return;
  const s = hg.st.get(pid); const p = net.players.get(pid);
  if (!s || !p || s.done) return;
  const last = hg.steps.length - 1;
  // buzzer: il primo che preme ha 10 secondi, gli altri aspettano
  if (msg.t === 'buzz') {
    if (!hg.buzzer || hg.buzz.holder) return;
    hg.buzz.holder = pid;
    clearTimeout(hg.buzz.timer);
    hg.buzz.timer = setTimeout(() => buzzExpire(pid), 10000);
    broadcast({ t: 'buzz', name: p.name, secs: 10 });
    return;
  }
  if (hg.buzzer && msg.t === 'guess' && hg.buzz.holder !== pid) return;
  const releaseBuzz = () => { if (hg.buzz.holder === pid) { clearTimeout(hg.buzz.timer); hg.buzz.holder = null; broadcast({ t: 'buzzfree', out: p.name }); } };
  let v;
  const j = msg.t === 'guess' ? judge(msg.pick, hg.song, hg.atype) : null;
  if (j?.ok) {
    const pts = hg.steps.length - s.step + (hg.firstOk ? 0 : 1) + (j.exact ? 2 : 0); // +1 a chi la indovina per primo, +2 anno esatto
    hg.firstOk = true;
    Object.assign(s, { ok: true, done: true, pts });
    p.score += pts; p.streak++;
    clearTimeout(hg.buzz.timer);
    v = { kind: 'guess', ok: true, pts, title: j.label, exact: j.exact };
  } else if (msg.t === 'giveup') {
    s.done = true; releaseBuzz();
    v = { kind: 'giveup', ok: false, done: true };
  } else if (msg.t === 'guess' && hg.buzzer) {
    s.hits++; s.done = true; // col buzzer chi sbaglia è fuori per questa canzone
    v = { kind: 'guess', ok: false, done: true, out: true, title: j.label, dir: j.dir };
    sendTo(p, { t: 'verdict', ...v }); releaseBuzz(); sendStatus(); checkRoundEnd();
    return;
  } else if (msg.t === 'guess' || msg.t === 'skip') {
    s.hits++;
    if (s.step >= last) s.done = true; else s.step++;
    v = { kind: msg.t, ok: false, done: s.done, step: s.step, title: j?.label || '', dir: j?.dir };
  } else return;
  sendTo(p, { t: 'verdict', ...v });
  sendStatus();
  checkRoundEnd();
}

function checkRoundEnd() {
  if (hg?.status !== 'playing') return;
  const sts = [...hg.st.values()];
  if (sts.every((s) => s.done) || (hg.buzzer && sts.some((s) => s.ok))) hostEndRound();
}
function buzzExpire(pid) {
  if (!hg || hg.status !== 'playing' || hg.buzz.holder !== pid) return;
  const s = hg.st.get(pid); const p = net.players.get(pid);
  hg.buzz.holder = null;
  if (s && !s.done && p) { s.done = true; sendTo(p, { t: 'verdict', kind: 'timeout', ok: false, done: true }); }
  broadcast({ t: 'buzzfree', out: p?.name || '' });
  sendStatus(); checkRoundEnd();
}

function hostEndRound() {
  if (hg.status !== 'playing') return;
  clearTimeout(hg.timer); clearTimeout(hg.buzz?.timer);
  hg.status = 'reveal';
  const results = [...net.players.values()].filter((p) => hg.st.has(p.id)).map((p) => {
    const s = hg.st.get(p.id);
    if (!s.ok) p.streak = 0;
    return { name: p.name, ok: s.ok, t: s.ok ? hg.steps[s.step] : null, pts: s.pts, hits: s.hits, streak: p.streak };
  }).sort((a, b) => b.pts - a.pts);
  const winners = results.filter((r) => r.ok).map((r) => r.name);
  hg.history.push({ ...hg.song, note: winners.length ? `indovinata da ${winners.join(', ')}` : 'nessuno' });
  const song = { id: hg.song.id, title: hg.song.title, artist: hg.song.artist, cover: hg.song.cover, year: hg.song.year, work: hg.song.work || null };
  broadcast({ t: 'reveal', song, results, scores: scoreList(), last: hg.n >= hg.total, cat: hg.cat });
  let left = 15; // si va avanti da soli dopo 15 secondi
  clearInterval(hg.nextTimer);
  hg.nextTimer = setInterval(() => {
    left--;
    if (left <= 0) { clearInterval(hg.nextTimer); hostNext(); return; }
    $('#rv-next').textContent = `${hg.n >= hg.total ? 'Classifica finale' : 'Prossima canzone'} (${left})`;
  }, 1000);
}

function hostNext() {
  if (!hg || hg.status !== 'reveal') return;
  clearInterval(hg.nextTimer);
  if (hg.n >= hg.total) {
    hg.status = 'end';
    broadcast({ t: 'end', scores: scoreList(), history: hg.history.map((h) => ({ title: h.title, artist: h.artist, note: h.note })) });
  } else hostNextRound();
}

/* ---------- chi entra dal link ---------- */
function joinRoom(code) {
  mode = 'online';
  net.code = code;
  go('join');
  $('#join-code').textContent = code;
  const me = store('myName') || '';
  $('#join-name').value = me;
  $('#join-roster').innerHTML = rosterChips([me], false);
}
$('#join-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#join-go').click(); });
$('#join-go').addEventListener('click', () => {
  const name = $('#join-name').value.trim().slice(0, 20);
  if (!name) { $('#join-status').textContent = 'Tocca il tuo nome o scrivilo.'; return; }
  if (typeof Peer === 'undefined') { $('#join-status').textContent = '⚠️ Libreria per le stanze non caricata.'; return; }
  store('myName', name);
  player.ctx = player.ctx || new AudioContext(); player.ctx.resume(); // sblocca l'audio con questo clic
  $('#join-go').disabled = true;
  $('#join-status').textContent = 'Mi collego…';
  const code = net.code;
  const peer = new Peer({ debug: 0 });
  peer.on('open', () => {
    const conn = peer.connect(PEER_PREFIX + code, { reliable: true });
    Object.assign(net, { role: 'guest', peer, conn, code });
    conn.on('open', () => conn.send({ t: 'join', name, look: Chars.lookFor(name) }));
    conn.on('data', clientOnMessage);
    conn.on('close', () => {
      if (net.conn !== conn) return;
      net.leave();
      hideReveal(true);
      toast('La stanza è stata chiusa', 4000);
      history.replaceState(null, '', location.pathname);
      go('home');
    });
  });
  peer.on('error', (err) => {
    $('#join-go').disabled = false;
    $('#join-status').textContent = err.type === 'peer-unavailable'
      ? '⚠️ Stanza non trovata: controlla il link o chiedi all\'host se la stanza è ancora aperta.'
      : '⚠️ Problema di connessione: ' + (err.type || err.message);
  });
});

/* ---------- messaggi ricevuti (ospiti e host stesso) ---------- */
function clientOnMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  switch (msg.t) {
    case 'welcome':
      net.myName = msg.name;
      $('#join-form').classList.add('hidden');
      $('#join-wait').classList.remove('hidden');
      $('#join-status').textContent = '';
      FX('screenIn', $('#join-wait'));
      break;
    case 'looks':
      if (msg.looks && typeof msg.looks === 'object') for (const [n, l] of Object.entries(msg.looks)) net.looks[String(n).slice(0, 20)] = Chars.clean(l, n);
      break;
    case 'lobby':
      $('#join-players').innerHTML = msg.players.map((n) => `<span class="chip ${n === net.myName ? 'me' : ''}">${esc(n)}</span>`).join('');
      break;
    case 'round':
      $('#g-online-players').classList.remove('hidden');
      $('#g-scores-title').textContent = 'Classifica';
      {
        const owner = msg.owner ? String(msg.owner).slice(0, 20) : null;
        const label = String(msg.pickLabel || '').slice(0, 70);
        const mine = !owner || owner === net.myName;
        startRoundUI({
          label: `Canzone ${msg.n}/${msg.total}`, turn: owner ? (mine ? `Tocca a te · ${label}` : `Tocca a ${owner} · ${label}`) : net.myName,
          who: owner || net.myName, streak: msg.streaks?.[owner || net.myName] || 0, steps: msg.steps, offset: msg.offset, preview: msg.preview, time: msg.time,
          genre: String(msg.genre || '').slice(0, 40), workMode: !!msg.workMode,
          atype: ['title', 'year', 'artist'].includes(msg.atype) ? msg.atype : 'title',
          hints: Array.isArray(msg.hints) ? msg.hints.slice(0, 2).map((h) => String(h).slice(0, 80)) : null, buzzer: !!msg.buzzer && mine && !msg.owner,
        }).then(() => { if (!mine && R) { R.spectator = true; lockRound(); setFeedback(`👀 Sta rispondendo ${owner}: puoi ascoltare, ma non rispondere`); } });
        if (!mine) { R.spectator = true; lockRound(); }
      }
      break;
    case 'verdict':
      handleVerdict(msg);
      break;
    case 'buzz': {
      if (!R || R.done || !R.buzzer) break;
      const mineBuzz = msg.name === net.myName;
      R.holding = mineBuzz; R.buzzLocked = !mineBuzz;
      setAnswerUI();
      if (mineBuzz) { $('#g-guess').focus({ preventScroll: true }); buzzCountdown(+msg.secs || 10); } else setFeedback(`🔔 ${String(msg.name).slice(0, 20)} sta rispondendo…`);
      break;
    }
    case 'buzzfree':
      if (!R || R.done || !R.buzzer) break;
      R.holding = false; R.buzzLocked = false; clearInterval(buzzTick);
      setAnswerUI();
      setFeedback(msg.out && msg.out !== net.myName ? `✗ ${String(msg.out).slice(0, 20)} non l'ha presa: prenotati!` : 'Premi 🔔 quando la sai!');
      break;
    case 'status':
      $('#g-online-players').innerHTML = msg.players.map((p) => {
        const ico = p.state === 'ok' ? `✓ ${p.t}s` : p.state === 'out' ? '✗' : p.state === 'play' ? '🎧' : '⏳';
        return `<span class="chip ${p.state === 'ok' ? 'ok' : p.state === 'out' ? 'out' : ''} ${p.name === net.myName ? 'me' : ''}">${esc(p.name)} ${ico}</span>`;
      }).join('');
      renderScores(msg.players);
      break;
    case 'reveal': {
      if (!R) break;
      const me = msg.results.find((r) => r.name === net.myName);
      const host = net.role === 'host';
      renderScores(msg.scores);
      if (me) recordRound(net.myName, { ok: me.ok, t: me.t, song: msg.song, cat: msg.cat || 'custom', streak: me.streak });
      showReveal(msg.song, {
        ok: me ? !!me.ok : !!msg.results[0]?.ok, streak: me?.streak || 0,
        actors: msg.results.map((r) => ({ name: r.name, ok: r.ok, hits: r.hits, record: r.name === net.myName })),
        text: me ? (me.ok ? `🎉 Indovinata in ${me.t} s · +${me.pts}` : '💩 Non l\'hai indovinata') : (msg.results[0]?.ok ? `🎉 ${msg.results[0].name} l'ha indovinata in ${msg.results[0].t} s` : `💩 ${msg.results[0]?.name || 'Nessuno'} non l'ha indovinata`),
        results: msg.results, canNext: host,
        nextLabel: host ? (msg.last ? 'Classifica finale' : 'Prossima canzone') : 'In attesa dell\'host…',
      });
      break;
    }
    case 'end': {
      const top = Math.max(...msg.scores.map((p) => p.score));
      const mine = msg.scores.find((p) => p.name === net.myName);
      if (mine) recordGame(net.myName, mine.score === top && top > 0);
      showEnd(msg.scores, msg.history, net.role === 'host');
      break;
    }
  }
}

/* ============ Autocompletamento risposte (ricerca su tutto Deezer, così non si "spoilera" il mazzo) ============ */
let suggestions = []; let sel = -1; let searchSeq = 0; let debounce;
function hideSuggest() { $('#g-suggest').classList.add('hidden'); suggestions = []; sel = -1; }
function renderSuggest() {
  const ul = $('#g-suggest');
  if (!suggestions.length) { ul.classList.add('hidden'); return; }
  if (R?.atype === 'artist') {
    ul.innerHTML = suggestions.map((s, i) => `<li data-i="${i}" class="${i === sel ? 'sel' : ''}"><img src="${esc(s.cover)}" alt="" style="border-radius:50%"><div>${esc(s.artistName)}</div></li>`).join('');
    ul.classList.remove('hidden'); return;
  }
  if (R?.workMode) {
    ul.innerHTML = suggestions.map((s, i) => `<li data-i="${i}" class="${i === sel ? 'sel' : ''}"><span class="s-kind">${R.gi.icon}</span><div>${esc(s.work)}</div></li>`).join('');
    ul.classList.remove('hidden'); return;
  }
  ul.innerHTML = suggestions.map((s, i) => `
    <li data-i="${i}" class="${i === sel ? 'sel' : ''}">
      <img src="${esc(s.cover)}" alt=""><div><div>${esc(s.title)}</div><div class="s-artist">${esc(s.artist)}</div></div>
    </li>`).join('');
  ul.classList.remove('hidden');
}
$('#g-guess').addEventListener('input', (e) => {
  clearTimeout(debounce);
  const q = e.target.value.trim();
  if (q.length < 2 || R?.atype === 'year') { hideSuggest(); return; }
  if (R?.atype === 'artist') {
    debounce = setTimeout(async () => {
      const my = ++searchSeq;
      try {
        const r = await dz('search/artist', { q, limit: 8 });
        if (my !== searchSeq || !R || R.done) return;
        const seenA = new Set();
        suggestions = (r.data || []).filter((a) => { const k = keyOf(a.name); if (seenA.has(k)) return false; seenA.add(k); return true; }).map((a) => ({ artistName: a.name, cover: a.picture_small || '' }));
        sel = -1; renderSuggest();
      } catch { /* ignora */ }
    }, 220);
    return;
  }
  if (R?.workMode) {
    const k = workKey(q);
    suggestions = allWorks().filter((w) => w.alias.some((a) => workKey(a).includes(k))).slice(0, 8).map((w) => ({ work: w.title }));
    sel = -1; renderSuggest(); return;
  }
  debounce = setTimeout(async () => {
    const my = ++searchSeq;
    try {
      const r = await dz('search', { q, limit: 8 });
      if (my !== searchSeq || !R || R.done) return;
      const seen = new Set();
      suggestions = (r.data || []).map(toSong).filter((s) => {
        const k = keyOf(s.title) + '|' + keyOf(s.artist); if (seen.has(k)) return false; seen.add(k); return true;
      });
      sel = -1; renderSuggest();
    } catch { /* ignora */ }
  }, 220);
});
$('#g-guess').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' && suggestions.length) { sel = (sel + 1) % suggestions.length; renderSuggest(); e.preventDefault(); }
  else if (e.key === 'ArrowUp' && suggestions.length) { sel = (sel - 1 + suggestions.length) % suggestions.length; renderSuggest(); e.preventDefault(); }
  else if (e.key === 'Enter') { submitTyped(); e.preventDefault(); }
  else if (e.key === 'Escape') hideSuggest();
});
$('#g-suggest').addEventListener('mousedown', (e) => {
  const li = e.target.closest('li'); if (!li) return;
  e.preventDefault(); guess(suggestions[+li.dataset.i]);
});
$('#g-guess').addEventListener('blur', () => setTimeout(hideSuggest, 150));

/* ============ Personaggi: anteprima, foto della faccia, aspetto ============ */
let ceWho = null; let ceStage = null; let ceRag = null; let ceBusy = null;
function ceBuild() {
  ceStage?.destroy(); ceStage = null; ceRag = null; clearTimeout(ceBusy); ceBusy = null;
  if (!ceWho) { $('#ce-stage').innerHTML = ''; return; }
  if (!Ragdoll.available) { $('#ce-stage').innerHTML = Ragdoll.portrait(Chars.lookFor(ceWho), 90); return; }
  const w = Math.max(240, Math.min(340, $('#ce-stage').clientWidth || 300));
  ceStage = Ragdoll.stage($('#ce-stage'), { w, h: 240 });
  ceRag = Ragdoll.addRag(ceStage, Chars.lookFor(ceWho), w / 2, 1.3);
}
function renderChars() {
  if (!ceWho || !roster.includes(ceWho)) ceWho = roster[0] || null;
  $('#ce-grid').innerHTML = roster.map((n) => {
    const l = Chars.lookFor(n);
    return `<button class="char-card ${n === ceWho ? 'on' : ''}" data-ce="${esc(n)}">${Ragdoll.portrait(l, 44)}<span>${esc(n)}</span>${l.photo ? '<em title="Ha la foto">📷</em>' : ''}</button>`;
  }).join('');
  const l = ceWho ? Chars.lookFor(ceWho) : null;
  $('#ce-name').textContent = ceWho || 'Nessun giocatore';
  $('#ce-nophoto').classList.toggle('hidden', !l?.photo);
  $('#ce-style').classList.toggle('hidden', !l?.photo);
  $('#ce-photo').textContent = l?.photo ? '📷 Cambia foto' : '📷 Scegli una foto';
  $$('#ce-style button').forEach((b) => b.classList.toggle('on', (l?.faceStyle === 'photo' ? 'photo' : 'eyes') === b.dataset.style));
  ceBuild();
  const on = document.querySelector('#ce-grid .char-card.on'); // nella striscia del telefono: porta in vista il selezionato
  const grid = document.querySelector('#ce-grid');
  if (on && grid.scrollWidth > grid.clientWidth) grid.scrollTo({ left: on.offsetLeft - grid.clientWidth / 2 + on.clientWidth / 2, behavior: 'smooth' });
}
const ceSave = (look) => { Chars.setLook(ceWho, look); renderChars(); };
$('#ce-grid').addEventListener('click', (e) => { const b = e.target.closest('[data-ce]'); if (!b) return; ceWho = b.dataset.ce; renderChars(); });
$('#ce-kill').addEventListener('click', () => {
  if (!ceRag || ceBusy) return;
  player.ctx = player.ctx || new AudioContext(); player.ctx.resume(); // per gli effetti sonori
  const type = Ragdoll.kill(ceRag);
  toast(`💀 ${ceWho} ${Ragdoll.LABEL[type]}`, 2200);
  ceBusy = setTimeout(() => { ceBusy = null; ceBuild(); }, 3400);
});
$('#ce-dance').addEventListener('click', () => { if (ceRag && !ceBusy) Ragdoll.dance(ceRag); });
$('#ce-photo').addEventListener('click', () => $('#ce-file').click());
$('#ce-camera').addEventListener('click', () => $('#ce-file-cam').click());
['#ce-file', '#ce-file-cam'].forEach((sel) => $(sel).addEventListener('change', (e) => {
  const f = e.target.files[0]; e.target.value = '';
  if (f && ceWho) openCrop(f);
}));
$('#ce-nophoto').addEventListener('click', () => { const l = Chars.lookFor(ceWho); delete l.photo; delete l.faceStyle; ceSave(l); });
$('#ce-style').addEventListener('click', (e) => {
  const b = e.target.closest('[data-style]'); if (!b) return;
  const l = Chars.lookFor(ceWho);
  if (b.dataset.style === 'photo') l.faceStyle = 'photo'; else delete l.faceStyle;
  ceSave(l);
});
$('#ce-reroll').addEventListener('click', () => ceSave(Chars.randomLook(Chars.lookFor(ceWho))));
$('#ce-reset').addEventListener('click', () => { const l = Chars.lookFor(ceWho); ceSave({ ...Chars.defaultLook(ceWho), photo: l.photo, faceStyle: l.faceStyle }); });

// ritaglio della foto: trascina per spostare, zoom con slider o rotella
const crop = { img: null, zoom: 1.3, ox: 0, oy: 0, drag: null };
const CB = 280; const CR = 105; // lato del riquadro e raggio del cerchio (px)
const cropK = () => ((2 * CR) / Math.min(crop.img.width, crop.img.height)) * crop.zoom;
function openCrop(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(url);
    Object.assign(crop, { img, zoom: 1.3, ox: 0, oy: 0 });
    $('#crop-zoom').value = 1.3;
    $('#crop').classList.remove('hidden'); window.lenis?.stop();
    drawCrop();
  };
  img.onerror = () => { URL.revokeObjectURL(url); toast('Non riesco a leggere questa immagine'); };
  img.src = url;
}
function drawCrop() {
  const c = $('#crop-canvas'); const x = c.getContext('2d');
  x.fillStyle = '#111'; x.fillRect(0, 0, CB, CB);
  const k = cropK(); const w = crop.img.width * k; const h = crop.img.height * k;
  x.drawImage(crop.img, CB / 2 - w / 2 + crop.ox, CB / 2 - h / 2 + crop.oy, w, h);
  x.fillStyle = 'rgba(0,0,0,.62)'; x.beginPath(); x.rect(0, 0, CB, CB); x.arc(CB / 2, CB / 2, CR, 0, Math.PI * 2, true); x.fill();
  x.strokeStyle = '#ffd426'; x.lineWidth = 2; x.beginPath(); x.arc(CB / 2, CB / 2, CR, 0, Math.PI * 2); x.stroke();
  // guida per gli occhi (stessa posizione degli occhi cartoon)
  const ey = CB / 2 - CR * 0.1;
  x.setLineDash([5, 5]); x.strokeStyle = 'rgba(255,212,38,.7)'; x.beginPath(); x.moveTo(CB / 2 - CR * 0.8, ey); x.lineTo(CB / 2 + CR * 0.8, ey); x.stroke(); x.setLineDash([]);
  [-1, 1].forEach((d) => { x.beginPath(); x.arc(CB / 2 + d * CR * 0.36, ey, 4, 0, Math.PI * 2); x.stroke(); });
}
function closeCrop() { $('#crop').classList.add('hidden'); window.lenis?.start(); crop.img = null; }
const cv = $('#crop-canvas');
cv.addEventListener('pointerdown', (e) => { if (!crop.img) return; cv.setPointerCapture(e.pointerId); crop.drag = { x: e.clientX, y: e.clientY, ox: crop.ox, oy: crop.oy }; });
cv.addEventListener('pointermove', (e) => {
  if (!crop.drag) return;
  const scale = CB / cv.getBoundingClientRect().width; // la tela può essere rimpicciolita dal CSS
  crop.ox = crop.drag.ox + (e.clientX - crop.drag.x) * scale; crop.oy = crop.drag.oy + (e.clientY - crop.drag.y) * scale; drawCrop();
});
cv.addEventListener('pointerup', () => { crop.drag = null; });
cv.addEventListener('wheel', (e) => {
  if (!crop.img) return; e.preventDefault();
  crop.zoom = Math.min(5, Math.max(1, crop.zoom * (1 - e.deltaY * 0.0015))); $('#crop-zoom').value = crop.zoom; drawCrop();
}, { passive: false });
$('#crop-zoom').addEventListener('input', (e) => { if (!crop.img) return; crop.zoom = +e.target.value; drawCrop(); });
$('#crop-cancel').addEventListener('click', closeCrop);
$('#crop-ok').addEventListener('click', () => {
  if (!crop.img || !ceWho) return closeCrop();
  const k = cropK();
  const photo = Chars.cropToPhoto(crop.img, crop.img.width / 2 - crop.ox / k, crop.img.height / 2 - crop.oy / k, (2 * CR) / k);
  closeCrop();
  ceSave({ ...Chars.lookFor(ceWho), photo });
  toast('Faccia aggiornata 📷');
});

/* ============ Cosa indovinare (titolo / anno / artista) e indizi ============ */
let atype = ['title', 'year', 'artist'].includes(store('atype')) ? store('atype') : 'title';
let hintsOn = store('hints') !== false;
const poolFor = (type, pool) => (type === 'year' ? pool.filter((s) => s.year) : pool);
function matchArtist(guess, artist) {
  const g = keyOf(guess);
  if (g.length < 2) return false;
  const parts = [artist, ...String(artist || '').split(/\s*(?:,|&|\bfeat\.?|\bft\.?|\bx\b|\band\b)\s*/i)].map(keyOf).filter(Boolean);
  return parts.some((k) => k === g || (g.length >= 4 && k.includes(g) && g.length >= k.length * 0.5) || (k.length > 5 && lev(g, k) <= 2));
}
// giudica una risposta secondo il tipo del round
function judge(pick, song, type) {
  if (type === 'year') {
    const y = parseInt(pick?.year, 10);
    if (!y || !song.year) return { ok: false, label: String(pick?.year || '?') };
    const d = y - song.year;
    return { ok: Math.abs(d) <= 1, exact: d === 0, dir: d < 0 ? 'up' : 'down', label: String(y) };
  }
  if (type === 'artist') return { ok: matchArtist(pick?.artistName, song.artist), label: String(pick?.artistName || '').slice(0, 80) };
  return { ok: isCorrect(pick, song), label: String(pick?.work || pick?.title || '').slice(0, 120) };
}
const initials = (t) => String(t || '').split(/\s+/).filter(Boolean).map((w) => [...w][0].toUpperCase() + '_'.repeat(Math.max(0, [...w].length - 1))).join(' ');
// indizi che compaiono a 8 s e a 15 s
function makeHints(song, type) {
  const yr = song.year || '?';
  const g = song.genres?.[0] ? genreInfo(song.genres[0]).label.replace(/^\S+\s/, '') : '';
  if (type === 'year') return [`🎤 ${song.artist}`, `🎵 ${song.title}`];
  if (type === 'artist') return [`📅 ${yr}${g ? ' · ' + g : ''}`, `🔤 ${initials(song.artist)}`];
  if (song.work?.length) return [`📅 Uscito nel ${yr}`, `🔤 ${initials(song.work[0])}`];
  return [`📅 ${yr}${g ? ' · ' + g : ''}`, `🎤 ${song.artist}`];
}
function renderHints() {
  const box = $('#g-hints');
  if (!R || !hintsOn || R.done || !R.hints) { box.classList.add('hidden'); box.innerHTML = ''; return; }
  const t = R.steps[R.step];
  const show = [t >= 8 ? R.hints[0] : null, t >= 15 ? R.hints[1] : null].filter(Boolean);
  const before = box.childElementCount;
  box.innerHTML = show.map((h) => `<span class="hint">💡 ${esc(h)}</span>`).join('');
  box.classList.toggle('hidden', !show.length);
  if (show.length > before) FX('pop', box.lastElementChild);
}
// casella di risposta adatta al tipo (e al buzzer)
function setAnswerUI() {
  if (!R) return;
  const a = R.atype; const inp = $('#g-guess');
  inp.inputMode = a === 'year' ? 'numeric' : 'text';
  inp.maxLength = a === 'year' ? 4 : 120;
  inp.placeholder = a === 'year' ? 'In che anno è uscita? (es. 1998)' : a === 'artist' ? 'Chi canta? Scrivi l\'artista…' : R.workMode ? `Scrivi il nome ${R.gi.of || 'del film'}…` : 'Scrivi titolo o artista…';
  $('#g-goal').textContent = a === 'year' ? '📅 Indovina l\'anno (±1)' : a === 'artist' ? '🎤 Chi canta?' : R.workMode ? `🎯 Indovina ${R.gi.ask || 'il film'}` : '';
  const waitBuzz = R.buzzer && !R.holding;
  $('#g-buzz').classList.toggle('hidden', !waitBuzz);
  $('#g-buzz').disabled = !!R.buzzLocked;
  $('.guess-wrap').classList.toggle('hidden', waitBuzz);
}
function submitTyped() {
  if (!R || R.done) return;
  const v = $('#g-guess').value.trim();
  if (suggestions.length && R.atype !== 'year') { guess(suggestions[Math.max(sel, 0)]); return; }
  if (!v) return;
  if (R.atype === 'year') { if (!/^\d{4}$/.test(v)) { toast('Scrivi un anno di 4 cifre'); return; } guess({ year: v }); }
  else if (R.atype === 'artist') guess({ artistName: v });
  else if (R.workMode) guess({ work: v });
  else toast('Scegli la canzone dai suggerimenti');
}
$('#g-submit').addEventListener('click', submitTyped);
$('#opt-buzzer').addEventListener('change', (e) => { store('buzzer', e.target.checked); toast(e.target.checked ? '🔔 Buzzer attivo' : 'Buzzer spento', 1400); });
$('#g-buzz').addEventListener('click', () => { if (R && !R.done && !R.buzzLocked) act({ t: 'buzz' }); });
let buzzTick = null;
function buzzCountdown(sec) {
  clearInterval(buzzTick);
  const end = Date.now() + sec * 1000;
  const tick = () => {
    const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
    if (!R || R.done || !R.holding) { clearInterval(buzzTick); return; }
    setFeedback(`🔔 Tocca a te! Hai ${left} s`, 'ok');
  };
  tick(); buzzTick = setInterval(tick, 250);
}

/* ============ Linguette laterali: cambiare tutto durante l'ascolto ============ */
let drawerSide = null;
const canEdit = () => (mode === 'local' ? !!game : net.role === 'host' && !!hg);
const inChallenge = () => (mode === 'local' ? !!game?.ch : !!hg?.ch);
const currentAtype = () => (mode === 'local' ? game?.atype : hg?.atype) || atype;
function openDrawer(which) {
  drawerSide = which;
  const d = $('#drawer');
  d.classList.remove('hidden', 'from-left', 'from-right'); d.classList.add(which === 'cats' ? 'from-left' : 'from-right');
  $('#drawer-title').textContent = which === 'cats' ? '🎚️ Categoria e genere' : '⚙️ Opzioni';
  $$('[data-dpanel]').forEach((p) => p.classList.toggle('hidden', p.dataset.dpanel !== which));
  renderDrawer(); window.lenis?.stop();
  if (typeof gsap !== 'undefined') gsap.fromTo('.drawer-card', { x: which === 'cats' ? -50 : 50, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.35, ease: 'power3.out' });
}
function closeDrawer() { $('#drawer').classList.add('hidden'); window.lenis?.start(); }
$$('[data-drawer]').forEach((b) => b.addEventListener('click', () => openDrawer(b.dataset.drawer)));
$('#drawer').addEventListener('click', (e) => { if (e.target.closest('[data-close-drawer]')) closeDrawer(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#drawer').classList.contains('hidden')) closeDrawer(); });
function renderDrawer() {
  const edit = canEdit(); const chal = inChallenge();
  $('#drawer-note').textContent = !edit
    ? (mode === 'online' ? 'Solo chi ha creato la stanza può cambiare categoria e opzioni. Il volume e gli indizi li regoli tu.' : '')
    : chal && drawerSide === 'cats' ? 'In sfida le canzoni arrivano dalle scelte dei giocatori: la categoria non si cambia.' : 'Le modifiche valgono dalla prossima canzone (o premi "Cambia canzone adesso").';
  const off = !edit || chal;
  $('#d-cats').innerHTML = CATEGORIES.map((c) => {
    const missing = c.f.decks && !c.f.decks.some((n) => decks[n]);
    return `<button class="cat small-cat ${sameFilters(filters, catFilters(c)) ? 'on' : ''}" data-dcat="${c.id}" ${off || missing ? 'disabled' : ''}><span class="cat-icon">${c.icon}</span><span class="cat-name">${c.name}</span></button>`;
  }).join('');
  const bk = countBy(activePool(), (s) => [bucketOf(s)]);
  $('#d-buckets').innerHTML = BUCKETS.filter((b) => bk.get(b.id)).map((b) =>
    `<button class="cat small-cat ${sameFilters(filters, catFilters({ f: { buckets: [b.id] } })) ? 'on' : ''}" data-dbucket="${b.id}" ${off ? 'disabled' : ''}><span class="cat-icon">${b.icon}</span><span class="cat-name">${b.name}</span><span class="cat-desc">${bk.get(b.id)} canzoni</span></button>`).join('');
  $('#d-count').textContent = edit && !chal ? `${poolFor(currentAtype(), filteredPool()).length} canzoni con questa scelta` : '';
  $('#d-volume').value = player.volume;
  $$('#d-atype [data-atype]').forEach((b) => { b.classList.toggle('on', b.dataset.atype === currentAtype()); b.disabled = !edit; });
  $$('#d-hints [data-hints]').forEach((b) => b.classList.toggle('on', (b.dataset.hints === 'on') === hintsOn));
  const o = readOpts(false);
  const sv = o.steps.join(', ');
  $('#d-steps').value = [...$('#d-steps').options].some((x) => x.value === sv) ? sv : $('#d-steps').options[0].value;
  $('#d-steps').disabled = !edit; $('#d-start').value = o.start; $('#d-start').disabled = !edit;
  $('#d-newsong').disabled = !edit; $('#d-end').disabled = !edit;
}
// nuovo insieme di canzoni dopo un cambio di categoria o di tipo di risposta
function rebuildLivePool() {
  const st = mode === 'local' ? game : hg;
  if (!st) return true;
  const t = st.atype;
  if (st.ch) {
    if (st.own) for (const [n, o] of Object.entries(st.own)) { o.pool = poolFor(t, st.ch.pools[n]); o.queue = shuffle(o.pool); }
    else { st.pool = poolFor(t, st.ch.shared); st.queue = shuffle(st.pool); }
    return true;
  }
  const pool = poolFor(t, filteredPool());
  if (!pool.length) { toast('Nessuna canzone con questa scelta', 2500); return false; }
  st.pool = pool; st.queue = shuffle(pool);
  return true;
}
$('#d-cats').addEventListener('click', (e) => {
  const b = e.target.closest('[data-dcat]'); if (!b || b.disabled) return;
  filters = catFilters(CATEGORIES.find((c) => c.id === b.dataset.dcat)); saveFilters();
  if (rebuildLivePool()) toast('Fatto: dalla prossima canzone', 1500);
  renderDrawer();
});
$('#d-buckets').addEventListener('click', (e) => {
  const b = e.target.closest('[data-dbucket]'); if (!b || b.disabled) return;
  filters = catFilters({ f: { buckets: [b.dataset.dbucket] } }); saveFilters();
  if (rebuildLivePool()) toast('Fatto: dalla prossima canzone', 1500);
  renderDrawer();
});
$('#d-volume').addEventListener('input', (e) => player.setVolume(e.target.value));
function setAtype(t) {
  atype = t; store('atype', t);
  const st = mode === 'local' ? game : hg;
  if (st) { st.atype = t; rebuildLivePool(); }
  $$('#s-atype [data-atype]').forEach((b) => b.classList.toggle('on', b.dataset.atype === t));
}
$('#d-atype').addEventListener('click', (e) => { const b = e.target.closest('[data-atype]'); if (!b || b.disabled) return; setAtype(b.dataset.atype); toast('Fatto: dalla prossima canzone', 1500); renderDrawer(); });
$('#s-atype').addEventListener('click', (e) => { const b = e.target.closest('[data-atype]'); if (!b) return; setAtype(b.dataset.atype); renderSummary(); });
$('#d-hints').addEventListener('click', (e) => { const b = e.target.closest('[data-hints]'); if (!b) return; hintsOn = b.dataset.hints === 'on'; store('hints', hintsOn); renderHints(); renderDrawer(); });
$('#d-steps').addEventListener('change', (e) => {
  $('#opt-steps').value = e.target.value; const o = readOpts(true);
  if (game) game.steps = o.steps; if (hg) hg.steps = o.steps;
  toast('Fatto: dalla prossima canzone', 1500);
});
$('#d-start').addEventListener('change', (e) => {
  $('#opt-start').value = e.target.value; readOpts(true);
  if (game) game.start = e.target.value; if (hg) hg.start = e.target.value;
  toast('Fatto: dalla prossima canzone', 1500);
});
$('#d-newsong').addEventListener('click', () => {
  closeDrawer();
  if (mode === 'local' && game) {
    player.stop(); hideReveal(true);
    if (R && !R.done && game.song) game.history.push({ ...game.song, note: 'cambiata' });
    if (game.group) game.round--; // nel gioco di gruppo il cambio non conta come canzone
    localNextRound();
  } else if (hg) {
    if (hg.status === 'playing') { clearTimeout(hg.timer); clearTimeout(hg.buzz?.timer); hg.n--; hostNextRound(); } else if (hg.status === 'reveal') hostNext();
  }
});
$('#d-end').addEventListener('click', () => {
  closeDrawer();
  if (mode === 'local' && game) endLocalGame();
  else if (hg) { clearTimeout(hg.timer); clearTimeout(hg.buzz?.timer); hg.n = hg.total; hg.status = 'reveal'; hostNext(); }
});

/* ============ Avvio ============ */
if (!store('starterLoaded') || store('starterVersion') !== (window.STARTER_VERSION || 1)) loadStarter();
renderDecks();
updateBadge();
const roomParam = new URLSearchParams(location.search).get('stanza');
if (roomParam) joinRoom(roomParam.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8));
else go('home');
spHandleRedirect().then(spRender);
enrichAll();
