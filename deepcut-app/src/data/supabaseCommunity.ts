import type { CommunityService } from './types';

/**
 * Comunità vera su Supabase, via API REST (nessuna libreria da installare).
 * Si attiva da sola quando sono impostate NEXT_PUBLIC_SUPABASE_URL e
 * NEXT_PUBLIC_SUPABASE_ANON_KEY. Le tabelle sono descritte nel README.
 */
export function createSupabaseCommunity(url: string, key: string): CommunityService {
  const headers = { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };

  async function count(query: string) {
    const r = await fetch(`${url}/rest/v1/${query}`, {
      method: 'HEAD',
      headers: { ...headers, Prefer: 'count=exact' },
    });
    const range = r.headers.get('content-range') || '*/0';
    return Number(range.split('/')[1]) || 0;
  }

  return {
    kind: 'supabase',

    async submitScore(day, score, tiers) {
      await fetch(`${url}/rest/v1/scores`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ day, score, tiers }),
      });
    },

    async getDayScores(day) {
      const r = await fetch(`${url}/rest/v1/scores?select=score&day=eq.${day}&limit=20000`, { headers });
      if (!r.ok) return [];
      return ((await r.json()) as { score: number }[]).map((x) => x.score);
    },

    async recordAnswer(day, artistId, trackKey) {
      await fetch(`${url}/rest/v1/answers`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({ day, artist_id: artistId, track_key: trackKey }),
      });
    },

    async getAnswerShare(day, artistId, trackKey) {
      const base = `answers?day=eq.${day}&artist_id=eq.${artistId}`;
      const [same, all] = await Promise.all([
        count(`${base}&track_key=eq.${encodeURIComponent(trackKey)}`),
        count(base),
      ]);
      return { share: all ? Math.round((same / all) * 1000) / 10 : 0, players: all };
    },
  };
}
