// worldgen.js
// Seeded world generation, writing the same map format editor.html reads.
//
// The shape of the world is carried over from the old three.js generator —
// domain-warped fbm for the base, radial mountains with ridged crests, a
// meandering river that widens into a lake, forests on one side of it and
// villages on the other. What changed is everything downstream: terrain resolves
// to sprite sheets instead of block textures, and heights are real cliffs.
//
// Two design constraints from the docs steer the output:
//   - Path art has no five-way junctions and only three of fifteen four-ways
//     (docs/new_tiles.md), so roads are grown as a tree, not a grid.
//   - Ore only exists in a world once Mind 4 (Lore) has revealed it, and each
//     vein is finite (skill_map.md). Veins are placed here but stay hidden.

import { Rng, SeededPerlin } from '../core/rng.js';
import { distance, neighbors } from './hexgrid.js';
import { WorldMap } from './mapformat.js';
import { variantFor, isWater } from './tileset.js';

export const DEFAULTS = {
  seed: 'hexworld',
  radius: 26,          // board radius in hexes
  maxHeight: 7,        // levels; a 7 next to a 0 is a wall you have to mine
  villages: 5,
  oreVeins: 7,
};

/**
 * Generate a world.
 * @returns {WorldMap} with terrain, heights, features, structures and a spawn.
 */
export function generateWorld(options = {}) {
  const opt = { ...DEFAULTS, ...options };
  const gen = new Generator(opt);
  return gen.build();
}

class Generator {
  constructor(opt) {
    this.opt = opt;
    this.radius = opt.radius;
    this.maxHeight = opt.maxHeight;

    this.land = new SeededPerlin(`${opt.seed}-land`);
    this.moist = new SeededPerlin(`${opt.seed}-moisture`);
    this.forest = new SeededPerlin(`${opt.seed}-forest`);
    this.rng = new Rng(`${opt.seed}-rng`);

    this.height = new Map();     // "q,r" -> level
    this.water = new Map();      // "q,r" -> 'river' | 'water' | undefined
    this.cells = [];             // every in-board coordinate, row-major
    this.riverQ = new Map();     // r -> the river's centre column on that row
  }

  key(q, r) { return `${q},${r}`; }
  inBoard(q, r) { return distance(q, r, 0, 0) <= this.radius; }
  h(q, r) { return this.height.get(this.key(q, r)) ?? 0; }
  setH(q, r, v) { this.height.set(this.key(q, r), clamp(Math.round(v), 0, this.maxHeight)); }

  build() {
    this.layOutBoard();
    this.raiseTerrain();
    this.addMountains(this.rng.irange(3, 6));
    this.carveRiver();
    this.smoothShores();
    this.chooseSpawn();
    this.connectByRamps();

    const map = new WorldMap({ seed: this.opt.seed, name: `world ${this.opt.seed}` });
    this.paintTerrain(map);
    this.growForests(map);
    this.placeVillages(map);
    this.layRoads(map);
    this.seedOre(map);
    map.spawn = this.spawn;
    resolveAutotiles(map, this.opt.resolvers);
    return map;
  }

  // ------------------------------------------------------------- shape

  layOutBoard() {
    // Offset coordinates are not symmetric about the origin the way axial is, so
    // walk a generous rectangle and keep whatever falls inside the hex board.
    const span = this.radius + 2;
    for (let r = -span; r <= span; r++) {
      for (let q = -span; q <= span; q++) {
        if (this.inBoard(q, r)) {
          this.cells.push({ q, r });
          this.height.set(this.key(q, r), 0);
        }
      }
    }
  }

  /**
   * Base elevation: fbm sampled through a warped domain, so the contours bend
   * instead of running in noise-shaped blobs. Most of the world stays low —
   * height is spent on the mountains, where it reads.
   */
  raiseTerrain() {
    for (const { q, r } of this.cells) {
      const nx = q / this.radius;
      const ny = r / this.radius;
      const warpX = 0.4 * (this.land.fbm(nx * 0.6 + 31.1, ny * 0.6 - 17.3, 3, 2.2, 0.55) - 0.5);
      const warpY = 0.4 * (this.land.fbm(nx * 0.6 - 12.7, ny * 0.6 + 24.5, 3, 2.2, 0.55) - 0.5);

      // Low frequency on purpose: one cycle spans a dozen hexes, so the slopes
      // come out climbable and the cliffs come from the mountains instead of
      // from noise. A rough base would leave the ramp carver flattening the map.
      let e = this.land.fbm((nx + warpX) * 3.0, (ny + warpY) * 3.0, 4, 2.0, 0.55);
      e = Math.pow(clamp(e, 0, 1), 1.35);

      // Fall away at the rim so the board ends in shoreline, not a wall.
      const rim = 1 - Math.max(0, distance(q, r, 0, 0) / this.radius - 0.78) / 0.22;
      this.setH(q, r, e * this.maxHeight * 0.85 * clamp(rim, 0, 1));
    }
  }

