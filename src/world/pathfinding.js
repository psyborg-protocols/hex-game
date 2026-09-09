// pathfinding.js
// A* across columns.
//
// The movement rules are carried over from the old game and are what make the
// terrain a puzzle rather than a backdrop:
//
//   climb at most 1 level    — a 3-high face is a wall until you mine or ladder it
//   drop at most 2 levels    — you can jump down a bank, not off a cliff
//   never enter water        — unless a bridge spans it
//
// Ladders and bridges are the sanctioned exceptions, and they are the redundancy
// pair skill_map.md calls for: a river is crossed by a bridge (woodworking 6) or
// a boat (woodworking 5), and a cliff is climbed by a ladder (woodworking 4) or
// mined away (stoneworking).

import { neighbors, distance, columnKey } from './hexgrid.js';
import { isWater } from './tileset.js';

export const MAX_CLIMB = 1;
export const MAX_DROP = 2;

/**
 * Can the player step from one column to an adjacent one?
 * Exported because the context system and the generator ask the same question.
 */
export function canStep(map, from, to) {
  const a = map.get(from.q, from.r);
  const b = map.get(to.q, to.r);
  if (!a || !b) return false;

  // A ladder joins its two ends whatever the drop between them.
  const ladder = findLadder(map, from, to);
  if (ladder) return true;

  const onBridgeA = isBridged(map, from);
  const onBridgeB = isBridged(map, to);

  if (isWater(b.terrain) && !onBridgeB) return false;
  // Stepping off a bridge back onto its own water is not a move.
  if (isWater(a.terrain) && !onBridgeA) return false;
  // A bridge deck is level with itself and with the banks it lands on.
  if (onBridgeA && onBridgeB) return true;

  const climb = b.h - a.h;
  return climb <= MAX_CLIMB && -climb <= MAX_DROP;
}

function findLadder(map, from, to) {
  return map.structures.find(s => s.type === 'ladder' && (
    (s.from.q === from.q && s.from.r === from.r && s.to.q === to.q && s.to.r === to.r) ||
    (s.to.q === from.q && s.to.r === from.r && s.from.q === to.q && s.from.r === to.r)));
}

function isBridged(map, at) {
  return map.structures.some(s => s.type === 'bridge'
    && s.tiles.some(t => t.q === at.q && t.r === at.r));
}

/**
 * Shortest walkable route between two columns.
 * @returns {Array<{q,r}>|null} including both ends, or null if there is no way.
 */
export function findPath(map, from, to) {
  if (from.q === to.q && from.r === to.r) return [];
  const goal = map.get(to.q, to.r);
  if (!goal) return null;

  const open = new MinHeap();
  const best = new Map();      // key -> g
  const cameFrom = new Map();
  const startKey = columnKey(from.q, from.r);
  const goalKey = columnKey(to.q, to.r);

  best.set(startKey, 0);
  open.push({ q: from.q, r: from.r, g: 0, f: distance(from.q, from.r, to.q, to.r) });

  while (open.size) {
    const cur = open.pop();
    const curKey = columnKey(cur.q, cur.r);
    if (cur.g > (best.get(curKey) ?? Infinity)) continue;   // a stale entry

    if (curKey === goalKey) return rebuild(cameFrom, from, to);

    for (const n of neighbors(cur.q, cur.r)) {
      if (!canStep(map, cur, n)) continue;
      const nKey = columnKey(n.q, n.r);
      const g = cur.g + stepCost(map, cur, n);
      if (g >= (best.get(nKey) ?? Infinity)) continue;

      best.set(nKey, g);
      cameFrom.set(nKey, curKey);
      open.push({ q: n.q, r: n.r, g, f: g + distance(n.q, n.r, to.q, to.r) });
    }
  }
  return null;
}

/** Climbing costs more than walking, so routes prefer the gentle way round. */
function stepCost(map, from, to) {
  const a = map.get(from.q, from.r);
  const b = map.get(to.q, to.r);
  const climb = Math.abs(b.h - a.h);
  return 1 + climb * 0.4;
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

/** All columns within `budget` steps — what the context system highlights. */
export function reachableWithin(map, from, budget) {
  const seen = new Map([[columnKey(from.q, from.r), 0]]);
  const queue = [{ ...from, d: 0 }];
  while (queue.length) {
    const cur = queue.shift();
    if (cur.d >= budget) continue;
    for (const n of neighbors(cur.q, cur.r)) {
      const k = columnKey(n.q, n.r);
      if (seen.has(k) || !canStep(map, cur, n)) continue;
      seen.set(k, cur.d + 1);
      queue.push({ ...n, d: cur.d + 1 });
    }
  }
  return seen;
}

// ---------------------------------------------------------------- heap

/** Binary min-heap on `f`. A sorted array would re-sort the frontier every pop. */
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
