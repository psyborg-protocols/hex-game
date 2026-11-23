// net_session.test.mjs — rooms over the in-memory loopback transport: joining
// with a snapshot, first-come-first-served colours, the four-player cap,
// relaying, leaving and rejoining.

import { test, eq, ok, run } from './_harness.mjs';
import { LoopbackHub, pack, unpack } from '../src/net/transport.js';
import { HostSession, GuestSession, MAX_PLAYERS } from '../src/net/session.js';

const tick = () => new Promise(r => setTimeout(r, 0));
const settle = async (n = 20) => { for (let i = 0; i < n; i++) await tick(); };

function room(mode = 'coop') {
  const hub = new LoopbackHub();
  const hostPeer = hub.peer('room-1');
  const host = new HostSession({
    peer: hostPeer, mode, me: { playerId: 'p-host', name: 'Asher', color: 'crimson' },
    snapshot: async id => ({ seed: 'abc', for: id, map: { columns: [['0,0', { h: 1, terrain: 'grass' }]] } }),
  });
  const guest = (id, name) => new GuestSession({ peer: hub.peer(), hostId: 'room-1', me: { playerId: id, name } });
  return { hub, host, guest };
}

test('packing a snapshot round-trips (gzipped where the runtime can)', async () => {
  const value = { map: { columns: Array.from({ length: 500 }, (_, i) => [`${i},0`, { h: 1, terrain: 'grass' }]) } };
  const p = await pack(value);
  ok(p.gz || p.json, 'packed');
  if (p.gz) ok(p.gz.length < JSON.stringify(value).length / 3, 'gzip shrinks a map a lot');
  eq(await unpack(p), value);
});

test('a guest joins: sees taken colours, claims one, boots from the snapshot', async () => {
  const { host, guest } = room('competitive');
  const mira = guest('p-mira', 'Mira');
  const hello = await mira.connect();
  eq(hello.mode, 'competitive');
  eq(hello.taken, ['crimson'], "the host's colour is taken");
  const welcome = await mira.claim('ocean');
  eq(welcome.you.color, 'ocean');
  eq(welcome.snapshot.seed, 'abc');
  eq(welcome.snapshot.for, 'p-mira', 'the snapshot is made for the joiner');
  eq(host.roster.map(p => p.color).sort(), ['crimson', 'ocean']);
});

test('a taken colour is refused; two claims at once: first to reach the host wins', async () => {
  const { host, guest } = room();
  const a = guest('p-a', 'Ana');
  const b = guest('p-b', 'Ben');
  await a.connect();
  await b.connect();

  let refused = null;
  try { await a.claim('crimson'); } catch (e) { refused = e; }
  ok(refused?.refused, "the host's colour cannot be claimed");
  ok(refused.taken.includes('crimson'));

  // Both ask for amber in the same moment; Ana's request is sent first.
  const pa = a.claim('amber');
  const pb = b.claim('amber').then(() => 'got it', e => e);
  const wa = await pa;
  const rb = await pb;
  eq(wa.you.color, 'amber', 'the first claim wins');
  ok(rb.refused, 'the second is refused');
  ok(rb.taken.includes('amber'));
  const wb = await b.claim('plum');
  eq(wb.you.color, 'plum', 'and can choose again');
  eq(host.roster.length, 3);
});

test('the room holds four; a fifth is turned away', async () => {
  const { host, guest } = room();
  const colors = ['amber', 'rose', 'forest'];
  for (let i = 0; i < 3; i++) {
    const g = guest(`p-${i}`, `G${i}`);
    await g.connect();
    await g.claim(colors[i]);
  }
  eq(host.roster.length, MAX_PLAYERS);
  const late = guest('p-late', 'Late');
  let err = null;
  try { await late.connect(); } catch (e) { err = e; }
  ok(err && /full/.test(err.message), 'a fifth player is told the game is full');
});

test('relayed messages reach the others tagged with the sender; leaving frees a colour', async () => {
  const { host, guest } = room();
  const a = guest('p-a', 'Ana');
  const b = guest('p-b', 'Ben');
  await a.connect(); await a.claim('amber');
  await b.connect(); await b.claim('rose');

  const seenByB = [];
  const seenByHost = [];
  b.on('message', (from, m) => seenByB.push({ from, m }));
  host.on('message', (from, m) => seenByHost.push({ from, m }));
  a.send({ t: 'presence', q: 3, r: 4 });
  a.send({ t: 'turn', turn: 5 });
  await settle();
  ok(seenByB.some(x => x.from === 'p-a' && x.m.t === 'presence' && x.m.q === 3), 'presence is relayed to other guests');
  ok(!seenByB.some(x => x.m.t === 'turn'), 'host-only messages are not relayed');
  ok(seenByHost.some(x => x.from === 'p-a' && x.m.t === 'turn'), 'the host hears both');
  host.broadcast({ t: 'presence', q: 9, r: 9 });
  await settle();
  ok(seenByB.some(x => x.from === 'p-host' && x.m.q === 9), "the host's own messages carry the host's id");

  const left = [];
  host.on('leave', id => left.push(id));
  a.close();
  await settle();
  eq(left, ['p-a']);
  ok(!host.taken().includes('amber'), "Ana's colour is free again");
  ok(b.roster.every(p => p.id !== 'p-a'), "the others' roster drops her");

  // She comes back: rejoining is recognised, and her colour is still free.
  const back = guest('p-a', 'Ana');
  const hello = await back.connect();
  eq(hello.previous, 'amber');
  const w = await back.claim('amber');
  ok(w.rejoin, 'a returning player is told it is a rejoin');
});

test('changing colour mid-game is refereed too', async () => {
  const { host, guest } = room();
  const a = guest('p-a', 'Ana');
  await a.connect(); await a.claim('amber');
  const refusals = [];
  a.on('refused', m => refusals.push(m.color));
  a.recolor('crimson');
  await settle();
  eq(refusals, ['crimson'], "can't take the host's colour");
  a.recolor('snow');
  await settle();
  ok(host.roster.some(p => p.id === 'p-a' && p.color === 'snow'));
  ok(host.setMyColor('amber'), 'the host can take the colour Ana just let go');
});

run('net_session');
