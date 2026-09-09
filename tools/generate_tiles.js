// generate_tiles.js — validates every terrain tile and writes tiles/*.svg.
// Usage: node tools/generate_tiles.js
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HEX_W, HEX_H, V1, V2, inHex } from './hexcanvas.js';
import { TILES, drawTerrain } from './tiles.js';
import { PALETTE } from './palette.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Variants exist because one tile repeated over a map always patterns, however
// good it is. Pick one per hex from a positional hash and the pattern is gone.
const VARIANTS = 4;
const SEED = (i) => 1 + i * 977;

const errors = [];
function validate(name, grid) {
  if (grid.length !== HEX_H) { errors.push(`${name}: ${grid.length} rows, need ${HEX_H}`); return false; }
  let holes = 0, outside = 0, bad = 0;
  grid.forEach((row, y) => {
    if (row.length !== HEX_W) { errors.push(`${name} row ${y}: width ${row.length}, need ${HEX_W}`); return; }
    for (let x = 0; x < HEX_W; x++) {
      const ch = row[x], within = inHex(x, y);
      if (within && ch === '.') holes++;
      else if (!within && ch !== '.') outside++;
      else if (ch !== '.' && !(ch in PALETTE)) bad++;
    }
  });
  if (holes) errors.push(`${name}: ${holes} unpainted pixel(s) inside the hex — the tile would show through`);
  if (outside) errors.push(`${name}: ${outside} pixel(s) outside the hex — neighbours would overlap`);
  if (bad) errors.push(`${name}: ${bad} pixel(s) using a colour outside the palette`);
  return !holes && !outside && !bad;
}

// one <path> per colour, horizontal runs merged
function gridToSvg(grid, sizePx = 128) {
  const paths = {};
  const push = (run) => {
    const w = run.x2 - run.x;
    paths[run.color] = (paths[run.color] || '') + `M${run.x} ${run.y}h${w}v1h${-w}z`;
  };
  grid.forEach((row, y) => {
    let run = null;
    for (let x = 0; x < HEX_W; x++) {
      const ch = row[x];
      if (ch === '.') { if (run) { push(run); run = null; } continue; }
      if (run && run.color === ch) { run.x2 = x + 1; continue; }
      if (run) push(run);
      run = { color: ch, x, x2: x + 1, y };
    }
    if (run) push(run);
  });
  const body = Object.entries(paths)
    .map(([color, d]) => `  <path fill="${PALETTE[color]}" d="${d}"/>`)
    .join('\n');
  const h = Math.round((sizePx * HEX_H) / HEX_W);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${HEX_W} ${HEX_H}" width="${sizePx}" height="${h}" shape-rendering="crispEdges">\n${body}\n</svg>\n`;
}

// Decode a written SVG back to a grid. The grids are proven to tile
// (tools/tile_preview.js --verify); this closes the loop by proving the SVG is a
// faithful encoding of one, so what ships tiles as well as what was tested.
const INV = Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [v, k]));
function svgToGrid(svg) {
  const grid = Array.from({ length: HEX_H }, () => Array(HEX_W).fill('.'));
  for (const m of svg.matchAll(/<path fill="([^"]+)" d="([^"]+)"\/>/g)) {
    const ch = INV[m[1]];
    for (const r of m[2].matchAll(/M(\d+) (\d+)h(\d+)/g)) {
      const x = +r[1], y = +r[2], w = +r[3];
      for (let i = 0; i < w; i++) grid[y][x + i] = ch;
    }
  }
  return grid.map((r) => r.join(''));
}

const dir = path.join(ROOT, 'tiles');
if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

const manifest = {};
let n = 0;
for (const name of Object.keys(TILES)) {
  const files = [];
  for (let v = 0; v < VARIANTS; v++) {
    const grid = drawTerrain(name, SEED(v));
    const file = v === 0 ? `${name}.svg` : `${name}_v${v + 1}.svg`;
    if (!validate(`${name} v${v + 1}`, grid)) continue;
    const svg = gridToSvg(grid);
    if (svgToGrid(svg).join('|') !== grid.join('|')) {
      errors.push(`${name} v${v + 1}: SVG does not decode back to the source grid`);
      continue;
    }
    // uniform integer scale keeps the lattice exact at the declared size
    const [, wAttr, hAttr] = svg.match(/width="(\d+)" height="(\d+)"/).map(Number);
    if (wAttr / HEX_W !== hAttr / HEX_H || !Number.isInteger(wAttr / HEX_W))
      errors.push(`${name} v${v + 1}: ${wAttr}x${hAttr} is not a uniform integer scale of ${HEX_W}x${HEX_H}`);
    writeFileSync(path.join(dir, file), svg);
    files.push(file);
    n++;
  }
  manifest[name] = files;
}

// Everything an engine needs to lay these out, so the geometry never has to be
// rediscovered from the artwork.
writeFileSync(path.join(dir, 'tileset.json'), JSON.stringify({
  hex: { width: HEX_W, height: HEX_H, orientation: 'pointy-top' },
  layout: {
    colStep: V1[0],
    rowStep: V2[1],
    oddRowOffset: V2[0],
    basis: [V1, V2],
    note: 'hex (col,row) is drawn at x = col*colStep + (row & 1)*oddRowOffset, y = row*rowStep',
  },
  variants: VARIANTS,
  variantRule: 'pick per hex from a positional hash; any variant of a terrain is interchangeable',
  terrains: manifest,
}, null, 2) + '\n');

if (errors.length) {
  console.error(`\n${errors.length} tile validation error(s):`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
console.log(`OK: ${n} tile SVGs (${Object.keys(TILES).length} terrains x ${VARIANTS} variants) written to tiles/`);
