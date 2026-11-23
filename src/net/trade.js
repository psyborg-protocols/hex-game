// trade.js
// Two players swapping goods face to face.
//
// Each side puts items from their pack, and gold, on the table; each sees the
// other's offer as it changes, and presses Accept. Any change to either offer
// takes both acceptances back. Once both have accepted the same offers, each
// side checks it can still go through (the goods are still there, the pack has
// room) and says ready; the host, seeing both ready, tells both to swap. That
// way neither hands anything over unless both do.
//
// Messages (all { t: 'trade', id, op, ... } and addressed `to` the other side):
//   open     { with }               someone asks you to trade
//   offer    { items, gold, rev }   their offer changed
//   accept   { mine, theirs }       they accept (the revs they saw)
//   ready    { ok, reason? }        to the host: I can go through with it
//   commit                          from the host: swap now
//   cancel   { reason? }

import { addItem, removeItem, countInPack, hasRoomFor } from '../game/inventory.js';
import { itemName } from '../game/state.js';

const clean = items => Object.fromEntries(Object.entries(items || {}).filter(([, n]) => n > 0));

export class PlayerTrade {
  constructor({ id, me, them }) {
    this.id = id;
    this.me = me;
    this.them = them;
    this.mine = { items: {}, gold: 0, rev: 0 };
    this.theirs = { items: {}, gold: 0, rev: 0 };
    this.accepted = { me: false, them: false };
    this.status = 'open'; // open | ready | done | cancelled
    this.note = '';
  }

  get both() { return this.accepted.me && this.accepted.them; }

  /** Change what you are offering. Returns the message for the other side. */
  setMine(items, gold) {
    this.mine = { items: clean(items), gold: Math.max(0, Math.floor(gold || 0)), rev: this.mine.rev + 1 };
    this.accepted = { me: false, them: false };
    this.status = 'open';
    return { op: 'offer', items: this.mine.items, gold: this.mine.gold, rev: this.mine.rev };
  }

  /** Their offer changed: nobody has accepted this one yet. */
  onOffer(m) {
    this.theirs = { items: clean(m.items), gold: Math.max(0, m.gold || 0), rev: m.rev };
    this.accepted = { me: false, them: false };
    this.status = 'open';
  }

  /** You accept the offers as they stand. Returns the message for the other side. */
  accept() {
    this.accepted.me = true;
    return { op: 'accept', mine: this.mine.rev, theirs: this.theirs.rev };
  }

  /** They accept — counted only if they saw the offers as they stand now. */
  onAccept(m) {
    if (m.mine === this.theirs.rev && m.theirs === this.mine.rev) this.accepted.them = true;
  }

  /** Can this side go through with it? Checked against the pack right now. */
  check(state) {
    if (state.gold < this.mine.gold) return { ok: false, reason: 'not enough gold' };
    for (const [id, n] of Object.entries(this.mine.items)) {
      if (countInPack(state, id) < n) return { ok: false, reason: `no longer has ${n} ${itemName(id)}` };
    }
    // Room is checked with what you give already gone.
    const trial = structuredClone({ inventory: state.inventory, worn: state.worn, gold: state.gold, built: state.built || [] });
    for (const [id, n] of Object.entries(this.mine.items)) removeItem(trial, id, n);
    for (const [id, n] of Object.entries(this.theirs.items)) {
      if (!hasRoomFor(trial, id, n)) return { ok: false, reason: 'pack is full' };
      addItem(trial, id, n);
    }
    return { ok: true };
  }

  /** The host said swap: hand over yours, take theirs. */
  execute(state) {
    for (const [id, n] of Object.entries(this.mine.items)) removeItem(state, id, n);
    state.gold -= this.mine.gold;
    const got = [];
    for (const [id, n] of Object.entries(this.theirs.items)) {
      const k = addItem(state, id, n);
      if (k) got.push(`${k} ${itemName(id)}`);
    }
    state.gold += this.theirs.gold;
    if (this.theirs.gold) got.push(`${this.theirs.gold} gold`);
    this.status = 'done';
    return got;
  }
}

/**
 * The host's side: it hears both players say ready, and only then tells both to
 * swap. A trade either goes through for both, or for neither.
 */
export class TradeReferee {
  constructor() { this.ready = new Map(); }

  /** Record one side's answer. Returns 'commit', 'refuse' (with reason) or null (wait). */
  onReady(tradeId, from, m) {
    if (!m.ok) { this.ready.delete(tradeId); return { verdict: 'refuse', reason: m.reason || 'they could not' }; }
    const sides = this.ready.get(tradeId) || new Map();
    sides.set(from, m);
    this.ready.set(tradeId, sides);
    if (sides.size < 2) return null;
    this.ready.delete(tradeId);
    return { verdict: 'commit' };
  }
}
