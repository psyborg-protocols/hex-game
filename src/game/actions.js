// actions.js
// Doing things to the world: harvesting, mining a cliff down, prospecting, and
// putting up structures. Everything here mutates the map as well as the player —
// a vein runs out, a wood is felled to bare floor, a cliff you mine gets shorter.

import { neighbors, neighbor, distance } from '../world/hexgrid.js';
import { MAX_CLIMB } from '../world/pathfinding.js';
import { variantFor, CROPS, cropFrame, TERRAIN, isWater } from '../world/tileset.js';
import { harvestSpec, nearbyOre, cliffTarget, markPicked } from './harvests.js';
import { addItem, countItem, removeItem, hasRoomFor, spend, canSpend } from './inventory.js';
import { addXp, levelOf } from './skills.js';
import { recordBuilt, forgetBuilt, itemName, RECIPES, STRUCTURE_HP, ITEMS, DAY_LENGTH, isFree } from './state.js';
import { craft } from './crafting.js';
import { harvestsHere } from './discovery.js';
import { takeNode } from './nodes.js';
import { regrowsAt } from './harvests.js';

/** How far Lore reaches when you prospect. */
export const PROSPECT_RADIUS = 4;

/** World seconds a sown field takes to ripen: most of a day. */
export const FIELD_RIPENS_IN = DAY_LENGTH * 0.6;

/** The widest water a bridge will span. */
export const MAX_SPAN = 9;

const roll = (rng, [lo, hi]) => lo + Math.floor(rng.next() * (hi - lo + 1));

/**
 * Run a harvest at the player's feet.
 * @returns {{ok, gained?, levels?, message, changed?}} `changed` lists columns
 *          whose art needs re-resolving.
 */
