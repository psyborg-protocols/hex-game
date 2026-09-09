// freemode.test.mjs — the testing switch.
//
// Two things matter about it. It has to lift every *cost*, or it does not save
// you any setup; and it must not lift any *rule*, or testing under it proves
// nothing about the real game. The second half is what these mostly check.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test, run, eq, ok } from './_harness.mjs';
import { WorldMap } from '../src/world/mapformat.js';
import { makeResolvers } from '../src/world/tileset.js';
import { distance } from '../src/world/hexgrid.js';
import { createState, isFree, hasBuilt } from '../src/game/state.js';
import { addItem, countItem, recomputeEnergy, walkOneStep, STEPS_PER_MEAL } from '../src/game/inventory.js';
import { checkRecipe, craft } from '../src/game/crafting.js';
import { availableHarvests } from '../src/game/harvests.js';
import { harvest, build, placementSpots } from '../src/game/actions.js';
import { ensureVillage, buy, sell, stockOf } from '../src/game/economy.js';
import { Rng } from '../src/core/rng.js';
import { serialize, deserialize } from '../src/game/save.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const index = JSON.parse(readFileSync(join(root, 'new_tiles', 'index.json'), 'utf8'));
const resolvers = makeResolvers(index);

const at = (q, r) => ({ q, r });
const rng = () => new Rng('free-test');

function ground(terrain = 'grass', h = 0, w = 7, d = 7) {
  const map = new WorldMap({ seed: 'test' });
  for (let q = 0; q < w; q++) for (let r = 0; r < d; r++) map.place(q, r, terrain, h);
  return { map, resolvers, seed: 'test' };
}

/** A brand new player with nothing: no items, no skills, no gold to speak of. */
const pauper = (free) => createState({ free });

test('the flag is off by default and reads through isFree', () => {
  ok(!isFree(createState()), 'free mode was on by default');
  ok(isFree(createState({ free: true })), 'free mode did not turn on');
  ok(!isFree(undefined), 'isFree should tolerate no state at all');
});

test('free mode crafts what an empty pack could never make', () => {
  const state = pauper(true);
  // A bow wants woodworking 7, a beam, three sinew, a cutting edge, and a
  // separate woodworking:6 gate on top — every kind of requirement at once.
  const check = checkRecipe(state, 'bow', {});
  ok(check.ok, `still blocked: ${check.reasons.join(' ')}`);
  eq(check.reasons, [], 'free mode should have no reasons');

  const made = craft(state, 'bow', {});
  ok(made.ok, 'the craft itself failed');
  eq(countItem(state, 'bow'), 1, 'no bow in the pack');
});

test('and does not consume what it did not require', () => {
  const state = pauper(true);
  addItem(state, 'beam', 5);
  addItem(state, 'sinew', 3);
  craft(state, 'bow', {});
  eq(countItem(state, 'beam'), 5, 'free mode ate the beams');
  eq(countItem(state, 'sinew'), 3, 'free mode ate the sinew');
});

test('a normal player is still blocked by every gate', () => {
  const state = pauper(false);
  const check = checkRecipe(state, 'bow', {});
  ok(!check.ok, 'free mode leaked into an ordinary game');
  ok(check.reasons.length >= 2, `expected several reasons, got ${JSON.stringify(check.reasons)}`);
});

test('a full pack still says so, because dropping the thing silently is worse', () => {
  const state = pauper(true);
  // Fill every slot with something that cannot stack with a bow.
  for (let i = 0; i < state.inventory.length; i++) state.inventory[i] = { id: 'axe', qty: 1 };
  const check = checkRecipe(state, 'bow', {});
  ok(!check.ok, 'free mode ignored a full pack');
  eq(check.reasons, ['No room to carry it.'], 'wrong reason for a full pack');
});

test('energy is full while free, and derived again once it is off', () => {
  const state = pauper(true);
  eq(recomputeEnergy(state), state.maxEnergy, 'free mode should keep energy full');

  state.free = false;
  eq(recomputeEnergy(state), 0, 'energy should go back to the food you carry');

  addItem(state, 'cooked_meat', 1);   // food 4
  eq(recomputeEnergy(state), 4, 'energy should follow the pack again');
});

