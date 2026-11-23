// net_trade.test.mjs — players trading face to face, and fighting.
//
// Two real rooms' worth of controllers over the loopback transport: offers,
// acceptance taken back by any change, a swap only when both can go through,
// and the host rolling the dice when rivals fight.

import { test, eq, ok, run } from './_harness.mjs';
import { WorldMap } from '../src/world/mapformat.js';
import { createState } from '../src/game/state.js';
import { addItem, countInPack } from '../src/game/inventory.js';
import { clash } from '../src/game/combat.js';
import { LoopbackHub } from '../src/net/transport.js';
import { HostSession, GuestSession } from '../src/net/session.js';
import { Multiplayer, myPlayerId } from '../src/net/multiplayer.js';
import { PlayerTrade, TradeReferee } from '../src/net/trade.js';

const settle = async (n = 30) => { for (let i = 0; i < n; i++) await new Promise(r => setTimeout(r, 0)); };

function flatMap() {
  const map = new WorldMap({ seed: 'trade' });
  for (let q = 0; q < 6; q++) for (let r = 0; r < 6; r++) map.place(q, r, 'grass', 1);
  return map;
}

/** A host (this process's own id) and a guest 'p-mira', standing side by side. */
async function room(mode = 'coop') {
  const hub = new LoopbackHub();
  const log = { host: [], guest: [] };
  const mk = (state, player, who, playerId) => new Multiplayer({
    playerId, world: { map: flatMap() }, state, player, ui: { anchors: [], notify() {}, openPanelName: null },
    defense: () => 1, clash,
    hurtMe: (d, roll, source, by) => { state.hp -= d; log[who].push({ hurt: d, by }); },
    onPvpHit: m => log[who].push({ pvpHit: m.target }),
    onTradeChanged: () => {}, onTradeDone: (tr, got) => log[who].push({ done: got }),
  });
  const hostState = createState();
  const guestState = createState();
  hostState.room = { playerId: myPlayerId(), mode, host: true };
  guestState.room = { playerId: 'p-mira', mode, host: false };
  const host = mk(hostState, { q: 2, r: 2, onWater: false }, 'host');
  const guest = mk(guestState, { q: 2, r: 3, onWater: false }, 'guest', 'p-mira');

  const hostSession = new HostSession({
    peer: hub.peer('room'), mode, me: { playerId: myPlayerId(), name: 'Asher', color: 'crimson' }, snapshot: async () => ({}),
  });
  host.session = hostSession;
  host.wire();
  const gs = new GuestSession({ peer: hub.peer(), hostId: 'room', me: { playerId: 'p-mira', name: 'Mira' } });
  await gs.connect();
  await gs.claim('ocean');
  // The guest's controller speaks as Mira.
  guest.session = gs;
  guest.wire();
  await settle();
  // Each side sees the other standing beside them.
  host.remoteFor('p-mira', { id: 'p-mira', name: 'Mira', color: 'ocean' });
  host.remotes.get('p-mira').q = 2; host.remotes.get('p-mira').r = 3;
  const hostCard = { id: myPlayerId(), name: 'Asher', color: 'crimson' };
  const r = guest.remoteFor(myPlayerId(), hostCard);
  r.q = 2; r.r = 2;
  return { host, guest, hostState, guestState, log };
}

test('the trade machine: any change takes both acceptances back', () => {
  const a = new PlayerTrade({ id: 't', me: 'a', them: 'b' });
  const b = new PlayerTrade({ id: 't', me: 'b', them: 'a' });
  b.onOffer(a.setMine({ berries: 3 }, 0));
  a.onOffer(b.setMine({}, 5));
  a.onAccept(b.accept());
  b.onAccept(a.accept());
  ok(a.both && b.both, 'both accepted the same offers');
  b.onOffer(a.setMine({ berries: 2 }, 0));
  ok(!a.both && !b.both, 'a change un-accepts both');
  a.onAccept({ mine: 0, theirs: 0 });
  ok(!a.accepted.them, 'an acceptance of old offers does not count');
});

test('the referee swaps only when both say ready, and refuses if either cannot', () => {
  const ref = new TradeReferee();
  eq(ref.onReady('t', 'a', { ok: true }), null, 'one side ready: wait');
  eq(ref.onReady('t', 'b', { ok: true }).verdict, 'commit');
  eq(ref.onReady('u', 'a', { ok: false, reason: 'pack is full' }).verdict, 'refuse');
});

test('a trade between two browsers goes through for both', async () => {
  const { host, guest, hostState, guestState, log } = await room();
  addItem(hostState, 'log', 4);
  const hostBerries = countInPack(hostState, 'berries');
  guestState.gold = 20;

  host.openTrade('p-mira');
  await settle();
  ok(guest.trade && guest.trade.them === myPlayerId(), 'Mira is asked to trade');
  host.tradeOffer({ log: 2 }, 0);
  guest.tradeOffer({}, 6);
  await settle();
  eq(guest.trade.theirs.items, { log: 2 }, 'Mira sees the offer');
  eq(host.trade.theirs.gold, 6);
  host.tradeAccept();
  guest.tradeAccept();
  await settle(60);

  eq(countInPack(hostState, 'log'), 2, 'Asher handed over two logs');
  eq(hostState.gold, 10 + 6, 'and got six gold');
  eq(countInPack(guestState, 'log'), 2, 'Mira has the logs');
  eq(guestState.gold, 20 - 6, 'and paid');
  eq(countInPack(hostState, 'berries'), hostBerries, 'nothing else moved');
  ok(log.host.some(x => x.done) && log.guest.some(x => x.done), 'both are told it is done');
});

test("a trade whose goods are gone by the time it's accepted goes through for neither", async () => {
  const { host, guest, hostState, guestState } = await room();
  addItem(hostState, 'log', 1);
  host.openTrade('p-mira');
  await settle();
  host.tradeOffer({ log: 1 }, 0);
  guest.tradeOffer({}, 3);
  await settle();
  hostState.inventory = hostState.inventory.map(s => (s?.id === 'log' ? null : s)); // the log is used up
  host.tradeAccept();
  guest.tradeAccept();
  await settle(60);
  eq(guestState.gold, 10, 'Mira keeps her gold');
  eq(countInPack(guestState, 'log'), 0);
  eq(guest.trade.status, 'cancelled');
});

test('Competitive: the host rolls for a fight, and the blow lands in the other browser', async () => {
  const { host, guest, guestState, log } = await room('competitive');
  const before = guestState.hp;
  host.toHost({ t: 'pvp', target: 'p-mira', dice: 6 });
  await settle();
  ok(log.host.some(x => x.pvpHit === 'p-mira'), 'the attacker sees the dice');
  const hits = log.guest.filter(x => x.hurt != null);
  eq(hits.length, 1, 'Mira is struck once');
  eq(hits[0].by, myPlayerId(), 'and knows who struck her');
  eq(guestState.hp, before - hits[0].hurt);
});

test('Co-op: there is no fighting each other', async () => {
  const { host, guestState, log } = await room('coop');
  const before = guestState.hp;
  host.toHost({ t: 'pvp', target: 'p-mira', dice: 6 });
  await settle();
  eq(guestState.hp, before);
  eq(log.guest.length, 0);
});

run('net_trade');
