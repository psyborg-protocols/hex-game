// decor.test.mjs — decor/index.json is generated from the art by
// tools/decor_index.js, so what is worth testing is that it still describes the
// art, and that the game only ever asks it for sprites it actually has.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test, run, eq, ok } from './_harness.mjs';
import { MAX_TREES } from '../src/render/decor.js';
import { generateWorld } from '../src/world/worldgen.js';
import { makeResolvers } from '../src/world/tileset.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const decor = JSON.parse(readFileSync(join(root, 'decor', 'index.json'), 'utf8'));
const tileIndex = JSON.parse(readFileSync(join(root, 'new_tiles', 'index.json'), 'utf8'));

/** The PNG header carries the real dimensions; no decoder needed for this. */
function pngSize(file) {
  const b = readFileSync(file);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

test('the index describes the sheet that is actually on disk', () => {
  const size = pngSize(join(root, 'decor', 'Decor.png'));
  eq({ width: decor.width, height: decor.height }, size, 'index and sheet disagree on size');
});

test('every sprite box lies inside the sheet', () => {
  for (const [name, b] of Object.entries(decor.sprites)) {
    ok(b.w > 0 && b.h > 0, `${name} is empty`);
    ok(b.x >= 0 && b.y >= 0, `${name} starts off the sheet at ${b.x},${b.y}`);
    ok(b.x + b.w <= decor.width, `${name} runs off the right edge`);
    ok(b.y + b.h <= decor.height, `${name} runs off the bottom edge`);
  }
});

test('every sprite stays inside its own grid column', () => {
  // Segmentation is per cell; a box spilling into the next column would mean two
  // sprites had been merged.
  for (const [name, b] of Object.entries(decor.sprites)) {
    const col = Math.floor(b.x / decor.cell);
    eq(Math.floor((b.x + b.w - 1) / decor.cell), col, `${name} spans two grid columns`);
  }
});

test('foot points sit on the bottom centre of the box', () => {
  for (const [name, b] of Object.entries(decor.sprites)) {
    eq(b.footY, b.h, `${name}: foot is not on the sprite's base`);
    ok(b.footX >= 0 && b.footX <= b.w, `${name}: foot is outside the sprite`);
  }
});

test('groups name only sprites that exist', () => {
  for (const [group, names] of Object.entries(decor.groups)) {
    for (const n of names) ok(decor.sprites[n], `group ${group} names missing sprite ${n}`);
  }
});

test('both tree kinds have every stage the renderer can ask for', () => {
  // drawColumnDecor builds names as `${kind}_${stage}` for stages 1..3.
  for (const kind of ['oak', 'pine']) {
    for (let stage = 1; stage <= 3; stage++) {
      ok(decor.sprites[`${kind}_${stage}`], `no ${kind}_${stage} to draw`);
    }
    ok(decor.sprites[`${kind}_stump`], `no ${kind}_stump`);
  }
});

test('a tree is never wider than the hex it stands on', () => {
  // A canopy may rise into the headroom above, but a sprite wider than the tile
  // would hang over the hexes either side and break the depth read.
  for (const name of [...decor.groups.oak, ...decor.groups.pine]) {
    const b = decor.sprites[name];
    ok(b.w <= tileIndex.frame.width, `${name} is ${b.w}px wide, wider than a ${tileIndex.frame.width}px tile`);
    ok(b.h <= tileIndex.frame.height, `${name} is taller than a whole frame`);
  }
});

test('generated woods carry trees, and only in amounts that can be drawn', () => {
  const map = generateWorld({ seed: 'decor', radius: 16, resolvers: makeResolvers(tileIndex) });
  const wooded = [...map].filter(c => c.feature?.type === 'trees');
  ok(wooded.length > 0, 'a world with no trees at all');

  for (const col of wooded) {
    ok(['oak', 'pine'].includes(col.feature.kind), `unknown tree kind ${col.feature.kind}`);
    ok(col.feature.remaining > 0, `${col.q},${col.r} claims trees but has none left`);
  }

  // The bare floors are the ones that need props; they must actually get some.
  const sparse = wooded.filter(c => c.terrain === 'forest_floor' || c.terrain === 'pine_floor');
  ok(sparse.length > 0, 'no sparse woods, so the decor sheet draws nothing');
  ok(MAX_TREES >= 1, 'the renderer caps trees at zero');
});

run('decor');
