// raids.test.mjs — raider camps, the moon they raid by, the dice, and the defences.
// Simulated headless: the units update in fixed steps with nobody watching.

import { test, eq, ok, run } from './_harness.mjs';
import { generateWorld } from '../src/world/worldgen.js';
import { canStep, findPath, isOpenWater } from '../src/world/pathfinding.js';
import { neighbors, distance } from '../src/world/hexgrid.js';
import { isWater } from '../src/world/tileset.js';
import { createState, moonOf, DAY_LENGTH, MOON_DAYS } from '../src/game/state.js';
import { build, placementSpots, penaltyOnDeath } from '../src/game/actions.js';
import { addItem, countItem } from '../src/game/inventory.js';
import { clash, expectedDamage } from '../src/game/combat.js';
import {
  garrisonCamps, campsLeft, guardsAt, updateUnits, ensureRaidState,
  hostiles, abroad, burnCamp, raidWaves, raidSize, makeUnit,
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

/** The times of the first moon, for a state still at its start. */
const firstMoon = () => moonOf({ time: 0 });

test('the fair days are a promise: nothing sets out before the omens', () => {
  const { map, world, state } = homestead('alpha');
  const player = { ...farAway(map, state), moving: false };
  const events = simulate(world, state, player, firstMoon().omensAt - 2, 0.5);
  eq(events.filter(e => ['omen', 'nightfall', 'raid'].includes(e.type)).length, 0, 'something stirred on a fair day');
  eq(abroad(state).length, 0, 'raiders were out in your lands on a fair day');
  eq(moonOf(state).phase, 'fair', 'the moon should still be in its fair days');
});

test('omens, then nightfall, then the raid, and it wrecks what you built', () => {
  let wrecked = 0;
  for (const seed of SEEDS) {
    const { map, world, state } = homestead(seed);
    const player = { ...farAway(map, state), moving: false };
    const m = firstMoon();
    state.time = m.omensAt - 5;
    const events = simulate(world, state, player, m.dawnAt - state.time - 1, 0.1);
    const omen = events.findIndex(e => e.type === 'omen');
    const night = events.findIndex(e => e.type === 'nightfall');
    const raid = events.findIndex(e => e.type === 'raid');
    ok(omen >= 0, `${seed}: no omens`);
    ok(night > omen, `${seed}: night did not follow the omens`);
    ok(raid > night, `${seed}: the raid did not wait for nightfall`);
    eq(events[omen].size, 2, `${seed}: the first moon should send two`);
    if (events.some(e => e.type === 'destroyed' || e.type === 'ransack')) wrecked++;
  }
  ok(wrecked >= SEEDS.length - 1, `raiders reached a homestead in only ${wrecked} of ${SEEDS.length} worlds`);
});

test('the omens show the way they will come', () => {
  const { map, world, state } = homestead('beta');
  const player = { ...farAway(map, state), moving: false };
  state.time = firstMoon().omensAt - 1;
  simulate(world, state, player, 3);
  const { route, from, target } = state.raid;
  ok(route && route.length > 5, 'no route was scouted');
  eq({ q: route[0].q, r: route[0].r }, { q: from.q, r: from.r }, 'the route should start at their camp');
  const end = route[route.length - 1];
  ok(distance(end.q, end.r, target.q, target.r) <= 1, 'the route should end at what they are after');
});

test('at dawn whoever is still raiding turns for home', () => {
  const { map, world, state } = homestead('gamma');
  // Something they cannot finish with before morning.
  for (const b of state.built) {
    const f = map.get(b.q, b.r).feature;
    f.hp = f.maxHp = 5000;
  }
  const player = { ...farAway(map, state), moving: false };
  const m = firstMoon();
  state.time = m.duskAt - 2;
  const events = simulate(world, state, player, m.dawnAt - state.time + 3, 0.1);
  ok(events.some(e => e.type === 'raid'), 'no raid came');
  ok(events.some(e => e.type === 'dawn' || e.type === 'held'), 'the night was never called over');
  eq(state.units.filter(u => u.faction === 'raider' && u.mode === 'raid').length, 0, 'raiders were still at it after dawn');
  eq(moonOf(state).moon, 2, 'a new moon should have begun');
  eq(state.raid.stage, 'idle', 'the new moon should start quiet');
});

test('a watchtower brings the omens at first light', () => {
  const { map, world, state } = homestead('delta');
  const player = { ...farAway(map, state), moving: false };
  const lastDay = (MOON_DAYS - 1) * DAY_LENGTH;
  state.time = lastDay + 2;
  eq(simulate(world, state, player, 2).filter(e => e.type === 'omen').length, 0, 'omens came at dawn without a tower');
  state.built.push({ item: 'watchtower', q: state.built[0].q, r: state.built[0].r });
  const omen = simulate(world, state, player, 2).find(e => e.type === 'omen');
  ok(omen && omen.tower, 'the tower did not see them early');
});

test('raid bands grow moon by moon', () => {
  eq(raidWaves(1), [['raider', 'raider']], 'the first moon is two raiders in one wave');
  ok(raidSize(raidWaves(2)) < raidSize(raidWaves(6)), 'later raids should be bigger');
  eq(raidWaves(3).length, 2, 'two waves by the third moon');
  eq(raidWaves(6).length, 3, 'three waves later on');
  ok(raidWaves(5).flat().includes('brute'), 'brutes join later raids');
  ok(raidSize(raidWaves(40)) <= 16, 'but never more than sixteen');
  ok(raidSize(raidWaves(6, 2)) < raidSize(raidWaves(6)), 'burning camps should thin the bands');
  for (let moon = 1; moon <= 12; moon++) {
    const w = raidWaves(moon);
    ok(w.every(x => x.length > 0), `moon ${moon} has an empty wave`);
    ok(w[w.length - 1].length >= w[0].length, `moon ${moon}: the last wave should not be the smallest`);
  }
});

test('raiders cross the river only where the map marks a crossing', () => {
  for (const seed of SEEDS) {
    const map = generateWorld({ seed });
    ok(map.hasCrossings(), `${seed}: no crossings`);
    const marked = [...map].filter(c => c.feature?.type === 'crossing');
    ok(marked.every(c => isOpenWater(c.terrain)), `${seed}: a crossing on dry land`);

    // Everywhere else the river is shut to them.
    const shut = [...map].find(c => c.terrain === 'river' && !c.feature);
    const bank = neighbors(shut.q, shut.r).map(n => map.get(n.q, n.r)).find(c => c && !isWater(c.terrain));
    if (bank) ok(!canStep(map, bank, shut, { raider: true }), `${seed}: a raider rafted over open river`);

    // And every camp still has a way to you, over a crossing.
    for (const camp of campsLeft(map)) {
      const path = findPath(map, camp, map.spawn, { raider: true, limit: 8000 });
      ok(path, `${seed}: ${camp.feature.name} cannot reach the near bank`);
      for (const s of path) {
        const col = map.get(s.q, s.r);
        if (isOpenWater(col.terrain)) eq(col.feature?.type, 'crossing', `${seed}: the way from ${camp.feature.name} leaves the crossings`);
      }
    }
  }
});

test('a crossing does not let you over: the far bank still needs a boat', () => {
  const map = generateWorld({ seed: 'alpha' });
  const hex = [...map].find(c => c.feature?.type === 'crossing');
  const bank = neighbors(hex.q, hex.r).map(n => map.get(n.q, n.r)).find(c => c && !isWater(c.terrain));
  ok(bank, 'a crossing with no bank beside it');
  ok(!canStep(map, bank, hex, {}), 'you walked onto the water at a crossing');
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
  state.time = firstMoon().duskAt - 3;
  const events = simulate(world, state, player, 8, 0.1);
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
  state.time = firstMoon().omensAt + DAY_LENGTH * MOON_DAYS - 5;
  const events = simulate(world, state, { ...map.spawn, moving: false }, firstMoon().dawnAt - firstMoon().omensAt);
  ok(!events.some(e => e.type === 'raid' || e.type === 'omen'), 'raids kept coming with no camps left');
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
