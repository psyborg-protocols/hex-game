// context.js
// What you can do from where you are standing.
//
// The game does not open a menu of verbs; it floats the two or three that this
// hex actually affords over the hex itself.

import { neighbors } from '../world/hexgrid.js';
import { nearbyOre, cliffTarget } from './harvests.js';
import { harvestsHere } from './discovery.js';
import { levelOf } from './skills.js';
import { isTrusted } from './economy.js';

/** The first column on this hex or the next one over that passes `test`. */
function nearby(map, at, test) {
  for (const c of [{ q: at.q, r: at.r }, ...neighbors(at.q, at.r)]) {
    const col = map.get(c.q, c.r);
    if (col && test(col)) return col;
  }
  return null;
}

export const villageNear = (map, at) => nearby(map, at, c => c.feature?.type === 'village');
export const campNear = (map, at) => nearby(map, at, c => c.feature?.type === 'camp' && !c.feature.burned);
export const structureNear = (map, at, item) => nearby(map, at, c => c.feature?.type === 'structure' && c.feature.item === item);

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
 * Everything on offer at `at`. `extra.guardsLeft(col)` says how many raiders
 * still defend a camp; a camp can only be burned once they are gone.
 */
export function determineContext(world, state, at, extra = {}) {
  const { map } = world;
  const col = map.get(at.q, at.r);
  if (!col) return { offers: [], blocked: [], village: null };

  const harvests = harvestsHere(map, state, at);
  const village = villageNear(map, at);
  const camp = campNear(map, at);
  const hut = structureNear(map, at, 'hut');

  const offers = harvests.filter(h => h.ok).map(h => ({
    kind: 'harvest', id: h.spec.id, label: h.spec.name, verb: h.spec.verb, skill: h.spec.skill,
  }));

  if (['stony', 'steppes'].includes(col.terrain) && levelOf(state, 'mind') >= 3) {
    offers.push({ kind: 'prospect', id: 'prospect', label: 'Read the Rock', verb: 'Prospecting', skill: 'metalworking' });
  }

  if (village) {
    const trusted = isTrusted(state, village.q, village.r);
    offers.unshift({ kind: 'trade', id: 'trade', label: trusted ? `Trade at ${village.feature.name}` : `Visit ${village.feature.name}`, village, important: !trusted });
  }
  if (hut) offers.unshift({ kind: 'stash', id: 'stash', label: 'Open the Stash', hut });
  if (camp) {
    const guards = extra.guardsLeft ? extra.guardsLeft(camp) : 0;
    if (!guards) offers.unshift({ kind: 'burn', id: 'burn', label: `Burn ${camp.feature.name}`, camp, important: true });
  }

  return {
    offers,
    blocked: harvests.filter(h => !h.ok).map(h => ({ id: h.spec.id, label: h.spec.name, reasons: h.reasons })),
    village,
    camp,
    vein: nearbyOre(map, col),
    cliff: cliffTarget(map, col),
    column: col,
    structures: structuresNear(map, at),
  };
}
