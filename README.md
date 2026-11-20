# Indovina la Canzone

Quiz musicale: ascolti un frammento di 0,1 secondi e provi a indovinare la canzone; se sbagli, il frammento si allunga.

- **Stesso schermo**: si gioca a turno dallo stesso dispositivo.
- **Online**: chi ospita crea una stanza e condivide il link; ognuno gioca dal proprio dispositivo (connessione diretta tra browser con [PeerJS](https://peerjs.com/)).
- Le anteprime audio arrivano da Deezer; gli anni originali sono incrociati con MusicBrainz.

## File

| File | Cosa contiene |
|---|---|
| `index.html`, `style.css` | pagina e grafica |
| `app.js` | mazzi, import (Deezer/Spotify/artisti/lista), catalogazione, filtri |
| `game.js` | partita locale, stanze online, canzoni segnate |
| `fx.js` | animazioni (GSAP, Lenis, coriandoli, visualizzatore, sfondo che reagisce alla musica) |
| `chars.js` | aspetto dei personaggi e foto delle facce |
| `ragdoll.js` | personaggi con fisica (matter.js): scheletro a 11 pezzi, ferite con ossa e spina dorsale, 14 morti, effetti sonori |
| `catalogo.txt` | elenco dei mazzi di base (Artista | Titolo | Anno | Genere | Opera) |\| Titolo \| Anno \| Genere) |
| `build-starter.mjs` | rigenera `starter.js` da `catalogo.txt`: `node build-starter.mjs` |
| `deepcut-app/` | sorgente di **Deep Cut** (Next.js): il gioco in cui scrivi la canzone più nascosta di un artista; vedi il suo README |
| `deepcut/` | Deep Cut compilato, servito su /songaless/deepcut/ (si rigenera con `npm run publish` in `deepcut-app/`) |
| `bump-version.mjs` | aggiorna il numero di versione dei file in `index.html` prima di pubblicare |

## Avvio in locale

Doppio clic su `avvia.bat` (serve Python), poi apri http://127.0.0.1:8000
