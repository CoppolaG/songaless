import { mulberry32 } from '@/game/util';
import { ROUNDS, TIERS } from '@/game/rules';
import { localRaw } from './localStore';
import type { CommunityService } from './types';

/**
 * Comunità SIMULATA: finché non c'è Supabase, inventa in modo stabile
 * (stesso giorno = stessi numeri) quanti giocatori ci sono, quanto hanno scavato
 * e quanti hanno scritto ogni canzone. L'interfaccia lo segnala come "dati simulati".
 */
const playersOf = (day: number) => 700 + Math.floor(mulberry32(day * 31 + 7)() * 900);

// probabilità di ogni livello per un giocatore medio: niente, tormentone, hit, classico, lato B, deep cut, reperto
const TIER_ODDS = [0.12, 0.3, 0.22, 0.15, 0.1, 0.07, 0.04];

function fakeScore(rnd: () => number) {
  let s = 0;
  for (let r = 0; r < ROUNDS; r++) {
    let x = rnd();
    let t = 0;
    while (t < TIER_ODDS.length - 1 && x > TIER_ODDS[t]) { x -= TIER_ODDS[t]; t++; }
    s += TIERS[t].pts;
  }
  return s;
}

export const mockCommunity: CommunityService = {
  kind: 'mock',

  async submitScore(day, score) {
    const mine = localRaw.read<number[]>(`mock:scores:${day}`, []);
    localRaw.write(`mock:scores:${day}`, [...mine, score]);
  },

  async getDayScores(day) {
    const rnd = mulberry32(day * 1009 + 3);
    const n = playersOf(day);
    const scores = Array.from({ length: n }, () => fakeScore(rnd));
    return scores.concat(localRaw.read<number[]>(`mock:scores:${day}`, []));
  },

  async recordAnswer(day, artistId, trackKey) {
    const k = `mock:answers:${day}:${artistId}`;
    const m = localRaw.read<Record<string, number>>(k, {});
    m[trackKey] = (m[trackKey] || 0) + 1;
    localRaw.write(k, m);
  },

  async getAnswerShare(day, artistId, trackKey, hint) {
    const players = playersOf(day);
    if (hint.pos == null) return { share: 0, players };
    // più la canzone è in alto su Deezer, più giocatori l'hanno scritta
    const jitter = 0.75 + mulberry32(artistId * 13 + trackKey.length * 101 + day)() * 0.5;
    const share = Math.min(60, 38 * Math.pow(hint.pos, -1.1) * jitter);
    return { share: Math.max(0.1, Math.round(share * 10) / 10), players };
  },
};
