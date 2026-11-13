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
import { neighbors, distance } from '../world/hexgrid.js';
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
  forage: { chance: 0.6, icon: 'berries' },
  find_herb: { chance: 0.3, icon: 'herb' },
  gather_flint: { chance: 0.5, icon: 'flint' },
  dig_clay: { chance: 0.5, icon: 'clay' },
  fish: { chance: 0.5, icon: 'fish' },
};

export const isHidden = id => id in HIDDEN;

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
  // Where you wake there is always a berry bush: the first thing you find, the
  // moment you have sat there long enough to look.
  const home = !!map.spawn && map.spawn.q === col.q && map.spawn.r === col.r;
  for (const [id, h] of Object.entries(HIDDEN)) {
    if (!harvestSpec(id).where(col, map)) continue;
    if ((home && id === 'forage') || roll(map, col.q, col.r, `res:${id}`) < h.chance) out.push(id);
  }
  cache.set(k, out);
  return out;
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
  const known = isKnown(state, col.q, col.r);
  const present = known ? new Set(resourcesAt(map, col)) : new Set();
  return availableHarvests(map, state, at)
    .filter(h => !isHidden(h.spec.id) || present.has(h.spec.id))
    // And what is taken off the ground has to be on the ground: a rock, a
    // branch, a rabbit. A thing that is regrowing stays listed, with its reason.
    .filter(h => !NODE_HARVESTS.has(h.spec.id) || !h.ok || hasNode(map, state, col, h.spec.id));
}

/** Mark every hex within `radius` of (q, r) as known. Returns the newly known. */
export function revealAround(map, state, q, r, radius) {
  const mind = ensureMind(state);
  const fresh = [];
  for (const col of map) {
    if (distance(col.q, col.r, q, r) > radius) continue;
    const k = key(col.q, col.r);
    if (mind.known[k]) continue;
    mind.known[k] = 1;
    fresh.push(col);
  }
  return fresh;
}

// ------------------------------------------------------------------ scenery

export const TIERS = [
  { id: 'common', name: 'Common', xp: 0, seconds: 1.2 },
  { id: 'copper', name: 'Copper', xp: 3, seconds: 2.6 },
  { id: 'silver', name: 'Silver', xp: 7, seconds: 4 },
  { id: 'gold', name: 'Gold', xp: 15, seconds: 5.5 },
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

/**
 * Finish exploring a hex: mark it, learn its resources, and see whether it was
 * somewhere. Mind xp and achievements are mind.js's business; this reports what
 * was found so it can award them.
 *
 * @returns {null | {tier, name, xp, resources:string[], oreSign:boolean}}
 *          null if it was already explored.
 */
export function exploreHex(map, state, q, r) {
  const mind = ensureMind(state);
  const col = map.get(q, r);
  const k = key(q, r);
  if (!col || k in mind.explored) return null;

  const { tier, name } = scenicOf(map, col);
  mind.explored[k] = tier;
  mind.known[k] = 1;

  // Lore teaches you what ore looks like in the rock; before that, a trace of it
  // is just rock. A trace says a vein is near, not where — prospecting does that.
  let oreSign = false;
  if (levelOf(state, 'mind') >= 3) {
    for (const c of map) {
      if (c.feature?.type !== 'ore' || c.feature.known || !(c.feature.remaining > 0)) continue;
      if (distance(c.q, c.r, q, r) <= ORE_SIGN_RADIUS) { oreSign = true; break; }
    }
    if (oreSign) mind.oreSigns[k] = 1;
  }

  return { tier, name, xp: TIERS[tier].xp, resources: resourcesAt(map, col), oreSign };
}
