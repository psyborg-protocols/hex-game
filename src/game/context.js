// context.js
// What you can do from where you are standing.
//
// The old game anchored little buttons in the world for this and it was the best
// thing about its UI, so it survives: the game does not open a menu of verbs, it
// offers the two or three that this hex actually affords.

import { neighbors } from '../world/hexgrid.js';
import { availableHarvests, nearbyOre, cliffTarget } from './harvests.js';
import { levelOf } from './skills.js';

/** The village on this hex or the next one over, if any. */
export function villageNear(map, at) {
  for (const c of [{ q: at.q, r: at.r }, ...neighbors(at.q, at.r)]) {
    const col = map.get(c.q, c.r);
    if (col?.feature?.type === 'village') return col;
  }
  return null;
}

/** Structures within reach, so the crafting panel knows what you can work at. */
export function structuresNear(map, at) {
  const out = [];
  for (const c of [{ q: at.q, r: at.r }, ...neighbors(at.q, at.r)]) {
    const col = map.get(c.q, c.r);
    if (col?.feature?.type === 'structure') out.push(col);
  }
  return out;
}

/**
 * Everything on offer at `at`.
 *
 * `blocked` is deliberately returned alongside `offers`: knowing that this hex
 * *would* give you clay if you were a homesteader is the thing that tells you
 * where to come back to.
 */
export function determineContext(world, state, at) {
  const { map } = world;
  const col = map.get(at.q, at.r);
  if (!col) return { offers: [], blocked: [], village: null };

  const harvests = availableHarvests(map, state, at);
  const village = villageNear(map, at);
  const vein = nearbyOre(map, col);
  const cliff = cliffTarget(map, col);

  const offers = harvests.filter(h => h.ok).map(h => ({
    kind: 'harvest',
    id: h.spec.id,
    label: h.spec.name,
    verb: h.spec.verb,
    skill: h.spec.skill,
  }));

  // Prospecting is its own action rather than a harvest: it changes what you
  // know about the map instead of putting something in your pack.
  if (['stony', 'steppes'].includes(col.terrain) && levelOf(state, 'mind') >= 4) {
    offers.push({ kind: 'prospect', id: 'prospect', label: 'Read the Rock', verb: 'Prospecting', skill: 'metalworking' });
  }

  if (village) {
    offers.push({ kind: 'trade', id: 'trade', label: `Trade at ${village.feature.name}`, village });
  }

  return {
    offers,
    blocked: harvests.filter(h => !h.ok).map(h => ({ id: h.spec.id, label: h.spec.name, reasons: h.reasons })),
    village,
    vein,
    cliff,
    column: col,
    structures: structuresNear(map, at),
  };
}
