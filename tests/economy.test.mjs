// economy.test.mjs — the recipe graph is the game. These tests check it is
// internally consistent and, more importantly, that the discovery path
// skill_map.md lays out can actually be walked from an empty pack.

import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test, run, eq, ok } from './_harness.mjs';
import { ITEMS, RECIPES, SKILL_INFO, ITEM_BASE_PRICES } from '../data/game_data.js';
import { createState, SKILLS, MAX_LEVEL, BUILDINGS, recordBuilt, hasBuilt } from '../src/game/state.js';
import { addItem, removeItem, countItem, hasItem, recomputeEnergy, walkOneStep, STEPS_PER_MEAL, hasRoomFor } from '../src/game/inventory.js';
import { addXp, xpToNext, levelOf } from '../src/game/skills.js';
import { checkRecipe, craft, toolSlots, needGroups, meetsRequirement } from '../src/game/crafting.js';
import { ensureVillage, buy, sell, stockOf } from '../src/game/economy.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Raw materials no recipe produces — the world hands these out. */
const WORLD_DROPS = ['berries', 'seeds', 'grain', 'rabbit', 'fish', 'reed', 'clay', 'bone', 'hide', 'sinew'];

// ---------------------------------------------------------------- integrity

test('every recipe references items that exist', () => {
  for (const [id, r] of Object.entries(RECIPES)) {
    for (const k of Object.keys(r.inputs || {})) ok(ITEMS[k], `${id} takes unknown item ${k}`);
    for (const k of Object.keys(r.output)) ok(ITEMS[k], `${id} makes unknown item ${k}`);
    for (const slot of toolSlots(r)) {
      for (const t of slot) ok(ITEMS[t], `${id} needs unknown tool ${t}`);
    }
    ok(SKILLS.includes(r.skill), `${id} uses unknown skill ${r.skill}`);
    ok(r.level >= 1 && r.level <= MAX_LEVEL, `${id} is level ${r.level}`);
  }
});

test('every needs gate names a real skill or a buildable structure', () => {
  for (const [id, r] of Object.entries(RECIPES)) {
    for (const group of needGroups(r)) {
      for (const req of group) {
        const [kind, a, b] = req.split(':');
        ok(kind === 'skill' || kind === 'built', `${id} has an unknown gate ${req}`);
        if (kind === 'skill') {
          ok(SKILLS.includes(a), `${id} gates on unknown skill ${a}`);
          ok(Number(b) >= 1 && Number(b) <= MAX_LEVEL, `${id} gates on level ${b}`);
        } else {
          ok(ITEMS[a], `${id} gates on unknown structure ${a}`);
          ok(BUILDINGS.has(a), `${id} gates on ${a}, which nothing builds`);
        }
      }
    }
  }
});

test('every item has an icon on disk', () => {
  for (const [id, item] of Object.entries(ITEMS)) {
    ok(item.icon, `${id} has no icon`);
    ok(existsSync(join(root, item.icon)), `${id} points at missing ${item.icon}`);
  }
});

test('every skill documents all seven levels, with an ability icon each', () => {
  for (const skill of SKILLS) {
    for (let l = 1; l <= MAX_LEVEL; l++) {
      const lines = SKILL_INFO[skill][l];
      ok(Array.isArray(lines) && lines.length, `${skill} level ${l} has no abilities listed`);
      ok(existsSync(join(root, `icons/abilities/${skill}_lvl${l}.svg`)), `${skill} lvl ${l} icon missing`);
    }
    ok(existsSync(join(root, `icons/skills/${skill}.svg`)), `${skill} glyph missing`);
  }
});

test('everything tradeable has a price', () => {
  for (const [id, r] of Object.entries(RECIPES)) {
    for (const out of Object.keys(r.output)) {
      if (BUILDINGS.has(out)) continue;
      ok(ITEM_BASE_PRICES[out] != null, `${out} (from ${id}) has no base price`);
    }
  }
});

// ---------------------------------------------------------------- inventory

test('items stack up to their limit and then spill into new slots', () => {
  const s = createState();
  eq(addItem(s, 'stone', 250), 250, 'should have taken all 250');
  eq(countItem(s, 'stone'), 250, 'count');
  const used = s.inventory.filter(Boolean).length;
  eq(used, 3, 'stone stacks to 99, so 250 needs three slots');
});

