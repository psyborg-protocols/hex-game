// discovery.js
// What the world keeps from you until you go and look.
//
// Some harvests are plain from a distance: trees, a cliff to quarry, reeds along
// a bank. The rest are hidden. Berries, herbs, flint, clay and fish are only on
// *some* of the ground they could be on, and you do not know which until you
// have explored the hex (stood on it a few seconds) or a village you traded with
// told you about the country around it.
//
// Exploring also finds places. Most hexes are just ground, but a summit, a cliff
// edge, the heart of a wood or a spit of land in the lake can be *scenic*, at one
// of three tiers. That is where Mind xp comes from: scenic finds and milestones,
// in spurts, rather than a trickle per hex.
//
// Everything here is decided by the world seed and the coordinates, never by a
// stateful RNG. A hex has the same resources and the same scenery whenever you
// look at it, and nothing extra has to be saved with the map.

import { xmur3, hash2 } from '../core/rng.js';
import { neighbors, distance, toAxial } from '../world/hexgrid.js';
import { TERRAIN } from '../world/tileset.js';
import { harvestSpec, availableHarvests } from './harvests.js';
import { hasNode, NODE_HARVESTS } from './nodes.js';
import { levelOf } from './skills.js';
import { createMindState } from './state.js';

/**
 * The hidden harvests, and the share of their ground that actually has them.
 * Food is commonest so an early game is never starved by bad luck.
 */
export const HIDDEN = {
  forage: { chance: 0.14, icon: 'berries' },
  gather_grain: { chance: 0.28, icon: 'grain', label: 'Tall Grass' },
  find_herb: { chance: 0.08, icon: 'herb' },
  gather_flint: { chance: 0.5, icon: 'flint' },
  dig_clay: { chance: 0.36, icon: 'clay' },
  fish: { chance: 0.40, icon: 'fish' },
};

export const isHidden = id => id in HIDDEN;

/**
 * The most hidden things one hex can hold. A hex is a berry bush, or a flinty
 * patch with clay in the bank: never everything at once.
 */
export const MAX_HIDDEN_PER_HEX = 2;

/** How far a village's knowledge of the land reaches, once you trade there. */
export const TRADE_REVEAL_RADIUS = 4;

/** An unknown vein this close to an explored hex shows as a trace. */
export const ORE_SIGN_RADIUS = 2;

// -------------------------------------------------------------- mind state

/** Fill in anything an older save is missing. */
export function ensureMind(state) {
  const fresh = createMindState();
  state.mind = { ...fresh, ...(state.mind || {}) };
  return state.mind;
}

const key = (q, r) => `${q},${r}`;

export const isExplored = (state, q, r) => key(q, r) in (state.mind?.explored || {});
export const isKnown = (state, q, r) => !!state.mind?.known?.[key(q, r)];
export const isMeditated = (state, q, r) => !!state.mind?.meditated?.[key(q, r)];

// ------------------------------------------------------------ the resources

/** A stable 0..1 roll for (world, hex, purpose). */
function roll(map, q, r, salt) {
  const s = seedSalt(map) ^ xmur3(salt)();
  return hash2(q, r, s) / 4294967296;
}

const saltCache = new Map();
function seedSalt(map) {
  const seed = String(map.seed);
  if (!saltCache.has(seed)) saltCache.set(seed, xmur3(seed)());
  return saltCache.get(seed);
}

/**
 * The hidden harvests this hex has, whether or not anyone knows yet. Terrain
 * still decides first: flint is never in a meadow, however lucky the roll.
 */
export function resourcesAt(map, col) {
  if (!col) return [];
  // Cached because the eye view asks for every known hex every frame. Keyed on
  // the terrain too, since felling a wood can change what grows there.
  const cache = (resourceCache.get(map) || resourceCache.set(map, new Map()).get(map));
  const k = `${col.q},${col.r},${col.terrain},${col.h}`;
  const hit = cache.get(k);
  if (hit) return hit;

  const out = [];
  // Keep the starting campsite around your campfire clear of resources.
  const home = !!map.spawn && map.spawn.q === col.q && map.spawn.r === col.r;
  if (home) {
    cache.set(k, out);
    return out;
  }
  const nearHome = !!map.spawn && distance(col.q, col.r, map.spawn.q, map.spawn.r) <= 7;
  for (const [id, h] of Object.entries(HIDDEN)) {
    if (!harvestSpec(id).where(col, map)) continue;
    let chance = h.chance;
    if (id === 'forage') chance = col.terrain === 'grass' || col.terrain === 'steppes' ? 0.09 : 0.16;
    else if (id === 'gather_flint') chance = col.h >= 8 ? 0.78 : col.h >= 6 ? 0.28 : (nearHome ? 0.25 : 0.12);
    else if (id === 'find_herb') {
      if (col.terrain === 'meadow' || col.terrain === 'grass' || col.terrain === 'steppes') {
        chance = out.some(o => o.id === 'gather_grain') ? 0.22 : (col.h >= 7 ? 0.18 : 0);
      } else {
        chance = col.h >= 7 ? 0.22 : 0.06;
      }
    }
    const r = roll(map, col.q, col.r, `res:${id}`);
    if (r < chance) out.push({ id, sure: r / chance });
  }
  // Keep the surest finds, food first so an early game is never starved.
  out.sort((a, b) => (b.id === 'forage') - (a.id === 'forage') || a.sure - b.sure);
  const ids = out.slice(0, MAX_HIDDEN_PER_HEX).map(o => o.id);
  cache.set(k, ids);
  return ids;
}
const resourceCache = new WeakMap();

