/**
 * Tutti gli sprite di Deep Cut, disegnati come matrici di pixel.
 * Ogni riga è una stringa: un carattere = un pixel, '.' = trasparente.
 * I caratteri vengono tradotti in colori della palette (tokens.ts) tramite `colors`.
 * Si disegnano a risoluzione nativa e si scalano solo di multipli interi.
 */
import { PALETTE, type PaletteKey } from './tokens';

export type Sprite = {
  w: number;
  h: number;
  rows: string[];
  colors: Record<string, PaletteKey>;
};

function sprite(rows: string[], colors: Record<string, PaletteKey>): Sprite {
  return { w: rows[0].length, h: rows.length, rows, colors };
}

/* ---------------- omino scavatore 16x16 ---------------- */
const DIGGER_COLORS: Record<string, PaletteKey> = {
  o: 'void', y: 'yellow', Y: 'amber', l: 'white', s: 'skin', S: 'skinShade',
  h: 'hotPink', e: 'void', b: 'blue', B: 'navy', k: 'darkBrown', n: 'tan', g: 'silver',
};

export const DIGGER_BODY = sprite([
  '....oooooo......',
  '...oyyyyyyo.....',
  '..oyyyyyyyyol...',
  '..oYYYYYYYYo....',
  '..ohssssssho....',
  '..ohsesseSho....',
  '...oSssssSo.....',
  '....oooooo......',
  '...obbbbbbo.....',
  '..osbBbbBbso....',
  '..osbbbbbbso....',
  '...obbBBbbo.....',
  '...obbo.obbo....',
  '...obbo.obbo....',
  '..okkko.okkko...',
  '..ooooo.ooooo...',
], DIGGER_COLORS);

export const SHOVEL_DOWN = sprite([
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '.............n..',
  '.............n..',
  '.............n..',
  '.............n..',
  '.............n..',
  '.............n..',
  '............oggo',
  '............oggo',
  '.............oo.',
  '................',
], DIGGER_COLORS);

export const SHOVEL_UP = sprite([
  '............oggo',
  '............oggo',
  '.............oo.',
  '.............n..',
  '.............n..',
  '.............n..',
  '.............n..',
  '.............n..',
  '.............n..',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
], DIGGER_COLORS);

/* ---------------- oggetti sepolti ---------------- */
export const VINYL = sprite([
  '..vvvv..',
  '.vvgvvv.',
  'vvvLLvvv',
  'vgLwwLvv',
  'vvLwwLgv',
  'vvvLLvvv',
  '.vvvgvv.',
  '..vvvv..',
], { v: 'void', g: 'dusk', L: 'salmon', w: 'cream' });

export const GOLD_VINYL = sprite(VINYL.rows, { v: 'amber', g: 'yellow', L: 'orange', w: 'white' });

export const CASSETTE = sprite([
  'vvvvvvvvvv',
  'vccccccccv',
  'vcLLLLLLcv',
  'vcLwvvwLcv',
  'vcLLLLLLcv',
  'vccvvvvccv',
  'vvvvvvvvvv',
], { v: 'void', c: 'dusk', L: 'yellow', w: 'cream' });

export const CD = sprite([
  '..ssss..',
  '.ssrsss.',
  'ssrsssms',
  'sssvvsss',
  'sssvvsss',
  'smsssrss',
  '.ssssrs.',
  '..ssss..',
], { s: 'silver', r: 'cyan', m: 'magenta', v: 'void' });

export const BONE = sprite([
  'ww....ww',
  '.wwwwww.',
  '.wwwwww.',
  'ww....ww',
], { w: 'cream' });

export const GEM = sprite([
  '...c...',
  '..cCc..',
  '.cCccc.',
  'cCccccd',
  '.cccdd.',
  '..cdd..',
  '...d...',
], { c: 'cyan', C: 'white', d: 'blue' });

export const GOLD_GEM = sprite(GEM.rows, { c: 'yellow', C: 'white', d: 'amber' });

export const ROCK = sprite([
  '.rrRr..',
  'rrrrRr.',
  'rrrrrrr',
  '.rrrrr.',
], { r: 'slate', R: 'steel' });

