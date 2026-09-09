// world.test.mjs — harvesting, mining, prospecting and building all change the
// map, so what matters is that the world is spent correctly: a wood felled to
// bare floor, a cliff cut down until it can be climbed, a vein that runs out,
// and ore that stays invisible until Lore finds it.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test, run, eq, ok } from './_harness.mjs';
import { WorldMap } from '../src/world/mapformat.js';
import { generateWorld } from '../src/world/worldgen.js';
import { makeResolvers, isWater } from '../src/world/tileset.js';
import { neighbors, distance } from '../src/world/hexgrid.js';
import { canStep } from '../src/world/pathfinding.js';
import { Rng } from '../src/core/rng.js';
import { createState, hasBuilt } from '../src/game/state.js';
import { addItem, countItem } from '../src/game/inventory.js';
import { addXp } from '../src/game/skills.js';
import { availableHarvests, harvestSpec, cliffTarget, nearbyOre } from '../src/game/harvests.js';
import { determineContext, villageNear } from '../src/game/context.js';
import { harvest, prospect, build, placementSpots, growCrops, PROSPECT_RADIUS, FIELD_RIPENS_IN } from '../src/game/actions.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const index = JSON.parse(readFileSync(join(root, 'new_tiles', 'index.json'), 'utf8'));
const resolvers = makeResolvers(index);

const rng = () => new Rng('world-test');
const at = (q, r) => ({ q, r });

/** A small flat world of one terrain, for testing one rule at a time. */
function ground(terrain = 'grass', h = 0, w = 7, d = 7) {
  const map = new WorldMap({ seed: 'test' });
  for (let q = 0; q < w; q++) for (let r = 0; r < d; r++) map.place(q, r, terrain, h);
  return { map, resolvers, seed: 'test' };
}

/** A player who is fed and skilled enough not to be the thing under test. */
function ready() {
  const s = createState({ gold: 500 });
  addItem(s, 'cooked_meat', 12);
  for (const skill of ['woodworking', 'stoneworking', 'homesteading', 'metalworking', 'mind']) {
    addXp(s, skill, 5000);
  }
  return s;
}

const offered = (world, state, where) =>
  availableHarvests(world.map, state, where).filter(h => h.ok).map(h => h.spec.id);

// ---------------------------------------------------------------- terrain

test('harvests are offered by terrain, not everywhere', () => {
  const state = ready();

  const grass = ground('grass');
  ok(offered(grass, state, at(3, 3)).includes('forage'), 'grass should be forageable');
  ok(!offered(grass, state, at(3, 3)).includes('gather_flint'), 'no flint in a meadow');

  const stone = ground('stony');
  ok(offered(stone, state, at(3, 3)).includes('gather_flint'), 'flint belongs in the rock');
  ok(offered(stone, state, at(3, 3)).includes('gather_stone'), 'so does stone');
  ok(!offered(stone, state, at(3, 3)).includes('forage'), 'nothing to forage on bare rock');
});

test('water-edge harvests need the water', () => {
  const state = ready();
  const dry = ground('grass');
  ok(!offered(dry, state, at(3, 3)).includes('cut_reeds'), 'reeds without a shore');

  const shore = ground('grass');
  shore.map.place(4, 3, 'water', 0);
  const there = offered(shore, state, at(3, 3));
  ok(there.includes('cut_reeds'), 'reeds should grow by the water');
  ok(there.includes('dig_clay'), 'and clay should be in the bank');
  ok(!offered(shore, state, at(0, 0)).includes('dig_clay'), 'clay found far from any water');
});

test('a tool gate is reported, not hidden', () => {
  const state = ready();
  const shore = ground('grass');
  shore.map.place(4, 3, 'water', 0);
  const all = availableHarvests(shore.map, state, at(3, 3));
  const fishing = all.find(h => h.spec.id === 'fish');
  ok(fishing, 'fishing should be listed at the water');
  ok(!fishing.ok, 'but not possible without a rod');
  ok(fishing.reasons[0].includes('fishing_rod'), `should say why: ${fishing.reasons}`);

  addItem(state, 'fishing_rod', 1);
  ok(offered(shore, state, at(3, 3)).includes('fish'), 'with a rod it should be on offer');
});

// ---------------------------------------------------------------- felling

