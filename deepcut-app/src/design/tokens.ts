/**
 * Design tokens di Deep Cut.
 *
 * Palette: ENDESGA 32 di Endesga — https://lospec.com/palette-list/endesga-32
 * Ogni colore del gioco (CSS, canvas, sprite) viene da qui: non usare altri hex.
 * I nomi sono nostri, l'ordine è quello della palette originale.
 */
export const PALETTE = {
  rust: '#be4a2f',
  clay: '#d77643',
  cream: '#ead4aa',
  sand: '#e4a672',
  tan: '#b86f50',
  brown: '#733e39',
  darkBrown: '#3e2731',
  crimson: '#a22633',
  red: '#e43b44',
  orange: '#f77622',
  amber: '#feae34',
  yellow: '#fee761',
  green: '#63c74d',
  forest: '#3e8948',
  pine: '#265c42',
  deepTeal: '#193c3e',
  navy: '#124e89',
  blue: '#0099db',
  cyan: '#2ce8f5',
  white: '#ffffff',
  silver: '#c0cbdc',
  steel: '#8b9bb4',
  slate: '#5a6988',
  dusk: '#3a4466',
  night: '#262b44',
  void: '#181425',
  hotPink: '#ff0044',
  plum: '#68386c',
  magenta: '#b55088',
  salmon: '#f6757a',
  skin: '#e8b796',
  skinShade: '#c28569',
} as const;

export type PaletteKey = keyof typeof PALETTE;

/** Ruoli dell'interfaccia (diventano variabili CSS --ui-* e classi Tailwind). */
export const UI = {
  bg: 'void',
  panel: 'night',
  panel2: 'dusk',
  ink: 'cream',
  inkDim: 'steel',
  edge: 'cream',
  shadow: 'void',
  accent: 'yellow',
  accentDeep: 'orange',
  accent2: 'salmon',
  accent2Deep: 'plum',
  ok: 'green',
  okDeep: 'forest',
  bad: 'red',
  badDeep: 'crimson',
} as const satisfies Record<string, PaletteKey>;

export type UiKey = keyof typeof UI;

/** Colore di ogni livello di rarità (stesso ordine di TIERS). */
export const TIER_COLORS: PaletteKey[] = ['slate', 'yellow', 'orange', 'red', 'magenta', 'cyan', 'white'];

/** Strati del sottosuolo: colore base, ombra, luce. */
export const ZONE_COLORS: { base: PaletteKey; dark: PaletteKey; light: PaletteKey }[] = [
  { base: 'brown', dark: 'darkBrown', light: 'tan' },     // Radio
  { base: 'rust', dark: 'brown', light: 'clay' },         // Classifica
  { base: 'crimson', dark: 'darkBrown', light: 'rust' },  // Lato B
  { base: 'plum', dark: 'darkBrown', light: 'magenta' },  // Bootleg
  { base: 'dusk', dark: 'night', light: 'slate' },        // Demo in cantina
  { base: 'night', dark: 'void', light: 'dusk' },         // Leggenda
];

export const SKY: PaletteKey[] = ['navy', 'blue', 'cyan'];
export const GRASS: { base: PaletteKey; dark: PaletteKey } = { base: 'green', dark: 'forest' };

/** Etichette dei vinili sepolti. */
export const LABEL_COLORS: PaletteKey[] = ['salmon', 'yellow', 'cyan', 'green', 'magenta', 'orange'];

/** Dimensione di un "pixel" dell'interfaccia (bordi a gradini). */
export const PX = 4;

export const color = (k: PaletteKey) => PALETTE[k];

/** Variabili CSS iniettate nel layout: --pal-<nome> e --ui-<ruolo>. */
export function cssVariables(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const [k, v] of Object.entries(PALETTE)) vars[`--pal-${k}`] = v;
  for (const [k, v] of Object.entries(UI)) vars[`--ui-${k}`] = PALETTE[v];
  vars['--px'] = `${PX}px`;
  return vars;
}
