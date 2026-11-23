// net_sync.test.mjs — one world in several browsers: column diffs, the built
// set, depletion records, ladders and bridges, and keys only the host may send.

import { test, eq, ok, run } from './_harness.mjs';
import { WorldMap } from '../src/world/mapformat.js';
import { createState, recordBuilt } from '../src/game/state.js';
import { WorldSync } from '../src/net/sync.js';

function world() {
  const map = new WorldMap({ seed: 'sync' });
  for (let q = 0; q < 6; q++) for (let r = 0; r < 6; r++) map.place(q, r, 'grass', 1);
  map.get(2, 2).feature = { type: 'trees', kind: 'oak', remaining: 3 };
  return map;
}

/** Host and a guest, each with their own copy of the same world. */
function pair() {
  const hostMap = world();
  const guestMap = WorldMap.fromJSON(JSON.parse(JSON.stringify(hostMap.toJSON())));
  const hostState = createState();
  const guestState = createState();
  return {
    hostMap, guestMap, hostState, guestState,
    host: new WorldSync({ map: hostMap, state: hostState, isHost: true }),
    guest: new WorldSync({ map: guestMap, state: guestState, isHost: false }),
  };
}

test('nothing changed, nothing sent', () => {
  const { host, guest } = pair();
  eq(host.diff(), null);
  eq(guest.diff(), null);
});

test("a guest fells a tree; the host's world shows it, and it is not sent back", () => {
  const { guestMap, hostMap, guest, host } = pair();
  guestMap.get(2, 2).feature.remaining = 2;
  const patch = guest.diff();
  ok(patch?.cols?.length === 1, 'one column changed');
  host.apply(patch);
  eq(hostMap.get(2, 2).feature.remaining, 2);
  eq(host.diff(), null, 'applying a patch does not make the host send it back');
  eq(guest.diff(), null, 'and the guest does not send it twice');
});

test('a felled-to-floor column is replaced whole', () => {
  const { guestMap, hostMap, guest, host } = pair();
  guestMap.place(2, 2, 'forest_floor', 1);
  host.apply(guest.diff());
  eq(hostMap.get(2, 2).terrain, 'forest_floor');
  eq(hostMap.get(2, 2).feature, undefined);
});

test('two players building at once both keep their structures', () => {
  const { hostState, guestState, host, guest } = pair();
  hostState.room = { playerId: 'asher' };
  guestState.room = { playerId: 'mira' };
  recordBuilt(hostState, 'hearth', 1, 1);
  recordBuilt(guestState, 'hut', 4, 4);
  const fromHost = host.diff();
  const fromGuest = guest.diff();
  host.apply(fromGuest);
  guest.apply(fromHost);
  const items = s => s.built.map(b => `${b.item}:${b.owner}`).sort();
  eq(items(hostState), ['hearth:asher', 'hut:mira']);
  eq(items(guestState), items(hostState), 'both browsers agree');

  // Raiders burn the hut on the host; the guest loses it too.
  hostState.built = hostState.built.filter(b => b.item !== 'hut');
  guest.apply(host.diff());
  eq(items(guestState), ['hearth:asher']);
});

test('depletion records merge key by key, the later wins', () => {
  const { hostState, guestState, host, guest } = pair();
  hostState.picked = { '1,1:berries': 10 };
  guestState.picked = { '3,3:herb': 12 };
  host.apply(guest.diff());
  guest.apply(host.diff());
  const sorted = o => Object.entries(o).sort();
  eq(sorted(hostState.picked), sorted({ '1,1:berries': 10, '3,3:herb': 12 }));
  eq(sorted(guestState.picked), sorted(hostState.picked));
  guestState.taken = { '2,2:stone': 1 };
  host.apply(guest.diff());
  eq(hostState.taken['2,2:stone'], 1);
});

test('ladders and bridges (map structures) travel too', () => {
  const { guestMap, hostMap, guest, host } = pair();
  guestMap.addStructure({ type: 'ladder', q: 1, r: 1, to: { q: 1, r: 2 } });
  host.apply(guest.diff());
  eq(hostMap.structures.length, 1);
  eq(hostMap.structures[0].type, 'ladder');
});

test('only the host speaks for raiders, the raid and the clock', () => {
  const { hostState, guestState, host, guest } = pair();
  hostState.units = [{ id: 7, kind: 'raider', q: 1, r: 1, hp: 4 }];
  hostState.clock = 30;
  const p = host.diff();
  ok(p.host?.units && p.host.clock === 30);
  guest.apply(p);
  eq(guestState.units[0].id, 7);
  eq(guestState.clock, 30);

  // A guest's own copy of host keys is never sent, and a host ignores any it gets.
  guestState.units = [];
  const g = guest.diff();
  ok(!g || !g.host, 'guests do not send host keys');
  host.apply({ host: { units: [] } });
  eq(hostState.units.length, 1, "the host's raiders are not overwritten by a guest");
});

run('net_sync');
