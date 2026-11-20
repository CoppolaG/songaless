'use client';

import { forwardRef, useEffect, useRef, useState } from 'react';
import { Scene, type SceneHandle } from '@/components/Scene';
import { PixelSprite } from '@/components/PixelSprite';
import { PixelPortrait } from '@/components/PixelPortrait';
import { Bubbles, Histogram, IconButton, Kicker, Panel, Swatch, TimerBar, Toast } from '@/components/ui';
import {
  ICON_CRT, ICON_HELP, ICON_HOME, ICON_MUTE, ICON_SOUND, ICON_STATS, VINYL,
} from '@/design/sprites';
import { PALETTE } from '@/design/tokens';
import { community, player } from '@/data';
import { setSoundEnabled, sfx } from '@/game/audio';
import { msToMidnight } from '@/game/daily';
import { LIVES, METERS_PER_POINT, ROUND_TIME, ROUNDS, TIERS, rankTitle, zoneIndex } from '@/game/rules';
import { useGame } from '@/game/useGame';
import { fmt } from '@/game/util';

export default function Page() {
  const sceneRef = useRef<SceneHandle>(null);
  const { g, startDaily, startEndless, submit, confirmMaybe, skip, next, goHome } = useGame(sceneRef);

  const [mounted, setMounted] = useState(false);
  const [sound, setSound] = useState(true);
  const [crt, setCrt] = useState(true);
  const [zone, setZone] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const helpRef = useRef<HTMLDialogElement>(null);
  const statsRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setMounted(true);
    const s = player.getSetting('sound', true);
    setSound(s); setSoundEnabled(s);
    setCrt(player.getSetting('crt', true));
    if (!player.getSetting('seenHelp', false)) {
      player.setSetting('seenHelp', true);
      setTimeout(() => helpRef.current?.showModal(), 300);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && g.view === 'reveal' && !g.digging && (document.activeElement as HTMLElement)?.id !== 'btnNext') void next();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [g, next]);

  function flash(text: string, setter: (v: string | null) => void, ms = 2200) {
    setter(text);
    setTimeout(() => setter(null), ms);
  }

  const toggleSound = () => { const v = !sound; setSound(v); setSoundEnabled(v); player.setSetting('sound', v); sfx.click(); };
  const toggleCrt = () => { const v = !crt; setCrt(v); player.setSetting('crt', v); sfx.click(); };

  const playing = g.view !== 'home';

  return (
    <>
      <Scene ref={sceneRef} view={playing ? 'play' : 'home'} onZone={(name) => { sfx.zone(); flash(`ZONA: ${name}`, setZone); }} />
      {(g.view === 'home' || g.digging) && <Bubbles count={g.view === 'home' ? 7 : 10} />}

      {/* barra in alto */}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-20 flex items-start justify-between gap-2 p-3">
        <div className="pointer-events-auto">
          <IconButton sprite={ICON_HOME} label="Torna in superficie" onClick={goHome} />
        </div>
        {playing && g.view !== 'loading' && (
          <div className="px-panel pointer-events-auto flex gap-1 px-2 py-1.5 sm:gap-3 sm:px-3">
            <HudCell label="ARTISTA" value={g.mode === 'daily' ? `${Math.min(g.idx + 1, ROUNDS)}/${ROUNDS}` : String(g.idx + 1)} />
            <HudCell label="PROFONDITA'" value={`${fmt(g.score * METERS_PER_POINT)} m`} />
            {g.mode === 'endless' && <HudCell label="PUNTINE" value={'♪'.repeat(Math.max(0, g.lives)) + '·'.repeat(Math.max(0, LIVES - g.lives))} />}
          </div>
        )}
        <div className="pointer-events-auto flex gap-2">
          <IconButton sprite={sound ? ICON_SOUND : ICON_MUTE} label="Audio" onClick={toggleSound} active={sound} />
          <IconButton sprite={ICON_CRT} label="Effetto CRT" onClick={toggleCrt} active={crt} />
          <IconButton sprite={ICON_HELP} label="Come si gioca" onClick={() => helpRef.current?.showModal()} />
          <IconButton sprite={ICON_STATS} label="Statistiche" onClick={() => statsRef.current?.showModal()} />
        </div>
      </header>

      {zone && <Toast text={zone} top />}
      {toast && <Toast text={toast} />}

      <main className="pointer-events-none fixed inset-x-0 bottom-0 z-10 flex justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom))]">
        {g.view === 'home' && (
          <Panel>
            <div className="mb-2 flex items-center justify-center gap-4">
              <PixelSprite sprite={VINYL} scale={4} className="anim-float" />
              <h1 className="font-pixel flex gap-3 text-[clamp(28px,8vw,46px)]">
                <span className="text-accent" style={{ textShadow: `4px 4px 0 ${PALETTE.orange}, 8px 8px 0 ${PALETTE.void}` }}>DEEP</span>
                <span className="text-accent2" style={{ textShadow: `4px 4px 0 ${PALETTE.plum}, 8px 8px 0 ${PALETTE.void}` }}>CUT</span>
              </h1>
              <PixelSprite sprite={VINYL} scale={4} className="anim-float" recolor={{ L: 'cyan' }} style={{ animationDelay: '.6s' }} />
            </div>
            <p className="mb-4 text-ink-dim">7 artisti · 30 secondi · più la canzone è nascosta, più scavi a fondo</p>
            <button type="button" className="px-btn block w-full px-3 py-[18px] text-[13px]" onClick={() => { sfx.click(); void startDaily(); }}>
              {mounted ? dailyLabel(g.day) : '▼ INIZIA LO SCAVO ▼'}
            </button>
            <div className="mt-4 flex justify-center">
              <button type="button" className="px-btn ghost px-4 py-3 text-[10px]" onClick={() => { sfx.click(); void startEndless(); }}>
                SCAVO INFINITO
              </button>
            </div>
            <Kicker className="mt-3">{mounted ? `SCAVO #${g.day}` : ''}</Kicker>
          </Panel>
        )}

        {g.view === 'loading' && (
          <Panel>
            <p className="font-pixel anim-blink text-[12px]">{g.loadMsg || 'SCAVO...'}</p>
          </Panel>
        )}

        {g.view === 'prompt' && g.current && <Prompt key={g.idx} g={g} submit={submit} confirmMaybe={confirmMaybe} skip={skip} />}

        {g.view === 'reveal' && g.reveal && (
          <Panel>
            <p className="font-pixel mb-3 text-[clamp(16px,5vw,24px)]" style={{ color: PALETTE[TIERS[g.reveal.tier].color], textShadow: `3px 3px 0 ${PALETTE.void}` }}>
              {TIERS[g.reveal.tier].name}
            </p>
            <div className="flex items-center justify-center gap-3 text-left">
              <PixelPortrait src={g.reveal.track?.cover ?? ''} size={20} scale={3} />
              <div>
                <p className="text-[26px] leading-none">{g.reveal.track?.title ?? (g.reveal.reason === 'skip' ? 'Hai passato' : 'Tempo scaduto!')}</p>
                <Kicker>
                  {!g.reveal.track ? 'NIENTE SCAVO'
                    : g.reveal.pos! > g.reveal.total ? `FUORI DALLE ${g.reveal.total} PIU' ASCOLTATE`
                    : `N. ${g.reveal.pos} TRA LE PIU' ASCOLTATE`}
                </Kicker>
                {g.reveal.share != null && (
                  <Kicker className="text-accent">
                    L&apos;HA SCRITTA IL {String(g.reveal.share).replace('.', ',')}% DEI GIOCATORI{community.kind === 'mock' ? ' (SIMULATO)' : ''}
                  </Kicker>
                )}
              </div>
            </div>
            <p className="font-pixel mt-4 mb-1 text-[12px] text-accent">+{g.reveal.pts} ▼ {fmt(g.score * METERS_PER_POINT)} m</p>
            <Kicker>{g.reveal.hints.join(' · ')}</Kicker>
            <button id="btnNext" type="button" className="px-btn mt-4 px-5 py-3 text-[11px]" disabled={g.digging} onClick={() => void next()}>
              {g.reveal.last ? 'RISULTATO ▶' : 'AVANTI ▶'}
            </button>
          </Panel>
        )}

        {g.view === 'end' && g.result && (
          <Panel wide className="max-h-[calc(100vh-90px)] overflow-y-auto">
            <Kicker>{g.result.mode === 'daily' ? `SCAVO #${g.result.day} COMPLETATO` : `SCAVO INFINITO · ${g.result.answers.length} ARTISTI`}</Kicker>
            <h2 className="font-pixel my-2 text-[clamp(28px,9vw,44px)] text-accent" style={{ textShadow: `4px 4px 0 ${PALETTE.void}` }}>
              {fmt(g.result.score * METERS_PER_POINT)} m
            </h2>
            <p className="font-pixel mb-3 text-[clamp(13px,4vw,20px)]" style={{ color: PALETTE[TIERS[Math.min(6, 1 + zoneIndex(g.result.score * METERS_PER_POINT))].color] }}>
              {rankTitle(g.result.score)}
            </p>
            <ol className="my-2 text-left">
              {g.result.answers.map((a, i) => (
                <li key={i} className="grid grid-cols-[14px_1fr_auto] items-center gap-2.5 border-b-2 border-dashed px-1 py-1" style={{ borderColor: PALETTE.dusk }}>
                  <Swatch color={TIERS[a.tier].color} />
                  <span><b>{a.title ?? (a.reason === 'skip' ? 'passato' : 'tempo scaduto')}</b> <span className="text-ink-dim">· {a.artist}</span></span>
                  <span className="font-pixel text-[10px]" style={{ color: PALETTE[TIERS[a.tier].color] }}>+{a.pts}</span>
                </li>
              ))}
            </ol>
            {g.result.mode === 'daily' && (
              <div className="mt-3 bg-panel2 p-3">
                <Kicker>{g.compare?.simulated ? 'TUTTI GLI SCAVATORI DI OGGI · DATI SIMULATI' : 'TUTTI GLI SCAVATORI DI OGGI'}</Kicker>
                {g.compare ? (
                  <>
                    <Histogram scores={g.compare.scores} mine={g.result.score} />
                    <p>Hai scavato più a fondo del <b className="text-accent">{g.compare.pct}%</b> dei {fmt(g.compare.players)} giocatori di oggi.</p>
                  </>
                ) : <p className="anim-blink">carico...</p>}
              </div>
            )}
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {g.result.mode === 'daily' && (
                <button type="button" className="px-btn px-4 py-3 text-[10px]" onClick={async () => {
                  const r = g.result!;
                  const text = `DEEP CUT #${r.day} ⛏️ ${fmt(r.score * METERS_PER_POINT)} m\n${r.answers.map((a) => TIERS[a.tier].emoji).join('')}\n${rankTitle(r.score)}\n${location.href.split(/[?#]/)[0]}`;
                  try {
                    if (navigator.share && matchMedia('(pointer: coarse)').matches) await navigator.share({ text });
                    else { await navigator.clipboard.writeText(text); flash('RISULTATO COPIATO', setToast); }
                  } catch { flash('NON RIESCO A COPIARE', setToast); }
                }}>CONDIVIDI</button>
              )}
              <button type="button" className="px-btn ghost px-4 py-3 text-[10px]" onClick={() => void startEndless()}>SCAVO INFINITO</button>
            </div>
            {g.result.mode === 'daily' && <Countdown />}
            {g.result.mode === 'endless' && <Kicker className="mt-3">RECORD SCAVO INFINITO: {fmt(player.getEndlessBest() * METERS_PER_POINT)} M</Kicker>}
          </Panel>
        )}
      </main>

      <HelpDialog ref={helpRef} />
      <StatsDialog ref={statsRef} day={g.day} mounted={mounted} />
      {crt && <div className="crt" aria-hidden />}
    </>
  );
}