/**
 * Harvests the player can see here: the obvious ones, plus the hidden ones only
 * where this hex is known and actually has them. A hidden harvest that is not
 * there is left out entirely, blocked reasons and all, so the list never hints.
 */
export function harvestsHere(map, state, at) {
  const col = map.get(at.q, at.r);
  if (!col) return [];
  if (map.spawn && col.q === map.spawn.q && col.r === map.spawn.r) return [];
  const known = isKnown(state, col.q, col.r);
  const present = known ? new Set(resourcesAt(map, col)) : new Set();
  return availableHarvests(map, state, at)
    .filter(h => !isHidden(h.spec.id) || present.has(h.spec.id))
    // And what is taken off the ground has to be on the ground: a rock, a
    // branch, a rabbit. A thing that is regrowing stays listed, with its reason.
    .filter(h => !NODE_HARVESTS.has(h.spec.id) || !h.ok || hasNode(map, state, col, h.spec.id));
}

/** Mark every hex within `radius` of (q, r) as known and explored. Returns newly revealed hexes. */
export function revealAround(map, state, q, r, radius) {
  const mind = ensureMind(state);
  const fresh = [];
  for (const col of map) {
    if (distance(col.q, col.r, q, r) > radius) continue;
    const k = key(col.q, col.r);
    const wasKnown = !!mind.known[k];
    const wasExplored = k in mind.explored;
    mind.known[k] = 1;
    if (!wasExplored) mind.explored[k] = scenicOf(map, col).tier;
    checkOreSign(map, state, col);
    if (!wasKnown || !wasExplored) fresh.push(col);
  }
  return fresh;
}

// ------------------------------------------------------------------ scenery

export const EXPLORE_SECONDS = 1.2;
export const MEDITATION_SECONDS = 3.2;

export const TIERS = [
  { id: 'common', name: 'Common', xp: 0, meditateXp: 0, seconds: EXPLORE_SECONDS },
  { id: 'copper', name: 'Quiet', xp: 0, meditateXp: 7, seconds: EXPLORE_SECONDS },
  { id: 'silver', name: 'Serene', xp: 0, meditateXp: 13, seconds: EXPLORE_SECONDS },
  { id: 'gold', name: 'Sublime', xp: 0, meditateXp: 24, seconds: EXPLORE_SECONDS },
];

const WOODED = new Set(['oak_wood', 'pine_wood']);
const OPEN = new Set(['meadow', 'grass', 'steppes']);
const isWaterCol = c => !!c && !!TERRAIN[c.terrain]?.water;

/** Per-map facts the scenic score needs: where civilisation is, the summit. */
const worldFacts = new WeakMap();
export function factsOf(map) {
  let f = worldFacts.get(map);
  if (f) return f;
  // Where you started counts as civilisation too: it is home, and without it a
  // world that spawns you far from any road hands out "far away" on turn one.
  const civ = map.spawn && map.get(map.spawn.q, map.spawn.r) ? [map.spawn] : [];
  let summit = null;
  for (const col of map) {
    if (col.terrain === 'path' || col.feature?.type === 'village') civ.push(col);
    if (!summit || col.h > summit.h) summit = col;
  }
  f = { civ, summit, scenic: new Map() };
  worldFacts.set(map, f);
  return f;
}

/** Hex distance to the nearest road, village or the spawn; Infinity if none. */
export function distanceFromCivilisation(map, q, r) {
  let best = Infinity;
  for (const c of factsOf(map).civ) {
    const d = distance(c.q, c.r, q, r);
    if (d < best) best = d;
  }
  return best;
}

/**
 * Is this a place worth finding, and how good?
 *
 * The heuristic scores what makes a hex distinctive: standing above everything
 * round it, a sheer drop at its edge, the middle of a wood, a clearing ringed by
 * trees, a spit of land in the lake, two waters meeting, and plain remoteness.
 * Then a seeded roll scales that score, so a good spot is only *likely* to be
 * scenic, and two similar summits can come out differently. Ordinary ground
 * gets a small chance of its own so a meadow can still surprise you.
 *
 * @returns {{tier:number, name:string|null}}
 */
