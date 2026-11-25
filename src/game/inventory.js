// inventory.js
// Slot-based carrying, and food as energy.
//
// Food is never "used". You carry it, and it tops your energy up on its own as
// work and walking spend it, cheapest food first and never wasting any. So the
// question provisioning asks is simply: how much work can I do before I have to
// go and find more? Better food packs more energy into each slot.

import { ITEMS } from '../../data/game_data.js';
import { goalOwner } from './shared.js';
import { isFree, BASE_SLOTS, BASE_MAX_ENERGY, WORN_SLOTS, createWorn, hasBuilt, fatigueOf, FATIGUE } from './state.js';

export const MAX_BITES_PER_TURN = 1;

// ------------------------------------------------------------------ layout
//
// The first FOOD_SLOTS slots of the pack are for food alone: anything you eat,
// and salve. Food goes there first and spills into the main pack when they are
// full; nothing else ever goes in them. capacity() counts both parts.

export const FOOD_SLOTS = 4;

/** Food, for the food slots: anything with energy in it, and salve. */
export const isFood = id => !!(ITEMS[id]?.food || ITEMS[id]?.heal);

/** The pack slots `id` may go in, in the order to try them, below `limit`. */
function slotOrder(state, id, limit) {
  const out = [];
  if (isFood(id)) for (let i = 0; i < Math.min(FOOD_SLOTS, limit); i++) out.push(i);
  for (let i = FOOD_SLOTS; i < limit; i++) out.push(i);
  return out;
}

/** The first empty slot `id` may go in (below `limit`, capacity by default), or -1. */
export function freeSlotFor(state, id, limit = capacity(state)) {
  for (const i of slotOrder(state, id, limit)) if (!state.inventory[i]) return i;
  return -1;
}

/**
 * Sort a pack from before the food slots into them. Food stays where it is unless
 * it has to move; anything else in a food slot moves into the main pack (past the
 * end of it, if a full old pack has more than the main pack now holds).
 */
export function ensurePackLayout(state) {
  const inv = state.inventory;
  if (!inv || !inv.slice(0, FOOD_SLOTS).some(s => s && !isFood(s.id))) return false;
  const items = inv.filter(Boolean);
  inv.fill(null);
  const cap = capacity(state);
  for (const s of items) {
    let i = freeSlotFor(state, s.id, cap);
    if (i < 0) i = inv.findIndex((x, j) => j >= Math.max(cap, FOOD_SLOTS) && !x);
    if (i >= 0) inv[i] = s;
  }
  return true;
}

// ------------------------------------------------------------- lent tools
//
// A tool a village master lent you for an errand (jobs.js) is yours to use, not
// to sell, trade, drop, toss or stash: the errand, or the debt if you were let go,
// names it. While it does, that many of the tool are held back.

export function lentCount(state, id) {
  const j = state.jobs;
  if (!j) return 0;
  let n = (j.errand?.lent || []).filter(x => x === id).length;
  for (const o of j.owed || []) n += (o.items || []).filter(x => x === id).length;
  return n;
}

/** Can you part with `qty` of `id` and still have what you were lent? */
export const canPart = (state, id, qty = 1) => countItem(state, id) - qty >= lentCount(state, id);

/** Who lent you `id`, if you have no copy of your own to spare. */
export function lentBy(state, id) {
  const j = state.jobs;
  if (!j || canPart(state, id, 1)) return null;
  if (j.errand?.lent?.includes(id)) return j.errand.name;
  return (j.owed || []).find(o => o.items?.includes(id))?.name || null;
}

/**
 * Take `qty` (all of it if omitted) from pack slot `index`, to drop or toss.
 * Refused for what you were lent. Returns { ok, id, qty } or { ok: false, reason }.
 */
export function takeFromPack(state, index, qty = null) {
  const slot = state.inventory[index];
  if (!slot) return { ok: false, reason: 'Nothing there.' };
  const n = Math.max(1, Math.min(slot.qty, qty ?? slot.qty));
  if (!canPart(state, slot.id, n)) {
    return { ok: false, reason: `That ${ITEMS[slot.id]?.name || slot.id} was lent to you by ${lentBy(state, slot.id) || 'a master'}. Return it.` };
  }
  slot.qty -= n;
  if (slot.qty <= 0) state.inventory[index] = null;
  return { ok: true, id: slot.id, qty: n };
}

/** Take off what is worn in `slotKey` without putting it in the pack (to drop it). */
export function takeFromWorn(state, slotKey) {
  const worn = ensureWorn(state);
  const id = worn[slotKey];
  if (!id) return { ok: false, reason: 'Nothing worn there.' };
  if (!canPart(state, id, 1)) return { ok: false, reason: `That was lent to you by ${lentBy(state, id) || 'a master'}. Return it.` };
  if (slotKey === 'pack' && usedSlots(state) > BASE_SLOTS) return { ok: false, reason: 'Make room in your pack before taking that off.' };
  worn[slotKey] = null;
  if (slotKey === 'pack') compactBelow(state, BASE_SLOTS);
  return { ok: true, id, qty: 1 };
}

