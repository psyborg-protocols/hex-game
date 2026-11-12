// gear.js
// What you carry, turned into numbers: attack and defence dice, reach, health.
//
// Weapons do not stack — you fight with the best one you have — but armour does,
// one of each kind. This is the whole of the combat maths the player has to hold
// in their head: more dice is better.

import { ITEMS } from '../../data/game_data.js';
import { BASE_MAX_HP, SKILLS } from './state.js';
import { countItem } from './inventory.js';
import { levelOf } from './skills.js';

const has = (state, id) => countItem(state, id) > 0;

/** Weapons a whetstone can sharpen. */
const EDGED = new Set(['stone_knife', 'stone_axe', 'iron_axe', 'pickaxe', 'sword']);

/** The weapon you would swing: highest attack carried. */
export function bestWeapon(state) {
  let best = null;
  for (const slot of state.inventory) {
    const item = slot && ITEMS[slot.id];
    if (!item?.attack) continue;
    if (!best || item.attack > best.attack) best = item;
  }
  return best;
}

export function attackDice(state) {
  const w = bestWeapon(state);
  let n = w ? w.attack : 1;   // fists
  if (w && EDGED.has(w.id) && has(state, 'whetstone')) n += 1;
  if (has(state, 'dog')) n += 1;
  return n;
}

export function defenseDice(state) {
  let n = 1;
  const seen = new Set();
  for (const slot of state.inventory) {
    const item = slot && ITEMS[slot.id];
    if (!item?.defense || seen.has(item.id)) continue;
    seen.add(item.id);
    n += item.defense;
  }
  return n;
}

/** Hexes you can strike from. A bow reaches two. */
export function reach(state) {
  return has(state, 'bow') ? 2 : 1;
}

/** Health grows with all-round experience: +1 for every two levels gained. */
export function maxHp(state) {
  const gained = SKILLS.reduce((n, s) => n + levelOf(state, s) - 1, 0);
  return BASE_MAX_HP + Math.floor(gained / 2);
}
