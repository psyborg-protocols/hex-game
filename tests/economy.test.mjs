// economy.test.mjs — the item graph.
//
// The design laws in data/game_data.js are checkable, so they are checked:
// every item has a job (significance), every gated thing has a second way in
// (redundancy), the cycles are real (it takes tongs to make tongs), and the whole
// graph can be climbed from an empty pack.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test, run, eq, ok } from './_harness.mjs';
import { ITEMS, RECIPES, SKILL_INFO, ITEM_BASE_PRICES, VILLAGE_KINDS } from '../data/game_data.js';
import { HARVESTS } from '../src/game/harvests.js';
import { createState, isBuilding, MAX_LEVEL } from '../src/game/state.js';
import { addItem, countItem, removeItem, hasRoomFor, capacity, spend, maxEnergy, topUp } from '../src/game/inventory.js';
import { checkRecipe, craft } from '../src/game/crafting.js';
import { attackDice, defenseDice } from '../src/game/gear.js';
import { addXp } from '../src/game/skills.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const slotsOf = r => (r.tools || []).map(s => (Array.isArray(s) ? s : [s]));

test('every recipe names real items, skills and gates', () => {
  for (const r of Object.values(RECIPES)) {
    ok(SKILL_INFO[r.skill], `${r.id}: unknown skill ${r.skill}`);
    ok(r.level >= 1 && r.level <= MAX_LEVEL, `${r.id}: level ${r.level}`);
    for (const id of [...Object.keys(r.inputs), ...Object.keys(r.output), ...slotsOf(r).flat(), ...Object.keys(r.perSpan || {})]) {
      ok(ITEMS[id], `${r.id}: unknown item ${id}`);
    }
    for (const n of (r.needs || []).flat()) {
      const [kind, a] = n.split(':');
      ok(kind === 'skill' ? SKILL_INFO[a] : ITEMS[a], `${r.id}: bad need ${n}`);
    }
  }
  for (const h of Object.values(HARVESTS)) {
    for (const id of [...Object.keys(h.yields), ...(h.tool || []), ...Object.keys(h.bonus || {})]) ok(ITEMS[id], `${h.id}: unknown item ${id}`);
  }
});

test('every item has an icon, a description, and (if it can be traded) a price', () => {
  for (const item of Object.values(ITEMS)) {
    ok(existsSync(join(root, item.icon)), `${item.id}: no icon at ${item.icon}`);
    ok(item.desc && item.desc.length > 8, `${item.id}: no description`);
    if (item.kind !== 'structure') ok(ITEM_BASE_PRICES[item.id] > 0, `${item.id}: no price`);
  }
});

/**
 * Things whose job is done in code rather than in the recipe table: what they
 * do is checked by the tests for those systems (raids, pathfinding, gear).
 */
const CODED = new Set([
  'boat',          // pathfinding: water is walkable while you carry one
  'rally_banner',  // raiders.js: militia near a camp
  'dog',           // gear.js + harvests: +1 attack die, extra catch
  'cart',          // slots, and faster roads
  'hut', 'shrine', 'watchtower', 'palisade', 'stone_wall', 'ladder', 'bridge', 'field', 'hearth',
]);

test('significance: every item is an input, a tool, a station, or does something', () => {
  const used = new Set();
  for (const r of Object.values(RECIPES)) {
    for (const id of Object.keys(r.inputs)) used.add(id);
    for (const id of slotsOf(r).flat()) used.add(id);
  }
  for (const h of Object.values(HARVESTS)) {
    for (const id of h.tool || []) used.add(id);
    for (const id of Object.keys(h.bonus || {})) used.add(id);
  }
  const idle = Object.values(ITEMS).filter(i => !used.has(i.id) && !CODED.has(i.id)
    && !i.food && !i.heal && !i.attack && !i.defense && !i.slots && !i.attackBonus);
  eq(idle.map(i => i.id), [], 'these items do nothing');
});

test('the item list stays small', () => {
  const n = Object.keys(ITEMS).length;
  ok(n <= 60, `${n} items — minimal archetypes means fewer than this`);
});

test('every skill level opens something', () => {
  for (const [skill, levels] of Object.entries(SKILL_INFO)) {
    for (let l = 1; l <= MAX_LEVEL; l++) ok(levels[l]?.length, `${skill} ${l} opens nothing`);
  }
});

test('redundancy: the gated things have more than one way in', () => {
  const makers = id => Object.values(RECIPES).filter(r => r.output[id]).length;
  ok(makers('cord') >= 2, 'cord from reeds or hide');
  ok(makers('plank') >= 2, 'planks by axe or by saw');
  ok(makers('ingot') >= 2, 'two ways to smelt');
  ok(makers('block') >= 2, 'blocks two ways');
  ok(makers('stew') >= 2, 'stew from meat or fish');
  eq(HARVESTS.mine_ore.tool.length, 2, 'ore by hammer or pickaxe');
  eq(HARVESTS.hunt.tool.length, 2, 'hunt by snare or bow');
  ok(ITEMS.boat && RECIPES.bridge, 'the river by boat or by bridge');
  ok(Object.values(VILLAGE_KINDS).some(k => k.sells.includes('boat')), 'a boat can be bought');
  ok(Object.values(VILLAGE_KINDS).some(k => k.sells.includes('ore')), 'ore can be bought where Lore finds none');
});

