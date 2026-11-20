'use strict';
/* Gioco: modalità "stesso schermo" e stanze online (PeerJS).
   Usa da app.js: $, $$, esc, store, shuffle, sleep, dz, toSong, norm, player,
   activePool, filteredPool, renderFilters, renderDecks, decks, loadStarter, spHandleRedirect, spRender, enrichAll */

let mode = 'local'; // 'local' | 'online'

function toast(msg, ms = 2600) {
  const t = $('#toast');
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add('hidden'), ms);
}

function isCorrect(pick, song) {
  if (!pick || !song) return false;
  if (String(pick.id) === String(song.id)) return true;
  return norm(pick.title) === norm(song.title) && norm(pick.artist) === norm(song.artist);
}

/* ============ Navigazione ============ */
function inGame() { return !$('#screen-game').classList.contains('hidden'); }
function go(name) {
  if (name !== 'game') player.stop();
  $$('.screen').forEach((s) => s.classList.toggle('hidden', s.id !== 'screen-' + name));
  if (name === 'setup') { renderSetup(); renderFilters(); }
  if (name === 'home') $('#home-count').textContent = `${activePool().length} canzoni nei mazzi selezionati`;
  window.scrollTo(0, 0);
}
$$('[data-go]').forEach((b) => b.addEventListener('click', () => {
  if (inGame() && !confirm('Uscire dalla partita in corso?')) return;
  if (net.role === 'guest') net.leave();
  if (mode === 'local') game = null;
  go(b.dataset.go);
}));
$$('[data-mode]').forEach((b) => b.addEventListener('click', () => { mode = b.dataset.mode; go('setup'); }));

/* ============ Preparazione ============ */
let players = store('players') || [];
const savedOpts = store('opts');
if (savedOpts) {
  $('#opt-rounds').value = savedOpts.rounds; $('#opt-steps').value = savedOpts.steps;
  $('#opt-start').value = savedOpts.start; if (savedOpts.time) $('#opt-time').value = savedOpts.time;
}

function renderSetup() {
  const online = mode === 'online';
  $('#setup-local').classList.toggle('hidden', online);
  $('#setup-online').classList.toggle('hidden', !online);
  $('#opt-time-wrap').classList.toggle('hidden', !online);
  $('#opt-rounds-label').textContent = online ? 'Numero di canzoni' : 'Round per giocatore';
  $('#host-name').value = $('#host-name').value || store('myName') || '';
  renderPlayers(); renderRoom();
}
function renderPlayers() {
  $('#player-chips').innerHTML = players.map((p, i) => `<span class="chip">${esc(p)}<button data-i="${i}" title="Togli">✕</button></span>`).join('');
  renderSummary();
}
function renderSummary() {
  const n = filteredPool().length;
  let who;
  if (mode === 'online') who = net.role === 'host' ? `${net.players.size} in stanza` : 'crea la stanza';
  else who = players.length ? `${players.length} giocator${players.length === 1 ? 'e' : 'i'}` : 'aggiungi almeno un giocatore';
  $('#setup-summary').textContent = `${n} canzoni · ${who}`;
}
$('#player-add').addEventListener('click', () => {
  const n = $('#player-name').value.trim();
  if (n && !players.includes(n)) { players.push(n); store('players', players); }
  $('#player-name').value = ''; $('#player-name').focus(); renderPlayers();
});
$('#player-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#player-add').click(); });
$('#player-chips').addEventListener('click', (e) => {
  if (e.target.dataset.i === undefined) return;
  players.splice(+e.target.dataset.i, 1); store('players', players); renderPlayers();
});

function readOpts() {
  const steps = $('#opt-steps').value.split(/[,;\s]+/).map(Number).filter((n) => n > 0 && n <= 29).sort((a, b) => a - b);
  const rounds = Math.max(1, Math.min(100, +$('#opt-rounds').value || 5));
  const o = { rounds, steps, start: $('#opt-start').value, time: +$('#opt-time').value || 30 };
  store('opts', { rounds, steps: $('#opt-steps').value, start: o.start, time: o.time });
  return o;
}

