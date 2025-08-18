// pathfinding.js
import { DIRECTIONS } from './constants.js';

export function findPath(world, player, q1, r1) {
  const q0 = player.q, r0 = player.r;
  if (q0 === q1 && r0 === r1) return [];

  const heuristic = (q, r) => {
    const dq = Math.abs(q - q1), dr = Math.abs(r - r1), dSum = Math.abs(dq + dr);
    return Math.max(dq, dr, dSum);
  };

  const open = [];
  const openMap = new Map();
  const closed = new Set();
  const start = { q: q0, r: r0, g: 0, f: heuristic(q0, r0), parent: null };

  open.push(start);
  openMap.set(`${q0},${r0}`, start);

  // This helper now includes logic for ladders and bridges
  const canTraverse = (fromQ, fromR, toQ, toR) => {
    if (!world.isInside(toQ, toR)) return false;

    // First, check for special structures that override normal movement rules
    const structure = world.getStructure(toQ, toR) || world.getStructure(fromQ, fromR);
    if (structure) {
        if (structure.type === 'ladder') {
            const { from, to } = structure;
            // Check if moving between the ladder's start and end points
            if ((from.q === fromQ && from.r === fromR && to.q === toQ && to.r === toR) ||
                (to.q === fromQ && to.r === fromR && from.q === toQ && from.r === toR)) {
                return true;
            }
        }
        if (structure.type === 'bridge') {
             // Check if moving between any two connected points of a bridge
             const fromIsOnBridge = world.getStructure(fromQ, fromR)?.type === 'bridge';
             const toIsOnBridge = world.getStructure(toQ, toR)?.type === 'bridge';
             if(fromIsOnBridge && toIsOnBridge) return true;
        }
    }
    
    // Standard height-based movement rules
    const ch = world.getHeight(fromQ, fromR);
    const th = world.getHeight(toQ, toR);

    if (th === -Infinity) return false; // Cannot step into water/voids without a bridge
    if (th - ch > 1) return false; // Cannot climb more than 1 unit
    if (ch - th > 2) return false; // Cannot drop more than 2 units

    return true;
  };

  while (open.length) {
    open.sort((a, b) => a.f - b.f);
    const cur = open.shift();
    const curKey = `${cur.q},${cur.r}`;
    
    openMap.delete(curKey);
    if (closed.has(curKey)) continue;
    closed.add(curKey);

    if (cur.q === q1 && cur.r === r1) {
      const path = [];
      let n = cur;
      while (n) { path.push({ q: n.q, r: n.r }); n = n.parent; }
      return path.reverse();
    }

    for (const d of DIRECTIONS) {
      const nq = cur.q + d.dq;
      const nr = cur.r + d.dr;
      const nKey = `${nq},${nr}`;

      if (closed.has(nKey)) continue;
      if (!canTraverse(cur.q, cur.r, nq, nr)) continue;
      
      const g = cur.g + 1;
      const f = g + heuristic(nq, nr);
      
      const prev = openMap.get(nKey);
      if (!prev || g < prev.g) {
        const node = { q: nq, r: nr, g, f, parent: cur };
        openMap.set(nKey, node);
        open.push(node);
      }
    }
  }
  return null; // No path found
}