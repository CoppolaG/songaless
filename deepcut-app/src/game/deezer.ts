import { norm, sleep } from './util';

/* Deezer non ha CORS: si usa JSONP, con una pausa tra le chiamate (~50 ogni 5 s). */
let jsonpN = 0;
let lastCall = 0;

type Json = Record<string, unknown> & { data?: DzTrack[]; error?: { message?: string } };
export type DzTrack = {
  id: number;
  title: string;
  title_short?: string;
  rank?: number;
  preview?: string;
  artist?: { id: number; name: string };
  album?: { title?: string; cover_small?: string; cover_medium?: string };
};

export async function dz<T = Json>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const wait = lastCall + 110 - Date.now();
  lastCall = Math.max(Date.now(), lastCall + 110);
  if (wait > 0) await sleep(wait);
  return new Promise((resolve, reject) => {
    const cb = `__dc${++jsonpN}`;
    const q = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), output: 'jsonp', callback: cb });
    const s = document.createElement('script');
    s.src = `https://api.deezer.com/${path}?${q}`;
    const w = window as unknown as Record<string, unknown>;
    const timer = setTimeout(() => { done(); reject(new Error('Deezer non risponde')); }, 10000);
    function done() { clearTimeout(timer); delete w[cb]; s.remove(); }
    w[cb] = (data: Json) => {
      done();
      if (data && data.error) reject(new Error(data.error.message || 'Errore Deezer'));
      else resolve(data as T);
    };
    s.onerror = () => { done(); reject(new Error('Errore di rete')); };
    document.head.append(s);
  });
}

export type Track = {
  key: string;
  title: string;
  rank: number;
  cover: string;
  album: string;
  preview: string;
};

export const toTrack = (t: DzTrack): Track => ({
  key: norm(t.title_short || t.title),
  title: t.title_short || t.title,
  rank: t.rank || 0,
  cover: t.album?.cover_medium || t.album?.cover_small || '',
  album: t.album?.title || '',
  preview: t.preview || '',
});

export type ArtistData = { top: Track[]; picture: string };

const cache = new Map<number, Promise<ArtistData>>();

/** Le 100 canzoni più ascoltate (una versione per titolo, ordinate) e la foto. */
export function loadArtist(id: number): Promise<ArtistData> {
  if (!cache.has(id)) {
    const p = (async () => {
      const [r, info] = await Promise.all([
        dz(`artist/${id}/top`, { limit: 100 }),
        dz<{ picture_medium?: string }>(`artist/${id}`).catch(() => ({ picture_medium: '' })),
      ]);
      const best = new Map<string, Track>();
      for (const t of r.data || []) {
        const tr = toTrack(t);
        if (!tr.key) continue;
        const old = best.get(tr.key);
        if (!old || tr.rank > old.rank) best.set(tr.key, tr);
      }
      return { top: [...best.values()].sort((a, b) => b.rank - a.rank), picture: info.picture_medium || '' };
    })();
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return cache.get(id)!;
}

/** Brani dell'artista trovati cercando su tutto Deezer. */
export async function searchArtistTracks(artistId: number, artistName: string, text: string): Promise<Track[]> {
  const found = new Map<string, Track>();
  for (const q of [`${artistName} ${text}`, `track:"${text}"`]) {
    try {
      const r = await dz('search', { q, limit: 50 });
      for (const t of r.data || []) {
        if (t.artist?.id !== artistId) continue;
        const tr = toTrack(t);
        const old = found.get(tr.key);
        if (!old || tr.rank > old.rank) found.set(tr.key, tr);
      }
    } catch { /* proviamo la prossima ricerca */ }
    if (found.size) break;
  }
  return [...found.values()];
}
