import { ARTISTS, type Artist } from './artists';
import { ROUNDS } from './rules';
import { mulberry32, shuffle } from './util';

const LAUNCH = Date.UTC(2026, 10, 20);

/** Numero dello scavo di oggi (il 20/11/2026 è il n° 1), sul fuso del giocatore. */
export function todayNumber(d = new Date()) {
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - LAUNCH) / 864e5) + 1;
}

/** I 7 artisti del giorno: girano tutti prima di ripetersi. */
export function dailyArtists(day: number): Artist[] {
  const it = shuffle(ARTISTS.filter((a) => a.it), mulberry32(4242));
  const intl = shuffle(ARTISTS.filter((a) => !a.it), mulberry32(1717));
  const pick: Artist[] = [];
  for (let k = 0; k < 4; k++) pick.push(it[(day * 4 + k) % it.length]);
  for (let k = 0; k < ROUNDS - 4; k++) pick.push(intl[(day * 3 + k) % intl.length]);
  return shuffle(pick, mulberry32(day * 7919 + 13));
}

export const endlessArtists = () => shuffle(ARTISTS);

export function msToMidnight(now = new Date()) {
  const mid = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return mid.getTime() - now.getTime();
}
