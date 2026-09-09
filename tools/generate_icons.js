// generate_icons.js — renders all item, skill and ability icons as SVG pixel art.
// Usage: node tools/generate_icons.js
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { draw } from './pcanvas.js';
import { PALETTE } from './palette.js';
import { PART1 } from './pixel_art_1.js';
import { PART2 } from './pixel_art_2.js';
import { PART3 } from './pixel_art_3.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

export { PALETTE } from './palette.js';const SIZE = 16;

const errors = [];
function validate(name, grid) {
  if (!Array.isArray(grid) || grid.length !== SIZE) {
    errors.push(`${name}: expected ${SIZE} rows, got ${grid && grid.length}`);
    return false;
  }
  let ok = true;
  grid.forEach((row, i) => {
    if (typeof row !== 'string' || row.length !== SIZE) {
      errors.push(`${name} row ${i + 1}: length ${row && row.length} (need ${SIZE}): ${JSON.stringify(row)}`);
      ok = false;
    } else if (/[^\w.]/.test(row) || [...row].some((ch) => ch !== '.' && !(ch in PALETTE))) {
      errors.push(`${name} row ${i + 1}: bad characters: ${JSON.stringify(row)}`);
      ok = false;
    }
  });
  return ok;
}

// Build a compact SVG: one <path> per color.
function gridToSvg(grid, sizePx = 64) {
  const paths = {};
  grid.forEach((row, y) => {
    let run = null;
    for (let x = 0; x < SIZE; x++) {
      const ch = row[x];
      if (ch === '.') { run = null; continue; }
      if (run && run.color === ch) { run.x2 = x + 1; continue; }
      if (run) appendRun(paths, run);
      run = { color: ch, x, x2: x + 1, y };
    }
    if (run) appendRun(paths, run);
  });
  const body = Object.entries(paths)
    .map(([color, d]) => `  <path fill="${PALETTE[color]}" d="${d}"/>`)
    .join('\n');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${sizePx}" height="${sizePx}" shape-rendering="crispEdges">\n${body}\n</svg>\n`;
}
function appendRun(paths, run) {
  const d = `M${run.x} ${run.y}h${run.x2 - run.x}v1h${-(run.x2 - run.x)}z`;
  paths[run.color] = (paths[run.color] || '') + d;
}

// Ability icon = skill glyph with level pips (dots) along the bottom.
function abilitySvg(glyph, level, name) {
  const rows = glyph.map((r) => r.split(''));
  // clear the bottom 2 rows, then draw pips
  rows[14] = Array(SIZE).fill('.');
  rows[15] = Array(SIZE).fill('.');
  const pipColor = { stoneworking: 'x', woodworking: 'G', homesteading: 'o', metalworking: 'c', mind: 'n' }[name] || 'w';
  // 1px pips with 1px gaps: 7 pips = 13px, fits.
  const start = Math.floor((SIZE - (2 * level - 1)) / 2);
  for (let i = 0; i < level; i++) {
    const x0 = start + i * 2;
    rows[14][x0] = pipColor;
    rows[15][x0] = pipColor;
  }
  return gridToSvg(rows.map((r) => r.join('')));
}

// Merge icon definitions; draw functions become validated grids.
const all = {};
for (const src of [PART1, PART2, PART3]) {
  for (const [name, val] of Object.entries(src)) {
    const grid = typeof val === 'function' ? draw(val) : val;
    if (!validate(`${name}`, grid)) { delete all[name]; continue; }
    all[name] = grid;
  }
}
const SKILL_NAMES = ['stoneworking', 'woodworking', 'homesteading', 'metalworking', 'mind'];
const SKILL_GLYPHS = {};
for (const name of SKILL_NAMES) {
  if (all[name]) { SKILL_GLYPHS[name] = all[name]; delete all[name]; }
}

if (existsSync(path.join(ROOT, 'icons'))) rmSync(path.join(ROOT, 'icons'), { recursive: true, force: true });
for (const dir of ['icons', 'icons/skills', 'icons/abilities']) {
  mkdirSync(path.join(ROOT, dir), { recursive: true });
}

let n = 0;
// Items
for (const [name, grid] of Object.entries(all)) {
  if (!validate(`item:${name}`, grid)) continue;
  writeFileSync(path.join(ROOT, 'icons', `${name}.svg`), gridToSvg(grid));
  n++;
}
// Skill glyphs
for (const [name, grid] of Object.entries(SKILL_GLYPHS)) {
  if (!validate(`skill:${name}`, grid)) continue;
  writeFileSync(path.join(ROOT, 'icons/skills', `${name}.svg`), gridToSvg(grid));
  n++;
}
// Ability icons (skill + level 1..7)
let an = 0;
for (const [name, grid] of Object.entries(SKILL_GLYPHS)) {
  const g = validate(`skill:${name}`, grid) ? grid : null;
  if (!g) continue;
  for (let lvl = 1; lvl <= 7; lvl++) {
    writeFileSync(path.join(ROOT, 'icons/abilities', `${name}_lvl${lvl}.svg`), abilitySvg(g, lvl, name));
    an++;
  }
}

if (errors.length) {
  console.error(`\n${errors.length} validation error(s):`);
  for (const e of errors) console.error('  ' + e);
  process.exit(1);
}
console.log(`OK: ${n} base icons (items+skills), ${an} ability icons written to icons/`);