export function scenicOf(map, col) {
  if (!col) return { tier: 0, name: null };
  const facts = factsOf(map);
  const k = key(col.q, col.r);
  const cached = facts.scenic.get(k);
  if (cached) return cached;

  const around = neighbors(col.q, col.r).map(n => map.get(n.q, n.r));
  const land = around.filter(c => c && !isWaterCol(c));
  const scores = [];
  const add = (name, pts) => { if (pts > 0) scores.push({ name, pts }); };

  if (!isWaterCol(col)) {
    // Standing above everything nearby. Taller and more isolated is better.
    const higher = land.filter(c => c.h > col.h).length;
    if (!higher && col.h >= 5 && land.length) {
      const rise = col.h - land.reduce((s, c) => s + c.h, 0) / land.length;
      add(col === facts.summit ? 'The Summit' : 'A Peak', 1.5 + Math.min(2.5, rise * 0.5 + col.h * 0.08));
    }
    if (col.h >= 10) add('High Crag', 1.5);

    // A cliff edge you can see off.
    const drop = Math.max(0, ...land.map(c => col.h - c.h));
    if (drop >= 3) add('An Overlook', 0.8 + Math.min(1.6, (drop - 3) * 0.25));

    // The heart of a wood.
    const woods = around.filter(c => c && WOODED.has(c.terrain)).length;
    if (WOODED.has(col.terrain) && woods === 6) add('Deep Woods', 1.0);

    // A clearing with trees all round.
    if (OPEN.has(col.terrain) && woods >= 4) add('A Glade', 1.0 + (woods - 4) * 0.5);

    // Land with water on several sides.
    const wet = around.filter(isWaterCol).length;
    if (wet >= 3) add(wet >= 5 ? 'A Spit of Land' : 'The Waterside', 0.6 + (wet - 3) * 0.6);

    // Where a stream meets bigger water.
    const kinds = new Set(around.filter(isWaterCol).map(c => c.terrain));
    if (kinds.has('stream') && (kinds.has('river') || kinds.has('water'))) add('The Meeting of Waters', 1.6);

    // The edge of the world.
    if (around.some(c => !c)) add("The World's Edge", 0.4);

    // Out where nobody goes. Half the map can be roadless, so remoteness only
    // nudges a place up; on its own it is rarely enough.
    const far = distanceFromCivilisation(map, col.q, col.r);
    if (far >= 10) add('The Wilds', 0.35);
  }

  const points = scores.reduce((s, x) => s + x.pts, 0);
  const u = roll(map, col.q, col.r, 'scenic');
  const quality = points * (0.35 + 1.3 * u);

  let tier = quality >= 5.5 ? 3 : quality >= 3.4 ? 2 : quality >= 2.0 ? 1 : 0;
  let name = tier ? scores.sort((a, b) => b.pts - a.pts)[0].name : null;

  // The roof of the world is never a disappointment.
  if (col === facts.summit && !isWaterCol(col)) { tier = 3; name = 'The Summit'; }

  // A little luck anywhere on land: the quiet spot nobody would think to stop at.
  if (!tier && !isWaterCol(col) && roll(map, col.q, col.r, 'quiet') < 0.015) {
    tier = 1;
    name = 'A Quiet Spot';
  }

  const out = { tier, name };
  facts.scenic.set(k, out);
  return out;
}

/** How long standing on this hex takes to explore it, in seconds. */
export const exploreSeconds = (map, col) => TIERS[scenicOf(map, col).tier].seconds;

// ---------------------------------------------------------------- exploring

/** How many hexes away a height advantage of `drop` levels can see. */
export function sightForDrop(drop) {
  if (drop < 3) return 0;
  if (drop >= 15) return 8;
  if (drop >= 12) return 7;
  if (drop >= 9) return 6;
  if (drop >= 6) return 5;
  if (drop >= 4) return 4;
  return 3;
}

/** The summit sees furthest of all. */
const SUMMIT_SIGHT = 9;

/** How far exploring one hex sees across the country round it. Higher ground sees further. */
export function exploreRadius(map, col) {
  if (!col || isWaterCol(col) || col.h < 3) return 0;
  let adjDrop = 0;
  let underCliff = false;
  for (const n of neighbors(col.q, col.r)) {
    const c = map.get(n.q, n.r);
    if (!c) continue;
    if (col.h - c.h > adjDrop) adjDrop = col.h - c.h;
    if (c.h - col.h >= 3) underCliff = true;
  }
  // A foothill sitting under a steep cliff with no 3-level drop of its own sees nothing.
  if (underCliff && adjDrop < 3) return 0;
  // In the lowlands, gentle ground without a 3-level cliff edge sees nothing.
  if (col.h < 6 && adjDrop < 3) return 0;
  if (col === factsOf(map).summit && adjDrop >= 3) return SUMMIT_SIGHT;
  if (underCliff) return sightForDrop(adjDrop);

  let maxDrop = adjDrop;
  for (const c of map) {
    if (distance(c.q, c.r, col.q, col.r) <= 8 && col.h - c.h > maxDrop) {
      maxDrop = col.h - c.h;
    }
  }
  if (col === factsOf(map).summit && maxDrop >= 3) return SUMMIT_SIGHT;
  return sightForDrop(maxDrop);
}

