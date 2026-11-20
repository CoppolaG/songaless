import type { Answer, GameResult } from '@/game/rules';

/** Dati del singolo giocatore: restano sempre nel suo browser. */
export interface PlayerStore {
  getDaily(day: number): GameResult | null;
  saveDaily(result: GameResult): void;
  getProgress(day: number): Answer[] | null;
  saveProgress(day: number, answers: Answer[]): void;
  clearProgress(day: number): void;
  getHistory(): { day: number; score: number }[];
  getEndlessBest(): number;
  setEndlessBest(score: number): void;
  getSetting<T>(key: string, fallback: T): T;
  setSetting<T>(key: string, value: T): void;
}

/**
 * Dati condivisi tra tutti i giocatori (punteggi del giorno, frequenza delle risposte).
 * Oggi: implementazione simulata (mockCommunity). Domani: Supabase (supabaseCommunity).
 */
export interface CommunityService {
  readonly kind: 'mock' | 'supabase';
  submitScore(day: number, score: number, tiers: string): Promise<void>;
  getDayScores(day: number): Promise<number[]>;
  recordAnswer(day: number, artistId: number, trackKey: string): Promise<void>;
  /**
   * Percentuale di giocatori che hanno dato quella risposta per quell'artista quel giorno.
   * `hint` serve solo alla simulazione (posizione della canzone su Deezer).
   */
  getAnswerShare(
    day: number,
    artistId: number,
    trackKey: string,
    hint: { pos: number | null },
  ): Promise<{ share: number; players: number }>;
}
