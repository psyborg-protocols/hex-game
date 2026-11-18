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
import { tileCenter, pointInHex, neighbors, distance, compareDrawOrder } from '../src/world/hexgrid.js';
import { nodesAt, nodeNear } from '../src/game/nodes.js';
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

// ------------------------------------------------------------- reach and sway

test('a canopy on a plateau reaches over a hex two rows back', () => {
  // The tree stands four levels up, so its art is drawn 32px higher than its
  // ground line and covers a point whose hex (by pickHex) is not even a neighbour.
  const tall = wood(0, 2, 'forest_floor', 2, { h: 4 });
  const map = makeMap([tall]);
  const b = treeBoxes(tall, index)[0];
  const p = { x: b.x + Math.floor(b.w / 2), y: b.y + 1 };
  const behind = { q: 0, r: 0 };
  ok(distance(behind.q, behind.r, 0, 2) >= 2, 'the hex under the pointer is not next to the tree');
  const hit = treeAt(p.x, p.y, map, behind, index);
  eq(hit && { q: hit.q, r: hit.r }, { q: 0, r: 2 }, 'the plateau tree is found anyway');
});

test('a canopy over open sky is still the tree', () => {
  const col = wood(0, 0, 'forest_floor', 2);
  const map = makeMap([col]);
  const b = treeBoxes(col, index)[0];
  const hit = resolveClick(b.x + Math.floor(b.w / 2), b.y + 1, map, {}, null, index);
  eq(hit && { q: hit.q, r: hit.r, kind: hit.kind }, { q: 0, r: 0, kind: 'tree' }, 'no hex under the pointer, but a tree is drawn there');
});

test('a shaken tree is hit where it is drawn, not where it stood', () => {
  const col = wood(0, 0, 'forest_floor', 2);
  const map = makeMap([col]);
  const boxes = treeBoxes(col, index);
  const right = boxes.reduce((a, b) => (b.x + b.w > a.x + a.w ? b : a));
  // One pixel past the rightmost edge of the still art...
  const p = { x: right.x + right.w, y: right.y + Math.floor(right.h / 2) };
  eq(treeAt(p.x, p.y, map, { q: 0, r: 0 }, index), null, 'clear of the tree when it is still');
  // ...is inside it while the renderer pushes it two pixels right.
  const hit = treeAt(p.x, p.y, map, { q: 0, r: 0 }, index, null, () => 2);
  eq(hit && { q: hit.q, r: hit.r }, { q: 0, r: 0 }, 'the swaying tree is under the pointer');
});

// ---------------------------------------------------------------- integration
// resolveClick is the whole click decision; these run it against real
// generated worlds. Each test searches for the situation it needs rather than
// naming coordinates, so a change to worldgen or tree placement moves the
// example instead of breaking the test.

const SEEDS = ['hexworld', 'alpha', 'beta', 'gamma', 'delta', 'epsilon'];
const worlds = SEEDS.map(seed => generateWorld({ seed }));

/** Every hex counts as known, so ground nodes are claimable. */
const knowAll = { time: 0, picked: {}, taken: {}, mind: { known: new Proxy({}, { get: () => true }) } };

/** The same map with one column's trees felled. */
function felled(map, q, r) {
  const view = Object.create(map);
  view.get = (a, b) => {
    const c = map.get(a, b);
    return c && a === q && b === r ? { ...c, feature: null } : c;
  };
  return view;
}

/**
 * Somewhere a front wood's drawn canopy covers a ground node on the column
 * behind it: the node is claimable, and the canopy is the only art over it.
 */
function canopyOverNode() {
  for (const map of worlds) {
    for (const back of map) {
      for (const n of nodesAt(map, knowAll, back)) {
        if (['tree', 'field', 'grain', 'game', 'bee'].includes(n.kind) || n.on) continue;
        const { cx, cy } = tileCenter(back.q, back.r, back.h);
        const p = { x: cx + n.dx, y: cy + n.dy - 2 };   // where nodeNear looks for it
        if (nodeNear(map, knowAll, back, p.x - cx, p.y - cy, 0)?.kind !== n.kind) continue;
        const tree = treeAt(p.x, p.y, map, back, index);
        if (!tree) continue;
        const front = map.get(tree.q, tree.r);
        if (compareDrawOrder(front, back) <= 0) continue;
        if (treeAt(p.x, p.y, felled(map, front.q, front.r), back, index)) continue;
        return { map, back, front, node: n, p };
      }
    }
  }
  return null;
}

test('resolveClick: a front canopy beats the node standing under it', () => {
  const found = canopyOverNode();
  ok(found, 'no canopy covers a ground node in any test world');
  const { map, back, front, p } = found;
  const hit = resolveClick(p.x, p.y, map, knowAll, back, index);
  eq(hit && { kind: hit.kind, q: hit.q, r: hit.r }, { kind: 'tree', q: front.q, r: front.r },
    'the tree drawn on top wins over the node under it');
});

test('resolveClick: with the canopy gone, the node under it is clickable again', () => {
  const { map, back, front, node, p } = canopyOverNode();
  const hit = resolveClick(p.x, p.y, felled(map, front.q, front.r), knowAll, back, index);
  eq(hit && { kind: hit.kind, q: hit.q, r: hit.r }, { kind: node.kind, q: back.q, r: back.r },
    'the node is what you see and click');
});

test('resolveClick: open ground inside the old radius-13 circle is not a tree', () => {
  // The old picker called anything within 13px of (cx, cy - 10) the tree.
  let found = null;
  for (const map of worlds) {
    for (const col of map) {
      if (found) break;
      if (col.feature?.type !== 'trees' || !['forest_floor', 'pine_floor'].includes(col.terrain)) continue;
      const { cx, cy } = tileCenter(col.q, col.r, col.h);
      for (let x = cx - 12; x <= cx + 12 && !found; x++) {
        for (let y = cy - 11; y <= cy + 11 && !found; y++) {
          if (!pointInHex(x, y, cx, cy) || Math.hypot(x - cx, y - (cy - 10)) > 13) continue;
          if (treeAt(x, y, map, col, index)) continue;
          const near = nodeNear(map, knowAll, col, x - cx, y - cy, 0);
          if (!near || near.kind !== 'tree') continue;   // the old radius test claimed it; nothing else is there
          found = { map, col, x, y };
        }
      }
    }
  }
  ok(found, 'no open ground inside the old circle in any test world');
  eq(resolveClick(found.x, found.y, found.map, knowAll, found.col, index), null,
    'open space targets the tile, not the tree');
});

run('pick — fine-grained click targeting');