test('a full pack refuses what will not fit', () => {
  const s = createState();
  // 24 slots x 1 per stack: tools do not stack.
  for (let i = 0; i < 24; i++) addItem(s, 'stone_axe', 1);
  eq(countItem(s, 'stone_axe'), 24, 'filled the pack');
  eq(hasRoomFor(s, 'stone', 1), false, 'nothing should fit');
  eq(addItem(s, 'stone', 5), 0, 'took items with nowhere to put them');
});

test('removing more than you have changes nothing', () => {
  const s = createState();
  addItem(s, 'plank', 3);
  eq(removeItem(s, 'plank', 5), false, 'should have refused');
  eq(countItem(s, 'plank'), 3, 'inventory was raided anyway');
  eq(removeItem(s, 'plank', 3), true, 'exact removal should work');
  eq(hasItem(s, 'plank'), false, 'should be gone');
});

test('energy is the food you carry', () => {
  const s = createState();
  eq(s.energy, 0, 'you start with nothing to eat');
  addItem(s, 'berries', 4);              // food 1 each
  eq(s.energy, 4, 'berries should feed you');
  addItem(s, 'cooked_meat', 2);          // food 4 each
  eq(s.energy, 10, 'capped at maxEnergy');
  removeItem(s, 'cooked_meat', 2);
  eq(s.energy, 4, 'eating into stores lowers what you can do');
});

test('walking eats, and starves when there is nothing left', () => {
  const s = createState();
  addItem(s, 'berries', 1);
  recomputeEnergy(s);

  let ate = null;
  for (let i = 0; i < STEPS_PER_MEAL; i++) ate = walkOneStep(s);
  eq(ate.ate, 'berries', 'should have eaten the berries');
  eq(countItem(s, 'berries'), 0, 'and used them up');

  for (let i = 0; i < STEPS_PER_MEAL; i++) ate = walkOneStep(s);
  ok(ate.hungry || ate.starving, 'with no food, walking should cost you');
});

// ---------------------------------------------------------------- skills

test('xp rolls over through several levels at once', () => {
  const s = createState();
  eq(xpToNext(1), 10, 'level 1 costs 10');
  eq(addXp(s, 'woodworking', 9), [], 'not enough for a level');
  eq(addXp(s, 'woodworking', 1), [2], 'that should be level 2');
  eq(addXp(s, 'woodworking', 500), [3, 4, 5], 'a windfall should roll up several');
});

test('skills stop at seven', () => {
  const s = createState();
  addXp(s, 'mind', 100000);
  eq(levelOf(s, 'mind'), MAX_LEVEL, 'should cap');
});

// ---------------------------------------------------------------- gates

test('a tool slot is satisfied by any one of its alternatives', () => {
  const here = { at: { q: 0, r: 0 }, distance: () => 0 };
  const base = () => {
    const s = createState();
    addXp(s, 'woodworking', 10);           // level 2
    addItem(s, 'branch', 4);
    addItem(s, 'cooked_meat', 3);          // energy
    return s;
  };
  // beams_whittle wants a stone_chisel, chisel or knife.
  const without = base();
  ok(!checkRecipe(without, 'beams_whittle', here).ok, 'should need an edge');

  for (const tool of ['stone_chisel', 'chisel', 'knife']) {
    const s = base();
    addItem(s, tool, 1);
    const check = checkRecipe(s, 'beams_whittle', here);
    ok(check.ok, `${tool} should satisfy the slot: ${check.reasons.join(' ')}`);
    eq(check.toolPlan[0].id, tool, 'plan should name the tool used');
  }
});

test('a structure is a tool you stand at, not one you carry', () => {
  const s = createState();
  addXp(s, 'homesteading', 100);
  addItem(s, 'clay', 6);
  addItem(s, 'branch', 4);
  addItem(s, 'cooked_meat', 3);

  const here = { at: { q: 0, r: 0 }, distance: () => 0 };
  ok(!checkRecipe(s, 'pot', here).ok, 'a pot needs a hearth to fire it');

  recordBuilt(s, 'hearth', 0, 0);
  ok(checkRecipe(s, 'pot', here).ok, 'with a hearth built it should work');

  // Standing a long way from the only hearth is not standing at one.
  const faraway = { at: { q: 40, r: 40 }, distance: (a, b, c, d) => Math.abs(a - c) + Math.abs(b - d) };
  ok(!checkRecipe(s, 'pot', faraway).ok, 'the hearth was usable from across the map');
});

