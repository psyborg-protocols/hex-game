// drops.test.mjs — loot on the ground: raiders and players leave what they
// carried where they fell, and whoever clicks the pile picks it up.

import { test, eq, ok, run } from './_harness.mjs';
import { WorldMap } from '../src/world/mapformat.js';
import { createState } from '../src/game/state.js';
import { addItem, countInPack } from '../src/game/inventory.js';
import { clash } from '../src/game/combat.js';
import { spoilsOf } from '../src/game/raiders.js';
import { addDrop, dropAt, pickUp, lootText } from '../src/game/drops.js';
import { LoopbackHub } from '../src/net/transport.js';
import { HostSession, GuestSession } from '../src/net/session.js';
import { Multiplayer, myPlayerId } from '../src/net/multiplayer.js';
import { SHARED_KEYS } from '../src/game/shared.js';
import { HOST_KEYS } from '../src/net/sync.js';

const settle = async (n = 30) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 0)); };

test('a raider\'s spoils are what it drops, and nobody is paid until it is picked up', () => {
  const state = createState();
  const gold = state.gold;
  const loot = spoilsOf({ kind: 'raider', carry: [{ id: 'log', qty: 2 }] }, () => 0);
  eq(state.gold, gold, 'spoilsOf pays no one');
  eq(loot.gold, 2, 'the low end of a raider\'s purse');
  eq(loot.items, [{ id: 'log', qty: 2 }, { id: 'hide', qty: 1 }], 'what it stole, and a hide');
  const lord = spoilsOf({ kind: 'warlord' }, () => 0.99);
  ok(lord.items.some(s => s.id === 'iron_mail'), 'the Warlord drops his mail');
});

test('loot on one hex is one pile; nothing makes no pile', () => {
  const state = createState();
  eq(addDrop(state, 1, 1, {}), null);
  const a = addDrop(state, 1, 1, { gold: 3, items: [{ id: 'log', qty: 1 }] });
  const b = addDrop(state, 1, 1, { gold: 2, items: [{ id: 'log', qty: 2 }, { id: 'hide', qty: 1 }] });
  eq(a, b, 'the same pile');
  eq(state.drops.length, 1);
  eq(a.gold, 5);
  eq(a.items, [{ id: 'log', qty: 3 }, { id: 'hide', qty: 1 }]);
  addDrop(state, 2, 1, { gold: 1 });
  eq(state.drops.length, 2, 'another hex, another pile');
  ok(a.id !== state.drops[1].id, 'piles have their own ids');
  eq(lootText(a), '5 gold, 3 Log, 1 Hide');
});

test('picking up takes the gold and what fits; the rest stays on the ground', () => {
  const state = createState();
  const gold = state.gold;
  const pile = addDrop(state, 0, 0, { gold: 4, items: [{ id: 'hide', qty: 2 }] });
  const res = pickUp(state, pile.id);
  eq(res.gold, 4);
  eq(state.gold, gold + 4);
  eq(countInPack(state, 'hide'), 2);
  eq(dropAt(state, 0, 0), null, 'all of it taken, the pile is gone');

  // A full pack: nothing fits, so it all stays put.
  const full = createState();
  full.inventory = full.inventory.map(() => ({ id: 'stone', qty: 99 }));
  const p2 = addDrop(full, 0, 0, { gold: 1, items: [{ id: 'log', qty: 2 }] });
  const r2 = pickUp(full, p2.id);
  eq(r2.gold, 1, 'gold always fits');
  eq(r2.left, [{ id: 'log', qty: 2 }]);
  eq(dropAt(full, 0, 0).items, [{ id: 'log', qty: 2 }], 'the logs are still there');
  eq(dropAt(full, 0, 0).gold, 0, 'but not the gold');
});

test('loot on the ground is part of the shared world, and the host keeps it', () => {
  ok(SHARED_KEYS.includes('drops'), 'shared');
  ok(HOST_KEYS.includes('drops'), 'host-owned: guests ask, they do not write');
});