  /** Radial bumps with ridged crests laid over them — the mineable high ground. */
  addMountains(count) {
    for (let i = 0; i < count; i++) {
      const seat = this.rng.pick(this.cells.filter(c =>
        distance(c.q, c.r, 0, 0) < this.radius * 0.75));
      if (!seat) continue;

      const peak = this.rng.irange(Math.ceil(this.maxHeight * 0.7), this.maxHeight);
      const rad = this.rng.irange(Math.floor(this.radius * 0.18), Math.floor(this.radius * 0.32));

      for (const { q, r } of this.cells) {
        const d = distance(q, r, seat.q, seat.r);
        if (d >= rad) continue;
        const t = 1 - d / rad;
        this.setH(q, r, this.h(q, r) + peak * Math.pow(t, 1.6));
      }

      // Crests: only where the ridge is already strong, so they add spurs rather
      // than roughening the whole massif.
      for (const { q, r } of this.cells) {
        if (distance(q, r, seat.q, seat.r) >= rad * 1.3) continue;
        const ridge = this.land.ridged((q - seat.q) * 0.09, (r - seat.r) * 0.09);
        const edge = Math.max(0, ridge - 0.72) * 10;
        if (edge > 0) this.setH(q, r, this.h(q, r) + edge);
      }
    }
  }

  /**
   * A river wandering down the board, widening into a lake partway. The wander
   * is two sines at different frequencies, which reads as a river rather than a
   * noise squiggle.
   */
  carveRiver() {
    const phase1 = this.rng.range(0, Math.PI * 2);
    const freq1 = this.rng.range(0.08, 0.15);
    const amp1 = this.rng.range(this.radius * 0.25, this.radius * 0.45);
    const phase2 = this.rng.range(0, Math.PI * 2);
    const freq2 = this.rng.range(0.2, 0.4);
    const amp2 = this.rng.range(this.radius * 0.08, this.radius * 0.18);

    const lakeAt = this.rng.irange(-Math.floor(this.radius * 0.3), Math.floor(this.radius * 0.3));
    const lakeLen = this.rng.irange(7, 12);

    for (let r = -this.radius - 2; r <= this.radius + 2; r++) {
      const centre = Math.round(amp1 * Math.sin(r * freq1 + phase1) + amp2 * Math.sin(r * freq2 + phase2));
      this.riverQ.set(r, centre);

      const wobble = (this.land.noise(r * 0.1, 10.5) + 1) / 2;
      let width = 1 + Math.floor(wobble * 1.6);

      const inLake = r >= lakeAt && r < lakeAt + lakeLen;
      if (inLake) width += Math.floor(Math.sin(((r - lakeAt) / lakeLen) * Math.PI) * 5);

      for (let dq = -width; dq <= width; dq++) {
        const q = centre + dq;
        if (!this.inBoard(q, r)) continue;
        // The channel cuts to the bottom whatever it runs through, so a river
        // crossing high ground becomes a gorge. smoothShores then eases the lip.
        this.setH(q, r, 0);
        this.water.set(this.key(q, r), inLake && Math.abs(dq) < width - 1 ? 'water' : 'river');
      }
    }
  }

  /** Water sits at height 0, and its banks must not be sheer everywhere. */
  smoothShores() {
    for (const { q, r } of this.cells) {
      if (!this.water.has(this.key(q, r))) continue;
      for (const n of neighbors(q, r)) {
        if (!this.inBoard(n.q, n.r) || this.water.has(this.key(n.q, n.r))) continue;
        if (this.h(n.q, n.r) > 3) this.setH(n.q, n.r, 3);
      }
    }
  }

  // ------------------------------------------------------------ movement

