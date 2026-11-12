// harvests.js
// What the world gives you, and where.
//
// Raw materials come from the ground, never from a recipe. This table binds each
// harvest to terrain, a skill, an optional tool and an energy cost, and it is the
// one place that decides what a hex is worth walking to.

import { TERRAIN } from '../world/tileset.js';
import { neighbors } from '../world/hexgrid.js';
import { countItem } from './inventory.js';
import { levelOf } from './skills.js';
import { isFree } from './state.js';

/** Terrain groups the harvest table refers to. */
const OPEN = ['meadow', 'grass', 'steppes'];
const WOODED = ['oak_wood', 'pine_wood'];
const FOREST = ['forest_floor', 'pine_floor'];
const ROCKY = ['stony', 'steppes'];

const on = (...ids) => col => ids.includes(col.terrain);
const beside = pred => (col, map) =>
  neighbors(col.q, col.r).some(n => {
    const other = map.get(n.q, n.r);
    return other && pred(other);
  });
const water = col => !!TERRAIN[col.terrain]?.water;
const lowBank = (col, map) => col.h <= 2 && beside(water)(col, map);

/**
 * A harvest is:
 *   where    (column, map) => boolean — is this the right ground?
 *   tool     optional any-of list; one of them must be carried
 *   yields   what you get, as { item: [min, max] }
 *   bonus    extra yields when you carry something: { tool: { item: [min,max] } }
 *   energy   what the work costs
 *   depletes what it uses up on the hex
 */
export const HARVESTS = {
  forage: {
    id: 'forage', name: 'Forage', skill: 'homesteading', level: 1, xp: 1, energy: 0, regrows: 75,
    where: on(...OPEN, ...FOREST, ...WOODED),
    yields: { berries: [2, 4] },
    // Wild grain grows in the open, which is how a first field gets its seed.
    bonusWhere: { grain: col => ['meadow', 'grass'].includes(col.terrain) },
    bonusYields: { grain: [0, 2] },
    bonus: { dog: { berries: [1, 1] } },
    verb: 'Foraging',
  },
  find_herb: {
    id: 'find_herb', name: 'Pick Herbs', skill: 'mind', level: 1, xp: 0, energy: 0.5, regrows: 90,
    where: on(...OPEN, ...FOREST, ...WOODED),
    yields: { herb: [1, 2] },
    verb: 'Searching',
  },
  gather_branch: {
    id: 'gather_branch', name: 'Gather Branches', skill: 'woodworking', level: 1, xp: 1, energy: 0.5,
    where: on(...WOODED, ...FOREST, 'meadow'),
    yields: { branch: [2, 3] },
    verb: 'Gathering',
  },
  fell_tree: {
    id: 'fell_tree', name: 'Fell a Tree', skill: 'woodworking', level: 1, xp: 3, energy: 1,
    where: col => col.feature?.type === 'trees' && (col.feature.remaining ?? 0) > 0,
    tool: ['iron_axe', 'stone_axe'],
    yields: { log: [1, 1] },
    bonus: { iron_axe: { log: [1, 1] } },
    depletes: 'trees',
    verb: 'Chopping',
  },
  cut_reeds: {
    id: 'cut_reeds', name: 'Cut Reeds', skill: 'woodworking', level: 1, xp: 1, energy: 0.5,
    where: lowBank,
    yields: { reed: [2, 3] },
    verb: 'Cutting',
  },
  dig_clay: {
    id: 'dig_clay', name: 'Dig Clay', skill: 'homesteading', level: 1, xp: 2, energy: 0.5,
    where: lowBank,
    yields: { clay: [1, 2] },
    verb: 'Digging',
  },
  gather_stone: {
    id: 'gather_stone', name: 'Gather Stone', skill: 'stoneworking', level: 1, xp: 1, energy: 0.5,
    where: (col, map) => ROCKY.includes(col.terrain) || beside(o => o.h - col.h >= 1)(col, map),
    yields: { stone: [2, 2] },
    verb: 'Gathering',
  },
  gather_flint: {
    id: 'gather_flint', name: 'Pick Flint', skill: 'stoneworking', level: 1, xp: 2, energy: 0.5,
    where: on(...ROCKY),
    yields: { flint: [1, 2] },
    verb: 'Searching',
  },
  hunt: {
    id: 'hunt', name: 'Hunt', skill: 'homesteading', level: 1, xp: 3, energy: 1, regrows: 45,
    where: on(...OPEN, ...WOODED, ...FOREST),
    // A snare costs a cord; a bow is not spent. Handled in actions.js.
    tool: ['bow', 'cord'],
    yields: { meat: [1, 1] },
    bonus: { bow: { meat: [1, 1] }, stone_knife: { hide: [1, 1] }, dog: { meat: [0, 1] } },
    verb: 'Hunting',
  },
  fish: {
    id: 'fish', name: 'Fish', skill: 'homesteading', level: 1, xp: 2, energy: 0.5, regrows: 30,
    where: (col, map) => beside(water)(col, map),
    tool: ['fishing_rod'],
    yields: { fish: [1, 2] },
    verb: 'Fishing',
  },
  harvest_field: {
    id: 'harvest_field', name: 'Reap the Field', skill: 'homesteading', level: 1, xp: 5, energy: 1,
    where: col => col.feature?.type === 'field' && col.feature.ripe,
    yields: { grain: [4, 6] },
    depletes: 'field',
    verb: 'Reaping',
  },
  mine_cliff: {
    id: 'mine_cliff', name: 'Mine the Face', skill: 'stoneworking', level: 1, xp: 3, energy: 1.5,
    tool: ['pickaxe', 'stone_hammer'],
    // A face you cannot climb is a face you can cut down.
    where: (col, map) => beside(o => o.h - col.h >= 2)(col, map),
    yields: { stone: [2, 3], flint: [0, 1] },
    bonus: { pickaxe: { stone: [2, 2] } },
    lowersCliff: true,
    verb: 'Mining',
  },
  mine_ore: {
    id: 'mine_ore', name: 'Mine Ore', skill: 'metalworking', level: 1, xp: 5, energy: 1.5,
    tool: ['pickaxe', 'stone_hammer'],
    // The vein has to have been found first — the Lore knowledge gate.
    where: (col, map) => nearbyOre(map, col) !== null,
    yields: { ore: [1, 1] },
    bonus: { pickaxe: { ore: [2, 2] } },
    depletes: 'ore',
    verb: 'Mining',
  },
};

