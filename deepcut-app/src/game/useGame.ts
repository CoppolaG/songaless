'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { SceneHandle, SceneSign } from '@/components/Scene';
import { community, player } from '@/data';
import type { Artist } from './artists';
import { playPreview, sfx, stopPreview, unlockAudio } from './audio';
import { dailyArtists, endlessArtists, todayNumber } from './daily';
import { loadArtist, type ArtistData, type Track } from './deezer';
import { checkAnswer, positionOf } from './match';
import {
  LIVES, ROUND_TIME, ROUNDS, TIERS, tierIndexFor,
  type Answer, type GameMode, type GameResult,
} from './rules';

export type View = 'home' | 'loading' | 'prompt' | 'reveal' | 'end';

export type Reveal = {
  tier: number;
  pts: number;
  track: Track | null;
  pos: number | null;
  total: number;
  reason: Answer['reason'];
  share: number | null;
  hints: string[];
  last: boolean;
};

export type Compare = { scores: number[]; pct: number; players: number; simulated: boolean } | null;

const signFor = (a: Answer, depth: number): SceneSign | null =>
  a.pts > 0 ? { depth, label: `${TIERS[a.tier].name} +${a.pts}`, color: TIERS[a.tier].color } : null;

function signsFor(answers: Answer[]) {
  let d = 0;
  const out: SceneSign[] = [];
  for (const a of answers) { d += a.pts; const s = signFor(a, d); if (s) out.push(s); }
  return out;
}

