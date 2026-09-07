// actions.js
// Doing things to the world: harvesting, mining a cliff down, prospecting, and
// putting up structures.
//
// Everything here mutates the map as well as the player, which is the point —
// a vein runs out, a wood is felled to bare floor, a cliff you mine gets shorter
// and eventually climbable. The world is meant to be spent.

import { neighbors, distance } from '../world/hexgrid.js';
import { variantFor, CROPS, cropFrame, TERRAIN } from '../world/tileset.js';
import { harvestSpec, availableHarvests, nearbyOre, cliffTarget } from './harvests.js';
import { addItem, countItem, removeItem, hasRoomFor } from './inventory.js';
import { addXp, levelOf } from './skills.js';
import { recordBuilt, itemName, RECIPES } from './state.js';
import { craft } from './crafting.js';

/** How far Lore reaches when you prospect. */
export const PROSPECT_RADIUS = 4;

/** Steps a planted field takes to come ripe. */
export const FIELD_RIPENS_IN = 60;

const roll = (rng, [lo, hi]) => lo + Math.floor(rng.next() * (hi - lo + 1));

/**
 * Run a harvest at the player's feet.
 * @returns {{ok, gained?, levels?, message, changed?}} `changed` lists columns
 *          whose art needs re-resolving.
 */
export function harvest(world, state, at, id, rng) {
  const { map } = world;
  const spec = harvestSpec(id);
  const entry = availableHarvests(map, state, at).find(h => h.spec.id === id);
  if (!spec || !entry) return { ok: false, message: 'Not here.' };
  if (!entry.ok) return { ok: false, message: entry.reasons[0] };

  const col = map.get(at.q, at.r);
  const changed = [];

  // A snare is spent on the catch; a bow is not.
  if (spec.id === 'set_snare' && countItem(state, 'bow') === 0) {
    if (!removeItem(state, 'cord', 1)) return { ok: false, message: 'You need cord for a snare.' };
  }

  const gained = [];
  for (const [item, range] of Object.entries(spec.yields)) {
    let qty = roll(rng, range);
    if (!qty) continue;
    if (!hasRoomFor(state, item, qty)) {
      qty = 0;
      continue;
    }
    addItem(state, item, qty);
    gained.push({ id: item, qty });
  }

  if (!gained.length) return { ok: false, message: 'Nothing to carry it in.' };

  // --- what the harvest costs the world ---

  if (spec.depletes === 'trees' && col.feature) {
    col.feature.remaining--;
    if (col.feature.remaining <= 0) {
      const floor = col.terrain === 'pine_wood' ? 'pine_floor' : 'forest_floor';
      map.place(col.q, col.r, floor, col.h);
      changed.push(col);
    }
  }

  if (spec.depletes === 'ore') {
    const vein = nearbyOre(map, col);
    if (vein) {
      vein.feature.remaining--;
      if (vein.feature.remaining <= 0) delete vein.feature;
    }
  }

  if (spec.depletes === 'field' && col.feature) {
    col.feature.ripe = false;
    col.feature.plantedAt = state.stepsWalked;
    col.frame = cropFrame(0, col.feature.variant || 0);
    changed.push(col);
  }

  if (spec.lowersCliff) {
    const face = cliffTarget(map, col);
    if (face) {
      face.h = Math.max(0, face.h - 1);
      // A vein in the face gives up its ore as you cut it back.
      if (face.feature?.type === 'ore' && face.feature.known && face.feature.remaining > 0) {
        face.feature.remaining--;
        const extra = 1 + Math.floor(rng.next() * 2);
        addItem(state, 'ore', extra);
        gained.push({ id: 'ore', qty: extra });
        if (face.feature.remaining <= 0) delete face.feature;
      }
      changed.push(face);
    }
  }

  const levels = addXp(state, spec.skill, spec.xp);
  const what = gained.map(g => `${g.qty} ${itemName(g.id)}`).join(', ');
  return { ok: true, gained, levels, changed, message: `You got ${what}.` };
}

/**
 * Prospecting: the single knowledge gate. Ore exists in the map from the start
 * but is invisible — and useless — until Lore reveals it. Each vein is finite,
 * and a world may simply have none.
 */
