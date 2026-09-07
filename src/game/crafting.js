// crafting.js
// Whether a recipe can be made, and why not.
//
// data/game_data.js encodes three things the old 3-skill module had no notion of,
// and all three are load-bearing for the design in skill_map.md:
//
//   tools: [ 'quern', ['hearth', 'stone_oven'] ]
//     A list of slots. A slot is one required item, or an array meaning any one
//     of them will do — the redundancy that stops a single missing tool from
//     dead-ending a whole branch.
//
//   needs: [ 'built:hearth', ['built:cabin', 'built:stone_house'] ]
//     World-scarcity gates: a structure that must exist, or a skill level that
//     must be reached. Nested arrays are any-of again.
//
//   Structures as tools.
//     A forge is not carried. A tool slot naming something with a 'build'
//     recipe is satisfied by standing at one, not by holding it.
//
// The check returns its reasons rather than a bare boolean, because a crafting
// list that says only "no" is unplayable in an economy with this many gates.

import { RECIPES, isBuilding, BUILD_REACH, builtNear, hasBuilt, itemName } from './state.js';
import { ITEM_BASE_PRICES } from '../../data/game_data.js';
import { countItem, hasRoomFor, addItem, removeItem } from './inventory.js';
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

/** Is one 'skill:x:n' or 'built:item' requirement met? */
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

/**
 * Work out how a single tool slot could be filled.
 * @returns {{id:string, via:'carried'|'built'|'rented', fee:number}|null}
 */
function fillToolSlot(state, slot, ctx) {
  // Carrying it is always simplest.
  for (const id of slot) {
    if (!isBuilding(id) && countItem(state, id) > 0) return { id, via: 'carried', fee: 0 };
  }
  // Working at a structure you have built.
  for (const id of slot) {
    if (isBuilding(id) && ctx.at && ctx.distance
      && builtNear(state, id, ctx.at, BUILD_REACH, ctx.distance)) {
      return { id, via: 'built', fee: 0 };
    }
  }
  // Borrowing the village's. Its own infrastructure is free to use; a tool costs.
  const village = ctx.village;
  if (village?.rentableTools?.length) {
    for (const id of slot) {
      if (!village.rentableTools.includes(id)) continue;
      const fee = isBuilding(id) ? 0 : rentalFee(id);
      if (state.gold >= fee) return { id, via: 'rented', fee };
    }
  }
  return null;
}

/** Renting a tool costs a fifth of its worth, with a floor so nothing is free. */
export const rentalFee = id => Math.max(5, Math.floor((ITEM_BASE_PRICES[id] ?? 20) * 0.2));

/**
 * Everything standing between the player and this recipe.
 *
 * @param ctx {{at?:{q,r}, village?:object, distance?:(q1,r1,q2,r2)=>number}}
 */
export function checkRecipe(state, recipeId, ctx = {}) {
  const recipe = RECIPES[recipeId];
  if (!recipe) return { ok: false, recipe: null, reasons: ['No such recipe.'] };

  const reasons = [];

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
    else reasons.push(`Needs ${slot.map(itemName).join(' or ')}.`);
  }

  for (const group of needGroups(recipe)) {
    if (!group.some(req => meetsRequirement(state, req))) {
      reasons.push(`Needs ${group.map(describeRequirement).join(' or ')}.`);
    }
  }

  const energyNeeded = recipe.level;
  if (state.energy < energyNeeded) {
    reasons.push(`Needs ${energyNeeded} energy — eat something.`);
  }

  const fees = toolPlan.reduce((n, t) => n + t.fee, 0);
  if (fees > state.gold) reasons.push(`Needs ${fees} gold in rental fees.`);

  const output = Object.entries(recipe.output)[0];
  if (output && !isBuilding(output[0]) && !hasRoomFor(state, output[0], output[1])) {
    reasons.push('No room to carry it.');
  }

  return { ok: reasons.length === 0, recipe, reasons, missingInputs, toolPlan, fees, energyNeeded };
}

/**
 * Make it. Consumes inputs and rental fees, awards xp.
 *
 * A 'build' recipe does not hand you the structure — the caller places it in the
 * world and calls recordBuilt. Everything else goes into the pack.
 */
export function craft(state, recipeId, ctx = {}) {
  const check = checkRecipe(state, recipeId, ctx);
  if (!check.ok) return { ok: false, reasons: check.reasons };

  const { recipe, toolPlan } = check;
  for (const t of toolPlan) if (t.fee) state.gold -= t.fee;
  for (const [id, qty] of Object.entries(recipe.inputs || {})) removeItem(state, id, qty);

  const produced = [];
  const isBuild = recipe.category === 'build';
  for (const [id, qty] of Object.entries(recipe.output)) {
    if (!isBuild) addItem(state, id, qty);
    produced.push({ id, qty });
  }

  const levelsGained = addXp(state, recipe.skill, recipe.xp);
  const rented = toolPlan.filter(t => t.via === 'rented');

  return { ok: true, recipe, produced, levelsGained, rented, isBuild };
}

/** Recipes grouped for the crafting panel, in skill then level order. */
export function recipesBySkill({ includeGathers = false } = {}) {
  const out = {};
  for (const r of Object.values(RECIPES)) {
    if (r.gather && !includeGathers) continue;
    (out[r.skill] ||= []).push(r);
  }
  for (const list of Object.values(out)) {
    list.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
  }
  return out;
}

export const gatherRecipes = () => Object.values(RECIPES).filter(r => r.gather);
