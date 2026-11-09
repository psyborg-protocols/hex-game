// mind.test.mjs — exploring, hidden resources, scenery, and where Mind xp
// comes from.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test, run, eq, ok } from './_harness.mjs';
import { generateWorld } from '../src/world/worldgen.js';
import { WorldMap } from '../src/world/mapformat.js';
import { makeResolvers, isWater } from '../src/world/tileset.js';
import { neighbors, distance } from '../src/world/hexgrid.js';
import { createState } from '../src/game/state.js';
import { addXp, levelOf } from '../src/game/skills.js';
import { RECIPES } from '../data/game_data.js';
import {
  HIDDEN, resourcesAt, harvestsHere, exploreHex, isExplored, isKnown, scenicOf,
  ensureMind, TIERS, factsOf, TRADE_REVEAL_RADIUS,
} from '../src/game/discovery.js';
import { onStep, onExplored, onTrade, ACHIEVEMENTS, VILLAGE_XP, FIRST_TRADE_XP } from '../src/game/mind.js';
import { Explorer, phaseAt } from '../src/game/explorer.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const resolvers = makeResolvers(JSON.parse(readFileSync(join(root, 'new_tiles', 'index.json'), 'utf8')));

const SEEDS = ['alpha', 'bravo', 'charlie'];
const worlds = SEEDS.map(seed => generateWorld({ seed, resolvers }));
const worldOf = map => ({ map, resolvers, seed: map.seed });

/** A small flat world of one terrain. */
function ground(terrain = 'grass', h = 0, w = 7, d = 7, seed = 'test') {
  const map = new WorldMap({ seed });
  for (let q = 0; q < w; q++) for (let r = 0; r < d; r++) map.place(q, r, terrain, h);
  return map;
}

const mindXp = s => {
  // Total xp ever earned in mind, across the levels it has rolled through.
  let total = s.skills.mind.xp;
  for (let l = 1; l < s.skills.mind.level; l++) total += l * l * 10;
  return total;
};

// --------------------------------------------------------- hidden resources

test('hidden resources are the same every time, and follow the terrain', () => {
  const map = worlds[0];
  const again = generateWorld({ seed: SEEDS[0], resolvers });
  for (const col of map) {
    const found = resourcesAt(map, col);
    eq(found, resourcesAt(again, again.get(col.q, col.r)), `resources moved at ${col.q},${col.r}`);
    for (const id of found) {
      ok(id in HIDDEN, `${id} is not a hidden harvest`);
    }
    if (col.terrain === 'meadow') ok(!found.includes('gather_flint'), 'flint in a meadow');
  }
});

test('only some of the right ground has each resource', () => {
  const map = worlds[1];
  const open = [...map].filter(c => ['meadow', 'grass'].includes(c.terrain));
  const berries = open.filter(c => resourcesAt(map, c).includes('forage')).length;
  const share = berries / open.length;
  ok(share > 0.45 && share < 0.75, `berries on ${(share * 100).toFixed(0)}% of open ground`);
});

test('a hidden harvest is not offered until the hex is explored, and never where there is none', () => {
  const map = ground('grass', 0, 12, 12);
  const state = createState();
  const withBerries = [...map].find(c => resourcesAt(map, c).includes('forage'));
  const without = [...map].find(c => !resourcesAt(map, c).includes('forage'));
  ok(withBerries && without, 'the test field needs both kinds of hex');

  const ids = at => harvestsHere(map, state, at).map(h => h.spec.id);
  ok(!ids(withBerries).includes('forage'), 'berries offered before exploring');
  ok(ids(withBerries).includes('gather_branch') || !ids(withBerries).includes('forage'),
    'the obvious harvests should not need exploring');

  exploreHex(map, state, withBerries.q, withBerries.r);
  exploreHex(map, state, without.q, without.r);
  ok(ids(withBerries).includes('forage'), 'berries not offered after exploring');
  ok(!ids(without).includes('forage'), 'berries offered where there are none');
});

test('a village trade reveals the land around it, once', () => {
  const map = worlds[0];
  const village = [...map].find(c => c.feature?.type === 'village');
  const state = createState();
  const before = mindXp(state);

  const first = onTrade(worldOf(map), state, village);
  ok(first.revealed.length > 10, 'a first trade should reveal the country round the village');
  for (const c of first.revealed) {
    ok(distance(c.q, c.r, village.q, village.r) <= TRADE_REVEAL_RADIUS, 'revealed too far away');
    ok(isKnown(state, c.q, c.r), 'revealed but not known');
    ok(!isExplored(state, c.q, c.r), 'a trade should not count as exploring — the scenery is still yours to find');
  }
  eq(mindXp(state) - before, FIRST_TRADE_XP, 'first trade xp');

  const second = onTrade(worldOf(map), state, village);
  eq(second.revealed.length, 0, 'a second trade revealed more');
  eq(second.moments.length, 0, 'a second trade at the same village paid again');
});