export function useGame(scene: RefObject<SceneHandle | null>) {
  const [, setTick] = useState(0);
  const rerender = useCallback(() => setTick((n) => n + 1), []);

  const g = useRef({
    view: 'home' as View,
    mode: 'daily' as GameMode,
    day: todayNumber(),
    artists: [] as Artist[],
    idx: 0,
    answers: [] as Answer[],
    score: 0,
    lives: LIVES,
    current: null as null | { artist: Artist; data: ArtistData },
    timeLeft: ROUND_TIME,
    timerOn: false,
    checking: false,
    pending: null as Track | null,
    feedback: null as null | { text: string; ok: boolean },
    shake: 0,
    reveal: null as Reveal | null,
    digging: false,
    result: null as GameResult | null,
    compare: null as Compare,
    loadMsg: '',
  }).current;

  const set = useCallback((patch: Partial<typeof g>) => { Object.assign(g, patch); rerender(); }, [g, rerender]);

  /* ---------------- timer ---------------- */
  useEffect(() => {
    const id = setInterval(() => {
      if (!g.timerOn || g.checking) return;
      const before = Math.ceil(g.timeLeft);
      g.timeLeft = Math.max(0, g.timeLeft - 0.1);
      const now = Math.ceil(g.timeLeft);
      if (now < before && now <= 5 && now > 0) sfx.tick();
      if (g.timeLeft <= 0) void endRound(null, 'time');
      rerender();
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- partite ---------------- */
  async function loadCurrent(): Promise<boolean> {
    const artist = g.artists[g.idx % g.artists.length];
    try {
      const data = await loadArtist(artist.id);
      g.current = { artist, data };
      return true;
    } catch {
      set({ view: 'loading', loadMsg: 'Deezer non risponde. Riprova tra poco.' });
      setTimeout(() => set({ view: 'home' }), 2500);
      return false;
    }
  }

  function startRound() {
    set({
      view: 'prompt', timeLeft: ROUND_TIME, timerOn: true, checking: false,
      pending: null, feedback: null, reveal: null,
    });
    // prepara già il prossimo artista
    const nextArtist = g.artists[(g.idx + 1) % g.artists.length];
    if (nextArtist) loadArtist(nextArtist.id).catch(() => {});
  }

  const startDaily = useCallback(async () => {
    unlockAudio();
    const done = player.getDaily(g.day);
    if (done) { await showEnd(done, true); return; }
    const answers = player.getProgress(g.day) ?? [];
    Object.assign(g, {
      mode: 'daily', artists: dailyArtists(g.day), answers, idx: answers.length,
      score: answers.reduce((s, a) => s + a.pts, 0), lives: LIVES, result: null, compare: null,
    });
    scene.current?.reset(g.score, signsFor(answers));
    if (g.idx >= ROUNDS) { await finish(); return; }
    set({ view: 'loading', loadMsg: 'ACCORDO LA PALA...' });
    if (await loadCurrent()) startRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startEndless = useCallback(async () => {
    unlockAudio();
    Object.assign(g, {
      mode: 'endless', artists: endlessArtists(), answers: [], idx: 0, score: 0, lives: LIVES,
      result: null, compare: null,
    });
    scene.current?.reset(0, []);
    set({ view: 'loading', loadMsg: 'ACCORDO LA PALA...' });
    if (await loadCurrent()) startRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = useCallback(async (text: string) => {
    if (g.checking || !g.timerOn || !g.current) return;
    if (text.trim().length < 2) return;
    set({ checking: true, pending: null, feedback: { text: 'scavo...', ok: true } });
    const { artist, data } = g.current;
    let res;
    try { res = await checkAnswer(artist.id, artist.name, data.top, text); } catch { res = { status: 'none' as const }; }
    g.checking = false;
    if (!g.timerOn) return;
    if (res.status === 'found') { void endRound(res.track, 'ok'); return; }
    if (res.status === 'maybe') { set({ pending: res.track, feedback: null }); return; }
    sfx.error();
    set({ feedback: { text: 'Nessun disco qui sotto... riprova', ok: false }, shake: g.shake + 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirmMaybe = useCallback((yes: boolean) => {
    if (!g.pending) return;
    if (yes) { void endRound(g.pending, 'ok'); return; }
    set({ pending: null, feedback: { text: 'Riprova con un altro titolo', ok: false } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const skip = useCallback(() => { void endRound(null, 'skip'); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function endRound(track: Track | null, reason: Answer['reason']) {
    if (!g.timerOn || !g.current) return;
    g.timerOn = false;
    const { artist, data } = g.current;
    const top = data.top;
    let tier = 0;
    let pos: number | null = null;
    if (track) { pos = positionOf(track, top); tier = tierIndexFor(pos); }
    const pts = TIERS[tier].pts;
    const answer: Answer = {
      artist: artist.name, artistId: artist.id, tier, pts, pos,
      title: track?.title ?? null, trackKey: track?.key ?? null, reason,
    };
    g.answers = [...g.answers, answer];
    g.score += pts;
    if (g.mode === 'endless' && pts === 0) g.lives -= 1;
    if (g.mode === 'daily') player.saveProgress(g.day, g.answers);

    const hints: string[] = [];
    const hit = top[0];
    const gem = top[top.length - 1];
    if (hit && hit.key !== track?.key) hints.push(`Il tormentone: ${hit.title}`);
    if (gem && gem.key !== track?.key && top.length > 20) hints.push(`Una perla: ${gem.title}`);

    const last = g.mode === 'daily' ? g.idx + 1 >= ROUNDS : g.lives <= 0;
    set({
      view: 'reveal', digging: true, pending: null,
      reveal: { tier, pts, track, pos, total: top.length, reason, share: null, hints, last },
    });

    if (track) {
      playPreview(track.preview);
      sfx.land(tier);
      community.recordAnswer(g.day, artist.id, track.key).catch(() => {});
      community.getAnswerShare(g.day, artist.id, track.key, { pos })
        .then(({ share }) => { if (g.reveal && g.reveal.track === track) set({ reveal: { ...g.reveal, share } }); })
        .catch(() => {});
    } else sfx.miss();

    const sign = signFor(answer, g.score);
    if (sign) scene.current?.addSign(sign);
    await scene.current?.digTo(pts);
    set({ digging: false });
  }

  const next = useCallback(async () => {
    if (g.digging || g.view !== 'reveal') return;
    stopPreview();
    g.idx += 1;
    const over = g.mode === 'daily' ? g.idx >= ROUNDS : g.lives <= 0;
    if (over) { await finish(); return; }
    set({ view: 'loading', loadMsg: '' });
    if (await loadCurrent()) startRound();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------------- fine ---------------- */
  async function finish() {
    const result: GameResult = { mode: g.mode, day: g.day, score: g.score, answers: g.answers };
    if (g.mode === 'daily') {
      player.saveDaily(result);
      player.clearProgress(g.day);
      community.submitScore(g.day, g.score, g.answers.map((a) => a.tier).join('')).catch(() => {});
    } else if (g.score > player.getEndlessBest()) {
      player.setEndlessBest(g.score);
    }
    await showEnd(result, false);
  }

  async function showEnd(result: GameResult, replay: boolean) {
    if (replay) {
      Object.assign(g, { mode: result.mode, answers: result.answers, score: result.score });
      scene.current?.reset(result.score, signsFor(result.answers));
    }
    set({ view: 'end', result, compare: null });
    if (result.mode !== 'daily') return;
    try {
      const scores = await community.getDayScores(result.day);
      if (scores.length) {
        const below = scores.filter((s) => s < result.score).length;
        set({ compare: { scores, players: scores.length, pct: Math.round((below / scores.length) * 100), simulated: community.kind === 'mock' } });
      }
    } catch { /* senza confronto */ }
  }

  const goHome = useCallback(() => {
    stopPreview();
    g.timerOn = false;
    scene.current?.reset(0, []);
    set({ view: 'home', reveal: null, pending: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { g, startDaily, startEndless, submit, confirmMaybe, skip, next, goHome };
}
