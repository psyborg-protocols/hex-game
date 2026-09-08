// harvests.js
// What the world gives you, and where.
//
// Ten raw materials — berries, seeds, grain, rabbit, fish, reed, clay, bone,
// hide, sinew — are inputs to recipes but the output of none, so they can only
// come from the ground. game_data.js also carries seven `gather: true` recipes
// (branches, stone, flint, logs, herbs, prospecting, ore) which have the skill,
// xp and tool gates but say nothing about *where*. This table is that missing
// half: it binds both kinds of harvest to terrain, and is the only place that
// decides what a hex is worth walking to.
//
// Each entry reads like a recipe on purpose, so the UI can show a harvest and a
// craft the same way.

import { TERRAIN } from '../world/tileset.js';
import { neighbors } from '../world/hexgrid.js';
import { RECIPES } from '../../data/game_data.js';
import { countItem } from './inventory.js';
import { levelOf } from './skills.js';

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

/**
 * A harvest is:
 *   where   (column, map) => boolean — is this the right ground?
 *   tool    optional any-of list; one of them must be carried
 *   yields  what you get, as { item: [min, max] }
 *   cost    items consumed, if any
 *   depletes  true if it eats the hex's feature (trees, ore)
 */
export const HARVESTS = {
  forage: {
    id: 'forage', name: 'Forage', skill: 'mind', level: 1, xp: 2,
    where: on(...OPEN, ...FOREST),
    yields: { berries: [1, 3], seeds: [0, 2] },
    verb: 'Foraging',
  },
  find_herb: {
    id: 'find_herb', recipe: 'find_herb',
    where: on(...OPEN, ...FOREST, ...WOODED),
    yields: { herb: [1, 1] },
    verb: 'Searching',
  },
  gather_branch: {
    id: 'gather_branch', recipe: 'gather_branch',
    where: on(...WOODED, ...FOREST, 'meadow'),
    yields: { branch: [2, 2] },
    verb: 'Gathering',
  },
  chop_rough_log: {
    id: 'chop_rough_log', recipe: 'chop_rough_log',
    // Wherever trees are standing, which is both the dense sheets and the bare
    // floors that grow their trees as decor props.
    where: col => col.feature?.type === 'trees' && (col.feature.remaining ?? 0) > 0,
    yields: { rough_log: [1, 1] },
    depletes: 'trees',
    verb: 'Chopping',
  },
  cut_reeds: {
    id: 'cut_reeds', name: 'Cut Reeds', skill: 'woodworking', level: 1, xp: 2,
    where: (col, map) => col.h <= 2 && beside(water)(col, map),
    yields: { reed: [2, 3] },
    verb: 'Cutting',
  },
  dig_clay: {
    id: 'dig_clay', name: 'Dig Clay', skill: 'homesteading', level: 1, xp: 2,
    where: (col, map) => col.h <= 2 && beside(water)(col, map),
    yields: { clay: [1, 2] },
    verb: 'Digging',
  },
  gather_stone: {
    id: 'gather_stone', recipe: 'gather_stone',
    where: (col, map) => ROCKY.includes(col.terrain) || beside(o => o.h - col.h >= 1)(col, map),
    yields: { stone: [2, 2] },
    verb: 'Quarrying',
  },
  gather_flint: {
    id: 'gather_flint', recipe: 'gather_flint',
    where: on(...ROCKY),
    yields: { flint: [1, 1] },
    verb: 'Searching',
  },
  set_snare: {
    id: 'set_snare', name: 'Set a Snare', skill: 'homesteading', level: 1, xp: 4,
    where: on(...OPEN, ...WOODED, ...FOREST),
    tool: ['cord', 'bow'],
    // A snare is spent; a bow is not. Handled in actions.js.
    yields: { rabbit: [1, 1], bone: [0, 2], hide: [0, 1], sinew: [0, 2] },
    verb: 'Waiting',
  },
  fish: {
    id: 'fish', name: 'Fish', skill: 'homesteading', level: 1, xp: 3,
    where: (col, map) => beside(water)(col, map),
    tool: ['fishing_rod'],
    yields: { fish: [1, 2] },
    verb: 'Fishing',
  },
  harvest_field: {
    id: 'harvest_field', name: 'Harvest', skill: 'homesteading', level: 2, xp: 6,
    where: col => col.feature?.type === 'field' && col.feature.ripe,
    yields: { grain: [3, 5], seeds: [1, 2] },
    depletes: 'field',
    verb: 'Harvesting',
  },
  prospect: {
    id: 'prospect', recipe: 'prospect',
    where: on(...ROCKY),
    yields: { ore: [1, 1] },
    reveals: true,
    verb: 'Prospecting',
  },
  mine_ore: {
    id: 'mine_ore', recipe: 'mine_ore',
    // The vein has to have been found first — the Mind 4 knowledge gate.
    where: (col, map) => nearbyOre(map, col) !== null,
    yields: { ore: [2, 3] },
    depletes: 'ore',
    verb: 'Mining',
  },
  mine_cliff: {
    id: 'mine_cliff', name: 'Mine the Face', skill: 'stoneworking', level: 1, xp: 4,
    tool: ['pickaxe', 'stone_hammer', 'hammer'],
    // A face you cannot climb is a face you can cut down.
    where: (col, map) => beside(o => o.h - col.h >= 3)(col, map),
    yields: { stone: [2, 4], flint: [0, 1] },
    lowersCliff: true,
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
    if (!other || other.h - col.h < 3) continue;
    if (!best || other.h > best.h) best = other;
  }
  return best;
}

/**
 * Fill in the skill, level, xp and tools a harvest borrows from its recipe, so
 * everything downstream can read one shape.
 */
export function harvestSpec(id) {
  const h = HARVESTS[id];
  if (!h) return null;
  const r = h.recipe ? RECIPES[h.recipe] : null;
  return {
    ...h,
    name: h.name || r?.name || id,
    skill: h.skill || r?.skill,
    level: h.level ?? r?.level ?? 1,
    xp: h.xp ?? r?.xp ?? 1,
    tool: h.tool || (r?.tools?.[0] ? (Array.isArray(r.tools[0]) ? r.tools[0] : [r.tools[0]]) : null),
    needs: r?.needs || h.needs || null,
  };
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
    if (levelOf(state, spec.skill) < spec.level) {
      reasons.push(`Needs ${spec.skill} level ${spec.level}.`);
    }
    if (spec.tool && !spec.tool.some(t => countItem(state, t) > 0)) {
      reasons.push(`Needs ${spec.tool.join(' or ')}.`);
    }
    for (const req of spec.needs || []) {
      const [kind, a, b] = String(req).split(':');
      if (kind === 'skill' && levelOf(state, a) < Number(b)) reasons.push(`Needs ${a} level ${b}.`);
    }
    out.push({ spec, ok: reasons.length === 0, reasons, col });
  }
  return out;
}
