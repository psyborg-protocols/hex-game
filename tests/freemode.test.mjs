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
import { addItem, countItem, recomputeEnergy, walkOneStep, STEPS_PER_ENERGY, maxEnergy } from '../src/game/inventory.js';
import { checkRecipe, craft } from '../src/game/crafting.js';
import { availableHarvests } from '../src/game/harvests.js';
import { harvest, build, placementSpots } from '../src/game/actions.js';
import { ensureVillage, buy, sell, stockOf, giveFavour } from '../src/game/economy.js';
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

/** A brand new player: a few berries, no skills, no tools. */
const pauper = (free) => createState({ free });

test('the flag is off by default and reads through isFree', () => {
  ok(!isFree(createState()), 'free mode was on by default');
  ok(isFree(createState({ free: true })), 'free mode did not turn on');
  ok(!isFree(undefined), 'isFree should tolerate no state at all');
});

test('free mode crafts what an empty pack could never make', () => {
  const state = pauper(true);
  // A sword wants metalworking 4, three ingots, a plank, a forge and iron tongs.
  const check = checkRecipe(state, 'sword', {});
  ok(check.ok, `still blocked: ${check.reasons.join(' ')}`);
  eq(check.reasons, [], 'free mode should have no reasons');
  ok(craft(state, 'sword', {}).ok, 'the craft itself failed');
  eq(countItem(state, 'sword'), 1, 'no sword in the pack');
});

test('and does not consume what it did not require', () => {
  const state = pauper(true);
  addItem(state, 'ingot', 5);
  craft(state, 'sword', {});
  eq(countItem(state, 'ingot'), 5, 'free mode ate the ingots');
});

test('a normal player is still blocked by every gate', () => {
  const check = checkRecipe(pauper(false), 'sword', {});
  ok(!check.ok, 'free mode leaked into an ordinary game');
  ok(check.reasons.length >= 3, `expected several reasons, got ${JSON.stringify(check.reasons)}`);
});

test('a full pack still says so, because dropping the thing silently is worse', () => {
  const state = pauper(true);
  for (let i = 0; i < state.inventory.length; i++) state.inventory[i] = { id: 'stone_axe', qty: 1 };
  const check = checkRecipe(state, 'sword', {});
  ok(!check.ok, 'free mode ignored a full pack');
  eq(check.reasons, ['No room to carry it.'], 'wrong reason for a full pack');
});

test('energy is full while free, and is the food you carry once it is off', () => {
  const state = pauper(true);
  eq(recomputeEnergy(state), maxEnergy(state), 'free mode should keep energy full');
  state.free = false;
  state.energy = 0;
  addItem(state, 'meal', 1);
  recomputeEnergy(state);
  ok(state.energy > 0, 'carried food should feed an empty tank');
});

test('walking never starves you while free', () => {
  const free = pauper(true);
  const normal = pauper(false);
  normal.inventory = normal.inventory.map(() => null);
  normal.energy = 1;

  let starved = false;
  for (let i = 0; i < STEPS_PER_ENERGY * 6; i++) if (walkOneStep(free).exhausted) starved = true;
  ok(!starved, 'free mode starved the player');
  eq(free.stepsWalked, STEPS_PER_ENERGY * 6, 'steps should still be counted');

  let normalStarved = false;
  for (let i = 0; i < STEPS_PER_ENERGY * 6; i++) if (walkOneStep(normal).exhausted) normalStarved = true;
  ok(normalStarved, 'an ordinary player with no food should run out');
});

test('harvests are offered without their tools, but only where they belong', () => {
  const world = ground('grass');
  const free = pauper(true);
  const here = availableHarvests(world.map, free, at(3, 3));
  ok(here.every(h => h.ok), `something is still gated: ${JSON.stringify(here.filter(h => !h.ok))}`);
  ok(!here.some(h => h.spec.id === 'fish'), 'fishing was offered on dry grass');
  world.map.place(4, 3, 'water', 0);
  ok(availableHarvests(world.map, free, at(3, 3)).some(h => h.spec.id === 'fish' && h.ok), 'fishing was not offered beside water');
});

test('harvesting still spends the world', () => {
  const world = ground('oak_wood');
  world.map.get(3, 3).feature = { type: 'trees', kind: 'oak', remaining: 1 };
  const result = harvest(world, pauper(true), at(3, 3), 'fell_tree', rng());
  ok(result.ok, result.message);
  eq(world.map.get(3, 3).terrain, 'forest_floor', 'the last tree should still fell the wood');
});

test('a build recipe is sited, not carried, even while free', () => {
  const state = pauper(true);
  ok(checkRecipe(state, 'ladder', {}).ok, 'build recipe still blocked');
  craft(state, 'ladder', {});
  eq(countItem(state, 'ladder'), 0, 'a structure should not go into the pack');
});

test('building is free but still has to go somewhere legal', () => {
  const world = ground('grass');
  world.map.place(4, 3, 'water', 0);
  const state = pauper(true);
  ok(!placementSpots(world, state, at(3, 3), 'hearth').some(s => s.q === 4 && s.r === 3), 'free mode offered water as a building site');
  const built = build(world, state, at(3, 3), 'hearth', at(3, 3), { at: at(3, 3), distance });
  ok(built.ok, built.message);
  ok(hasBuilt(state, 'hearth'), 'the hearth was not recorded');
  ok(!build(world, state, at(3, 3), 'hearth', at(0, 0), { at: at(3, 3), distance }).ok, 'free mode let a hearth be built across the map');
});

test('a village still has to trust you, but the favour and the goods are free', () => {
  const state = pauper(true);
  const col = { q: 2, r: 2, feature: { type: 'village', name: 'Testwick', kind: 'farmers' } };
  ensureVillage(state, col.feature, 2, 2, 'test');
  const stocked = Object.keys(stockOf(state, 2, 2))[0];
  ok(!buy(state, col, stocked).ok, 'traded before earning trust');
  ok(giveFavour(state, col).ok, 'the favour should cost nothing');
  const goldBefore = state.gold;
  ok(buy(state, col, stocked).ok, 'could not buy once trusted');
  eq(state.gold, goldBefore, 'free mode charged for the purchase');
  ok(!buy(state, col, 'sword').ok, 'free mode bought something the village does not sell');
  ok(sell(state, col, stocked).ok, 'selling should still work');
  ok(state.gold > goldBefore, 'and still pay');
});

test('the flag survives a save and reload', () => {
  const world = ground('grass');
  const player = { q: 3, r: 3 };
  ok(isFree(deserialize(JSON.parse(JSON.stringify(serialize(world, pauper(true), player)))).state), 'free mode was lost in the save');
  ok(!isFree(deserialize(JSON.parse(JSON.stringify(serialize(world, pauper(false), player)))).state), 'an ordinary save came back in free mode');
});

run('freemode');