$('#game-start').addEventListener('click', () => {
  const o = readOpts();
  if (!o.steps.length) { alert('Inserisci almeno una durata valida (es. 0.1, 1, 5).'); return; }
  if (!activePool().length) { alert('Seleziona almeno un mazzo con delle canzoni.'); go('decks'); return; }
  if (!filteredPool().length) { alert('Nessuna canzone corrisponde ai filtri: allargali un po\'.'); return; }
  player.ctx = player.ctx || new AudioContext(); // sbloccato da questo clic
  player.ctx.resume();
  if (mode === 'local') {
    if (!players.length) { alert('Aggiungi almeno un giocatore.'); return; }
    localStart(o);
  } else {
    if (net.role !== 'host') { alert('Prima crea la stanza.'); return; }
    hostStart(o);
  }
});

// sceglie una canzone con anteprima disponibile (l'URL dell'anteprima scade: lo chiediamo fresco)
async function pickSong(state) {
  for (let attempt = 0; attempt < 6; attempt++) {
    if (!state.queue.length) state.queue = shuffle(state.pool);
    const song = state.queue.pop();
    try {
      const t = await dz(`track/${song.id}`);
      if (t.preview) return { ...song, ...toSong(t), year: song.year, genres: song.genres, preview: t.preview };
    } catch { /* non disponibile: ne provo un'altra */ }
  }
  throw new Error('Non riesco a caricare canzoni. Controlla la connessione.');
}

/* ============ Round: interfaccia comune ============ */
let R = null; // stato del round di chi sta giocando su questo dispositivo

function renderSteps(playing = false) {
  $('#g-steps').innerHTML = R.steps.map((s, i) => {
    const cls = R.done ? 'done' : i < R.step ? 'done' : i === R.step ? 'current' : '';
    return `<div class="seg ${cls}"><div class="bar"><div class="fill"></div></div><span>${s}s</span></div>`;
  }).join('');
  const last = R.step >= R.steps.length - 1;
  const next = R.steps[R.step + 1];
  $('#g-skip').textContent = last ? 'Salta' : `Salta (+${+(next - R.steps[R.step]).toFixed(2)}s)`;
  $('#g-skip').disabled = last || R.done;
  if (!playing) $('#g-play-label').innerHTML = R.done ? '' : `Ascolta <b>${R.steps[R.step]} s</b>`;
}

function renderAttempts() {
  $('#g-attempts').innerHTML = R.steps.map((s, i) => {
    const a = R.attempts[i];
    if (!a) return `<li><span class="t">${s}s</span></li>`;
    const ico = a.type === 'right' ? '✓' : a.type === 'wrong' ? '✗' : '⏭';
    return `<li class="${a.type}"><span class="t">${s}s</span><span class="ico">${ico}</span><span>${esc(a.text)}</span></li>`;
  }).join('');
}

function playSnippet() {
  if (!R || $('#g-play').disabled) return;
  const dur = R.done ? Math.min(12, player.duration - R.offset) : R.steps[R.step];
  const btn = $('#g-play');
  btn.classList.add('playing');
  const fill = $$('#g-steps .seg')[R.step]?.querySelector('.fill');
  if (fill && !R.done) {
    fill.style.transition = 'none'; fill.style.width = '0';
    void fill.offsetWidth; // riparte l'animazione
    fill.style.transition = `width ${dur}s linear`; fill.style.width = '100%';
  }
  player.play(R.offset, dur, () => {
    btn.classList.remove('playing');
    if (fill) { fill.style.transition = 'width .3s'; fill.style.width = '0'; }
  });
}
$('#g-play').addEventListener('click', playSnippet);

function setFeedback(msg, cls = '') {
  const f = $('#g-feedback'); f.textContent = msg; f.className = 'feedback ' + cls;
}

// prepara lo schermo per un nuovo round
async function startRoundUI({ label, turn, steps, offset, preview, time }) {
  clearInterval(roundTimer);
  R = { steps, step: 0, offset, done: false, attempts: [] };
  go('game');
  $('#g-round').textContent = label;
  $('#g-turn').textContent = turn || '';
  $('#g-reveal').classList.add('hidden');
  $('#r-results').classList.add('hidden');
  $('#g-guess-area').classList.remove('hidden');
  $('#g-guess').value = ''; $('#g-guess').disabled = false; hideSuggest();
  $('#g-play').disabled = true;
  setFeedback('Carico la canzone…');
  renderSteps(); renderAttempts();
  if (time) startTimer(time); else $('#g-timer').classList.add('hidden');
  try {
    await player.load(preview);
    if (R.offset < 0) R.offset = Math.random() * Math.max(0, player.duration - steps[steps.length - 1] - 0.5);
    $('#g-play').disabled = false;
    setFeedback(player.precise ? '' : 'Riproduzione in modalità meno precisa');
    $('#g-guess').focus();
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
      if (R && !R.done) { R.done = true; lockRound(); setFeedback('⏱️ Tempo scaduto', 'bad'); renderSteps(); }
    }
  };
  tick();
  roundTimer = setInterval(tick, 250);
}