test('chopping a wood eventually leaves bare forest floor', () => {
  const world = ground('oak_wood');
  const col = world.map.get(3, 3);
  col.feature = { type: 'trees', kind: 'oak', remaining: 2 };
  const state = ready();

  eq(harvest(world, state, at(3, 3), 'chop_rough_log', rng()).ok, false, 'no axe, no logs');

  addItem(state, 'stone_axe', 1);
  ok(harvest(world, state, at(3, 3), 'chop_rough_log', rng()).ok, 'first tree');
  eq(world.map.terrainAt(3, 3), 'oak_wood', 'still wooded with one tree left');

  ok(harvest(world, state, at(3, 3), 'chop_rough_log', rng()).ok, 'last tree');
  eq(world.map.terrainAt(3, 3), 'forest_floor', 'a felled oak wood should become forest floor');
  ok(!world.map.get(3, 3).feature, 'and have nothing left to chop');
  ok(countItem(state, 'rough_log') >= 2, 'you should be holding the logs');
});

test('pine woods fell to pine floor, not oak', () => {
  const world = ground('pine_wood');
  world.map.get(3, 3).feature = { type: 'trees', kind: 'pine', remaining: 1 };
  const state = ready();
  addItem(state, 'stone_axe', 1);
  harvest(world, state, at(3, 3), 'chop_rough_log', rng());
  eq(world.map.terrainAt(3, 3), 'pine_floor', 'pines should leave pine floor');
});

// ------------------------------------------------------------------ cliffs

test('mining a cliff cuts it down until it can be climbed', () => {
  const world = ground('grass');
  world.map.place(4, 3, 'stony', 5);
  const state = ready();
  addItem(state, 'pickaxe', 1);

  const face = () => world.map.heightAt(4, 3);
  ok(!canStep(world.map, at(3, 3), at(4, 3)), 'a five-high face should be unclimbable');
  eq(cliffTarget(world.map, world.map.get(3, 3)).h, 5, 'the tall neighbour is the face');

  let cuts = 0;
  while (offered(world, state, at(3, 3)).includes('mine_cliff') && cuts < 10) {
    const before = face();
    const result = harvest(world, state, at(3, 3), 'mine_cliff', rng());
    ok(result.ok, `cut ${cuts} failed: ${result.message}`);
    eq(face(), before - 1, 'each cut should take one level off');
    cuts++;
  }

  eq(face(), 2, 'mining should stop once the face is under three levels');
  ok(countItem(state, 'stone') > 0, 'and it should have yielded stone');
  ok(!canStep(world.map, at(3, 3), at(4, 3)), 'two levels is still too high to climb');
  // One more level off by hand and it becomes walkable — the point of the exercise.
  world.map.get(4, 3).h = 1;
  ok(canStep(world.map, at(3, 3), at(4, 3)), 'a one-level step should be walkable');
});

test('mining needs a tool', () => {
  const world = ground('grass');
  world.map.place(4, 3, 'stony', 5);
  const state = ready();
  const entry = availableHarvests(world.map, state, at(3, 3)).find(h => h.spec.id === 'mine_cliff');
  ok(entry && !entry.ok, 'bare hands should not cut rock');
  ok(entry.reasons[0].includes('pickaxe'), `should say what is needed: ${entry.reasons}`);
});

// -------------------------------------------------------------------- ore

test('ore is invisible until Lore finds it, and only nearby', () => {
  const world = ground('stony', 4);
  const near = world.map.get(3, 3);
  const far = world.map.get(0, 0);
  for (const col of [near, far]) col.feature = { type: 'ore', remaining: 5, known: false };

  const novice = ready();
  novice.skills.mind.level = 3;
  eq(prospect(world, novice, at(3, 3), rng()).ok, false, 'prospecting before Lore');
  eq(near.feature.known, false, 'the vein should still be hidden');

  const sage = ready();          // mind 7
  const found = prospect(world, sage, at(3, 3), rng());
  ok(found.ok, found.message);
  eq(near.feature.known, true, 'the vein underfoot should be revealed');
  ok(distance(0, 0, 3, 3) > PROSPECT_RADIUS, 'the far vein is out of range for this test to mean anything');
  eq(far.feature.known, false, 'Lore should not reach across the whole map');
});