export function harvest(world, state, at, id, rng) {
  const { map } = world;
  const spec = harvestSpec(id);
  // harvestsHere, not availableHarvests: a hidden resource has to have been
  // found on this hex before it can be gathered from it.
  const entry = harvestsHere(map, state, at).find(h => h.spec.id === id);
  if (!spec || !entry) return { ok: false, message: 'Not here.' };
  if (!entry.ok) return { ok: false, message: entry.reasons[0] };
  if (!canSpend(state, spec.energy)) return { ok: false, message: 'Too tired. Carry some food.' };

  const col = map.get(at.q, at.r);
  const changed = [];

  // A snare is spent on the catch; a bow is not.
  if (spec.id === 'hunt' && countItem(state, 'bow') === 0 && !isFree(state)) {
    if (!removeItem(state, 'cord', 1)) return { ok: false, message: 'You need cord for a snare.' };
  }

  const gained = [];
  const give = (item, qty) => {
    if (!qty) return;
    const got = addItem(state, item, qty);
    if (got) {
      const g = gained.find(x => x.id === item);
      if (g) g.qty += got; else gained.push({ id: item, qty: got });
    }
  };
  for (const [item, range] of Object.entries(spec.yields)) give(item, roll(rng, range));
  for (const [item, range] of Object.entries(spec.bonusYields || {})) {
    if (spec.bonusWhere?.[item]?.(col)) give(item, roll(rng, range));
  }
  for (const [tool, extra] of Object.entries(spec.bonus || {})) {
    if (countItem(state, tool) === 0) continue;
    for (const [item, range] of Object.entries(extra)) give(item, roll(rng, range));
  }
  if (spec.id === 'harvest_field' && levelOf(state, 'homesteading') >= 4) give('grain', 2);

  if (!gained.length) return { ok: false, message: 'Your pack is full.' };
  spend(state, spec.energy);
  markPicked(state, col, spec.id);
  takeNode(state, col, spec.id);

  // --- what the harvest costs the world ---

  if (spec.depletes === 'trees' && col.feature) {
    col.feature.remaining--;
    if (col.feature.remaining <= 0) {
      const pine = col.feature.kind === 'pine' || col.terrain.startsWith('pine');
      map.place(col.q, col.r, pine ? 'pine_floor' : 'forest_floor', col.h);
      changed.push(map.get(col.q, col.r));
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
    col.feature.plantedAt = state.time;
    col.frame = cropFrame(0, col.feature.variant || 0);
    changed.push(col);
  }

  if (spec.lowersCliff) {
    const face = cliffTarget(map, col);
    if (face) {
      face.h = Math.max(0, face.h - (countItem(state, 'pickaxe') ? 2 : 1));
      if (face.feature?.type === 'ore' && face.feature.known && face.feature.remaining > 0) {
        face.feature.remaining--;
        give('ore', 1);
        if (face.feature.remaining <= 0) delete face.feature;
      }
      changed.push(face);
    }
  }

  const levels = addXp(state, spec.skill, spec.xp);
  const what = gained.map(g => `${g.qty} ${itemName(g.id)}`).join(', ');
  return { ok: true, gained, levels, changed, message: `+ ${what}` };
}

/** How long before a shaken wood has anything loose in it again. */
const SHAKE_AGAIN = 60;

/**
 * Shake a tree you have no axe for. It does not come down, but a branch does:
 * trying the thing you cannot yet do is never nothing, and what falls out is
 * the first part of what you were missing.
 * @returns {{ok, gained?, message?}}
 */
export function shakeTree(world, state, at) {
  const col = world.map.get(at.q, at.r);
  if (!col || col.feature?.type !== 'trees' || !(col.feature.remaining > 0)) return { ok: false };
  const k = `${col.q},${col.r}:shake`;
  state.picked ||= {};
  if ((state.picked[k] ?? -1) > (state.time || 0)) return { ok: true, gained: [] };
  state.picked[k] = (state.time || 0) + SHAKE_AGAIN;
  const got = addItem(state, 'branch', 1);
  return { ok: true, gained: got ? [{ id: 'branch', qty: got }] : [] };
}

/**
 * Prospecting: ore exists in the map from the start but is invisible until
 * Lore reveals it. Each vein is finite, and a world may simply have little.
 */
export function prospect(world, state, at) {
  const { map } = world;
  if (levelOf(state, 'mind') < 3) return { ok: false, message: 'You do not yet know what to look for.' };
  if (!spend(state, 1)) return { ok: false, message: 'Too tired. Carry some food.' };

  const found = [];
  for (const col of map) {
    if (col.feature?.type !== 'ore' || col.feature.known) continue;
    if (distance(col.q, col.r, at.q, at.r) > PROSPECT_RADIUS) continue;
    col.feature.known = true;
    found.push(col);
  }
  const levels = addXp(state, 'metalworking', found.length ? 6 : 1);
  if (!found.length) return { ok: true, found, levels, message: 'No ore in this ground.' };
  return {
    ok: true, found, levels,
    message: found.length === 1 ? 'You read the rock and find a vein of ore!'
      : `You read the rock and find ${found.length} veins of ore!`,
  };
}

// ------------------------------------------------------------- building

const outputOf = recipeId => Object.keys(RECIPES[recipeId]?.output || {})[0];
const isLadder = recipeId => outputOf(recipeId) === 'ladder';
const isBridge = recipeId => outputOf(recipeId) === 'bridge';

const ladderBetween = (map, a, b) => map.structures.some(s => s.type === 'ladder'
  && ((s.from.q === a.q && s.from.r === a.r && s.to.q === b.q && s.to.r === b.r)
    || (s.to.q === a.q && s.to.r === a.r && s.from.q === b.q && s.from.r === b.r)));

const bridged = (map, q, r) => map.structures.some(s => s.type === 'bridge'
  && s.tiles.some(t => t.q === q && t.r === r));

/**
 * The bridge you could lay from here across one edge: a straight run of water
 * that lands on dry ground within MAX_SPAN hexes.
 * @returns {{edge, tiles, landing}|null}
 */
export function bridgeSpan(map, at, edge) {
  const start = map.get(at.q, at.r);
  if (!start) return null;
  const tiles = [];
  let cur = { q: at.q, r: at.r };
  for (let i = 0; i <= MAX_SPAN; i++) {
    cur = neighbor(cur.q, cur.r, edge);
    const col = map.get(cur.q, cur.r);
    if (!col) return null;
    if (isWater(col.terrain)) {
      if (bridged(map, col.q, col.r)) return null;
      tiles.push(col);
      continue;
    }
    if (!tiles.length) return null;
    // The deck rests on the lower bank. A far bank more than a step above it
    // would leave the bridge ending at a wall, and water standing higher than
    // the deck would drown it, so neither is a crossing.
    const h = Math.min(start.h, col.h);
    if (Math.abs(start.h - col.h) > MAX_CLIMB) return null;
    if (tiles.some(t => t.h > h)) return null;
    return { edge, tiles, landing: col, h };
  }
  return null;
}

/**
 * Columns you could put a structure on, from where you stand.
 *   ladder  targets the cliff top beside you and is planted at your feet;
 *   bridge  targets the first water hex of a span that reaches the far side;
 *   the rest go on level, empty ground on your hex or the next one.
 */
export function placementSpots(world, state, at, recipeId) {
  const { map } = world;
  const recipe = RECIPES[recipeId];
  if (!recipe) return [];
  const here = map.get(at.q, at.r);
  if (!here) return [];

  if (isLadder(recipeId)) {
    if (here.feature) return [];
    return neighbors(at.q, at.r)
      .map(c => map.get(c.q, c.r))
      .filter(col => col && TERRAIN[col.terrain]?.walk
        && col.h - here.h > MAX_CLIMB && !ladderBetween(map, at, col));
  }

  if (isBridge(recipeId)) {
    if (isWater(here.terrain)) return [];
    const out = [];
    for (let e = 0; e < 6; e++) {
      const span = bridgeSpan(map, at, e);
      if (span) out.push({ ...span.tiles[0], span });
    }
    return out;
  }

  const candidates = [{ q: at.q, r: at.r }, ...neighbors(at.q, at.r)];
  return candidates
    .map(c => map.get(c.q, c.r))
    .filter(col => col && TERRAIN[col.terrain]?.walk && col.terrain !== 'path'
      && !col.feature && Math.abs(col.h - here.h) <= 1
      && !(recipeId === 'field' && !['grass', 'meadow', 'steppes', 'forest_floor', 'pine_floor'].includes(col.terrain)));
}

/** The extra a bridge costs for its length. */
export function spanCost(recipeId, tiles) {
  const per = RECIPES[recipeId]?.perSpan;
  if (!per) return null;
  return Object.fromEntries(Object.entries(per).map(([id, n]) => [id, n * tiles]));
}

/**
 * Craft a 'build' recipe and put the result on a column.
 * @returns {{ok, message, column?, levels?}}
 */
export function build(world, state, at, recipeId, target, ctx = {}) {
  const { map } = world;
  const col = map.get(target.q, target.r);
  if (!col) return { ok: false, message: 'Nothing to build on.' };
  const spot = placementSpots(world, state, at, recipeId).find(c => c.q === col.q && c.r === col.r);
  if (!spot) {
    return { ok: false, message: isLadder(recipeId) ? 'A ladder has to lean against a cliff you cannot climb.'
      : isBridge(recipeId) ? 'A bridge has to start at the water’s edge and reach the other side.'
        : 'Too far, or the ground is wrong.' };
  }

  const extra = isBridge(recipeId) ? spanCost(recipeId, spot.span.tiles.length) : null;
  const result = craft(state, recipeId, ctx, extra);
  if (!result.ok) return { ok: false, message: result.reasons[0], reasons: result.reasons };

  const item = outputOf(recipeId);

  if (item === 'ladder') {
    const foot = map.get(at.q, at.r);
    map.addStructure({ type: 'ladder', from: { q: at.q, r: at.r }, to: { q: col.q, r: col.r } });
    foot.feature = { type: 'structure', item, name: itemName(item), to: { q: col.q, r: col.r } };
    recordBuilt(state, item, foot.q, foot.r);
    return { ok: true, message: `You lean a ladder against the ${col.h - foot.h}-level face.`, column: foot, levels: result.levelsGained };
  }

  if (item === 'bridge') {
    const tiles = spot.span.tiles.map(t => ({ q: t.q, r: t.r }));
    map.addStructure({ type: 'bridge', edge: spot.span.edge, h: spot.span.h, tiles });
    recordBuilt(state, item, tiles[0].q, tiles[0].r);
    return { ok: true, message: `You lay a ${tiles.length}-hex bridge across the water.`, column: col, levels: result.levelsGained };
  }

  if (item === 'field') {
    // A field is terrain, not furniture: the farm sheets draw it directly.
    const crops = Object.keys(CROPS);
    const crop = crops[Math.abs(col.q * 7 + col.r * 13) % crops.length];
    map.place(col.q, col.r, 'farm', col.h, { sprite: CROPS[crop].sheet, frame: cropFrame(0, 0) });
    map.get(col.q, col.r).feature = {
      type: 'field', crop, variant: 0, ripe: false, plantedAt: state.time,
      hp: STRUCTURE_HP.field, maxHp: STRUCTURE_HP.field,
    };
  } else {
    const hp = STRUCTURE_HP[item] || 8;
    col.feature = { type: 'structure', item, name: itemName(item), hp, maxHp: hp, ...(ITEMS[item]?.wall ? { wall: true } : {}) };
  }

  recordBuilt(state, item, col.q, col.r);
  return { ok: true, message: `You built a ${itemName(item)}.`, column: map.get(col.q, col.r), levels: result.levelsGained };
}

/**
 * A structure falls. Fields go back to grass; anything in a hut's stash is the
 * raiders' now.
 */
export function destroyStructure(world, state, col) {
  const f = col.feature;
  if (!f) return null;
  const item = f.type === 'field' ? 'field' : f.item;
  if (f.type === 'field') {
    world.map.place(col.q, col.r, 'grass', col.h);
  } else {
    delete col.feature;
  }
  forgetBuilt(state, col.q, col.r);
  let loot = [];
  if (item === 'hut') {
    loot = state.stash.filter(Boolean);
    state.stash = state.stash.map(() => null);
  }
  return { item, loot };
}

/** Fields ripen with the world clock. Call every so often. */
export function growCrops(world, state) {
  const changed = [];
  for (const col of world.map) {
    const f = col.feature;
    if (f?.type !== 'field' || f.ripe) continue;
    const age = state.time - (f.plantedAt ?? state.time);
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

/** Re-pick the sprite for columns whose terrain changed under them. */
export function refreshArt(world, columns) {
  for (const col of columns) {
    if (col.terrain === 'water' || col.terrain === 'path' || col.terrain === 'farm') continue;
    const v = variantFor(col.terrain, col.q, col.r);
    col.sprite = v.sprite;
    col.frame = v.frame;
  }
}

/** Is an item gear the player wants to keep when they die? */
export const isKeepsake = id => ['tool', 'gear'].includes(ITEMS[id]?.kind);

/**
 * You fell. Wake at home with your tools and gear, but half of everything else
 * — and half your gold — is gone.
 */
export function penaltyOnDeath(state) {
  const lost = [];
  for (let i = 0; i < state.inventory.length; i++) {
    const s = state.inventory[i];
    if (!s || isKeepsake(s.id)) continue;
    const drop = Math.floor(s.qty / 2);
    if (!drop) continue;
    s.qty -= drop;
    lost.push({ id: s.id, qty: drop });
    if (s.qty <= 0) state.inventory[i] = null;
  }
  const gold = Math.floor((state.gold || 0) / 2);
  state.gold -= gold;
  return { lost, gold };
}

export { hasRoomFor };