function lockRound() {
  $('#g-guess-area').classList.add('hidden');
  hideSuggest();
}

// risposta (dal giudice locale o dall'host) a un tentativo
function handleVerdict(v) {
  if (!R || R.done) return;
  const label = v.kind === 'guess' ? v.title : v.kind === 'skip' ? 'Saltato' : 'Mi arrendo';
  R.attempts[R.step] = { type: v.ok ? 'right' : v.kind === 'guess' ? 'wrong' : 'skip', text: label };
  if (v.ok) {
    R.done = true;
    setFeedback(`✓ Indovinata in ${R.steps[R.step]} s! +${v.pts}`, 'ok');
  } else if (v.done) {
    R.done = true;
    setFeedback(v.kind === 'giveup' ? 'Ti sei arreso' : 'Tentativi finiti', 'bad');
  } else {
    R.step = v.step;
    setFeedback(v.kind === 'guess' ? `✗ Non è "${v.title}"` : '', 'bad');
  }
  renderSteps(); renderAttempts();
  if (R.done) {
    lockRound();
    if (mode === 'online') $('#g-feedback').textContent += ' · aspetta gli altri…';
  } else {
    setTimeout(playSnippet, 350); // sbagliato o saltato: parte subito il pezzo più lungo
  }
}

function act(msg) {
  if (!R || R.done) return;
  if (mode === 'local') localHandle(msg);
  else if (net.role === 'host') hostHandle('host', msg);
  else net.send(msg);
}
$('#g-skip').addEventListener('click', () => act({ t: 'skip' }));
$('#g-giveup').addEventListener('click', () => act({ t: 'giveup' }));
function guess(pick) {
  hideSuggest(); $('#g-guess').value = '';
  act({ t: 'guess', pick: { id: pick.id, title: pick.title, artist: pick.artist } });
}

function showReveal(song, resultText, ok) {
  R.done = true;
  lockRound(); renderSteps();
  clearInterval(roundTimer); $('#g-timer').classList.add('hidden');
  $('#g-reveal').classList.remove('hidden');
  const r = $('#r-result');
  r.textContent = resultText; r.className = 'result ' + (ok ? 'ok' : 'bad');
  $('#r-title').textContent = song.title;
  $('#r-artist').textContent = `${song.artist}${song.year ? ' · ' + song.year : ''}`;
  $('#r-cover').src = song.cover || '';
}
$('#r-listen').addEventListener('click', () => { if (R) { R.done = true; playSnippet(); } });

function renderScores(list, el = $('#g-scores')) {
  el.innerHTML = [...list].sort((a, b) => b.score - a.score)
    .map((p) => `<li>${esc(p.name)}<span>${p.score}</span></li>`).join('');
}

function showEnd(scores, history, canRestart) {
  player.stop(); clearInterval(roundTimer);
  go('end');
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  $('#end-winner').textContent = sorted[0] ? `🏆 Vince ${sorted[0].name}!` : 'Fine';
  renderScores(sorted, $('#end-scores'));
  $('#end-history').innerHTML = history.map((h) => `<li>${esc(h.artist)} – ${esc(h.title)}${h.note ? ` <em>(${esc(h.note)})</em>` : ''}</li>`).join('');
  $('#end-again').classList.toggle('hidden', !canRestart);
}
$('#end-again').addEventListener('click', () => go('setup'));

