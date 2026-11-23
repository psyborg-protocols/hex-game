// multiplayer.js
// Playing with friends, as the game sees it: who you are, the room you are in,
// and everyone else walking around your world.
//
// session.js runs the room; this file ties it to the game. The host's browser
// owns the shared world (shared.js); everyone else keeps a copy, and every
// player simulates themself and tells the others where they are ("presence").

import { Player } from '../game/player.js';
import { sharedSlice } from '../game/shared.js';
import { cloakColor } from '../render/player_sprite.js';
import { openPeer, roomCode, peerIdFor } from './transport.js';
import { HostSession, GuestSession } from './session.js';
import { WorldSync } from './sync.js';

const ID_KEY = 'hexquest.playerId';
const TAB_KEY = 'hexquest.tabPlayerId';
const NAME_KEY = 'hexquest.name';
/** Presence goes out at most this often, and at least this often while idle. */
const PRESENCE_MS = 100;
const HEARTBEAT_MS = 2000;
/** How often the host sends the moving parts of the world (raiders, dogs). */
const WORLD_MS = 200;

// --------------------------------------------------------------- identity

const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode: fine */ } },
};
const tabStore = {
  get(k) { try { return sessionStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch { /* fine */ } },
};

/**
 * Your id for every room you join: stable, so a host recognises you coming back.
 * A second tab in the same browser gets an id of its own (useTabIdentity).
 */
export function myPlayerId() {
  const tab = tabStore.get(TAB_KEY);
  if (tab) return tab;
  let id = store.get(ID_KEY);
  if (!id) {
    id = `p-${Math.random().toString(36).slice(2, 10)}`;
    store.set(ID_KEY, id);
  }
  return id;
}

/** This tab is a second player in the same browser: give it its own id. */
export function useTabIdentity() {
  const id = `p-${Math.random().toString(36).slice(2, 10)}`;
  tabStore.set(TAB_KEY, id);
  return id;
}

export const myName = () => store.get(NAME_KEY) || '';
export const rememberName = name => store.set(NAME_KEY, name);

/** The share link for a room. */
export const linkFor = code => `${location.origin}${location.pathname}?join=${code}`;

/** Open a guest connection to a room code. Resolves with the session and the host's hello. */
export async function connectAsGuest(code, name) {
  const peer = await openPeer();
  const session = new GuestSession({ peer, hostId: peerIdFor(code), me: { playerId: myPlayerId(), name } });
  try {
    const hello = await session.connect();
    return { session, hello };
  } catch (e) {
    peer.destroy();
    // The same browser is already in this game (another tab): join as someone new.
    if (e.duplicate && !tabStore.get(TAB_KEY)) {
      useTabIdentity();
      return connectAsGuest(code, name);
    }
    throw e;
  }
}

// ------------------------------------------------------------ other pawns

/**
 * Someone else's pawn. A Player whose route comes from their presence messages,
 * so it walks the same eased steps theirs does.
 */
export class RemotePlayer extends Player {
  constructor(map, card) {
    super(map, { q: 0, r: 0 });
    this.id = card.id;
    this.card = card;
    this.lastSeen = 0;
    this.actionSeq = null;
    this.hp = 1;
    this.maxHp = 1;
    this.turn = 0;
    this.waiting = false;
  }

  apply(m, now) {
    this.lastSeen = now;
    this.q = m.q;
    this.r = m.r;
    this.leg = m.leg ? { ...m.leg } : null;
    this.path = (m.path || []).map(s => ({ q: s.q, r: s.r }));
    this.dir = m.dir || 'side';
    this.facing = m.facing || 1;
    this.seated = !!m.seated;
    this.equipped = m.equipped || null;
    this.hp = m.hp ?? this.hp;
    this.maxHp = m.maxHp ?? this.maxHp;
    this.turn = m.turn ?? this.turn;
    this.waiting = !!m.waiting;
    if (m.action && m.action.seq !== this.actionSeq) {
      this.actionSeq = m.action.seq;
      this.triggerAction(m.action.kind, m.action.dur || 0.55);
    }
  }
}

// --------------------------------------------------------------- the room

export class Multiplayer {
  /**
   * @param ctx { world, state, player, ui, tileCenter, onRoster? }
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.session = null;
    this.code = null;
    this.remotes = new Map();
    this.tags = new Map();
    this.lastSent = 0;
    this.lastPresence = '';
    this.sync = null;
    this.lastWorld = 0;
  }

  get active() { return !!this.session; }
  get isHost() { return this.session?.role === 'host'; }
  get isGuest() { return this.session?.role === 'guest'; }
  get mode() { return this.session?.mode || null; }
  get roster() { return this.session?.roster || []; }
  get link() { return this.code ? linkFor(this.code) : null; }

  /** Colours other players hold right now. */
  takenColors() {
    return this.roster.filter(p => p.id !== myPlayerId()).map(p => p.color);
  }

  // ------------------------------------------------------------- hosting

  /** Open a room around the world you are in. Resolves with the share link. */
  async host({ mode, name, color }) {
    const { state } = this.ctx;
    this.code = roomCode();
    const peer = await openPeer(this.code);
    const me = { playerId: myPlayerId(), name, color };
    this.session = new HostSession({ peer, mode, me, snapshot: (id, rejoin) => this.snapshotFor(id, rejoin) });
    state.room = { playerId: me.playerId, mode, host: true, code: this.code };
    state.playerColor = color;
    rememberName(name);
    this.wire();
    return this.link;
  }

  /** The world a joining friend boots from. */
  snapshotFor(/* playerId, rejoin */) {
    const { world, state, player } = this.ctx;
    return {
      seed: world.seed,
      map: { ...world.map.toJSON(), tiles: undefined },
      shared: sharedSlice(state),
      // Friends arrive where the host is standing.
      spawn: { q: player.q, r: player.r },
      mode: this.session.mode,
    };
  }

  // ------------------------------------------------------------- joining

  /** Take over a guest session that has already been welcomed (see join_screen.js). */
  attachGuest(session, welcome, code) {
    const { state } = this.ctx;
    this.session = session;
    this.code = code;
    state.room = { playerId: myPlayerId(), mode: welcome.mode, host: false, code };
    state.playerColor = welcome.you.color;
    this.wire();
  }

  // ---------------------------------------------------------- messages

  wire() {
    const s = this.session;
    this.sync = new WorldSync({ map: this.ctx.world.map, state: this.ctx.state, isHost: this.isHost });
    s.on('message', (from, m) => this.onMessage(from, m));
    s.on('roster', roster => this.onRoster(roster));
    s.on('leave', id => this.dropRemote(id));
    s.on('refused', m => this.ctx.ui.notify(`${cloakColor(m.color).name} is taken. Pick another colour.`, 3200, 'bad'));
    s.on('close', ({ byHost } = {}) => this.onHostGone(byHost));
    this.onRoster(this.roster);
  }

  onMessage(from, m) {
    if (m.t === 'presence') this.remoteFor(from)?.apply(m, performance.now());
    else if (m.t === 'patch') this.onPatch(from, m);
  }

  // -------------------------------------------------------------- the world

  /** Send whatever this browser changed in the world since last time. */
  flush() {
    if (!this.sync) return;
    const patch = this.sync.diff();
    if (!patch) return;
    this.send({ t: 'patch', ...patch });
  }

  /** A change from someone else: merge it; the host passes it on to the rest. */
  onPatch(from, m) {
    const { t, from: _f, ...patch } = m;
    if (this.isHost) {
      delete patch.host; // only the host speaks for raiders and the clock
      // Our own unsent changes go out first, so the rebroadcast below is theirs alone.
      this.flush();
      const res = this.sync.apply(patch);
      this.session.broadcast({ t: 'patch', ...patch, from }, from);
      this.ctx.onWorldPatched?.(res, patch);
    } else {
      const res = this.sync.apply(patch);
      this.ctx.onWorldPatched?.(res, patch);
    }
  }

  /** Between the host's updates, a guest walks raiders on along their legs. */
  glideUnits(dt) {
    for (const u of this.ctx.state.units || []) {
      if (!u.leg) continue;
      u.leg.t = Math.min(1, u.leg.t + dt / (u.leg.duration || 1));
    }
  }

  onRoster(roster) {
    const { state, ui } = this.ctx;
    const ids = new Set(roster.map(p => p.id));
    for (const id of [...this.remotes.keys()]) if (!ids.has(id)) this.dropRemote(id);
    for (const p of roster) {
      if (p.id === myPlayerId()) {
        state.playerColor = p.color;
        continue;
      }
      const r = this.remoteFor(p.id, p);
      if (r) r.card = p;
      this.retag(p);
    }
    this.ctx.onRoster?.(roster);
    if (ui.openPanelName === 'friends' || ui.openPanelName === 'menu') ui.refreshPanel();
  }

  remoteFor(id, card = null) {
    if (id === myPlayerId()) return null;
    let r = this.remotes.get(id);
    if (!r) {
      const c = card || this.roster.find(p => p.id === id);
      if (!c) return null;
      r = new RemotePlayer(this.ctx.world.map, c);
      this.remotes.set(id, r);
    }
    return r;
  }

  dropRemote(id) {
    this.remotes.delete(id);
    const tag = this.tags.get(id);
    if (tag) {
      tag.el.remove();
      this.ctx.ui.anchors = this.ctx.ui.anchors.filter(a => a !== tag);
      this.tags.delete(id);
    }
  }

  /** A name over someone's head, in their colour. */
  retag(card) {
    const { ui } = this.ctx;
    let tag = this.tags.get(card.id);
    if (!tag) {
      const el = document.createElement('div');
      el.className = 'nametag';
      ui.worldspace.appendChild(el);
      tag = { el, pos: () => this.remotes.get(card.id)?.pos || { x: 0, y: 0 } };
      ui.anchors.push(tag);
      this.tags.set(card.id, tag);
    }
    const col = cloakColor(card.color);
    tag.el.textContent = card.name;
    tag.el.style.setProperty('--tag', col.cloak.l);
    tag.el.style.setProperty('--tag-edge', col.cloak.o);
    tag.w = tag.h = 0; // re-measure
  }

  onHostGone(byHost) {
    const { ui, state } = this.ctx;
    for (const id of [...this.remotes.keys()]) this.dropRemote(id);
    this.session = null;
    this.code = null;
    if (state.room) state.room = { ...state.room, gone: true };
    ui.openPanel('message', {
      title: 'The host has left',
      html: `<p class="lede">${byHost ? 'They closed the game.' : 'The connection to the host was lost.'}</p>
        <p>You can keep exploring this world on your own.</p>`,
    });
  }

  /** Leave the room (guest) or close it (host). */
  leave() {
    if (!this.session) return;
    this.session.close();
    for (const id of [...this.remotes.keys()]) this.dropRemote(id);
    this.session = null;
    this.code = null;
    if (this.ctx.state.room) delete this.ctx.state.room;
  }

  // ------------------------------------------------------------ every frame

  presence() {
    const { player, state } = this.ctx;
    return {
      t: 'presence',
      q: player.q, r: player.r,
      leg: player.leg ? { from: player.leg.from, to: player.leg.to, t: player.leg.t, duration: player.leg.duration } : null,
      path: player.path.slice(0, 8).map(s => ({ q: s.q, r: s.r })),
      dir: player.dir, facing: player.facing, seated: !!player.seated,
      action: player.actionAnim
        ? { kind: player.actionAnim.kind, seq: player.actionAnim.start, dur: player.actionAnim.until - player.actionAnim.start }
        : null,
      equipped: player.equipped,
      hp: state.hp, maxHp: this.ctx.maxHp?.(state) ?? state.hp,
      turn: state.turn || 0,
      waiting: !!state.waitingForDawn,
    };
  }

  /** Call every frame: move the others, and tell them where you are when it changed. */
  tick(dt, now = performance.now()) {
    if (!this.session) return;
    for (const r of this.remotes.values()) r.update(dt);
    if (this.isGuest) this.glideUnits(dt);
    else if (now - this.lastWorld >= WORLD_MS) { this.lastWorld = now; this.flush(); }
    const p = this.presence();
    const key = JSON.stringify({ ...p, leg: p.leg && { ...p.leg, t: 0 } });
    const changed = key !== this.lastPresence;
    if ((changed && now - this.lastSent >= PRESENCE_MS) || now - this.lastSent >= HEARTBEAT_MS) {
      this.lastPresence = key;
      this.lastSent = now;
      this.send(p);
    }
  }

  /** To everyone: the host broadcasts, a guest sends to the host (who relays). */
  send(m) {
    if (!this.session) return;
    if (this.isHost) this.session.broadcast(m);
    else this.session.send(m);
  }

  /** Remote pawns for the renderer's entity list. */
  entities() { return [...this.remotes.values()]; }

  /** Everyone else, faintly, through whatever stands in front of them. */
  drawGhosts(ctx) { for (const r of this.remotes.values()) r.draw(ctx, true); }

  /** The remote player standing on a hex, if any. */
  remoteAt(q, r) {
    for (const p of this.remotes.values()) if (p.q === q && p.r === r) return p;
    return null;
  }

  // ------------------------------------------------------------- colour

  /** Ask to change colour. Alone it just happens; in a room the host referees. */
  requestColor(color) {
    const { state } = this.ctx;
    if (!this.session) { state.playerColor = color; return true; }
    if (this.takenColors().includes(color)) return false;
    if (this.isHost) return this.session.setMyColor(color);
    this.session.recolor(color);
    return true;
  }
}