// ------------------------------------------------------------------ scenery

test('most ground is ordinary, and the scenic tiers get rarer', () => {
  for (const map of worlds) {
    const land = [...map].filter(c => !isWater(c.terrain));
    const tiers = [0, 0, 0, 0];
    for (const c of land) tiers[scenicOf(map, c).tier]++;
    const pct = tiers.map(n => n / land.length);
    ok(pct[0] > 0.85, `${map.seed}: only ${(pct[0] * 100).toFixed(0)}% ordinary`);
    ok(tiers[1] > tiers[2] && tiers[2] > tiers[3], `${map.seed}: tiers ${tiers.join('/')}`);
    ok(tiers[3] >= 1, `${map.seed}: no gold at all`);
  }
});

test('the summit is always gold, and every scenic place has a name', () => {
  for (const map of worlds) {
    const summit = factsOf(map).summit;
    eq(scenicOf(map, summit).tier, 3, `${map.seed}: summit`);
    for (const c of map) {
      const s = scenicOf(map, c);
      if (s.tier) ok(s.name, `${map.seed}: an unnamed scenic place`);
    }
  }
});

test('exploring a hex marks it and pays its tier once', () => {
  const map = worlds[2];
  const world = worldOf(map);
  const spot = [...map].find(c => scenicOf(map, c).tier === 2);
  ok(spot, 'no silver place to test with');
  const state = createState();
  const before = mindXp(state);

  const first = onExplored(world, state, spot);
  eq(first.found.tier, 2, 'tier');
  ok(first.moments.some(m => m.kind === 'scenic' && m.tier === 2), 'no scenic moment');
  ok(mindXp(state) - before >= TIERS[2].xp, 'silver xp not paid');
  ok(isExplored(state, spot.q, spot.r) && isKnown(state, spot.q, spot.r), 'not marked');

  const again = onExplored(world, state, spot);
  eq(again.found, null, 'explored twice');
  eq(again.moments.length, 0, 'paid twice');
});

test('ordinary ground pays nothing itself, but adds up to a milestone', () => {
  const map = ground('grass', 0, 14, 14, 'flat-milestone');
  const world = worldOf(map);
  const state = createState();
  // Away from the board's edge, which is an achievement of its own.
  const plain = [...map].filter(c => !scenicOf(map, c).tier
    && neighbors(c.q, c.r).every(n => map.get(n.q, n.r)));
  ok(plain.length >= 10, 'need ten plain hexes');

  for (const c of plain.slice(0, 9)) {
    const r = onExplored(world, state, c);
    eq(r.moments.length, 0, 'an ordinary hex announced itself');
  }
  const tenth = onExplored(world, state, plain[9]);
  ok(tenth.moments.some(m => m.kind === 'achievement'), 'ten explored should be a milestone');
});

test('ore traces only show up once Lore has taught you what to look for', () => {
  const map = ground('stony', 2, 7, 7);
  map.get(3, 3).feature = { type: 'ore', remaining: 5, known: false };

  const novice = createState();
  eq(exploreHex(map, novice, 3, 2).oreSign, false, 'a trace before Lore');

  const sage = createState();
  addXp(sage, 'mind', 5000);
  ok(levelOf(sage, 'mind') >= 4, 'sage should have Lore');
  eq(exploreHex(map, sage, 3, 2).oreSign, true, 'no trace beside a vein');
  eq(map.get(3, 3).feature.known, false, 'a trace must not reveal the vein itself');
  eq(exploreHex(map, sage, 0, 6).oreSign, false, 'a trace far from any vein');
});

// ---------------------------------------------------------------- the clock

test('standing still explores a hex, and better places take longer', () => {
  const map = worlds[0];
  const plain = [...map].find(c => !isWater(c.terrain) && !scenicOf(map, c).tier);
  const gold = factsOf(map).summit;

  const timeTo = col => {
    const ex = new Explorer(map, createState());
    const player = { q: col.q, r: col.r, moving: false };
    for (let t = 0; t < 20; t += 0.1) if (ex.update(0.1, player, true)) return t + 0.1;
    return Infinity;
  };
  const a = timeTo(plain);
  const b = timeTo(gold);
  ok(Math.abs(a - TIERS[0].seconds) < 0.15, `plain took ${a}s`);
  ok(Math.abs(b - TIERS[3].seconds) < 0.15, `gold took ${b}s`);
});