test('needs gates block until the world catches up', () => {
  const s = createState();
  addXp(s, 'homesteading', 100);
  addXp(s, 'stoneworking', 100);
  addXp(s, 'woodworking', 100);
  addItem(s, 'stone', 12);
  addItem(s, 'log', 4);
  addItem(s, 'branch', 4);
  addItem(s, 'cooked_meat', 4);
  addItem(s, 'stone_hammer', 1);

  const here = { at: { q: 0, r: 0 }, distance: () => 0 };
  const before = checkRecipe(s, 'stone_oven', here);
  ok(!before.ok, 'a stone oven should need a hearth first');
  ok(before.reasons.some(r => /Hearth/i.test(r)), `reason should name the hearth, got: ${before.reasons.join(' ')}`);

  recordBuilt(s, 'hearth', 0, 0);
  ok(checkRecipe(s, 'stone_oven', here).ok, 'still blocked with a hearth built');
});

test('a locked recipe explains itself rather than just refusing', () => {
  const s = createState();
  const check = checkRecipe(s, 'cabin', { at: { q: 0, r: 0 }, distance: () => 0 });
  ok(!check.ok, 'a fresh player cannot build a cabin');
  ok(check.reasons.length >= 3, 'should list every obstacle, not just the first');
  ok(check.reasons.some(r => r.includes('woodworking')), 'should mention the skill');
  ok(check.reasons.some(r => /more Log/i.test(r)), 'should mention the missing logs');
});

// ---------------------------------------------------------------- trade

test('a village stocks goods and lends tools, the same way every visit', () => {
  const s = createState();
  const village = { type: 'village', name: 'Test', rentableTools: [] };
  const prices = ensureVillage(s, village, 3, 4, 'seed');
  ok(Object.keys(prices).length >= 5, 'a village should stock something');
  ok(village.rentableTools.length >= 2, 'and lend something');

  const again = createState();
  const village2 = { type: 'village', name: 'Test', rentableTools: [] };
  eq(ensureVillage(again, village2, 3, 4, 'seed'), prices, 'the same village should have the same prices');
  eq(village2.rentableTools, village.rentableTools, 'and the same workshop');
});

test('villages sell at their price and buy back at half', () => {
  const s = createState({ gold: 500 });
  ensureVillage(s, null, 0, 0, 'seed');
  const [itemId, price] = Object.entries(stockOf(s, 0, 0))[0];

  const before = s.gold;
  const bought = buy(s, 0, 0, itemId);
  ok(bought.ok, bought.message);
  eq(s.gold, before - price, 'should have paid the asking price');
  ok(hasItem(s, itemId), 'and received the goods');

  const sold = sell(s, 0, 0, itemId);
  ok(sold.ok, sold.message);
  eq(sold.price, Math.max(1, Math.floor(price / 2)), 'should buy back at half');
});

test('you cannot buy what you cannot afford or sell what you do not have', () => {
  const s = createState({ gold: 0 });
  ensureVillage(s, null, 0, 0, 'seed');
  const [itemId] = Object.entries(stockOf(s, 0, 0))[0];
  ok(!buy(s, 0, 0, itemId).ok, 'bought on credit');
  ok(!sell(s, 0, 0, itemId).ok, 'sold thin air');
});

test('renting fills a tool slot you cannot fill yourself', () => {
  const s = createState({ gold: 200 });
  addXp(s, 'woodworking', 10);
  addItem(s, 'branch', 4);
  addItem(s, 'cooked_meat', 3);

  const here = { at: { q: 0, r: 0 }, distance: () => 0 };
  ok(!checkRecipe(s, 'beams_whittle', here).ok, 'no edge, no beams');

  const village = { rentableTools: ['stone_chisel'] };
  const check = checkRecipe(s, 'beams_whittle', { ...here, village });
  ok(check.ok, `renting should work: ${check.reasons.join(' ')}`);
  ok(check.fees > 0, 'and cost something');

  const gold = s.gold;
  const made = craft(s, 'beams_whittle', { ...here, village });
  ok(made.ok, 'craft should succeed');
  eq(s.gold, gold - check.fees, 'the fee should have been taken');
  eq(made.rented[0].id, 'stone_chisel', 'and recorded what was borrowed');
});

// ------------------------------------------------------- the discovery path

/**
 * A player who works towards things.
 *
 * A greedy "craft whatever you can" loop cannot test this graph: recipes are
 * evaluated in some order, and whatever comes later eats the materials whatever
 * came earlier just made — sawing planks takes the only log before the hearth
 * ever gets its two. So this plans backwards instead. To make a thing: reach the
 * skill level by doing work in that skill, acquire each input (recursively, by
 * making *its* producer), fill each tool slot with any one of its alternatives,
 * satisfy each world gate, and only then craft.
 *
 * Ore is optional. A world with no prospectable ore is a legitimate stone-age
 * world — that is the scarcity anchor in skill_map.md — and the rest of the
 * economy has to stay coherent inside it.
 */