function flatMap() {
  const map = new WorldMap({ seed: 'drops' });
  for (let q = 0; q < 6; q++) for (let r = 0; r < 6; r++) map.place(q, r, 'grass', 1);
  return map;
}

async function room() {
  const hub = new LoopbackHub();
  const picked = { host: [], guest: [] };
  const mk = (state, player, who, playerId) => new Multiplayer({
    playerId, world: { map: flatMap() }, state, player, ui: { anchors: [], notify() {}, openPanelName: null },
    defense: () => 1, clash, onPickedUp: res => picked[who].push(res),
  });
  const hostState = createState();
  const guestState = createState();
  hostState.room = { playerId: myPlayerId(), mode: 'coop', host: true };
  guestState.room = { playerId: 'p-mira', mode: 'coop', host: false };
  const host = mk(hostState, { q: 2, r: 2 }, 'host');
  const guest = mk(guestState, { q: 2, r: 3 }, 'guest', 'p-mira');
  host.session = new HostSession({
    peer: hub.peer('room'), mode: 'coop', me: { playerId: myPlayerId(), name: 'Asher', color: 'crimson' }, snapshot: async () => ({}),
  });
  host.wire();
  const gs = new GuestSession({ peer: hub.peer(), hostId: 'room', me: { playerId: 'p-mira', name: 'Mira' } });
  await gs.connect();
  await gs.claim('ocean');
  guest.session = gs;
  guest.wire();
  await settle();
  return { host, guest, hostState, guestState, picked };
}

test('in a room: a guest\'s drop lands in the host\'s world, and the first to ask gets it', async () => {
  const { host, guest, hostState, guestState, picked } = await room();
  guest.drop(3, 3, { gold: 6, items: [{ id: 'hide', qty: 1 }] });
  await settle();
  const pile = dropAt(hostState, 3, 3);
  ok(pile, 'the host has the pile');
  eq(pile.gold, 6);
  eq(guestState.drops?.length || 0, 0, 'a guest does not write piles itself');

  // The guest sees it (the host's world patch), and both reach for it.
  guestState.drops = structuredClone(hostState.drops);
  const before = guestState.gold;
  guest.pickUp(pile.id);
  host.pickUp(pile.id);
  await settle();
  // The host's own pickup ran first, in its own browser: it got the pile.
  eq(picked.host.length, 1);
  ok(picked.host[0] && picked.host[0].gold === 6, 'the host picked it up');
  eq(picked.guest.length, 1);
  eq(picked.guest[0], null, 'Mira was told someone got there first');
  eq(guestState.gold, before, 'and got nothing');
  eq(dropAt(hostState, 3, 3), null, 'the pile is gone');
});

test('in a room: a guest picks up a pile, and what does not fit goes back down', async () => {
  const { guest, hostState, guestState, picked } = await room();
  guestState.inventory = guestState.inventory.map(() => ({ id: 'stone', qty: 99 }));
  guestState.inventory[4] = null; // the first slot of the main pack (0-3 are for food)
  const pile = addDrop(hostState, 1, 4, { gold: 3, items: [{ id: 'log', qty: 1 }, { id: 'hide', qty: 1 }] });
  guestState.drops = structuredClone(hostState.drops);
  const gold = guestState.gold;
  guest.pickUp(pile.id);
  eq(dropAt(guestState, 1, 4), null, 'gone from Mira\'s screen at once');
  await settle(60);
  eq(guestState.gold, gold + 3, 'Mira has the gold');
  eq(countInPack(guestState, 'log'), 1, 'and the log, in her one free slot');
  eq(picked.guest[0].left, [{ id: 'hide', qty: 1 }]);
  const back = dropAt(hostState, 1, 4);
  ok(back, 'the rest went back on the ground');
  eq(back.items, [{ id: 'hide', qty: 1 }]);
  eq(back.gold, 0);
});

run('drops');