  /** Is this column on the near bank — the side the player starts on? */
  nearBank(q, r) { return q < (this.riverQ.get(r) ?? 0); }

  /**
   * Can you step from one column to the next?
   *
   * `crossWater` separates the two kinds of barrier. A river is a *designed*
   * barrier: skill_map.md gates the far bank behind a bridge (woodworking 6) or
   * a boat (woodworking 5), so the generator must leave it uncrossable. A cliff
   * between two pieces of dry land is an *accidental* barrier thrown up by the
   * radial mountains, and has to be ramped. Ramp carving therefore asks with
   * crossWater on, so it spends its passes on cliffs instead of trying to build
   * a staircase across the river.
   */
  canStep(fromQ, fromR, toQ, toR, crossWater = false) {
    if (!this.inBoard(toQ, toR)) return false;
    if (!crossWater && this.water.has(this.key(toQ, toR))) return false;
    const climb = this.h(toQ, toR) - this.h(fromQ, fromR);
    return climb <= 1 && climb >= -2;
  }

  reachableFrom(start, crossWater = false) {
    const seen = new Set([this.key(start.q, start.r)]);
    const queue = [start];
    while (queue.length) {
      const cur = queue.shift();
      for (const n of neighbors(cur.q, cur.r)) {
        const k = this.key(n.q, n.r);
        if (seen.has(k)) continue;
        if (!this.canStep(cur.q, cur.r, n.q, n.r, crossWater)) continue;
        seen.add(k);
        queue.push(n);
      }
    }
    return seen;
  }

  /** Open, low, dry ground near the middle of the near bank. */
  chooseSpawn() {
    const candidates = this.cells
      .filter(c => !this.water.has(this.key(c.q, c.r))
        && this.h(c.q, c.r) <= 2
        && this.nearBank(c.q, c.r))
      .sort((a, b) => distance(a.q, a.r, 0, 0) - distance(b.q, b.r, 0, 0));
    this.spawn = candidates[0]
      || this.cells.find(c => !this.water.has(this.key(c.q, c.r)))
      || { q: 0, r: 0 };
  }

  /**
   * Mountains generated as radial bumps produce plateaus ringed by sheer walls,
   * and a plateau you cannot climb is scenery, not terrain. Carve a staircase up
   * to each sizeable marooned region so every part of the land is walkable —
   * without flattening the cliffs, which are what mining is for.
   */
  connectByRamps(maxRamps = 40) {
    for (let pass = 0; pass < maxRamps; pass++) {
      const reachable = this.reachableFrom(this.spawn, true);

      // Group the unreachable dry land into regions and take the largest.
      const stranded = this.cells.filter(c =>
        !reachable.has(this.key(c.q, c.r)) && !this.water.has(this.key(c.q, c.r)));
      if (!stranded.length) return;

      const region = this.floodRegion(stranded[0], reachable);
      if (region.length < 6) {
        // Too small to be worth a ramp; flatten it into its surroundings.
        for (const c of region) this.levelInto(c, reachable);
        continue;
      }

      if (!this.carveRamp(region, reachable)) return;
    }
  }

  /** All stranded land connected to `seed`, ignoring the height rules. */
  floodRegion(seed, reachable) {
    const out = [];
    const seen = new Set([this.key(seed.q, seed.r)]);
    const queue = [seed];
    while (queue.length) {
      const cur = queue.shift();
      out.push(cur);
      for (const n of neighbors(cur.q, cur.r)) {
        const k = this.key(n.q, n.r);
        if (seen.has(k) || !this.inBoard(n.q, n.r)) continue;
        if (reachable.has(k) || this.water.has(k)) continue;
        seen.add(k);
        queue.push(n);
      }
    }
    return out;
  }

  levelInto(cell, reachable) {
    for (const n of neighbors(cell.q, cell.r)) {
      if (reachable.has(this.key(n.q, n.r))) {
        this.setH(cell.q, cell.r, this.h(n.q, n.r));
        return;
      }
    }
  }