/** Whether any taller ridge blocks the sightline from a vantage point to a lower hex. */
function hasLineOfSight(map, origin, target) {
  const d = distance(origin.q, origin.r, target.q, target.r);
  if (d <= 1) return true;
  const a = toAxial(origin.q, origin.r);
  const b = toAxial(target.q, target.r);
  const ax = a.aq, az = a.ar, ay = -ax - az;
  const bx = b.aq, bz = b.ar, by = -bx - bz;
  for (let i = 1; i < d; i++) {
    const t = i / d;
    const x = ax + (bx - ax) * t + 1e-6;
    const y = ay + (by - ay) * t + 1e-6;
    const z = az + (bz - az) * t - 2e-6;
    let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
    const dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
    if (dx > dy && dx > dz) rx = -ry - rz;
    else if (dy > dz) ry = -rx - rz;
    else rz = -rx - ry;
    const mid = map.get(rx, rz + ((rx - (rx & 1)) >> 1));
    if (mid && mid.h >= origin.h) return false;
  }
  return true;
}

/** Record an ore trace on `col` if the player has Lore (Mind 3) and an unknown vein is near. */
export function checkOreSign(map, state, col) {
  if (!col || levelOf(state, 'mind') < 3) return false;
  const mind = ensureMind(state);
  const k = key(col.q, col.r);
  if (mind.oreSigns[k]) return false;
  for (const c of map) {
    if (c.feature?.type !== 'ore' || c.feature.known || !(c.feature.remaining > 0)) continue;
    if (distance(c.q, c.r, col.q, col.r) <= ORE_SIGN_RADIUS) {
      mind.oreSigns[k] = 1;
      return true;
    }
  }
  return false;
}

/** Reveal any lower countryside overlooked by `col` that is not yet known. */
export function revealVistaFrom(map, state, col) {
  if (!col) return [];
  const mind = ensureMind(state);
  const radius = exploreRadius(map, col);
  const isSummit = col === factsOf(map).summit;
  const revealed = [];
  if (radius > 0) {
    for (const c of map) {
      const d = distance(c.q, c.r, col.q, col.r);
      if (c === col || d > radius) continue;
      const drop = col.h - c.h;
      if (drop < 3) continue;
      if (!isSummit && d > sightForDrop(drop)) continue;
      if (!hasLineOfSight(map, col, c)) continue;
      const ck = key(c.q, c.r);
      if (!mind.known[ck]) {
        mind.known[ck] = 1;
        revealed.push(c);
      }
    }
  }
  return revealed;
}

/**
 * Finish exploring a hex: mark it, learn its resources, reveal surrounding
 * ground when high enough to overlook it, and note whether it is scenic.
 * Scenic Mind xp is earned by sitting down to meditate there (see meditateHex).
 *
 * @returns {null | {tier, name, xp, meditateXp, resources:string[], oreSign:boolean, revealed:Array, radius:number}}
 *          null if it was already explored.
 */
export function exploreHex(map, state, q, r) {
  const mind = ensureMind(state);
  const col = map.get(q, r);
  const k = key(q, r);
  if (!col || k in mind.explored) return null;

  const { tier, name } = scenicOf(map, col);
  mind.explored[k] = tier;
  mind.surveyed ||= {};
  mind.surveyed[k] = tier;
  mind.known[k] = 1;

  const radius = exploreRadius(map, col);
  const revealed = revealVistaFrom(map, state, col);

  // Lore teaches you what ore looks like in the rock; before that, a trace of it
  // is just rock. A trace says a vein is near, not where — prospecting does that.
  const oreSign = checkOreSign(map, state, col);

  return {
    tier, name, xp: 0, meditateXp: TIERS[tier].meditateXp,
    resources: resourcesAt(map, col), oreSign, revealed, radius,
  };
}

/** Finish meditating on an explored scenic hex. Pays Mind xp once. */
export function meditateHex(map, state, q, r) {
  const mind = ensureMind(state);
  mind.meditated ||= {};
  const col = map.get(q, r);
  const k = key(q, r);
  if (!col || !isExplored(state, q, r) || mind.meditated[k]) return null;
  const { tier, name } = scenicOf(map, col);
  if (!tier) return null;
  mind.meditated[k] = 1;
  return { tier, name, xp: TIERS[tier].meditateXp };
}
