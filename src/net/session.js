// session.js
// A room: one host, up to three guests, over any transport (transport.js).
//
// Joining:   guest -> hello {playerId, name}
//            host  -> colors {taken, mode, roster}          (or full)
//            guest -> claim {color}
//            host  -> welcome {you, mode, roster, snapshot} (or refused {color, taken})
// Colours are first come, first served: the host referees, so if two guests ask
// for the same colour at once, whichever request reaches the host first gets it.
//
// After that every message is `{ t: type, ... }`. Messages a guest sends go to
// the host; one with a `to` is passed on to that player alone, and types listed
// in RELAY are passed on to everyone, tagged `from`. The game layer
// (src/net/multiplayer.js) decides what they mean.

import { CLOAK_COLORS } from '../render/player_sprite.js';
import { pack, unpack, peerIdFor } from './transport.js';

export const MAX_PLAYERS = 4;
export const COLOR_IDS = CLOAK_COLORS.map(c => c.id);

/** Message types the host passes on to every other guest. */
const RELAY = new Set(['presence']);

class Emitter {
  constructor() { this.handlers = {}; }
  on(ev, fn) { (this.handlers[ev] ||= []).push(fn); return this; }
  off(ev, fn) { this.handlers[ev] = (this.handlers[ev] || []).filter(h => h !== fn); return this; }
  emit(ev, ...a) { for (const h of [...(this.handlers[ev] || [])]) h(...a); }
}

/** The public part of a player, as everyone's roster shows it. */
const card = p => ({ id: p.id, name: p.name, color: p.color, connected: p.connected, host: !!p.host });

// ================================================================== host

export class HostSession extends Emitter {
  /**
   * @param {object} o
   * @param o.peer      an open peer (transport.js)
   * @param o.mode      'coop' | 'competitive'
   * @param o.me        { playerId, name, color } — the host is player one
   * @param o.snapshot  async (playerId) => the world a joiner boots from
   */
  constructor({ peer, mode, me, snapshot, maxPlayers = MAX_PLAYERS, known = {} }) {
    super();
    this.role = 'host';
    this.peer = peer;
    this.mode = mode;
    this.maxPlayers = maxPlayers;
    this.snapshot = snapshot;
    this.meId = me.playerId;
    this.players = new Map([[me.playerId, { id: me.playerId, name: me.name, color: me.color, connected: true, host: true, conn: null }]]);
    this.pending = new Map(); // conn -> { playerId, name }
    this.known = known;       // playerId -> colour, from a saved game: offered back on rejoining
    peer.on('connection', conn => this.accept(conn));
  }

  get roster() { return [...this.players.values()].filter(p => p.connected).map(card); }

  /** Colours held by connected players, other than `exceptId`. */
  taken(exceptId = null) {
    return [...this.players.values()].filter(p => p.connected && p.id !== exceptId).map(p => p.color);
  }

  accept(conn) {
    conn.on('data', m => this.onData(conn, m));
    conn.on('close', () => this.drop(conn));
    conn.on('error', () => this.drop(conn));
  }

  playerByConn(conn) {
    for (const p of this.players.values()) if (p.conn === conn) return p;
    return null;
  }

  async onData(conn, m) {
    if (!m || typeof m.t !== 'string') return;
    const p = this.playerByConn(conn);
    if (!p) return this.onJoining(conn, m);
    if (m.t === 'recolor') return this.recolor(p, m.color);
    // Addressed to one player: passed on to them alone. The host still hears it
    // (it referees trades), and decides for itself what is its business.
    if (m.to && m.to !== this.meId) this.send(m.to, { ...m, from: p.id });
    else if (!m.to && RELAY.has(m.t)) this.broadcast({ ...m, from: p.id }, p.id);
    this.emit('message', p.id, m);
  }

  async onJoining(conn, m) {
    if (m.t === 'hello') {
      const id = String(m.playerId || '');
      const back = this.players.get(id);
      if (back?.connected) { conn.send({ t: 'refused-join', duplicate: true, reason: 'You are already in this game in another tab.' }); return; }
      if (!back && this.roster.length >= this.maxPlayers) { conn.send({ t: 'full', max: this.maxPlayers }); conn.close(); return; }
      this.pending.set(conn, { playerId: id, name: String(m.name || 'Wanderer').slice(0, 20) });
      conn.send({ t: 'colors', taken: this.taken(id), mode: this.mode, roster: this.roster, previous: back?.color || this.known[id] || null });
      return;
    }
    if (m.t === 'claim') {
      const j = this.pending.get(conn);
      if (!j) return;
      const color = String(m.color);
      if (!COLOR_IDS.includes(color) || this.taken(j.playerId).includes(color)) {
        conn.send({ t: 'refused', color, taken: this.taken(j.playerId) });
        return;
      }
      if (!this.players.has(j.playerId) && this.roster.length >= this.maxPlayers) {
        conn.send({ t: 'full', max: this.maxPlayers }); conn.close(); return;
      }
      this.pending.delete(conn);
      const prev = this.players.get(j.playerId);
      const p = { ...(prev || {}), id: j.playerId, name: j.name, color, connected: true, host: false, conn };
      this.players.set(p.id, p);
      const snapshot = await pack(await this.snapshot(p.id, !!prev));
      conn.send({ t: 'welcome', you: card(p), mode: this.mode, roster: this.roster, snapshot, rejoin: !!prev });
      this.broadcast({ t: 'roster', roster: this.roster }, p.id);
      this.emit('join', p.id, { rejoin: !!prev });
      this.emit('roster', this.roster);
    }
  }

