'use strict';
/* Personaggi "ragdoll" con fisica vera (matter.js), stile Happy Wheels / Kick the Buddy.
   Ogni personaggio è fatto di 6 pezzi uniti da articolazioni: le morti rompono le articolazioni,
   spingono, schiacciano o fanno esplodere i pezzi, quindi vengono diverse ogni volta.
   Usa Chars (chars.js) per l'aspetto dei giocatori e store() da app.js per le impostazioni. */
const Ragdoll = (() => {
  const M = window.Matter;
  const INK = '#1d1d27';
  const PARTS = ['armR', 'armL', 'legR', 'legL']; // ordine in cui si perdono i pezzi a ogni errore
  const G = { legW: 13, legH: 46, torsoW: 38, torsoH: 52, headR: 20, armW: 12, armH: 42 };
  const rand = (a, b) => a + Math.random() * (b - a);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gore = () => store('gore') || 'tanto'; // tanto | poco | niente

  /* ---------- foto delle facce ---------- */
  const photos = new Map();
  function photoImg(src) {
    if (!src) return null;
    let img = photos.get(src);
    if (!img) {
      img = new Image();
      img.onload = () => document.querySelectorAll(`img[data-pkey="${CSS.escape(String(src.length) + src.slice(-24))}"]`).forEach((el) => { el.src = portraitURL(JSON.parse(el.dataset.look), +el.dataset.size, true); });
      img.src = src; photos.set(src, img);
    }
    return img.complete && img.naturalWidth ? img : null;
  }

  /* ---------- disegno dei pezzi ---------- */
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function drawHat(ctx, hat, color, r) {
    ctx.save(); ctx.lineWidth = r * 0.12; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
    const t = -r; // sommità della testa
    switch (hat) {
      case 'cap': ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, t * 0.35, r * 0.98, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(r * 0.8, t * 0.35); ctx.lineTo(r * 1.5, t * 0.35); ctx.lineWidth = r * 0.22; ctx.stroke(); break;
      case 'party': ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-r * 0.55, t * 0.7); ctx.lineTo(0, t * 2.1); ctx.lineTo(r * 0.55, t * 0.7); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ffd426'; ctx.beginPath(); ctx.arc(0, t * 2.15, r * 0.2, 0, 7); ctx.fill(); ctx.stroke(); break;
      case 'beanie': ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, t * 0.3, r * 1.0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, t * 1.35, r * 0.25, 0, 7); ctx.fill(); ctx.stroke(); break;
      case 'crown': ctx.fillStyle = '#ffd426'; ctx.beginPath(); ctx.moveTo(-r * 0.7, t * 0.75); ctx.lineTo(-r * 0.75, t * 1.5); ctx.lineTo(-r * 0.35, t * 1.1); ctx.lineTo(0, t * 1.7); ctx.lineTo(r * 0.35, t * 1.1); ctx.lineTo(r * 0.75, t * 1.5); ctx.lineTo(r * 0.7, t * 0.75); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
      case 'horns': ctx.fillStyle = '#ef4444'; [-1, 1].forEach((d) => { ctx.beginPath(); ctx.moveTo(d * r * 0.45, t * 0.8); ctx.quadraticCurveTo(d * r * 1.1, t * 1.2, d * r * 0.85, t * 1.75); ctx.quadraticCurveTo(d * r * 0.7, t * 1.15, d * r * 0.15, t * 0.95); ctx.closePath(); ctx.fill(); ctx.stroke(); }); break;
      case 'tophat': ctx.fillStyle = INK; ctx.fillRect(-r * 0.6, t * 1.9, r * 1.2, r * 1.15); ctx.fillRect(-r * 1.0, t * 0.85, r * 2.0, r * 0.22); ctx.fillStyle = color; ctx.fillRect(-r * 0.6, t * 1.05, r * 1.2, r * 0.22); break;
      case 'headband': ctx.strokeStyle = color; ctx.lineWidth = r * 0.3; ctx.beginPath(); ctx.arc(0, 0, r * 0.98, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
        ctx.lineWidth = r * 0.16; ctx.beginPath(); ctx.moveTo(r * 0.9, t * 0.45); ctx.lineTo(r * 1.4, t * 0.15); ctx.moveTo(r * 0.9, t * 0.45); ctx.lineTo(r * 1.45, t * 0.6); ctx.stroke(); break;
      default:
    }
    ctx.restore();
  }
  function drawHead(ctx, look, s, mood, scale = 1, charred = false) {
    const r = G.headR * s * scale;
    const photo = !charred && photoImg(look.photo);
    ctx.lineWidth = 2.6 * s; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    if (photo) {
      ctx.save(); ctx.clip(); ctx.drawImage(photo, -r, -r, r * 2, r * 2); ctx.restore();
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      if (mood === 'dead') { // anche sulla foto: occhi a X
        ctx.lineWidth = 3 * s; ctx.strokeStyle = '#fff';
        [-1, 1].forEach((d) => { ctx.beginPath(); ctx.moveTo(d * r * 0.42 - r * 0.15, -r * 0.25); ctx.lineTo(d * r * 0.42 + r * 0.15, r * 0.05); ctx.moveTo(d * r * 0.42 + r * 0.15, -r * 0.25); ctx.lineTo(d * r * 0.42 - r * 0.15, r * 0.05); ctx.stroke(); });
      }
    } else {
      ctx.fillStyle = charred ? '#2a2a2a' : look.skin; ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.strokeStyle = INK;
      if (mood === 'dead') {
        ctx.lineWidth = 2.6 * s;
        [-1, 1].forEach((d) => { const ex = d * r * 0.38; ctx.beginPath(); ctx.moveTo(ex - r * 0.14, -r * 0.24); ctx.lineTo(ex + r * 0.14, r * 0.02); ctx.moveTo(ex + r * 0.14, -r * 0.24); ctx.lineTo(ex - r * 0.14, r * 0.02); ctx.stroke(); });
        ctx.beginPath(); ctx.arc(0, r * 0.55, r * 0.22, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
        ctx.fillStyle = '#ff7aa2'; ctx.beginPath(); ctx.ellipse(r * 0.1, r * 0.5, r * 0.1, r * 0.16, 0, 0, 7); ctx.fill(); // lingua fuori
      } else {
        const big = mood === 'hurt' ? 1.5 : 1;
        [-1, 1].forEach((d) => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(d * r * 0.36, -r * 0.1, r * 0.2 * big, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(d * r * 0.36 + r * 0.04, -r * 0.08, r * 0.09 * big, 0, 7); ctx.fill(); });
        ctx.lineWidth = 2.4 * s; ctx.beginPath();
        if (mood === 'hurt') { ctx.ellipse(0, r * 0.45, r * 0.16, r * 0.2, 0, 0, 7); ctx.fillStyle = '#5b1020'; ctx.fill(); ctx.stroke(); }
        else if (mood === 'happy') { ctx.arc(0, r * 0.3, r * 0.36, 0.1, Math.PI - 0.1); ctx.closePath(); ctx.fillStyle = '#5b1020'; ctx.fill(); ctx.stroke(); }
        else { ctx.arc(0, r * 0.25, r * 0.3, 0.35, Math.PI - 0.35); ctx.stroke(); }
      }
      if (look.glasses) { ctx.lineWidth = 2 * s; ctx.strokeStyle = INK; [-1, 1].forEach((d) => { ctx.beginPath(); ctx.arc(d * r * 0.36, -r * 0.1, r * 0.3, 0, 7); ctx.stroke(); }); ctx.beginPath(); ctx.moveTo(-r * 0.07, -r * 0.1); ctx.lineTo(r * 0.07, -r * 0.1); ctx.stroke(); }
      if (look.stache) { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(-r * 0.18, r * 0.2, r * 0.2, r * 0.08, -0.25, 0, 7); ctx.ellipse(r * 0.18, r * 0.2, r * 0.2, r * 0.08, 0.25, 0, 7); ctx.fill(); }
    }
    drawHat(ctx, look.hat, look.color, r);
  }
  function drawPart(ctx, kind, look, s, rag) {
    const charred = rag?.charred;
    const col = charred ? '#2b2b2b' : look.color;
    ctx.lineWidth = 2.4 * s; ctx.strokeStyle = INK;
    if (kind === 'torso') {
      const w = G.torsoW * s; const h = G.torsoH * s;
      rr(ctx, -w / 2, -h / 2, w, h, 14 * s); ctx.fillStyle = col; ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(-w * 0.22, -h * 0.3); ctx.lineTo(w * 0.22, -h * 0.3); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.moveTo(-w / 2 + 2 * s, h * 0.18); ctx.lineTo(w / 2 - 2 * s, h * 0.18); ctx.stroke();
    } else if (kind === 'armL' || kind === 'armR') {
      const w = G.armW * s; const h = G.armH * s;
      rr(ctx, -w / 2, -h / 2, w, h, w / 2); ctx.fillStyle = col; ctx.fill(); ctx.stroke();
      ctx.fillStyle = charred ? '#2a2a2a' : look.skin; ctx.beginPath(); ctx.arc(0, h / 2, w * 0.55, 0, 7); ctx.fill(); ctx.stroke();
    } else if (kind === 'legL' || kind === 'legR') {
      const w = G.legW * s; const h = G.legH * s;
      rr(ctx, -w / 2, -h / 2, w, h, w / 2); ctx.fillStyle = '#2d2d3d'; ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse((kind === 'legL' ? -1 : 1) * 3 * s, h / 2, w * 0.8, w * 0.42, 0, 0, 7); ctx.fill();
    } else if (kind === 'head') {
      drawHead(ctx, look, s, rag ? rag.mood : 'idle', rag ? rag.headScale : 1, charred);
    }
  }

  // posizioni dei pezzi in piedi (centro x, suolo gy)
  function layout(x, gy, s) {
    const legY = gy - (G.legH * s) / 2;
    const torsoY = gy - G.legH * s - (G.torsoH * s) / 2 + 8 * s;
    return {
      legL: { x: x - 9 * s, y: legY }, legR: { x: x + 9 * s, y: legY },
      torso: { x, y: torsoY },
      armL: { x: x - (G.torsoW * s) / 2 - 3 * s, y: torsoY - (G.torsoH * s) / 2 + (G.armH * s) / 2 + 3 * s },
      armR: { x: x + (G.torsoW * s) / 2 + 3 * s, y: torsoY - (G.torsoH * s) / 2 + (G.armH * s) / 2 + 3 * s },
      head: { x, y: torsoY - (G.torsoH * s) / 2 - G.headR * s + 4 * s },
    };
  }
  const DRAW_ORDER = ['legL', 'legR', 'armL', 'torso', 'armR', 'head'];

  /* ---------- ritratto statico (classifiche, statistiche, podio) ---------- */
  const portraits = new Map();
  function portraitURL(look, size = 40, force = false) {
    const key = JSON.stringify(look) + size;
    if (!force && portraits.has(key)) return portraits.get(key);
    const s = size / 80; const W = size; const H = Math.round(170 * s);
    const c = document.createElement('canvas'); const d = 2;
    c.width = W * d; c.height = H * d;
    const ctx = c.getContext('2d'); ctx.scale(d, d);
    const L = layout(W / 2, H - 2 * s, s);
    for (const p of DRAW_ORDER) { ctx.save(); ctx.translate(L[p].x, L[p].y); drawPart(ctx, p, look, s, null); ctx.restore(); }
    const url = c.toDataURL('image/png');
    portraits.set(key, url);
    return url;
  }
  function portrait(look, size = 40, cls = '') {
    const pk = look.photo ? String(look.photo.length) + look.photo.slice(-24) : '';
    return `<img class="portrait ${cls}" src="${portraitURL(look, size)}" width="${size}" height="${Math.round(size * 170 / 80)}" alt=""${pk ? ` data-pkey="${esc(pk)}" data-size="${size}" data-look="${esc(JSON.stringify(look))}"` : ''}>`;
  }

  /* ---------- palco con fisica ---------- */
  function stage(container, { w, h }) {
    const canvas = document.createElement('canvas');
    container.innerHTML = ''; container.appendChild(canvas);
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    const engine = M.Engine.create({ gravity: { y: 1.1 } });
    const groundY = h - 10;
    const ground = M.Bodies.rectangle(w / 2, groundY + 40, w * 6, 80, { isStatic: true, friction: 1, label: 'ground' });
    M.Composite.add(engine.world, ground);
    const st = { canvas, ctx, w, h, dpr, engine, groundY, rags: [], props: [], parts: [], fx: [], decals: [], hooks: [], timers: [], t: 0, alive: true, shake: 0 };

    st.after = (ms, fn) => st.timers.push({ at: st.t + ms, fn });
    st.hook = (fn) => st.hooks.push(fn); // fn(dt) ritorna false per smettere
    st.add = (...bodies) => M.Composite.add(engine.world, bodies);
    st.remove = (...items) => items.forEach((it) => it && M.Composite.remove(engine.world, it));

    // particelle (sangue, fumo, scintille)
    st.particles = [];
    st.blood = (x, y, n = 20, speed = 6, angle = null, spread = Math.PI * 2) => {
      const g = gore();
      if (g === 'poco') n = Math.ceil(n * 0.35);
      for (let i = 0; i < n; i++) {
        const a = angle === null ? rand(0, Math.PI * 2) : angle + rand(-spread / 2, spread / 2);
        const v = rand(speed * 0.3, speed);
        st.particles.push({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rand(1.4, 3.4), life: 120,
          color: g === 'niente' ? ['#ffd426', '#7c5cff', '#ff4d8d', '#3ddc84'][i % 4] : (Math.random() < 0.7 ? '#d1122f' : '#9f0d22'),
          stick: g !== 'niente', grav: 0.32,
        });
      }
    };
    st.smoke = (x, y, n = 6) => { for (let i = 0; i < n; i++) st.particles.push({ x: x + rand(-8, 8), y, vx: rand(-0.4, 0.4), vy: rand(-1.6, -0.6), r: rand(5, 10), life: 70, color: 'rgba(160,160,170,.6)', grav: -0.01, grow: 0.25 }); };
    st.fountain = (getPoint, ms, angle = -Math.PI / 2) => {
      const end = st.t + ms;
      st.hook(() => { if (st.t > end) return false; const p = getPoint(); if (p) st.blood(p.x, p.y, 2, 7, angle, 0.7); return true; });
    };
    st.text = (txt, x, y, color = '#ffd426', size = 26) => {
      const t0 = st.t;
      st.fx.push((c) => {
        const k = (st.t - t0) / 900; if (k > 1) return false;
        const sc = k < 0.15 ? k / 0.15 * 1.25 : 1.25 - Math.min(0.25, (k - 0.15));
        c.save(); c.translate(x, y - k * 18); c.scale(sc, sc); c.globalAlpha = 1 - Math.max(0, (k - 0.6) / 0.4);
        c.font = `900 ${size}px Outfit, sans-serif`; c.textAlign = 'center'; c.lineWidth = 5; c.strokeStyle = INK; c.strokeText(txt, 0, 0); c.fillStyle = color; c.fillText(txt, 0, 0);
        c.restore(); return true;
      });
    };
    st.flash = (ms = 120, color = '#fff') => { const t0 = st.t; st.fx.push((c) => { const k = (st.t - t0) / ms; if (k > 1) return false; c.fillStyle = color; c.globalAlpha = 0.85 * (1 - k); c.fillRect(0, 0, w, h); c.globalAlpha = 1; return true; }); };
    st.shockwave = (x, y, radius, force) => {
      for (const b of M.Composite.allBodies(engine.world)) {
        if (b.isStatic) continue;
        const dx = b.position.x - x; const dy = b.position.y - y; const d = Math.hypot(dx, dy) || 1;
        if (d > radius) continue;
        const f = force * (1 - d / radius) * b.mass;
        M.Body.applyForce(b, b.position, { x: (dx / d) * f, y: (dy / d) * f - f * 0.6 });
      }
      st.shake = 10;
    };
    // oggetto di scena con fisica e disegno personalizzato
    st.prop = (body, draw) => { st.add(body); st.props.push({ body, draw }); return body; };
    st.emoji = (ch, x, y, size, opts = {}) => st.prop(M.Bodies.circle(x, y, size * 0.42, { restitution: 0.3, friction: 0.6, ...opts }), (c, b) => {
      c.save(); c.translate(b.position.x, b.position.y); c.rotate(b.angle); c.font = `${size}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ch, 0, 2); c.restore();
    });

    let last = performance.now();
    function step(now = performance.now()) {
      if (!st.alive) return;
      // tempo reale (max 2 passi da 16 ms per fotogramma): le morti durano uguale anche a pochi fps
      const dt = Math.min(50, Math.max(1, now - last)); last = now;
      const n = Math.min(3, Math.ceil(dt / 16.67));
      for (let i = 0; i < n; i++) M.Engine.update(engine, dt / n);
      st.t += dt;
      // timer e hook creati durante l'esecuzione finiscono nella lista nuova, non vanno persi
      const due = st.timers; st.timers = [];
      for (const tm of due) { if (st.t >= tm.at) tm.fn(); else st.timers.push(tm); }
      const hs = st.hooks; st.hooks = [];
      for (const fn of hs) if (fn() !== false) st.hooks.push(fn);
      st.particles = st.particles.filter((p) => {
        p.vy += p.grav; p.x += p.vx; p.y += p.vy; p.life--; if (p.grow) p.r += p.grow;
        if (p.stick && p.y >= groundY - 1) { if (st.decals.length < 160) st.decals.push({ x: p.x, rx: p.r * rand(1.6, 3), ry: p.r * 0.55, color: '#8f0b1e' }); return false; }
        return p.life > 0;
      });
      draw();
      requestAnimationFrame(step);
    }
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (st.shake > 0) { ctx.translate(rand(-st.shake, st.shake), rand(-st.shake, st.shake)); st.shake *= 0.85; if (st.shake < 0.5) st.shake = 0; }
      // pavimento
      const grd = ctx.createLinearGradient(0, groundY, 0, h); grd.addColorStop(0, 'rgba(255,255,255,.10)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd; ctx.fillRect(-20, groundY, w + 40, h - groundY + 20);
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(w, groundY); ctx.stroke();
      for (const d of st.decals) { ctx.fillStyle = d.color; ctx.beginPath(); ctx.ellipse(d.x, groundY, d.rx, d.ry, 0, 0, 7); ctx.fill(); }
      // ombre
      for (const rg of st.rags) { const t = rg.parts.torso; if (!t) continue; const lift = Math.max(0, groundY - t.position.y - 50 * rg.s); ctx.fillStyle = `rgba(0,0,0,${Math.max(0.05, 0.3 - lift / 400)})`; ctx.beginPath(); ctx.ellipse(t.position.x, groundY + 1, 26 * rg.s, 5 * rg.s, 0, 0, 7); ctx.fill(); }
      for (const p of st.props) p.draw(ctx, p.body);
      for (const rg of st.rags) {
        for (const k of DRAW_ORDER) {
          const b = rg.parts[k]; if (!b) continue;
          ctx.save(); ctx.translate(b.position.x, b.position.y); ctx.rotate(b.angle);
          drawPart(ctx, k, rg.look, rg.s, rg); ctx.restore();
        }
      }
      for (const p of st.particles) { ctx.fillStyle = p.color; ctx.globalAlpha = p.grow ? Math.max(0, p.life / 70) : 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
      ctx.globalAlpha = 1;
      st.fx = st.fx.filter((fn) => fn(ctx) !== false);
    }
    st.destroy = () => { st.alive = false; M.Engine.clear(engine); canvas.remove(); };
    requestAnimationFrame(step);
    return st;
  }

  /* ---------- il personaggio ---------- */
  function addRag(st, look, x, s = 1, missing = 0) {
    const L = layout(x, st.groundY, s);
    const group = M.Body.nextGroup(true);
    const opt = (extra = {}) => ({ collisionFilter: { group }, friction: 0.9, frictionAir: 0.015, restitution: 0.15, density: 0.0016, ...extra });
    const parts = {
      legL: M.Bodies.rectangle(L.legL.x, L.legL.y, G.legW * s, G.legH * s, opt({ chamfer: { radius: 6 * s } })),
      legR: M.Bodies.rectangle(L.legR.x, L.legR.y, G.legW * s, G.legH * s, opt({ chamfer: { radius: 6 * s } })),
      torso: M.Bodies.rectangle(L.torso.x, L.torso.y, G.torsoW * s, G.torsoH * s, opt({ chamfer: { radius: 13 * s }, density: 0.002 })),
      armL: M.Bodies.rectangle(L.armL.x, L.armL.y, G.armW * s, G.armH * s, opt({ chamfer: { radius: 5 * s } })),
      armR: M.Bodies.rectangle(L.armR.x, L.armR.y, G.armW * s, G.armH * s, opt({ chamfer: { radius: 5 * s } })),
      head: M.Bodies.circle(L.head.x, L.head.y, G.headR * s, opt({ density: 0.0018 })),
    };
    const T = G.torsoH * s / 2; const TW = G.torsoW * s / 2;
    const pin = (bA, pA, bB, pB, stiff = 1) => {
      const wa = M.Vector.add(bA.position, pA); const wb = M.Vector.add(bB.position, pB);
      return M.Constraint.create({ bodyA: bA, pointA: pA, bodyB: bB, pointB: pB, length: M.Vector.magnitude(M.Vector.sub(wa, wb)), stiffness: stiff, damping: 0.08, render: { visible: false } });
    };
    const tor = parts.torso;
    const joints = {
      head: { main: [pin(tor, { x: 0, y: -T }, parts.head, { x: 0, y: G.headR * s - 4 * s })], stiff: [pin(tor, { x: 0, y: 0 }, parts.head, { x: 0, y: 0 }, 0.6)] },
      armL: { main: [pin(tor, { x: -TW + 1 * s, y: -T + 6 * s }, parts.armL, { x: 0, y: -G.armH * s / 2 + 5 * s })], stiff: [pin(tor, { x: -TW, y: T }, parts.armL, { x: 0, y: G.armH * s / 2 }, 0.4)] },
      armR: { main: [pin(tor, { x: TW - 1 * s, y: -T + 6 * s }, parts.armR, { x: 0, y: -G.armH * s / 2 + 5 * s })], stiff: [pin(tor, { x: TW, y: T }, parts.armR, { x: 0, y: G.armH * s / 2 }, 0.4)] },
      legL: { main: [pin(tor, { x: -9 * s, y: T - 6 * s }, parts.legL, { x: 0, y: -G.legH * s / 2 + 5 * s })], stiff: [pin(tor, { x: 0, y: 0 }, parts.legL, { x: 0, y: G.legH * s / 2 }, 0.7)] },
      legR: { main: [pin(tor, { x: 9 * s, y: T - 6 * s }, parts.legR, { x: 0, y: -G.legH * s / 2 + 5 * s })], stiff: [pin(tor, { x: 0, y: 0 }, parts.legR, { x: 0, y: G.legH * s / 2 }, 0.7)] },
    };
    // il busto è "appeso" a due punti fissi finché è vivo: sta in piedi ma ondeggia
    const anchors = [{ x: L.torso.x, y: L.torso.y - 16 * s }, { x: L.torso.x, y: L.torso.y + 16 * s }];
    const pins = anchors.map((a, i) => M.Constraint.create({ pointA: { ...a }, bodyB: tor, pointB: { x: 0, y: i ? 16 * s : -16 * s }, length: 0, stiffness: 0.3, damping: 0.1 }));
    const rag = { st, look, s, x, parts, joints, pins, anchors, mood: 'idle', headScale: 1, charred: false, loose: false, detached: new Set() };
    const removed = new Set(PARTS.slice(0, missing));
    for (const k of removed) delete parts[k];
    st.add(...Object.values(parts), ...pins);
    for (const [k, j] of Object.entries(joints)) if (!removed.has(k)) st.add(...j.main, ...j.stiff);
    removed.forEach((k) => rag.detached.add(k));
    st.rags.push(rag);
    return rag;
  }

  const stump = (rag, part) => { const c = rag.joints[part].main[0]; return M.Vector.add(c.bodyA.position, M.Vector.rotate(c.pointA, c.bodyA.angle)); };
  function breakJoint(rag, part, push = 0.012) {
    if (!rag.parts[part] || rag.detached.has(part)) return null;
    const p = stump(rag, part);
    rag.st.remove(...rag.joints[part].main, ...rag.joints[part].stiff);
    rag.detached.add(part);
    const b = rag.parts[part]; const dir = Math.sign(b.position.x - rag.parts.torso.position.x) || (Math.random() < 0.5 ? -1 : 1);
    M.Body.applyForce(b, b.position, { x: dir * push * b.mass * 60, y: -push * b.mass * 80 });
    M.Body.setAngularVelocity(b, dir * rand(0.2, 0.5));
    rag.st.blood(p.x, p.y, 18, 6, part === 'head' ? -Math.PI / 2 : null, 1.4);
    return p;
  }
  function release(rag) {
    if (rag.loose) return; rag.loose = true;
    rag.st.remove(...rag.pins);
    for (const j of Object.values(rag.joints)) rag.st.remove(...j.stiff);
  }
  function removePart(rag, part) { if (!rag.parts[part]) return; rag.st.remove(rag.parts[part], ...rag.joints[part].main, ...rag.joints[part].stiff); delete rag.parts[part]; rag.detached.add(part); }
  const kill = (rag) => { rag.mood = 'dead'; };
  const all = (rag) => Object.values(rag.parts);
  const push = (b, fx, fy) => b && M.Body.applyForce(b, b.position, { x: fx * b.mass, y: fy * b.mass });

  /* ---------- un errore durante il round: vola via un pezzo ---------- */
  function damage(rag, hits) {
    if (!rag) return;
    const part = PARTS[hits - 1];
    rag.mood = 'hurt'; rag.st.after(700, () => { if (rag.mood === 'hurt') rag.mood = 'idle'; });
    if (part && rag.parts[part] && !rag.detached.has(part)) breakJoint(rag, part, 0.02);
    else { push(rag.parts.head, rand(-0.02, 0.02), -0.03); rag.st.blood(rag.parts.torso.position.x, rag.parts.torso.position.y, 8, 4); }
    rag.st.shake = 4;
  }

  /* ---------- vittoria: saltelli e braccia al cielo ---------- */
  function dance(rag) {
    if (!rag) return;
    rag.mood = 'happy';
    ['armL', 'armR'].forEach((a) => rag.joints[a] && rag.st.remove(...rag.joints[a].stiff));
    const base = rag.anchors.map((a) => a.y); const t0 = rag.st.t;
    rag.st.hook(() => {
      const k = rag.st.t - t0; if (k > 2600 || rag.loose) { rag.pins.forEach((p, i) => { p.pointA.y = base[i]; }); return false; }
      const off = Math.abs(Math.sin(k / 170)) * 20 * rag.s;
      rag.pins.forEach((p, i) => { p.pointA.y = base[i] - off; });
      if (Math.random() < 0.18) ['armL', 'armR'].forEach((a) => push(rag.parts[a], (a === 'armL' ? -1 : 1) * 0.004, -0.012));
      return true;
    });
  }

  /* ---------- le morti ---------- */
  const KILLS = {
    vinile(st, rag) { // un disco lanciato come un frisbee taglia la testa
      const head = rag.parts.head; const neckY = rag.parts.torso.position.y - G.torsoH * rag.s / 2;
      const disc = st.emoji('💿', -30, neckY, 30 * rag.s, { isSensor: true, frictionAir: 0 });
      M.Body.setStatic(disc, false); M.Body.setVelocity(disc, { x: 14, y: 0 }); M.Body.setAngularVelocity(disc, 0.5);
      disc.collisionFilter = { group: -999, mask: 0 };
      st.hook(() => {
        M.Body.setVelocity(disc, { x: 14, y: 0 });
        if (disc.position.x >= rag.x - 4 && !rag.loose) {
          kill(rag); const p = breakJoint(rag, 'head', 0.03); release(rag);
          push(head, 0.02, -0.06); st.fountain(() => (rag.parts.torso ? stump(rag, 'head') : p), 1500);
          st.text('ZAC!', rag.x + 20, neckY - 30);
        }
        return disc.position.x < st.w + 60;
      });
    },
    bomba(st, rag) {
      const bomb = st.emoji('💣', rag.x + 28 * rag.s, -30, 34 * rag.s, { restitution: 0.35, density: 0.004 });
      st.after(1300, () => {
        st.remove(bomb); st.props = st.props.filter((p) => p.body !== bomb);
        kill(rag); release(rag); PARTS.concat('head').forEach((k) => breakJoint(rag, k, 0.01));
        st.shockwave(bomb.position.x, bomb.position.y + 10, 260, 0.09);
        st.flash(160, '#fff3b0'); st.text('BOOM!', bomb.position.x, bomb.position.y - 40, '#ff8a3d', 34);
        st.blood(bomb.position.x, bomb.position.y, 60, 11); st.smoke(bomb.position.x, bomb.position.y, 12);
      });
    },
    pianoforte(st, rag) {
      const s = rag.s; const pw = 110 * s; const ph = 64 * s;
      const piano = st.prop(M.Bodies.rectangle(rag.x, -ph, pw, ph, { density: 0.03, friction: 0.8, restitution: 0.05, chamfer: { radius: 6 * s } }), (c, b) => {
        c.save(); c.translate(b.position.x, b.position.y); c.rotate(b.angle);
        c.fillStyle = '#121218'; c.strokeStyle = '#000'; c.lineWidth = 2; rr(c, -pw / 2, -ph / 2, pw, ph, 6 * s); c.fill(); c.stroke();
        c.fillStyle = '#f5f5f7'; c.fillRect(-pw / 2 + 6 * s, ph * 0.05, pw - 12 * s, ph * 0.3);
        c.fillStyle = '#121218'; for (let i = 1; i < 11; i++) if (i % 7 !== 3 && i % 7 !== 0) c.fillRect(-pw / 2 + 6 * s + i * (pw - 12 * s) / 11 - 2 * s, ph * 0.05, 4 * s, ph * 0.18);
        c.fillStyle = '#ffd426'; c.font = `${12 * s}px serif`; c.fillText('♪', -pw / 2 + 8 * s, -ph * 0.15);
        c.restore();
      });
      let hit = false;
      st.hook(() => {
        if (!hit && piano.position.y + ph / 2 >= (rag.parts.head ? rag.parts.head.position.y - G.headR * s : st.groundY - 60)) {
          hit = true; kill(rag); release(rag); breakJoint(rag, 'head', 0.005); breakJoint(rag, Math.random() < 0.5 ? 'armL' : 'armR', 0.02);
          st.text('CRASH!', rag.x, 30, '#ffd426', 30); st.shake = 14;
          st.after(250, () => { st.blood(rag.x - 40 * s, st.groundY - 6, 25, 8, Math.PI + 0.3, 0.8); st.blood(rag.x + 40 * s, st.groundY - 6, 25, 8, -0.3, 0.8); });
        }
        return !hit;
      });
    },
    incudine(st, rag) {
      const s = rag.s; const aw = 56 * s; const ah = 28 * s;
      const anvil = st.prop(M.Bodies.rectangle(rag.x + 4, -40, aw, ah, { density: 0.05, restitution: 0.1 }), (c, b) => {
        c.save(); c.translate(b.position.x, b.position.y); c.rotate(b.angle); c.fillStyle = '#5b5b66'; c.strokeStyle = INK; c.lineWidth = 2.5;
        c.beginPath(); c.moveTo(-aw / 2, -ah / 2); c.lineTo(aw / 2, -ah / 2); c.lineTo(aw * 0.32, 0); c.lineTo(aw * 0.36, ah / 2); c.lineTo(-aw * 0.36, ah / 2); c.lineTo(-aw * 0.32, 0); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(-aw / 2 + 4, -ah / 2 + 3, aw - 8, 3); c.restore();
      });
      let hit = false;
      st.hook(() => {
        const head = rag.parts.head;
        if (!hit && head && anvil.position.y + ah / 2 >= head.position.y - G.headR * s) {
          hit = true; kill(rag); rag.headScale = 0.7; release(rag);
          const p = breakJoint(rag, 'head', 0.002); push(head, rand(-0.05, 0.05), 0.02);
          st.text('DONK!', rag.x, head.position.y - 40); st.shake = 10;
          st.fountain(() => (rag.parts.torso ? stump(rag, 'head') : p), 1000);
        }
        return !hit;
      });
    },
    cecchino(st, rag) {
      const head = rag.parts.head;
      st.text('BANG!', st.w - 30, 30, '#ffd426', 24);
      st.after(220, () => {
        const y = head.position.y; const t0 = st.t;
        st.fx.push((c) => { const k = (st.t - t0) / 120; if (k > 1) return false; c.strokeStyle = '#fff6c9'; c.lineWidth = 2; c.globalAlpha = 1 - k; c.beginPath(); c.moveTo(st.w, y - 10); c.lineTo(head.position.x, y); c.stroke(); c.globalAlpha = 1; return true; });
        kill(rag); release(rag);
        push(head, -0.09, -0.02); push(rag.parts.torso, -0.03, 0);
        st.blood(head.position.x - G.headR * rag.s, y, 40, 10, Math.PI, 0.9);
        if (Math.random() < 0.6) breakJoint(rag, 'head', 0.01);
      });
    },
    cassa(st, rag) { // i bassi della cassa lo sparano via
      const sp = st.prop(M.Bodies.rectangle(30, st.groundY - 30 * rag.s, 46 * rag.s, 60 * rag.s, { isStatic: true }), (c, b) => {
        const s = rag.s; c.save(); c.translate(b.position.x, b.position.y); const pulse = 1 + Math.sin(st.t / 60) * 0.06;
        c.fillStyle = '#18181f'; c.strokeStyle = '#3a3a48'; c.lineWidth = 2; rr(c, -23 * s, -30 * s, 46 * s, 60 * s, 6 * s); c.fill(); c.stroke();
        c.fillStyle = '#2f2f3d'; c.beginPath(); c.arc(0, 10 * s, 15 * s * pulse, 0, 7); c.fill(); c.fillStyle = '#ffd426'; c.beginPath(); c.arc(0, 10 * s, 5 * s, 0, 7); c.fill();
        c.fillStyle = '#2f2f3d'; c.beginPath(); c.arc(0, -16 * s, 7 * s, 0, 7); c.fill(); c.restore();
      });
      [0, 400, 800].forEach((d, i) => st.after(d, () => {
        const t0 = st.t;
        st.fx.push((c) => { const k = (st.t - t0) / 500; if (k > 1) return false; c.strokeStyle = `rgba(255,212,38,${1 - k})`; c.lineWidth = 3 + i * 2; c.beginPath(); c.arc(sp.position.x + 20, sp.position.y, 20 + k * 160, -0.7, 0.7); c.stroke(); return true; });
        if (i === 2) {
          kill(rag); release(rag); st.text('BWOOM!', rag.x, 40, '#7c5cff', 28);
          all(rag).forEach((b) => push(b, 0.035, -0.03));
          st.after(260, () => { breakJoint(rag, 'head', 0.03); });
        } else { all(rag).forEach((b) => push(b, 0.004, 0)); rag.mood = 'hurt'; }
      }));
    },
    squalo(st, rag) {
      const t0 = st.t; const x = rag.x;
      st.fx.push((c) => {
        const k = (st.t - t0) / 1800; if (k > 1) return false;
        const rise = k < 0.35 ? k / 0.35 : k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
        c.save(); c.beginPath(); c.rect(0, 0, st.w, st.groundY); c.clip();
        c.font = `${74 * rag.s}px serif`; c.textAlign = 'center'; c.translate(x, st.groundY + 50 * rag.s - rise * 75 * rag.s); c.rotate(-Math.PI / 2); c.fillText('🦈', 0, 0); c.restore();
        return true;
      });
      st.after(650, () => {
        kill(rag); st.text('CHOMP!', x, st.groundY - 110 * rag.s, '#22b8ff');
        const pts = ['legL', 'legR'].filter((k) => rag.parts[k]).map((k) => stump(rag, k));
        ['legL', 'legR'].forEach((k) => removePart(rag, k)); release(rag);
        pts.forEach((p) => st.fountain(() => p, 900, -Math.PI / 2 + rand(-0.4, 0.4)));
        st.shake = 8;
      });
    },
    calcione(st, rag) {
      const boot = st.emoji('🦶', -40, rag.parts.torso.position.y, 64 * rag.s, { isStatic: true });
      st.hook(() => {
        M.Body.setPosition(boot, { x: boot.position.x + 18, y: boot.position.y });
        if (!rag.loose && boot.position.x >= rag.x - 40 * rag.s) {
          kill(rag); release(rag); st.text('POW!', rag.x, 40, '#ff4d8d', 32); st.shake = 12;
          all(rag).forEach((b) => push(b, 0.06, -0.07)); M.Body.setAngularVelocity(rag.parts.torso, 0.4);
          st.blood(rag.x, rag.parts.torso.position.y, 20, 6, 0, 1);
        }
        return boot.position.x < st.w + 80;
      });
    },
    fulmine(st, rag) {
      const x = rag.x; let n = 0;
      const bolt = (c) => {
        c.save(); c.strokeStyle = '#fde047'; c.lineWidth = 4; c.shadowColor = '#fde047'; c.shadowBlur = 18; c.beginPath();
        let px = x + rand(-10, 10); c.moveTo(px, -10);
        for (let y = 0; y < rag.parts.head.position.y; y += 18) { px += rand(-14, 14); c.lineTo(px, y); }
        c.lineTo(x, rag.parts.head.position.y); c.stroke(); c.restore();
      };
      const t0 = st.t;
      st.fx.push((c) => { const k = st.t - t0; if (k > 600) return false; if (Math.floor(k / 80) % 2 === 0) bolt(c); return true; });
      st.after(150, () => { st.flash(90, '#fff8c4'); kill(rag); rag.charred = true; });
      st.hook(() => { if (st.t - t0 > 700) return false; all(rag).forEach((b) => M.Body.translate(b, { x: rand(-1.5, 1.5), y: 0 })); return true; });
      st.after(700, () => { release(rag); st.text('ZZZAP!', x, 36, '#fde047'); });
      for (let i = 0; i < 6; i++) st.after(700 + i * 160, () => { if (rag.parts.head) st.smoke(rag.parts.head.position.x, rag.parts.head.position.y - 10, 3); else st.smoke(x, st.groundY - 30, 3); });
      n++;
    },
    katana(st, rag) {
      const t0 = st.t; const y0 = rag.parts.head.position.y + 10; const x0 = rag.x;
      st.fx.push((c) => { const k = (st.t - t0) / 180; if (k > 1.6) return false; c.strokeStyle = '#e4e4e7'; c.lineWidth = 3; c.globalAlpha = Math.max(0, 1 - Math.max(0, k - 1)); c.beginPath(); c.moveTo(x0 - 70, y0 - 30); c.lineTo(x0 - 70 + 140 * Math.min(1, k), y0 - 30 + 90 * Math.min(1, k)); c.stroke(); c.globalAlpha = 1; return true; });
      st.text('SLASH!', x0, 28, '#e4e4e7');
      st.after(200, () => {
        kill(rag); release(rag);
        ['head', 'armL', 'armR'].forEach((k) => breakJoint(rag, k, 0.02));
        st.fountain(() => (rag.parts.torso ? M.Vector.add(rag.parts.torso.position, M.Vector.rotate({ x: 0, y: -G.torsoH * rag.s / 2 }, rag.parts.torso.angle)) : null), 1300);
      });
    },
    meteorite(st, rag) {
      const m = st.emoji('☄️', rag.x - 160, -60, 50 * rag.s, { isSensor: true, frictionAir: 0 });
      m.collisionFilter = { group: -998, mask: 0 };
      st.hook(() => {
        M.Body.setVelocity(m, { x: 7, y: 9 });
        st.particles.push({ x: m.position.x - 10, y: m.position.y - 10, vx: rand(-1, 0), vy: rand(-1, 0), r: rand(3, 6), life: 20, color: Math.random() < 0.5 ? '#ff8a3d' : '#fde047', grav: 0 });
        if (m.position.y >= st.groundY - 30) {
          st.remove(m); st.props = st.props.filter((p) => p.body !== m);
          kill(rag); release(rag); PARTS.concat('head').forEach((k) => breakJoint(rag, k, 0.01));
          st.shockwave(m.position.x, st.groundY, 320, 0.12); st.flash(200, '#ffb020'); st.text('KABOOM!', rag.x, 40, '#ff8a3d', 34);
          st.blood(rag.x, st.groundY - 30, 70, 12); st.smoke(m.position.x, st.groundY - 10, 16);
          return false;
        }
        return true;
      });
    },
    stonata(st, rag) { // una nota stonata gli fa esplodere la testa
      const t0 = st.t;
      st.fx.push((c) => {
        const k = st.t - t0; if (k > 1300 || !rag.parts.head) return false;
        const h = rag.parts.head.position;
        for (let i = 0; i < 4; i++) { const a = k / 180 + i * Math.PI / 2; c.font = `${16 * rag.s}px serif`; c.fillStyle = '#ffd426'; c.fillText(i % 2 ? '♪' : '♫', h.x + Math.cos(a) * 36 * rag.s - 6, h.y + Math.sin(a) * 22 * rag.s); }
        return true;
      });
      st.hook(() => {
        const k = st.t - t0; if (k > 1250) return false;
        rag.mood = 'hurt'; rag.headScale = 1 + (k / 1250) * 0.8;
        if (rag.parts.head) M.Body.translate(rag.parts.head, { x: rand(-1, 1) * (k / 1250) * 2, y: 0 });
        return true;
      });
      st.after(1260, () => {
        const h = rag.parts.head.position; kill(rag);
        st.text('POP!', h.x, h.y - 20, '#ff4d8d', 32); st.blood(h.x, h.y, 70, 10);
        const neck = stump(rag, 'head'); removePart(rag, 'head'); release(rag);
        st.fountain(() => (rag.parts.torso ? M.Vector.add(rag.parts.torso.position, M.Vector.rotate({ x: 0, y: -G.torsoH * rag.s / 2 }, rag.parts.torso.angle)) : neck), 1400);
      });
    },
    ufo(st, rag) {
      const t0 = st.t; let ufoX = rag.x; const ufoY = 26;
      st.fx.push((c) => {
        const k = st.t - t0; if (k > 2600) return false;
        const beam = k > 300 && k < 1700;
        if (beam) { c.fillStyle = 'rgba(163,230,53,.18)'; c.beginPath(); c.moveTo(ufoX - 14, ufoY + 10); c.lineTo(ufoX + 14, ufoY + 10); c.lineTo(ufoX + 50, st.groundY); c.lineTo(ufoX - 50, st.groundY); c.closePath(); c.fill(); }
        c.font = `${44 * rag.s}px serif`; c.textAlign = 'center'; c.fillText('🛸', ufoX + Math.sin(k / 120) * 4, ufoY + 12); return true;
      });
      st.after(300, () => { release(rag); rag.mood = 'hurt'; });
      st.hook(() => { const k = st.t - t0; if (k < 300 || k > 1700) return k <= 1700; all(rag).forEach((b) => M.Body.applyForce(b, b.position, { x: (ufoX - b.position.x) * 0.00002 * b.mass, y: -0.0021 * b.mass })); return true; });
      st.after(1700, () => { kill(rag); st.text('BYE!', ufoX, 60, '#a3e635'); all(rag).forEach((b) => push(b, 0, 0.02)); });
      st.after(2350, () => { const t = rag.parts.torso; st.blood(t.position.x, st.groundY - 8, 50, 9, -Math.PI / 2, 2.6); st.text('SPLAT!', t.position.x, st.groundY - 60, '#e5484d'); breakJoint(rag, 'legL', 0.02); breakJoint(rag, 'armR', 0.02); st.shake = 10; });
    },
    spuntoni(st, rag) {
      const t0 = st.t; const x = rag.x; const n = 7; const sw = 12 * rag.s;
      st.fx.push((c) => {
        const k = Math.min(1, (st.t - t0) / 160);
        c.fillStyle = '#d4d4d8'; c.strokeStyle = INK; c.lineWidth = 1.5;
        for (let i = 0; i < n; i++) { const sx = x - (n * sw) / 2 + i * sw; c.beginPath(); c.moveTo(sx, st.groundY); c.lineTo(sx + sw / 2, st.groundY - 30 * rag.s * k); c.lineTo(sx + sw, st.groundY); c.closePath(); c.fill(); c.stroke(); }
        return st.alive;
      });
      st.after(120, () => {
        kill(rag); release(rag); st.text('STAB!', x, 36, '#d4d4d8');
        push(rag.parts.torso, 0, -0.04);
        ['legL', 'legR'].forEach((k) => breakJoint(rag, k, 0.015));
        for (let i = 0; i < 5; i++) st.blood(x - 30 + i * 15, st.groundY - 25 * rag.s, 8, 7, -Math.PI / 2, 0.8);
      });
    },
  };
  const KILL_IDS = Object.keys(KILLS);
  const LABEL = {
    vinile: 'è stato decapitato da un vinile volante', bomba: 'è saltato in aria', pianoforte: 'è stato schiacciato da un pianoforte',
    incudine: "ha preso un'incudine in testa", cecchino: 'è stato centrato da un cecchino', cassa: 'è stato sparato via dai bassi',
    squalo: 'è stato mangiato da uno squalo', calcione: 'è stato preso a calci fuori dallo schermo', fulmine: 'è stato fulminato',
    katana: 'è stato affettato da una katana', meteorite: 'è stato centrato da un meteorite', stonata: 'gli è esplosa la testa per una nota stonata',
    ufo: 'è stato rapito e buttato giù dagli alieni', spuntoni: 'è caduto sugli spuntoni',
  };
  const SHORT = {
    vinile: 'decapitato', bomba: 'esploso', pianoforte: 'schiacciato', incudine: 'incudine', cecchino: 'cecchino', cassa: 'sparato via',
    squalo: 'mangiato', calcione: 'calciato via', fulmine: 'fulminato', katana: 'affettato', meteorite: 'meteorite', stonata: 'testa esplosa',
    ufo: 'rapito', spuntoni: 'impalato',
  };
  let lastKill = null;
  function killRag(rag, type) {
    let t = type;
    if (!t) { do { t = KILL_IDS[Math.floor(Math.random() * KILL_IDS.length)]; } while (t === lastKill && KILL_IDS.length > 1); }
    lastKill = t;
    if (!rag) return t;
    if (reduce) { kill(rag); release(rag); return t; }
    KILLS[t](rag.st, rag);
    return t;
  }

  return { stage, addRag, damage, dance, kill: killRag, portrait, portraitURL, KILL_IDS, LABEL, SHORT, PARTS, available: !!M };
})();
