// autotile.test.mjs — the path and lake sets are known to be incomplete, so what
// matters is that every mask the generator can produce still lands on real art.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test, run, eq, ok } from './_harness.mjs';
import {
  SHEET_NAMES, FRAMES_PER_SHEET, makeResolvers, supportedMasks, popcount,
  variantFor, cropFrame, CROPS, TERRAIN,
} from '../src/world/tileset.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const index = JSON.parse(readFileSync(join(root, 'new_tiles', 'index.json'), 'utf8'));
const resolve = makeResolvers(index);
const supported = supportedMasks(index);

const sheets = new Set(SHEET_NAMES);
const isRealFrame = ({ sprite, frame }) =>
  sheets.has(sprite) && Number.isInteger(frame) && frame >= 0 && frame < FRAMES_PER_SHEET;

/** Are the set bits of `mask` a single wrap-around run around the six edges? */
function isContiguous(mask) {
  const n = popcount(mask);
  if (n === 0 || n === 6) return true;
  for (let start = 0; start < 6; start++) {
    let run = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << ((start + i) % 6))) run++;
    if (run === n) return true;
  }
  return false;
}

test('every sheet named in the autotile tables actually exists', () => {
  for (const [mask, [sprite]] of Object.entries(index.pathByMask)) {
    ok(sheets.has(sprite), `path mask ${mask} names unknown sheet ${sprite}`);
  }
  for (const [mask, [sprite]] of Object.entries(index.lakeByLandMask)) {
    ok(sheets.has(sprite), `lake mask ${mask} names unknown sheet ${sprite}`);
  }
});

test('every terrain names only sheets that exist', () => {
  for (const [id, t] of Object.entries(TERRAIN)) {
    for (const s of t.sheets) ok(sheets.has(s), `terrain ${id} names unknown sheet ${s}`);
  }
  for (const [id, c] of Object.entries(CROPS)) {
    ok(sheets.has(c.sheet), `crop ${id} names unknown sheet ${c.sheet}`);
  }
});

test('all 64 path masks resolve to real art', () => {
  for (let mask = 0; mask < 64; mask++) {
    const hit = resolve.path(mask);
    ok(isRealFrame(hit), `path mask ${mask} resolved to ${JSON.stringify(hit)}`);
  }
});

test('all 64 lake masks resolve to real art', () => {
  for (let mask = 0; mask < 64; mask++) {
    const hit = resolve.lake(mask, 3, 4);
    ok(isRealFrame(hit), `lake mask ${mask} resolved to ${JSON.stringify(hit)}`);
  }
});

test('supported masks are covered exactly, not approximated', () => {
  for (const mask of supported.path) {
    eq(resolve.path(mask), { sprite: index.pathByMask[mask][0], frame: index.pathByMask[mask][1] },
      `path mask ${mask} should use its own art`);
  }
  for (const mask of supported.lake) {
    if (mask === 0) continue; // open water is hashed, not tabled
    eq(resolve.lake(mask), { sprite: index.lakeByLandMask[mask][0], frame: index.lakeByLandMask[mask][1] },
      `lake mask ${mask} should use its own art`);
  }
});

test('path coverage is the documented shape', () => {
  const byConnections = {};
  for (const mask of supported.path) {
    const n = popcount(mask);
    byConnections[n] = (byConnections[n] || 0) + 1;
  }
  // docs/new_tiles.md: 6/6, 15/15, 14/20, 3/15, 0/6, 1/1.
  eq(byConnections, { 1: 6, 2: 15, 3: 14, 4: 3, 6: 1 }, 'path pieces by connection count');
});

test('lake shores exist only for contiguous runs of land', () => {
  for (const mask of supported.lake) {
    ok(isContiguous(mask), `lake mask ${mask} is not a contiguous shoreline`);
  }
  // And every contiguous run of 1-4 is present, which is what the generator relies on.
  for (let mask = 1; mask < 64; mask++) {
    const n = popcount(mask);
    if (n >= 1 && n <= 4 && isContiguous(mask)) {
      ok(supported.lake.has(mask), `contiguous shoreline ${mask} is missing`);
    }
  }
});

test('unsupported masks fall back to the nearest, preferring to drop a spur', () => {
  // A five-way junction has no art. The fallback must be a real four-way piece
  // that is a subset of what was asked for, not a different junction entirely.
  const fiveWay = 0b011111;
  const hit = resolve.path(fiveWay);
  ok(isRealFrame(hit), 'five-way did not resolve');
  const chosen = Number(Object.entries(index.pathByMask)
    .find(([, v]) => v[0] === hit.sprite && v[1] === hit.frame)[0]);
  ok(popcount(chosen & ~fiveWay) === 0, `fallback ${chosen} invented a connection`);
});

test('open water is hashed across the base sheet, not stuck on one frame', () => {
  const frames = new Set();
  for (let q = 0; q < 12; q++) for (let r = 0; r < 12; r++) frames.add(resolve.lake(0, q, r).frame);
  ok(frames.size > 1, 'every open-water tile picked the same frame');
});

test('terrain variants are deterministic and spread across the sheets', () => {
  eq(variantFor('grass', 4, 7), variantFor('grass', 4, 7), 'same hex, same sprite');
  const seen = new Set();
  for (let q = 0; q < 16; q++) for (let r = 0; r < 16; r++) seen.add(variantFor('grass', q, r).sprite);
  eq(seen.size, TERRAIN.grass.sheets.length, 'all three grass sheets should get used');
});

test('crop frames follow the two three-stage sequences', () => {
  eq([0, 1, 2].map(s => cropFrame(s, 0)), [0, 1, 2], 'variant 0 is frames 0-2');
  eq([0, 1, 2].map(s => cropFrame(s, 1)), [3, 4, 5], 'variant 1 is frames 3-5');
  eq(cropFrame(9, 0), 2, 'overgrown clamps to the last stage');
});

run('autotile');
