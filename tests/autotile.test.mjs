// autotile.test.mjs — the path, shoreline and stream sets each cover all 63
// connection masks. What matters is that every mask lands on real art, that a
// mask with its own piece never falls back, and that the fallback still behaves
// when handed a table with a hole in it.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test, run, eq, ok } from './_harness.mjs';
import { readPng } from '../tools/png_read.js';
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

test('every path junction has its own art', () => {
  const byConnections = {};
  for (const mask of supported.path) {
    const n = popcount(mask);
    byConnections[n] = (byConnections[n] || 0) + 1;
  }
  // Was 6/15/14/3/0/1 while the set had gaps; tools/newtiles_channels.js filled
  // the missing 24, so every one of the 63 masks now resolves to real art.
  eq(byConnections, { 1: 6, 2: 15, 3: 20, 4: 15, 5: 6, 6: 1 }, 'path pieces by connection count');
});

test('every shoreline has its own art, contiguous or not', () => {
  // The original set only drew shorelines that were a single unbroken run of
  // land. A stream flowing into a lake breaks the shore in two, so the broken
  // ones had to exist before streams were usable.
  for (let mask = 1; mask < 64; mask++) {
    ok(supported.lake.has(mask), `shoreline ${mask} is missing`);
  }
  // Of the 63 masks, 31 are a single run (six rotations each of lengths 1-5,
  // plus all-six), so 32 are broken shorelines. None of those existed before.
  const broken = [...supported.lake].filter(m => !isContiguous(m));
  ok(broken.length === 32, `expected 32 broken shorelines, got ${broken.length}`);
});

test('no table entry points at a padded filler frame', () => {
  // Sheets whose rotation family has fewer than six members pad the spare slots
  // with plain ground, and plain ground reads as land on all six edges — which
  // is mask 63, a real shoreline (a one-hex pond). A filler was claiming 63
  // before Tiles_LakeSidesSix could, so ponds drew as blank grass. Every entry
  // must point at a frame that actually contains the feature it promises.
  const anyWater = (img, fi) => {
    for (let y = 16; y < 40; y++)
      for (let x = 0; x < 32; x++) {
        const i = (y * img.width + fi * 32 + x) * 4;
        if (img.data[i + 3] === 0) continue;
        const [r, g, b] = [img.data[i], img.data[i + 1], img.data[i + 2]];
        if (b > r + 20 && b > g + 10) return true;
      }
    return false;
  };
  const cache = new Map();
  const sheetOf = name => {
    if (!cache.has(name)) cache.set(name, readPng(join(root, 'new_tiles', `${name}.png`)));
    return cache.get(name);
  };
  for (const [label, table] of [['lake', index.lakeByLandMask], ['stream', index.streamByMask]]) {
    for (const [mask, [name, frame]] of Object.entries(table)) {
      ok(anyWater(sheetOf(name), frame),
        `${label} mask ${mask} points at ${name} frame ${frame}, which holds no water`);
    }
  }
  eq(index.lakeByLandMask[63], ['Tiles_LakeSidesSix', 0], 'a one-hex pond should draw the enclosed piece');
});

test('one-tile streams cover every connection mask and carry the lake water', () => {
  const stream = index.streamByMask;
  ok(stream, 'index.json has no streamByMask');
  for (let mask = 1; mask < 64; mask++) {
    const hit = stream[mask];
    ok(hit && sheets.has(hit[0]), `stream mask ${mask} has no art`);
    ok(Number.isInteger(hit[1]) && hit[1] >= 0 && hit[1] < FRAMES_PER_SHEET,
      `stream mask ${mask} names frame ${hit && hit[1]}`);
  }
});

test('unsupported masks fall back to the nearest, preferring to drop a spur', () => {
  // Every mask has art now, so the shipped table never reaches the fallback.
  // Hand it a table with the five-ways cut out — the way the set used to ship —
  // and it must pick a real piece that is a *subset* of what was asked for. A
  // missing spur reads as a dead end; an invented one reads as a bug.
  const holed = Object.fromEntries(
    Object.entries(index.pathByMask).filter(([m]) => popcount(Number(m)) !== 5));
  const gapped = makeResolvers({ ...index, pathByMask: holed });

  const fiveWay = 0b011111;
  ok(!holed[fiveWay], 'the hole was not actually cut');
  const hit = gapped.path(fiveWay);
  ok(isRealFrame(hit), 'five-way did not resolve');
  const chosen = Number(Object.entries(holed)
    .find(([, v]) => v[0] === hit.sprite && v[1] === hit.frame)[0]);
  ok(popcount(chosen & ~fiveWay) === 0, `fallback ${chosen} invented a connection`);

  // And with the full table it uses the real piece rather than approximating.
  eq(resolve.path(fiveWay),
    { sprite: index.pathByMask[fiveWay][0], frame: index.pathByMask[fiveWay][1] },
    'a five-way should now use its own art');
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
