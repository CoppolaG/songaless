'use strict';
/* Personaggi "ragdoll" con fisica vera (matter.js), stile Happy Wheels.
   Scheletro da 11 pezzi (testa, petto, bacino, braccia, avambracci, cosce, stinchi) con articolazioni
   che si piegano solo nel verso giusto e un po' di "tono muscolare" finché il personaggio è vivo.
   Quando un'articolazione si rompe restano ferite vere: spina dorsale, ossa che sporgono, sangue a fiotti.
   Usa Chars (chars.js) per l'aspetto, store() da app.js per le impostazioni e player.ctx per i suoni. */
const Ragdoll = (() => {
  const M = window.Matter;
  const INK = '#1d1d27';
  const BONE = '#f1ead8';
  const S = { headR: 20, chestW: 38, chestH: 34, pelvisW: 34, pelvisH: 22, uArmW: 11, uArmH: 25, lArmW: 10, lArmH: 24, thighW: 13, thighH: 27, shinW: 12, shinH: 27 };
  // ordine in cui si perdono i pezzi a ogni errore
  const DAMAGE = ['lowerArmR', 'lowerArmL', 'shinR', 'shinL', 'upperArmR', 'upperArmL', 'thighR', 'thighL'];
  const CHILDREN = {
    chest: ['head', 'pelvis', 'upperArmL', 'upperArmR'], pelvis: ['thighL', 'thighR'],
    upperArmL: ['lowerArmL'], upperArmR: ['lowerArmR'], thighL: ['shinL'], thighR: ['shinR'],
  };
  const rand = (a, b) => a + Math.random() * (b - a);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gore = () => store('gore') || 'tanto'; // tanto | poco | niente
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

  /* ---------- effetti sonori sintetizzati (niente file da scaricare) ---------- */
  const SFX = (() => {
    let noiseBuf = null; let lastAt = {};
    const ctx = () => { const c = typeof player !== 'undefined' ? player.ctx : null; return c && c.state === 'running' && store('sfx') !== false ? c : null; };
    const noise = (c) => {
      if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      return noiseBuf;
    };
    function burst({ dur = 0.3, freq = 800, q = 1, type = 'lowpass', vol = 0.3, sweep = null, delay = 0 }) {
      const c = ctx(); if (!c) return;
      const t = c.currentTime + delay;
      const src = c.createBufferSource(); src.buffer = noise(c);
      const f = c.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
      if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(c.destination); src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
    }
    function tone({ f0 = 120, f1 = 40, dur = 0.25, vol = 0.35, type = 'sine', delay = 0 }) {
      const c = ctx(); if (!c) return;
      const t = c.currentTime + delay;
      const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
    }
    const once = (k, ms, fn) => { const n = performance.now(); if (n - (lastAt[k] || 0) < ms) return; lastAt[k] = n; fn(); };
    return {
      thud: () => once('thud', 60, () => { tone({ f0: 150, f1: 45, dur: 0.22, vol: 0.45 }); burst({ dur: 0.1, freq: 500, vol: 0.18 }); }),
      splat: () => once('splat', 70, () => burst({ dur: 0.38, freq: 2200, sweep: 250, q: 3, vol: 0.32 })),
      crunch: () => once('crunch', 90, () => { for (let i = 0; i < 4; i++) burst({ dur: 0.05, freq: rand(1800, 3500), q: 6, type: 'bandpass', vol: 0.4, delay: i * 0.03 }); }),
      boom: () => { tone({ f0: 95, f1: 28, dur: 0.9, vol: 0.7 }); burst({ dur: 1.1, freq: 1200, sweep: 70, vol: 0.55 }); },
      slash: () => burst({ dur: 0.2, freq: 2500, sweep: 9000, type: 'highpass', vol: 0.28 }),
      bang: () => { burst({ dur: 0.28, freq: 1800, sweep: 180, vol: 0.65 }); tone({ f0: 220, f1: 60, dur: 0.14, vol: 0.3 }); },
      zap: () => { tone({ f0: 900, f1: 90, dur: 0.55, vol: 0.18, type: 'square' }); burst({ dur: 0.5, freq: 4000, type: 'highpass', vol: 0.15 }); },
      pop: () => { tone({ f0: 500, f1: 1400, dur: 0.07, vol: 0.35, type: 'triangle' }); burst({ dur: 0.2, freq: 3000, sweep: 400, vol: 0.4 }); },
      whoosh: () => burst({ dur: 0.45, freq: 400, sweep: 2600, type: 'bandpass', q: 1.2, vol: 0.22 }),
      chomp: () => { burst({ dur: 0.12, freq: 900, vol: 0.5 }); burst({ dur: 0.12, freq: 700, vol: 0.5, delay: 0.16 }); },
      boing: () => tone({ f0: 180, f1: 520, dur: 0.3, vol: 0.25, type: 'triangle' }),
    };
  })();

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

  /* ---------- disegno ---------- */
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function drawHat(ctx, hat, color, r) {
    ctx.save(); ctx.lineWidth = r * 0.12; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
    const t = -r;
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
    const r = S.headR * s * scale;
    const photo = !charred && photoImg(look.photo);
    ctx.lineWidth = 2.6 * s; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    if (photo) {
      ctx.save(); ctx.clip(); ctx.drawImage(photo, -r, -r, r * 2, r * 2); ctx.restore();
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
      if (look.faceStyle === 'photo') {
        if (mood === 'dead') {
          ctx.lineWidth = 3 * s; ctx.strokeStyle = '#fff';
          [-1, 1].forEach((d) => { ctx.beginPath(); ctx.moveTo(d * r * 0.42 - r * 0.15, -r * 0.25); ctx.lineTo(d * r * 0.42 + r * 0.15, r * 0.05); ctx.moveTo(d * r * 0.42 + r * 0.15, -r * 0.25); ctx.lineTo(d * r * 0.42 - r * 0.15, r * 0.05); ctx.stroke(); });
        }
      } else drawFace(ctx, r, s, mood, true); // foto con gli occhioni e la bocca degli omini sopra
    } else {
      ctx.fillStyle = charred ? '#2a2a2a' : look.skin; ctx.fill(); ctx.stroke();
      drawFace(ctx, r, s, mood, false);
      if (look.glasses) { ctx.lineWidth = 2 * s; ctx.strokeStyle = INK; [-1, 1].forEach((d) => { ctx.beginPath(); ctx.arc(d * r * 0.36, -r * 0.1, r * 0.3, 0, 7); ctx.stroke(); }); ctx.beginPath(); ctx.moveTo(-r * 0.07, -r * 0.1); ctx.lineTo(r * 0.07, -r * 0.1); ctx.stroke(); }
      if (look.stache) { ctx.fillStyle = INK; ctx.beginPath(); ctx.ellipse(-r * 0.18, r * 0.2, r * 0.2, r * 0.08, -0.25, 0, 7); ctx.ellipse(r * 0.18, r * 0.2, r * 0.2, r * 0.08, 0.25, 0, 7); ctx.fill(); }
    }
    drawHat(ctx, look.hat, look.color, r);
  }
  // occhi e bocca da cartone (sulla pelle disegnata o sopra la foto)
  function drawFace(ctx, r, s, mood, onPhoto) {
    const k = onPhoto ? 1.12 : 1; // sulla foto un po' più grandi, per leggerli bene
    ctx.fillStyle = INK; ctx.strokeStyle = INK;
    if (mood === 'dead') {
      if (onPhoto) [-1, 1].forEach((d) => { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(d * r * 0.38, -r * 0.11, r * 0.22, 0, 7); ctx.fill(); });
      ctx.lineWidth = 2.6 * s;
      [-1, 1].forEach((d) => { const ex = d * r * 0.38; ctx.beginPath(); ctx.moveTo(ex - r * 0.14, -r * 0.24); ctx.lineTo(ex + r * 0.14, r * 0.02); ctx.moveTo(ex + r * 0.14, -r * 0.24); ctx.lineTo(ex - r * 0.14, r * 0.02); ctx.stroke(); });
      ctx.beginPath(); ctx.arc(0, r * 0.55, r * 0.22, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
      ctx.fillStyle = '#ff7aa2'; ctx.beginPath(); ctx.ellipse(r * 0.1, r * 0.5, r * 0.1, r * 0.16, 0, 0, 7); ctx.fill();
      return;
    }
    const big = (mood === 'hurt' ? 1.5 : 1) * k;
    [-1, 1].forEach((d) => { ctx.fillStyle = '#fff'; ctx.lineWidth = 2.2 * s; ctx.beginPath(); ctx.arc(d * r * 0.36, -r * 0.1, r * 0.2 * big, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(d * r * 0.36 + r * 0.04, -r * 0.08, r * 0.09 * big, 0, 7); ctx.fill(); });
    ctx.lineWidth = 2.4 * s; ctx.beginPath();
    if (mood === 'hurt') { ctx.ellipse(0, r * 0.45, r * 0.16, r * 0.2, 0, 0, 7); ctx.fillStyle = '#5b1020'; ctx.fill(); ctx.stroke(); }
    else if (mood === 'happy') { ctx.arc(0, r * 0.3, r * 0.36, 0.1, Math.PI - 0.1); ctx.closePath(); ctx.fillStyle = '#5b1020'; ctx.fill(); ctx.stroke(); }
    else if (onPhoto) { ctx.arc(0, r * 0.3, r * 0.3, 0.3, Math.PI - 0.3); ctx.lineWidth = 3 * s; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.lineWidth = 1.6 * s; ctx.strokeStyle = INK; ctx.stroke(); }
    else { ctx.arc(0, r * 0.25, r * 0.3, 0.35, Math.PI - 0.35); ctx.stroke(); }
  }
  const PANTS = '#2d2d3d';
  function capsule(ctx, w, h, fill, s) { rr(ctx, -w / 2, -h / 2, w, h, w / 2); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 2.2 * s; ctx.strokeStyle = INK; ctx.stroke(); }
  function drawPart(ctx, kind, look, s, rag) {
    const ch = rag?.charred;
    const shirt = ch ? '#2b2b2b' : look.color; const skin = ch ? '#2a2a2a' : look.skin; const pants = ch ? '#1c1c1c' : PANTS;
    switch (kind) {
      case 'head': drawHead(ctx, look, s, rag ? rag.mood : 'idle', rag ? rag.headScale : 1, ch); break;
      case 'chest': {
        const w = S.chestW * s; const h = S.chestH * s;
        rr(ctx, -w / 2, -h / 2, w, h, [13 * s, 13 * s, 6 * s, 6 * s]); ctx.fillStyle = shirt; ctx.fill(); ctx.lineWidth = 2.4 * s; ctx.strokeStyle = INK; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3 * s; ctx.beginPath(); ctx.moveTo(-w * 0.22, -h * 0.22); ctx.lineTo(w * 0.22, -h * 0.22); ctx.stroke();
        ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.arc(0, -h / 2, 6 * s, 0, Math.PI); ctx.fill();
        break;
      }
      case 'pelvis': {
        const w = S.pelvisW * s; const h = S.pelvisH * s;
        rr(ctx, -w / 2, -h / 2, w, h, [4 * s, 4 * s, 9 * s, 9 * s]); ctx.fillStyle = pants; ctx.fill(); ctx.lineWidth = 2.4 * s; ctx.strokeStyle = INK; ctx.stroke();
        ctx.fillStyle = '#111'; ctx.fillRect(-w / 2 + 1.5 * s, -h / 2 + 1.5 * s, w - 3 * s, 3.5 * s);
        ctx.fillStyle = '#c9a227'; ctx.fillRect(-2.5 * s, -h / 2 + 1 * s, 5 * s, 4.5 * s);
        break;
      }
      case 'upperArmL': case 'upperArmR': capsule(ctx, S.uArmW * s, S.uArmH * s, shirt, s); break;
      case 'lowerArmL': case 'lowerArmR':
        capsule(ctx, S.lArmW * s, S.lArmH * s, skin, s);
        ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(0, S.lArmH * s / 2, S.lArmW * s * 0.62, 0, 7); ctx.fill(); ctx.stroke();
        break;
      case 'thighL': case 'thighR': capsule(ctx, S.thighW * s, S.thighH * s, pants, s); break;
      case 'shinL': case 'shinR': {
        capsule(ctx, S.shinW * s, S.shinH * s, pants, s);
        const side = kind === 'shinL' ? -1 : 1;
        ctx.fillStyle = ch ? '#111' : '#f5f5f7'; ctx.beginPath(); ctx.ellipse(side * 3 * s, S.shinH * s / 2, S.shinW * s * 0.85, S.shinW * s * 0.45, 0, 0, 7); ctx.fill(); ctx.lineWidth = 2 * s; ctx.strokeStyle = INK; ctx.stroke();
        ctx.fillStyle = look.color; ctx.fillRect(side * 3 * s - S.shinW * s * 0.6, S.shinH * s / 2 + 1 * s, S.shinW * s * 1.2, 2 * s);
        break;
      }
      default:
    }
  }

  // ferite: carne, ossa che sporgono, spina dorsale (disegnate con l'uscita lungo +x)
  function drawWound(ctx, w, s) {
    if (gore() === 'niente') return;
    const k = w.size * s;
    const flesh = () => { ctx.fillStyle = '#6f0e1e'; ctx.beginPath(); ctx.ellipse(0, 0, 3.2 * k, 6.5 * k, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#c3162f'; ctx.beginPath(); ctx.ellipse(0.6 * k, 0, 2.2 * k, 4.8 * k, 0, 0, 7); ctx.fill(); };
    ctx.lineWidth = 1.2 * s; ctx.strokeStyle = '#b9ae94';
    if (w.kind === 'bone') {
      flesh();
      ctx.fillStyle = BONE; rr(ctx, 0, -2 * k, 10 * k, 4 * k, 2 * k); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(10 * k, -1.9 * k, 2.6 * k, 0, 7); ctx.arc(10 * k, 1.9 * k, 2.6 * k, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(195,22,47,.85)'; ctx.beginPath(); ctx.ellipse(2 * k, 0, 1.6 * k, 2.6 * k, 0, 0, 7); ctx.fill();
    } else if (w.kind === 'socket') {
      flesh();
      ctx.fillStyle = BONE; ctx.beginPath(); ctx.arc(1.4 * k, 0, 2.4 * k, 0, 7); ctx.fill(); ctx.stroke();
    } else if (w.kind === 'spine' || w.kind === 'spineShort') {
      const n = w.kind === 'spine' ? 4 : 2;
      ctx.fillStyle = '#c3162f'; ctx.fillRect(0, -1 * k, (n * 4.6 + 1) * k, 2 * k); // midollo
      for (let i = 0; i < n; i++) { ctx.fillStyle = BONE; rr(ctx, (1.2 + i * 4.6) * k, -3.6 * k, 3.6 * k, 7.2 * k, 1.4 * k); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = '#6f0e1e'; ctx.beginPath(); ctx.ellipse(0, 0, 3 * k, 8 * k, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#c3162f'; ctx.beginPath(); ctx.ellipse(0.5 * k, 0, 2 * k, 6.5 * k, 0, 0, 7); ctx.fill();
    }
  }

  // posizioni in piedi: i perni delle articolazioni coincidono già
  function layout(x, gy, s) {
    const p = {};
    const shinC = gy - (S.shinH / 2) * s;
    const knee = shinC - (S.shinH / 2 - 3) * s;
    const thighC = knee - (S.thighH / 2 - 3) * s;
    const hip = thighC - (S.thighH / 2 - 4) * s;
    const pelvisC = hip - (S.pelvisH / 2 - 4) * s;
    const waist = pelvisC - (S.pelvisH / 2 - 2) * s;
    const chestC = waist - (S.chestH / 2 - 2) * s;
    const neck = chestC - (S.chestH / 2) * s;
    const shoulder = chestC - (S.chestH / 2 - 6) * s;
    const uArmC = shoulder + (S.uArmH / 2 - 4) * s;
    const elbow = uArmC + (S.uArmH / 2 - 3) * s;
    const lArmC = elbow + (S.lArmH / 2 - 3) * s;
    const ax = (S.chestW / 2 + 1) * s;
    Object.assign(p, {
      head: { x, y: neck - (S.headR - 3) * s }, chest: { x, y: chestC }, pelvis: { x, y: pelvisC },
      upperArmL: { x: x - ax, y: uArmC }, upperArmR: { x: x + ax, y: uArmC },
      lowerArmL: { x: x - ax, y: lArmC }, lowerArmR: { x: x + ax, y: lArmC },
      thighL: { x: x - 8 * s, y: thighC }, thighR: { x: x + 8 * s, y: thighC },
      shinL: { x: x - 8 * s, y: shinC }, shinR: { x: x + 8 * s, y: shinC },
    });
    return p;
  }
  // [figlio, genitore, punto sul genitore, punto sul figlio, min, max, tono]
  function jointDefs(s) {
    const ax = (S.chestW / 2 + 1) * s;
    return [
      ['head', 'chest', { x: 0, y: -S.chestH / 2 * s }, { x: 0, y: (S.headR - 3) * s }, -0.65, 0.65, 0.5],
      ['pelvis', 'chest', { x: 0, y: (S.chestH / 2 - 2) * s }, { x: 0, y: -(S.pelvisH / 2 - 2) * s }, -0.45, 0.45, 0.6],
      ['upperArmL', 'chest', { x: -ax, y: -(S.chestH / 2 - 6) * s }, { x: 0, y: -(S.uArmH / 2 - 4) * s }, -3, 3, 0.22],
      ['upperArmR', 'chest', { x: ax, y: -(S.chestH / 2 - 6) * s }, { x: 0, y: -(S.uArmH / 2 - 4) * s }, -3, 3, 0.22],
      ['lowerArmL', 'upperArmL', { x: 0, y: (S.uArmH / 2 - 3) * s }, { x: 0, y: -(S.lArmH / 2 - 3) * s }, -0.05, 2.5, 0.2],
      ['lowerArmR', 'upperArmR', { x: 0, y: (S.uArmH / 2 - 3) * s }, { x: 0, y: -(S.lArmH / 2 - 3) * s }, -2.5, 0.05, 0.2],
      ['thighL', 'pelvis', { x: -8 * s, y: (S.pelvisH / 2 - 4) * s }, { x: 0, y: -(S.thighH / 2 - 4) * s }, -1.5, 1.2, 0.5],
      ['thighR', 'pelvis', { x: 8 * s, y: (S.pelvisH / 2 - 4) * s }, { x: 0, y: -(S.thighH / 2 - 4) * s }, -1.2, 1.5, 0.5],
      ['shinL', 'thighL', { x: 0, y: (S.thighH / 2 - 3) * s }, { x: 0, y: -(S.shinH / 2 - 3) * s }, -2.4, 0.05, 0.5],
      ['shinR', 'thighR', { x: 0, y: (S.thighH / 2 - 3) * s }, { x: 0, y: -(S.shinH / 2 - 3) * s }, -0.05, 2.4, 0.5],
    ];
  }
  const DRAW_ORDER = ['thighL', 'thighR', 'shinL', 'shinR', 'pelvis', 'upperArmL', 'lowerArmL', 'chest', 'upperArmR', 'lowerArmR', 'head'];

  /* ---------- ritratto statico ---------- */
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
    const engine = M.Engine.create({ gravity: { y: 1.1 }, positionIterations: 8, velocityIterations: 6, constraintIterations: 4 });
    const groundY = h - 10;
    const ground = M.Bodies.rectangle(w / 2, groundY + 40, w * 6, 80, { isStatic: true, friction: 1, label: 'ground' });
    M.Composite.add(engine.world, ground);
    const st = { canvas, ctx, w, h, dpr, engine, groundY, rags: [], props: [], fx: [], decals: [], splats: [], hooks: [], timers: [], particles: [], t: 0, alive: true, shake: 0, timeScale: 1 };

    st.after = (ms, fn) => st.timers.push({ at: st.t + ms, fn });
    st.hook = (fn) => st.hooks.push(fn);
    st.add = (...bodies) => M.Composite.add(engine.world, bodies);
    st.remove = (...items) => items.forEach((it) => it && M.Composite.remove(engine.world, it));
    st.slowmo = (ms = 450, scale = 0.28) => { if (reduce) return; st.timeScale = scale; clearTimeout(st.slowT); st.slowT = setTimeout(() => { st.timeScale = 1; }, ms); };

    // sangue: gocce con gravità che lasciano macchie e pozze per terra
    st.blood = (x, y, n = 20, speed = 6, angle = null, spread = Math.PI * 2) => {
      const g = gore();
      if (g === 'poco') n = Math.ceil(n * 0.35);
      if (st.particles.length > 1400) return;
      for (let i = 0; i < n; i++) {
        const a = angle === null ? rand(0, Math.PI * 2) : angle + rand(-spread / 2, spread / 2);
        const v = rand(speed * 0.35, speed);
        st.particles.push({
          x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rand(1.3, 3.4), life: 160,
          color: g === 'niente' ? ['#ffd426', '#7c5cff', '#ff4d8d', '#3ddc84'][i % 4] : (Math.random() < 0.7 ? '#d1122f' : '#8f0b1e'),
          stick: g !== 'niente', grav: 0.3,
        });
      }
    };
    st.bits = (x, y, n = 8, color = BONE) => { for (let i = 0; i < n; i++) st.particles.push({ x, y, vx: rand(-6, 6), vy: rand(-8, -2), r: rand(1.5, 3), life: 150, color, grav: 0.35, square: true }); };
    st.smoke = (x, y, n = 6) => { for (let i = 0; i < n; i++) st.particles.push({ x: x + rand(-8, 8), y, vx: rand(-0.4, 0.4), vy: rand(-1.6, -0.6), r: rand(5, 10), life: 70, color: 'rgba(160,160,170,.6)', grav: -0.01, grow: 0.25 }); };
    st.fountain = (getPoint, ms, angle = -Math.PI / 2) => {
      const end = st.t + ms;
      st.hook(() => { if (st.t > end) return false; const p = getPoint(); if (p) st.blood(p.x, p.y, 2, 7, angle, 0.7); return true; });
    };
    // schizzi "sulla telecamera" che colano giù
    st.splat = (n = 3) => {
      if (gore() === 'niente' || reduce) return;
      for (let i = 0; i < n; i++) {
        const blobs = Array.from({ length: 6 }, () => ({ dx: rand(-14, 14), dy: rand(-10, 10), r: rand(4, 12) }));
        st.splats.push({ x: rand(20, w - 20), y: rand(10, h * 0.6), blobs, drip: 0, t0: st.t, scale: rand(0.8, 1.5) });
      }
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
        M.Body.setAngularVelocity(b, rand(-0.4, 0.4));
      }
      st.shake = 12;
    };
    st.prop = (body, draw) => { st.add(body); st.props.push({ body, draw }); return body; };
    st.dropProp = (body) => { st.remove(body); st.props = st.props.filter((p) => p.body !== body); };
    st.emoji = (ch, x, y, size, opts = {}) => st.prop(M.Bodies.circle(x, y, size * 0.42, { restitution: 0.3, friction: 0.6, ...opts }), (c, b) => {
      c.save(); c.translate(b.position.x, b.position.y); c.rotate(b.angle); c.font = `${size}px serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ch, 0, 2); c.restore();
    });

    let last = performance.now();
    function step(now = performance.now()) {
      if (!st.alive) return;
      const real = Math.min(50, Math.max(1, now - last)); last = now;
      const dt = real * st.timeScale;
      const n = Math.max(1, Math.min(3, Math.ceil(dt / 16.67)));
      for (let i = 0; i < n; i++) M.Engine.update(engine, dt / n);
      st.t += dt;
      const due = st.timers; st.timers = [];
      for (const tm of due) { if (st.t >= tm.at) tm.fn(); else st.timers.push(tm); }
      const hs = st.hooks; st.hooks = [];
      for (const fn of hs) if (fn(dt) !== false) st.hooks.push(fn);
      for (const rg of st.rags) bleed(rg, dt);
      const k = dt / 16.67;
      st.particles = st.particles.filter((p) => {
        p.vy += p.grav * k; p.x += p.vx * k; p.y += p.vy * k; p.life -= k; if (p.grow) p.r += p.grow * k;
        if (p.stick && p.y >= groundY - 1) {
          const near = st.decals.find((d) => Math.abs(d.x - p.x) < d.rx * 0.8);
          if (near) { near.rx = Math.min(46, near.rx + p.r * 0.35); near.ry = Math.min(6, near.ry + 0.05); }
          else if (st.decals.length < 140) st.decals.push({ x: p.x, rx: p.r * rand(1.6, 3), ry: p.r * 0.55 });
          return false;
        }
        return p.life > 0 && p.y < h + 40;
      });
      draw();
      requestAnimationFrame(step);
    }
    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (st.shake > 0) { ctx.translate(rand(-st.shake, st.shake), rand(-st.shake, st.shake)); st.shake *= 0.86; if (st.shake < 0.5) st.shake = 0; }
      const grd = ctx.createLinearGradient(0, groundY, 0, h); grd.addColorStop(0, 'rgba(255,255,255,.10)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grd; ctx.fillRect(-20, groundY, w + 40, h - groundY + 20);
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, groundY); ctx.lineTo(w, groundY); ctx.stroke();
      for (const d of st.decals) { ctx.fillStyle = '#7d0a1b'; ctx.beginPath(); ctx.ellipse(d.x, groundY, d.rx, d.ry, 0, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.beginPath(); ctx.ellipse(d.x - d.rx * 0.3, groundY - d.ry * 0.3, d.rx * 0.25, d.ry * 0.3, 0, 0, 7); ctx.fill(); }
      for (const rg of st.rags) { const t = rg.parts.chest || rg.parts.pelvis; if (!t) continue; const lift = Math.max(0, groundY - t.position.y - 60 * rg.s); ctx.fillStyle = `rgba(0,0,0,${Math.max(0.05, 0.3 - lift / 400)})`; ctx.beginPath(); ctx.ellipse(t.position.x, groundY + 1, 26 * rg.s, 5 * rg.s, 0, 0, 7); ctx.fill(); }
      for (const p of st.props) p.draw(ctx, p.body);
      for (const rg of st.rags) {
        for (const kind of DRAW_ORDER) {
          const b = rg.parts[kind]; if (!b) continue;
          ctx.save(); ctx.translate(b.position.x, b.position.y); ctx.rotate(b.angle); drawPart(ctx, kind, rg.look, rg.s, rg); ctx.restore();
        }
        for (const wd of rg.wounds) {
          if (!wd.body || !rg.parts[wd.part]) continue;
          ctx.save(); ctx.translate(wd.body.position.x, wd.body.position.y); ctx.rotate(wd.body.angle);
          ctx.translate(wd.lp.x, wd.lp.y); ctx.rotate(wd.ang); drawWound(ctx, wd, rg.s); ctx.restore();
        }
      }
      for (const p of st.particles) {
        ctx.fillStyle = p.color; ctx.globalAlpha = p.grow ? Math.max(0, p.life / 70) : 1;
        if (p.square) ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        else { ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill(); }
      }
      ctx.globalAlpha = 1;
      st.fx = st.fx.filter((fn) => fn(ctx) !== false);
      // schizzi sullo "schermo"
      st.splats = st.splats.filter((sp) => {
        const age = st.t - sp.t0; if (age > 4200) return false;
        sp.drip = Math.min(60, sp.drip + 0.25);
        ctx.globalAlpha = Math.min(0.85, 1.2 - age / 3500);
        ctx.fillStyle = '#9d0c22';
        for (const b of sp.blobs) { ctx.beginPath(); ctx.arc(sp.x + b.dx * sp.scale, sp.y + b.dy * sp.scale, b.r * sp.scale, 0, 7); ctx.fill(); }
        ctx.fillRect(sp.x - 2, sp.y, 4, sp.drip); ctx.beginPath(); ctx.arc(sp.x, sp.y + sp.drip, 3.2, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
        return true;
      });
    }
    st.destroy = () => { st.alive = false; clearTimeout(st.slowT); M.Engine.clear(engine); canvas.remove(); };
    requestAnimationFrame(step);
    return st;
  }

  /* ---------- il personaggio ---------- */
  function addRag(st, look, x, s = 1, missing = 0) {
    const L = layout(x, st.groundY, s);
    const group = M.Body.nextGroup(true);
    const opt = (extra = {}) => ({ collisionFilter: { group }, friction: 0.9, frictionAir: 0.02, restitution: 0.08, density: 0.0016, slop: 0.02, ...extra });
    const cap = (k, w, hgt, extra) => M.Bodies.rectangle(L[k].x, L[k].y, w * s, hgt * s, opt({ chamfer: { radius: Math.min(w, hgt) * 0.45 * s }, ...extra }));
    const parts = {
      head: M.Bodies.circle(L.head.x, L.head.y, S.headR * s, opt({ density: 0.0017 })),
      chest: cap('chest', S.chestW, S.chestH, { density: 0.002, chamfer: { radius: 10 * s } }),
      pelvis: cap('pelvis', S.pelvisW, S.pelvisH, { density: 0.002, chamfer: { radius: 6 * s } }),
      upperArmL: cap('upperArmL', S.uArmW, S.uArmH), upperArmR: cap('upperArmR', S.uArmW, S.uArmH),
      lowerArmL: cap('lowerArmL', S.lArmW, S.lArmH), lowerArmR: cap('lowerArmR', S.lArmW, S.lArmH),
      thighL: cap('thighL', S.thighW, S.thighH), thighR: cap('thighR', S.thighW, S.thighH),
      shinL: cap('shinL', S.shinW, S.shinH, { friction: 1 }), shinR: cap('shinR', S.shinW, S.shinH, { friction: 1 }),
    };
    const joints = {};
    for (const [child, parent, pp, cp, min, max, tone] of jointDefs(s)) {
      const c = M.Constraint.create({ bodyA: parts[parent], pointA: pp, bodyB: parts[child], pointB: cp, length: 0, stiffness: 1, damping: 0.1 });
      joints[child] = { child, parent, pp, cp, min, max, tone, c };
    }
    const anchors = [{ x: L.chest.x, y: L.chest.y - 12 * s }, { x: L.pelvis.x, y: L.pelvis.y }];
    const pins = [
      M.Constraint.create({ pointA: { ...anchors[0] }, bodyB: parts.chest, pointB: { x: 0, y: -12 * s }, length: 0, stiffness: 0.25, damping: 0.1 }),
      M.Constraint.create({ pointA: { ...anchors[1] }, bodyB: parts.pelvis, pointB: { x: 0, y: 0 }, length: 0, stiffness: 0.25, damping: 0.1 }),
    ];
    const rag = { st, look, s, x, parts, joints, pins, anchors, mood: 'idle', headScale: 1, charred: false, loose: false, alive: true, detached: new Set(), wounds: [], tone: 1 };
    st.add(...Object.values(parts), ...Object.values(joints).map((j) => j.c), ...pins);
    st.rags.push(rag);
    // pezzi già persi negli errori del round: moncherini con l'osso in vista
    DAMAGE.slice(0, missing).forEach((k) => removeSubtree(rag, k, false));
    // "muscoli": riportano le articolazioni in posizione finché è vivo; i limiti valgono sempre
    st.hook(() => {
      for (const j of Object.values(rag.joints)) {
        if (j.broken) continue;
        const a = rag.parts[j.parent]; const b = rag.parts[j.child]; if (!a || !b) continue;
        const rel = wrap(b.angle - a.angle); const relV = b.angularVelocity - a.angularVelocity;
        if (rag.alive) {
          const tq = (-rel * j.tone * 0.35 - relV * 0.3) * rag.tone;
          M.Body.setAngularVelocity(b, b.angularVelocity + tq);
          M.Body.setAngularVelocity(a, a.angularVelocity - tq * 0.25);
        }
        if (rel < j.min) M.Body.setAngularVelocity(b, a.angularVelocity + (j.min - rel) * 0.35);
        else if (rel > j.max) M.Body.setAngularVelocity(b, a.angularVelocity + (j.max - rel) * 0.35);
      }
      return st.rags.includes(rag);
    });
    return rag;
  }

  const worldPoint = (body, lp) => M.Vector.add(body.position, M.Vector.rotate(lp, body.angle));
  const subtree = (k) => [k, ...(CHILDREN[k] || []).flatMap(subtree)];
  function addWound(rag, part, lp, kind, size = 1, bleedMs = 2600) {
    const body = rag.parts[part]; if (!body) return;
    rag.wounds.push({ part, body, lp, ang: Math.atan2(lp.y, lp.x), kind, size, bleed: gore() === 'niente' ? 0 : bleedMs });
  }
  // sangue a fiotti dalle ferite aperte, a tempo come un battito
  function bleed(rag, dt) {
    for (const wd of rag.wounds) {
      if (wd.bleed <= 0 || !rag.parts[wd.part]) continue;
      wd.bleed -= dt;
      const beat = Math.sin(rag.st.t / 95) > 0.2;
      const p = worldPoint(wd.body, wd.lp); const a = wd.body.angle + wd.ang;
      const strength = Math.min(1, wd.bleed / 1500);
      if (beat) rag.st.blood(p.x, p.y, wd.kind.startsWith('spine') ? 3 : 2, 4 + strength * 5, a, 0.45);
      else if (Math.random() < 0.3) rag.st.blood(p.x, p.y, 1, 1.2, a, 1);
    }
  }
  function breakJoint(rag, part, push = 0.012, sound = true) {
    const j = rag.joints[part];
    if (!j || j.broken || !rag.parts[part] || !rag.parts[j.parent]) return null;
    const pBody = rag.parts[j.parent]; const cBody = rag.parts[part];
    const p = worldPoint(pBody, j.pp);
    rag.st.remove(j.c); j.broken = true;
    subtree(part).forEach((k) => rag.detached.add(k));
    const spinal = part === 'head' || part === 'pelvis';
    addWound(rag, j.parent, j.pp, spinal ? 'spine' : 'socket', spinal ? 1 : 0.85, spinal ? 3800 : 2600);
    addWound(rag, part, j.cp, spinal ? 'spineShort' : 'bone', spinal ? 1 : 0.8, spinal ? 1800 : 1400);
    const dir = Math.sign(cBody.position.x - (rag.parts.chest || pBody).position.x) || (Math.random() < 0.5 ? -1 : 1);
    M.Body.applyForce(cBody, cBody.position, { x: dir * push * cBody.mass * 60, y: -push * cBody.mass * 80 });
    M.Body.setAngularVelocity(cBody, dir * rand(0.2, 0.5));
    rag.st.blood(p.x, p.y, 22, 7, null, 1.6);
    if (sound) { SFX.crunch(); SFX.splat(); }
    return p;
  }
  function removeSubtree(rag, part, bleedIt = true) {
    const j = rag.joints[part]; if (!j || !rag.parts[part]) return;
    const pBody = rag.parts[j.parent];
    for (const k of subtree(part)) {
      if (rag.joints[k]) { rag.st.remove(rag.joints[k].c); rag.joints[k].broken = true; }
      rag.st.remove(rag.parts[k]); delete rag.parts[k]; rag.detached.add(k);
    }
    if (pBody) addWound(rag, j.parent, j.pp, part === 'head' || part === 'pelvis' ? 'spine' : 'socket', 0.85, bleedIt ? 2400 : 0);
  }
  function release(rag) {
    if (rag.loose) return; rag.loose = true;
    rag.st.remove(...rag.pins);
  }
  // morte: niente più muscoli, rallentatore, spasmi
  function die(rag, slow = true) {
    if (!rag.alive) return;
    rag.alive = false; rag.mood = 'dead'; release(rag);
    if (slow) rag.st.slowmo(420, 0.3);
    const t0 = rag.st.t;
    rag.st.hook(() => {
      const k = rag.st.t - t0; if (k > 2200) return false;
      if (k > 500 && Math.random() < 0.08) { const keys = Object.keys(rag.parts); const b = rag.parts[keys[Math.floor(Math.random() * keys.length)]]; if (b) M.Body.setAngularVelocity(b, b.angularVelocity + rand(-0.25, 0.25) * (1 - k / 2200)); }
      return true;
    });
  }
  const all = (rag) => Object.values(rag.parts);
  const push = (b, fx, fy) => b && M.Body.applyForce(b, b.position, { x: fx * b.mass, y: fy * b.mass });
  const neckPoint = (rag) => (rag.parts.chest ? worldPoint(rag.parts.chest, rag.joints.head.pp) : null);

  /* ---------- un errore durante il round ---------- */
  function damage(rag, hits) {
    if (!rag) return;
    const part = DAMAGE[hits - 1];
    rag.mood = 'hurt'; rag.st.after(800, () => { if (rag.mood === 'hurt') rag.mood = 'idle'; });
    if (part && rag.parts[part] && !rag.detached.has(part)) { breakJoint(rag, part, 0.02); rag.st.slowmo(250, 0.4); }
    else { push(rag.parts.head, rand(-0.02, 0.02), -0.03); if (rag.parts.chest) rag.st.blood(rag.parts.chest.position.x, rag.parts.chest.position.y, 10, 4); SFX.thud(); }
    rag.tone = 0.5; rag.st.after(600, () => { rag.tone = 1; });
    rag.st.shake = 5;
  }

  /* ---------- vittoria ---------- */
  function dance(rag) {
    if (!rag) return;
    rag.mood = 'happy';
    const base = rag.anchors.map((a) => a.y); const t0 = rag.st.t;
    rag.st.hook(() => {
      const k = rag.st.t - t0; if (k > 2600 || rag.loose) { rag.pins.forEach((p, i) => { p.pointA.y = base[i]; }); return false; }
      const off = Math.abs(Math.sin(k / 170)) * 18 * rag.s;
      rag.pins.forEach((p, i) => { p.pointA.y = base[i] - off; });
      ['upperArmL', 'upperArmR'].forEach((a, i) => { const b = rag.parts[a]; if (b && !rag.detached.has(a)) M.Body.setAngularVelocity(b, (i ? -1 : 1) * Math.sin(k / 120) * 0.35); });
      return true;
    });
  }

  /* ---------- le morti ---------- */
  const KILLS = {
    vinile(st, rag) {
      const neckY = neckPoint(rag).y;
      const disc = st.emoji('💿', -30, neckY, 30 * rag.s, { isSensor: true, frictionAir: 0 });
      disc.collisionFilter = { group: -999, mask: 0 };
      SFX.whoosh();
      let hit = false;
      st.hook(() => {
        M.Body.setVelocity(disc, { x: 13, y: 0 }); M.Body.setAngularVelocity(disc, 0.6);
        if (!hit && disc.position.x >= rag.x - 6) {
          hit = true; die(rag); const head = rag.parts.head;
          breakJoint(rag, 'head', 0.03); push(head, 0.025, -0.07);
          SFX.slash(); st.text('ZAC!', rag.x + 24, neckY - 34); st.splat(2);
        }
        if (disc.position.x > st.w + 60) { st.dropProp(disc); return false; }
        return true;
      });
    },
    bomba(st, rag) {
      const bomb = st.emoji('💣', rag.x + 30 * rag.s, -30, 34 * rag.s, { restitution: 0.35, density: 0.004 });
      st.after(500, () => SFX.thud());
      st.after(1300, () => {
        const bp = { ...bomb.position }; st.dropProp(bomb);
        die(rag, false); Object.keys(rag.joints).forEach((k) => breakJoint(rag, k, 0.01, false));
        st.shockwave(bp.x, bp.y + 10, 280, 0.1); st.slowmo(600, 0.25);
        st.flash(160, '#fff3b0'); st.text('BOOM!', bp.x, bp.y - 46, '#ff8a3d', 36);
        st.blood(bp.x, bp.y, 80, 12); st.bits(bp.x, bp.y, 10); st.smoke(bp.x, bp.y, 14); st.splat(4); SFX.boom();
      });
    },
    pianoforte(st, rag) {
      const s = rag.s; const pw = 110 * s; const ph = 64 * s;
      const piano = st.prop(M.Bodies.rectangle(rag.x, -ph, pw, ph, { density: 0.035, friction: 0.8, restitution: 0.02, chamfer: { radius: 6 * s } }), (c, b) => {
        c.save(); c.translate(b.position.x, b.position.y); c.rotate(b.angle);
        c.fillStyle = '#121218'; c.strokeStyle = '#000'; c.lineWidth = 2; rr(c, -pw / 2, -ph / 2, pw, ph, 6 * s); c.fill(); c.stroke();
        c.fillStyle = '#f5f5f7'; c.fillRect(-pw / 2 + 6 * s, ph * 0.05, pw - 12 * s, ph * 0.3);
        c.fillStyle = '#121218'; for (let i = 1; i < 11; i++) if (i % 7 !== 3 && i % 7 !== 0) c.fillRect(-pw / 2 + 6 * s + i * (pw - 12 * s) / 11 - 2 * s, ph * 0.05, 4 * s, ph * 0.18);
        c.restore();
      });
      SFX.whoosh();
      let hit = false;
      st.hook(() => {
        const top = rag.parts.head ? rag.parts.head.position.y - S.headR * s : st.groundY - 70 * s;
        if (!hit && piano.position.y + ph / 2 >= top) {
          hit = true; die(rag); SFX.thud(); SFX.crunch();
          breakJoint(rag, Math.random() < 0.5 ? 'lowerArmL' : 'lowerArmR', 0.03);
          st.after(80, () => { if (Math.random() < 0.6) breakJoint(rag, 'head', 0.01); breakJoint(rag, 'shinR', 0.02); });
          st.text('CRASH!', rag.x, 30, '#ffd426', 30); st.shake = 16;
          st.after(220, () => { st.blood(rag.x - 46 * s, st.groundY - 6, 30, 9, Math.PI + 0.25, 0.7); st.blood(rag.x + 46 * s, st.groundY - 6, 30, 9, -0.25, 0.7); st.splat(2); });
        }
        return !hit;
      });
    },
    incudine(st, rag) {
      const s = rag.s; const aw = 56 * s; const ah = 28 * s;
      const anvil = st.prop(M.Bodies.rectangle(rag.x + 3, -40, aw, ah, { density: 0.06, restitution: 0.05 }), (c, b) => {
        c.save(); c.translate(b.position.x, b.position.y); c.rotate(b.angle); c.fillStyle = '#5b5b66'; c.strokeStyle = INK; c.lineWidth = 2.5;
        c.beginPath(); c.moveTo(-aw / 2, -ah / 2); c.lineTo(aw / 2, -ah / 2); c.lineTo(aw * 0.32, 0); c.lineTo(aw * 0.36, ah / 2); c.lineTo(-aw * 0.36, ah / 2); c.lineTo(-aw * 0.32, 0); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(-aw / 2 + 4, -ah / 2 + 3, aw - 8, 3); c.restore();
      });
      let hit = false;
      st.hook(() => {
        const head = rag.parts.head;
        if (!hit && head && anvil.position.y + ah / 2 >= head.position.y - S.headR * s) {
          hit = true; die(rag); rag.headScale = 0.72; SFX.thud(); SFX.crunch();
          st.bits(head.position.x, head.position.y, 8); st.blood(head.position.x, head.position.y, 30, 8);
          breakJoint(rag, 'head', 0.002, false); push(head, rand(-0.06, 0.06), 0.02);
          st.text('DONK!', rag.x, head.position.y - 44); st.shake = 10; st.splat(1);
        }
        return !hit;
      });
    },
    cecchino(st, rag) {
      const head = rag.parts.head;
      st.text('BANG!', st.w - 32, 30, '#ffd426', 24); SFX.bang();
      st.after(140, () => {
        const y = head.position.y; const t0 = st.t;
        st.fx.push((c) => { const k = (st.t - t0) / 140; if (k > 1) return false; c.strokeStyle = '#fff6c9'; c.lineWidth = 2; c.globalAlpha = 1 - k; c.beginPath(); c.moveTo(st.w, y - 8); c.lineTo(head.position.x, y); c.stroke(); c.globalAlpha = 1; return true; });
        die(rag); st.slowmo(700, 0.2);
        breakJoint(rag, 'head', 0.01); push(head, -0.11, -0.03); push(rag.parts.chest, -0.02, 0);
        st.blood(head.position.x - S.headR * rag.s, y, 50, 11, Math.PI, 0.8); st.bits(head.position.x - 10, y, 6); st.splat(2);
      });
    },
    cassa(st, rag) {
      const sp = st.prop(M.Bodies.rectangle(30, st.groundY - 30 * rag.s, 46 * rag.s, 60 * rag.s, { isStatic: true }), (c, b) => {
        const s = rag.s; c.save(); c.translate(b.position.x, b.position.y); const pulse = 1 + Math.sin(st.t / 60) * 0.06;
        c.fillStyle = '#18181f'; c.strokeStyle = '#3a3a48'; c.lineWidth = 2; rr(c, -23 * s, -30 * s, 46 * s, 60 * s, 6 * s); c.fill(); c.stroke();
        c.fillStyle = '#2f2f3d'; c.beginPath(); c.arc(0, 10 * s, 15 * s * pulse, 0, 7); c.fill(); c.fillStyle = '#ffd426'; c.beginPath(); c.arc(0, 10 * s, 5 * s, 0, 7); c.fill();
        c.fillStyle = '#2f2f3d'; c.beginPath(); c.arc(0, -16 * s, 7 * s, 0, 7); c.fill(); c.restore();
      });
      [0, 380, 760].forEach((d, i) => st.after(d, () => {
        const t0 = st.t; SFX.thud();
        st.fx.push((c) => { const k = (st.t - t0) / 500; if (k > 1) return false; c.strokeStyle = `rgba(255,212,38,${1 - k})`; c.lineWidth = 3 + i * 2; c.beginPath(); c.arc(sp.position.x + 20, sp.position.y, 20 + k * 170, -0.7, 0.7); c.stroke(); return true; });
        if (i === 2) {
          die(rag); st.text('BWOOM!', rag.x, 40, '#7c5cff', 28); SFX.boom();
          all(rag).forEach((b) => push(b, 0.04, -0.03));
          st.after(200, () => { breakJoint(rag, 'head', 0.03); breakJoint(rag, 'lowerArmL', 0.03); st.splat(1); });
        } else { all(rag).forEach((b) => push(b, 0.005, 0)); rag.mood = 'hurt'; }
      }));
    },
    squalo(st, rag) {
      const t0 = st.t; const x = rag.x;
      st.fx.push((c) => {
        const k = (st.t - t0) / 1900; if (k > 1) return false;
        const rise = k < 0.35 ? k / 0.35 : k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
        c.save(); c.beginPath(); c.rect(0, 0, st.w, st.groundY); c.clip();
        c.font = `${80 * rag.s}px serif`; c.textAlign = 'center'; c.translate(x, st.groundY + 54 * rag.s - rise * 80 * rag.s); c.rotate(-Math.PI / 2); c.fillText('🦈', 0, 0); c.restore();
        return true;
      });
      st.after(650, () => {
        die(rag); st.text('CHOMP!', x, st.groundY - 120 * rag.s, '#22b8ff'); SFX.chomp(); SFX.splat();
        removeSubtree(rag, 'thighL'); removeSubtree(rag, 'thighR');
        const hips = rag.parts.pelvis ? [worldPoint(rag.parts.pelvis, { x: 0, y: 8 * rag.s })] : [];
        hips.forEach((p) => st.blood(p.x, p.y, 40, 8, -Math.PI / 2, 2));
        st.shake = 9; st.splat(1);
      });
    },
    calcione(st, rag) {
      const boot = st.emoji('🦶', -40, rag.parts.chest.position.y, 66 * rag.s, { isStatic: true });
      SFX.whoosh();
      st.hook(() => {
        M.Body.setPosition(boot, { x: boot.position.x + 18, y: boot.position.y });
        if (rag.alive && boot.position.x >= rag.x - 42 * rag.s) {
          die(rag); st.text('POW!', rag.x, 40, '#ff4d8d', 32); st.shake = 12; SFX.thud(); SFX.crunch();
          all(rag).forEach((b) => push(b, 0.065, -0.075)); M.Body.setAngularVelocity(rag.parts.chest, 0.45);
          breakJoint(rag, Math.random() < 0.5 ? 'lowerArmL' : 'shinL', 0.03);
        }
        if (boot.position.x > st.w + 80) { st.dropProp(boot); return false; }
        return true;
      });
    },
    fulmine(st, rag) {
      const x = rag.x; const t0 = st.t;
      const bolt = (c) => {
        const hy = rag.parts.head ? rag.parts.head.position.y : st.groundY - 100;
        c.save(); c.strokeStyle = '#fde047'; c.lineWidth = 4; c.shadowColor = '#fde047'; c.shadowBlur = 18; c.beginPath();
        let px = x + rand(-10, 10); c.moveTo(px, -10);
        for (let y = 0; y < hy; y += 18) { px += rand(-14, 14); c.lineTo(px, y); }
        c.lineTo(x, hy); c.stroke(); c.restore();
      };
      st.fx.push((c) => { const k = st.t - t0; if (k > 650) return false; if (Math.floor(k / 80) % 2 === 0) bolt(c); return true; });
      st.after(120, () => { st.flash(100, '#fff8c4'); rag.mood = 'dead'; rag.charred = true; SFX.zap(); });
      st.hook(() => { const k = st.t - t0; if (k > 800) return false; all(rag).forEach((b) => M.Body.setAngularVelocity(b, rand(-0.3, 0.3))); return true; });
      st.after(800, () => { die(rag, false); st.text('ZZZAP!', x, 36, '#fde047'); if (Math.random() < 0.5) breakJoint(rag, 'lowerArmR', 0.01); });
      for (let i = 0; i < 7; i++) st.after(700 + i * 150, () => { const b = rag.parts.head || rag.parts.chest; if (b) st.smoke(b.position.x, b.position.y - 10, 3); });
    },
    katana(st, rag) {
      const t0 = st.t; const y0 = neckPoint(rag).y; const x0 = rag.x;
      st.fx.push((c) => { const k = (st.t - t0) / 160; if (k > 1.8) return false; c.strokeStyle = '#e4e4e7'; c.lineWidth = 3; c.globalAlpha = Math.max(0, 1 - Math.max(0, k - 1)); c.beginPath(); c.moveTo(x0 - 80, y0 - 20); c.lineTo(x0 - 80 + 160 * Math.min(1, k), y0 - 20 + 110 * Math.min(1, k)); c.stroke(); c.globalAlpha = 1; return true; });
      st.text('SLASH!', x0, 26, '#e4e4e7'); SFX.slash();
      st.after(170, () => {
        die(rag); st.slowmo(700, 0.22);
        breakJoint(rag, 'head', 0.02); breakJoint(rag, 'upperArmR', 0.025); breakJoint(rag, 'pelvis', 0.01); // tagliato in tre
        push(rag.parts.chest, 0.01, -0.02); st.splat(2);
      });
    },
    meteorite(st, rag) {
      const m = st.emoji('☄️', rag.x - 160, -60, 52 * rag.s, { isSensor: true, frictionAir: 0 });
      m.collisionFilter = { group: -998, mask: 0 };
      SFX.whoosh();
      st.hook(() => {
        M.Body.setVelocity(m, { x: 7, y: 9 });
        st.particles.push({ x: m.position.x - 10, y: m.position.y - 10, vx: rand(-1, 0), vy: rand(-1, 0), r: rand(3, 6), life: 20, color: Math.random() < 0.5 ? '#ff8a3d' : '#fde047', grav: 0 });
        if (m.position.y >= st.groundY - 30) {
          const mp = { ...m.position }; st.dropProp(m);
          die(rag, false); Object.keys(rag.joints).forEach((k) => breakJoint(rag, k, 0.01, false));
          st.shockwave(mp.x, st.groundY, 340, 0.13); st.slowmo(650, 0.22); st.flash(200, '#ffb020'); st.text('KABOOM!', rag.x, 40, '#ff8a3d', 34);
          st.blood(rag.x, st.groundY - 30, 90, 13); st.bits(rag.x, st.groundY - 30, 12); st.smoke(mp.x, st.groundY - 10, 18); st.splat(4); SFX.boom();
          return false;
        }
        return true;
      });
    },
    stonata(st, rag) {
      const t0 = st.t;
      st.fx.push((c) => {
        const k = st.t - t0; if (k > 1300 || !rag.parts.head) return false;
        const h = rag.parts.head.position;
        for (let i = 0; i < 4; i++) { const a = k / 180 + i * Math.PI / 2; c.font = `${16 * rag.s}px serif`; c.fillStyle = '#ffd426'; c.fillText(i % 2 ? '♪' : '♫', h.x + Math.cos(a) * 36 * rag.s - 6, h.y + Math.sin(a) * 22 * rag.s); }
        return true;
      });
      for (let i = 0; i < 5; i++) st.after(i * 240, () => SFX.boing());
      st.hook(() => {
        const k = st.t - t0; if (k > 1250 || !rag.parts.head) return false;
        rag.mood = 'hurt'; rag.headScale = 1 + (k / 1250) * 0.85; rag.tone = 0.6;
        M.Body.setAngularVelocity(rag.parts.head, rand(-0.15, 0.15) * (k / 1250));
        return true;
      });
      st.after(1260, () => {
        const h = { ...rag.parts.head.position };
        die(rag); st.text('POP!', h.x, h.y - 20, '#ff4d8d', 34); SFX.pop(); SFX.splat();
        st.blood(h.x, h.y, 90, 11); st.bits(h.x, h.y, 14); st.bits(h.x, h.y, 6, '#ff7aa2'); st.splat(4);
        removeSubtree(rag, 'head');
      });
    },
    ufo(st, rag) {
      const t0 = st.t; const ufoX = rag.x; const ufoY = 26;
      st.fx.push((c) => {
        const k = st.t - t0; if (k > 2700) return false;
        if (k > 300 && k < 1700) { c.fillStyle = 'rgba(163,230,53,.18)'; c.beginPath(); c.moveTo(ufoX - 14, ufoY + 10); c.lineTo(ufoX + 14, ufoY + 10); c.lineTo(ufoX + 50, st.groundY); c.lineTo(ufoX - 50, st.groundY); c.closePath(); c.fill(); }
        c.font = `${44 * rag.s}px serif`; c.textAlign = 'center'; c.fillText('🛸', ufoX + Math.sin(k / 120) * 4, ufoY + 12); return true;
      });
      st.after(300, () => { release(rag); rag.mood = 'hurt'; rag.tone = 0.3; SFX.zap(); });
      st.hook(() => { const k = st.t - t0; if (k < 300) return true; if (k > 1700) return false; all(rag).forEach((b) => M.Body.applyForce(b, b.position, { x: (ufoX - b.position.x) * 0.00002 * b.mass, y: -0.0022 * b.mass })); return true; });
      st.after(1700, () => { die(rag, false); st.text('BYE!', ufoX, 60, '#a3e635'); all(rag).forEach((b) => push(b, 0, 0.025)); SFX.whoosh(); });
      let landed = false;
      st.hook(() => {
        if (st.t - t0 < 1800) return true;
        const b = rag.parts.chest || rag.parts.pelvis; if (!b) return false;
        if (!landed && b.position.y > st.groundY - 40 * rag.s) {
          landed = true; SFX.thud(); SFX.crunch(); st.shake = 12; st.slowmo(350, 0.3);
          st.blood(b.position.x, st.groundY - 8, 60, 9, -Math.PI / 2, 2.6); st.text('SPLAT!', b.position.x, st.groundY - 70, '#e5484d');
          breakJoint(rag, 'shinL', 0.02); breakJoint(rag, 'lowerArmR', 0.02); st.splat(2);
        }
        return !landed;
      });
    },
    spuntoni(st, rag) {
      const t0 = st.t; const x = rag.x; const n = 7; const sw = 12 * rag.s;
      st.fx.push((c) => {
        const k = Math.min(1, (st.t - t0) / 150);
        c.strokeStyle = INK; c.lineWidth = 1.5;
        for (let i = 0; i < n; i++) {
          const sx = x - (n * sw) / 2 + i * sw; const top = st.groundY - 32 * rag.s * k;
          c.fillStyle = '#d4d4d8'; c.beginPath(); c.moveTo(sx, st.groundY); c.lineTo(sx + sw / 2, top); c.lineTo(sx + sw, st.groundY); c.closePath(); c.fill(); c.stroke();
          if (st.t - t0 > 300 && gore() !== 'niente') { c.fillStyle = '#b3122b'; c.beginPath(); c.moveTo(sx + sw * 0.3, top + 12 * rag.s); c.lineTo(sx + sw / 2, top); c.lineTo(sx + sw * 0.7, top + 12 * rag.s); c.closePath(); c.fill(); }
        }
        return st.alive;
      });
      st.after(110, () => {
        die(rag); st.text('STAB!', x, 36, '#d4d4d8'); SFX.crunch(); SFX.splat();
        push(rag.parts.chest, 0, -0.045);
        breakJoint(rag, 'shinL', 0.015); breakJoint(rag, 'shinR', 0.015, false);
        for (let i = 0; i < 5; i++) st.blood(x - 30 + i * 15, st.groundY - 28 * rag.s, 10, 8, -Math.PI / 2, 0.8);
      });
    },
  };
  const KILL_IDS = Object.keys(KILLS);
  const LABEL = {
    vinile: 'è stato decapitato da un vinile volante', bomba: 'è saltato in aria', pianoforte: 'è stato schiacciato da un pianoforte',
    incudine: "ha preso un'incudine in testa", cecchino: 'è stato centrato da un cecchino', cassa: 'è stato sparato via dai bassi',
    squalo: 'è stato mangiato da uno squalo', calcione: 'è stato preso a calci fuori dallo schermo', fulmine: 'è stato fulminato',
    katana: 'è stato tagliato in tre da una katana', meteorite: 'è stato centrato da un meteorite', stonata: 'gli è esplosa la testa per una nota stonata',
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
    if (reduce) { die(rag, false); return t; }
    KILLS[t](rag.st, rag);
    return t;
  }

  return { stage, addRag, damage, dance, kill: killRag, portrait, portraitURL, KILL_IDS, LABEL, SHORT, DAMAGE, SFX, available: !!M };
})();