// ------------------------------------------------------------------ worn

export function ensureWorn(state) {
  if (!state.worn) state.worn = createWorn();
  for (const s of WORN_SLOTS) if (!(s.id in state.worn)) state.worn[s.id] = null;
  // Migrate saves where walking_stick lived in offhand before moving to hand.
  if (state.worn.offhand === 'walking_stick') {
    state.worn.offhand = null;
    if (!state.worn.hand) {
      state.worn.hand = 'walking_stick';
    } else if (Array.isArray(state.inventory)) {
      const idx = state.inventory.findIndex(x => !x);
      if (idx >= 0) state.inventory[idx] = { id: 'walking_stick', qty: 1 };
    }
  }
  return state.worn;
}

export function isWorn(state, id) {
  const worn = ensureWorn(state);
  return WORN_SLOTS.some(s => worn[s.id] === id);
}

export function wornItem(state, slotId) {
  return ensureWorn(state)[slotId] || null;
}

// ---------------------------------------------------------------- capacity

/** Only a worn pack (basket, leather pack, or cart) opens extra pack slots. */
export function capacity(state) {
  const packId = ensureWorn(state).pack;
  const bonus = packId ? (ITEMS[packId]?.slots || 0) : 0;
  return Math.min(state.inventory.length, BASE_SLOTS + bonus);
}

export function countInPack(state, id) {
  let n = 0;
  for (const slot of state.inventory) if (slot && slot.id === id) n += slot.qty;
  return n;
}

export function countItem(state, id) {
  let n = countInPack(state, id);
  const worn = ensureWorn(state);
  for (const s of WORN_SLOTS) if (worn[s.id] === id) n += 1;
  return n;
}

export const hasItem = (state, id, qty = 1) => countItem(state, id) >= qty;

/**
 * Add up to `qty`, auto-equipping into an empty worn slot if wearable, then
 * topping up part-filled pack stacks before opening new pack slots.
 * @returns {number} how many actually fitted.
 */
export function addItem(state, id, qty = 1) {
  const item = ITEMS[id];
  if (!item) return 0;
  const stack = item.stack || 1;
  const worn = ensureWorn(state);
  let left = qty;

  if (item.slot && !worn[item.slot] && left > 0) {
    worn[item.slot] = id;
    left -= 1;
  }

  const cap = capacity(state);
  for (let i = 0; i < state.inventory.length && left > 0; i++) {
    const slot = state.inventory[i];
    if (!slot || slot.id !== id) continue;
    const add = Math.min(stack - slot.qty, left);
    if (add <= 0) continue;
    slot.qty += add;
    left -= add;
  }

  for (const i of slotOrder(state, id, cap)) {
    if (left <= 0) break;
    if (state.inventory[i]) continue;
    const add = Math.min(stack, left);
    state.inventory[i] = { id, qty: add };
    left -= add;
  }

  const added = qty - left;
  if (added > 0) (state.seen ||= {})[id] = 1;
  return added;
}

/** Whether the player has held or built this item yet (used to reveal recipes). */
export function hasSeenItem(state, id) {
  return !!(state?.seen?.[id] || countItem(state, id) > 0 || hasBuilt(state, id));
}

/** Remove `qty` from pack first, then from worn slots if needed. */
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
  if (left > 0) {
    const worn = ensureWorn(state);
    for (const s of WORN_SLOTS) {
      if (left <= 0) break;
      if (worn[s.id] === id) {
        worn[s.id] = null;
        left -= 1;
      }
    }
  }
  return true;
}

/** Keep pack entries packed below `limit` when capacity shrinks. */
function compactBelow(state, limit) {
  for (let i = limit; i < state.inventory.length; i++) {
    if (!state.inventory[i]) continue;
    const dst = freeSlotFor(state, state.inventory[i].id, limit);
    if (dst < 0) return false;
    state.inventory[dst] = state.inventory[i];
    state.inventory[i] = null;
  }
  return true;
}

/**
 * Put on a donnable item (the Hooded Cloak) from `packIndex`. It leaves the pack
 * and becomes part of you for good; there is no taking it off.
 */
export function donFromPack(state, packIndex) {
  const slot = state.inventory[packIndex];
  const item = slot && ITEMS[slot.id];
  if (!item?.don) return { ok: false, reason: 'You cannot put that on.' };
  if (state.cloak) return { ok: false, reason: 'You already wear a cloak.' };
  slot.qty -= 1;
  if (slot.qty <= 0) state.inventory[packIndex] = null;
  state.cloak = true;
  return { ok: true, donned: item.id };
}

