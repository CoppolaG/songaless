import type { Answer, GameResult } from '@/game/rules';
import type { PlayerStore } from './types';

const PREFIX = 'deepcut:';

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch { return fallback; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)); } catch { /* storage pieno o bloccato */ }
}
function remove(key: string) {
  try { localStorage.removeItem(PREFIX + key); } catch { /* niente */ }
}

export const localStore: PlayerStore = {
  getDaily: (day) => read<GameResult | null>(`daily:${day}`, null),
  saveDaily(result) {
    write(`daily:${result.day}`, result);
    const hist = read<{ day: number; score: number }[]>('history', []);
    if (!hist.some((h) => h.day === result.day)) write('history', [...hist, { day: result.day, score: result.score }]);
  },
  getProgress: (day) => read<Answer[] | null>(`progress:${day}`, null),
  saveProgress: (day, answers) => write(`progress:${day}`, answers),
  clearProgress: (day) => remove(`progress:${day}`),
  getHistory: () => read('history', []),
  getEndlessBest: () => read('endlessBest', 0),
  setEndlessBest: (s) => write('endlessBest', s),
  getSetting: (key, fallback) => read(`set:${key}`, fallback),
  setSetting: (key, value) => write(`set:${key}`, value),
};

export const localRaw = { read, write };