function planner({ ore = true } = {}) {
  const state = createState({ gold: 2000, maxEnergy: 40, slots: 200 });
  const here = { at: { q: 0, r: 0 }, distance: () => 0 };
  const made = new Set();

  const producers = {};
  for (const r of Object.values(RECIPES)) {
    for (const id of Object.keys(r.output)) (producers[id] ||= []).push(r);
  }

  const allowed = r => ore || (r.id !== 'prospect' && r.id !== 'mine_ore');
  const keepOne = new Set(Object.values(RECIPES)
    .filter(r => r.category === 'tool' || r.category === 'good')
    .flatMap(r => Object.keys(r.output)));

  const held = id => (BUILDINGS.has(id) ? hasBuilt(state, id) : countItem(state, id) > 0);

  const tidy = () => {
    for (const slot of state.inventory.filter(Boolean)) {
      const cap = keepOne.has(slot.id) ? 1 : 40;
      const excess = countItem(state, slot.id) - cap;
      if (excess > 0) removeItem(state, slot.id, excess);
    }
  };

  const gathers = Object.values(RECIPES).filter(r => r.gather);

  /** The world hands out the raw drops; everything else is actually gathered. */
  const restock = () => {
    for (const id of WORLD_DROPS) {
      const short = 24 - countItem(state, id);
      if (short > 0) addItem(state, id, short);
    }
    if (state.energy < state.maxEnergy) addItem(state, 'cooked_meat', 10);
    for (const r of gathers) {
      if (!allowed(r)) continue;
      const [id] = Object.keys(r.output);
      for (let t = 0; t < 40 && countItem(state, id) < 24; t++) {
        if (!craft(state, r.id, here).ok) break;
        made.add(r.id);
      }
    }
  };

  const commit = (r, result) => {
    if (result.isBuild) for (const p of result.produced) recordBuilt(state, p.id, 0, 0);
    made.add(r.id);
  };

  const grinding = new Set();

  /**
   * Do whatever work in this skill is possible, until the level comes.
   *
   * Trying bare crafts is not enough: metalworking 1 is prospecting, which is
   * gated behind Mind 4, so a skill can be unable to start until another skill
   * has been taken somewhere. When a bare craft fails, the recipe gets the full
   * prepare treatment once. `grinding` stops a skill from being ground
   * re-entrantly while it is already being ground further up the stack.
   */
  function grind(skill, level, budget = 400) {
    if (levelOf(state, skill) >= level) return true;
    if (grinding.has(skill)) return false;
    grinding.add(skill);
    const prepared = new Set();
    try {
      while (levelOf(state, skill) < level && budget-- > 0) {
        let worked = false;
        for (const r of Object.values(RECIPES)) {
          if (r.skill !== skill || !allowed(r)) continue;
          tidy();
          restock();
          let result = craft(state, r.id, here);
          if (!result.ok && !prepared.has(r.id)) {
            prepared.add(r.id);
            prepare(r, new Set([r.id]), 6);
            tidy();
            restock();
            result = craft(state, r.id, here);
          }
          if (!result.ok) continue;
          commit(r, result);
          worked = true;
          break;
        }
        if (!worked) break;
      }
    } finally {
      grinding.delete(skill);
    }
    return levelOf(state, skill) >= level;
  }

  /** Get `qty` of an item, making it (and its ingredients) if that is what it takes. */
  function acquire(id, qty, seen = new Set(), depth = 0) {
    const enough = () => (BUILDINGS.has(id) ? hasBuilt(state, id) : countItem(state, id) >= qty);
    if (enough()) return true;
    if (depth > 10) return false;

    for (const r of producers[id] || []) {
      if (!allowed(r) || seen.has(r.id)) continue;
      const next = new Set(seen).add(r.id);
      prepare(r, next, depth);

      for (let guard = 0; guard < 60; guard++) {
        tidy();
        restock();
        const result = craft(state, r.id, here);
        if (!result.ok) break;
        commit(r, result);
        if (enough()) return true;
      }
      if (enough()) return true;
    }
    return false;
  }

  /** Line up everything a recipe asks for. */
  function prepare(r, seen = new Set([r.id]), depth = 0) {
    grind(r.skill, r.level);

    // A margin over the exact amount: the next recipe along will want some too.
    for (const [id, n] of Object.entries(r.inputs || {})) acquire(id, n + 2, seen, depth + 1);

    for (const slot of toolSlots(r)) {
      if (slot.some(held)) continue;
      for (const t of slot) if (acquire(t, 1, seen, depth + 1)) break;
    }

    for (const group of needGroups(r)) {
      if (group.some(req => meetsRequirement(state, req))) continue;
      for (const req of group) {
        const [kind, a, b] = req.split(':');
        const done = kind === 'skill' ? grind(a, Number(b)) : acquire(a, 1, seen, depth + 1);
        if (done) break;
      }
    }
    return checkRecipe(state, r.id, here).ok;
  }

  /** Make one of this recipe, doing whatever has to happen first. */
  function make(recipeId) {
    const r = RECIPES[recipeId];
    if (!r || !allowed(r)) return false;
    if (made.has(recipeId)) return true;
    for (let attempt = 0; attempt < 3; attempt++) {
      prepare(r);
      tidy();
      restock();
      const result = craft(state, recipeId, here);
      if (result.ok) { commit(r, result); return true; }
    }
    return false;
  }

  const why = recipeId => checkRecipe(state, recipeId, here).reasons.join(' ');

  return { state, made, make, why, grind };
}

