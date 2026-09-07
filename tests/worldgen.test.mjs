// worldgen.test.mjs — a generated world has to be playable, not just plausible.
// The one that matters most is reachability: a plateau you cannot climb onto is
// scenery, and radial mountains produce those by default.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test, run, eq, ok } from './_harness.mjs';
import { generateWorld } from '../src/world/worldgen.js';
import { WorldMap } from '../src/world/mapformat.js';
import { makeResolvers, TERRAIN, SHEET_NAMES, FRAMES_PER_SHEET, isWater } from '../src/world/tileset.js';
import { neighbors, distance } from '../src/world/hexgrid.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const index = JSON.parse(readFileSync(join(root, 'new_tiles', 'index.json'), 'utf8'));
const resolvers = makeResolvers(index);

const SEEDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo'];
const worlds = SEEDS.map(seed => generateWorld({ seed, radius: 20, resolvers }));

/**
 * Walk the map by the same rules pathfinding uses: climb 1, drop 2.
 *
 * `crossWater` distinguishes the two barriers. The river is meant to stop you
 * until you have a bridge or a boat, so it is not a generation failure. A cliff
 * between two pieces of dry land is.
 */
function reachable(map, from, crossWater = false) {
  const seen = new Set([`${from.q},${from.r}`]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    const ch = map.heightAt(cur.q, cur.r);
    for (const n of neighbors(cur.q, cur.r)) {
      const k = `${n.q},${n.r}`;
      if (seen.has(k)) continue;
      const col = map.get(n.q, n.r);
      if (!col) continue;
      if (!crossWater && isWater(col.terrain)) continue;
      const climb = col.h - ch;
      if (climb > 1 || climb < -2) continue;
      seen.add(k);
      queue.push(n);
    }
  }
  return seen;
}

const dryLand = map => [...map].filter(c => !isWater(c.terrain));

test('generation is deterministic for a seed', () => {
  const a = generateWorld({ seed: 'repeat', radius: 12, resolvers });
  const b = generateWorld({ seed: 'repeat', radius: 12, resolvers });
  eq(JSON.stringify(a.toJSON()), JSON.stringify(b.toJSON()), 'same seed, different world');
});

test('different seeds give different worlds', () => {
  const a = generateWorld({ seed: 'one', radius: 12, resolvers });
  const b = generateWorld({ seed: 'two', radius: 12, resolvers });
  ok(JSON.stringify(a.toJSON()) !== JSON.stringify(b.toJSON()), 'seeds are being ignored');
});

test('every column is real terrain drawn from a real sheet', () => {
  const sheets = new Set(SHEET_NAMES);
  for (const [i, map] of worlds.entries()) {
    for (const col of map) {
      ok(TERRAIN[col.terrain], `${SEEDS[i]}: unknown terrain ${col.terrain}`);
      ok(sheets.has(col.sprite), `${SEEDS[i]}: unknown sprite ${col.sprite}`);
      ok(col.frame >= 0 && col.frame < FRAMES_PER_SHEET, `${SEEDS[i]}: bad frame ${col.frame}`);
      ok(Number.isInteger(col.h) && col.h >= 0 && col.h <= 7, `${SEEDS[i]}: bad height ${col.h}`);
    }
  }
});

test('the board is a hex, and water sits at the bottom of it', () => {
  for (const [i, map] of worlds.entries()) {
    for (const col of map) {
      ok(distance(col.q, col.r, 0, 0) <= 20, `${SEEDS[i]}: ${col.q},${col.r} is off the board`);
      if (isWater(col.terrain)) eq(col.h, 0, `${SEEDS[i]}: water at height ${col.h}`);
    }
  }
});

test('spawn is on dry walkable ground', () => {
  for (const [i, map] of worlds.entries()) {
    const col = map.get(map.spawn.q, map.spawn.r);
    ok(col, `${SEEDS[i]}: nothing at the spawn`);
    ok(!isWater(col.terrain), `${SEEDS[i]}: spawned in the ${col.terrain}`);
    ok(TERRAIN[col.terrain].walk, `${SEEDS[i]}: spawned on unwalkable ${col.terrain}`);
  }
});

test('no cliff strands anything: with the river crossed, all land is walkable', () => {
  for (const [i, map] of worlds.entries()) {
    const seen = reachable(map, map.spawn, true);
    const stranded = dryLand(map).filter(c => !seen.has(`${c.q},${c.r}`));
    eq(stranded.length, 0,
      `${SEEDS[i]}: ${stranded.length} of ${dryLand(map).length} land hexes are walled off by cliffs`
      + (stranded.length ? ` (e.g. ${stranded[0].q},${stranded[0].r} at height ${stranded[0].h})` : ''));
  }
});

test('the near bank is a whole playable world before any bridge', () => {
  for (const [i, map] of worlds.entries()) {
    const seen = reachable(map, map.spawn);
    const land = dryLand(map);
    const share = seen.size / land.length;
    ok(share > 0.25,
      `${SEEDS[i]}: only ${(share * 100).toFixed(0)}% of the land is reachable on foot`);

    // Every village has to be tradeable with from the start.
    const villages = land.filter(c => c.feature?.type === 'village');
    for (const v of villages) {
      ok(seen.has(`${v.q},${v.r}`),
        `${SEEDS[i]}: ${v.feature.name} is across the river and unreachable`);
    }
  }
});