  /**
   * Find where the stranded region comes closest to reachable ground and cut a
   * one-level-per-hex staircase inwards from there.
   */
  carveRamp(region, reachable) {
    let best = null;
    for (const c of region) {
      for (const n of neighbors(c.q, c.r)) {
        if (!reachable.has(this.key(n.q, n.r))) continue;
        const gap = Math.abs(this.h(c.q, c.r) - this.h(n.q, n.r));
        if (!best || gap < best.gap) best = { inner: c, outer: n, gap };
      }
    }
    if (!best) return false;

    // Walk into the region, raising each step by one from the outer height.
    const inRegion = new Set(region.map(c => this.key(c.q, c.r)));
    let cur = best.inner;
    let level = this.h(best.outer.q, best.outer.r);
    const walked = new Set();

    for (let step = 0; step < this.maxHeight * 2; step++) {
      const k = this.key(cur.q, cur.r);
      if (walked.has(k)) break;
      walked.add(k);

      const natural = this.h(cur.q, cur.r);
      level = Math.min(level + 1, natural);
      this.setH(cur.q, cur.r, level);
      if (level >= natural) break;

      // Continue towards the higher ground the ramp is climbing to.
      const next = neighbors(cur.q, cur.r)
        .filter(n => inRegion.has(this.key(n.q, n.r)) && !walked.has(this.key(n.q, n.r)))
        .sort((a, b) => this.h(a.q, a.r) - this.h(b.q, b.r))[0];
      if (!next) break;
      cur = next;
    }
    return true;
  }

  // ------------------------------------------------------------- terrain

  /** Height and moisture decide which sheet a column draws from. */
  paintTerrain(map) {
    for (const { q, r } of this.cells) {
      const h = this.h(q, r);
      const kind = this.water.get(this.key(q, r));
      if (kind) {
        map.place(q, r, kind === 'water' ? 'water' : 'river', 0);
        continue;
      }

      const moisture = this.moist.fbm(q * 0.09 + 100, r * 0.09 - 50, 3);
      let terrain;
      if (h >= this.maxHeight - 2) terrain = 'stony';
      else if (h >= this.maxHeight - 4) terrain = moisture > 0.55 ? 'steppes' : 'stony';
      else if (h >= 2) terrain = moisture > 0.5 ? 'grass' : 'steppes';
      else terrain = moisture > 0.56 ? 'meadow' : 'grass';

      map.place(q, r, terrain, h);
    }
  }

  /**
   * Woods, thick on the far side of the river and scattered in patches on the
   * near side — the same split the old generator used to make the two banks feel
   * like different country. The wooded sheets carry their own trees, so a wooded
   * hex is one tile, not a base plus props.
   */
  growForests(map) {
    for (const { q, r } of this.cells) {
      const col = map.get(q, r);
      if (!col || isWater(col.terrain) || col.h >= this.maxHeight - 2) continue;

      const far = q > (this.riverQ.get(r) ?? 0);
      const n = this.forest.fbm(q * 0.11, r * 0.11, 3);
      const threshold = far ? 0.44 : 0.58;
      if (n < threshold) continue;

      const pine = col.h >= 3 || n > 0.72;
      const dense = n > threshold + 0.035;
      const terrain = dense
        ? (pine ? 'pine_wood' : 'oak_wood')
        : (pine ? 'pine_floor' : 'forest_floor');

      map.place(q, r, terrain, col.h);
      if (dense) {
        map.get(q, r).feature = { type: 'trees', kind: pine ? 'pine' : 'oak', remaining: this.rng.irange(2, 5) };
      }
    }
  }

  /** Villages want flat, dry, open ground, and space between them. */
  placeVillages(map) {
    const flat = (q, r) => neighbors(q, r).every(n => {
      const col = map.get(n.q, n.r);
      return col && !isWater(col.terrain) && Math.abs(col.h - map.heightAt(q, r)) <= 1;
    });

    const candidates = this.rng.shuffle(this.cells.filter(({ q, r }) => {
      const col = map.get(q, r);
      // Near bank only: the far side is gated behind a bridge or a boat, and a
      // village you cannot trade with for six woodworking levels is not a village.
      return col && !isWater(col.terrain) && !col.feature
        && col.h >= 1 && col.h <= 3 && this.nearBank(q, r) && flat(q, r);
    }));

    this.villages = [];
    const minGap = Math.max(6, Math.floor(this.radius * 0.32));
    for (const c of candidates) {
      if (this.villages.length >= this.opt.villages) break;
      if (this.villages.some(v => distance(v.q, v.r, c.q, c.r) < minGap)) continue;

      const col = map.place(c.q, c.r, 'meadow', map.heightAt(c.q, c.r));
      col.feature = {
        type: 'village',
        name: villageName(this.rng),
        rentableTools: [],
      };
      this.villages.push({ q: c.q, r: c.r });
    }
  }

