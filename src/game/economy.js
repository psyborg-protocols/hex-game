// economy.js
// Village trade and tool rental.
//
// Carried over from the old game: each village stocks a handful of goods at
// jittered prices and buys anything back at half. What is new is that a village
// also *lends* — the rentable tools are what stop a world where you have not yet
// forged a hammer from being a dead end, which is the same job the any-of tool
// slots do inside a recipe.

import { Rng } from '../core/rng.js';
import { ITEM_BASE_PRICES, ITEMS } from '../../data/game_data.js';
import { RECIPES, isBuilding, itemName } from './state.js';
import { addItem, removeItem, hasItem, hasRoomFor } from './inventory.js';

/** Structures and one-off goods are not market stock. */
const UNTRADEABLE = new Set([...Object.values(RECIPES)
  .filter(r => r.category === 'build')
  .flatMap(r => Object.keys(r.output))]);

/** Tools plausibly found in a village workshop, cheapest tiers first. */
const LENDABLE = [
  'stone_hammer', 'stone_chisel', 'stone_axe', 'quern', 'hearth', 'stone_oven',
  'pot', 'bone_saw', 'saw', 'knife', 'hammer', 'chisel', 'axe', 'whetstone',
  'stone_anvil', 'anvil', 'bone_tongs', 'tongs', 'bellows', 'forge', 'smokehouse',
];

export const villageKey = (q, r) => `${q},${r}`;

/**
 * Fill in a village's stock and workshop the first time it is visited. Seeded
 * off its own coordinates, so a village is the same every time you come back.
 */
export function ensureVillage(state, village, q, r, worldSeed = '') {
  const key = villageKey(q, r);
  if (state.prices[key]) return state.prices[key];

  const rng = new Rng(`${worldSeed}:village:${key}`);

  const stock = Object.keys(ITEM_BASE_PRICES).filter(id => !UNTRADEABLE.has(id));
  const chosen = rng.shuffle(stock.slice()).slice(0, rng.irange(5, 8));
  const prices = {};
  for (const id of chosen) {
    prices[id] = Math.max(1, Math.round(ITEM_BASE_PRICES[id] * rng.range(0.8, 1.2)));
  }
  state.prices[key] = prices;

  if (village && !village.rentableTools?.length) {
    const pool = LENDABLE.filter(id => ITEMS[id]);
    village.rentableTools = rng.shuffle(pool.slice()).slice(0, rng.irange(2, 4));
  }
  return prices;
}

export const stockOf = (state, q, r) => state.prices[villageKey(q, r)] || {};

export function buy(state, q, r, itemId) {
  const price = stockOf(state, q, r)[itemId];
  if (price == null) return { ok: false, message: 'They do not sell that.' };
  if (state.gold < price) return { ok: false, message: 'Not enough gold.' };
  if (!hasRoomFor(state, itemId, 1)) return { ok: false, message: 'No room to carry it.' };

  state.gold -= price;
  addItem(state, itemId, 1);
  return { ok: true, message: `Bought ${itemName(itemId)} for ${price}g.`, price };
}

/** Villages buy at half what they ask — the spread is the point of travelling. */
export function sell(state, q, r, itemId) {
  const asking = stockOf(state, q, r)[itemId];
  if (asking == null) return { ok: false, message: 'They are not buying that.' };
  if (!hasItem(state, itemId, 1)) return { ok: false, message: `You have no ${itemName(itemId)}.` };
  if (isBuilding(itemId)) return { ok: false, message: 'That is not yours to sell.' };

  const price = Math.max(1, Math.floor(asking / 2));
  removeItem(state, itemId, 1);
  state.gold += price;
  return { ok: true, message: `Sold ${itemName(itemId)} for ${price}g.`, price };
}
