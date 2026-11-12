// economy.js
// Villages: the favour that earns their trust, and the trade it opens.
//
// A village will not deal with a stranger. Each asks one small favour first,
// sized to where you are in the game, and once it is done the village trades,
// lets you work at its station, and tells you about the land around it. That is
// the whole of the quest system: one more gate among the others.
//
// Each village has a kind (farmers, smiths...) which decides what it sells cheap
// and which station it lends. Not every world has every kind.

import { Rng } from '../core/rng.js';
import { ITEM_BASE_PRICES, ITEMS, VILLAGE_KINDS } from '../../data/game_data.js';
import { isBuilding, itemName, isFree } from './state.js';
import { addItem, removeItem, hasItem, hasRoomFor, countItem } from './inventory.js';

export const villageKey = (q, r) => `${q},${r}`;

export const kindOf = feature => VILLAGE_KINDS[feature?.kind] || VILLAGE_KINDS.farmers;

/** Gold a village pays for its favour. */
export const FAVOUR_REWARD = 12;

/**
 * Fill in a village's prices and favour the first time it is visited. Prices are
 * seeded off its coordinates, so they are the same every time you come back.
 */
export function ensureVillage(state, village, q, r, worldSeed = '') {
  const key = villageKey(q, r);
  state.trust ||= {};
  if (!state.trust[key]) {
    const kind = kindOf(village);
    // Your first village asks something easy; later ones expect more of you.
    const trusted = Object.values(state.trust).filter(t => t.done).length;
    const favour = kind.favours[Math.min(kind.favours.length - 1, trusted ? 1 : 0)];
    state.trust[key] = { done: false, favour: { ...favour } };
  }
  if (!state.prices[key]) {
    const rng = new Rng(`${worldSeed}:village:${key}`);
    const kind = kindOf(village);
    const extras = rng.shuffle(['berries', 'branch', 'stone', 'reed', 'hide', 'cord', 'meat', 'grain', 'herb', 'clay', 'flint'])
      .filter(id => !kind.sells.includes(id)).slice(0, 3);
    const prices = {};
    for (const id of kind.sells) prices[id] = Math.max(1, Math.round(ITEM_BASE_PRICES[id] * rng.range(0.7, 0.95)));
    for (const id of extras) prices[id] = Math.max(1, Math.round(ITEM_BASE_PRICES[id] * rng.range(1.0, 1.3)));
    state.prices[key] = prices;
  }
  return state.prices[key];
}

export const trustOf = (state, q, r) => state.trust?.[villageKey(q, r)] || null;
export const isTrusted = (state, q, r) => !!trustOf(state, q, r)?.done;

/** A village recently raided is shuttered until the next day. */
export const isRaided = (state, q, r) => (state.raidedUntil?.[villageKey(q, r)] ?? -1) > (state.time || 0);

/** What crafting needs to know about a village you are standing at. */
export function villageContext(state, col) {
  if (!col) return null;
  return {
    name: col.feature.name,
    kind: col.feature.kind,
    station: kindOf(col.feature).station,
    trusted: isTrusted(state, col.q, col.r) && !isRaided(state, col.q, col.r),
  };
}

/** Hand over the favour. Returns what happened for the UI to say. */
export function giveFavour(state, col) {
  const t = trustOf(state, col.q, col.r);
  if (!t || t.done) return { ok: false, message: 'They already trust you.' };
  const { item, qty } = t.favour;
  if (!isFree(state) && countItem(state, item) < qty) {
    return { ok: false, message: `They need ${qty} ${itemName(item)}. You have ${countItem(state, item)}.` };
  }
  if (!isFree(state)) removeItem(state, item, qty);
  t.done = true;
  state.gold += FAVOUR_REWARD;
  return { ok: true, message: `${col.feature.name} trusts you now. They pay you ${FAVOUR_REWARD} gold.` };
}

export const stockOf = (state, q, r) => state.prices[villageKey(q, r)] || {};

/** What a village pays for something: half its worth, a third if they make it. */
export function sellPrice(feature, itemId) {
  const base = ITEM_BASE_PRICES[itemId] ?? 1;
  const theirs = kindOf(feature).sells.includes(itemId);
  return Math.max(1, Math.floor(base * (theirs ? 0.34 : 0.5)));
}

export function buy(state, col, itemId) {
  const { q, r } = col;
  if (!isTrusted(state, q, r)) return { ok: false, message: 'They will not trade with a stranger.' };
  if (isRaided(state, q, r)) return { ok: false, message: 'The stalls are wrecked. Come back tomorrow.' };
  const price = stockOf(state, q, r)[itemId];
  if (price == null) return { ok: false, message: 'They do not sell that.' };
  const free = isFree(state);
  if (!free && state.gold < price) return { ok: false, message: 'Not enough gold.' };
  if (!hasRoomFor(state, itemId, 1)) return { ok: false, message: 'No room to carry it.' };
  if (!free) state.gold -= price;
  addItem(state, itemId, 1);
  return { ok: true, message: `Bought ${itemName(itemId)} for ${price}g.`, price };
}

export function sell(state, col, itemId) {
  const { q, r } = col;
  if (!isTrusted(state, q, r)) return { ok: false, message: 'They will not trade with a stranger.' };
  if (isRaided(state, q, r)) return { ok: false, message: 'The stalls are wrecked. Come back tomorrow.' };
  if (!hasItem(state, itemId, 1)) return { ok: false, message: `You have no ${itemName(itemId)}.` };
  if (isBuilding(itemId) || !ITEMS[itemId]) return { ok: false, message: 'That is not yours to sell.' };
  const price = sellPrice(col.feature, itemId);
  removeItem(state, itemId, 1);
  state.gold += price;
  return { ok: true, message: `Sold ${itemName(itemId)} for ${price}g.`, price };
}
