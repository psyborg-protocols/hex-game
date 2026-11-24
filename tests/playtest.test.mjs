// playtest.test.mjs — the editor's test pieces, and the game a play test starts from.

import { test, eq, ok, run } from './_harness.mjs';
import { WorldMap } from '../src/world/mapformat.js';
import { moonOf } from '../src/game/state.js';
import { PIECES, placePiece, removePiece, emptyPieces, buildPlaytest, playtestData } from '../src/game/playtest.js';

function patch() {
  const map = new WorldMap({ name: 'test' });
  for (let q = 0; q < 10; q++) for (let r = 0; r < 8; r++) map.place(q, r, 'grass', 1);
  map.place(9, 7, 'water', 0);
  return map;
}

test('every piece has a name and a group', () => {
  for (const p of PIECES) ok(p.id && p.name && p.group, `piece ${p.id}`);
  eq(new Set(PIECES.map(p => p.id)).size, PIECES.length, 'ids are unique');
});

test('pieces go down where you click, one per hex, and come away again', () => {
  const map = patch();
  const pieces = emptyPieces();
  ok(placePiece(map, pieces, 'player', 4, 4));
  eq(map.spawn, { q: 4, r: 4 }, 'the Wanderer starts there');
  ok(placePiece(map, pieces, 'raider', 2, 2));
  ok(placePiece(map, pieces, 'brute', 2, 2));
  eq(pieces.units, [{ kind: 'brute', q: 2, r: 2 }], 'a second unit on a hex replaces the first');
  ok(placePiece(map, pieces, 'hut', 5, 5));
  eq(map.get(5, 5).feature.item, 'hut');
  ok(map.get(5, 5).feature.maxHp > 0, 'with hit points, like a built one');
  ok(placePiece(map, pieces, 'village', 1, 1));
  ok(placePiece(map, pieces, 'village', 3, 1));
  ok(map.get(1, 1).feature.kind !== map.get(3, 1).feature.kind, 'each village a different trade');
  ok(!placePiece(map, pieces, 'raider', 9, 7), 'nobody stands in the water');
  ok(placePiece(map, pieces, 'remove', 2, 2));
  eq(pieces.units.length, 0, 'the remove brush takes the brute');
  ok(removePiece(map, pieces, 5, 5));
  ok(!map.get(5, 5).feature, 'and right-click takes the hut');
  ok(removePiece(map, pieces, 1, 1));
  eq(map.get(1, 1).terrain, 'grass', 'a village leaves plain ground');
});

test('a play test starts on the map, with everything where it was put', () => {
  const map = patch();
  const pieces = emptyPieces();
  for (const [id, q, r] of [
    ['player', 4, 4], ['hut', 5, 4], ['field', 5, 5], ['raider', 2, 2], ['raiding', 1, 6], ['militia', 4, 5],
    ['wild_dog', 7, 2], ['wild_dog_hostile', 7, 3], ['loot', 3, 4], ['camp', 9, 1],
  ]) ok(placePiece(map, pieces, id, q, r), id);
  // Through JSON, as the editor hands it over.
  const data = JSON.parse(JSON.stringify(playtestData(map, pieces, { start: 'raid', gold: 50, free: true })));
  const game = buildPlaytest(data);
  eq(game.player, { q: 4, r: 4 });
  eq(game.state.gold, 50);
  ok(game.state.free);
  eq(game.state.turn, moonOf({ turn: 0 }).duskAt, 'raid night starts at the raid\'s dusk');
  eq(game.state.built.map(b => b.item).sort(), ['field', 'hut'], 'what stands on the map is yours');
  const guard = game.state.units.find(u => u.q === 2 && u.r === 2);
  eq(guard.mode, 'guard', 'a placed raider stands guard');
  const raiding = game.state.units.find(u => u.q === 1 && u.r === 6);
  eq(raiding.mode, 'raid');
  ok(game.state.built.some(b => b.q === raiding.target.q && b.r === raiding.target.r), 'going for something you built');
  eq(raiding.home, { q: 9, r: 1 }, 'home to the camp');
  ok(game.state.units.some(u => u.kind === 'militia' && u.faction === 'ally'));
  ok(game.state.units.filter(u => u.home?.q === 9 && u.home?.r === 1 && u.mode === 'guard').length >= 3, 'the camp has its guards');
  eq(game.state.wildDogs.length, 2, 'only the dogs you put down');
  ok(game.state.wildDogsSeeded, 'none scattered at random');
  ok(game.state.wildDogs.some(d => d.hostile));
  eq(game.state.drops.length, 1);
  eq(new Set(game.state.units.map(u => u.id)).size, game.state.units.length, 'unit ids are unique');
});

run('playtest');