test('walking never starves you while free', () => {
  const free = pauper(true);
  const normal = pauper(false);
  recomputeEnergy(free);

  let starved = false;
  for (let i = 0; i < STEPS_PER_MEAL * 3; i++) {
    if (walkOneStep(free).starving) starved = true;
  }
  ok(!starved, 'free mode starved the player');
  eq(free.stepsWalked, STEPS_PER_MEAL * 3, 'steps should still be counted');

  let normalStarved = false;
  for (let i = 0; i < STEPS_PER_MEAL * 3; i++) {
    if (walkOneStep(normal).starving) normalStarved = true;
  }
  ok(normalStarved, 'an ordinary player with no food should starve');
});

test('harvests are offered without their tools, but only where they belong', () => {
  const world = ground('grass');
  const free = pauper(true);

  const here = availableHarvests(world.map, free, at(3, 3));
  ok(here.every(h => h.ok), `something is still gated: ${JSON.stringify(here.filter(h => !h.ok))}`);

  // Fishing needs water next to you. Free mode must not invent a lake.
  ok(!here.some(h => h.spec.id === 'fish'), 'fishing was offered on dry grass');

  world.map.place(4, 3, 'water', 0);
  const byWater = availableHarvests(world.map, free, at(3, 3));
  ok(byWater.some(h => h.spec.id === 'fish' && h.ok), 'fishing was not offered beside water');
});

test('harvesting still spends the world', () => {
  const world = ground('oak_wood');
  world.map.get(3, 3).feature = { type: 'trees', kind: 'oak', remaining: 1 };
  const state = pauper(true);

  const result = harvest(world, state, at(3, 3), 'chop_rough_log', rng());
  ok(result.ok, result.message);
  eq(world.map.get(3, 3).terrain, 'forest_floor', 'the last tree should still fell the wood');
});

test('a build recipe is sited, not carried, even while free', () => {
  // Worth pinning: 'ladder' produces a structure, so free mode never puts one in
  // the pack and never applies the pack-full check to it.
  const state = pauper(true);
  const check = checkRecipe(state, 'ladder', {});
  ok(check.ok, `build recipe still blocked: ${check.reasons.join(' ')}`);
  craft(state, 'ladder', {});
  eq(countItem(state, 'ladder'), 0, 'a structure should not go into the pack');
});

test('building is free but still has to go somewhere legal', () => {
  const world = ground('grass');
  world.map.place(4, 3, 'water', 0);
  const state = pauper(true);

  const spots = placementSpots(world, state, at(3, 3), 'hearth');
  ok(!spots.some(s => s.q === 4 && s.r === 3), 'free mode offered water as a building site');

  const built = build(world, state, at(3, 3), 'hearth', at(3, 3), { at: at(3, 3), distance });
  ok(built.ok, built.message);
  ok(hasBuilt(state, 'hearth'), 'the hearth was not recorded');

  const far = build(world, state, at(3, 3), 'hearth', at(0, 0), { at: at(3, 3), distance });
  ok(!far.ok, 'free mode let a hearth be built across the map');
});

test('trade costs nothing, but they still only sell what they stock', () => {
  const state = pauper(true);
  const village = {};
  ensureVillage(state, village, 2, 2, 'test');
  const stocked = Object.keys(stockOf(state, 2, 2))[0];
  const goldBefore = state.gold;

  const bought = buy(state, 2, 2, stocked);
  ok(bought.ok, bought.message);
  eq(state.gold, goldBefore, 'free mode charged for the purchase');
  eq(countItem(state, stocked), 1, 'nothing arrived in the pack');

  const nonsense = buy(state, 2, 2, 'oracle');
  ok(!nonsense.ok, 'free mode bought something the village does not sell');

  // Selling still pays, so the two directions do not become a money printer
  // that hides bugs in the ordinary path.
  const sold = sell(state, 2, 2, stocked);
  ok(sold.ok, sold.message);
  ok(state.gold > goldBefore, 'selling should still pay');
});

test('the flag survives a save and reload', () => {
  const world = ground('grass');
  const state = pauper(true);
  const player = { q: 3, r: 3 };

  const back = deserialize(JSON.parse(JSON.stringify(serialize(world, state, player))));
  ok(isFree(back.state), 'free mode was lost in the save');

  const normal = deserialize(JSON.parse(JSON.stringify(serialize(world, pauper(false), player))));
  ok(!isFree(normal.state), 'an ordinary save came back in free mode');
});

run('freemode');