  /** A player changes colour mid-game: allowed only to a free one. */
  recolor(p, color) {
    if (!COLOR_IDS.includes(color) || this.taken(p.id).includes(color)) {
      this.send(p.id, { t: 'refused', color, taken: this.taken(p.id) });
      return false;
    }
    p.color = color;
    this.broadcast({ t: 'roster', roster: this.roster });
    this.emit('roster', this.roster);
    return true;
  }

  /** The host's own colour change. */
  setMyColor(color) { return this.recolor(this.players.get(this.meId), color); }

  drop(conn) {
    this.pending.delete(conn);
    const p = this.playerByConn(conn);
    if (!p || !p.connected) return;
    p.connected = false;
    p.conn = null;
    this.broadcast({ t: 'roster', roster: this.roster });
    this.emit('leave', p.id);
    this.emit('roster', this.roster);
  }

  /** Messages the host sends itself say so: `from` is the host's player id. */
  send(playerId, m) {
    const p = this.players.get(playerId);
    if (p?.conn && p.connected) p.conn.send(m.from ? m : { ...m, from: this.meId });
  }

  broadcast(m, exceptId = null) {
    const out = m.from ? m : { ...m, from: this.meId };
    for (const p of this.players.values()) if (p.conn && p.connected && p.id !== exceptId) p.conn.send(out);
  }

  close() {
    this.broadcast({ t: 'closing' });
    this.peer.destroy();
  }
}

// ================================================================= guest

export class GuestSession extends Emitter {
  /**
   * @param o.peer   an open peer
   * @param o.hostId the host's peer id (a room code is turned into one with peerIdFor)
   * @param o.me     { playerId, name }
   */
  constructor({ peer, hostId, me }) {
    super();
    this.role = 'guest';
    this.peer = peer;
    this.hostId = hostId;
    this.me = me;
    this.meId = me.playerId;
    this.roster = [];
    this.mode = null;
    this.conn = null;
    this.waiters = [];
    this.closedByHost = false;
  }

  /** Connect and say hello. Resolves with { taken, mode, roster, previous }. */
  connect(timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const conn = this.peer.connect(this.hostId, { reliable: true });
      this.conn = conn;
      const timer = setTimeout(() => reject(new Error('The host did not answer. Check the link, and that they still have the game open.')), timeoutMs);
      conn.on('open', () => conn.send({ t: 'hello', playerId: this.me.playerId, name: this.me.name }));
      conn.on('error', err => { clearTimeout(timer); reject(err); });
      conn.on('close', () => { this.emit('close', { byHost: this.closedByHost }); });
      conn.on('data', m => this.onData(m));
      this.expect(['colors', 'full', 'refused-join'], m => {
        clearTimeout(timer);
        if (m.t === 'full') reject(new Error(`That game is full (${m.max} players).`));
        else if (m.t === 'refused-join') reject(Object.assign(new Error(m.reason), { duplicate: !!m.duplicate }));
        else { this.mode = m.mode; this.roster = m.roster; resolve(m); }
      });
    });
  }

  /** Ask for a colour. Resolves with the welcome (snapshot unpacked), or rejects with { refused, taken }. */
  claim(color) {
    return new Promise((resolve, reject) => {
      this.conn.send({ t: 'claim', color });
      this.expect(['welcome', 'refused', 'full'], async m => {
        if (m.t === 'refused') { reject({ refused: true, color: m.color, taken: m.taken }); return; }
        if (m.t === 'full') { reject(new Error(`That game is full (${m.max} players).`)); return; }
        this.mode = m.mode;
        this.roster = m.roster;
        resolve({ ...m, snapshot: await unpack(m.snapshot) });
      });
    });
  }

  /** Wait for the next message of one of `types`. */
  expect(types, fn) { this.waiters.push({ types, fn }); }

  onData(m) {
    if (!m || typeof m.t !== 'string') return;
    const i = this.waiters.findIndex(w => w.types.includes(m.t));
    if (i >= 0) { const [w] = this.waiters.splice(i, 1); w.fn(m); return; }
    if (m.t === 'roster') { this.roster = m.roster; this.emit('roster', m.roster); return; }
    if (m.t === 'closing') { this.closedByHost = true; return; }
    if (m.t === 'refused') { this.emit('refused', m); return; }
    this.emit('message', m.from || 'host', m);
  }

  send(m) { if (this.conn?.open !== false) this.conn?.send(m); }

  recolor(color) { this.send({ t: 'recolor', color }); }

  close() { this.conn?.close(); this.peer.destroy(); }
}

/** Turn a room code from a link into the host's peer id. */
export const hostIdFor = code => peerIdFor(code);
