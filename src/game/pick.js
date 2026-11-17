// pick.js
// Fine-grained click targeting for things that stand on tiles.
//
// The rule: a click targets what is *drawn* at the pointer, in draw order. A
// tree's art is bigger than its hex — the canopy overhangs into the tiles
// around it — so "which hex is under the pointer" (pickHex) is not the answer
// to "what did I click". The answer is: every tree whose drawn art covers the
// point is a candidate, and when two cover it the one drawn on top wins.
//
// This module is pure — no canvas, no DOM — so the picking rules are unit-
// testable in node. The masks it asks about come from render/masks.js in the
// browser; passing none degrades to bounding-box tests, which are still far
// tighter than a circle of guesswork.

import { tileCenter, pointInHex, neighbors, columnBaseY, compareDrawOrder } from '../world/hexgrid.js';
import { treeBoxes } from '../render/decor.js';
import { nodeNear } from './nodes.js';
import { isKnown } from './discovery.js';

/** Terrains whose trees are baked into the tile sheet itself. */
const BAKED_WOODS = new Set(['oak_wood', 'pine_wood']);

/**
 * Which drawn tree, if any, stands at world point (px, py)?
 *
 * @param {number} px, py  world-space point (1x pixels).
 * @param {WorldMap} map   the map; only `get` is used.
 * @param {{q,r}} hex      the column pickHex answered for this point. Trees can
 *   only overhang one tile, so it and its six neighbours are the whole
 *   candidate set.
 * @param {object} decorIndex  decor/index.json — the sprite boxes.
 * @param {?{sprite:Function, headroom:Function}} masks  per-pixel alpha tests,
 *   `fn(x, y) -> true | false | null` (null = no mask built; treated as opaque).
 * @returns {?{kind:'tree', harvest:string, q:number, r:number, dx:number, dy:number, ready:boolean, variant:number}}
 */
export function treeAt(px, py, map, hex, decorIndex, masks = null) {
  const candidates = [];

  for (const n of [hex, ...neighbors(hex.q, hex.r)]) {
    const col = map.get(n.q, n.r);
    if (!col || col.feature?.type !== 'trees' || !(col.feature.remaining > 0)) continue;
    const { cx, cy } = tileCenter(col.q, col.r, col.h);

    if (BAKED_WOODS.has(col.terrain)) {
      // The whole top face is forest art, and the canopy keeps going up into
      // the headroom band above it — where the sheet's own alpha decides what
      // is tree and what is the tile behind showing through.
      if (pointInHex(px, py, cx, cy)) {
        candidates.push({ col, dy: 0 });
      } else if (py >= cy - 28 && py < cy - 12 && Math.abs(px - cx) <= 16) {
        const m = masks?.headroom?.(col.sprite, col.frame,
          Math.floor(px - (cx - 16)), Math.floor(py - (cy - 28)));
        if (m !== false) candidates.push({ col, dy: 0 });
      }
    } else {
      // Composited trees: the drawn sprite box is the hit region.
      for (const b of treeBoxes(col, decorIndex)) {
        if (px < b.x || px >= b.x + b.w || py < b.y || py >= b.y + b.h) continue;
        const m = masks?.sprite?.(b.name, Math.floor(px - b.x), Math.floor(py - b.y));
        if (m !== false) candidates.push({ col, dy: b.dy });
      }
    }
  }

  // Front-most drawn wins: the renderer sorts columns by ground line, then q,
  // and trees within a column by spot — so that is the tie-break.
  candidates.sort((a, b) =>
    (columnBaseY(a.col.q, a.col.r) - columnBaseY(b.col.q, b.col.r))
    || (a.col.q - b.col.q)
    || (a.dy - b.dy));

  const top = candidates[candidates.length - 1];
  if (!top) return null;
  return { kind: 'tree', harvest: 'fell_tree', q: top.col.q, r: top.col.r, dx: 0, dy: -6, ready: true, variant: 0 };
}

/**
 * What does a click on `hex` at world point (px, py) target?
 *
 * The whole decision in one place, so it can be tested without a browser:
 *   - a tree drawn on top of the clicked column beats what stands on it;
 *   - otherwise the clicked column's own node (rock, reed, ore…) wins —
 *     including over a canopy that only reaches *behind* it;
 *   - a "direct" tree from nodeNear's radius test only counts where the
 *     drawn art actually covers the pointer.
 * Returns null for nothing clickable (the tile itself is then the target).
 */
export function resolveClick(px, py, map, state, hex, decorIndex, masks = null, t = 0) {
  const col = map.get(hex.q, hex.r);
  let direct = null;
  if (col) {
    const { cx, cy } = tileCenter(col.q, col.r, col.h);
    direct = nodeNear(map, state, col, px - cx, py - cy, t);
  }

  const tree = treeAt(px, py, map, hex, decorIndex, masks);
  if (direct?.kind === 'tree' && !tree) direct = null;
  if (tree && col && compareDrawOrder(map.get(tree.q, tree.r), col) > 0) {
    return tree;
  }
  if (direct && (direct.kind === 'tree' || direct.kind === 'field' || isKnown(state, direct.q, direct.r))) {
    return direct;
  }
  if (col?.feature?.type === 'ore' && col.feature.known && col.feature.remaining > 0) {
    const { cx, cy } = tileCenter(col.q, col.r, col.h);
    if (Math.hypot(px - cx, py - (cy - 1)) <= 8) {
      return { kind: 'ore', harvest: 'mine_ore', q: col.q, r: col.r, dx: 0, dy: -1, ready: true };
    }
  }
  if (tree) return tree;
  return null;
}
