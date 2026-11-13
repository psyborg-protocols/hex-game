// pathfinding.test.mjs — the movement rules are the terrain puzzle, so they are
// worth pinning down precisely: climb 1, drop 2, water only on a bridge, and the
// ladder/bridge exceptions that skill_map.md hangs its redundancy pairs on.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test, run, eq, ok } from './_harness.mjs';
import { findPath, canStep, reachableWithin, MAX_CLIMB, MAX_DROP } from '../src/world/pathfinding.js';
import { WorldMap } from '../src/world/mapformat.js';
import { generateWorld } from '../src/world/worldgen.js';
import { makeResolvers, isWater } from '../src/world/tileset.js';
import { neighbors } from '../src/world/hexgrid.js';
import { bridgeSpan } from '../src/game/actions.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const index = JSON.parse(readFileSync(join(root, 'new_tiles', 'index.json'), 'utf8'));
const resolvers = makeResolvers(index);

/** A flat plain, so a test only has to describe the bits that are not flat. */
function plain(w = 9, d = 9, h = 0, terrain = 'grass') {
  const map = new WorldMap({ seed: 'test' });
  for (let q = 0; q < w; q++) for (let r = 0; r < d; r++) map.place(q, r, terrain, h);
  return map;
}

const at = (q, r) => ({ q, r });

test('a path across flat ground is the straight one', () => {
  const map = plain();
  const path = findPath(map, at(0, 4), at(5, 4));
  ok(path, 'no path across an empty plain');
  eq(path[0], at(0, 4), 'path should start where you are');
  eq(path[path.length - 1], at(5, 4), 'path should end where you clicked');
  eq(path.length, 6, 'five steps, six columns');
});

test('standing still is an empty path, not a null one', () => {
  eq(findPath(plain(), at(3, 3), at(3, 3)), [], 'same tile');
});

test('there is no path to a column that does not exist', () => {
  eq(findPath(plain(), at(0, 0), at(50, 50)), null, 'off the map');
});

test('you can climb one level but not two', () => {
  const map = plain();
  map.place(1, 4, 'grass', MAX_CLIMB);
  ok(canStep(map, at(0, 4), at(1, 4)), 'a one-level step up should be walkable');

  const wall = plain();
  wall.place(1, 4, 'grass', MAX_CLIMB + 1);
  ok(!canStep(wall, at(0, 4), at(1, 4)), 'a two-level face should be a wall');
});

test('you can drop two levels but not three', () => {
  const map = plain(9, 9, MAX_DROP);
  map.place(1, 4, 'grass', 0);
  ok(canStep(map, at(0, 4), at(1, 4)), 'a two-level drop should be walkable');

  const cliff = plain(9, 9, MAX_DROP + 1);
  cliff.place(1, 4, 'grass', 0);
  ok(!canStep(cliff, at(0, 4), at(1, 4)), 'a three-level drop should be a cliff');
});

test('a cliff across the map makes the far side unreachable', () => {
  const map = plain();
  for (let r = 0; r < 9; r++) map.place(4, r, 'stony', 4);
  eq(findPath(map, at(0, 4), at(8, 4)), null, 'walked through a four-high wall');
});

test('a route goes round a wall when there is a way round', () => {
  const map = plain();
  for (let r = 0; r < 8; r++) map.place(4, r, 'stony', 4);   // gap left at r = 8
  const path = findPath(map, at(0, 4), at(8, 4));
  ok(path, 'no way round a wall with a gap in it');
  ok(path.some(s => s.r === 8), 'the route should use the gap');
  for (const s of path) ok(!(s.q === 4 && s.r < 8), 'the route walked through the wall');
});

test('routes prefer the gentle way round over the climb', () => {
  // A staircase straight ahead, flat ground one row over. Both reach the goal;
  // the flat one should win because climbing costs more.
  const map = plain(9, 9, 0);
  map.place(1, 4, 'grass', 1);
  map.place(2, 4, 'grass', 2);
  map.place(3, 4, 'grass', 1);
  const path = findPath(map, at(0, 4), at(4, 4));
  ok(path, 'no path');
  ok(!path.some(s => s.q === 2 && s.r === 4), 'took the staircase over the level ground');
});

test('water is not walkable', () => {
  const map = plain();
  map.place(4, 4, 'water', 0);
  ok(!canStep(map, at(3, 4), at(4, 4)), 'walked into the lake');
  ok(!canStep(map, at(4, 4), at(3, 4)), 'walked out of the lake');
});

test('a river splits the map until a bridge spans it', () => {
  const build = () => {
    const map = plain();
    for (let r = 0; r < 9; r++) map.place(4, r, 'river', 0);
    return map;
  };

  eq(findPath(build(), at(0, 4), at(8, 4)), null, 'forded a river');

  const bridged = build();
  bridged.addStructure({ type: 'bridge', tiles: [at(3, 4), at(4, 4), at(5, 4)] });
  const path = findPath(bridged, at(0, 4), at(8, 4));
  ok(path, 'the bridge did not carry the route');
  ok(path.some(s => s.q === 4 && s.r === 4), 'the route should cross on the bridge');
});

/** Banks two levels up, with a river in a gorge along r = 3..5 of every column. */
function gorge(farBank = 2) {
  const map = plain(7, 9, 2);
  for (let q = 0; q < 7; q++) {
    for (let r = 3; r <= 5; r++) map.place(q, r, 'river', 0);
    for (let r = 6; r < 9; r++) map.place(q, r, 'grass', farBank);
  }
  return map;
}