function dailyLabel(day: number) {
  if (player.getDaily(day)) return '▼ RIVEDI LO SCAVO DI OGGI ▼';
  if (player.getProgress(day)?.length) return '▼ RIPRENDI LO SCAVO ▼';
  return '▼ INIZIA LO SCAVO ▼';
}

function HudCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center px-1 sm:px-1.5">
      <span className="font-pixel mb-1 text-[6px] text-ink-dim sm:text-[7px]">{label}</span>
      <span className="font-pixel text-[9px] text-accent sm:text-[11px]">{value}</span>
    </div>
  );
}

type GameState = ReturnType<typeof useGame>['g'];

function Prompt({ g, submit, confirmMaybe, skip }: {
  g: GameState;
  submit: (t: string) => void;
  confirmMaybe: (yes: boolean) => void;
  skip: () => void;
}) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { if (g.feedback && !g.feedback.ok) inputRef.current?.select(); }, [g.feedback, g.shake]);
  const { artist, data } = g.current!;
  return (
    <Panel>
      <div className="mb-1 flex items-center gap-4 text-left">
        <PixelPortrait src={data.picture} size={20} scale={3} />
        <div>
          <Kicker>SCRIVI UNA CANZONE DI</Kicker>
          <h2 className="font-pixel mt-1 text-[clamp(13px,4vw,18px)] leading-snug text-accent">{artist.name}</h2>
        </div>
      </div>
      <TimerBar left={g.timeLeft} total={ROUND_TIME} />
      <form className="flex gap-3" autoComplete="off" onSubmit={(e) => { e.preventDefault(); submit(text); }}>
        <div key={g.shake} className={`px-inset min-w-0 flex-1 ${g.shake ? 'anim-shake' : ''}`}>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={80}
            placeholder="titolo della canzone..."
            spellCheck={false}
            autoCapitalize="off"
            aria-label="Titolo della canzone"
            className="w-full bg-transparent px-2.5 py-1.5 text-[26px] text-ink outline-none placeholder:text-ink-dim"
          />
        </div>
        <button type="submit" className="px-btn px-4 text-[11px]" disabled={g.checking}>SCAVA</button>
      </form>
      {g.pending && (
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <span>Intendevi <b className="text-accent">{g.pending.title}</b>?</span>
          <button type="button" className="px-btn px-3 py-2 text-[9px]" onClick={() => confirmMaybe(true)}>SI&apos;</button>
          <button type="button" className="px-btn ghost px-3 py-2 text-[9px]" onClick={() => confirmMaybe(false)}>NO</button>
        </div>
      )}
      <p className={`mt-2 mb-1 min-h-6 ${g.feedback?.ok ? 'text-ok' : 'text-bad'}`} aria-live="polite">{g.feedback?.text ?? ''}</p>
      <button type="button" className="px-btn ghost px-3 py-2 text-[9px]" onClick={skip}>PASSO</button>
    </Panel>
  );
}

