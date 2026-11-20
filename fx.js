'use strict';
/* Animazioni ed effetti: GSAP (transizioni, testo), Lenis (scroll fluido), canvas-confetti
   (coriandoli e pioggia di 💩), visualizzatore audio, bagliore "spotlight", effetto magnete e scintille al clic.
   Il gioco funziona anche senza questo file: game.js chiama window.fx solo se esiste. */
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof gsap !== 'undefined';
  const COLORS = ['#ffd426', '#7c5cff', '#ff4d8d', '#3ddc84', '#ffffff'];
  const fx = {};
  window.fx = fx;

  /* ---------- scroll fluido ---------- */
  if (typeof Lenis !== 'undefined' && !reduce) {
    const lenis = new Lenis({
      lerp: 0.1, anchors: true,
      prevent: (node) => !!node.closest?.('.suggest, .deck-songs, .reveal-overlay, select'),
    });
    window.lenis = lenis;
    if (hasGsap) { gsap.ticker.add((t) => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0); }
    else { const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf); }
  }

  /* ---------- bagliore che segue il mouse ---------- */
  document.addEventListener('pointermove', (e) => {
    const el = e.target.closest?.('.spot');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });

  /* ---------- scintille al clic (ispirato a ClickSpark di React Bits) ---------- */
  const sparkCanvas = document.createElement('canvas');
  Object.assign(sparkCanvas.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: '70' });
  document.body.appendChild(sparkCanvas);
  const sctx = sparkCanvas.getContext('2d');
  let sparks = [];
  const sizeSparks = () => {
    const d = devicePixelRatio || 1;
    sparkCanvas.width = innerWidth * d; sparkCanvas.height = innerHeight * d;
    sctx.setTransform(d, 0, 0, d, 0, 0);
  };
  sizeSparks(); addEventListener('resize', sizeSparks);
  document.addEventListener('pointerdown', (e) => {
    if (reduce || !e.target.closest?.('.btn.primary, .play, .cat, .mode, .roster .chip')) return;
    const now = performance.now();
    for (let i = 0; i < 8; i++) sparks.push({ x: e.clientX, y: e.clientY, a: (Math.PI * 2 * i) / 8, t: now });
    if (sparks.length <= 8) requestAnimationFrame(drawSparks);
  });
  function drawSparks(now) {
    sctx.clearRect(0, 0, innerWidth, innerHeight);
    sparks = sparks.filter((s) => now - s.t < 420);
    for (const s of sparks) {
      const p = (now - s.t) / 420; const ease = 1 - (1 - p) ** 3;
      const d = ease * 26; const len = 10 * (1 - ease);
      sctx.strokeStyle = '#ffd426'; sctx.lineWidth = 2; sctx.lineCap = 'round';
      sctx.beginPath();
      sctx.moveTo(s.x + Math.cos(s.a) * d, s.y + Math.sin(s.a) * d);
      sctx.lineTo(s.x + Math.cos(s.a) * (d + len), s.y + Math.sin(s.a) * (d + len));
      sctx.stroke();
    }
    if (sparks.length) requestAnimationFrame(drawSparks);
  }

  /* ---------- visualizzatore attorno al pulsante play ---------- */
  const viz = document.getElementById('g-viz');
  const vctx = viz.getContext('2d');
  const bins = new Uint8Array(64);
  let idle = 0; let energy = 0;
  const root = document.documentElement;
  function drawViz() {
    requestAnimationFrame(drawViz);
    const playing = !!player.node;
    if (playing && player.analyser) player.analyser.getByteFrequencyData(bins); else bins.fill(0);
    // sfondo che reagisce alla musica: energia dei bassi, salita rapida e discesa morbida
    let sum = 0; for (let i = 0; i < 12; i++) sum += bins[i];
    const e = Math.min(1, (sum / 12 / 255) ** 1.6 * 1.4);
    energy = e > energy ? energy + (e - energy) * 0.5 : energy * 0.92;
    root.style.setProperty('--energy', energy.toFixed(3));
    if (document.getElementById('screen-game').classList.contains('hidden')) return;
    const W = viz.width; const H = viz.height; const cx = W / 2; const cy = H / 2;
    vctx.clearRect(0, 0, W, H);
    idle += 0.02;
    const n = 56; const r0 = W * 0.27;
    for (let i = 0; i < n; i++) {
      const v = bins[Math.floor((i / n) * 40)] / 255;
      const base = playing ? 0 : (Math.sin(idle + i * 0.45) + 1) * 0.02;
      const len = W * (0.03 + base + v * 0.16);
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      vctx.strokeStyle = playing ? `rgba(255,212,38,${0.35 + v * 0.65})` : 'rgba(255,255,255,.12)';
      vctx.lineWidth = W * 0.012; vctx.lineCap = 'round';
      vctx.beginPath();
      vctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      vctx.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len));
      vctx.stroke();
    }
  }
  if (!reduce) requestAnimationFrame(drawViz);

  /* ---------- coriandoli ---------- */
  const conf = typeof confetti !== 'undefined' ? confetti : null;
  let poop = null; let star = null;
  try { poop = conf?.shapeFromText({ text: '💩', scalar: 3 }); star = conf?.shapeFromText({ text: '⭐', scalar: 2 }); } catch { /* browser senza emoji su canvas */ }
  fx.confetti = () => {
    if (!conf || reduce) return;
    const base = { colors: COLORS, ticks: 220, disableForReducedMotion: true };
    conf({ ...base, particleCount: 70, angle: 60, spread: 60, origin: { x: 0, y: 0.75 }, startVelocity: 55 });
    conf({ ...base, particleCount: 70, angle: 120, spread: 60, origin: { x: 1, y: 0.75 }, startVelocity: 55 });
    setTimeout(() => conf({ ...base, particleCount: 90, spread: 100, origin: { y: 0.35 }, startVelocity: 35, scalar: 1.1 }), 180);
  };
  fx.poop = () => {
    if (!conf || reduce) return;
    const end = performance.now() + 1600;
    let frame = 0;
    (function rain() {
      if (frame++ % 3 === 0) conf({
        particleCount: 1, angle: 270, spread: 25, startVelocity: 6 + Math.random() * 6, gravity: 0.8 + Math.random() * 0.4, ticks: 400, drift: (Math.random() - 0.5) * 0.8,
        origin: { x: Math.random(), y: -0.08 }, shapes: poop ? [poop] : ['circle'], colors: ['#7a4a1e'], scalar: poop ? 2.6 : 1.2, flat: true,
        disableForReducedMotion: true,
      });
      if (performance.now() < end) requestAnimationFrame(rain);
    })();
  };
  fx.starBurst = (el) => {
    if (!conf || reduce || !el) return;
    const r = el.getBoundingClientRect();
    conf({ particleCount: 18, spread: 70, startVelocity: 22, ticks: 90, scalar: star ? 1.4 : 0.8, shapes: star ? [star] : ['star'],
      colors: ['#ffd426'], origin: { x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height / 2) / innerHeight }, disableForReducedMotion: true });
  };
  let flame = null;
  try { flame = conf?.shapeFromText({ text: '🔥', scalar: 2.4 }); } catch { /* niente emoji */ }
  fx.fire = () => {
    if (!conf || reduce) return;
    [0.2, 0.5, 0.8].forEach((x, i) => setTimeout(() => conf({
      particleCount: 14, spread: 50, startVelocity: 42, gravity: 0.7, ticks: 160, origin: { x, y: 1 }, angle: 90,
      shapes: flame ? [flame] : ['circle'], colors: ['#ff8a3d', '#e5484d'], scalar: flame ? 2.2 : 1, flat: true, disableForReducedMotion: true,
    }), i * 120));
  };
  fx.podium = () => {};
  fx.celebrate = () => {
    if (!conf || reduce) return;
    const end = performance.now() + 1800;
    (function frame() {
      conf({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 }, colors: COLORS, disableForReducedMotion: true });
      conf({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 }, colors: COLORS, disableForReducedMotion: true });
      if (performance.now() < end) requestAnimationFrame(frame);
    })();
  };

  if (!hasGsap || reduce) {
    // senza GSAP (o con "riduci movimento"): solo coriandoli, niente transizioni
    fx.revealIn = (ok) => (ok ? fx.confetti() : fx.poop());
    return;
  }

  /* ---------- GSAP ---------- */
  gsap.defaults({ ease: 'power3.out', duration: 0.6 });
  if (typeof SplitText !== 'undefined') gsap.registerPlugin(SplitText);

  const ENTER = '.page-head, .seg-tabs, .quickbar > *, .hero .eyebrow, .hero-sub, .mode, .panel, .sticky-start, .saved-card, .empty, .game-head, .status-row, .timebar, .arena, .stat-card, .play-label, #g-guess-area, .attempts, .scores-panel, #join-wait > *';
  fx.screenIn = (el) => {
    if (!el) return;
    const items = [...el.querySelectorAll(ENTER)].filter((x) => x.offsetParent !== null);
    const list = items.length ? items : [el];
    gsap.fromTo(list, { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.05, duration: 0.65, clearProps: 'transform' });
    if (el.id === 'screen-home') heroIn();
  };
  fx.stagger = (els) => { if (els.length) gsap.fromTo(els, { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.04, clearProps: 'transform' }); };

  let split = null;
  function heroIn() {
    const h = document.getElementById('hero-title');
    if (typeof SplitText === 'undefined') { gsap.from(h, { y: 40, autoAlpha: 0, duration: 0.9 }); return; }
    document.fonts.ready.then(() => {
      split?.revert();
      split = SplitText.create(h, { type: 'words', mask: 'words' });
      // il testo "lucido" deve stare sulla parola, non sul contenitore spezzato
      split.words.forEach((w) => { if (w.parentElement?.closest('.shiny')) w.classList.add('shiny'); });
      gsap.from(split.words, { yPercent: 110, duration: 0.9, stagger: 0.07, ease: 'expo.out' });
    });
  }

  fx.pop = (el) => { if (el) gsap.fromTo(el, { scale: 0.86 }, { scale: 1, duration: 0.45, ease: 'back.out(3)', clearProps: 'transform' }); };
  fx.punch = (el) => gsap.fromTo(el, { scale: 0.9 }, { scale: 1, duration: 0.55, ease: 'elastic.out(1, 0.45)' });
  fx.shake = (el) => gsap.fromTo(el, { x: 0 }, { keyframes: { x: [-10, 9, -7, 5, -2, 0] }, duration: 0.45, ease: 'none' });
  fx.attemptIn = (li) => { if (li) gsap.fromTo(li, { x: -14, autoAlpha: 0 }, { x: 0, autoAlpha: 1, duration: 0.4 }); };
  fx.roundIn = () => {
    gsap.fromTo('#g-steps .seg', { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, stagger: 0.04, duration: 0.5, clearProps: 'transform' });
    gsap.fromTo('#g-play', { scale: 0.6, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.8, ease: 'elastic.out(1, 0.5)', clearProps: 'transform,opacity,visibility' });
    gsap.fromTo('#g-attempts li', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, stagger: 0.03, duration: 0.35, clearProps: 'transform' });
  };

  // punteggi che "contano" fino al nuovo valore
  const lastScore = new Map();
  fx.countScores = (list) => {
    list.querySelectorAll('li').forEach((li) => {
      const span = li.querySelector('span[data-score]');
      const name = li.dataset.name || '';
      const to = +span.dataset.score; const from = lastScore.get(name) ?? to;
      lastScore.set(name, to);
      if (from === to) return;
      const o = { v: from };
      gsap.to(o, { v: to, duration: 0.9, ease: 'power2.out', onUpdate: () => { span.textContent = Math.round(o.v); } });
      gsap.fromTo(span, { scale: 1.5, color: '#ffd426' }, { scale: 1, color: '', duration: 0.9, clearProps: 'transform,color' });
    });
  };

  // effetto magnete sul pulsante play
  const wrap = document.querySelector('.play-wrap');
  const playBtn = document.getElementById('g-play');
  const mx = gsap.quickTo(playBtn, 'x', { duration: 0.5, ease: 'power3' });
  const my = gsap.quickTo(playBtn, 'y', { duration: 0.5, ease: 'power3' });
  wrap.addEventListener('pointermove', (e) => {
    const r = wrap.getBoundingClientRect();
    mx((e.clientX - r.left - r.width / 2) * 0.22); my((e.clientY - r.top - r.height / 2) * 0.22);
  });
  wrap.addEventListener('pointerleave', () => { mx(0); my(0); });

  // podio: i gradini salgono, i personaggi cadono sopra, poi coriandoli
  fx.podium = () => {
    const tl = gsap.timeline();
    tl.fromTo('#end-winner', { y: 30, autoAlpha: 0, scale: 0.9 }, { y: 0, autoAlpha: 1, scale: 1, duration: 0.6, ease: 'back.out(2)' })
      .fromTo('#podium .pod:not(.empty) .step', { scaleY: 0, transformOrigin: '50% 100%' },
        { scaleY: 1, duration: 0.7, stagger: { each: 0.18, from: 'end' }, ease: 'power3.out', clearProps: 'transform' }, '-=0.2')
      .fromTo('#podium .pod:not(.empty) .char', { y: -220, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.15, ease: 'bounce.out' }, '-=0.3')
      .fromTo(['#podium .who', '#podium .pts', '#podium .crown'], { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, stagger: 0.04, duration: 0.4 }, '-=0.4')
      .call(() => fx.celebrate());
  };

  // rivelazione della canzone
  fx.revealIn = (ok) => {
    const tl = gsap.timeline();
    tl.fromTo('#reveal', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.3 })
      .fromTo('.reveal-card', { y: 80, scale: 0.85, rotationX: 18, transformPerspective: 900 },
        { y: 0, scale: 1, rotationX: 0, duration: 0.8, ease: 'back.out(1.4)' }, '<')
      .fromTo('.rv-result', { y: -16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.4 }, '-=0.55')
      .fromTo('.rv-disc', { scale: 0.5, rotation: -120 }, { scale: 1, rotation: 0, duration: 1, ease: 'expo.out', clearProps: 'transform' }, '<')
      .fromTo(['.rv-stage', '.rv-title', '.rv-artist', '.rv-progress', '#rv-results', '.rv-actions'], { y: 18, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, stagger: 0.07, duration: 0.5 }, '-=0.7');
    setTimeout(() => (ok ? fx.confetti() : fx.poop()), 250);
  };
  fx.revealOut = (done) => {
    gsap.timeline({ onComplete: () => { done(); gsap.set(['#reveal', '.reveal-card'], { clearProps: 'all' }); } })
      .to('.reveal-card', { y: 50, scale: 0.92, autoAlpha: 0, duration: 0.3, ease: 'power2.in' })
      .to('#reveal', { autoAlpha: 0, duration: 0.25 }, '-=0.1');
  };

  // la home era già visibile prima che questo file fosse caricato
  const first = document.querySelector('.screen:not(.hidden)');
  if (first) fx.screenIn(first);
})();
