'use client';

import { useEffect, useRef } from 'react';
import { drawSprite, type Sprite } from '@/design/sprites';
import type { PaletteKey } from '@/design/tokens';

type Props = {
  sprite: Sprite;
  /** solo multipli interi */
  scale?: 1 | 2 | 3 | 4 | 5 | 6 | 8;
  recolor?: Partial<Record<string, PaletteKey>>;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
};

/** Sprite disegnato a risoluzione nativa e ingrandito di un multiplo intero. */
export function PixelSprite({ sprite, scale = 3, recolor, className, style, title }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const key = JSON.stringify(recolor ?? {});
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    drawSprite(ctx, sprite, 0, 0, recolor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprite, key]);
  return (
    <canvas
      ref={ref}
      width={sprite.w}
      height={sprite.h}
      className={className}
      title={title}
      aria-hidden={title ? undefined : true}
      style={{ width: sprite.w * scale, height: sprite.h * scale, ...style }}
    />
  );
}
