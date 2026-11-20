import { searchArtistTracks, type Track } from './deezer';
import { norm, similarity } from './util';

export type MatchResult =
  | { status: 'found'; track: Track }
  | { status: 'maybe'; track: Track }
  | { status: 'none' };

const SURE = 0.88;
const MAYBE = 0.7;

/** Cerca la risposta tra le canzoni più ascoltate, poi su tutta la discografia Deezer. */
export async function checkAnswer(artistId: number, artistName: string, top: Track[], text: string): Promise<MatchResult> {
  const n = norm(text);
  if (n.length < 2) return { status: 'none' };

  const exact = top.find((t) => t.key === n);
  if (exact) return { status: 'found', track: exact };

  let best: Track | null = null;
  let bestSim = 0;
  for (const t of top) {
    const s = similarity(n, t.key);
    if (s > bestSim) { bestSim = s; best = t; }
  }
  if (best && bestSim >= SURE) return { status: 'found', track: best };

  const more = await searchArtistTracks(artistId, artistName, text);
  const hit = more.find((t) => t.key === n);
  if (hit) return { status: 'found', track: hit };
  for (const t of more) {
    const s = similarity(n, t.key);
    if (s > bestSim) { bestSim = s; best = t; }
  }
  if (best && bestSim >= SURE) return { status: 'found', track: best };
  if (best && bestSim >= MAYBE) return { status: 'maybe', track: best };
  return { status: 'none' };
}

/** Posizione della canzone tra le più ascoltate dell'artista (1 = la più ascoltata). */
export function positionOf(track: Track, top: Track[]) {
  return 1 + top.filter((t) => t.key !== track.key && t.rank > track.rank).length;
}