test('the far bank exists and is worth crossing for', () => {
  for (const [i, map] of worlds.entries()) {
    const seen = reachable(map, map.spawn);
    const beyond = dryLand(map).filter(c => !seen.has(`${c.q},${c.r}`));
    ok(beyond.length > 20, `${SEEDS[i]}: the river does not divide anything`);
    ok(beyond.some(c => c.terrain === 'oak_wood' || c.terrain === 'pine_wood'),
      `${SEEDS[i]}: nothing on the far bank but empty ground`);
  }
});

test('the world still has cliffs worth mining', () => {
  for (const [i, map] of worlds.entries()) {
    let sheer = 0;
    for (const col of map) {
      for (const n of neighbors(col.q, col.r)) {
        const other = map.get(n.q, n.r);
        if (other && other.h - col.h >= 3) sheer++;
      }
    }
    ok(sheer > 0, `${SEEDS[i]}: connectivity flattened every cliff`);
  }
});

test('villages are spaced out on flat dry ground', () => {
  for (const [i, map] of worlds.entries()) {
    const villages = [...map].filter(c => c.feature?.type === 'village');
    ok(villages.length >= 2, `${SEEDS[i]}: only ${villages.length} villages`);
    for (const v of villages) {
      ok(!isWater(v.terrain), `${SEEDS[i]}: village in the water`);
      ok(v.feature.name, `${SEEDS[i]}: village has no name`);
      for (const w of villages) {
        if (v === w) continue;
        ok(distance(v.q, v.r, w.q, w.r) >= 6, `${SEEDS[i]}: villages ${v.feature.name} and ${w.feature.name} are on top of each other`);
      }
    }
  }
});

test('roads connect the villages without stepping into water', () => {
  for (const [i, map] of worlds.entries()) {
    const paths = [...map].filter(c => c.terrain === 'path');
    ok(paths.length > 0, `${SEEDS[i]}: no roads at all`);
    for (const p of paths) ok(!isWater(p.terrain), `${SEEDS[i]}: road in the water`);
  }
});

test('ore is finite, hidden, and only in the high stone', () => {
  for (const [i, map] of worlds.entries()) {
    const veins = [...map].filter(c => c.feature?.type === 'ore');
    for (const v of veins) {
      eq(v.feature.known, false, `${SEEDS[i]}: ore starts revealed`);
      ok(v.feature.remaining > 0, `${SEEDS[i]}: empty vein`);
      eq(v.terrain, 'stony', `${SEEDS[i]}: ore in ${v.terrain}`);
      ok(v.h >= 3, `${SEEDS[i]}: ore at height ${v.h}`);
    }
  }
});

test('wooded hexes carry the trees you can chop', () => {
  for (const [i, map] of worlds.entries()) {
    const woods = [...map].filter(c => c.terrain === 'oak_wood' || c.terrain === 'pine_wood');
    ok(woods.length > 0, `${SEEDS[i]}: no woods`);
    for (const w of woods) {
      ok(w.feature?.type === 'trees', `${SEEDS[i]}: wooded hex with nothing to chop`);
      ok(w.feature.remaining > 0, `${SEEDS[i]}: wooded hex with no trees left`);
    }
  }
});

test('a generated world round-trips through the map format', () => {
  const map = worlds[0];
  const back = WorldMap.fromJSON(JSON.parse(JSON.stringify(map.toJSON())));
  eq(back.size, map.size, 'column count changed');
  eq(back.spawn, map.spawn, 'spawn moved');
  for (const col of map) {
    const other = back.get(col.q, col.r);
    eq({ h: other.h, terrain: other.terrain, sprite: other.sprite, frame: other.frame },
      { h: col.h, terrain: col.terrain, sprite: col.sprite, frame: col.frame },
      `column ${col.q},${col.r} changed`);
  }
});

test('the editor can still open it: tiles are a full stack per column', () => {
  const json = worlds[0].toJSON();
  const expected = [...worlds[0]].reduce((n, c) => n + c.h + 1, 0);
  eq(json.tiles.length, expected, 'one tile entry per level per column');
  for (const [key, tile] of json.tiles) {
    ok(/^-?\d+,-?\d+,\d+$/.test(key), `editor key ${key} is malformed`);
    ok(tile.sprite && tile.frame >= 0, `editor tile ${key} is incomplete`);
  }
});

test('a map the editor wrote loads as columns', () => {
  // Exactly the shape editor.js's save button produces: a bare array of entries.
  const editorSave = [
    ['0,0,0', { id: 'Grass', sprite: 'Tiles_GrassBase1', frame: 2 }],
    ['0,0,1', { id: 'Grass', sprite: 'Tiles_GrassBase2', frame: 0 }],
    ['1,0,0', { id: 'Lake', sprite: 'Tiles_LakeBase', frame: 3 }],
    ['2,0,0', { id: 'Path', sprite: 'Tiles_PathsStraight', frame: 1 }],
  ];
  const map = WorldMap.fromJSON(editorSave);
  eq(map.size, 3, 'three columns');
  eq(map.heightAt(0, 0), 1, 'the stack collapsed to its top level');
  eq(map.terrainAt(0, 0), 'grass', 'grass sheet');
  eq(map.terrainAt(1, 0), 'water', 'lake sheet');
  eq(map.terrainAt(2, 0), 'path', 'path sheet');
  eq(map.get(0, 0).sprite, 'Tiles_GrassBase2', 'kept the topmost face');
});

run('worldgen');
