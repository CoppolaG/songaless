'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import {
  BONE, CASSETTE, CD, CLOUD, DIGGER_BODY, GEM, GOLD_GEM, GOLD_VINYL, LAMP, NOTE, ROCK, ROOT,
  SHOP, SHOVEL_DOWN, SHOVEL_UP, SIGNPOST, SUN, VINYL, drawSprite, drawText, textWidth, type Sprite,
} from '@/design/sprites';
import { GRASS, LABEL_COLORS, PALETTE, SKY, ZONE_COLORS, type PaletteKey } from '@/design/tokens';
import { METERS_PER_POINT, zoneIndex, ZONES } from '@/game/rules';
import { hash2 } from '@/game/util';
import { sfx } from '@/game/audio';

export type SceneSign = { depth: number; label: string; color: PaletteKey };

export type SceneHandle = {
  /** l'omino scava di `points` pixel; si risolve quando arriva */
  digTo(points: number): Promise<void>;
  /** riposiziona tutto (nuova partita o partita ripresa) */
  reset(depth: number, signs: SceneSign[]): void;
  addSign(sign: SceneSign): void;
};

type Props = { view: 'home' | 'play'; onZone?: (name: string) => void };

const CHUNK = 128;

const rgb = (k: PaletteKey) => {
  const n = parseInt(PALETTE[k].slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};

/**
 * Sezione del sottosuolo disegnata su <canvas> a risoluzione nativa:
 * 1 pixel della scena = 1 punto = 10 metri. Il canvas è ingrandito di un
 * multiplo intero (x2, x3, x4...) con image-rendering: pixelated.
 */
export const Scene = forwardRef<SceneHandle, Props>(function Scene({ view, onZone }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const onZoneRef = useRef(onZone);
  onZoneRef.current = onZone;

  const s = useRef({
    W: 200, H: 150, S: 4, CX: 100,
    camY: -80, digY: 0, targetY: 0, speed: 40, digging: false, lastDig: 0, zone: 0, t: 0,
    signs: [] as SceneSign[],
    particles: [] as { x: number; y: number; vx: number; vy: number; life: number; color: string }[],
    chunks: new Map<number, HTMLCanvasElement>(),
    landed: null as null | (() => void),
  });

  useImperativeHandle(ref, () => ({
    digTo(points) {
      const st = s.current;
      return new Promise<void>((resolve) => {
        const target = st.targetY + points;
        const dist = target - st.digY;
        st.speed = Math.max(30, dist / 2.2);
        st.targetY = target;
        if (dist <= 0) { resolve(); return; }
        st.landed = resolve;
      });
    },
    reset(depth, signs) {
      const st = s.current;
      st.digY = st.targetY = depth;
      st.signs = signs.slice();
      st.particles = [];
      st.zone = zoneIndex(depth * METERS_PER_POINT);
      st.landed = null;
    },
    addSign(sign) { s.current.signs.push(sign); },
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const st = s.current;

    function resize() {
      st.S = Math.max(2, Math.floor(Math.min(innerWidth / 190, innerHeight / 150)));
      st.W = Math.ceil(innerWidth / st.S);
      st.H = Math.ceil(innerHeight / st.S);
      st.CX = Math.floor(st.W / 2);
      canvas.width = st.W;
      canvas.height = st.H;
      canvas.style.width = `${st.W * st.S}px`;
      canvas.style.height = `${st.H * st.S}px`;
      st.chunks = new Map();
    }

    /* --- pezzi di sottosuolo disegnati una volta sola --- */
    function buildChunk(ci: number) {
      const { W, CX } = st;
      const c = document.createElement('canvas');
      c.width = W; c.height = CHUNK;
      const g = c.getContext('2d')!;
      const img = g.createImageData(W, CHUNK);
      const D = img.data;
      const zones = ZONE_COLORS.map((z) => ({ base: rgb(z.base), dark: rgb(z.dark), light: rgb(z.light) }));
      const grass = rgb(GRASS.base), grassD = rgb(GRASS.dark);
      const set = (x: number, y: number, p: readonly number[]) => {
        const i = (y * W + x) * 4;
        D[i] = p[0]; D[i + 1] = p[1]; D[i + 2] = p[2]; D[i + 3] = 255;
      };
      for (let y = 0; y < CHUNK; y++) {
        const wy = ci * CHUNK + y;
        if (wy < 0) continue;
        for (let x = 0; x < W; x++) {
          const h = hash2(x, wy);
          if (wy <= 1) { set(x, y, h < 0.3 ? grassD : grass); continue; }
          if (wy <= 3 && h < 0.5 - wy * 0.1) { set(x, y, grassD); continue; }
          const m = wy * METERS_PER_POINT + Math.sin(x * 0.17 + Math.floor(wy / 100)) * 35;
          const z = zones[zoneIndex(m)];
          const band = (wy + Math.round(Math.sin(x * 0.06) * 2)) % 11 === 0;
          set(x, y, band || h < 0.1 ? z.dark : h > 0.92 ? z.light : z.base);
        }
      }
      g.putImageData(img, 0, 0);

      // oggetti sepolti, scelti in base allo strato
      const CELL = 14;
      const y0 = ci * CHUNK;
      for (let cy = Math.floor(y0 / CELL); cy <= Math.floor((y0 + CHUNK) / CELL); cy++) {
        for (let cx = 0; cx < Math.ceil(W / CELL); cx++) {
          if (cy < 1 || hash2(cx * 7 + 3, cy * 13 + 1) > 0.42) continue;
          const ox = cx * CELL + Math.floor(hash2(cx, cy) * 6);
          const oy = cy * CELL + Math.floor(hash2(cy, cx) * 6);
          if (Math.abs(ox + 4 - CX) < 13) continue;
          const zi = zoneIndex(oy * METERS_PER_POINT);
          const r = hash2(ox, oy);
          const pick = (opts: [number, Sprite][]) => opts.find(([p]) => r < p)?.[1] ?? opts[opts.length - 1][1];
          const sp =
            zi === 0 ? pick([[0.35, ROCK], [0.6, ROOT], [1, VINYL]]) :
            zi === 1 ? pick([[0.45, VINYL], [0.8, CASSETTE], [1, ROCK]]) :
            zi === 2 ? pick([[0.5, VINYL], [0.8, CASSETTE], [1, BONE]]) :
            zi === 3 ? pick([[0.45, CD], [0.75, CASSETTE], [1, VINYL]]) :
            zi === 4 ? pick([[0.4, BONE], [0.7, CASSETTE], [1, GEM]]) :
            pick([[0.35, GOLD_VINYL], [0.65, GOLD_GEM], [1, NOTE]]);
          const label = LABEL_COLORS[Math.floor(r * 97) % LABEL_COLORS.length];
          drawSprite(g, sp, ox, oy - y0, { L: label, r: sp === ROCK ? ZONE_COLORS[zi].dark : sp === ROOT ? 'darkBrown' : undefined });
        }
      }
      return c;
    }
    const chunk = (ci: number) => {
      if (!st.chunks.has(ci)) st.chunks.set(ci, buildChunk(ci));
      return st.chunks.get(ci)!;
    };

    const toS = (wy: number) => Math.round(wy - st.camY);

    function drawSky() {
      const { W, H } = st;
      const top = -170;
      for (let sy = 0; sy < H; sy++) {
        const wy = st.camY + sy;
        if (wy >= 0) break;
        const t = Math.max(0, Math.min(0.999, (wy - top) / -top));
        const bi = t * SKY.length;
        const i = Math.floor(bi);
        ctx.fillStyle = PALETTE[SKY[i]];
        ctx.fillRect(0, sy, W, 1);
        // dithering a scacchiera tra una fascia e l'altra
        if (bi - i > 0.55 && i + 1 < SKY.length) {
          ctx.fillStyle = PALETTE[SKY[i + 1]];
          for (let x = sy & 1; x < W; x += 2) ctx.fillRect(x, sy, 1, 1);
        }
      }
      drawSprite(ctx, SUN, W - 30, toS(-125));
      for (let i = 0; i < 5; i++) {
        const cx = Math.floor((i * 61 + st.t * (2 + i)) % (W + 60)) - 40;
        drawSprite(ctx, CLOUD, cx, toS(-150 + i * 18 + (i % 2) * 9));
      }
      const gy = toS(0);
      if (gy > -40 && gy < H + 40) {
        const { CX } = st;
        const sx = CX - 60;
        drawSprite(ctx, SHOP, sx, gy - SHOP.h);
        const sign = 'DISCHI';
        drawText(ctx, sign, sx + Math.floor((SHOP.w - textWidth(sign)) / 2), gy - SHOP.h + 5, Math.floor(st.t * 2) % 2 ? 'yellow' : 'salmon');
        drawSprite(ctx, LAMP, CX + 26, gy - LAMP.h);
        drawSprite(ctx, SIGNPOST, CX + 6, gy - SIGNPOST.h);
        drawText(ctx, 'SCAVO', CX + 6 + Math.floor((SIGNPOST.w - textWidth('SCAVO')) / 2), gy - SIGNPOST.h + 2, 'darkBrown');
      }
    }

    function drawWorld() {
      const { W, H, CX } = st;
      for (let ci = Math.max(0, Math.floor(st.camY / CHUNK)); ci <= Math.floor((st.camY + H) / CHUNK); ci++) {
        ctx.drawImage(chunk(ci), 0, Math.round(ci * CHUNK - st.camY));
      }
      // pozzo
      const bottom = st.digY + 1;
      if (bottom > 1) {
        const y1 = toS(2), y2 = toS(bottom);
        ctx.fillStyle = PALETTE.void; ctx.fillRect(CX - 8, y1, 17, y2 - y1);
        ctx.fillStyle = PALETTE.darkBrown;
        for (let y = Math.max(y1, 0); y < Math.min(y2, H); y++) {
          if ((y + Math.floor(st.camY)) % 3 === 0) { ctx.fillRect(CX - 8, y, 1, 1); ctx.fillRect(CX + 8, y, 1, 1); }
        }
        ctx.fillStyle = PALETTE.brown;
        for (let wy = 25; wy < bottom - 2; wy += 25) { const y = toS(wy); if (y > -2 && y < H) ctx.fillRect(CX - 8, y, 17, 1); }
      }
      // righello dei metri
      for (let wy = 50; wy < st.camY + H; wy += 50) {
        const y = toS(wy);
        if (y < -6 || y > H) continue;
        const label = `${wy * METERS_PER_POINT}M`;
        const w = textWidth(label);
        ctx.fillStyle = PALETTE.void; ctx.fillRect(0, y - 1, w + 8, 7);
        drawText(ctx, label, 2, y, 'cream');
        ctx.fillStyle = PALETTE.cream; ctx.fillRect(w + 4, y + 2, 3, 1);
      }
      // cartelli delle risposte, appesi alla profondità raggiunta
      st.signs.forEach((sg, i) => {
        if (sg.depth > st.digY + 0.5) return;
        const y = toS(sg.depth) - 4;
        if (y < -10 || y > H) return;
        const w = textWidth(sg.label) + 6;
        const left = i % 2 === 1;
        const x = left ? CX - 11 - w : CX + 11;
        ctx.fillStyle = PALETTE.darkBrown; ctx.fillRect(left ? x + w : x - 2, y + 3, 2, 1);
        ctx.fillStyle = PALETTE.void; ctx.fillRect(x - 1, y - 1, w + 2, 9);
        ctx.fillStyle = PALETTE[sg.color]; ctx.fillRect(x, y, w, 7);
        drawText(ctx, sg.label, x + 3, y + 1, 'void');
      });
      // omino
      const frame = st.digging ? Math.floor(st.t * 10) % 2 : 0;
      const dx = CX - 7, dy = toS(st.digY) - DIGGER_BODY.h + 1 + (st.digging ? frame : 0);
      drawSprite(ctx, DIGGER_BODY, dx, dy);
      drawSprite(ctx, frame ? SHOVEL_UP : SHOVEL_DOWN, dx, dy);
      // buio che cresce con la profondità; la lampada del casco fa luce
      const dark = Math.min(0.8, Math.max(0, (st.digY * METERS_PER_POINT - 600) / 7000));
      if (dark > 0.01) {
        const gx = CX, gy = toS(st.digY) - 10;
        // anelli concentrici a gradini, disegnati riga per riga: niente anti-aliasing
        ctx.fillStyle = PALETTE.void;
        ctx.globalAlpha = dark / 4;
        for (let ring = 0; ring < 4; ring++) {
          const r = 22 + ring * 12;
          for (let sy = 0; sy < H; sy++) {
            const d = sy - gy;
            if (Math.abs(d) >= r) { ctx.fillRect(0, sy, W, 1); continue; }
            const hw = Math.floor(Math.sqrt(r * r - d * d));
            ctx.fillRect(0, sy, Math.max(0, gx - hw), 1);
            ctx.fillRect(gx + hw, sy, W, 1);
          }
        }
        ctx.globalAlpha = 1;
      }
    }

    function drawParticles(dt: number) {
      st.particles = st.particles.filter((p) => (p.life -= dt) > 0);
      for (const p of st.particles) {
        p.vy += 160 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x), toS(p.y), 1, 1);
      }
    }

    let raf = 0;
    let last = performance.now();
    function loop(now: number) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      st.t += dt;
      if (st.digY < st.targetY) {
        st.digging = true;
        st.digY = Math.min(st.targetY, st.digY + st.speed * dt);
        if (now - st.lastDig > 140) {
          st.lastDig = now; sfx.dig();
          const z = ZONE_COLORS[zoneIndex(st.digY * METERS_PER_POINT)];
          for (let i = 0; i < 6; i++) {
            st.particles.push({
              x: st.CX + (Math.random() * 12 - 6), y: st.digY,
              vx: (Math.random() * 2 - 1) * 40, vy: -40 - Math.random() * 50, life: 0.6,
              color: PALETTE[Math.random() < 0.5 ? z.light : z.dark],
            });
          }
        }
        const zi = zoneIndex(st.digY * METERS_PER_POINT);
        if (zi > st.zone) { st.zone = zi; onZoneRef.current?.(ZONES[zi].name); }
      } else if (st.digging) {
        st.digging = false;
        const cb = st.landed; st.landed = null; cb?.();
      }
      const camTarget = viewRef.current === 'home' ? -st.H * 0.55 : st.digY - st.H * 0.3;
      st.camY += (camTarget - st.camY) * Math.min(1, dt * 4);

      ctx.fillStyle = PALETTE.void; ctx.fillRect(0, 0, st.W, st.H);
      drawSky();
      drawWorld();
      drawParticles(dt);
      raf = requestAnimationFrame(loop);
    }

    resize();
    addEventListener('resize', resize);
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); removeEventListener('resize', resize); };
  }, []);

  return <canvas ref={canvasRef} aria-hidden className="fixed left-0 top-0 z-0" />;
});
