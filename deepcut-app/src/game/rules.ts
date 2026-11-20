import { TIER_COLORS, type PaletteKey } from '@/design/tokens';

export const ROUNDS = 7;
export const ROUND_TIME = 30;
export const LIVES = 3;
/** 1 punto = 10 metri = 1 pixel nativo della scena. */
export const METERS_PER_POINT = 10;

export type Tier = {
  name: string;
  pts: number;
  /** posizione massima tra le canzoni più ascoltate per rientrare nel livello */
  max: number;
  color: PaletteKey;
  emoji: string;
  desc: string;
};

const T = (name: string, pts: number, max: number, i: number, emoji: string, desc: string): Tier =>
  ({ name, pts, max, color: TIER_COLORS[i], emoji, desc });

export const TIERS: Tier[] = [
  T('NIENTE', 0, 0, 0, '⬛', 'tempo scaduto o passo'),
  T('TORMENTONE', 10, 3, 1, '🟨', 'tra le 3 più ascoltate'),
  T('HIT', 25, 10, 2, '🟧', 'nella top 10'),
  T('CLASSICO', 40, 25, 3, '🟥', 'nella top 25'),
  T('LATO B', 60, 50, 4, '🟪', 'nella top 50'),
  T('DEEP CUT', 80, 80, 5, '🟦', 'nella top 80'),
  T('REPERTO', 100, Infinity, 6, '⬜', 'oltre le 80 più ascoltate'),
];

export const tierIndexFor = (pos: number) => TIERS.findIndex((t, i) => i > 0 && pos <= t.max);

export type Zone = { from: number; name: string; title: string };

/** Strati del sottosuolo (metri) e titolo finale di chi ci arriva. */
export const ZONES: Zone[] = [
  { from: 0, name: 'RADIO', title: 'ASCOLTATORE DA RADIO' },
  { from: 1000, name: 'CLASSIFICA', title: 'FAN DELLA CLASSIFICA' },
  { from: 2000, name: 'LATO B', title: 'GIRADISCHI DI FIDUCIA' },
  { from: 3000, name: 'BOOTLEG', title: 'CACCIATORE DI BOOTLEG' },
  { from: 4500, name: 'DEMO IN CANTINA', title: 'CRATE DIGGER' },
  { from: 6000, name: 'LEGGENDA', title: 'ARCHEOLOGO DEL SUONO' },
];

export function zoneIndex(meters: number) {
  let z = 0;
  ZONES.forEach((zz, i) => { if (meters >= zz.from) z = i; });
  return z;
}

export const rankTitle = (points: number) => ZONES[zoneIndex(points * METERS_PER_POINT)].title;

export type Answer = {
  artist: string;
  artistId: number;
  tier: number;
  pts: number;
  pos: number | null;
  title: string | null;
  trackKey: string | null;
  reason: 'ok' | 'skip' | 'time';
};

export type GameMode = 'daily' | 'endless';

export type GameResult = {
  mode: GameMode;
  day: number;
  score: number;
  answers: Answer[];
};
