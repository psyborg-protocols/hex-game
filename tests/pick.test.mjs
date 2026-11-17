// pick.test.mjs — fine-grained click targeting for trees that overhang their tile.
//
// The rules under test (see src/game/pick.js):
//   1. A click on a tree's art targets the tree — even where the art overlaps
//      an adjacent tile, and even where pickHex would answer with that tile.
//   2. A click in open space next to the tree targets nothing (the tile under
//      the pointer is what gets clicked).
//   3. When two trees' art covers the same point, the one drawn on top wins.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test, run, eq, ok } from './_harness.mjs';
import { treeAt, resolveClick } from '../src/game/pick.js';
import { treeBoxes } from '../src/render/decor.js';
import { tileCenter, pointInHex, neighbors } from '../src/world/hexgrid.js';
import { generateWorld } from '../src/world/worldgen.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const index = JSON.parse(readFileSync(join(root, 'decor', 'index.json'), 'utf8'));

/** A map with exactly the columns given; treeAt only ever asks `get`. */
function makeMap(cols) {
  const m = new Map(cols.map(c => [`${c.q},${c.r}`, c]));
  return { get: (q, r) => m.get(`${q},${r}`) || null };
}

const wood = (q, r, terrain, remaining, extra = {}) => ({
  q, r, h: 0, terrain, feature: { type: 'trees', remaining }, ...extra,
});

/** A point inside every box of `boxes` that also lies on the top face of `hex`. */
function overlapPoint(boxes, hex) {
  const { cx, cy } = tileCenter(hex.q, hex.r, 0);
  for (let x = Math.ceil(cx - 16); x < cx + 16; x++) {
    for (let y = Math.ceil(cy - 12); y < cy + 12; y++) {
      if (!pointInHex(x, y, cx, cy)) continue;
      if (boxes.every(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h)) return { x, y };
    }
  }
  return null;
}

test('a click on a tree\'s art targets the tree', () => {
  const col = wood(0, 0, 'forest_floor', 2);
  const map = makeMap([col]);
  const boxes = treeBoxes(col, index);
  ok(boxes.length > 0, 'the column draws trees');
  // A point dead centre of the first drawn box.
  const b = boxes[0];
  const hit = treeAt(b.x + Math.floor(b.w / 2), b.y + Math.floor(b.h / 2), map, { q: 0, r: 0 }, index);
  eq(hit && { q: hit.q, r: hit.r, kind: hit.kind, harvest: hit.harvest },
    { q: 0, r: 0, kind: 'tree', harvest: 'fell_tree' }, 'centre of the art is the tree');
});

test('a click in open space next to the tree targets nothing', () => {
  const col = wood(0, 0, 'forest_floor', 2);
  const map = makeMap([col]);
  const boxes = treeBoxes(col, index);
  // (28, 36) is on the top face of (0,0) and outside every drawn box.
  ok(pointInHex(28, 36, 16, 28), 'test point is on the top face');
  ok(boxes.every(b => !(28 >= b.x && 28 < b.x + b.w && 36 >= b.y && 36 < b.y + b.h)),
    'test point is clear of every box');
  eq(treeAt(28, 36, map, { q: 0, r: 0 }, index), null, 'open space is not a tree');
});

test('a canopy overhanging an adjacent tile targets the tree, not that tile', () => {
  // (0,1) is in front of (0,0); its trees reach up into (0,0)\u2019s top face.
  const back = wood(0, 0, 'grass', 0, { feature: null });
  const front = wood(0, 1, 'forest_floor', 2);
  const map = makeMap([back, front]);
  const p = overlapPoint(treeBoxes(front, index), back);
  ok(p, 'the front trees actually overhang the back tile in this world');
  // pickHex would answer with the back tile: its top face contains the point.
  ok(pointInHex(p.x, p.y, ...Object.values(tileCenter(0, 0, 0))), 'point lies on the back tile\u2019s face');
  const hit = treeAt(p.x, p.y, map, { q: 0, r: 0 }, index);
  eq(hit && { q: hit.q, r: hit.r }, { q: 0, r: 1 }, 'the overhanging tree wins over the tile under the pointer');
});

test('when two canopies cover the same point, the front-most drawn wins', () => {
  const back = wood(0, 0, 'forest_floor', 2);
  const front = wood(0, 1, 'forest_floor', 2);
  const map = makeMap([back, front]);
  // A point covered by a box of each column.
  let p = null;
  for (const fb of treeBoxes(front, index)) {
    for (let x = Math.ceil(fb.x); x < fb.x + fb.w && !p; x++) {
      for (let y = Math.ceil(fb.y); y < fb.y + fb.h && !p; y++) {
        if (treeBoxes(back, index).some(b => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h)) p = { x, y };
      }
    }
  }
  ok(p, 'the two woods\u2019 canopies overlap somewhere');
  const hit = treeAt(p.x, p.y, map, { q: 0, r: 0 }, index);
  eq(hit && { q: hit.q, r: hit.r }, { q: 0, r: 1 }, 'front column drawn on top wins');
});

test('a baked wood: the whole top face is tree art', () => {
  const col = wood(0, 0, 'oak_wood', 4, { sprite: 'Tiles_DecorOak', frame: 0 });
  const map = makeMap([col]);
  const hit = treeAt(16, 28, map, { q: 0, r: 0 }, index);
  eq(hit && { q: hit.q, r: hit.r, kind: hit.kind }, { q: 0, r: 0, kind: 'tree' }, 'centre of a baked wood is the tree');
});

