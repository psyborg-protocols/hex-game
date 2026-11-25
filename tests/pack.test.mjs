// pack.test.mjs — the pack's four food slots, and dropping or tossing what you carry.

import { test, eq, ok, run } from './_harness.mjs';
import { createState } from '../src/game/state.js';
import {
  addItem, countItem, capacity, hasRoomFor, FOOD_SLOTS, isFood, ensurePackLayout, takeFromPack,
  takeFromWorn, equipFromPack, unequipSlot, freeSlotFor,
} from '../src/game/inventory.js';

const empty = () => { const s = createState(); s.inventory.fill(null); return s; };

test('food goes in the food slots, everything else in the main pack', () => {
  const s = empty();
  addItem(s, 'stone', 3);
  addItem(s, 'berries', 4);
  addItem(s, 'salve', 1);
  ok(s.inventory[0]?.id === 'berries' && s.inventory[1]?.id === 'salve', 'food first, salve counts');
  eq(s.inventory[FOOD_SLOTS]?.id, 'stone', 'stone in the first main slot');
  ok(!isFood('stone') && isFood('bread') && isFood('grain'));
});

test('food spills into the main pack; nothing else goes in a food slot', () => {
  const s = empty();
  for (const id of ['berries', 'bread', 'meal', 'fish']) addItem(s, id, 1);
  addItem(s, 'stew', 1);
  ok(s.inventory.slice(0, FOOD_SLOTS).every(Boolean), 'four food slots full');
  eq(s.inventory[FOOD_SLOTS]?.id, 'stew', 'a fifth food spills into the main pack');
  // Fill the main pack with stone: no room for a log, even with food slots empty.
  const t = empty();
  for (let i = FOOD_SLOTS; i < capacity(t); i++) t.inventory[i] = { id: 'stone', qty: 30 };
  ok(!hasRoomFor(t, 'log', 1), 'no room for a log in the food slots');
  eq(addItem(t, 'log', 1), 0);
  ok(hasRoomFor(t, 'berries', 1), 'but berries fit');
  eq(capacity(t) - FOOD_SLOTS, 12, 'twelve main slots out of sixteen');
});

test('an old pack is sorted into the new layout, nothing lost', () => {
  const s = empty();
  // Sixteen slots of an old save: tools and stone in the first four.
  const old = ['stone_axe', 'stone', 'log', 'berries', 'reed', 'bread', 'flint', 'clay',
    'cord', 'plank', 'branch', 'hide', 'meat', 'grain', 'fish', 'herb'];
  old.forEach((id, i) => { s.inventory[i] = { id, qty: 1 }; });
  ok(ensurePackLayout(s));
  ok(s.inventory.slice(0, FOOD_SLOTS).every(x => x && isFood(x.id)), 'only food up front');
  for (const id of old) eq(countItem(s, id), 1, `${id} kept`);
  eq(ensurePackLayout(s), false, 'sorting twice changes nothing');
});

test('unequipping lands in the main pack', () => {
  const s = empty();
  s.worn.hand = 'stone_axe';
  ok(unequipSlot(s, 'hand').ok);
  ok(s.inventory.findIndex(x => x?.id === 'stone_axe') >= FOOD_SLOTS);
  eq(freeSlotFor(s, 'berries'), 0);
});

test('drop and toss take from a slot; a pack can come off to be dropped', () => {
  const s = empty();
  addItem(s, 'berries', 5);
  const one = takeFromPack(s, 0, 1);
  eq(one, { ok: true, id: 'berries', qty: 1 });
  eq(countItem(s, 'berries'), 4);
  const all = takeFromPack(s, 0);
  eq(all.qty, 4);
  eq(s.inventory[0], null);
  s.worn.pack = 'basket';
  const off = takeFromWorn(s, 'pack');
  ok(off.ok);
  eq(s.worn.pack, null);
});

test('what a master lent you cannot be dropped or tossed', () => {
  const s = empty();
  addItem(s, 'pickaxe', 1);
  s.jobs = { errand: { name: 'Ashford', lent: ['pickaxe'], bring: { stone: 8 } }, owed: [], places: {}, gifts: {} };
  const where = s.inventory.findIndex(x => x?.id === 'pickaxe');
  if (where >= 0) eq(takeFromPack(s, where).ok, false);
  else eq(takeFromWorn(s, 'hand').ok, false, 'worn straight away, and held back there too');
});

run('pack');
