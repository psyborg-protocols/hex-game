// hud_icons.mjs — draws the HUD's pixel icons into icons/hud/.
//
//   node tools/hud_icons.mjs
//
// Each icon is a grid of characters, one per pixel, in the same sixteen-colour
// palette as the item icons. The sun and moon are worked out from circles, so
// they stay round however small they are drawn.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'icons', 'hud');
mkdirSync(out, { recursive: true });

const PAL = {
  k: '#1a1c2c', // outline
  r: '#b13e53', // red
  o: '#ef7d57', // orange
  y: '#ffcd75', // yellow
  w: '#f4f4f4', // white
  s: '#94b0c2', // pale steel
  d: '#566c86', // dusk
  c: '#73eff7', // pale cyan
};

/** A grid of rows to a crisp-edged SVG, one rect run per colour. */
function toSvg(rows, pal = PAL) {
  const w = Math.max(...rows.map(r => r.length));
  const h = rows.length;
  const runs = {};
  rows.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      if (ch === '.' || ch === ' ') { x++; continue; }
      let len = 1;
      while (row[x + len] === ch) len++;
      (runs[ch] ||= []).push(`M${x} ${y}h${len}v1h-${len}z`);
      x += len;
    }
  });
  const paths = Object.entries(runs).map(([ch, d]) => `  <path fill="${pal[ch]}" d="${d.join('')}"/>`).join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * 4}" height="${h * 4}" shape-rendering="crispEdges">\n${paths}\n</svg>\n`;
}

const ICONS = {
  heart: [
    '.kk...kk.',
    'kwrk.krrk',
    'kwrrkrrrk',
    'krrrrrrrk',
    '.krrrrrk.',
    '..krrrk..',
    '...krk...',
    '....k....',
  ],
  energy: [
    '...kkkk',
    '..kyyyk',
    '..kyyk.',
    '.kyyk..',
    'kyyyyyk',
    'kkkyyk.',
    '..kyk..',
    '.kyk...',
    '.kk....',
  ],
  hand: [
    '..k.k.k...',
    '.kokokok..',
    '.kokokok..',
    '.kokokok..',
    '.koooooook',
    '.kooooookok',
    '.koooooook.',
    '..kooooook.',
    '..koooook..',
    '...kkkkk...',
  ],
  tired: [
    'cccc....',
    '...c....',
    '..c.....',
    '.c......',
    'cccc.ccc',
    '......c.',
    '.....c..',
    '....ccc.',
  ],
  sun: [
    '.....y.....',
    '.y...y...y.',
    '...ooooo...',
    '..oywyyyo..',
    '..owyyyyo..',
    'yyoyyyyyoyy',
    '..oyyyyyo..',
    '..oyyyyyo..',
    '...ooooo...',
    '.y...y...y.',
    '.....y.....',
  ],
};

// The moon: a disc with a bite out of it, shaded on its inner edge.
function moon(n = 11) {
  const c = (n - 1) / 2;
  const rows = [];
  for (let y = 0; y < n; y++) {
    let row = '';
    for (let x = 0; x < n; x++) {
      const inDisc = Math.hypot(x - c, y - c) <= c + 0.3;
      const inBite = Math.hypot(x - (c + 3.2), y - (c - 1.6)) <= c - 0.6;
      const nearBite = Math.hypot(x - (c + 3.2), y - (c - 1.6)) <= c + 0.6;
      row += !inDisc || inBite ? '.' : nearBite ? 's' : 'w';
    }
    rows.push(row);
  }
  return rows;
}
ICONS.moon = moon();

// The buttons down the left and the actions along the bottom.
ICONS.eye = [
  '....kkkkk....',
  '..kkwwwwwkk..',
  '.kwwwyyywwwk.',
  'kwwwyykyywwwk',
  '.kwwwyyywwwk.',
  '..kkwwwwwkk..',
  '....kkkkk....',
];
ICONS.hourglass = [
  'kkkkkkkkk',
  'koooooook',
  'kkkkkkkkk',
  '.kyyyyyk.',
  '..kyyyk..',
  '...kyk...',
  '...kwk...',
  '..kwwwk..',
  '.kwwywwk.',
  '.kyyyyyk.',
  'kkkkkkkkk',
  'koooooook',
  'kkkkkkkkk',
];
ICONS.flame = [
  '....k....',
  '...kok...',
  '...kok...',
  '..koook..',
  '.kooyook.',
  '.koyyyok.',
  'kooyyyook',
  'kooywyook',
  'koyywyyok',
  '.koyyyok.',
  '..kkkkk..',
];

// A cog: a disc with eight teeth and a hole, outlined, lit from the top left.
function cog(n = 13) {
  const c = (n - 1) / 2;
  const filled = (x, y) => {
    const d = Math.hypot(x - c, y - c);
    if (d < 1.7) return false;
    if (d <= 3.9) return true;
    const a = ((Math.atan2(y - c, x - c) * 180) / Math.PI + 360) % 45;
    return d <= 5.9 && (a < 12 || a > 33);
  };
  const rows = [];
  for (let y = 0; y < n; y++) {
    let row = '';
    for (let x = 0; x < n; x++) {
      if (!filled(x, y)) { row += '.'; continue; }
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !filled(x + dx, y + dy));
      row += edge ? 'k' : x + y < n - 1 ? 'w' : 's';
    }
    rows.push(row);
  }
  return rows;
}
ICONS.cog = cog();

for (const [name, rows] of Object.entries(ICONS)) {
  writeFileSync(join(out, `${name}.svg`), toSvg(rows));
}
console.log(`wrote ${Object.keys(ICONS).length} icons to icons/hud/`);