/** Equip a wearable item from `packIndex`, swapping with any item already in that worn slot. */
export function equipFromPack(state, packIndex) {
  const slot = state.inventory[packIndex];
  const item = slot && ITEMS[slot.id];
  if (!item?.slot) return { ok: false, reason: 'You cannot wear that.' };

  const worn = ensureWorn(state);
  const slotKey = item.slot;
  const prev = worn[slotKey];

  if (slotKey === 'pack') {
    const newCap = Math.min(state.inventory.length, BASE_SLOTS + (item.slots || 0));
    const needed = prev ? usedSlots(state) : Math.max(0, usedSlots(state) - 1);
    if (needed > newCap) return { ok: false, reason: 'Make room in your pack before swapping to a smaller pack.' };
  }

  if (slot.qty > 1) {
    if (prev && !hasRoomFor(state, prev, 1)) return { ok: false, reason: 'Your pack is full.' };
    slot.qty -= 1;
    worn[slotKey] = slot.id;
    if (prev) addItem(state, prev, 1);
  } else {
    state.inventory[packIndex] = prev ? { id: prev, qty: 1 } : null;
    worn[slotKey] = slot.id;
  }

  if (slotKey === 'pack') compactBelow(state, capacity(state));
  return { ok: true, equipped: item.id, replaced: prev, slot: slotKey };
}

/** Take off the item in `slotKey` and return it to the pack. */
export function unequipSlot(state, slotKey) {
  const worn = ensureWorn(state);
  const id = worn[slotKey];
  if (!id) return { ok: false, reason: 'Nothing worn there.' };

  if (slotKey === 'pack') {
    if (usedSlots(state) + 1 > BASE_SLOTS) {
      return { ok: false, reason: 'Make room in your pack before taking that off.' };
    }
    compactBelow(state, BASE_SLOTS);
    const dst = freeSlotFor(state, id, BASE_SLOTS);
    if (dst < 0) return { ok: false, reason: 'Your pack is full.' };
    worn[slotKey] = null;
    state.inventory[dst] = { id, qty: 1 };
    return { ok: true, unequipped: id };
  }

  const dst = freeSlotFor(state, id);
  if (dst < 0) return { ok: false, reason: 'Your pack is full.' };
  worn[slotKey] = null;
  state.inventory[dst] = { id, qty: 1 };
  return { ok: true, unequipped: id };
}

/** Is there anywhere to put this at all? */
export function hasRoomFor(state, id, qty = 1) {
  const item = ITEMS[id];
  if (!item) return false;
  const stack = item.stack || 1;
  const allowed = new Set(slotOrder(state, id, capacity(state)));
  let room = 0;
  for (let i = 0; i < state.inventory.length; i++) {
    const slot = state.inventory[i];
    if (!slot) { if (allowed.has(i)) room += stack; }
    else if (slot.id === id) room += stack - slot.qty;
    if (room >= qty) return true;
  }
  return false;
}

export const usedSlots = state => state.inventory.filter(Boolean).length;
export const freeSlots = state => capacity(state) - usedSlots(state);

// ---------------------------------------------------------------- energy

/** Max energy when well rested. */
export function restedMaxEnergy(state) {
  return BASE_MAX_ENERGY + (hasBuilt(state, 'hut', goalOwner(state)) ? 6 : 0);
}

/** Max energy right now: staying up past midnight takes a share of it all the next day. */
export function maxEnergy(state) {
  const full = restedMaxEnergy(state);
  const level = fatigueOf(state);
  return level ? Math.round(full * (1 - FATIGUE[level].cut)) : full;
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

export const canEatMore = state => (state.eatenThisTurn || 0) < MAX_BITES_PER_TURN;

/**
 * Eat from the pack when you are getting low, in EAT_ORDER, at most
 * MAX_BITES_PER_TURN per turn, and only food that fits whole — so nothing is wasted.
 * @returns {string[]} what was eaten
 */
export function topUp(state, force = false) {
  if (isFree(state)) { state.energy = maxEnergy(state); return []; }
  const max = maxEnergy(state);
  if (!force && state.energy >= max * HUNGRY_AT) return [];
  const eaten = [];
  const target = force ? max : max * HUNGRY_AT;
  // Rate-limited to MAX_BITES_PER_TURN per turn: staying up too late drains
  // energy faster than eating can replenish it.
  while (canEatMore(state) && state.energy < target) {
    const desperate = force || state.energy < max * STARVING_AT;
    const id = EAT_ORDER.find(f => countInPack(state, f) > 0 && state.energy + ITEMS[f].food <= max
      && (desperate || !RAW.has(f)));
    if (!id) break;
    removeItem(state, id, 1);
    state.energy += ITEMS[id].food;
    state.eatenThisTurn = (state.eatenThisTurn || 0) + 1;
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

/** Can you afford this much work? Eats first if it has to (respecting turn bite limit). */
export function canSpend(state, n) {
  if (isFree(state) || n <= 0) return true;
  if (state.energy < n) topUp(state, true);
  // Out of room to top up without waste, but starving: eat anyway if bite limit permits.
  while (state.energy < n && canEatMore(state) && eatAnything(state));
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
  if (!canEatMore(state)) return null;
  const id = EAT_ORDER.find(f => countInPack(state, f) > 0);
  if (!id) return null;
  removeItem(state, id, 1);
  state.energy = Math.min(maxEnergy(state), state.energy + ITEMS[id].food);
  state.eatenThisTurn = (state.eatenThisTurn || 0) + 1;
  return id;
}

/** Steps per point of energy spent walking. */
export const STEPS_PER_ENERGY = 4;

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
