// nodes.js
// The things on a hex you can see, and so can work.
//
// The rule this file exists for: if you can use it, you can see it. A hex does
// not "offer stone" behind a button; there is a rock lying on it, and when you
// have picked the rock up it is gone. Reeds stand on a shore until they are cut
// and grow back as stubble first. A berry bush is green when it is bare. The
// list of what a hex gives you is the list of what is drawn on it, and the way
// to take a thing is to click the thing.
//
// A node is a small record: what it is, where on the hex's top face it stands,
// which harvest takes it, and whether it is ready. Nothing here is stored with
// the map. Where nodes are is decided by the world seed and the coordinates;
// what has been taken is the only state (`state.taken` for what never comes
// back, `state.picked` for what regrows).

import { xmur3, hash2 } from '../core/rng.js';
import { neighbors, distance } from '../world/hexgrid.js';
import { TERRAIN } from '../world/tileset.js';
import { HARVESTS, regrowsAt } from './harvests.js';
import { resourcesAt, isKnown } from './discovery.js';

/** Where on a top face a thing on the ground may lie, as offsets from its centre. */
const OPEN_SPOTS = [
  { dx: -8, dy: 2 }, { dx: 7, dy: -3 }, { dx: 0, dy: 6 }, { dx: -3, dy: -5 },
  { dx: 9, dy: 4 }, { dx: -10, dy: -2 }, { dx: 3, dy: 1 },
];
/** Under trees the ground that shows is the front of the hex. */
const WOOD_SPOTS = [
  { dx: -9, dy: 6 }, { dx: 6, dy: 7 }, { dx: -1, dy: 9 }, { dx: 10, dy: 3 }, { dx: -11, dy: 2 },
];

const WOODED = new Set(['oak_wood', 'pine_wood', 'forest_floor', 'pine_floor']);
const OPEN = new Set(['meadow', 'grass', 'steppes']);

/** How many rocks lie on a kind of ground: the chance of any, and the most. */
const ROCKS = {
  stony: [0.55, 3], steppes: [0.4, 2], meadow: [0.5, 2], grass: [0.14, 1],
  forest_floor: [0.12, 1], pine_floor: [0.12, 1], oak_wood: [0.08, 1], pine_wood: [0.08, 1],
};

/** Every hex this close to where you wake has a fair chance of a rock: an axe needs two. */
const HOME_RADIUS = 4;
const HOME_ROCKS = 0.45;

/** How long an animal is in one place, in world seconds. */
const GAME_STAYS = 90;
const GAME_CHANCE = 0.13;

// ------------------------------------------------------------------ rolls

const saltCache = new Map();
function seedSalt(map) {
  const seed = String(map.seed);
  if (!saltCache.has(seed)) saltCache.set(seed, xmur3(seed)());
  return saltCache.get(seed);
}
const tagCache = new Map();
function tagSalt(tag) {
  if (!tagCache.has(tag)) tagCache.set(tag, xmur3(tag)());
  return tagCache.get(tag);
}
/** A stable 0..1 roll for (world, hex, purpose). */
const roll = (map, q, r, tag) => hash2(q, r, seedSalt(map) ^ tagSalt(tag)) / 4294967296;

const key = (q, r) => `${q},${r}`;
const isWaterCol = c => !!c && !!TERRAIN[c.terrain]?.water;

// ------------------------------------------------------------- what is where

/** Rocks this hex started with, before anyone picked any up. */
export function rocksOn(map, col) {
  const table = ROCKS[col.terrain];
  if (!table) return 0;
  let [chance, most] = table;
  const home = map.spawn ? distance(col.q, col.r, map.spawn.q, map.spawn.r) : Infinity;
  if (home === 0) chance = 1;
  else if (home >= 1 && home <= HOME_RADIUS) chance = Math.max(chance, HOME_ROCKS);
  if (roll(map, col.q, col.r, 'rock') >= chance) return 0;
  return 1 + Math.floor(roll(map, col.q, col.r, 'rocks') * most);
}

/** Fallen branches a hex has, when none have been gathered lately. */
function branchesOn(map, col) {
  const chance = WOODED.has(col.terrain) ? 0.6 : col.terrain === 'meadow' ? 0.25 : 0;
  if (roll(map, col.q, col.r, 'branch') >= chance) return 0;
  return 1 + (roll(map, col.q, col.r, 'branches') < 0.4 ? 1 : 0);
}

/** Is there game on this hex at this moment? It moves on every so often. */
function gameOn(map, col, time) {
  if (!HARVESTS.hunt.where(col, map)) return false;
  const when = Math.floor((time || 0) / GAME_STAYS);
  return roll(map, col.q, col.r, `game:${when}`) < GAME_CHANCE;
}

/** Ground that is somebody's already: nothing lies about on it to be picked up. */
const taken = col => col.terrain === 'path' || col.terrain === 'farm'
  || ['structure', 'village', 'camp', 'campfire', 'field'].includes(col.feature?.type);

/**
 * Everything standing or lying on a hex.
 *
 * @returns {Array<{kind, harvest, q, r, dx, dy, ready:boolean, variant:number, on?:{q,r}}>}
 *   `q, r` is the hex you work it from. `on` is set when it is drawn somewhere
 *   else: fish show as rings on the water beside the bank you fish from.
 */
