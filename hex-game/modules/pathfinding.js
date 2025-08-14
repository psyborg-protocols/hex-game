// pathfinding.js
import { DIRECTIONS } from './constants.js';
export function findPath(world, player, q1, r1) {
  const q0 = player.q, r0 = player.r;
  if (q0 === q1 && r0 === r1) return [];
  const heuristic = (q, r) => {
    const dq = Math.abs(q - q1), dr = Math.abs(r - r1), dSum = Math.abs(dq + dr);
    return Math.max(dq, dr, dSum);
  };
  const open = []; const openMap = new Map(); const closed = new Set();
  const start = { q:q0, r:r0, g:0, f:heuristic(q0,r0), parent:null };
  open.push(start); openMap.set(`${q0},${r0}`, start);
  const canStep = (fromQ, fromR, toQ, toR) => {
    if (!world.isInside(toQ, toR)) return false;
    const ch = world.getHeight(fromQ, fromR), th = world.getHeight(toQ, toR);
    if (th === -Infinity) return false;
    if (th - ch > 1) return false;
    if (ch - th > 2) return false;
    return true;
  };
  while (open.length) {
    open.sort((a,b)=>a.f-b.f);
    const cur = open.shift();
    openMap.delete(`${cur.q},${cur.r}`);
    const key = `${cur.q},${cur.r}`;
    if (closed.has(key)) continue;
    closed.add(key);
    if (cur.q === q1 && cur.r === r1) {
      const path = [];
      let n = cur;
      while (n) { path.push({ q:n.q, r:n.r }); n = n.parent; }
      return path.reverse();
    }
    for (const d of DIRECTIONS) {
      const nq = cur.q + d.dq, nr = cur.r + d.dr;
      if (!canStep(cur.q, cur.r, nq, nr)) continue;
      const nKey = `${nq},${nr}`;
      if (closed.has(nKey)) continue;
      const g = cur.g + 1, f = g + heuristic(nq, nr);
      const prev = openMap.get(nKey);
      if (!prev || g < prev.g) {
        const node = { q:nq, r:nr, g, f, parent:cur };
        openMap.set(nKey, node);
        open.push(node);
      }
    }
  }
  return null;
}
