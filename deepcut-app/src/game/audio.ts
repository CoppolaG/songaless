/* Effetti 8-bit con WebAudio e anteprime Deezer. */
let actx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
  if (!on) stopPreview();
}

function ac() {
  if (typeof window === 'undefined') return null;
  if (!actx) {
    try { actx = new AudioContext(); } catch { return null; }
  }
  if (actx.state === 'suspended') void actx.resume();
  return actx;
}

/** Da chiamare al primo clic, perché il browser sblocchi l'audio. */
export const unlockAudio = () => { ac(); };

function beep(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.06, slide = 0) {
  if (!enabled) return;
  const a = ac(); if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), a.currentTime + dur);
  g.gain.setValueAtTime(vol, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start(); o.stop(a.currentTime + dur + 0.02);
}

function noise(dur = 0.07, cutoff = 700, vol = 0.25) {
  if (!enabled) return;
  const a = ac(); if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff;
  const g = a.createGain(); g.gain.value = vol;
  src.connect(f).connect(g).connect(a.destination); src.start();
}

export const sfx = {
  dig: () => noise(),
  tick: () => beep(880, 0.04, 'square', 0.04),
  click: () => beep(660, 0.03, 'square', 0.03),
  error: () => { beep(160, 0.12); setTimeout(() => beep(110, 0.18), 110); },
  miss: () => beep(300, 0.4, 'triangle', 0.08, -220),
  land: (tier: number) => {
    const notes = [523, 659, 784, 1047, 1319, 1568];
    for (let i = 0; i < Math.min(tier + 1, notes.length); i++) setTimeout(() => beep(notes[i], 0.09, 'square', 0.05), i * 70);
  },
  zone: () => { [392, 523, 659, 784].forEach((f, i) => setTimeout(() => beep(f, 0.12, 'triangle', 0.07), i * 90)); },
};

let preview: HTMLAudioElement | null = null;
let previewTimer: ReturnType<typeof setTimeout> | undefined;

export function playPreview(url: string) {
  stopPreview();
  if (!enabled || !url) return;
  preview = new Audio(url);
  preview.volume = 0.55;
  preview.play().catch(() => {});
  previewTimer = setTimeout(stopPreview, 9000);
}

export function stopPreview() {
  clearTimeout(previewTimer);
  if (preview) { preview.pause(); preview = null; }
}
