# Deep Cut

Ogni giorno 7 artisti, uguali per tutti (4 italiani e 3 stranieri). Per ognuno hai 30 secondi per scrivere il titolo di una sua canzone. Più è sconosciuta, più punti fai e più in fondo scava l'omino. Ogni punto vale 10 metri.

| Livello | Posizione tra le più ascoltate su Deezer | Punti |
|---|---|---|
| Tormentone | 1–3 | 10 |
| Hit | 4–10 | 25 |
| Classico | 11–25 | 40 |
| Lato B | 26–50 | 60 |
| Deep Cut | 51–80 | 80 |
| Reperto | oltre 80, o fuori dalle 100 più ascoltate | 100 |

**Scavo infinito:** gli artisti vengono pescati a caso e hai 3 puntine. Ne perdi una ogni volta che passi o che il tempo scade.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS 4, esportato come sito statico (`out/`)
- Font da `next/font/google`: Press Start 2P per i titoli, VT323 per il testo
- Dati Deezer via JSONP (l'API non ha CORS)

## Stile grafico

- **Palette:** [ENDESGA 32](https://lospec.com/palette-list/endesga-32) (Lospec). Tutti i colori stanno in `src/design/tokens.ts`. Il layout li trasforma in variabili CSS (`--pal-*`, `--ui-*`), che diventano classi Tailwind (`bg-panel`, `text-ink`, `text-accent`…).
- **Sprite:** matrici di caratteri in `src/design/sprites.ts` (omino 16x16, pala, vinili, cassette, CD, negozio 36x29, icone 9x8, font pixel 3x5). Si disegnano su `<canvas>` a risoluzione nativa e si ingrandiscono solo di multipli interi. `npm run check-sprites` controlla che le righe siano tutte della stessa larghezza.
- **Scena:** un canvas a bassa risoluzione ingrandito x2, x3, x4… in base allo schermo. Anche il buio in profondità è a gradini, disegnato riga per riga.
- **Foto e copertine:** ridotte a 20x20 pixel e ricolorate con la palette (`PixelPortrait`).
- **Interfaccia:** `image-rendering: pixelated` ovunque, nessun bordo arrotondato. Bordi a gradini sui pannelli e sui pulsanti (`.px-panel`, `.px-btn`, `.px-inset` in `globals.css`). Animazioni a scatti con `steps()`: vinili che galleggiano, bolle e note che salgono, comparsa dei pannelli, lampeggio.
- **Scanline CRT:** sovrapposte allo schermo, si spengono col pulsante a forma di schermo (la scelta viene ricordata).

## Struttura

```
src/
  app/            layout (font, variabili colore), pagina, globals.css
  design/         tokens.ts (palette), sprites.ts (matrici di pixel + disegno)
  components/     Scene (canvas), PixelSprite, PixelPortrait, ui (pannelli, timer, istogramma, bolle)
  game/           regole, artisti, Deezer, controllo risposte, giorno, audio, useGame (logica della partita)
  data/           persistenza
    types.ts            interfacce PlayerStore e CommunityService
    localStore.ts       dati del giocatore in localStorage
    mockCommunity.ts    giocatori, punteggi e frequenze delle risposte SIMULATI
    supabaseCommunity.ts  stessa interfaccia su Supabase (REST, nessuna libreria)
    index.ts            sceglie Supabase se configurato, altrimenti la simulazione
```

Finché Supabase non è collegato, l'interfaccia scrive "DATI SIMULATI" vicino al confronto con gli altri giocatori e "(SIMULATO)" vicino alla percentuale di chi ha dato la stessa risposta.

## Comandi

```
npm install
npm run dev        # http://localhost:3100
npm run build      # sito statico in out/
```

## Pubblicare

Il sito è online su https://coppolag.github.io/songaless/deepcut/. Per aggiornarlo:

```
npm run publish    # compila con il percorso /songaless/deepcut e copia il risultato in ../deepcut
```

Poi fai commit e push del repository. La cartella `deepcut/` contiene solo il sito compilato: non va modificata a mano. Il file `.nojekyll` nella radice serve perché GitHub Pages non scarti la cartella `_next`.

## Collegare Supabase

1. Crea un progetto gratuito su supabase.com e, nel SQL Editor, esegui:

```sql
create table scores (
  id bigint generated always as identity primary key,
  day int not null,
  score int not null check (score between 0 and 700),
  tiers text,
  created_at timestamptz default now()
);
create table answers (
  id bigint generated always as identity primary key,
  day int not null,
  artist_id bigint not null,
  track_key text not null,
  created_at timestamptz default now()
);
alter table scores enable row level security;
alter table answers enable row level security;
create policy "inserisci" on scores for insert to anon with check (true);
create policy "leggi" on scores for select to anon using (true);
create policy "inserisci" on answers for insert to anon with check (true);
create policy "leggi" on answers for select to anon using (true);
create index on scores (day);
create index on answers (day, artist_id, track_key);
```

2. Crea `.env.local` con:

```
NEXT_PUBLIC_SUPABASE_URL=https://<progetto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<chiave anon public>
```

3. Rifai il build: il gioco passa da solo dai dati simulati a quelli veri.
