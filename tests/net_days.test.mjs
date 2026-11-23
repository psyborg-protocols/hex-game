// net_days.test.mjs — days together: the world clock follows the leader, the
// raid keeps the average pace of a random few, and nobody starts a new day
// until everyone has finished the last one.

import { test, eq, ok, run } from './_harness.mjs';
import { WorldMap } from '../src/world/mapformat.js';
import { createState, TURNS_PER_DAY } from '../src/game/state.js';
import { Multiplayer, RemotePlayer, pickPace, paceClock, phaseLabel, myPlayerId } from '../src/net/multiplayer.js';

/** A host's controller with a stand-in session, and remote players at given turns. */
function hostRoom(remoteTurns = {}) {
  const map = new WorldMap({ seed: 'days' });
  for (let q = 0; q < 6; q++) for (let r = 0; r < 6; r++) map.place(q, r, 'grass', 1);
  const state = createState();
  state.room = { playerId: myPlayerId(), mode: 'coop', host: true };
  const sent = [];
  const worldTurns = [];
  const hurtMe = [];
  let dawns = 0;
  const mp = new Multiplayer({
    world: { map }, state, player: { q: 1, r: 1, onWater: false }, ui: { anchors: [] },
    defense: () => 1,
    runWorldTurn: pos => worldTurns.push(pos),
    hurtMe: d => hurtMe.push(d),
    onDawn: () => { dawns += 1; },
  });
  const roster = [{ id: myPlayerId(), name: 'Asher', color: 'crimson' }];
  mp.session = { role: 'host', mode: 'coop', get roster() { return roster; }, send: (id, m) => sent.push({ id, m }), broadcast() {} };
  for (const [id, turn] of Object.entries(remoteTurns)) {
    const card = { id, name: id, color: 'ocean' };
    roster.push(card);
    const r = new RemotePlayer(map, card);
    r.turn = turn;
    r.q = 3; r.r = 3;
    mp.remotes.set(id, r);
  }
  return { mp, state, sent, worldTurns, hurtMe, get dawns() { return dawns; } };
}

test('phase labels read as the HUD shows them', () => {
  eq(phaseLabel(0), 'Day 1/12');
  eq(phaseLabel(11), 'Day 12/12');
  eq(phaseLabel(12), 'Night 1/12');
  eq(phaseLabel(TURNS_PER_DAY + 15), 'Night 4/12');
});

test('the raid keeps pace with a random number of players, chosen at random', () => {
  const ids = ['a', 'b', 'c', 'd'];
  const sizes = new Set();
  for (let i = 0; i < 200; i++) {
    const pace = pickPace(ids);
    ok(pace.length >= 1 && pace.length <= 4, 'between one and all of them');
    ok(new Set(pace).size === pace.length && pace.every(id => ids.includes(id)), 'distinct players from the room');
    sizes.add(pace.length);
  }
  eq(sizes.size, 4, 'every group size turns up');
  const clocks = [{ id: 'a', turn: 10 }, { id: 'b', turn: 14 }, { id: 'c', turn: 30 }];
  eq(paceClock(['a', 'b'], clocks), 12, 'the average of the chosen players');
  eq(paceClock(['c'], clocks), 30);
});

test("the raid clock is rolled once a moon, and re-rolled when one of its players leaves", () => {
  const room = hostRoom({ mira: 20, ben: 10 });
  room.state.turn = 30;
  room.state.raid = { moon: 1, stage: 'idle' };
  const first = room.mp.raidClock(() => 0.99); // all three
  eq(room.state.raid.pace.length, 3);
  eq(first, 20, '(30 + 20 + 10) / 3');
  eq(room.mp.raidClock(() => 0), first, 'the same pick holds while everyone stays');

  room.mp.remotes.delete('ben');
  const again = room.mp.raidClock(() => 0); // re-roll: one player
  ok(!room.state.raid.pace.includes('ben'), 'the pick is made again without Ben');
  eq(room.state.raid.pace.length, 1);
  ok([30, 20].includes(again));
});

test('the world clock follows whoever is furthest ahead, one world turn at a time', () => {
  const room = hostRoom({ mira: 7 });
  room.state.turn = 4;
  room.state.clock = 4;
  room.mp.advanceClock();
  eq(room.state.clock, 7);
  eq(room.worldTurns.length, 3, 'three world turns, near Mira who leads');
  ok(room.worldTurns.every(p => p.q === 3 && p.r === 3));
  room.mp.advanceClock();
  eq(room.worldTurns.length, 3, 'nothing more until someone moves on');
});

test('a finished day waits for everyone; whoever leaves stops holding it up', () => {
  const room = hostRoom({ mira: 30, ben: 31 });
  room.state.turn = TURNS_PER_DAY * 2; // slept to the second dawn
  room.mp.beginWait();
  ok(room.mp.waiting, 'waiting for the others');
  eq(room.mp.stragglers().map(r => r.id).sort(), ['ben', 'mira']);
  eq(room.dawns, 0);

  room.mp.remotes.get('mira').turn = TURNS_PER_DAY * 2; // Mira sleeps too
  room.mp.checkDawn();
  ok(room.mp.waiting, 'still waiting for Ben');

  room.mp.remotes.delete('ben'); // Ben's connection drops
  room.mp.checkDawn();
  ok(!room.mp.waiting, 'nobody left to wait for');
  eq(room.dawns, 1, 'the new day starts once');
});

test('woken in the dark (a wild dog), the night goes on: no waiting', () => {
  const room = hostRoom({ mira: TURNS_PER_DAY });
  room.state.turn = 15;
  room.mp.beginWait();
  ok(!room.mp.waiting, 'not dawn, so not done');
  eq(room.dawns, 0);
});

test("the host's raiders and dogs hurt the player they hit, wherever they are", () => {
  const room = hostRoom({ mira: 0 });
  room.mp.hurt('mira', 2, { kind: 'raider' }, { attack: [5], defense: [1], damage: 2 });
  eq(room.sent.length, 1);
  eq(room.sent[0].id, 'mira');
  eq(room.sent[0].m.t, 'hurt');
  eq(room.sent[0].m.damage, 2);
  eq(room.sent[0].m.source, 'raider');
  room.mp.hurt(myPlayerId(), 3);
  eq(room.hurtMe, [3], "the host's own wounds come off here");
  const players = room.mp.players();
  eq(players.length, 2);
  ok(players.some(p => p.id === 'mira' && p.q === 3));
});

run('net_days');
