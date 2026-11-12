// crafting.js
// Whether a recipe can be made, and why not.
//
//   tools: [ 'forge', ['wood_tongs', 'iron_tongs'] ]
//     A list of slots. A slot is one required item, or an array meaning any one
//     of them will do — the redundancy that stops one missing tool from
//     dead-ending a whole branch. A slot naming a structure is satisfied by
//     standing next to one you built, or at a village that trusts you and keeps
//     one (see economy.js).
//
//   needs: [ 'skill:mind:3', ['built:hut', ...] ]
//     Gates that are not about where you are standing.
//
// The check returns its reasons rather than a bare boolean, because a crafting
// list that says only "no" is unplayable in an economy with this many gates.

import { RECIPES, isBuilding, BUILD_REACH, builtNear, hasBuilt, itemName, isFree } from './state.js';
import { countItem, hasRoomFor, addItem, removeItem, canSpend, spend } from './inventory.js';
import { addXp, levelOf } from './skills.js';

/** Normalise `tools` into a list of any-of slots. */
export function toolSlots(recipe) {
  if (!recipe.tools) return [];
  return recipe.tools.map(slot => (Array.isArray(slot) ? slot : [slot]));
}

/** Normalise `needs` into a list of any-of requirement groups. */
export function needGroups(recipe) {
  if (!recipe.needs) return [];
  return recipe.needs.map(n => (Array.isArray(n) ? n : [n]));
}

export function meetsRequirement(state, req) {
  const [kind, a, b] = req.split(':');
  if (kind === 'skill') return levelOf(state, a) >= Number(b);
  if (kind === 'built') return hasBuilt(state, a);
  return false;
}

export function describeRequirement(req) {
  const [kind, a, b] = req.split(':');
  if (kind === 'skill') return `${a} level ${b}`;
  if (kind === 'built') return `a ${itemName(a)}`;
  return req;
}

/** What a recipe costs in energy: a little more for the advanced ones. */
export const energyCost = recipe => (recipe.category === 'build' ? 2 : 0.5) + Math.floor((recipe.level - 1) / 2) * 0.5;

/**
 * How a single tool slot could be filled.
 * @returns {{id:string, via:'carried'|'built'|'village'}|null}
 */
function fillToolSlot(state, slot, ctx) {
  for (const id of slot) {
    if (!isBuilding(id) && countItem(state, id) > 0) return { id, via: 'carried' };
  }
  for (const id of slot) {
    if (isBuilding(id) && ctx.at && ctx.distance
      && builtNear(state, id, ctx.at, BUILD_REACH, ctx.distance)) {
      return { id, via: 'built' };
    }
  }
  // A village that trusts you lets you work at its station.
  const v = ctx.village;
  if (v?.trusted && v.station) {
    for (const id of slot) if (id === v.station) return { id, via: 'village' };
  }
  return null;
}

/**
 * Everything standing between the player and this recipe.
 * @param ctx {{at?:{q,r}, village?:{station, trusted}, distance?:Function}}
 */
export function checkRecipe(state, recipeId, ctx = {}) {
  const recipe = RECIPES[recipeId];
  if (!recipe) return { ok: false, recipe: null, reasons: ['No such recipe.'] };

  const reasons = [];
  if (isFree(state)) {
    const out = Object.entries(recipe.output)[0];
    const noRoom = out && !isBuilding(out[0]) && !hasRoomFor(state, out[0], out[1]);
    return { ok: !noRoom, recipe, reasons: noRoom ? ['No room to carry it.'] : [], missingInputs: {}, toolPlan: [], energyNeeded: 0 };
  }

  const level = levelOf(state, recipe.skill);
  if (level < recipe.level) {
    reasons.push(`Needs ${recipe.skill} level ${recipe.level} (you are ${level}).`);
  }

  const missingInputs = {};
  for (const [id, qty] of Object.entries(recipe.inputs || {})) {
    const have = countItem(state, id);
    if (have < qty) {
      missingInputs[id] = qty - have;
      reasons.push(`Needs ${qty - have} more ${itemName(id)}.`);
    }
  }

  const toolPlan = [];
  for (const slot of toolSlots(recipe)) {
    const fill = fillToolSlot(state, slot, ctx);
    if (fill) toolPlan.push(fill);
    else {
      const where = slot.some(isBuilding) ? ' nearby' : '';
      reasons.push(`Needs ${slot.map(itemName).join(' or ')}${where}.`);
    }
  }

  for (const group of needGroups(recipe)) {
    if (!group.some(req => meetsRequirement(state, req))) {
      reasons.push(`Needs ${group.map(describeRequirement).join(' or ')}.`);
    }
  }

  const energyNeeded = energyCost(recipe);
  if (!canSpend(state, energyNeeded)) {
    reasons.push(`Needs ${energyNeeded} energy — carry some food.`);
  }

  const output = Object.entries(recipe.output)[0];
  if (output && !isBuilding(output[0]) && !hasRoomFor(state, output[0], output[1])) {
    reasons.push('No room to carry it.');
  }

  return { ok: reasons.length === 0, recipe, reasons, missingInputs, toolPlan, energyNeeded };
}

/**
 * Make it. Consumes inputs and energy, awards xp. A 'build' recipe does not hand
 * you the structure — the caller places it and records it.
 * @param extraCost  more inputs to take, beyond the recipe's own (a bridge's span)
 */
export function craft(state, recipeId, ctx = {}, extraCost = null) {
  const check = checkRecipe(state, recipeId, ctx);
  if (!check.ok) return { ok: false, reasons: check.reasons };
  const { recipe } = check;

  if (extraCost && !isFree(state)) {
    const short = Object.entries(extraCost).filter(([id, n]) => countItem(state, id) < n + (recipe.inputs[id] || 0));
    if (short.length) {
      return { ok: false, reasons: short.map(([id, n]) => `Needs ${n + (recipe.inputs[id] || 0)} ${itemName(id)} in all.`) };
    }
  }

  if (!isFree(state)) {
    spend(state, check.energyNeeded);
    for (const [id, qty] of Object.entries(recipe.inputs || {})) removeItem(state, id, qty);
    for (const [id, qty] of Object.entries(extraCost || {})) removeItem(state, id, qty);
  }

  const produced = [];
  const isBuild = recipe.category === 'build';
  for (const [id, qty0] of Object.entries(recipe.output)) {
    let qty = qty0;
    // Master Smith: a fifth level of metalworking wrings one more ingot out.
    if (id === 'ingot' && levelOf(state, 'metalworking') >= 5) qty += 1;
    if (!isBuild) addItem(state, id, qty);
    produced.push({ id, qty });
  }

  state.stats = state.stats || {};
  state.stats.crafted = (state.stats.crafted || 0) + 1;
  const levelsGained = addXp(state, recipe.skill, recipe.xp);
  return { ok: true, recipe, produced, levelsGained, isBuild, toolPlan: check.toolPlan };
}

/** Recipes grouped for the crafting panel, in skill then level order. */
export function recipesBySkill() {
  const out = {};
  for (const r of Object.values(RECIPES)) (out[r.skill] ||= []).push(r);
  for (const list of Object.values(out)) {
    list.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }
  return out;
}
