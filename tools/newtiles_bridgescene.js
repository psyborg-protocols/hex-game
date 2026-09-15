// newtiles_bridgescene.js — look at the bridge deck in place: three runs laid
// across a river, plus the artist's jetty beside them for comparison.
//
// Usage: node tools/newtiles_bridgescene.js [out.png] [scale]
import { writeFileSync } from 'node:fs';
import { readPng } from './png_read.js';
import { png } from './preview.js';
import { neighbor } from '../src/world/hexgrid.js';

const FRAME_W = 32, FRAME_H = 48, STEP_X = 26, STEP_Y = 24, COL_OFF = 12;
const COLS = 13, ROWS = 9;

const sheets = new Map();
const sheet = name => {
  if (!sheets.has(name)) sheets.set(name, readPng(`new_tiles/${name}.png`));
  return sheets.get(name);
};

const hash = (a, b) => Math.abs(((a * 73856093) ^ (b * 19349663)) >>> 0);
const k = (q, r) => `${q},${r}`;

// Three causeways over open water, one per run, each three tiles long. The
// chains are walked with the game's own neighbour maths: a run has to leave a
// tile by the edge its neighbour arrives on, and eyeballing that on an odd-q
// lattice is exactly the mistake this scene exists to catch.
const RUN_EDGE = [3, 4, 2];   // N-S leaves by S, NE-SW by SW, NW-SE by SE
const BRIDGES = new Map();
const WATER = new Set();
[[3, 1], [7, 2], [3, 6]].forEach(([q0, r0], run) => {
  let at = { q: q0, r: r0 };
  for (let i = 0; i < 3; i++) {
    BRIDGES.set(k(at.q, at.r), run);
    at = neighbor(at.q, at.r, RUN_EDGE[run]);
  }
});
// Flood a little water round each chain so the decks have something to cross.
for (const key of BRIDGES.keys()) {
  const [q, r] = key.split(',').map(Number);
  WATER.add(key);
  for (let e = 0; e < 6; e++) {
    const n = neighbor(q, r, e);
    if (!BRIDGES.has(k(n.q, n.r))) WATER.add(k(n.q, n.r));
  }
}

const GRASS = ['Tiles_GrassBase1', 'Tiles_GrassBase2', 'Tiles_GrassBase3'];

/** The tile under everything. */
function base(q, r) {
  if (WATER.has(k(q, r))) return ['Tiles_FlowingWater', hash(q, r) % 6];
  if (q === 11 && r === 4) return ['Tiles_LakeBase', 4];   // the jetty, for reference
  return [GRASS[hash(q, r) % 3], hash(q + 3, r) % 6];
}

const W = (COLS - 1) * STEP_X + FRAME_W;
const H = (ROWS - 1) * STEP_Y + COL_OFF + FRAME_H;
const buf = Buffer.alloc(W * H * 3);
for (let i = 0; i < buf.length; i += 3) { buf[i] = 40; buf[i + 1] = 44; buf[i + 2] = 52; }

function blit(name, fi, px0, py0) {
  const img = sheet(name);
  for (let y = 0; y < FRAME_H; y++) for (let x = 0; x < FRAME_W; x++) {
    const s = (y * img.width + fi * FRAME_W + x) * 4;
    if (img.data[s + 3] === 0) continue;
    const dx = px0 + x, dy = py0 + y;
    if (dx < 0 || dy < 0 || dx >= W || dy >= H) continue;
    const d = (dy * W + dx) * 3;
    buf[d] = img.data[s]; buf[d + 1] = img.data[s + 1]; buf[d + 2] = img.data[s + 2];
  }
}

// Back to front, and the bridge overlay goes down with its own tile so the next
// row forward paints over the legs hanging off the end of it.
const order = [];
for (let r = 0; r < ROWS; r++) for (let q = 0; q < COLS; q++) order.push([q, r]);
order.sort((a, b) => (a[1] * STEP_Y + (a[0] & 1) * COL_OFF) - (b[1] * STEP_Y + (b[0] & 1) * COL_OFF) || a[0] - b[0]);

for (const [q, r] of order) {
  const px = q * STEP_X, py = r * STEP_Y + (q & 1) * COL_OFF;
  blit(...base(q, r), px, py);
  const b = BRIDGES.get(k(q, r));
  if (b !== undefined) blit('Tiles_Bridge', b, px, py);
}

const scale = Number(process.argv[3]) || 4;
const SW = W * scale, SH = H * scale;
const out = Buffer.alloc(SW * SH * 3);
for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) {
  const s = (Math.floor(y / scale) * W + Math.floor(x / scale)) * 3;
  const d = (y * SW + x) * 3;
  out[d] = buf[s]; out[d + 1] = buf[s + 1]; out[d + 2] = buf[s + 2];
}
const file = process.argv[2] || 'bridge.png';
writeFileSync(file, png(SW, SH, out));
console.log(`${file}: ${SW}x${SH}`);
