// shared_world.test.mjs — the world sims see more than one player: raiders and
// wild dogs pick the nearest, damage is reported per player, unit ids come from
// a shared counter, structures have owners, and the raid sets out inside a window.

import { test, eq, ok, run } from './_harness.mjs';
import { WorldMap } from '../src/world/mapformat.js';
import { createState, hasBuilt, recordBuilt, moonOf, TURNS_PER_DAY, MOON_DAYS } from '../src/game/state.js';
import { makeUnit, updateUnits, tickSchedule, ensureRaidState, RAID_WINDOW, rally } from '../src/game/raiders.js';
import { stepWildDogs } from '../src/game/wild_dogs.js';
import { SHARED_KEYS, sharedSlice, applyShared, ownerOf, goalOwner, worldClock } from '../src/game/shared.js';
import { checkJourney } from '../src/game/journey.js';

function flat(w = 20, d = 20) {
  const map = new WorldMap({ seed: 'shared' });
  for (let q = 0; q < w; q++) for (let r = 0; r < d; r++) map.place(q, r, 'grass', 1);
  map.spawn = { q: 2, r: 2 };
  return { map, seed: 'shared' };
}

test('raiders go for the nearest player and report damage per player', () => {
  const world = flat();
  const state = createState();
  state.units = [makeUnit('raider', 'raider', { q: 10, r: 10 }, { mode: 'raid', target: null }, state)];
  state.units[0].cd = 0;
  const players = [
    { id: 'far', q: 1, r: 1, defense: 1, onWater: false, down: false },
    { id: 'near', q: 10, r: 11, defense: 1, onWater: false, down: false },
  ];
  const hurt = [];
  const events = [];
  for (let i = 0; i < 40; i++) {
    updateUnits({ world, state, players, events, hurt: (id, dmg) => hurt.push({ id, dmg }), clock: 0 }, 0.1);
  }
  ok(hurt.length > 0, 'the raider strikes');
  ok(hurt.every(h => h.id === 'near'), 'only the nearest player is struck');
  ok(events.some(e => e.type === 'clash' && e.playerId === 'near'), 'clash events say who was hit');
  eq(state.hp, createState().hp, 'damage to others never touches this browser\'s own hp');
});

test('a downed or boating player is left alone', () => {
  const world = flat();
  const state = createState();
  state.units = [makeUnit('raider', 'raider', { q: 10, r: 10 }, { mode: 'raid' }, state)];
  state.units[0].cd = 0;
  const hurt = [];
  const players = [{ id: 'down', q: 10, r: 11, defense: 1, onWater: false, down: true }];
  for (let i = 0; i < 20; i++) updateUnits({ world, state, players, events: [], hurt: id => hurt.push(id), clock: 0 }, 0.1);
  eq(hurt.length, 0);
});

test('unit ids come from the shared counter, and militia follow whoever raised them', () => {
  const world = flat();
  const state = createState();
  const a = makeUnit('raider', 'raider', { q: 1, r: 1 }, {}, state);
  const b = makeUnit('raider', 'raider', { q: 1, r: 2 }, {}, state);
  eq(b.id, a.id + 1);
  eq(state.unitSeq, b.id);
  // A guest's copy picks up where the host's counter is, never reusing an id.
  const guest = createState();
  applyShared(guest, sharedSlice(state));
  eq(makeUnit('brute', 'raider', { q: 2, r: 2 }, {}, guest).id, b.id + 1);

  state.units = [];
  ok(rally(state, { q: 5, r: 5 }, world.map, 2, 'mira') === 2);
  ok(state.units.every(u => u.owner === 'mira'));
});

test('wild dogs hunt the sleeper they ambushed, and bites are reported per player', () => {
  const world = flat();
  const state = createState();
  state.wildDogsSeeded = true;
  state.wildDogs = [{ id: 1, q: 5, r: 5, hp: 3, hostile: true, region: 'ambush', prey: 'mira', facing: 1 }];
  const players = [
    { id: 'asher', q: 5, r: 6, defense: 1 },
    { id: 'mira', q: 9, r: 9, defense: 1 },
  ];
  const bites = [];
  state.turn = 2; // daytime, so the ambush dog is not sent home at dawn
  for (let i = 0; i < 6; i++) {
    stepWildDogs(world, state, players[0], () => 0.01, [], { players, hurt: id => bites.push(id) });
  }
  ok(bites.length > 0, 'the dog bites');
  ok(bites.every(id => id === 'mira'), 'it goes after its prey, not the nearer player');
});

test('the raid sets out at a random turn within its window after dusk', () => {
  const world = flat();
  world.map.get(15, 15).feature = { type: 'camp', name: 'Ashfire' };
  world.map.get(3, 3).feature = { type: 'village', name: 'Oakhaven', kind: 'farmers' };
  const seen = new Set();
  for (let i = 0; i < 60; i++) {
    const state = createState();
    state.units = [];
    ensureRaidState(state);
    const m = moonOf({ turn: (MOON_DAYS - 1) * TURNS_PER_DAY + 6 });
    tickSchedule(world, state, [], m.omensAt);
    eq(state.raid.stage, 'omen');
    const off = state.raid.startAt - m.duskAt;
    ok(off >= 0 && off <= RAID_WINDOW, `start ${off} turns after dusk is inside the window`);
    seen.add(off);
    // Dusk comes, but no wave leaves before the start turn.
    const events = [];
    tickSchedule(world, state, events, m.duskAt);
    eq(state.raid.stage, 'night');
    if (off > 0) ok(!events.some(e => e.type === 'raid'), 'no wave before its turn');
    tickSchedule(world, state, events, state.raid.startAt);
    ok(events.some(e => e.type === 'raid'), 'the first wave leaves at the start turn');
  }
  ok(seen.size > 1, 'the start turn varies');
});

test('structures have owners; Competitive goals count only your own', () => {
  const state = createState();
  eq(ownerOf(state), 'local');
  recordBuilt(state, 'hearth', 1, 1);
  eq(state.built[0].owner, 'local');

  const rival = createState();
  rival.room = { playerId: 'mira', mode: 'competitive' };
  rival.built = state.built; // one shared registry
  ok(hasBuilt(rival, 'hearth'), 'the hearth exists in the world');
  ok(!hasBuilt(rival, 'hearth', goalOwner(rival)), "but it isn't Mira's in Competitive");
  eq(checkJourney(rival, { map: flat().map }).goals.some(g => g.id === 'hearth'), false);

  const friend = createState();
  friend.room = { playerId: 'mira', mode: 'coop' };
  friend.built = state.built;
  ok(hasBuilt(friend, 'hearth', goalOwner(friend)), 'in Co-op anyone\'s hearth counts');
});

test('the shared slice is copied, never aliased, and the world clock falls back to your turn', () => {
  const state = createState();
  state.turn = 7;
  eq(worldClock(state), 7);
  state.clock = 9;
  eq(worldClock(state), 9);
  state.built = [{ item: 'hut', q: 1, r: 1, owner: 'local' }];
  const slice = sharedSlice(state);
  ok(SHARED_KEYS.includes('built') && SHARED_KEYS.includes('taken'));
  slice.built.push({ item: 'field', q: 2, r: 2 });
  eq(state.built.length, 1, 'changing a slice does not change the state');
  ok(!('inventory' in slice) && !('skills' in slice), 'personal things stay out');
});

run('shared_world');