test('a baked wood: headroom is tree only where the sheet is opaque', () => {
  const col = wood(0, 0, 'oak_wood', 4, { sprite: 'Tiles_DecorOak', frame: 0 });
  const map = makeMap([col]);
  // (16, 8) sits in the headroom band above the top face.
  const opaque = { headroom: () => true };
  const clear = { headroom: () => false };
  eq(treeAt(16, 8, map, { q: 0, r: 0 }, index, opaque) && { q: 0, r: 0 }, { q: 0, r: 0 }, 'opaque canopy pixel is the tree');
  eq(treeAt(16, 8, map, { q: 0, r: 0 }, index, clear), null, 'a gap in the canopy shows the tile behind');
});

test('sprite alpha masks can veto a bounding-box hit', () => {
  const col = wood(0, 0, 'forest_floor', 2);
  const map = makeMap([col]);
  const b = treeBoxes(col, index)[0];
  const px = b.x + Math.floor(b.w / 2), py = b.y + Math.floor(b.h / 2);
  const veto = { sprite: () => false };
  eq(treeAt(px, py, map, { q: 0, r: 0 }, index, veto), null, 'transparent corner of the box is not the tree');
});

test('a felled wood has nothing to click', () => {
  const col = wood(0, 0, 'forest_floor', 0);
  const map = makeMap([col]);
  eq(treeAt(16, 28, map, { q: 0, r: 0 }, index), null, 'no trees left, no tree');
});

test('treeBoxes agree with placeTrees and the sprite index', () => {
  const col = wood(3, 5, 'pine_floor', 4);
  const boxes = treeBoxes(col, index);
  ok(boxes.length === 4, 'four trees drawn for four remaining');
  for (const b of boxes) {
    const s = index.sprites[b.name];
    ok(s, `sprite ${b.name} exists in the index`);
    ok(b.w === s.w && b.h === s.h, 'box size is the sprite size');
  }
});

// ---------------------------------------------------------------- integration
// resolveClick is the whole click decision; these run it against a real
// generated world (columns are generated per coordinate, so any seed gives
// the same columns).

const world = generateWorld(1);
const knownState = { mind: { known: { '-5,-20': true } } };

/** The same map, with one column's trees felled. */
function worldWithoutTrees(q, r) {
  const m = world.get(q, r);
  const cols = new Map([...world.columns].map(([k, c]) => k === `${q},${r}` ? [k, { ...c, feature: null }] : [k, c]));
  return { seed: world.seed, spawn: world.spawn, get: (a, b) => cols.get(`${a},${b}`) || null };
}

test('resolveClick: a front canopy beats the node standing under it', () => {
  // In this world (-5,-20) is a pine_wood with a branch at (dx -9, dy 6), and
  // the pine_floor in front of it (-5,-19) draws a tree whose box covers the
  // branch. The branch is claimable (the hex is known), but the canopy is on
  // top of it.
  const back = world.get(-5, -20);
  const front = world.get(-5, -19);
  ok(back?.feature?.type === 'trees' && front?.feature?.type === 'trees',
    'the test columns are both woods in this world');
  const { cx, cy } = tileCenter(back.q, back.r, back.h);
  const px = cx - 9, py = cy + 4; // the branch, as nodeNear considers it
  ok(treeBoxes(front, index).some(b => px >= b.x && px < b.x + b.w && py >= b.y && py < b.y + b.h),
    'the front canopy actually covers the branch');
  const hit = resolveClick(px, py, world, knownState, { q: -5, r: -20 }, index);
  eq(hit && { kind: hit.kind, q: hit.q, r: hit.r }, { kind: 'tree', q: -5, r: -19 },
    'the tree drawn on top wins over the branch under it');
});

test('resolveClick: with the canopy gone, the node under it is clickable again', () => {
  const back = world.get(-5, -20);
  const { cx, cy } = tileCenter(back.q, back.r, back.h);
  const px = cx - 9, py = cy + 4;
  const hit = resolveClick(px, py, worldWithoutTrees(-5, -19), knownState, { q: -5, r: -20 }, index);
  eq(hit && { kind: hit.kind, q: hit.q, r: hit.r }, { kind: 'branch', q: -5, r: -20 },
    'the branch is what you see and click');
});

test('resolveClick: open ground inside the old radius-13 circle is not a tree', () => {
  // (1,-26) draws one small oak. (42, -589) lies on its top face, 5px from the
  // old circle centre — the old code called it a tree. No drawn art covers it
  // (no box of its own or a neighbour's, no baked-wood headroom band), so the
  // tile is what gets clicked.
  const col = world.get(1, -26);
  ok(col?.feature?.type === 'trees' && col.feature.remaining === 1, 'the test column has one tree');
  const { cx, cy } = tileCenter(col.q, col.r, col.h);
  ok(pointInHex(42, -589, cx, cy), 'point is on the top face');
  ok(Math.hypot(42 - cx, -589 - (cy - 10)) <= 13, 'point is inside the old radius-13 circle');
  const nb = [col, ...neighbors(col.q, col.r).map(n => world.get(n.q, n.r)).filter(Boolean)];
  ok(!nb.flatMap(n => treeBoxes(n, index)).some(b => 42 >= b.x && 42 < b.x + b.w && -589 >= b.y && -589 < b.y + b.h),
    'no drawn sprite covers the point');
  eq(resolveClick(42, -589, world, knownState, { q: 1, r: -26 }, index), null,
    'open space targets the tile, not the tree');
});

run('pick — fine-grained click targeting');
