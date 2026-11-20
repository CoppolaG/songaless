'use strict';
/* Personaggini in SVG, stile cartone animato: un aspetto per giocatore, perdono un pezzo a ogni errore
   e, se la canzone non viene indovinata, vengono fatti fuori in uno di 6 modi. Le animazioni usano GSAP. */
const Chars = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const INK = '#1d1d27';
  const COLORS = ['#ff4d8d', '#7c5cff', '#3ddc84', '#ffd426', '#22b8ff', '#ff8a3d', '#e5484d', '#a3e635', '#f472b6', '#14b8a6'];
  const SKINS = ['#ffd9b3', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffe0cc'];
  const HATS = ['none', 'cap', 'party', 'beanie', 'crown', 'horns', 'tophat', 'headband', 'none', 'cap'];
  const PARTS = ['armR', 'armL', 'legR', 'legL']; // ordine in cui si perdono i pezzi
  const PIVOT = { armL: '42 84', armR: '78 84', legL: '53 118', legR: '67 118', head: '60 68', feet: '60 162' };

  const hash = (s) => [...String(s).toLowerCase()].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
  const pick = (arr, n) => arr[n % arr.length];
  // i giocatori registrati hanno un aspetto fisso e tutti diverso
  const PRESET = {
    peppe: { color: '#22b8ff', hat: 'cap', glasses: true, stache: false },
    trazio: { color: '#ff4d8d', hat: 'horns', glasses: false, stache: true },
    cava: { color: '#3ddc84', hat: 'party', glasses: false, stache: false },
    gg: { color: '#7c5cff', hat: 'tophat', glasses: true, stache: false },
    nicola: { color: '#ff8a3d', hat: 'beanie', glasses: false, stache: true },
    nasir: { color: '#e5484d', hat: 'headband', glasses: false, stache: false },
  };
  function defaultLook(name) {
    const h = hash(name);
    const p = PRESET[String(name).toLowerCase()];
    if (p) return { ...p, skin: pick(SKINS, h >> 4) };
    return { color: pick(COLORS, h), skin: pick(SKINS, h >> 4), hat: pick(HATS, h >> 8), glasses: (h >> 12) % 4 === 0, stache: (h >> 15) % 5 === 0 };
  }
  function randomLook() {
    const r = (a) => a[Math.floor(Math.random() * a.length)];
    return { color: r(COLORS), skin: r(SKINS), hat: r(HATS), glasses: Math.random() < 0.3, stache: Math.random() < 0.25 };
  }
  // aspetto ricevuto da un altro dispositivo: accettiamo solo valori noti (finisce dentro l'SVG)
  function clean(look, name) {
    const d = defaultLook(name);
    if (!look || typeof look !== 'object') return d;
    const hex = (v, fb) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : fb);
    return { color: hex(look.color, d.color), skin: hex(look.skin, d.skin), hat: HATS.includes(look.hat) ? look.hat : d.hat, glasses: !!look.glasses, stache: !!look.stache };
  }
  const lookFor = (name) => clean((store('looks') || {})[String(name).toLowerCase()], name);
  function setLook(name, look) { const all = store('looks') || {}; all[String(name).toLowerCase()] = look; store('looks', all); }

  function hatSVG(h, color) {
    switch (h) {
      case 'cap': return `<path d="M36 34 q24 -26 48 0 z" fill="${color}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M80 33 h18" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>`;
      case 'party': return `<path d="M46 24 L60 -6 L74 24 z" fill="${color}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><circle cx="60" cy="-7" r="4.5" fill="#ffd426" stroke="${INK}" stroke-width="2"/><path d="M52 14 l14 -4 M50 20 l18 -5" stroke="#fff" stroke-width="2.5" opacity=".7"/>`;
      case 'beanie': return `<path d="M35 36 q25 -36 50 0 z" fill="${color}" stroke="${INK}" stroke-width="3"/><rect x="33" y="31" width="54" height="9" rx="4" fill="${color}" stroke="${INK}" stroke-width="3"/><circle cx="60" cy="8" r="6" fill="#fff" stroke="${INK}" stroke-width="2.5"/>`;
      case 'crown': return `<path d="M41 26 L44 8 L52 18 L60 4 L68 18 L76 8 L79 26 z" fill="#ffd426" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>`;
      case 'horns': return `<path d="M40 28 q-10 -14 -4 -24 q4 12 12 16 z M80 28 q10 -14 4 -24 q-4 12 -12 16 z" fill="#ef4444" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`;
      case 'tophat': return `<rect x="44" y="-4" width="32" height="28" rx="3" fill="${INK}"/><rect x="36" y="22" width="48" height="6" rx="3" fill="${INK}"/><rect x="44" y="14" width="32" height="5" fill="${color}"/>`;
      case 'headband': return `<path d="M36 34 q24 -10 48 0" stroke="${color}" stroke-width="7" fill="none" stroke-linecap="round"/><path d="M84 33 l9 -6 M84 34 l10 3" stroke="${color}" stroke-width="4" stroke-linecap="round"/>`;
      default: return '';
    }
  }

  // markup del personaggio; missing = quanti pezzi ha già perso
  function svg(look, { size = 110, missing = 0, cls = '' } = {}) {
    const L = look || defaultLook('x');
    const gone = new Set(PARTS.slice(0, missing));
    const hide = (p) => (gone.has(p) ? ' style="display:none"' : '');
    const h = Math.round(size * 170 / 120);
    return `<svg xmlns="${NS}" class="char ${cls}" viewBox="0 0 120 170" width="${size}" height="${h}" overflow="visible" style="overflow:visible">
  <g class="whole">
    <g class="legL"${hide('legL')}><path d="M53 118 L47 155" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><ellipse cx="44" cy="158" rx="9" ry="5" fill="${INK}"/></g>
    <g class="legR"${hide('legR')}><path d="M67 118 L73 155" stroke="${INK}" stroke-width="9" stroke-linecap="round"/><ellipse cx="76" cy="158" rx="9" ry="5" fill="${INK}"/></g>
    <g class="armL"${hide('armL')}><path d="M42 84 L24 106" stroke="${L.color}" stroke-width="9" stroke-linecap="round"/><circle cx="23" cy="108" r="6" fill="${L.skin}" stroke="${INK}" stroke-width="2.5"/></g>
    <g class="armR"${hide('armR')}><path d="M78 84 L96 106" stroke="${L.color}" stroke-width="9" stroke-linecap="round"/><circle cx="97" cy="108" r="6" fill="${L.skin}" stroke="${INK}" stroke-width="2.5"/></g>
    <g class="body"><rect x="38" y="70" width="44" height="54" rx="16" fill="${L.color}" stroke="${INK}" stroke-width="3"/><path d="M50 81 h20" stroke="rgba(255,255,255,.4)" stroke-width="3" stroke-linecap="round"/></g>
  </g>
  <g class="head">
    <circle cx="60" cy="44" r="25" fill="${L.skin}" stroke="${INK}" stroke-width="3"/>
    <g class="eyes"><circle cx="51" cy="42" r="3.6" fill="${INK}"/><circle cx="69" cy="42" r="3.6" fill="${INK}"/><circle cx="52.2" cy="40.8" r="1.1" fill="#fff"/><circle cx="70.2" cy="40.8" r="1.1" fill="#fff"/></g>
    <g class="xeyes" opacity="0"><path d="M47 38 l8 8 M55 38 l-8 8 M65 38 l8 8 M73 38 l-8 8" stroke="${INK}" stroke-width="3" stroke-linecap="round"/></g>
    <path class="mouth" d="M52 54 q8 7 16 0" stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"/>
    ${L.glasses ? `<g fill="none" stroke="${INK}" stroke-width="2.5"><circle cx="51" cy="42" r="7"/><circle cx="69" cy="42" r="7"/><path d="M58 42 h4"/></g>` : ''}
    ${L.stache ? `<path d="M50 51 q5 -4 10 0 q5 -4 10 0 q-5 4 -10 1 q-5 3 -10 -1z" fill="${INK}"/>` : ''}
    ${hatSVG(L.hat, L.color)}
  </g>
  <g class="fxl"></g>
</svg>`;
  }

  /* ---------- animazioni ---------- */
  const ok = () => typeof gsap !== 'undefined' && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rand = (a, b) => a + Math.random() * (b - a);
  const q = (s, c) => s.querySelector('.' + c);
  function add(s, tag, attrs, text) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text) e.textContent = text;
    q(s, 'fxl').appendChild(e);
    return e;
  }
  // schizzi rossi da cartone
  function blood(s, x, y, n = 12, power = 34, up = false) {
    for (let i = 0; i < n; i++) {
      const c = add(s, 'circle', { cx: x, cy: y, r: rand(1.6, 3.8), fill: '#e3263c' });
      const a = up ? rand(-2.7, -0.45) : rand(0, Math.PI * 2);
      const d = rand(power * 0.35, power);
      gsap.to(c, { x: Math.cos(a) * d, y: Math.sin(a) * d, duration: rand(0.35, 0.6), ease: 'power2.out' });
      gsap.to(c, { y: `+=${rand(25, 60)}`, delay: rand(0.35, 0.55), duration: 0.6, ease: 'power2.in' });
      gsap.to(c, { opacity: 0, delay: rand(0.9, 1.4), duration: 0.5, onComplete: () => c.remove() });
    }
    const splat = add(s, 'ellipse', { cx: x + rand(-10, 10), cy: 164, rx: 0, ry: 0, fill: '#b91c1c', opacity: 0.85 });
    gsap.to(splat, { attr: { rx: rand(10, 20), ry: rand(3, 5) }, delay: 0.5, duration: 0.3 });
  }
  function dead(s) {
    q(s, 'eyes').setAttribute('opacity', '0');
    q(s, 'xeyes').setAttribute('opacity', '1');
    q(s, 'mouth').setAttribute('d', 'M52 58 q8 -7 16 0');
  }
  const visible = (s, p) => q(s, p) && q(s, p).style.display !== 'none';
  function flyOff(s, p, tl, at) {
    const part = q(s, p);
    const side = p.endsWith('L') ? -1 : 1;
    const floor = 160 - +PIVOT[p].split(' ')[1]; // atterra all'altezza dei piedi
    tl.to(part, { x: side * rand(45, 75), y: rand(-60, -25), rotation: side * rand(200, 520), svgOrigin: PIVOT[p], duration: 0.45, ease: 'power2.out' }, at)
      .to(part, { y: floor, duration: 0.5, ease: 'bounce.out' }, '>')
      .to(part, { opacity: 0, duration: 0.6, delay: 0.9 }, '>')
      .call(() => blood(s, +PIVOT[p].split(' ')[0], +PIVOT[p].split(' ')[1], 9, 26), null, at);
  }
  // le parti devono restare dentro lo stesso contenitore per far cadere tutto insieme
  const fallBack = (s, tl, at, dir = -1) => tl
    .to([q(s, 'whole'), q(s, 'head')], { rotation: dir * 90, svgOrigin: PIVOT.feet, duration: 0.7, ease: 'bounce.out' }, at);

  // un errore durante il round: vola via un pezzo
  function damage(s, hits) {
    if (!s) return;
    const p = PARTS[hits - 1];
    if (!ok()) { if (p) q(s, p).style.display = 'none'; return; }
    const tl = gsap.timeline();
    tl.to(s, { x: -6, duration: 0.05, yoyo: true, repeat: 3 });
    if (p && visible(s, p)) flyOff(s, p, tl, 0);
    else tl.to(q(s, 'head'), { rotation: 18, svgOrigin: PIVOT.head, duration: 0.12, yoyo: true, repeat: 3 }, 0);
    q(s, 'mouth').setAttribute('d', 'M52 57 q8 -5 16 0');
  }

  const KILLS = {
    decapitato(s, tl) {
      const blade = add(s, 'path', { d: 'M-40 67 L160 67', stroke: '#e4e4e7', 'stroke-width': 5, 'stroke-linecap': 'round', opacity: 0 });
      tl.fromTo(blade, { opacity: 0, x: -60 }, { opacity: 1, x: 0, duration: 0.14, ease: 'power4.in' })
        .to(blade, { opacity: 0, x: 60, duration: 0.18 })
        .call(() => { dead(s); blood(s, 60, 68, 26, 50, true); })
        .to(q(s, 'head'), { x: 40, y: -80, rotation: 420, svgOrigin: '60 44', duration: 0.6, ease: 'power2.out' }, '<')
        .to(q(s, 'head'), { x: 90, y: 120, duration: 0.6, ease: 'power2.in' })
        .call(() => blood(s, 60, 68, 14, 38, true), null, '-=0.9')
        .to(q(s, 'whole'), { x: -4, duration: 0.08, yoyo: true, repeat: 5 }, '-=1')
        .to(q(s, 'whole'), { rotation: 90, svgOrigin: PIVOT.feet, duration: 0.7, ease: 'bounce.out' }, '-=0.4');
    },
    smembrato(s, tl) {
      tl.call(() => dead(s));
      PARTS.filter((p) => visible(s, p)).forEach((p, i) => flyOff(s, p, tl, 0.1 + i * 0.16));
      tl.to(q(s, 'whole'), { y: 30, duration: 0.4, ease: 'bounce.out' }, '>-0.3')
        .to(q(s, 'head'), { y: 92, duration: 0.4, ease: 'bounce.out' }, '<')
        .to(q(s, 'head'), { x: 70, rotation: 360, svgOrigin: '60 44', duration: 0.9, ease: 'power1.out' });
    },
    fucilato(s, tl) {
      const bang = add(s, 'text', { x: 104, y: 40, 'font-size': 22, 'font-weight': 900, fill: '#ffd426', stroke: INK, 'stroke-width': 1.5, 'font-family': 'Outfit, sans-serif' }, 'BANG!');
      const bullet = add(s, 'circle', { cx: 150, cy: 92, r: 3, fill: INK });
      tl.fromTo(bang, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1.2, duration: 0.25, ease: 'back.out(3)' })
        .to(bullet, { attr: { cx: 64 }, duration: 0.12, ease: 'none' })
        .call(() => { bullet.remove(); add(s, 'circle', { cx: 64, cy: 92, r: 4.5, fill: '#3f0d12' }); dead(s); blood(s, 64, 92, 20, 40); })
        .to([q(s, 'whole'), q(s, 'head')], { x: -10, duration: 0.1 })
        .to(bang, { opacity: 0, duration: 0.3 }, '<');
      fallBack(s, tl, '>', -1);
    },
    esploso(s, tl) {
      const bomb = add(s, 'text', { x: 46, y: -50, 'font-size': 30 }, '💣');
      tl.to(bomb, { attr: { y: 162 }, rotation: 220, transformOrigin: '50% 50%', duration: 0.55, ease: 'power2.in' })
        .call(() => {
          bomb.remove(); dead(s);
          const boom = add(s, 'text', { x: 60, y: 130, 'font-size': 40, 'text-anchor': 'middle' }, '💥');
          gsap.fromTo(boom, { scale: 0.2, transformOrigin: '50% 50%' }, { scale: 3.2, opacity: 0, duration: 0.7, ease: 'power2.out', onComplete: () => boom.remove() });
          blood(s, 60, 110, 30, 70);
        });
      ['head', 'armL', 'armR', 'legL', 'legR', 'body'].forEach((p) => {
        if (!visible(s, p)) return;
        tl.to(q(s, p), { x: rand(-120, 120), y: rand(-150, -40), rotation: rand(-720, 720), transformOrigin: '50% 50%', duration: 0.6, ease: 'power2.out' }, '<0.02')
          .to(q(s, p), { y: 180, opacity: 0, duration: 0.6, ease: 'power2.in' }, '>');
      });
    },
    schiacciato(s, tl) {
      const anvil = add(s, 'path', { d: 'M30 0 H90 L82 9 H96 V22 H24 V9 H38 Z', fill: '#52525b', stroke: INK, 'stroke-width': 3, 'stroke-linejoin': 'round' });
      gsap.set(anvil, { y: -220 });
      tl.to(anvil, { y: -3, duration: 0.45, ease: 'power3.in' })
        .call(() => { dead(s); blood(s, 30, 158, 12, 30, true); blood(s, 90, 158, 12, 30, true); })
        .to([q(s, 'whole'), q(s, 'head')], { scaleY: 0.14, svgOrigin: PIVOT.feet, duration: 0.18, ease: 'power4.in' }, '<')
        .to(anvil, { y: 117, duration: 0.18, ease: 'power4.in' }, '<')
        .to(anvil, { y: 112, duration: 0.12, yoyo: true, repeat: 1 });
    },
    fulminato(s, tl) {
      const bolt = add(s, 'path', { d: 'M70 -80 L48 -10 L64 -10 L44 30 L80 -24 L64 -24 L82 -80 Z', fill: '#fde047', stroke: INK, 'stroke-width': 2.5 });
      tl.fromTo(bolt, { opacity: 0 }, { opacity: 1, duration: 0.05, repeat: 5, yoyo: true })
        .call(() => dead(s))
        .to([q(s, 'whole'), q(s, 'head')], { filter: 'brightness(0.12)', duration: 0.15 }, '<')
        .to([q(s, 'whole'), q(s, 'head')], { x: 3, duration: 0.04, yoyo: true, repeat: 9 }, '<')
        .to(bolt, { opacity: 0, duration: 0.2 })
        .call(() => {
          for (let i = 0; i < 5; i++) {
            const puff = add(s, 'circle', { cx: 50 + i * 5, cy: 40, r: 6, fill: '#9ca3af', opacity: 0.8 });
            gsap.to(puff, { attr: { cy: -40, r: 14 }, opacity: 0, duration: 1.4, delay: i * 0.1, onComplete: () => puff.remove() });
          }
        })
        .to([q(s, 'whole'), q(s, 'head')], { scaleY: 0.35, svgOrigin: PIVOT.feet, duration: 0.5, ease: 'bounce.out' });
    },
  };
  const KILL_NAMES = Object.keys(KILLS);

  // ritorna il tipo di morte scelto (per le statistiche)
  function kill(s, type) {
    const t = type || KILL_NAMES[Math.floor(Math.random() * KILL_NAMES.length)];
    if (!s) return t;
    if (!ok()) { dead(s); s.style.opacity = '0.4'; return t; }
    const tl = gsap.timeline();
    KILLS[t](s, tl);
    return t;
  }
  function dance(s) {
    if (!s || !ok()) return;
    q(s, 'mouth').setAttribute('d', 'M50 52 q10 12 20 0 z');
    gsap.to(q(s, 'armL'), { rotation: 110, svgOrigin: PIVOT.armL, duration: 0.25, yoyo: true, repeat: 7, ease: 'power1.inOut' });
    gsap.to(q(s, 'armR'), { rotation: -110, svgOrigin: PIVOT.armR, duration: 0.25, yoyo: true, repeat: 7, ease: 'power1.inOut', delay: 0.12 });
    gsap.to([q(s, 'whole'), q(s, 'head')], { y: -14, duration: 0.22, yoyo: true, repeat: 7, ease: 'power2.out' });
    gsap.to(q(s, 'head'), { rotation: 12, svgOrigin: PIVOT.head, duration: 0.3, yoyo: true, repeat: 5 });
  }

  const DEATH_LABEL = {
    decapitato: 'è stato decapitato', smembrato: 'è stato fatto a pezzi', fucilato: 'è stato fucilato',
    esploso: 'è saltato in aria', schiacciato: 'è stato schiacciato da un\'incudine', fulminato: 'è stato fulminato',
  };
  return { svg, lookFor, setLook, clean, randomLook, defaultLook, damage, kill, dance, KILL_NAMES, DEATH_LABEL, PARTS };
})();
