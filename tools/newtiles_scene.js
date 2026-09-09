// newtiles_scene.js — render a test scene that exercises the autotile sets:
// a lake with streams running into it, plus a path network. Uses the game's own
// hexgrid so the neighbour maths cannot drift from what the game will do.
//
// Usage: node tools/newtiles_scene.js out.png [scale] [tiledir]
import { readFileSync, existsSync } from 'node:fs';
import { neighbor, EDGE_ORDER } from '../src/world/hexgrid.js';
import { renderMap } from './newtiles_map.js';

const dir = process.argv[4] || 'new_tiles';
const scale = Number(process.argv[3]) || 4;
const out = process.argv[2] || 'scene.png';

const index = JSON.parse(readFileSync(`${dir}/index.json`, 'utf8'));
const channels = existsSync(`${dir}/channels.json`)
  ? JSON.parse(readFileSync(`${dir}/channels.json`, 'utf8'))
  : { path: {}, stream: {}, lake: {} };
const pathByMask = { ...index.pathByMask, ...channels.path };
const streamByMask = { ...channels.stream };
const lakeByLand = { ...index.lakeByLandMask, ...(channels.lake || {}) };

const COLS = 9, ROWS = 8;
const k = (q, r) => `${q},${r}`;

// a lake, two streams feeding it, and a track along the ridge
const LAKE = new Set(['4,4', '5,4', '4,5', '5,5', '6,4'].map(String));
const STREAM = new Set(['4,0', '4,1', '4,2', '4,3', '7,2', '7,3', '6,3'].map(String));
const PATH = new Set(['0,5', '1,5', '2,5', '2,4', '3,4', '3,3', '2,3', '1,3', '1,2', '0,6', '2,6'].map(String));

const isWater = (q, r) => LAKE.has(k(q, r)) || STREAM.has(k(q, r));

function maskOf(q, r, test) {
  let m = 0;
  for (let e = 0; e < 6; e++) {
    const n = neighbor(q, r, e);
    if (test(n.q, n.r)) m |= 1 << e;
  }
  return m;
}
const hash = (c, r) => Math.abs(((c * 73856093) ^ (r * 19349663)) >>> 0);
const pick = (table, mask, fallback) => {
  const hit = table[mask];
  if (hit) return { sprite: hit[0], frame: hit[1] };
  // nearest supported mask, the same fallback the game uses
  let best = null, bestScore = 99;
  for (const key of Object.keys(table)) {
    const m = Number(key);
    let diff = 0;
    for (let b = 0; b < 6; b++) if (((m >> b) & 1) !== ((mask >> b) & 1)) diff++;
    if (diff < bestScore) { bestScore = diff; best = table[key]; }
  }
  return best ? { sprite: best[0], frame: best[1] } : fallback;
};

const GRASS = ['Tiles_GrassBase1', 'Tiles_GrassBase2', 'Tiles_GrassBase3'];

function cell(q, r) {
  if (q < 0 || r < 0 || q >= COLS || r >= ROWS) return [GRASS[hash(q, r) % 3], hash(q + 3, r) % 6];
  if (LAKE.has(k(q, r))) {
    const land = maskOf(q, r, (a, b) => !isWater(a, b));
    if (land === 0) return ['Tiles_LakeBase', hash(q, r) % 6];
    const s = pick(lakeByLand, land, { sprite: 'Tiles_LakeBase', frame: 0 });
    return [s.sprite, s.frame];
  }
  if (STREAM.has(k(q, r))) {
    const conn = maskOf(q, r, isWater);
    const s = pick(streamByMask, conn, { sprite: 'Tiles_LakeBase', frame: 0 });
    return [s.sprite, s.frame];
  }
  if (PATH.has(k(q, r))) {
    const conn = maskOf(q, r, (a, b) => PATH.has(k(a, b)));
    const s = pick(pathByMask, conn, { sprite: 'Tiles_PathEnd', frame: 0 });
    return [s.sprite, s.frame];
  }
  return [GRASS[hash(q, r) % 3], hash(q + 3, r) % 6];
}

const res = renderMap(cell, COLS, ROWS, out, scale);
console.log(`${out} ${res.W}x${res.H}`);
// report which masks the scene actually needed, and whether art existed
const need = { path: new Set(), stream: new Set(), lake: new Set() };
for (let q = 0; q < COLS; q++) for (let r = 0; r < ROWS; r++) {
  if (LAKE.has(k(q, r))) need.lake.add(maskOf(q, r, (a, b) => !isWater(a, b)));
  if (STREAM.has(k(q, r))) need.stream.add(maskOf(q, r, isWater));
  if (PATH.has(k(q, r))) need.path.add(maskOf(q, r, (a, b) => PATH.has(k(a, b))));
}
for (const [kind, table] of [['path', pathByMask], ['stream', streamByMask], ['lake', lakeByLand]]) {
  const missing = [...need[kind]].filter((m) => m !== 0 && !table[m]);
  console.log(`${kind}: ${need[kind].size} masks used, ${missing.length} without art` +
    (missing.length ? ` (${missing.join(', ')})` : ''));
}