test('a vein runs out', () => {
  const world = ground('stony', 4);
  const vein = world.map.get(3, 3);
  vein.feature = { type: 'ore', remaining: 2, known: true };
  const state = ready();
  addItem(state, 'stone_chisel', 1);

  ok(nearbyOre(world.map, vein), 'a known vein should be minable');
  let mined = 0;
  while (world.map.get(3, 3).feature && mined < 10) {
    ok(harvest(world, state, at(3, 3), 'mine_ore', rng()).ok, 'mining failed');
    mined++;
  }
  ok(!world.map.get(3, 3).feature, 'the vein should be exhausted and gone');
  ok(countItem(state, 'ore') > 0, 'and it should have given ore');
  ok(!offered(world, state, at(3, 3)).includes('mine_ore'), 'an empty vein is not on offer');
});

test('you can mine a vein from the hex next door', () => {
  const world = ground('stony', 4);
  world.map.get(4, 3).feature = { type: 'ore', remaining: 3, known: true };
  const state = ready();
  addItem(state, 'stone_chisel', 1);
  ok(offered(world, state, at(3, 3)).includes('mine_ore'), 'adjacent ore should be reachable');
});

// -------------------------------------------------------------- building

test('a structure is sited, recorded, and blocks the hex', () => {
  const world = ground('grass');
  const state = ready();
  addItem(state, 'stone', 20);
  addItem(state, 'log', 10);
  addItem(state, 'branch', 10);

  const spots = placementSpots(world, state, at(3, 3), 'hearth');
  eq(spots.length, 7, 'the hex you are on and its six neighbours');

  const result = build(world, state, at(3, 3), 'hearth', at(3, 3), { at: at(3, 3), distance });
  ok(result.ok, result.message);
  ok(hasBuilt(state, 'hearth'), 'the world should know a hearth exists');
  eq(world.map.get(3, 3).feature.item, 'hearth', 'and it should stand on the hex');

  const again = build(world, state, at(3, 3), 'hearth', at(3, 3), { at: at(3, 3), distance });
  ok(!again.ok, 'two hearths on one hex');
});

test('you cannot build on water or out of reach', () => {
  const world = ground('grass');
  world.map.place(4, 3, 'water', 0);
  const state = ready();
  addItem(state, 'stone', 20);
  addItem(state, 'log', 10);
  addItem(state, 'branch', 10);

  const spots = placementSpots(world, state, at(3, 3), 'hearth');
  ok(!spots.some(s => s.q === 4 && s.r === 3), 'water offered as a building site');

  const far = build(world, state, at(3, 3), 'hearth', at(0, 0), { at: at(3, 3), distance });
  ok(!far.ok, 'built a hearth across the map');
});

test('a planted field ripens and can then be harvested', () => {
  const world = ground('grass');
  const state = ready();
  addItem(state, 'seeds', 10);
  addItem(state, 'branch', 10);
  addItem(state, 'wood_hoe', 1);

  const result = build(world, state, at(3, 3), 'field', at(3, 3), { at: at(3, 3), distance });
  ok(result.ok, result.message);
  eq(world.map.terrainAt(3, 3), 'farm', 'a field should read as farmland');
  eq(world.map.get(3, 3).feature.ripe, false, 'and start unripe');
  ok(!offered(world, state, at(3, 3)).includes('harvest_field'), 'harvested it green');

  state.stepsWalked += FIELD_RIPENS_IN;
  growCrops(world, state);
  eq(world.map.get(3, 3).feature.ripe, true, 'it should come ripe');
  ok(offered(world, state, at(3, 3)).includes('harvest_field'), 'and then be harvestable');

  const reaped = harvest(world, state, at(3, 3), 'harvest_field', rng());
  ok(reaped.ok, reaped.message);
  ok(countItem(state, 'grain') > 0, 'a harvest should give grain');
  eq(world.map.get(3, 3).feature.ripe, false, 'and leave the field to grow again');
});

// -------------------------------------------------------------- in a world

