'use client';

import { forwardRef } from 'react';
import { BUBBLE, NOTE, type Sprite } from '@/design/sprites';
import { PALETTE, type PaletteKey } from '@/design/tokens';
import { fmt } from '@/game/util';
import { METERS_PER_POINT } from '@/game/rules';
import { PixelSprite } from './PixelSprite';

export function IconButton({ sprite, label, onClick, active = true }: {
  sprite: Sprite; label: string; onClick: () => void; active?: boolean;
}) {
  return (
    <button
      type="button"
      className="px-btn ghost grid h-10 w-10 place-items-center"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
    >
      <PixelSprite sprite={sprite} scale={2} recolor={active ? undefined : { w: 'slate' }} />
    </button>
  );
}

export const Panel = forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement> & { wide?: boolean }>(
  function Panel({ wide, className = '', children, ...rest }, ref) {
    return (
      <section
        ref={ref}
        {...rest}
        className={`px-panel anim-pop pointer-events-auto w-full ${wide ? 'max-w-[600px]' : 'max-w-[520px]'} px-5 pb-4 pt-5 text-center ${className}`}
      >
        {children}
      </section>
    );
  },
);

/** Etichetta piccola nel font pixel. */
export function Kicker({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`font-pixel text-[8px] leading-relaxed tracking-wide text-ink-dim ${className}`}>{children}</p>;
}

export function TimerBar({ left, total }: { left: number; total: number }) {
  const warn = left <= 5;
  // la barra avanza a blocchi di 1/30 come un vecchio indicatore LCD
  const blocks = 30;
  const on = Math.ceil((left / total) * blocks);
  return (
    <div className="px-inset relative my-3 flex h-[18px] gap-[2px] p-[2px]" role="timer" aria-label={`${Math.ceil(left)} secondi`}>
      {Array.from({ length: blocks }, (_, i) => (
        <span key={i} className="h-full flex-1" style={{ background: i < on ? (warn ? PALETTE.red : PALETTE.green) : 'transparent' }} />
      ))}
      <span className="font-pixel absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-ink" style={{ textShadow: `2px 2px 0 ${PALETTE.void}` }}>
        {Math.ceil(left)}
      </span>
    </div>
  );
}

export function Histogram({ scores, mine }: { scores: number[]; mine: number | null }) {
  const BIN = 70;
  const bins = new Array(10).fill(0);
  scores.forEach((s) => { bins[Math.min(9, Math.floor(s / BIN))]++; });
  const max = Math.max(1, ...bins);
  const mineBin = mine == null ? -1 : Math.min(9, Math.floor(mine / BIN));
  return (
    <div className="mt-6 mb-2 flex h-[72px] items-end gap-1">
      {bins.map((c, i) => (
        <div
          key={i}
          className="relative flex-1"
          title={`${fmt(i * BIN * METERS_PER_POINT)}–${fmt((i + 1) * BIN * METERS_PER_POINT)} m: ${c}`}
          style={{
            // altezze a scalini di 4px
            height: Math.max(4, Math.round(((c / max) * 72) / 4) * 4),
            background: i === mineBin ? PALETTE.yellow : PALETTE.steel,
          }}
        >
          {i === mineBin && <span className="anim-float absolute -top-5 left-1/2 -translate-x-1/2 text-[14px] text-accent">▼</span>}
        </div>
      ))}
    </div>
  );
}

/** Bolle e note che salgono dal pozzo, animate a scatti con steps(). */
export function Bubbles({ count = 8 }: { count?: number }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 z-[1] h-screen overflow-hidden">
      {Array.from({ length: count }, (_, i) => {
        const sprite = i % 3 === 0 ? NOTE : BUBBLE;
        const left = 8 + ((i * 37) % 84);
        return (
          <span
            key={i}
            className="anim-rise absolute bottom-[-24px]"
            style={{ left: `${left}%`, ['--dur' as string]: `${5 + (i % 4)}s`, ['--delay' as string]: `${(i * 0.9) % 6}s` }}
          >
            <PixelSprite sprite={sprite} scale={3} recolor={i % 2 ? { w: 'cyan' } : undefined} />
          </span>
        );
      })}
    </div>
  );
}

export function Toast({ text, top = false }: { text: string; top?: boolean }) {
  return (
    <div className={`px-panel anim-pop font-pixel fixed left-1/2 z-40 -translate-x-1/2 px-4 py-3 text-[10px] ${top ? 'top-[72px] text-accent' : 'bottom-6'}`}>
      {text}
    </div>
  );
}

export function Swatch({ color }: { color: PaletteKey }) {
  return <span className="inline-block h-[14px] w-[14px]" style={{ background: PALETTE[color], boxShadow: `2px 2px 0 ${PALETTE.void}` }} />;
}
