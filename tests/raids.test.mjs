// raids.test.mjs — raider camps, the raid clock, the dice, and the defences.
// Simulated headless: the units update in fixed steps with nobody watching.

import { test, eq, ok, run } from './_harness.mjs';
import { generateWorld } from '../src/world/worldgen.js';
import { canStep } from '../src/world/pathfinding.js';
import { neighbors, distance } from '../src/world/hexgrid.js';
import { isWater } from '../src/world/tileset.js';
import { createState, DAY_LENGTH } from '../src/game/state.js';
import { build, placementSpots, penaltyOnDeath } from '../src/game/actions.js';
import { addItem, countItem } from '../src/game/inventory.js';
import { clash, expectedDamage } from '../src/game/combat.js';
import {
  garrisonCamps, campsLeft, guardsAt, updateUnits, ensureRaidState, FIRST_RAID_AT,
  hostiles, burnCamp, raidRoster, makeUnit,
} from '../src/game/raiders.js';

const SEEDS = ['alpha', 'beta', 'gamma', 'delta'];

/** A world with a hearth and a field put up beside the spawn. */
function homestead(seed) {
  const map = generateWorld({ seed });
  const world = { map, seed };
  const state = createState({ free: true });
  const at = { q: map.spawn.q, r: map.spawn.r };
  for (const id of ['hearth', 'field']) {
    const spot = placementSpots(world, state, at, id)[0];
    ok(spot, `${seed}: nowhere to put a ${id}`);
    ok(build(world, state, at, id, spot).ok, `${seed}: could not build a ${id}`);
  }
  state.free = false;
  garrisonCamps(map, state);
  return { map, world, state };
}

/** Somewhere well away from the action for the player to stand. */
function farAway(map, state) {
  let best = null;
  for (const col of map) {
    if (isWater(col.terrain)) continue;
    const d = Math.min(...state.built.map(b => distance(b.q, b.r, col.q, col.r)),
      ...campsLeft(map).map(c => distance(c.q, c.r, col.q, col.r)));
    if (!best || d > best.d) best = { q: col.q, r: col.r, d };
  }
  return best;
}

function simulate(world, state, player, seconds, step = 0.1) {
  const events = [];
  for (let t = 0; t < seconds; t += step) {
    state.time += step;
    updateUnits({ world, state, player, events }, step);
  }
  return events;
}

test('every world has three camps, one of them the Warlord\'s, all garrisoned', () => {
  for (const seed of SEEDS) {
    const { map, state } = homestead(seed);
    const camps = campsLeft(map);
    eq(camps.length, 3, `${seed}: camps`);
    eq(camps.filter(c => c.feature.boss).length, 1, `${seed}: one hold`);
    for (const c of camps) ok(guardsAt(state, c) >= 3, `${seed}: ${c.feature.name} has no guards`);
    ok(state.units.some(u => u.kind === 'warlord'), `${seed}: no warlord`);
  }
});

test('camps sit well away from where you start', () => {
  for (const seed of SEEDS) {
    const map = generateWorld({ seed });
    for (const c of campsLeft(map)) {
      ok(distance(c.q, c.r, map.spawn.q, map.spawn.r) >= 10, `${seed}: ${c.feature.name} is too close`);
    }
  }
});

test('the dice are fair: 4+ hits, 5+ blocks', () => {
  let rolls = 0, dmg = 0;
  for (let i = 0; i < 4000; i++) { dmg += clash(3, 1).damage; rolls++; }
  const mean = dmg / rolls;
  // 3 dice at 1/2 less 1 die at 1/3 is 7/6, a touch more since damage never goes negative.
  ok(mean > 1.05 && mean < 1.5, `mean damage ${mean} is off`);
  eq(clash(0, 3).damage, 0, 'no dice, no damage');
  ok(expectedDamage(4, 1) > expectedDamage(2, 1), 'more dice, more damage');
});

