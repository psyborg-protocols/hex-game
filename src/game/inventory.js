// inventory.js
// Slot-based carrying, and food as energy.
//
// Food is never "used". You carry it, and it tops your energy up on its own as
// work and walking spend it, cheapest food first and never wasting any. So the
// question provisioning asks is simply: how much work can I do before I have to
// go and find more? Better food packs more energy into each slot.

import { ITEMS } from '../../data/game_data.js';
import { isFree, BASE_SLOTS, BASE_MAX_ENERGY, hasBuilt } from './state.js';

// ---------------------------------------------------------------- capacity

/** Gear that opens pack slots counts once each, however many you carry. */
export function capacity(state) {
  let n = BASE_SLOTS;
  const seen = new Set();
  for (const slot of state.inventory) {
    const item = slot && ITEMS[slot.id];
    if (item?.slots && !seen.has(slot.id)) { seen.add(slot.id); n += item.slots; }
  }
  return Math.min(state.inventory.length, n);
}

export function countItem(state, id) {
  let n = 0;
  for (const slot of state.inventory) if (slot && slot.id === id) n += slot.qty;
  return n;
}

export const hasItem = (state, id, qty = 1) => countItem(state, id) >= qty;

/**
 * Add up to `qty`, topping up part-filled stacks before opening new slots.
 * @returns {number} how many actually fitted.
 */
export function addItem(state, id, qty = 1) {
  const item = ITEMS[id];
  if (!item) return 0;
  const stack = item.stack || 1;
  const cap = capacity(state);
  let left = qty;

  for (let i = 0; i < state.inventory.length && left > 0; i++) {
    const slot = state.inventory[i];
    if (!slot || slot.id !== id) continue;
    const add = Math.min(stack - slot.qty, left);
    if (add <= 0) continue;
    slot.qty += add;
    left -= add;
  }

  for (let i = 0; i < cap && left > 0; i++) {
    if (state.inventory[i]) continue;
    const add = Math.min(stack, left);
    state.inventory[i] = { id, qty: add };
    left -= add;
  }

  return qty - left;
}

/** Remove `qty`. Returns false and changes nothing if there are not enough. */
export function removeItem(state, id, qty = 1) {
  if (!hasItem(state, id, qty)) return false;
  let left = qty;
  for (let i = state.inventory.length - 1; i >= 0 && left > 0; i--) {
    const slot = state.inventory[i];
    if (!slot || slot.id !== id) continue;
    const take = Math.min(slot.qty, left);
    slot.qty -= take;
    left -= take;
    if (slot.qty <= 0) state.inventory[i] = null;
  }
  return true;
}

/** Is there anywhere to put this at all? */
export function hasRoomFor(state, id, qty = 1) {
  const item = ITEMS[id];
  if (!item) return false;
  const stack = item.stack || 1;
  const cap = capacity(state);
  let room = 0;
  for (let i = 0; i < state.inventory.length; i++) {
    const slot = state.inventory[i];
    if (!slot) { if (i < cap) room += stack; }
    else if (slot.id === id) room += stack - slot.qty;
    if (room >= qty) return true;
  }
  return false;
}

export const usedSlots = state => state.inventory.filter(Boolean).length;
export const freeSlots = state => capacity(state) - usedSlots(state);

// ---------------------------------------------------------------- energy

export function maxEnergy(state) {
  return BASE_MAX_ENERGY + (hasBuilt(state, 'hut') ? 6 : 0);
}

/** Total nourishment carried and not yet eaten. */
export function foodValue(state) {
  let total = 0;
  for (const slot of state.inventory) {
    const item = slot && ITEMS[slot.id];
    if (item?.food) total += item.food * slot.qty;
  }
  return total;
}

/**
 * What gets eaten first. Ready food before raw (so the meat you meant to cook is
 * still there when you reach the hearth), and grain last, because it is seed.
 */
const EAT_ORDER = ['berries', 'bread', 'meal', 'rations', 'stew', 'fish', 'meat', 'grain'];

/** Raw food is saved for the hearth, and only eaten when you are nearly spent. */
const RAW = new Set(['fish', 'meat', 'grain']);

/** You eat once the tank drops below this share of its size... */
export const HUNGRY_AT = 0.4;
/** ...and eat raw food only below this. */
export const STARVING_AT = 0.15;

/**
 * Eat from the pack when you are getting low, in EAT_ORDER, and only food that
 * fits whole — so nothing is wasted.
 * @returns {string[]} what was eaten
 */
export function topUp(state, force = false) {
  if (isFree(state)) { state.energy = maxEnergy(state); return []; }
  const max = maxEnergy(state);
  if (!force && state.energy >= max * HUNGRY_AT) return [];
  const eaten = [];
  // A bite at a time, just enough to stay above the line: what you carry stays
  // in your pack, visible, until you actually need it.
  for (let guard = 0; guard < 200 && state.energy < max * HUNGRY_AT; guard++) {
    const desperate = force || state.energy < max * STARVING_AT;
    const id = EAT_ORDER.find(f => countItem(state, f) > 0 && state.energy + ITEMS[f].food <= max
      && (desperate || !RAW.has(f)));
    if (!id) break;
    removeItem(state, id, 1);
    state.energy += ITEMS[id].food;
    eaten.push(id);
  }
  return eaten;
}

/** Kept for older callers: the tank after eating what fits. */
export function recomputeEnergy(state) {
  state.energy = Math.min(state.energy ?? 0, maxEnergy(state));
  topUp(state);
  return state.energy;
}

/** Can you afford this much work? Eats first if it has to. */
export function canSpend(state, n) {
  if (isFree(state) || n <= 0) return true;
  if (state.energy < n) topUp(state, true);
  // Out of room to top up without waste, but starving: eat anyway.
  while (state.energy < n && eatAnything(state));
  return state.energy >= n;
}

/** Spend energy on work. Returns false (and spends nothing) if you cannot. */
export function spend(state, n) {
  if (isFree(state) || n <= 0) return true;
  if (!canSpend(state, n)) return false;
  state.energy -= n;
  topUp(state);
  return true;
}

function eatAnything(state) {
  const id = EAT_ORDER.find(f => countItem(state, f) > 0);
  if (!id) return null;
  removeItem(state, id, 1);
  state.energy = Math.min(maxEnergy(state), state.energy + ITEMS[id].food);
  return id;
}

/** Steps per point of energy spent walking. */
export const STEPS_PER_ENERGY = 8;

/**
 * A step's worth of hunger.
 * @returns {{exhausted?:boolean}} what happened, for the UI to say.
 */
export function walkOneStep(state, { cartOnRoad = false } = {}) {
  state.stepsWalked++;
  if (isFree(state)) return {};
  if (state.stepsWalked % (cartOnRoad ? STEPS_PER_ENERGY * 2 : STEPS_PER_ENERGY) !== 0) return {};
  if (state.energy > 0 || canSpend(state, 1)) {
    state.energy = Math.max(0, state.energy - 1);
    topUp(state);
    return { exhausted: state.energy <= 0 && foodValue(state) === 0 };
  }
  return { exhausted: true };
}