  /**
   * Join the villages with paths. The road network is grown as a tree — each
   * village links to the nearest one already connected — because the path art
   * has no five-way junctions and only three of the fifteen four-ways, so a
   * denser network would spend most of its tiles on fallback sprites.
   */
  layRoads(map) {
    if (this.villages.length < 2) return;
    const connected = [this.villages[0]];
    const pending = this.villages.slice(1);

    while (pending.length) {
      let best = null;
      for (const p of pending) {
        for (const c of connected) {
          const d = distance(p.q, p.r, c.q, c.r);
          if (!best || d < best.d) best = { from: c, to: p, d };
        }
      }
      const route = this.walkRoute(best.from, best.to, map);
      for (const step of route) {
        const col = map.get(step.q, step.r);
        if (!col || isWater(col.terrain) || col.feature) continue;
        map.place(step.q, step.r, 'path', col.h);
      }
      connected.push(best.to);
      pending.splice(pending.indexOf(best.to), 1);
    }
  }

  /** Greedy walk downhill-ish towards a target, staying on walkable ground. */
  walkRoute(from, to, map) {
    const route = [];
    let cur = { q: from.q, r: from.r };
    const seen = new Set();

    for (let i = 0; i < this.radius * 6; i++) {
      route.push(cur);
      seen.add(this.key(cur.q, cur.r));
      if (cur.q === to.q && cur.r === to.r) break;

      const next = neighbors(cur.q, cur.r)
        .filter(n => {
          const col = map.get(n.q, n.r);
          return col && !isWater(col.terrain)
            && !seen.has(this.key(n.q, n.r))
            && Math.abs(col.h - map.heightAt(cur.q, cur.r)) <= 1;
        })
        .sort((a, b) => distance(a.q, a.r, to.q, to.r) - distance(b.q, b.r, to.q, to.r))[0];

      if (!next) break;
      cur = next;
    }
    return route;
  }

  /**
   * Ore veins. They exist in the map from the start but stay hidden until Mind 4
   * (Lore) — the single knowledge gate the whole economy hangs on. Each vein is
   * finite, and a world can legitimately generate with none, which locks
   * metalworking entirely. That is the intended scarcity, not a bug.
   */
  seedOre(map) {
    const stone = this.cells.filter(({ q, r }) => {
      const col = map.get(q, r);
      return col && col.terrain === 'stony' && !col.feature && col.h >= 3;
    });

    const count = Math.min(this.opt.oreVeins, stone.length);
    for (const c of this.rng.shuffle(stone).slice(0, count)) {
      map.get(c.q, c.r).feature = {
        type: 'ore',
        remaining: this.rng.irange(4, 12),
        known: false,          // revealed by mind:4
      };
    }
  }
}

// ---------------------------------------------------------------- helpers

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const NAME_A = ['Aln', 'Bram', 'Cald', 'Dun', 'Eal', 'Fen', 'Gars', 'Hol', 'Ket', 'Mor', 'Tor', 'Wyn'];
const NAME_B = ['bury', 'ford', 'hollow', 'mere', 'stead', 'thwaite', 'wick', 'combe', 'gate', 'holm'];
const villageName = rng => rng.pick(NAME_A) + rng.pick(NAME_B);

/**
 * Resolve the autotiled sets once the whole map exists — a shoreline cannot be
 * chosen until every neighbour is known.
 */
export function resolveAutotiles(map, resolvers) {
  if (!resolvers) return map;
  for (const col of map) {
    if (col.terrain === 'water') {
      const hit = resolvers.lake(map.landMask(col.q, col.r), col.q, col.r);
      col.sprite = hit.sprite;
      col.frame = hit.frame;
    } else if (col.terrain === 'path') {
      const hit = resolvers.path(map.pathMask(col.q, col.r));
      col.sprite = hit.sprite;
      col.frame = hit.frame;
    } else if (col.terrain === 'river') {
      const v = variantFor('river', col.q, col.r);
      col.sprite = v.sprite;
      col.frame = v.frame;
    }
  }
  return map;
}
