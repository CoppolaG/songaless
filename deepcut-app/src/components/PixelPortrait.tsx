'use client';

import { useEffect, useRef } from 'react';
import { PALETTE } from '@/design/tokens';

const PAL_RGB = Object.values(PALETTE).map((h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
});

function nearest(r: number, g: number, b: number) {
  let best = PAL_RGB[0];
  let bd = Infinity;
  for (const p of PAL_RGB) {
    // distanza pesata sulla luminosità percepita
    const d = 2 * (p[0] - r) ** 2 + 4 * (p[1] - g) ** 2 + 3 * (p[2] - b) ** 2;
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}

type Props = { src: string; size?: number; scale?: 2 | 3 | 4; className?: string };

/**
 * Foto o copertina ridotta a size×size pixel e ricolorata con la palette:
 * diventa pixel art vera. Se il browser non permette di leggere i pixel,
 * resta solo rimpicciolita.
 */
export function PixelPortrait({ src, size = 20, scale = 3, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.fillStyle = PALETTE.dusk;
    ctx.fillRect(0, 0, size, size);
    if (!src) return;
    let alive = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (!alive) return;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(img, 0, 0, size, size);
      try {
        const data = ctx.getImageData(0, 0, size, size);
        const d = data.data;
        for (let i = 0; i < d.length; i += 4) {
          const [r, g, b] = nearest(d[i], d[i + 1], d[i + 2]);
          d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
        }
        ctx.putImageData(data, 0, 0);
      } catch { /* immagine senza CORS: resta così */ }
    };
    img.src = src;
    return () => { alive = false; };
  }, [src, size]);
  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      aria-hidden
      className={className}
      style={{ width: size * scale, height: size * scale }}
    />
  );
}
