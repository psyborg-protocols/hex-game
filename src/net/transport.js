// transport.js
// How browsers reach each other. Two transports with one shape (PeerJS's own):
//
//   peer.on('open', id)          this peer is reachable at `id`
//   peer.on('connection', conn)  someone connected to us (host side)
//   peer.connect(id) -> conn     connect to someone (guest side)
//   peer.destroy()
//   conn.on('open' | 'data' | 'close' | 'error', fn), conn.send(msg), conn.close(), conn.peer
//
// - PeerJS (WebRTC data channels; the public PeerJS broker only introduces the
//   browsers, then they talk directly). Loaded from a CDN the first time someone
//   plays with friends, so single-player never fetches it.
// - Loopback: an in-memory hub for tests, so a host and guests can run in one
//   Node process.

const PEERJS_URL = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
/** Room ids are short and readable, prefixed so they don't collide with other PeerJS users. */
const ID_PREFIX = 'hexquest-';

let peerJsLoading = null;

/** Load the PeerJS library once. Resolves with its `Peer` class. */
export function loadPeerJs() {
  if (globalThis.Peer) return Promise.resolve(globalThis.Peer);
  if (peerJsLoading) return peerJsLoading;
  peerJsLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PEERJS_URL;
    s.async = true;
    s.onload = () => (globalThis.Peer ? resolve(globalThis.Peer) : reject(new Error('PeerJS did not load')));
    s.onerror = () => { peerJsLoading = null; reject(new Error('Could not load PeerJS — are you online?')); };
    document.head.appendChild(s);
  });
  return peerJsLoading;
}

/** A short random room code: easy to read aloud, hard to guess. */
export function roomCode(rand = Math.random) {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 8; i++) s += abc[Math.floor(rand() * abc.length)];
  return s;
}

export const peerIdFor = code => ID_PREFIX + code;
export const codeFromPeerId = id => (id?.startsWith(ID_PREFIX) ? id.slice(ID_PREFIX.length) : id);

/**
 * Open a PeerJS peer. Pass `code` to host under that room code; omit it to get
 * a random id (guests). Resolves once the broker has registered it.
 */
export async function openPeer(code = null) {
  const Peer = await loadPeerJs();
  return new Promise((resolve, reject) => {
    const peer = code ? new Peer(peerIdFor(code)) : new Peer();
    const fail = err => { peer.destroy(); reject(err); };
    peer.once('open', () => { peer.off('error', fail); resolve(peer); });
    peer.once('error', fail);
  });
}

// ------------------------------------------------------------ loopback

/** A tiny event emitter with PeerJS's on/once/off/emit. */
class Emitter {
  constructor() { this.handlers = {}; }
  on(ev, fn) { (this.handlers[ev] ||= []).push(fn); return this; }
  once(ev, fn) {
    const w = (...a) => { this.off(ev, w); fn(...a); };
    return this.on(ev, w);
  }
  off(ev, fn) { this.handlers[ev] = (this.handlers[ev] || []).filter(h => h !== fn); return this; }
  emit(ev, ...a) { for (const h of [...(this.handlers[ev] || [])]) h(...a); }
}

class LoopConn extends Emitter {
  constructor(peerId) { super(); this.peer = peerId; this.other = null; this.open = false; }
  send(msg) {
    if (!this.open || !this.other) return;
    // Structured clone, as a data channel would serialise it; delivered later, as a network would.
    const copy = structuredClone(msg);
    const to = this.other;
    queueMicrotask(() => { if (to.open) to.emit('data', copy); });
  }
  close() {
    if (!this.open) return;
    this.open = false;
    const o = this.other;
    queueMicrotask(() => {
      this.emit('close');
      if (o?.open) { o.open = false; o.emit('close'); }
    });
  }
}

class LoopPeer extends Emitter {
  constructor(hub, id) { super(); this.hub = hub; this.id = id; this.conns = []; this.destroyed = false; }
  connect(id) {
    const mine = new LoopConn(id);
    const target = this.hub.peers.get(id);
    queueMicrotask(() => {
      if (!target || target.destroyed) { mine.emit('error', new Error(`No room ${id}`)); return; }
      const theirs = new LoopConn(this.id);
      mine.other = theirs;
      theirs.other = mine;
      mine.open = theirs.open = true;
      this.conns.push(mine);
      target.conns.push(theirs);
      target.emit('connection', theirs);
      queueMicrotask(() => { theirs.emit('open'); mine.emit('open'); });
    });
    return mine;
  }
  destroy() {
    this.destroyed = true;
    this.hub.peers.delete(this.id);
    for (const c of this.conns) c.close();
  }
}

/** An in-memory stand-in for the PeerJS broker: `hub.peer(id)` gives a connected peer. */
export class LoopbackHub {
  constructor() { this.peers = new Map(); this.n = 0; }
  peer(id = `guest-${++this.n}`) {
    const p = new LoopPeer(this, id);
    this.peers.set(id, p);
    queueMicrotask(() => p.emit('open', id));
    return p;
  }
}

// ------------------------------------------------------------ packing

/**
 * Pack a big value (the world snapshot) for the wire: JSON, gzipped when the
 * browser can, so a ~210 KB map crosses as ~30 KB.
 */
export async function pack(value) {
  const json = JSON.stringify(value);
  if (typeof CompressionStream === 'undefined') return { json };
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
  return { gz: new Uint8Array(await new Response(stream).arrayBuffer()) };
}

export async function unpack(packed) {
  if (packed.json != null) return JSON.parse(packed.json);
  const bytes = packed.gz instanceof Uint8Array ? packed.gz : new Uint8Array(packed.gz);
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return JSON.parse(await new Response(stream).text());
}
