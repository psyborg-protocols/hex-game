// sync.js
// Keeping one world in several browsers.
//
// Every browser changes the world as its player acts (a tree felled, a hearth
// built, a node picked) and sends the difference; the host merges it into its
// copy and passes it on. The host alone runs what isn't one player — raiders,
// wild dogs, the raid, the clock — and sends those as they change.
//
// A patch: { cols: [[key, column|null]], built: {add, remove}, taken, picked,
//            structures?, host?: { units, raid, ... } }
//
// Merge rules:
//   columns      last writer wins (two players rarely fell the same tree at once)
//   built        a set keyed item@q,r, so two players building at once both keep theirs
//   taken/picked per key: the later turn (or the bigger count) wins
//   host keys    the host's copy is the truth; guests never send them

const GUEST_KEYS = ['built', 'taken', 'picked'];
export const HOST_KEYS = ['units', 'raid', 'raidedUntil', 'towerClock', 'unitSeq', 'wildDogs', 'wildDogsSeeded', 'clock'];

const colJson = c => JSON.stringify({
  h: c.h, terrain: c.terrain, sprite: c.sprite, frame: c.frame, ...(c.feature ? { feature: c.feature } : {}),
});
const builtKey = b => `${b.item}@${b.q},${b.r}`;

export class WorldSync {
  /**
   * @param o.map     the WorldMap
   * @param o.state   the state holding the shared keys
   * @param o.isHost  whether this browser owns the host keys
   */
  constructor({ map, state, isHost }) {
    this.map = map;
    this.state = state;
    this.isHost = isHost;
    this.rebase();
  }

  /** Remember the world as it is now; later diffs are against this. */
  rebase() {
    this.cols = new Map();
    for (const c of this.map) this.cols.set(`${c.q},${c.r}`, colJson(c));
    this.builtSet = new Map((this.state.built || []).map(b => [builtKey(b), b]));
    this.taken = { ...(this.state.taken || {}) };
    this.picked = { ...(this.state.picked || {}) };
    this.structures = JSON.stringify(this.map.structures || []);
    this.hostKeys = Object.fromEntries(HOST_KEYS.map(k => [k, JSON.stringify(this.state[k] ?? null)]));
  }

  /** What changed since the last diff (or apply). Null when nothing did. */
  diff({ hostKeys = this.isHost } = {}) {
    const patch = {};
    const cols = [];
    const seen = new Set();
    for (const c of this.map) {
      const k = `${c.q},${c.r}`;
      seen.add(k);
      const j = colJson(c);
      if (this.cols.get(k) !== j) { cols.push([k, JSON.parse(j)]); this.cols.set(k, j); }
    }
    for (const k of [...this.cols.keys()]) if (!seen.has(k)) { cols.push([k, null]); this.cols.delete(k); }
    if (cols.length) patch.cols = cols;

    const now = new Map((this.state.built || []).map(b => [builtKey(b), b]));
    const add = [...now.entries()].filter(([k]) => !this.builtSet.has(k)).map(([, b]) => ({ ...b }));
    const remove = [...this.builtSet.keys()].filter(k => !now.has(k));
    if (add.length || remove.length) patch.built = { add, remove };
    this.builtSet = now;

    for (const key of ['taken', 'picked']) {
      const cur = this.state[key] || {};
      const changed = {};
      for (const [k, v] of Object.entries(cur)) if (this[key][k] !== v) changed[k] = v;
      if (Object.keys(changed).length) patch[key] = changed;
      this[key] = { ...cur };
    }

    const structures = JSON.stringify(this.map.structures || []);
    if (structures !== this.structures) { patch.structures = JSON.parse(structures); this.structures = structures; }

    if (hostKeys) {
      const host = {};
      for (const k of HOST_KEYS) {
        const j = JSON.stringify(this.state[k] ?? null);
        if (j !== this.hostKeys[k]) { host[k] = JSON.parse(j); this.hostKeys[k] = j; }
      }
      if (Object.keys(host).length) patch.host = host;
    }
    return Object.keys(patch).length ? patch : null;
  }

  /**
   * Merge a patch from elsewhere into this world, and into the baseline, so it
   * is not sent back. Returns { cols: changed column keys, hostKeys: changed keys }.
   */
  apply(patch) {
    const out = { cols: [], hostKeys: [] };
    const { state, map } = this;

    for (const [k, col] of patch.cols || []) {
      const [q, r] = k.split(',').map(Number);
      if (col) {
        map.set(q, r, structuredClone(col));
        this.cols.set(k, colJson(map.get(q, r)));
      } else {
        map.delete(q, r);
        this.cols.delete(k);
      }
      out.cols.push(k);
    }

    if (patch.built) {
      state.built ||= [];
      const gone = new Set(patch.built.remove || []);
      state.built = state.built.filter(b => !gone.has(builtKey(b)));
      const have = new Set(state.built.map(builtKey));
      for (const b of patch.built.add || []) if (!have.has(builtKey(b))) state.built.push({ ...b });
      // The baseline learns only what the patch said; our own unsent builds stay unsent.
      for (const k of gone) this.builtSet.delete(k);
      for (const b of patch.built.add || []) this.builtSet.set(builtKey(b), b);
    }

    for (const key of ['taken', 'picked']) {
      if (!patch[key]) continue;
      state[key] ||= {};
      for (const [k, v] of Object.entries(patch[key])) {
        // Picked records are "regrows at turn"; taken are counts. Either way, more wins.
        state[key][k] = Math.max(state[key][k] ?? -Infinity, v);
        this[key][k] = state[key][k];
      }
    }

    if (patch.structures) {
      map.structures = structuredClone(patch.structures);
      map.decks = null; // bridges are cached; see addStructure
      this.structures = JSON.stringify(map.structures);
    }

    if (patch.host && !this.isHost) {
      for (const [k, v] of Object.entries(patch.host)) {
        state[k] = structuredClone(v);
        this.hostKeys[k] = JSON.stringify(v ?? null);
        out.hostKeys.push(k);
      }
    }
    return out;
  }
}

/** Is there anything in this patch besides the host-only keys? */
export const touchesWorld = p => !!(p.cols || p.built || p.taken || p.picked || p.structures);
export { GUEST_KEYS };