/* ============ Modalità stesso schermo ============ */
let game = null;
function localStart(o) {
  game = {
    ...o, total: o.rounds * players.length, round: 0,
    scores: Object.fromEntries(players.map((p) => [p, 0])),
    pool: filteredPool(), queue: [], history: [],
  };
  game.queue = shuffle(game.pool);
  localNextRound();
}
async function localNextRound() {
  if (game.round >= game.total) {
    showEnd(Object.entries(game.scores).map(([name, score]) => ({ name, score })), game.history, true);
    return;
  }
  game.round++;
  game.player = players[(game.round - 1) % players.length];
  renderScores(Object.entries(game.scores).map(([name, score]) => ({ name, score })));
  $('#g-online-players').classList.add('hidden');
  try {
    game.song = await pickSong(game);
  } catch (err) { go('game'); setFeedback('⚠️ ' + err.message, 'bad'); return; }
  await startRoundUI({
    label: `Round ${game.round}/${game.total}`, turn: `Tocca a ${game.player}`,
    steps: game.steps, offset: game.start === 'random' ? -1 : 0, preview: game.song.preview,
  });
}
function localHandle(msg) {
  const last = R.step >= R.steps.length - 1;
  let v;
  if (msg.t === 'guess' && isCorrect(msg.pick, game.song)) v = { kind: 'guess', ok: true, pts: R.steps.length - R.step, title: msg.pick.title };
  else if (msg.t === 'giveup') v = { kind: 'giveup', ok: false, done: true };
  else v = { kind: msg.t, ok: false, done: last, step: R.step + 1, title: msg.pick?.title };
  const stepAt = R.step;
  handleVerdict(v);
  if (R.done) {
    const pts = v.ok ? v.pts : 0;
    game.scores[game.player] += pts;
    game.history.push({ ...game.song, note: `${game.player}: ${v.ok ? `${R.steps[stepAt]}s, +${pts}` : 'non indovinata'}` });
    showReveal(game.song, v.ok ? `✓ ${game.player} l'ha indovinata in ${R.steps[stepAt]} s · +${pts}` : `${game.player} non l'ha indovinata`, v.ok);
    $('#r-next').disabled = false;
    $('#r-next').textContent = game.round >= game.total ? 'Classifica finale' : 'Avanti';
    renderScores(Object.entries(game.scores).map(([name, score]) => ({ name, score })));
  }
}
$('#r-next').addEventListener('click', () => {
  player.stop();
  if (mode === 'local' && game) localNextRound();
  else if (mode === 'online' && net.role === 'host') hostNext();
});

/* ============ Modalità online (PeerJS: connessione diretta tra i browser) ============ */
const PEER_PREFIX = 'indovinalacanzone-';
const net = {
  role: null, peer: null, conn: null, code: null, myName: '',
  players: new Map(), // solo host: id -> { id, name, conn, score }
  send(msg) { try { this.conn?.open && this.conn.send(msg); } catch { /* connessione chiusa */ } },
  leave() {
    try { this.peer?.destroy(); } catch { /* già chiusa */ }
    Object.assign(this, { role: null, peer: null, conn: null, code: null });
    this.players = new Map();
    clearTimeout(hg?.timer); clearInterval(hg?.nextTimer);
  },
};
const newCode = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
const roomLink = (code) => `${location.origin}${location.pathname}?stanza=${code}`;
const isLocalHost = () => ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);

/* ---------- host ---------- */
let hg = null; // stato della partita dell'host

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
}