test('moving or being busy resets the clock', () => {
  const map = worlds[0];
  const col = [...map].find(c => !isWater(c.terrain));
  const ex = new Explorer(map, createState());
  const player = { q: col.q, r: col.r, moving: false };
  ex.update(1, player, true);
  ok(ex.charge && ex.charge.t >= 1, 'should be charging');
  ex.update(0.1, { ...player, moving: true }, true);
  eq(ex.charge, null, 'walking off did not reset');
  ex.update(1, player, true);
  ex.update(0.1, player, false);
  eq(ex.charge, null, 'getting busy did not reset');
});

test('the ticker runs one circuit per tier', () => {
  eq(phaseAt(0).phase, 0, 'starts pale');
  eq(phaseAt(TIERS[0].seconds - 0.01).phase, 0, 'still pale');
  eq(phaseAt(TIERS[0].seconds + 0.01).phase, 1, 'then copper');
  eq(phaseAt(TIERS[2].seconds + 0.01).phase, 3, 'gold last');
  ok(phaseAt(TIERS[1].seconds - 0.01).frac > 0.95, 'a circuit should nearly close before the next starts');
});

// ------------------------------------------------------------ travel and xp

test('arriving at a village pays once', () => {
  const map = worlds[1];
  const world = worldOf(map);
  const village = [...map].find(c => c.feature?.type === 'village');
  const beside = neighbors(village.q, village.r).map(n => map.get(n.q, n.r)).find(c => c && !isWater(c.terrain));
  const state = createState();

  const first = onStep(world, state, beside);
  ok(first.moments.some(m => m.kind === 'village' && m.xp === VILLAGE_XP), 'no arrival');
  const second = onStep(world, state, beside);
  ok(!second.moments.some(m => m.kind === 'village'), 'arrived twice');
});

test('walking the roads adds up to an achievement, and pacing does not', () => {
  const map = worlds[0];
  const world = worldOf(map);
  const roads = [...map].filter(c => c.terrain === 'path');
  ok(roads.length >= 15, 'need some road');
  const state = createState();

  for (let i = 0; i < 40; i++) onStep(world, state, roads[0]);
  ok(!state.mind.done.roads_15, 'pacing one tile earned the road achievement');
  for (const r of roads.slice(0, 15)) onStep(world, state, r);
  ok(state.mind.done.roads_15, 'fifteen road tiles should earn it');
});

test('the spawn counts as home, so starting out is not already far away', () => {
  for (const map of worlds) {
    const state = createState();
    onStep(worldOf(map), state, map.spawn);
    eq(state.mind.farthest, 0, `${map.seed}: the spawn is ${state.mind.farthest} from home`);
  }
});

test('getting far from everyone is remembered and rewarded', () => {
  const map = worlds[2];
  const world = worldOf(map);
  const civ = [map.spawn, ...[...map].filter(c => c.terrain === 'path' || c.feature?.type === 'village')];
  const far = [...map].filter(c => !isWater(c.terrain))
    .map(c => ({ c, d: Math.min(...civ.map(v => distance(v.q, v.r, c.q, c.r))) }))
    .sort((a, b) => b.d - a.d)[0];
  ok(far.d >= 10, `the furthest point is only ${far.d} out`);
  const state = createState();
  onStep(world, state, far.c);
  eq(state.mind.farthest, far.d, 'farthest not recorded');
  ok(state.mind.done.far_6 && state.mind.done.far_10, 'distance milestones not awarded');
});

test('standing on the summit is an achievement', () => {
  const map = worlds[0];
  const state = createState();
  const r = onStep(worldOf(map), state, factsOf(map).summit);
  ok(r.moments.some(m => m.title === 'Roof of the World'), 'no summit achievement');
});

test('every achievement has a name, some xp, and a unique id', () => {
  const ids = new Set();
  for (const a of ACHIEVEMENTS) {
    ok(a.name && a.xp > 0 && typeof a.test === 'function', `${a.id} is incomplete`);
    ok(!ids.has(a.id), `duplicate ${a.id}`);
    ids.add(a.id);
  }
});

test('making Mind goods and buildings earns no Mind xp', () => {
  for (const r of Object.values(RECIPES)) {
    if (r.skill === 'mind') eq(r.xp, 0, `${r.id} still pays Mind xp`);
  }
});

test('an old save without exploring state is filled in', () => {
  const state = createState();
  delete state.mind;
  ensureMind(state);
  eq(Object.keys(state.mind.explored).length, 0, 'explored');
  eq(state.mind.farthest, 0, 'farthest');
  const kept = createState();
  kept.mind.explored['1,1'] = 2;
  ensureMind(kept);
  eq(kept.mind.explored['1,1'], 2, 'ensureMind lost what was already there');
});

run('mind');