test('a raid is announced, then comes, then wrecks what you built', () => {
  let wrecked = 0;
  for (const seed of SEEDS) {
    const { map, world, state } = homestead(seed);
    const player = { ...farAway(map, state), moving: false };
    state.time = FIRST_RAID_AT - 60;
    const events = simulate(world, state, player, 60 + 240, 0.1);
    const warn = events.findIndex(e => e.type === 'warn');
    const raid = events.findIndex(e => e.type === 'raid');
    ok(warn >= 0, `${seed}: no warning`);
    ok(raid > warn, `${seed}: the raid did not follow the warning`);
    if (events.some(e => e.type === 'destroyed' || e.type === 'ransack')) wrecked++;
  }
  ok(wrecked >= SEEDS.length - 1, `raiders reached a homestead in only ${wrecked} of ${SEEDS.length} worlds`);
});

test('raid bands grow as the days go on', () => {
  ok(raidRoster(2).length < raidRoster(8).length, 'later raids should be bigger');
  ok(raidRoster(12).includes('brute'), 'brutes join later raids');
  ok(raidRoster(30).length <= 6, 'but never more than six');
});

test('walls stop raiders unless they hack through', () => {
  const { map } = homestead('alpha');
  const a = map.get(map.spawn.q, map.spawn.r);
  const n = neighbors(a.q, a.r).map(x => map.get(x.q, x.r)).find(c => c && !isWater(c.terrain) && Math.abs(c.h - a.h) <= 1 && !c.feature);
  n.feature = { type: 'structure', item: 'palisade', hp: 10, maxHp: 10, wall: true };
  ok(!canStep(map, a, n, { raider: true }), 'a raider walked through a wall');
  ok(canStep(map, a, n, { raider: true, breakWalls: true }), 'a raider could not even hack at it');
  ok(canStep(map, a, n, {}), 'you should pass your own walls');
});

test('a watchtower shoots raiders that come within range', () => {
  const { map, world, state } = homestead('beta');
  const tower = state.built[0];
  state.built.push({ item: 'watchtower', q: tower.q, r: tower.r });
  const spot = neighbors(tower.q, tower.r).map(x => map.get(x.q, x.r)).find(c => c && !isWater(c.terrain));
  const u = makeUnit('raider', 'raider', spot, { mode: 'guard', home: { q: spot.q, r: spot.r } });
  state.units.push(u);
  const player = { ...farAway(map, state), moving: false };
  const events = simulate(world, state, player, 20);
  ok(events.some(e => e.type === 'arrow' && e.who === u), 'the tower never shot');
});

test('a shrine shelters what is near it; the raid goes for a village instead', () => {
  const { map, world, state } = homestead('gamma');
  const hearth = state.built[0];
  state.built.push({ item: 'shrine', q: hearth.q, r: hearth.r });
  const player = { ...farAway(map, state), moving: false };
  state.time = FIRST_RAID_AT - 40;
  const events = simulate(world, state, player, 45, 0.1);
  const raid = events.find(e => e.type === 'raid');
  ok(raid, 'no raid came');
  eq(raid.target.kind, 'village', 'the raid should have gone for a village');
});

test('a camp burns once its guards are down, and the last one ends the raids', () => {
  const { map, world, state } = homestead('delta');
  for (const camp of campsLeft(map)) {
    for (const u of state.units) if (u.home?.q === camp.q && u.home?.r === camp.r) u.hp = 0;
    eq(guardsAt(state, camp), 0, 'guards should be down');
    burnCamp(state, camp);
  }
  eq(campsLeft(map).length, 0, 'all camps burned');
  ensureRaidState(state);
  state.time = FIRST_RAID_AT + DAY_LENGTH * 3;
  const events = simulate(world, state, { ...map.spawn, moving: false }, 60);
  ok(!events.some(e => e.type === 'raid'), 'raids kept coming with no camps left');
});

test('dying costs half your goods and gold, never your tools', () => {
  const state = createState();
  addItem(state, 'stone_axe', 1);
  addItem(state, 'log', 10);
  state.gold = 20;
  penaltyOnDeath(state);
  eq(countItem(state, 'stone_axe'), 1, 'kept the axe');
  eq(countItem(state, 'log'), 5, 'lost half the logs');
  eq(state.gold, 10, 'lost half the gold');
});

run('raids');