export const ROOT = sprite([
  'r.....',
  '.r....',
  '.rr...',
  '...r..',
  '...rr.',
  '.....r',
], { r: 'darkBrown' });

export const NOTE = sprite([
  '..ww.',
  '..w.w',
  '..w..',
  '..w..',
  'www..',
  'www..',
  '.w...',
], { w: 'yellow' });

/* ---------------- superficie ---------------- */
export const CLOUD = sprite([
  '......wwww..........',
  '...wwwwwwwwww.......',
  '.wwwwwwwwwwwwwww....',
  'wwwwwwwwwwwwwwwwwww.',
  'sswwwwwwwwwwwwwwwsss',
  '.ssssssssssssssssss.',
], { w: 'white', s: 'silver' });

export const SUN = sprite([
  '...yyyy...',
  '..yyyyyy..',
  '.yyWWyyyy.',
  'yyWWyyyyyy',
  'yyWyyyyyyy',
  'yyyyyyyyyy',
  'yyyyyyyyya',
  '.yyyyyyya.',
  '..yyyyaa..',
  '...yyyy...',
], { y: 'yellow', W: 'white', a: 'amber' });

/** Negozio di dischi 36x29. L'insegna (S) riceve il testo col font pixel. */
export const SHOP = sprite([
  'kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk',
  'kKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKk',
  'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
  'rrSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSrr',
  'rrSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSrr',
  'rrSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSrr',
  'rrSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSrr',
  'rrSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSrr',
  'rrSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSrr',
  'rrSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSrr',
  'rrSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSSrr',
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
  'pppwwwpppwwwpppwwwpppwwwpppwwwpppwww',
  'pppwwwpppwwwpppwwwpppwwwpppwwwpppwww',
  'pp.ww.pp.ww.pp.ww.pp.ww.pp.ww.pp.ww.',
  'rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr',
  'rkkkkkkkkkkkkkkkkkkkkkrrkkkkkkkkkkrr',
  'rkCCCcccccccccccccccckrrkddddddddkrr',
  'rkccccccccccccccccccckrrkdDDDDDDdkrr',
  'rkccvvvcccvvvcccvvvcckrrkdDddddDdkrr',
  'rkcvvvvvcvvvvvcvvvvvckrrkdDddddDdkrr',
  'rkcvvgvvcvvgvvcvvgvvckrrkddddddddkrr',
  'rkcvvvvvcvvvvvcvvvvvckrrkddddddgdkrr',
  'rkccvvvcccvvvcccvvvcckrrkdDddddDdkrr',
  'rkccccccccccccccccccckrrkdDddddDdkrr',
  'rkccccccccccccccccccckrrkdDDDDDDdkrr',
  'rkccccccccccccccccccckrrkddddddddkrr',
  'rkkkkkkkkkkkkkkkkkkkkkrrkddddddddkrr',
  'RRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRRR',
], {
  k: 'darkBrown', K: 'brown', r: 'rust', R: 'brown', S: 'void',
  p: 'salmon', w: 'cream', c: 'blue', C: 'cyan', v: 'void', g: 'yellow',
  d: 'tan', D: 'brown',
});

export const LAMP = sprite([
  'kkkkkkk',
  'kyyyyyk',
  '.kkkkk.',
  ...Array<string>(25).fill('...k...'),
], { k: 'night', y: 'yellow' });

/** Cartello "SCAVO" 24x13: il testo si scrive sopra col font pixel. */
export const SIGNPOST = sprite([
  'oooooooooooooooooooooooo',
  'oppppppppppppppppppppppo',
  'oppppppppppppppppppppppo',
  'oppppppppppppppppppppppo',
  'oppppppppppppppppppppppo',
  'oppppppppppppppppppppppo',
  'oppppppppppppppppppppPPo',
  'oPPPPPPPPPPPPPPPPPPPPPPo',
  'oooooooooooooooooooooooo',
  '..........onno..........',
  '..........onno..........',
  '..........onno..........',
  '..........onno..........',
], { o: 'darkBrown', p: 'sand', P: 'tan', n: 'brown' });