test('the stone age is fully playable with no ore in the world', () => {
  const p = planner({ ore: false });

  // The bootstrap path from skill_map.md, as far as it runs without metal.
  const path = [
    'stone_hammer', 'stone_chisel',                  // stone 1
    'craft_cord', 'basket',                          // wood 1
    'stone_axe',                                     // stone 2
    'work_log', 'beams_whittle',                     // wood 2
    'hearth', 'cook_meat',                           // homestead 1
    'bone_saw', 'planks', 'bone_adze',               // wood 3
    'pot', 'field',                                  // homestead 2
    'stone_block', 'quern', 'stone_oven',            // stone 3
    'bread', 'stew',                                 // homestead 3
    'amulet', 'drum', 'journal',                     // mind 1-3
    'stone_adze', 'stone_anvil', 'grindstone',       // stone 4
    'whetstone', 'stone_house',                      // stone 5
    'cabin', 'boat',                                 // wood 5
    'bridge', 'cart',                                // wood 6
    'bow',                                           // wood 7
  ];
  for (const id of path) {
    ok(p.make(id), `never managed ${RECIPES[id].name} (${id}): ${p.why(id)}`);
  }

  ok(!p.make('smelt_ingot'), 'smelted an ingot in a world with no ore');
  ok(!hasItem(p.state, 'ingot'), 'ingots appeared from nowhere');
});

test('with ore in the world the path runs all the way to the oracle', () => {
  const p = planner({ ore: true });

  const metal = ['bone_tongs', 'bellows', 'smelt_ingot', 'knife', 'saw',
    'axe', 'pickaxe', 'hoe', 'anvil', 'tongs', 'hammer', 'adze'];
  for (const id of metal) {
    ok(p.make(id), `metalworking stalled before ${RECIPES[id].name}: ${p.why(id)}`);
  }

  const home = ['smokehouse', 'granary', 'clay_oven', 'brick', 'kiln', 'well', 'bakehouse', 'plough'];
  for (const id of home) {
    ok(p.make(id), `homesteading stalled before ${RECIPES[id].name}: ${p.why(id)}`);
  }

  ok(p.make('oracle'), `never reached the oracle: ${p.why('oracle')}`);

  for (const skill of SKILLS) {
    ok(p.grind(skill, MAX_LEVEL), `${skill} could not be worked up to ${MAX_LEVEL}`);
  }
});

test('the circular tool chains close: tongs are forged with tongs', () => {
  // bone_tongs -> tongs -> fine_tongs, each needing the tier before it. This is
  // the deliberate cycle in skill_map.md, and it has to be walkable, not merely
  // declared.
  const p = planner({ ore: true });
  ok(p.make('bone_tongs'), `no bone tongs: ${p.why('bone_tongs')}`);
  ok(p.make('tongs'), `no ingot tongs: ${p.why('tongs')}`);
  ok(p.make('fine_tongs'), `no refined tongs: ${p.why('fine_tongs')}`);

  ok(toolSlots(RECIPES.tongs).flat().some(t => t.includes('tongs')),
    'forging tongs should itself need tongs');
  ok(toolSlots(RECIPES.fine_tongs).flat().includes('tongs'),
    'refined tongs should need the tier below');
});

run('economy');
