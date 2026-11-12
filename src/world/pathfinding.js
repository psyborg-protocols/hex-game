// pathfinding.js
// A* across columns.
//
// The movement rules are what make the terrain a puzzle rather than a backdrop:
//
//   climb at most 1 level    — a 2-high face is a wall until you mine or ladder it
//   drop at most 2 levels    — you can jump down a bank, not off a cliff
//   never enter water        — unless a bridge spans it, or you carry a boat
//
// Raiders walk by looser rules: they climb and drop further, and float across
// water on rafts (slowly). What stops them is walls.

import { neighbors, distance, columnKey } from './hexgrid.js';
import { isWater } from './tileset.js';

export const MAX_CLIMB = 1;
export const MAX_DROP = 2;

/** A boat can land on a bank this high above the water. */
export const BOAT_LANDING = 3;

/**
 * Can a walker step from one column to an adjacent one?
 * @param opts {{boat?:boolean, raider?:boolean, breakWalls?:boolean}}
 */
export function canStep(map, from, to, opts = {}) {
  const a = map.get(from.q, from.r);
  const b = map.get(to.q, to.r);
  if (!a || !b) return false;

  if (opts.raider) {
    if (b.feature?.wall && !opts.breakWalls) return false;
    const climb = b.h - a.h;
    return climb <= 2 && -climb <= 3;
  }

  // A ladder joins its two ends whatever the drop between them.
  if (findLadder(map, from, to)) return true;

  const onBridgeA = isBridged(map, from);
  const onBridgeB = isBridged(map, to);
  const wetA = isWater(a.terrain) && !onBridgeA;
  const wetB = isWater(b.terrain) && !onBridgeB;

  if (opts.boat) {
    if (wetA && wetB) return true;
    // Landing: a boat noses up to any bank that is not a cliff.
    if (wetA && !wetB) return b.h - a.h <= BOAT_LANDING;
    if (!wetA && wetB) return true;
  } else if (wetA || wetB) {
    return false;
  }

  // A bridge deck is level with itself and with the banks it lands on.
  if (onBridgeA || onBridgeB) return true;

  const climb = b.h - a.h;
  return climb <= MAX_CLIMB && -climb <= MAX_DROP;
}

function findLadder(map, from, to) {
  return map.structures.find(s => s.type === 'ladder' && (
    (s.from.q === from.q && s.from.r === from.r && s.to.q === to.q && s.to.r === to.r) ||
    (s.to.q === from.q && s.to.r === from.r && s.from.q === to.q && s.from.r === to.r)));
}

export function isBridged(map, at) {
  return map.structures.some(s => s.type === 'bridge'
    && s.tiles.some(t => t.q === at.q && t.r === at.r));
}

/**
 * Shortest walkable route between two columns.
 * @returns {Array<{q,r}>|null} including both ends, or null if there is no way.
 */
export function findPath(map, from, to, opts = {}) {
  if (from.q === to.q && from.r === to.r) return [];
  const goal = map.get(to.q, to.r);
  if (!goal) return null;

  const open = new MinHeap();
  const best = new Map();
  const cameFrom = new Map();
  const startKey = columnKey(from.q, from.r);
  const goalKey = columnKey(to.q, to.r);
  const limit = opts.limit ?? 6000;

  best.set(startKey, 0);
  open.push({ q: from.q, r: from.r, g: 0, f: distance(from.q, from.r, to.q, to.r) });

  let expanded = 0;
  while (open.size) {
    const cur = open.pop();
    const curKey = columnKey(cur.q, cur.r);
    if (cur.g > (best.get(curKey) ?? Infinity)) continue;
    if (curKey === goalKey) return rebuild(cameFrom, from, to);
    if (++expanded > limit) return null;

    for (const n of neighbors(cur.q, cur.r)) {
      if (!canStep(map, cur, n, opts)) continue;
      const nKey = columnKey(n.q, n.r);
      const g = cur.g + stepCost(map, cur, n, opts);
      if (g >= (best.get(nKey) ?? Infinity)) continue;
      best.set(nKey, g);
      cameFrom.set(nKey, curKey);
      open.push({ q: n.q, r: n.r, g, f: g + distance(n.q, n.r, to.q, to.r) });
    }
  }
  return null;
}

/** Climbing costs more than walking, rowing more again, and roads less. */
function stepCost(map, from, to, opts) {
  const a = map.get(from.q, from.r);
  const b = map.get(to.q, to.r);
  let c = 1 + Math.abs(b.h - a.h) * 0.4;
  if (isWater(b.terrain) && !isBridged(map, to)) c += opts.raider ? 3 : 1;
  if (b.feature?.wall) c += 14;     // only reachable with breakWalls
  if (b.terrain === 'path') c -= 0.3;
  return c;
}

function rebuild(cameFrom, from, to) {
  const path = [];
  let key = columnKey(to.q, to.r);
  const startKey = columnKey(from.q, from.r);
  while (key !== startKey) {
    const [q, r] = key.split(',').map(Number);
    path.push({ q, r });
    key = cameFrom.get(key);
    if (key === undefined) return null;
  }
  path.push({ q: from.q, r: from.r });
  return path.reverse();
}

/** All columns within `budget` steps. */
export function reachableWithin(map, from, budget, opts = {}) {
  const seen = new Map([[columnKey(from.q, from.r), 0]]);
  const queue = [{ ...from, d: 0 }];
  while (queue.length) {
    const cur = queue.shift();
    if (cur.d >= budget) continue;
    for (const n of neighbors(cur.q, cur.r)) {
      const k = columnKey(n.q, n.r);
      if (seen.has(k) || !canStep(map, cur, n, opts)) continue;
      seen.set(k, cur.d + 1);
      queue.push({ ...n, d: cur.d + 1 });
    }
  }
  return seen;
}

// ---------------------------------------------------------------- heap

class MinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }

  push(item) {
    const a = this.items;
    a.push(item);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }

  pop() {
    const a = this.items;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let small = i;
        if (l < a.length && a[l].f < a[small].f) small = l;
        if (r < a.length && a[r].f < a[small].f) small = r;
        if (small === i) break;
        [a[small], a[i]] = [a[i], a[small]];
        i = small;
      }
    }
    return top;
  }
}
