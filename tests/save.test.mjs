// save.test.mjs — a save has to bring back the world you left, not the world the
// seed would generate. By the time you save, they are different worlds.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test, run, eq, ok } from './_harness.mjs';
import { serialize, deserialize, SAVE_VERSION } from '../src/game/save.js';
import { generateWorld } from '../src/world/worldgen.js';
import { makeResolvers, isWater } from '../src/world/tileset.js';
import { createState, recordBuilt, hasBuilt } from '../src/game/state.js';
import { addItem, countItem } from '../src/game/inventory.js';
import { addXp, levelOf } from '../src/game/skills.js';
import { ensureVillage, stockOf } from '../src/game/economy.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const index = JSON.parse(readFileSync(join(root, 'new_tiles', 'index.json'), 'utf8'));
const resolvers = makeResolvers(index);

/** A world that has been played in: felled, mined, built on, and banked. */
function playedIn() {
  const map = generateWorld({ seed: 'saved', radius: 14, resolvers });
  const world = { map, resolvers, seed: 'saved' };
  const state = createState({ gold: 77 });

  addItem(state, 'stone', 12);
  addItem(state, 'cooked_meat', 3);
  addXp(state, 'woodworking', 250);

  // Fell a wood, empty a vein, reveal another, and put up a hearth.
  const wood = [...map].find(c => c.terrain === 'oak_wood');
  if (wood) map.place(wood.q, wood.r, 'forest_floor', wood.h);
  const vein = [...map].find(c => c.feature?.type === 'ore');
  if (vein) vein.feature.known = true;

  const site = [...map].find(c => !isWater(c.terrain) && !c.feature);
  site.feature = { type: 'structure', item: 'hearth', name: 'Hearth' };
  recordBuilt(state, 'hearth', site.q, site.r);

  const village = [...map].find(c => c.feature?.type === 'village');
  if (village) ensureVillage(state, village.feature, village.q, village.r, 'saved');

  return { world, state, player: { q: site.q, r: site.r }, site, vein, wood, village };
}

test('a save round-trips the world, not the seed', () => {
  const { world, state, player, site, wood } = playedIn();
  const data = JSON.parse(JSON.stringify(serialize(world, state, player)));
  const back = deserialize(data);

  eq(back.seed, 'saved', 'seed');
  eq(back.map.size, world.map.size, 'column count');
  eq(back.player, player, 'where you were standing');

  // The felled wood must come back felled, not regrown by regeneration.
  if (wood) eq(back.map.terrainAt(wood.q, wood.r), 'forest_floor', 'the wood grew back');
  eq(back.map.get(site.q, site.r).feature.item, 'hearth', 'the hearth vanished');

  const fresh = generateWorld({ seed: 'saved', radius: 14, resolvers });
  if (wood) {
    ok(fresh.terrainAt(wood.q, wood.r) !== back.map.terrainAt(wood.q, wood.r),
      'this test proves nothing unless the regenerated world differs');
  }
});

test('every column comes back exactly as it was', () => {
  const { world, state, player } = playedIn();
  const back = deserialize(JSON.parse(JSON.stringify(serialize(world, state, player))));
  for (const col of world.map) {
    const other = back.map.get(col.q, col.r);
    ok(other, `column ${col.q},${col.r} is missing`);
    eq({ h: other.h, terrain: other.terrain, sprite: other.sprite, frame: other.frame },
      { h: col.h, terrain: col.terrain, sprite: col.sprite, frame: col.frame },
      `column ${col.q},${col.r} changed`);
    eq(other.feature ?? null, col.feature ?? null, `feature at ${col.q},${col.r} changed`);
  }
});

test('the player comes back with what they had', () => {
  const { world, state, player } = playedIn();
  const back = deserialize(JSON.parse(JSON.stringify(serialize(world, state, player))));

  eq(back.state.gold, 77, 'gold');
  eq(countItem(back.state, 'stone'), 12, 'stone');
  eq(back.state.energy, state.energy, 'energy');
  eq(levelOf(back.state, 'woodworking'), levelOf(state, 'woodworking'), 'woodworking level');
  ok(hasBuilt(back.state, 'hearth'), 'the world forgot the hearth was built');
});

test('a village keeps the prices it quoted you', () => {
  const { world, state, player, village } = playedIn();
  if (!village) return;                     // a world can generate without one
  const before = stockOf(state, village.q, village.r);
  const back = deserialize(JSON.parse(JSON.stringify(serialize(world, state, player))));
  eq(stockOf(back.state, village.q, village.r), before, 'prices changed across a save');
});

test('a revealed ore vein stays revealed', () => {
  const { world, state, player, vein } = playedIn();
  if (!vein) return;
  const back = deserialize(JSON.parse(JSON.stringify(serialize(world, state, player))));
  eq(back.map.get(vein.q, vein.r).feature.known, true, 'Lore was forgotten');
});

test('saves carry the editor tile list only when the editor needs it', () => {
  const { world, state, player } = playedIn();
  const data = serialize(world, state, player);
  eq(data.map.tiles, undefined, 'a save should not duplicate every column as tiles');
  ok(world.map.toJSON().tiles.length > 0, 'but toJSON should still emit them for the editor');
});

test('a save from another version is refused rather than half-read', () => {
  const { world, state, player } = playedIn();
  const data = serialize(world, state, player);
  eq(data.version, SAVE_VERSION, 'version stamped');

  let threw = false;
  try { deserialize({ ...data, version: SAVE_VERSION + 1 }); } catch { threw = true; }
  ok(threw, 'a future save was read anyway');

  threw = false;
  try { deserialize(null); } catch { threw = true; }
  ok(threw, 'nothing at all was read as a save');
});

run('save');