test('a bridge rests on its lower bank, not on the water', () => {
  const map = gorge();
  const span = bridgeSpan(map, at(3, 2), 'S');
  ok(span, 'no crossing offered over a three-hex gorge');
  eq(span.tiles.length, 3, 'the span is the water between the banks');
  eq(span.h, 2, 'the deck should sit level with the banks');

  map.addStructure({ type: 'bridge', edge: span.edge, h: span.h, tiles: span.tiles.map(t => at(t.q, t.r)) });
  eq(map.heightAt(3, 4), 0, 'the water under the deck is still where it was');
  eq(map.surfaceAt(3, 4), 2, 'you stand on the deck, two levels over the water');
  eq(map.surfaceAt(2, 4), 0, 'the hex beside the bridge is just water');

  const path = findPath(map, at(3, 0), at(3, 8));
  ok(path, 'the bridge did not carry the route across the gorge');
  ok(path.some(s => s.q === 3 && s.r === 4), 'the route should cross on the deck');
});

test('a bridge is not a way up a cliff, or out of the water', () => {
  // The far bank stands five levels over the near one: no deck reaches it.
  eq(bridgeSpan(gorge(7), at(3, 2), 'S'), null, 'a crossing was offered onto a five-level wall');
  // One level of difference is a step, and the deck takes the lower side.
  eq(bridgeSpan(gorge(3), at(3, 2), 'S')?.h, 2, 'a one-level step should still be a crossing');

  // A deck someone did lay against a wall — an old save, a mined bank — still
  // only lets you off where an ordinary step would.
  const map = gorge(7);
  map.addStructure({ type: 'bridge', edge: 3, h: 2, tiles: [at(3, 3), at(3, 4), at(3, 5)] });
  ok(canStep(map, at(3, 2), at(3, 3)), 'you should be able to walk onto the deck from its own bank');
  ok(!canStep(map, at(3, 5), at(3, 6)), 'the deck let you step up a five-level face');
  ok(!canStep(map, at(3, 4), at(2, 4)), 'stepped off the side of the bridge into the river');
});

test('a bridge saved before decks had a height works out its own', () => {
  const map = gorge();
  map.addStructure({ type: 'bridge', edge: 3, tiles: [at(3, 3), at(3, 4), at(3, 5)] });
  eq(map.bridgeAt(3, 4)?.h, 2, 'the deck should have found its banks');
  const back = WorldMap.fromJSON(JSON.parse(JSON.stringify(map.toJSON())));
  eq(back.surfaceAt(3, 4), 2, 'the deck was lost in the save');
});

test('a ladder joins two columns a cliff apart', () => {
  const map = plain();
  for (let r = 0; r < 9; r++) map.place(4, r, 'stony', 5);
  eq(findPath(map, at(3, 4), at(4, 4)), null, 'climbed a five-high face bare-handed');

  map.addStructure({ type: 'ladder', from: at(3, 4), to: at(4, 4) });
  const path = findPath(map, at(3, 4), at(4, 4));
  ok(path, 'the ladder was ignored');
  eq(path.length, 2, 'a ladder is one step');
  ok(canStep(map, at(4, 4), at(3, 4)), 'ladders work downwards too');
});

test('a ladder only joins its own two ends', () => {
  const map = plain();
  for (let r = 0; r < 9; r++) map.place(4, r, 'stony', 5);
  map.addStructure({ type: 'ladder', from: at(3, 4), to: at(4, 4) });
  ok(!canStep(map, at(3, 5), at(4, 5)), 'the ladder was usable from the next hex along');
});

test('reachableWithin stops at the budget', () => {
  const map = plain(21, 21);
  const near = reachableWithin(map, at(10, 10), 2);
  ok(near.has('10,10'), 'the starting hex should be in range');
  for (const [key, d] of near) ok(d <= 2, `${key} is ${d} steps away, past the budget`);
  // A hex three columns out cannot be two steps away.
  ok(!near.has('13,10'), 'the budget leaked');
});

test('a real generated world is navigable end to end', () => {
  const map = generateWorld({ seed: 'navigate', radius: 18, resolvers });
  const land = [...map].filter(c => !isWater(c.terrain));

  // Every village should be walkable to from the spawn — the generator promises it.
  for (const v of land.filter(c => c.feature?.type === 'village')) {
    const path = findPath(map, map.spawn, v);
    ok(path, `no route from spawn to ${v.feature.name}`);
    for (let i = 1; i < path.length; i++) {
      ok(canStep(map, path[i - 1], path[i]),
        `route to ${v.feature.name} takes an illegal step at ${path[i].q},${path[i].r}`);
    }
  }
});

test('every step a route returns is legal and adjacent', () => {
  const map = generateWorld({ seed: 'legality', radius: 16, resolvers });
  const targets = [...map].filter(c => !isWater(c.terrain)).slice(0, 40);
  let found = 0;
  for (const t of targets) {
    const path = findPath(map, map.spawn, t);
    if (!path) continue;
    found++;
    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1];
      ok(neighbors(prev.q, prev.r).some(n => n.q === path[i].q && n.r === path[i].r),
        `step ${i} teleports from ${prev.q},${prev.r} to ${path[i].q},${path[i].r}`);
      ok(canStep(map, prev, path[i]), `step ${i} breaks the movement rules`);
    }
  }
  ok(found > 0, 'no routes were found at all');
});

run('pathfinding');