test('circularity: it takes tongs to make tongs', () => {
  const slot = slotsOf(RECIPES.iron_tongs).find(s => s.includes('iron_tongs'));
  ok(slot && slot.includes('wood_tongs'), 'iron tongs are made with tongs, and green-wood tongs break the cycle');
});

/**
 * Climb the graph from an empty pack. Skill levels are taken as reachable (xp
 * comes from doing anything in a skill); tools and stations are not — a recipe
 * opens only once everything it needs has been made.
 */
test('the whole graph is reachable from an empty pack', () => {
  const have = new Set();
  for (const h of Object.values(HARVESTS)) {
    if (h.tool || h.depletes) continue;
    for (const id of Object.keys(h.yields)) have.add(id);
    for (const id of Object.keys(h.bonusYields || {})) have.add(id);   // wild grain
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const h of Object.values(HARVESTS)) {
      if (h.id === 'harvest_field' && !have.has('field')) continue;
      if (h.tool && !h.tool.some(t => have.has(t))) continue;
      for (const id of Object.keys(h.yields)) if (!have.has(id)) { have.add(id); grew = true; }
      for (const [tool, extra] of Object.entries(h.bonus || {})) {
        if (have.has(tool)) for (const id of Object.keys(extra)) if (!have.has(id)) { have.add(id); grew = true; }
      }
    }
    for (const r of Object.values(RECIPES)) {
      if (!Object.keys(r.inputs).every(id => have.has(id))) continue;
      if (!slotsOf(r).every(s => s.some(id => have.has(id)))) continue;
      if (!(r.needs || []).flat().filter(n => n.startsWith('built:')).every(n => have.has(n.split(':')[1]))) continue;
      for (const id of Object.keys(r.output)) if (!have.has(id)) { have.add(id); grew = true; }
    }
  }
  const missing = Object.keys(ITEMS).filter(id => !have.has(id));
  eq(missing, [], 'these can never be made');
});

test('every village favour can be met without trading or metal', () => {
  const metal = new Set(['ore', 'ingot']);
  for (const kind of Object.values(VILLAGE_KINDS)) {
    for (const f of kind.favours) {
      ok(ITEMS[f.item] && !metal.has(f.item), `${kind.name} asks for ${f.item}`);
      ok(f.qty > 0 && f.qty <= 8, `${kind.name} asks for too many ${f.item}`);
    }
  }
});

test('cooking is worth it: a meal is twice the meat', () => {
  ok(ITEMS.meal.food >= ITEMS.meat.food * 2, 'meal vs meat');
  ok(ITEMS.stew.food * 2 > ITEMS.meat.food + ITEMS.grain.food + 2, 'stew is a good deal');
});

test('food is eaten on its own, cheapest first, without waste', () => {
  const s = createState();
  s.inventory = s.inventory.map(() => null);
  s.energy = 2;
  addItem(s, 'berries', 3);
  addItem(s, 'stew', 2);
  addItem(s, 'meat', 2);
  topUp(s);
  eq(countItem(s, 'berries'), 0, 'berries go first');
  eq(countItem(s, 'stew'), 1, 'then a stew, and only as much as you need');
  ok(countItem(s, 'meat') === 2, 'the meat is left to be cooked');
  ok(s.energy <= maxEnergy(s), 'never over the top');
  ok(spend(s, 3), 'can spend what food covers');
});

test('gear changes the dice, and packs change the slots', () => {
  const s = createState();
  const base = capacity(s);
  addItem(s, 'basket', 1);
  eq(capacity(s), base + 4, 'basket +4');
  addItem(s, 'basket', 1);
  eq(capacity(s), base + 4, 'a second basket adds nothing');
  eq(attackDice(s), 1, 'fists');
  addItem(s, 'stone_axe', 1);
  eq(attackDice(s), 2, 'axe');
  addItem(s, 'whetstone', 1);
  eq(attackDice(s), 3, 'sharpened');
  eq(defenseDice(s), 1, 'bare');
  addItem(s, 'hide_armor', 1);
  addItem(s, 'shield', 1);
  eq(defenseDice(s), 3, 'armour and shield stack');
});

test('a station can be borrowed from a village that trusts you', () => {
  const s = createState();
  addItem(s, 'meat', 1);
  const at = { q: 0, r: 0 };
  const distance = () => 99;
  ok(!checkRecipe(s, 'cook_meat', { at, distance }).ok, 'cooked without a hearth');
  ok(!checkRecipe(s, 'cook_meat', { at, distance, village: { station: 'hearth', trusted: false } }).ok, 'a stranger used their hearth');
  ok(checkRecipe(s, 'cook_meat', { at, distance, village: { station: 'hearth', trusted: true } }).ok, 'a friend could not use their hearth');
});

test('master smith: a fifth level of metalworking gives an extra ingot', () => {
  const s = createState();
  addXp(s, 'metalworking', 9999);
  addItem(s, 'ore', 2); addItem(s, 'log', 1); addItem(s, 'wood_tongs', 1);
  s.built.push({ item: 'forge', q: 0, r: 0 });
  const r = craft(s, 'smelt', { at: { q: 0, r: 0 }, distance: () => 0 });
  ok(r.ok, r.reasons?.join(' '));
  eq(countItem(s, 'ingot'), 2, 'two ingots from one smelt');
});

run('economy');