export function prospect(world, state, at, rng) {
  const { map } = world;
  if (levelOf(state, 'mind') < 4) {
    return { ok: false, message: 'You do not yet know what to look for.' };
  }

  const found = [];
  for (const col of map) {
    if (col.feature?.type !== 'ore' || col.feature.known) continue;
    if (distance(col.q, col.r, at.q, at.r) > PROSPECT_RADIUS) continue;
    col.feature.known = true;
    found.push(col);
  }

  addXp(state, 'metalworking', found.length ? 6 : 1);
  if (!found.length) return { ok: true, found, message: 'No ore in this ground.' };

  const near = found[0];
  addItem(state, 'ore', 1);
  return {
    ok: true,
    found,
    message: found.length === 1
      ? 'You read the rock and find a vein of ore.'
      : `You read the rock and find ${found.length} veins of ore.`,
    focus: near,
  };
}

/** Columns you could put a structure on, from where you stand. */
export function placementSpots(world, state, at, recipeId) {
  const { map } = world;
  const recipe = RECIPES[recipeId];
  if (!recipe) return [];
  const here = map.get(at.q, at.r);
  if (!here) return [];

  const candidates = [{ q: at.q, r: at.r }, ...neighbors(at.q, at.r)];
  return candidates
    .map(c => map.get(c.q, c.r))
    .filter(col => col
      && TERRAIN[col.terrain]?.walk
      && !col.feature
      && Math.abs(col.h - here.h) <= 1);
}

/**
 * Craft a 'build' recipe and put the result on a column.
 * @returns {{ok, message, column?}}
 */
export function build(world, state, at, recipeId, target, ctx = {}) {
  const { map } = world;
  const recipe = RECIPES[recipeId];
  const col = map.get(target.q, target.r);
  if (!col) return { ok: false, message: 'Nothing to build on.' };
  if (col.feature) return { ok: false, message: 'Something is already there.' };
  if (!placementSpots(world, state, at, recipeId).some(c => c.q === col.q && c.r === col.r)) {
    return { ok: false, message: 'Too far, or the ground is wrong.' };
  }

  const result = craft(state, recipeId, ctx);
  if (!result.ok) return { ok: false, message: result.reasons[0], reasons: result.reasons };

  const item = Object.keys(recipe.output)[0];

  if (item === 'field') {
    // A field is terrain, not furniture: the farm sheets draw it directly.
    const crop = ['cabbage', 'pumpkin', 'tomato'][Math.floor(Math.random() * 3)];
    map.place(col.q, col.r, 'farm', col.h, {
      sprite: CROPS[crop].sheet,
      frame: cropFrame(0, 0),
    });
    map.get(col.q, col.r).feature = {
      type: 'field', crop, variant: 0, ripe: false, plantedAt: state.stepsWalked,
    };
  } else {
    col.feature = { type: 'structure', item, name: itemName(item) };
  }

  recordBuilt(state, item, col.q, col.r);
  return { ok: true, message: `You built a ${itemName(item)}.`, column: map.get(col.q, col.r), levels: result.levelsGained };
}

/** Fields ripen as you go about your business. Call once per step taken. */
export function growCrops(world, state) {
  const changed = [];
  for (const col of world.map) {
    const f = col.feature;
    if (f?.type !== 'field' || f.ripe) continue;
    const age = state.stepsWalked - f.plantedAt;
    const stage = Math.min(2, Math.floor((age / FIELD_RIPENS_IN) * 3));
    const frame = cropFrame(stage, f.variant || 0);
    if (frame !== col.frame) {
      col.frame = frame;
      changed.push(col);
    }
    if (age >= FIELD_RIPENS_IN) {
      f.ripe = true;
      changed.push(col);
    }
  }
  return changed;
}

/** Eat something on purpose, rather than waiting to be hungry. */
export function eat(state, itemId) {
  if (!countItem(state, itemId)) return { ok: false, message: 'You have none.' };
  removeItem(state, itemId, 1);
  return { ok: true, message: `You eat the ${itemName(itemId)}.` };
}

/** Re-pick the sprite for columns whose terrain changed under them. */
export function refreshArt(world, columns) {
  for (const col of columns) {
    if (col.terrain === 'water' || col.terrain === 'path' || col.terrain === 'farm') continue;
    const v = variantFor(col.terrain, col.q, col.r);
    col.sprite = v.sprite;
    col.frame = v.frame;
  }
}