export function nodesAt(map, state, col) {
  if (!col || isWaterCol(col)) return [];
  const out = [];
  const time = state?.time || 0;
  const k = key(col.q, col.r);
  const back = id => regrowsAt(state, col, id) > time;
  const base = { q: col.q, r: col.r };

  if (col.feature?.type === 'trees' && col.feature.remaining > 0) {
    out.push({ ...base, kind: 'tree', harvest: 'fell_tree', dx: 0, dy: -6, ready: true, variant: 0 });
  }
  if (col.feature?.type === 'field' && col.feature.ripe) {
    out.push({ ...base, kind: 'field', harvest: 'harvest_field', dx: 0, dy: 0, ready: true, variant: 0 });
  }
  if (taken(col)) return out;

  // Ground spots, dealt out in a per-hex order so neighbours do not match.
  const spots = col.feature?.type === 'trees' ? WOOD_SPOTS : OPEN_SPOTS;
  const first = Math.floor(roll(map, col.q, col.r, 'spot') * spots.length);
  let used = 0;
  const place = (kind, harvest, ready, variant = 0, extra = {}) => {
    const s = spots[(first + used++) % spots.length];
    out.push({ ...base, kind, harvest, dx: s.dx, dy: s.dy, ready, variant, ...extra });
  };

  const rocks = rocksOn(map, col) - (state?.taken?.[`${k}:stone`] || 0);
  for (let i = 0; i < rocks; i++) place('stone', 'gather_stone', true, Math.floor(roll(map, col.q, col.r, `rockv${i}`) * 4));

  // A cut bed is still there, as stubble, so you can see it will be back.
  if (HARVESTS.cut_reeds.where(col, map)) {
    const cut = back('cut_reeds');
    place('reeds', 'cut_reeds', !cut, 0);
    place('reeds', 'cut_reeds', !cut, 1);
  }

  if (!back('gather_branch')) {
    const n = branchesOn(map, col);
    for (let i = 0; i < n; i++) place('branch', 'gather_branch', true, i);
  }

  // The hidden ones: only on ground you know, and only where they really are.
  if (isKnown(state, col.q, col.r)) {
    const has = new Set(resourcesAt(map, col));
    if (has.has('forage')) place('berries', 'forage', !back('forage'), Math.floor(roll(map, col.q, col.r, 'bush') * 3));
    if (has.has('find_herb') && !back('find_herb')) place('herb', 'find_herb', true);
    if (has.has('gather_flint') && !back('gather_flint')) place('flint', 'gather_flint', true);
    if (has.has('dig_clay') && !back('dig_clay')) place('clay', 'dig_clay', true);
    if (has.has('fish') && !back('fish')) {
      const waters = neighbors(col.q, col.r).map(n => map.get(n.q, n.r)).filter(isWaterCol);
      if (waters.length) {
        const w = waters[Math.floor(roll(map, col.q, col.r, 'fishat') * waters.length)];
        out.push({ ...base, kind: 'fish', harvest: 'fish', dx: 0, dy: 0, ready: true, variant: 0, on: { q: w.q, r: w.r } });
      }
    }
  }

  if (!back('hunt') && gameOn(map, col, time)) place('game', 'hunt', true, Math.floor(roll(map, col.q, col.r, 'gamev') * 2));

  return out;
}

/** Is there a thing here, ready, that this harvest takes? */
export function hasNode(map, state, col, harvestId) {
  return nodesAt(map, state, col).some(n => n.harvest === harvestId && n.ready);
}

/** Harvests that take a thing off the ground, as against cutting into the land itself. */
export const NODE_HARVESTS = new Set([
  'gather_stone', 'gather_branch', 'cut_reeds', 'forage', 'find_herb',
  'gather_flint', 'dig_clay', 'fish', 'hunt', 'fell_tree', 'harvest_field',
]);

/** A rock picked up does not come back. */
export function takeNode(state, col, harvestId) {
  if (harvestId !== 'gather_stone') return;
  state.taken ||= {};
  const k = `${key(col.q, col.r)}:stone`;
  state.taken[k] = (state.taken[k] || 0) + 1;
}

/** How near a pointer has to be to a thing to mean it, in world pixels. */
const REACH = { tree: 13, field: 12, fish: 11 };

/**
 * The thing under a point, given the hex the point is on.
 * `px, py` are relative to the centre of that hex's top face. Fish belong to a
 * bank but lie on the water, so the neighbours' are asked after too.
 */
export function nodeNear(map, state, col, px, py) {
  if (!col) return null;
  let best = null;
  const consider = (n, dx, dy) => {
    const reach = REACH[n.kind] || 7;
    const d = Math.hypot(px - dx, py - dy);
    if (d > reach) return;
    // A tree is a big target; anything small lying in front of it wins.
    const score = d + (n.kind === 'tree' || n.kind === 'field' ? 6 : 0);
    if (!best || score < best.score) best = { node: n, score };
  };
  if (isWaterCol(col)) {
    for (const nb of neighbors(col.q, col.r)) {
      const bank = map.get(nb.q, nb.r);
      for (const n of nodesAt(map, state, bank)) {
        if (n.on && n.on.q === col.q && n.on.r === col.r) consider(n, 0, 0);
      }
    }
  } else {
    for (const n of nodesAt(map, state, col)) if (!n.on) consider(n, n.dx, n.dy - (n.kind === 'tree' ? 4 : 2));
  }
  return best?.node || null;
}
