// inventory.js
// Slot-based carrying, and the food-as-energy rule the old game ran on:
// your energy *is* the food you are carrying, so provisioning is the constraint
// on how much work you can do before you have to go and eat.

import { ITEMS } from '../../data/game_data.js';

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
  let left = qty;

  for (let i = 0; i < state.inventory.length && left > 0; i++) {
    const slot = state.inventory[i];
    if (!slot || slot.id !== id) continue;
    const room = stack - slot.qty;
    if (room <= 0) continue;
    const add = Math.min(room, left);
    slot.qty += add;
    left -= add;
  }

  for (let i = 0; i < state.inventory.length && left > 0; i++) {
    if (state.inventory[i]) continue;
    const add = Math.min(stack, left);
    state.inventory[i] = { id, qty: add };
    left -= add;
  }

  const added = qty - left;
  if (added && item.food) recomputeEnergy(state);
  return added;
}

/** Remove `qty`. Returns false and changes nothing if there are not enough. */
export function removeItem(state, id, qty = 1) {
  if (!hasItem(state, id, qty)) return false;
  let left = qty;
  for (let i = 0; i < state.inventory.length && left > 0; i++) {
    const slot = state.inventory[i];
    if (!slot || slot.id !== id) continue;
    const take = Math.min(slot.qty, left);
    slot.qty -= take;
    left -= take;
    if (slot.qty <= 0) state.inventory[i] = null;
  }
  if (ITEMS[id]?.food) recomputeEnergy(state);
  return true;
}

/** Is there anywhere to put this at all? */
export function hasRoomFor(state, id, qty = 1) {
  const item = ITEMS[id];
  if (!item) return false;
  const stack = item.stack || 1;
  let room = 0;
  for (const slot of state.inventory) {
    if (!slot) room += stack;
    else if (slot.id === id) room += stack - slot.qty;
    if (room >= qty) return true;
  }
  return false;
}

export const freeSlots = state => state.inventory.filter(s => !s).length;

// ---------------------------------------------------------------- energy

/** Total nourishment carried. */
export function foodValue(state) {
  let total = 0;
  for (const slot of state.inventory) {
    const item = slot && ITEMS[slot.id];
    if (item?.food) total += item.food * slot.qty;
  }
  return total;
}

/** Energy is the food you carry, capped. Called on every food change. */
export function recomputeEnergy(state) {
  state.energy = Math.min(state.maxEnergy, foodValue(state));
  return state.energy;
}

/**
 * A step's worth of hunger. Every `STEPS_PER_MEAL` tiles you eat one food item;
 * with nothing to eat you burn energy instead, and then you are just starving.
 * @returns {{ate?:string, starving?:boolean}} what happened, for the UI to say.
 */
export const STEPS_PER_MEAL = 8;

export function walkOneStep(state) {
  state.stepsWalked++;
  if (state.stepsWalked % STEPS_PER_MEAL !== 0) return {};

  for (const slot of state.inventory) {
    if (slot && ITEMS[slot.id]?.food) {
      const id = slot.id;
      removeItem(state, id, 1);
      return { ate: id };
    }
  }

  if (state.energy > 0) {
    state.energy--;
    return { hungry: true };
  }
  return { starving: true };
}