/** A known ore vein on this hex or one next to it. */
export function nearbyOre(map, col) {
  const isVein = c => c?.feature?.type === 'ore' && c.feature.known && c.feature.remaining > 0;
  if (isVein(col)) return col;
  for (const n of neighbors(col.q, col.r)) {
    const other = map.get(n.q, n.r);
    if (isVein(other)) return other;
  }
  return null;
}

/** The adjacent column a cliff harvest would cut into: the tallest face. */
export function cliffTarget(map, col) {
  let best = null;
  for (const n of neighbors(col.q, col.r)) {
    const other = map.get(n.q, n.r);
    if (!other || other.h - col.h < 2) continue;
    if (!best || other.h > best.h) best = other;
  }
  return best;
}

/**
 * Some ground needs time to recover: a bush picked bare, game spooked off, fish
 * gone quiet. Without this, one berry hex fed you forever and nothing ever made
 * you move on.
 */
const REGROW_TEXT = { forage: 'Picked clean', find_herb: 'Picked clean', hunt: 'The game has fled', fish: 'The fish have gone quiet' };
const pickKey = (col, id) => `${col.q},${col.r}:${id}`;
export const regrowsAt = (state, col, id) => state.picked?.[pickKey(col, id)] ?? -1;
export function markPicked(state, col, id) {
  const spec = HARVESTS[id];
  if (!spec?.regrows) return;
  state.picked ||= {};
  state.picked[pickKey(col, id)] = (state.time || 0) + spec.regrows;
}

export function harvestSpec(id) {
  const h = HARVESTS[id];
  if (!h) return null;
  return { energy: 1, xp: 1, level: 1, ...h };
}

/** Every harvest the player could start right here, with why-not for the rest. */
export function availableHarvests(map, state, at) {
  const col = map.get(at.q, at.r);
  if (!col) return [];

  const out = [];
  for (const id of Object.keys(HARVESTS)) {
    const spec = harvestSpec(id);
    if (!spec.where(col, map)) continue;

    const reasons = [];
    if (isFree(state)) { out.push({ spec, ok: true, reasons, col }); continue; }

    if (levelOf(state, spec.skill) < spec.level) {
      reasons.push(`Needs ${spec.skill} level ${spec.level}.`);
    }
    if (spec.tool && !spec.tool.some(t => countItem(state, t) > 0)) {
      reasons.push(`Needs ${spec.tool.map(t => t.replace(/_/g, ' ')).join(' or ')}.`);
    }
    const back = regrowsAt(state, col, id);
    if (back > (state.time || 0)) {
      reasons.push(`${REGROW_TEXT[id] || 'Spent'} — back in ${Math.ceil(back - state.time)}s.`);
    }
    out.push({ spec, ok: reasons.length === 0, reasons, col });
  }
  return out;
}