$('#room-open').addEventListener('click', () => {
  if (typeof Peer === 'undefined') { $('#room-status').textContent = '⚠️ Libreria per le stanze non caricata: controlla la connessione.'; return; }
  const name = $('#host-name').value.trim();
  if (!name) { $('#host-name').focus(); $('#room-status').textContent = 'Scrivi il tuo nome.'; return; }
  store('myName', name);
  net.myName = name;
  $('#room-open').disabled = true;
  $('#room-status').textContent = 'Creo la stanza…';
  const open = (tries) => {
    const code = newCode();
    const peer = new Peer(PEER_PREFIX + code, { debug: 0 });
    peer.on('open', () => {
      Object.assign(net, { role: 'host', peer, code });
      net.players = new Map([['host', { id: 'host', name, conn: null, score: 0 }]]);
      $('#room-status').textContent = isLocalHost()
        ? '⚠️ Il sito è aperto da questo PC (127.0.0.1): il link funzionerà per gli amici solo quando il sito sarà online.'
        : '';
      $('#room-open').disabled = false;
      renderRoom();
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
  try { await navigator.clipboard.writeText($('#room-link').value); toast('Link copiato!'); }
  catch { $('#room-link').select(); toast('Seleziona e copia il link'); }
});

function hostOnConnection(conn) {
  conn.on('data', (msg) => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'join') {
      let name = String(msg.name || 'Ospite').slice(0, 20).trim() || 'Ospite';
      const names = new Set([...net.players.values()].map((p) => p.name.toLowerCase()));
      for (let i = 2; names.has(name.toLowerCase()); i++) name = `${String(msg.name).slice(0, 17)} ${i}`;
      net.players.set(conn.peer, { id: conn.peer, name, conn, score: 0 });
      conn.send({ t: 'welcome', name });
      broadcastLobby(); renderRoom();
      toast(`${name} è entrato`);
      if (hg?.status) sendStatus();
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
const scoreList = () => [...net.players.values()].map((p) => ({ name: p.name, score: p.score }));
function broadcastLobby() { broadcast({ t: 'lobby', players: [...net.players.values()].map((p) => p.name) }); }

function sendStatus() {
  const list = [...net.players.values()].map((p) => {
    const s = hg?.st.get(p.id);
    return { name: p.name, score: p.score, state: !s ? 'wait' : s.ok ? 'ok' : s.done ? 'out' : 'play', t: s?.ok ? hg.steps[s.step] : null };
  });
  broadcast({ t: 'status', players: list });
}

function hostStart(o) {
  net.players.forEach((p) => { p.score = 0; });
  hg = { ...o, total: o.rounds, n: 0, pool: filteredPool(), queue: [], history: [], st: new Map(), status: 'loading' };
  hg.queue = shuffle(hg.pool);
  hostNextRound();
}

async function hostNextRound() {
  clearInterval(hg.nextTimer);
  hg.n++;
  hg.status = 'loading';
  try { hg.song = await pickSong(hg); } catch (err) { toast(err.message, 5000); return; }
  hg.offset = hg.start === 'random' ? Math.random() * Math.max(0, 29.5 - hg.steps[hg.steps.length - 1]) : 0;
  hg.st = new Map([...net.players.keys()].map((id) => [id, { step: 0, done: false, ok: false, pts: 0 }]));
  hg.firstOk = false;
  hg.status = 'playing';
  broadcast({ t: 'round', n: hg.n, total: hg.total, steps: hg.steps, offset: hg.offset, preview: hg.song.preview, time: hg.time });
  sendStatus();
  clearTimeout(hg.timer);
  hg.timer = setTimeout(hostEndRound, (hg.time + 2) * 1000); // 2 s di margine per il caricamento
}

function hostHandle(pid, msg) {
  if (!hg || hg.status !== 'playing') return;
  const s = hg.st.get(pid); const p = net.players.get(pid);
  if (!s || !p || s.done) return;
  const last = hg.steps.length - 1;
  let v;
  if (msg.t === 'guess' && isCorrect(msg.pick, hg.song)) {
    const pts = hg.steps.length - s.step + (hg.firstOk ? 0 : 1); // +1 a chi la indovina per primo
    hg.firstOk = true;
    Object.assign(s, { ok: true, done: true, pts });
    p.score += pts;
    v = { kind: 'guess', ok: true, pts, title: String(msg.pick.title || '') };
  } else if (msg.t === 'giveup') {
    s.done = true;
    v = { kind: 'giveup', ok: false, done: true };
  } else if (msg.t === 'guess' || msg.t === 'skip') {
    if (s.step >= last) s.done = true; else s.step++;
    v = { kind: msg.t, ok: false, done: s.done, step: s.step, title: String(msg.pick?.title || '').slice(0, 120) };
  } else return;
  sendTo(p, { t: 'verdict', ...v });
  sendStatus();
  checkRoundEnd();
}

function checkRoundEnd() {
  if (hg?.status === 'playing' && [...hg.st.values()].every((s) => s.done)) hostEndRound();
}

function hostEndRound() {
  if (hg.status !== 'playing') return;
  clearTimeout(hg.timer);
  hg.status = 'reveal';
  const results = [...net.players.values()].filter((p) => hg.st.has(p.id)).map((p) => {
    const s = hg.st.get(p.id);
    return { name: p.name, ok: s.ok, t: s.ok ? hg.steps[s.step] : null, pts: s.pts };
  }).sort((a, b) => b.pts - a.pts);
  const winners = results.filter((r) => r.ok).map((r) => r.name);
  hg.history.push({ ...hg.song, note: winners.length ? `indovinata da ${winners.join(', ')}` : 'nessuno' });
  const song = { title: hg.song.title, artist: hg.song.artist, cover: hg.song.cover, year: hg.song.year };
  broadcast({ t: 'reveal', song, results, scores: scoreList(), last: hg.n >= hg.total });
  // avanti da solo dopo 12 secondi
  let left = 12;
  clearInterval(hg.nextTimer);
  hg.nextTimer = setInterval(() => {
    left--;
    if (left <= 0) { clearInterval(hg.nextTimer); hostNext(); return; }
    $('#r-next').textContent = `${hg.n >= hg.total ? 'Classifica finale' : 'Prossima canzone'} (${left})`;
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
  $('#join-name').value = store('myName') || '';
  $('#join-name').focus();
}
$('#join-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#join-go').click(); });
$('#join-go').addEventListener('click', () => {
  const name = $('#join-name').value.trim();
  if (!name) { $('#join-name').focus(); return; }
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
    conn.on('open', () => conn.send({ t: 'join', name }));
    conn.on('data', clientOnMessage);
    conn.on('close', () => {
      if (net.conn !== conn) return;
      net.leave();
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
      break;
    case 'lobby':
      $('#join-players').innerHTML = msg.players.map((n) => `<span class="chip ${n === net.myName ? 'me' : ''}">${esc(n)}</span>`).join('');
      break;
    case 'round':
      $('#g-online-players').classList.remove('hidden');
      $('#r-next').classList.remove('hidden');
      startRoundUI({
        label: `Canzone ${msg.n}/${msg.total}`, turn: net.myName,
        steps: msg.steps, offset: msg.offset, preview: msg.preview, time: msg.time,
      });
      break;
    case 'verdict':
      handleVerdict(msg);
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
      showReveal(msg.song, me?.ok ? `✓ Indovinata in ${me.t} s · +${me.pts}` : 'Non l\'hai indovinata', !!me?.ok);
      $('#r-results').classList.remove('hidden');
      $('#r-results').innerHTML = msg.results.map((r) =>
        `<li><span>${esc(r.name)}</span>${r.ok ? `<span class="ok">${r.t}s · +${r.pts}</span>` : '<span class="no">—</span>'}</li>`).join('');
      renderScores(msg.scores);
      const host = net.role === 'host';
      $('#r-next').disabled = !host;
      $('#r-next').textContent = host ? (msg.last ? 'Classifica finale' : 'Prossima canzone') : 'In attesa dell\'host…';
      break;
    }
    case 'end':
      showEnd(msg.scores, msg.history, net.role === 'host');
      break;
  }
}

/* ============ Autocompletamento risposte (ricerca su tutto Deezer, così non si "spoilera" il mazzo) ============ */
let suggestions = []; let sel = -1; let searchSeq = 0; let debounce;
function hideSuggest() { $('#g-suggest').classList.add('hidden'); suggestions = []; sel = -1; }
function renderSuggest() {
  const ul = $('#g-suggest');
  if (!suggestions.length) { ul.classList.add('hidden'); return; }
  ul.innerHTML = suggestions.map((s, i) => `
    <li data-i="${i}" class="${i === sel ? 'sel' : ''}">
      <img src="${esc(s.cover)}" alt=""><div><div>${esc(s.title)}</div><div class="s-artist">${esc(s.artist)}</div></div>
    </li>`).join('');
  ul.classList.remove('hidden');
}
$('#g-guess').addEventListener('input', (e) => {
  clearTimeout(debounce);
  const q = e.target.value.trim();
  if (q.length < 2) { hideSuggest(); return; }
  debounce = setTimeout(async () => {
    const my = ++searchSeq;
    try {
      const r = await dz('search', { q, limit: 8 });
      if (my !== searchSeq || !R || R.done) return;
      const seen = new Set();
      suggestions = (r.data || []).map(toSong).filter((s) => {
        const k = norm(s.title) + '|' + norm(s.artist); if (seen.has(k)) return false; seen.add(k); return true;
      });
      sel = -1; renderSuggest();
    } catch { /* ignora */ }
  }, 220);
});
$('#g-guess').addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' && suggestions.length) { sel = (sel + 1) % suggestions.length; renderSuggest(); e.preventDefault(); }
  else if (e.key === 'ArrowUp' && suggestions.length) { sel = (sel - 1 + suggestions.length) % suggestions.length; renderSuggest(); e.preventDefault(); }
  else if (e.key === 'Enter' && suggestions.length) { guess(suggestions[Math.max(sel, 0)]); e.preventDefault(); }
  else if (e.key === 'Escape') hideSuggest();
});
$('#g-suggest').addEventListener('mousedown', (e) => {
  const li = e.target.closest('li'); if (!li) return;
  e.preventDefault(); guess(suggestions[+li.dataset.i]);
});
$('#g-guess').addEventListener('blur', () => setTimeout(hideSuggest, 150));

/* ============ Avvio ============ */
if (!store('starterLoaded')) loadStarter();
renderDecks();
const roomParam = new URLSearchParams(location.search).get('stanza');
if (roomParam) joinRoom(roomParam.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8));
else go('home');
spHandleRedirect().then(spRender);
enrichAll();
