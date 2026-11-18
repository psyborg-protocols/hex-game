// dog.test.mjs — companion dog following, 1-hex wandering, sitting/pacing guard, and combat.

import { test, eq, ok, run } from './_harness.mjs';
import { generateWorld } from '../src/world/worldgen.js';
import { findPath } from '../src/world/pathfinding.js';
import { distance, neighbors } from '../src/world/hexgrid.js';
import { isWater } from '../src/world/tileset.js';
import { createState } from '../src/game/state.js';
import { addItem } from '../src/game/inventory.js';
import { Player } from '../src/game/player.js';
import { makeUnit } from '../src/game/raiders.js';
import {
  ensureDog, updateDog, commandDogGuard, commandDogFollow, DOG_AGGRO,
} from '../src/game/dog.js';

function setup(seed = 'alpha') {
  const map = generateWorld({ seed });
  const world = { map, seed };
  const state = createState();
  const player = new Player(map, map.spawn);
  return { map, world, state, player };
}

function stepSim(world, state, player, seconds, dt = 0.05) {
  const events = [];
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) {
    state.time += dt;
    player.update(dt);
    updateDog({ world, state, player, events }, dt);
  }
  return events;
}

test('no dog item means no dog on the map; adding one spawns it at the player', () => {
  const { map, world, state, player } = setup();
  eq(ensureDog(map, state, player), null);
  updateDog({ world, state, player, events: [] }, 0.05);
  eq(state.dog, null);

  addItem(state, 'dog', 1);
  const d = ensureDog(map, state, player);
  ok(d, 'dog should be created once carried');
  eq(d.q, player.q);
  eq(d.r, player.r);
  eq(d.mode, 'follow');
});

test('dog follows the player when moving and catches up to within 1 hex', () => {
  const { map, world, state, player } = setup();
  addItem(state, 'dog', 1);
  ensureDog(map, state, player);

  // Pick a walkable hex 4-6 hexes away from spawn
  let dest = null;
  for (const col of map) {
    if (isWater(col.terrain)) continue;
    const dist = distance(col.q, col.r, player.q, player.r);
    if (dist >= 4 && dist <= 6 && findPath(map, player, col)) {
      dest = col;
      break;
    }
  }
  ok(dest, 'found walkable destination');
  const route = findPath(map, player, dest);
  player.follow(route);

  stepSim(world, state, player, Math.ceil(route.length / 2) + 2);
  eq(player.q, dest.q);
  eq(player.r, dest.r);
  ok(distance(state.dog.q, state.dog.r, player.q, player.r) <= 1,
    `dog should catch up within 1 hex (got ${distance(state.dog.q, state.dog.r, player.q, player.r)})`);
});

test('when stopped, the dog wanders step-by-step within 1 hex of the player without leaping across', () => {
  const { map, world, state, player } = setup();
  addItem(state, 'dog', 1);
  ensureDog(map, state, player);

  const visited = new Set();
  let prev = { q: state.dog.q, r: state.dog.r };
  for (let i = 0; i < 240; i++) {
    state.time += 0.1;
    updateDog({ world, state, player, events: [] }, 0.1);
    const stepDist = distance(prev.q, prev.r, state.dog.q, state.dog.r);
    ok(stepDist <= 1, `dog leaped ${stepDist} hexes in one tick`);
    prev = { q: state.dog.q, r: state.dog.r };
    visited.add(`${state.dog.q},${state.dog.r}`);
    ok(distance(state.dog.q, state.dog.r, player.q, player.r) <= 1,
      `dog wandered too far: ${distance(state.dog.q, state.dog.r, player.q, player.r)}`);
  }
  ok(visited.size >= 2, `dog should wander around when stopped (visited ${visited.size} hexes)`);
});

