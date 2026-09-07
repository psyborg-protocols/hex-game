// state.js
// The player's whole mutable state, and the vocabulary derived from
// data/game_data.js that the rest of the game asks about.

import { ITEMS, RECIPES, SKILL_INFO } from '../../data/game_data.js';

export { ITEMS, RECIPES, SKILL_INFO };

export const SKILLS = Object.keys(SKILL_INFO);
export const MAX_LEVEL = 7;
export const INVENTORY_SLOTS = 24;

/**
 * Items that are structures rather than carryable goods: anything a recipe with
 * category 'build' produces. A recipe that lists one of these as a *tool* means
 * "you must be working at one", not "you must be carrying one" — you do not put
 * a forge in your pocket.
 */
export const BUILDINGS = new Set(
  Object.values(RECIPES).filter(r => r.category === 'build')
    .flatMap(r => Object.keys(r.output)));

/** How close you have to be to a structure to work at it. */
export const BUILD_REACH = 1;

export const isBuilding = id => BUILDINGS.has(id);
export const itemName = id => ITEMS[id]?.name || id;

export function createState({ gold = 15, maxEnergy = 10, slots = INVENTORY_SLOTS } = {}) {
  return {
    inventory: new Array(slots).fill(null),
    gold,
    energy: 0,              // derived from carried food; see inventory.js
    maxEnergy,
    stepsWalked: 0,
    skills: Object.fromEntries(SKILLS.map(s => [s, { level: 1, xp: 0 }])),
    built: [],              // { item, q, r }
    prices: {},             // "q,r" of a village -> { itemId: price }
    log: [],                // recent events, newest last
  };
}

// ------------------------------------------------------------- structures

export function recordBuilt(state, item, q, r) {
  state.built.push({ item, q, r });
  return state.built[state.built.length - 1];
}

/** Does this structure exist anywhere in the world yet? What `needs` asks. */
export const hasBuilt = (state, item) => state.built.some(b => b.item === item);

/**
 * Is there one within reach of `at`? What a *tool* slot naming a structure asks.
 * Distance is measured by the caller, since only it knows the grid.
 */
export function builtNear(state, item, at, withinTiles, distanceFn) {
  if (!at) return false;
  return state.built.some(b => b.item === item
    && distanceFn(b.q, b.r, at.q, at.r) <= withinTiles);
}
