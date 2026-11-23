// gear.js
// What you wear (plus passive keepsakes like whetstone and dog), turned into
// numbers: attack and defence dice, reach, health, and move distance bonus.
//
// Weapons do not stack — you fight with the weapon worn in your hand — and
// armour slots stack across head, off-hand, and body.

import { ITEMS } from '../../data/game_data.js';
import { BASE_MAX_HP, SKILLS, WORN_SLOTS } from './state.js';
import { countItem, ensureWorn } from './inventory.js';
import { levelOf } from './skills.js';

const has = (state, id) => countItem(state, id) > 0;

/** Weapons a whetstone can sharpen. */
const EDGED = new Set(['stone_knife', 'stone_axe', 'iron_axe', 'pickaxe', 'sword']);

/** The weapon worn in your hand slot, if it has an attack rating. */
export function bestWeapon(state) {
  const handId = ensureWorn(state).hand;
  const item = handId && ITEMS[handId];
  return item?.attack ? item : null;
}

export const equippedWeapon = bestWeapon;

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
  const worn = ensureWorn(state);
  for (const s of WORN_SLOTS) {
    const id = worn[s.id];
    const item = id && ITEMS[id];
    if (!item?.defense || seen.has(item.id)) continue;
    seen.add(item.id);
    n += item.defense;
  }
  return n;
}

/** Hexes you can strike from. A bow reaches two while worn in hand. */
export function reach(state) {
  return ensureWorn(state).hand === 'bow' ? 2 : 1;
}

/** Total max move distance bonus per turn from worn gear (e.g., boots, walking stick). */
export function moveBonus(state) {
  let bonus = 0;
  const seen = new Set();
  const worn = ensureWorn(state);
  for (const s of WORN_SLOTS) {
    const id = worn[s.id];
    const item = id && ITEMS[id];
    if (!item?.moveBonus || seen.has(item.id)) continue;
    seen.add(item.id);
    bonus += item.moveBonus;
  }
  return bonus;
}

/** Build a complete 6-slot equipment + tool snapshot (plus cloak and colour) for sprite rendering. */
export function playerGearSnapshot(state) {
  const worn = ensureWorn(state);
  const hand = worn.hand || null;
  const chopTool = (hand === 'iron_axe' || hand === 'stone_axe')
    ? hand
    : (countItem(state, 'iron_axe') > 0 ? 'iron_axe' : (countItem(state, 'stone_axe') > 0 ? 'stone_axe' : null));
  const mineTool = (hand === 'pickaxe' || hand === 'stone_hammer')
    ? hand
    : (countItem(state, 'pickaxe') > 0 ? 'pickaxe' : (countItem(state, 'stone_hammer') > 0 ? 'stone_hammer' : null));
  return {
    head: worn.head || null,
    hand,
    offhand: worn.offhand || null,
    body: worn.body || null,
    feet: worn.feet || null,
    pack: worn.pack || null,
    chopTool,
    mineTool,
    cloak: !!state.cloak,
    color: state.playerColor || 'crimson',
  };
}

/** Health grows with all-round experience: +1 for every two levels gained. */
export function maxHp(state) {
  const gained = SKILLS.reduce((n, s) => n + levelOf(state, s) - 1, 0);
  return BASE_MAX_HP + Math.floor(gained / 2);
}