/* ---------------- interfaccia ---------------- */
const ICON = { w: 'cream' } as const;

export const ICON_SOUND = sprite([
  '....w....',
  '...ww..w.',
  'wwwww...w',
  'wwwww.w.w',
  'wwwww.w.w',
  'wwwww...w',
  '...ww..w.',
  '....w....',
], ICON);

export const ICON_MUTE = sprite([
  '....w....',
  '...ww....',
  'wwwww.w.w',
  'wwwww..w.',
  'wwwww..w.',
  'wwwww.w.w',
  '...ww....',
  '....w....',
], ICON);

export const ICON_HELP = sprite([
  '..wwwww..',
  '.ww...ww.',
  '.....ww..',
  '....ww...',
  '....ww...',
  '.........',
  '....ww...',
  '....ww...',
], ICON);

export const ICON_STATS = sprite([
  '......ww.',
  '......ww.',
  '...ww.ww.',
  '...ww.ww.',
  'ww.ww.ww.',
  'ww.ww.ww.',
  'ww.ww.ww.',
  'wwwwwwwww',
], ICON);

export const ICON_HOME = sprite([
  '....w....',
  '...www...',
  '..wwwww..',
  '.wwwwwww.',
  'wwwwwwwww',
  '.ww...ww.',
  '.ww.w.ww.',
  '.ww.w.ww.',
], ICON);

export const ICON_CRT = sprite([
  'wwwwwwwww',
  'w.......w',
  'wwwwwwwww',
  'w.......w',
  'wwwwwwwww',
  'w.......w',
  'wwwwwwwww',
  '...www...',
], ICON);

export const BUBBLE = sprite([
  '.www.',
  'w..cw',
  'w...w',
  'w...w',
  '.www.',
], { w: 'cream', c: 'white' });

export const NEEDLE = sprite([
  '.....ww',
  '....wwy',
  '...ww..',
  '..ww...',
  '.ww....',
  'ww.....',
  'w......',
], { w: 'cream', y: 'yellow' });

/* ---------------- font pixel 3x5 ---------------- */
export const GLYPHS: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', 0: '111101101101111', 1: '010110010010111',
  2: '110001010100111', 3: '110001010001110', 4: '101101111001001', 5: '111100110001110',
  6: '011100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001110',
  '+': '000010111010000', '-': '000000111000000', '.': '000000000000010', "'": '010010000000000',
  '!': '010010010000010', '?': '110001010000010', ' ': '000000000000000', '#': '101111101111101',
};

/* ---------------- disegno ---------------- */
type Recolor = Partial<Record<string, PaletteKey>>;

/** Disegna uno sprite su un contesto 2D in coordinate native (1 carattere = 1 pixel). */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  s: Sprite,
  x: number,
  y: number,
  recolor: Recolor = {},
  flip = false,
) {
  for (let r = 0; r < s.h; r++) {
    const row = s.rows[r];
    for (let c = 0; c < s.w; c++) {
      const ch = row[c];
      if (ch === '.') continue;
      const key = recolor[ch] ?? s.colors[ch];
      if (!key) continue;
      ctx.fillStyle = PALETTE[key];
      ctx.fillRect(x + (flip ? s.w - 1 - c : c), y + r, 1, 1);
    }
  }
}

/** Testo col font pixel 3x5; restituisce la larghezza in pixel nativi. */
export function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, key: PaletteKey, scale = 1) {
  const s = text.toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  ctx.fillStyle = PALETTE[key];
  let cx = x;
  for (const ch of s) {
    const g = GLYPHS[ch] ?? GLYPHS[' '];
    for (let i = 0; i < 15; i++) {
      if (g[i] === '1') ctx.fillRect(cx + (i % 3) * scale, y + Math.floor(i / 3) * scale, scale, scale);
    }
    cx += 4 * scale;
  }
  return cx - x - scale;
}

export const textWidth = (text: string, scale = 1) => text.length * 4 * scale - scale;
