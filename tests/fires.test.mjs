// fires.test.mjs — fires that burn down, a hearth that takes logs, and the
// other chapter-one rules: what a hex can hold, and the sayings.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test, run, eq, ok } from './_harness.mjs';
import { WorldMap } from '../src/world/mapformat.js';
import { makeResolvers } from '../src/world/tileset.js';
import { distance } from '../src/world/hexgrid.js';
import { createState, hasBuilt, builtNear, RECIPES } from '../src/game/state.js';
import { addItem, countItem } from '../src/game/inventory.js';
import {
  relightCampfire, build, burnFires, feedHearth, fuelLeft, campfireWants,
  CAMPFIRE_BURNS, HEARTH_LOGS, TURNS_PER_LOG, HEARTH_MAX_FUEL,
} from '../src/game/actions.js';
import { resourcesAt, MAX_HIDDEN_PER_HEX } from '../src/game/discovery.js';
import { availableHarvests, regrowText } from '../src/game/harvests.js';
import { itemWords } from '../src/game/item_words.js';
import { SAYINGS, nextSaying } from '../src/game/sayings.js';
import { generateWorld } from '../src/world/worldgen.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const index = JSON.parse(readFileSync(join(root, 'new_tiles', 'index.json'), 'utf8'));
const resolvers = makeResolvers(index);
const at = (q, r) => ({ q, r });

function ground(terrain = 'grass', h = 0, w = 7, d = 7) {
  const map = new WorldMap({ seed: 'fires' });
  for (let q = 0; q < w; q++) for (let r = 0; r < d; r++) map.place(q, r, terrain, h);
  map.spawn = { q: 3, r: 3 };
  return { map, resolvers, seed: 'fires' };
}

test('the campfire wants wood and flint, in your own words', () => {
  const s = createState();
  ok(/wood and a flint/.test(campfireWants(s)), campfireWants(s));
  addItem(s, 'flint', 1);
  eq(campfireWants(s), 'I need some wood...');
  addItem(s, 'branch', 1);
  eq(campfireWants(s), '');
});

test('the lit campfire burns for a day, then goes back to cold ashes', () => {
  const world = ground();
  const s = createState();
  addItem(s, 'branch', 1);
  addItem(s, 'flint', 1);
  ok(relightCampfire(world, s, at(3, 3)).ok, 'did not light');
  const camp = world.map.get(3, 3);
  ok(builtNear(s, 'hearth', at(3, 3), 1, distance), 'a lit campfire is a hearth to cook at');
  eq(fuelLeft(s, camp), CAMPFIRE_BURNS);
  eq(s.stats.firesLit, 1);

  s.turn = CAMPFIRE_BURNS - 1;
  eq(burnFires(world, s).out.length, 0, 'went out early');
  s.turn = CAMPFIRE_BURNS;
  const res = burnFires(world, s);
  eq(res.out.length, 1);
  ok(res.out[0].camp, 'should be the campfire');
  ok(!camp.feature, 'the campfire should be cold ashes again');
  ok(!builtNear(s, 'hearth', at(3, 3), 1, distance), 'a cold campfire is no station');

  // and it can be lit again
  addItem(s, 'branch', 1);
  addItem(s, 'flint', 1);
  ok(relightCampfire(world, s, at(3, 3)).ok, 'could not light it again');
});

test('a hearth is built round five logs and burns five days', () => {
  eq(RECIPES.hearth.inputs.log, HEARTH_LOGS);
  const world = ground();
  const s = createState({ free: true });
  ok(build(world, s, at(1, 1), 'hearth', at(1, 1), { at: at(1, 1), distance }).ok, 'did not build');
  const col = world.map.get(1, 1);
  eq(fuelLeft(s, col), HEARTH_LOGS * TURNS_PER_LOG);

  s.turn = HEARTH_LOGS * TURNS_PER_LOG;
  burnFires(world, s);
  ok(col.feature?.cold, 'the hearth should stand cold');
  ok(!hasBuilt(s, 'hearth'), 'a cold hearth is no station');
});

test('logs feed a hearth a day each, up to ten days; a cold one needs five', () => {
  const world = ground();
  const s = createState({ free: true });
  build(world, s, at(1, 1), 'hearth', at(1, 1), { at: at(1, 1), distance });
  s.free = false;
  const col = world.map.get(1, 1);

  eq(feedHearth(world, s, col).message, 'I need some wood...');
  addItem(s, 'log', 9);
  const fed = feedHearth(world, s, col);
  ok(fed.ok, fed.message);
  eq(fed.logs, HEARTH_MAX_FUEL / TURNS_PER_LOG - HEARTH_LOGS, 'should fill it to ten days');
  eq(fuelLeft(s, col), HEARTH_MAX_FUEL);
  eq(countItem(s, 'log'), 4);
  ok(!feedHearth(world, s, col).ok, 'a full hearth took more');

  s.turn = HEARTH_MAX_FUEL;
  burnFires(world, s);
  ok(col.feature.cold, 'should have gone cold');
  ok(!feedHearth(world, s, col).ok, 'four logs lit a cold hearth');
  addItem(s, 'log', 1);
  ok(feedHearth(world, s, col).ok, 'five logs did not light it');
  ok(!col.feature.cold && hasBuilt(s, 'hearth'), 'should burn again, and be a station');
  eq(countItem(s, 'log'), 0);
});

test('no hex holds more than two hidden things', () => {
  const map = generateWorld({ seed: 'cap', resolvers });
  let most = 0;
  for (const col of map) most = Math.max(most, resourcesAt(map, col).length);
  ok(most <= MAX_HIDDEN_PER_HEX, `a hex held ${most}`);
  ok(most > 0, 'nothing hidden anywhere');
});

test('a spent hex says so plainly, and the second time that it comes back', () => {
  ok(!/\d/.test(regrowText('forage')), regrowText('forage'));
  ok(/eventually/.test(regrowText('forage', true)), regrowText('forage', true));
  const world = ground('meadow');
  const s = createState();
  s.picked = { '2,2:forage': 99 };
  const entry = availableHarvests(world.map, s, at(2, 2)).find(h => h.spec.id === 'forage');
  ok(entry.regrowing && !entry.ok, 'should be regrowing');
  eq(entry.reasons[0], 'The bush has been picked clean.');
});

test('items speak of their nearest use, and change as you learn', () => {
  const s = createState();
  ok(/start a fire/.test(itemWords(s, 'branch')));
  s.stats = { firesLit: 1 };
  ok(/handle/.test(itemWords(s, 'branch')));
  ok(/cord/.test(itemWords(s, 'reed')));
  s.stats.made = { cord: 1 };
  ok(/basket/.test(itemWords(s, 'reed')));
  eq(itemWords(s, 'stone'), 'A rock.');
});

test('the sayings come round in turn, each with its source', () => {
  for (const x of SAYINGS) ok(x.text && /^(Avot|Kohelet|Mishlei) \d+:\d+$/.test(x.ref), JSON.stringify(x));
  const s = {};
  const seen = new Set();
  for (let i = 0; i < SAYINGS.length; i++) seen.add(nextSaying(s));
  eq(seen.size, SAYINGS.length, 'a saying came round twice');
  eq(s.sayings.length, SAYINGS.length, 'every saying once before any repeats');
  const again = nextSaying(s);
  ok(again && s.sayings.length === 1, 'the cycle should start over');
});

run();