function Countdown() {
  const [ms, setMs] = useState(msToMidnight());
  useEffect(() => { const id = setInterval(() => setMs(msToMidnight()), 1000); return () => clearInterval(id); }, []);
  const s = Math.floor(ms / 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return <Kicker className="mt-3">PROSSIMO SCAVO TRA {p(Math.floor(s / 3600))}:{p(Math.floor(s / 60) % 60)}:{p(s % 60)}</Kicker>;
}

const Dialog = ({ dref, title, children }: { dref: React.Ref<HTMLDialogElement>; title: string; children: React.ReactNode }) => (
  <dialog ref={dref} className="px-panel m-auto max-h-[calc(100vh-40px)] w-[min(520px,calc(100vw-32px))] overflow-y-auto border-0 p-5 text-left text-ink">
    <h2 className="font-pixel mb-3 text-[16px] leading-snug">{title}</h2>
    {children}
    <form method="dialog">
      <button className="px-btn mt-3 px-4 py-3 text-[10px]">CHIUDI</button>
    </form>
  </dialog>
);


const HelpDialog = forwardRef<HTMLDialogElement>(function HelpDialog(_, ref) {
  return (
    <Dialog dref={ref} title="COME SI GIOCA">
      <ul className="mb-3 list-disc pl-5">
        <li className="mb-1">Ogni giorno escono <b className="text-accent">7 artisti</b>, uguali per tutti.</li>
        <li className="mb-1">Hai <b className="text-accent">30 secondi</b> per scrivere il titolo di una loro canzone.</li>
        <li className="mb-1">Più è <b className="text-accent">sconosciuta</b>, più punti fai e più in fondo scava l&apos;omino. Ogni punto vale 10 metri.</li>
        <li className="mb-1">La rarità viene dalla popolarità su Deezer: il tormentone vale poco, la perla dimenticata vale tanto.</li>
      </ul>
      <table className="mb-3 w-full border-collapse">
        <tbody>
          {TIERS.slice(1).map((t) => (
            <tr key={t.name} className="border-b-2 border-dashed" style={{ borderColor: PALETTE.dusk }}>
              <td className="font-pixel py-1 pr-2 text-[9px]" style={{ color: PALETTE[t.color] }}>{t.name}</td>
              <td className="py-1">{t.desc}</td>
              <td className="font-pixel py-1 text-right text-[9px] text-accent">+{t.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Kicker>NELLO SCAVO INFINITO HAI 3 PUNTINE: SE IL TEMPO SCADE O PASSI, NE PERDI UNA.</Kicker>
    </Dialog>
  );
});

const StatsDialog = forwardRef<HTMLDialogElement, { day: number; mounted: boolean }>(function StatsDialog({ day, mounted }, ref) {
  const [, setN] = useState(0);
  // si aggiorna ogni volta che si apre
  useEffect(() => {
    const el = (ref as React.RefObject<HTMLDialogElement>)?.current;
    if (!el) return;
    const obs = new MutationObserver(() => setN((n) => n + 1));
    obs.observe(el, { attributes: true, attributeFilter: ['open'] });
    return () => obs.disconnect();
  }, [ref]);
  if (!mounted) return <Dialog dref={ref} title="I TUOI SCAVI">{null}</Dialog>;
  const hist = player.getHistory();
  const scores = hist.map((h) => h.score);
  const days = new Set(hist.map((h) => h.day));
  let streak = 0;
  for (let d = day; days.has(d); d--) streak++;
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
  const cells: [string, string][] = [
    [String(hist.length), 'SCAVI'], [String(streak), 'DI FILA'],
    [fmt(Math.max(0, ...scores) * METERS_PER_POINT), 'RECORD M'], [fmt(avg * METERS_PER_POINT), 'MEDIA M'],
  ];
  return (
    <Dialog dref={ref} title="I TUOI SCAVI">
      <div className="grid grid-cols-4 gap-2 text-center">
        {cells.map(([v, l]) => (
          <div key={l}><b className="font-pixel mb-1 block text-[16px] text-accent">{v}</b><Kicker>{l}</Kicker></div>
        ))}
      </div>
      <Histogram scores={scores} mine={player.getDaily(day)?.score ?? null} />
      <Kicker>RECORD SCAVO INFINITO: {fmt(player.getEndlessBest() * METERS_PER_POINT)} M</Kicker>
    </Dialog>
  );
});