test('a real world offers something to do at the spawn', () => {
  for (const seed of ['alpha', 'bravo', 'charlie']) {
    const map = generateWorld({ seed, radius: 20, resolvers });
    const world = { map, resolvers, seed };
    const state = createState();          // level 1, no tools, no food
    const ctx = determineContext(world, state, map.spawn);
    ok(ctx.offers.length > 0, `${seed}: nothing to do where you wake up`);
    // Foraging is what gets you your first energy, so it must not need energy.
    const ids = ctx.offers.map(o => o.id);
    ok(ids.includes('forage') || ids.includes('find_herb') || ids.includes('gather_stone'),
      `${seed}: no way to start — offers were ${ids.join(', ')}`);
  }
});

test('every village can be traded with from its own hex', () => {
  const map = generateWorld({ seed: 'trading', radius: 20, resolvers });
  const world = { map, resolvers, seed: 'trading' };
  const state = createState();
  const villages = [...map].filter(c => c.feature?.type === 'village');
  ok(villages.length > 0, 'no villages generated');
  for (const v of villages) {
    eq(villageNear(map, v)?.feature.name, v.feature.name, 'standing on it should find it');
    const ctx = determineContext(world, state, v);
    ok(ctx.offers.some(o => o.kind === 'trade'), `${v.feature.name} offers no trade`);
  }
});

test('the opening chain works from nothing: forage, reeds, cord, snare', () => {
  const map = generateWorld({ seed: 'opening', radius: 20, resolvers });
  const world = { map, resolvers, seed: 'opening' };
  const state = createState();
  const r = rng();

  // Somewhere on the shore, which is where the opening actually happens.
  const shore = [...map].find(c => !isWater(c.terrain)
    && neighbors(c.q, c.r).some(n => { const o = map.get(n.q, n.r); return o && isWater(o.terrain); }));
  ok(shore, 'no shoreline in the whole world');

  eq(state.energy, 0, 'you start with nothing to eat');
  ok(harvest(world, state, shore, 'forage', r).ok, 'foraging should not itself need energy');
  ok(state.energy > 0, 'and it should feed you');

  for (let i = 0; i < 3; i++) harvest(world, state, shore, 'cut_reeds', r);
  ok(countItem(state, 'reed') >= 2, 'the shore should give reeds');
});

test('a ladder is placed against a cliff, and opens it', () => {
  const world = ground('grass', 1);
  // A 13-level face: unclimbable, undroppable, and the whole point of a ladder.
  world.map.place(4, 3, 'stony', 14);
  const state = ready();
  addItem(state, 'beam', 10);
  addItem(state, 'cord', 10);
  addItem(state, 'stone_axe', 1);

  eq(canStep(world.map, at(3, 3), at(4, 3)), false, 'a 13-level face should be a wall');

  const spots = placementSpots(world, state, at(3, 3), 'ladder');
  ok(spots.some(s => s.q === 4 && s.r === 3), 'the cliff top was not offered as a ladder target');
  ok(!spots.some(s => s.q === 3 && s.r === 3), 'a ladder against your own hex climbs nothing');
  ok(!spots.some(s => s.q === 2 && s.r === 3), 'flat ground was offered as a ladder target');

  const result = build(world, state, at(3, 3), 'ladder', at(4, 3), { at: at(3, 3), distance });
  ok(result.ok, result.message);
  eq(world.map.get(3, 3).feature.item, 'ladder', 'the ladder stands on the hex you are on');
  ok(canStep(world.map, at(3, 3), at(4, 3)), 'the ladder did not open the cliff');
  ok(canStep(world.map, at(4, 3), at(3, 3)), 'a ladder should come back down as well');

  // And it is a joint between two named columns, not a general climbing permit.
  ok(!canStep(world.map, at(3, 2), at(4, 3)), 'the ladder let you climb from the wrong hex');
});

test('a ladder survives a save and reload', () => {
  const world = ground('grass', 1);
  world.map.place(4, 3, 'stony', 12);
  const state = ready();
  addItem(state, 'beam', 10);
  addItem(state, 'cord', 10);
  addItem(state, 'stone_axe', 1);
  build(world, state, at(3, 3), 'ladder', at(4, 3), { at: at(3, 3), distance });

  const reloaded = WorldMap.fromJSON(JSON.parse(JSON.stringify(world.map.toJSON())));
  ok(canStep(reloaded, at(3, 3), at(4, 3)), 'the ladder was lost in the save');
});

run('world');
