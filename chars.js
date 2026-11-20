'use strict';
/* Aspetto dei personaggi: colore, carnagione, cappello, occhiali, baffi e (facoltativa) foto della faccia.
   Il disegno e la fisica stanno in ragdoll.js. */
const Chars = (() => {
  const COLORS = ['#ff4d8d', '#7c5cff', '#3ddc84', '#ffd426', '#22b8ff', '#ff8a3d', '#e5484d', '#a3e635', '#f472b6', '#14b8a6'];
  const SKINS = ['#ffd9b3', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffe0cc'];
  const HATS = ['none', 'cap', 'party', 'beanie', 'crown', 'horns', 'tophat', 'headband'];
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
  function randomLook(old = {}) {
    const r = (a) => a[Math.floor(Math.random() * a.length)];
    return { color: r(COLORS), skin: r(SKINS), hat: r(HATS), glasses: Math.random() < 0.3, stache: Math.random() < 0.25, photo: old.photo, faceStyle: old.faceStyle };
  }
  const MAX_PHOTO = 60000; // ~45 KB di immagine
  // aspetto che arriva da un altro dispositivo o dal salvataggio: accettiamo solo valori noti
  function clean(look, name) {
    const d = defaultLook(name);
    if (!look || typeof look !== 'object') return d;
    const hex = (v, fb) => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v : fb);
    const out = { color: hex(look.color, d.color), skin: hex(look.skin, d.skin), hat: HATS.includes(look.hat) ? look.hat : d.hat, glasses: !!look.glasses, stache: !!look.stache };
    if (typeof look.photo === 'string' && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(look.photo) && look.photo.length <= MAX_PHOTO) out.photo = look.photo;
    if (look.faceStyle === 'photo') out.faceStyle = 'photo'; // altrimenti: foto con gli occhi da cartone
    return out;
  }
  const lookFor = (name) => clean((store('looks') || {})[String(name).toLowerCase()], name);
  function setLook(name, look) { const all = store('looks') || {}; all[String(name).toLowerCase()] = look; store('looks', all); }

  // foto → quadrato 160x160 JPEG, ritagliato al centro
  function photoFromFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const S = 160; const c = document.createElement('canvas'); c.width = S; c.height = S;
        const m = Math.min(img.width, img.height);
        c.getContext('2d').drawImage(img, (img.width - m) / 2, (img.height - m) / 2, m, m, 0, 0, S, S);
        URL.revokeObjectURL(url);
        let q = 0.82; let out = c.toDataURL('image/jpeg', q);
        while (out.length > MAX_PHOTO && q > 0.3) { q -= 0.12; out = c.toDataURL('image/jpeg', q); }
        resolve(out);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Immagine non valida')); };
      img.src = url;
    });
  }

  // ritaglio scelto a mano: (cx, cy) centro e side lato del quadrato, in pixel dell'immagine originale
  function cropToPhoto(img, cx, cy, side) {
    const S = 160; const c = document.createElement('canvas'); c.width = S; c.height = S;
    const x = c.getContext('2d'); x.fillStyle = '#888'; x.fillRect(0, 0, S, S);
    x.drawImage(img, cx - side / 2, cy - side / 2, side, side, 0, 0, S, S);
    let q = 0.85; let out = c.toDataURL('image/jpeg', q);
    while (out.length > MAX_PHOTO && q > 0.3) { q -= 0.12; out = c.toDataURL('image/jpeg', q); }
    return out;
  }

  return { lookFor, setLook, clean, randomLook, defaultLook, photoFromFile, cropToPhoto };
})();
