// drops.js
// Loot on the ground. A raider that falls, and a player who falls, leave what
// they carried lying where they went down, for whoever walks over and picks it
// up: you click the pile. Piles on one hex are one pile.
//
// state.drops: [{ id, q, r, gold, items: [{ id, qty }] }], part of the shared
// world. In a room only the host changes it (see src/net/multiplayer.js).

import { addItem } from './inventory.js';
import { itemName } from './state.js';

/** Put loot on the ground at (q, r). Returns the pile it went into, or null if there was nothing. */
export function addDrop(state, q, r, { gold = 0, items = [] } = {}) {
  const goods = items.filter(s => s && s.qty > 0).map(s => ({ id: s.id, qty: s.qty }));
  if (!(gold > 0) && !goods.length) return null;
  state.drops ||= [];
  let pile = state.drops.find(d => d.q === q && d.r === r);
  if (!pile) {
    state.dropSeq = (state.dropSeq || 0) + 1;
    pile = { id: `d${state.dropSeq}`, q, r, gold: 0, items: [] };
    state.drops.push(pile);
  }
  pile.gold += Math.max(0, Math.floor(gold || 0));
  for (const s of goods) {
    const have = pile.items.find(x => x.id === s.id);
    if (have) have.qty += s.qty;
    else pile.items.push(s);
  }
  return pile;
}

/** The pile on (q, r), if any. */
export const dropAt = (state, q, r) => (state.drops || []).find(d => d.q === q && d.r === r) || null;

/** Take a pile off the ground whole (the host hands it to whoever picked it up). */
export function removeDrop(state, id) {
  const pile = (state.drops || []).find(d => d.id === id) || null;
  if (pile) state.drops = state.drops.filter(d => d !== pile);
  return pile;
}

/**
 * Pick up as much of `pile` as you can carry. All the gold, and the goods that
 * fit in your pack. Returns { got: [{id, qty}], gold, left: [{id, qty}] }.
 */
export function takeLoot(state, pile) {
  const gold = Math.max(0, pile.gold || 0);
  state.gold = (state.gold || 0) + gold;
  const got = [];
  const left = [];
  for (const s of pile.items || []) {
    const n = addItem(state, s.id, s.qty);
    if (n) got.push({ id: s.id, qty: n });
    if (n < s.qty) left.push({ id: s.id, qty: s.qty - n });
  }
  return { got, gold, left };
}

/**
 * Pick up the pile on the ground here, in a game whose drops you keep yourself
 * (alone, or the host). What does not fit stays on the ground.
 */
export function pickUp(state, id) {
  const pile = (state.drops || []).find(d => d.id === id);
  if (!pile) return null;
  const res = takeLoot(state, pile);
  pile.gold = 0;
  pile.items = res.left;
  if (!res.left.length) state.drops = state.drops.filter(d => d !== pile);
  return res;
}

/** "12 gold, 2 Hide" for what you picked up (or what a pile holds). */
export function lootText({ gold = 0, got, items } = {}) {
  const goods = got || items || [];
  return [...(gold ? [`${gold} gold`] : []), ...goods.map(s => `${s.qty} ${itemName(s.id)}`)].join(', ');
}