test('following dog fights alongside you when a raider comes near', () => {
  const { map, world, state, player } = setup();
  addItem(state, 'dog', 1);
  ensureDog(map, state, player);
  eq(state.dog.mode, 'follow');

  let foeHex = null;
  for (const col of map) {
    if (isWater(col.terrain)) continue;
    const d = distance(col.q, col.r, player.q, player.r);
    if (d === 2 && findPath(map, player, col)) {
      foeHex = col;
      break;
    }
  }
  ok(foeHex, 'found reachable hex 2 away for raider');

  const raider = makeUnit('raider', 'raider', foeHex, { mode: 'raid' });
  state.units = [raider];

  const events = stepSim(world, state, player, 10);
  ok(events.some(e => e.type === 'dogClash'), 'following dog should attack nearby raider');
  ok(raider.hp < raider.maxHp || raider.hp <= 0, 'raider should take damage from following dog');
});

test('commanding guard sends dog to sit, wag tail, and occasionally pace on that hex', () => {
  const { map, world, state, player } = setup();
  addItem(state, 'dog', 1);
  ensureDog(map, state, player);

  const guardHex = neighbors(player.q, player.r)
    .map(n => map.get(n.q, n.r))
    .find(c => c && !isWater(c.terrain) && findPath(map, player, c));
  ok(guardHex, 'found adjacent guard hex');

  const res = commandDogGuard(map, state, player, guardHex);
  ok(res.ok, 'guard command succeeded');
  eq(state.dog.mode, 'guard');

  // Let it arrive and sit
  stepSim(world, state, player, 1.5);
  eq(state.dog.q, guardHex.q);
  eq(state.dog.r, guardHex.r);
  eq(state.dog.stance, 'sit');

  // Over 14 seconds it should both wag its tail and get up to pace at least once
  let sawWag = false;
  let sawPace = false;
  for (let i = 0; i < 140; i++) {
    state.time += 0.1;
    updateDog({ world, state, player, events: [] }, 0.1);
    if (state.dog.stance === 'sit' && state.dog.wag) sawWag = true;
    if (state.dog.stance === 'pace') sawPace = true;
  }
  ok(sawWag, 'guarding dog should occasionally wag its tail while sitting');
  ok(sawPace, 'guarding dog should occasionally get up to pace');
});

test('guarding dog attacks a raider that comes near and returns to its post', () => {
  const { map, world, state, player } = setup();
  addItem(state, 'dog', 1);
  ensureDog(map, state, player);

  const guardHex = { q: player.q, r: player.r };
  ok(commandDogGuard(map, state, player, guardHex).ok);
  stepSim(world, state, player, 0.5);

  // Place a raider within DOG_AGGRO of guardHex
  let foeHex = null;
  for (const col of map) {
    if (isWater(col.terrain)) continue;
    const d = distance(col.q, col.r, guardHex.q, guardHex.r);
    if (d >= 2 && d <= DOG_AGGRO && findPath(map, guardHex, col) && findPath(map, col, guardHex)) {
      foeHex = col;
      break;
    }
  }
  ok(foeHex, 'found reachable hex for raider');

  const raider = makeUnit('raider', 'raider', foeHex, { mode: 'raid' });
  state.units = [raider];

  const events = stepSim(world, state, player, 12);
  ok(events.some(e => e.type === 'dogClash'), 'dog should clash with nearby raider');
  ok(raider.hp < raider.maxHp || raider.hp <= 0, 'raider should take damage from dog');

  // Clear raider and verify dog returns to guardHex
  raider.hp = 0;
  stepSim(world, state, player, 3);
  eq(state.dog.q, guardHex.q);
  eq(state.dog.r, guardHex.r);
  eq(state.dog.stance, 'sit');
});

test('commandDogFollow calls a guarding dog back to follow the player', () => {
  const { map, world, state, player } = setup();
  addItem(state, 'dog', 1);
  ensureDog(map, state, player);

  const guardHex = neighbors(player.q, player.r)
    .map(n => map.get(n.q, n.r))
    .find(c => c && !isWater(c.terrain) && findPath(map, player, c));
  commandDogGuard(map, state, player, guardHex);
  eq(state.dog.mode, 'guard');

  ok(commandDogFollow(state));
  eq(state.dog.mode, 'follow');
  eq(state.dog.guardAt, null);
});

run('dog');
