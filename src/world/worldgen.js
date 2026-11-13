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
import { distance, neighbors, neighbor } from './hexgrid.js';
import { findPath, isOpenWater } from './pathfinding.js';
import { WorldMap } from './mapformat.js';
import { variantFor, isWater } from './tileset.js';

export const DEFAULTS = {
  seed: 'hexworld',
  radius: 26,          // board radius in hexes
  maxHeight: 20,       // what a mountain may reach, as in the old three.js world
  baseHeight: 5,       // ceiling of the rolling country you actually walk around
  rampCeiling: 7,      // stranded ground at or under this gets a ramp; above it is ladder country
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
    this.baseHeight = opt.baseHeight;
    this.rampCeiling = opt.rampCeiling;

    // Where the ground stops being green. Both are derived from maxHeight so
    // that raising the ceiling moves the treeline and the scree with it.
    this.upland = Math.round(opt.maxHeight * 0.3);
    this.alpine = Math.round(opt.maxHeight * 0.55);

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
    this.addPondsAndStreams();
    this.smoothShores();
    this.chooseSpawn();
    this.connectByRamps();
    this.settleLedges();
    this.settleWater();

    const map = new WorldMap({ seed: this.opt.seed, name: `world ${this.opt.seed}` });
    this.paintTerrain(map);
    this.growForests(map);
    this.placeVillages(map);
    this.layRoads(map);
    this.seedOre(map);
    this.placeCamps(map);
    map.spawn = this.spawn;
    this.placeCrossings(map);
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
   * instead of running in noise-shaped blobs.
   *
   * This is capped at `baseHeight`, not `maxHeight`, and the difference is the
   * whole shape of the world. The old three.js generator did the same thing —
   * base terrain got 40% of the ceiling and the mountains got the rest — which
   * is why its worlds were rolling country with genuine 20-high massifs standing
   * out of them, rather than 20 levels of uniform noise nobody could cross.
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
      this.setH(q, r, e * this.baseHeight * clamp(rim, 0, 1));
    }
  }

  /** Radial bumps with ridged crests laid over them — the mineable high ground. */
  addMountains(count) {
    for (let i = 0; i < count; i++) {
      const seat = this.rng.pick(this.cells.filter(c =>
        distance(c.q, c.r, 0, 0) < this.radius * 0.75));
      if (!seat) continue;

      const peak = this.rng.irange(Math.ceil(this.maxHeight * 0.6), this.maxHeight);
      const rad = this.rng.irange(Math.floor(this.radius * 0.18), Math.floor(this.radius * 0.32));

      // A 20-level peak over six or seven hexes is a sheer thing, and meant to
      // be: its skirt is the wall you need a ladder for.
      for (const { q, r } of this.cells) {
        const d = distance(q, r, seat.q, seat.r);
        if (d >= rad) continue;
        const t = 1 - d / rad;
        this.setH(q, r, this.h(q, r) + peak * Math.pow(t, 1.25));
      }

      // Crests: only where the ridge is already strong, so they add spurs rather
      // than roughening the whole massif.
      for (const { q, r } of this.cells) {
        if (distance(q, r, seat.q, seat.r) >= rad * 1.3) continue;
        const ridge = this.land.ridged((q - seat.q) * 0.09, (r - seat.r) * 0.09);
        const edge = Math.max(0, ridge - 0.7) * 12;
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

  /**
   * Lakes out in the country, most of them with a stream running down to the
   * river.
   *
   * A lake sits at the level of the ground it is in, not at the bottom of the
   * world: its surface is the lowest point of the hollow it fills, and the ring
   * of ground around it is eased to within a step of the water. That ring is
   * the point. A river in its gorge has cliffs for banks; a lake has a shore,
   * and a shore is where reeds grow and clay is dug (harvests.js: waterside).
   * There are enough of them that one is always within a walk of the start.
   *
   * A lake is ordinary `water`, so it draws from the lake shoreline set — a
   * one-hex pond is exactly the enclosed piece, land on all six edges. A stream
   * is its own terrain, one hex wide, autotiled from which of its neighbours
   * are water, so it joins whatever it runs into. It leaves at the lake's level
   * and only ever steps down.
   *
   * Streams only ever hang off a lake and stop when they reach water. That keeps
   * them from fencing anything off: a chain that dead-ends, or that ends at the
   * river, can always be walked around at its head.
   */
  addPondsAndStreams() {
    const wantLakes = this.rng.irange(LAKES[0], LAKES[1]);
    const seats = [];
    const home = this.spawnSite();

    const dry = (q, r) => this.inBoard(q, r) && !this.water.has(this.key(q, r));
    // Low enough to hold water, clear of the river, and not touching any other
    // water: two bodies at different levels side by side would show a wall of
    // lake standing over the lower one.
    const holds = (q, r) => dry(q, r)
      && this.h(q, r) <= LAKE_CEILING
      && distance(q, r, home.q, home.r) > 2
      && Math.abs(q - (this.riverQ.get(r) ?? 0)) > 4
      && neighbors(q, r).every(n => !this.water.has(this.key(n.q, n.r)));
    const candidate = c => holds(c.q, c.r) && seats.every(p => distance(p.q, p.r, c.q, c.r) > 6);

    // The first lake is yours: a short walk from where you will start, on your
    // side of the river. The opening needs reeds before it needs anything, and
    // a world whose nearest shore is twenty hexes off has no opening.
    const homely = c => this.nearBank(c.q, c.r)
      && distance(c.q, c.r, home.q, home.r) >= 4 && distance(c.q, c.r, home.q, home.r) <= 7;

    for (let attempt = 0; attempt < 60 && seats.length < wantLakes; attempt++) {
      let open = this.cells.filter(candidate);
      if (!seats.length) {
        const near = open.filter(homely);
        if (near.length) open = near;
      }
      if (!open.length) break;
      const seat = this.rng.pick(open);
      seats.push(seat);

      // The lake: grown a hex at a time from the seat. A hex that touches more
      // of the lake is in the frontier more often, so it comes out as a rounded
      // body rather than a snake.
      const size = Math.max(seats.length === 1 ? 4 : 0, this.rng.irange(LAKE_SIZE[0], LAKE_SIZE[1]));
      const body = [seat];
      const bodyKeys = new Set([this.key(seat.q, seat.r)]);
      while (body.length < size) {
        const frontier = [];
        for (const c of body) {
          for (const n of neighbors(c.q, c.r)) {
            if (bodyKeys.has(this.key(n.q, n.r)) || !holds(n.q, n.r)) continue;
            if (Math.abs(this.h(n.q, n.r) - this.h(seat.q, seat.r)) > 2) continue;
            frontier.push(n);
          }
        }
        if (!frontier.length) break;
        const next = this.rng.pick(frontier);
        body.push(next);
        bodyKeys.add(this.key(next.q, next.r));
      }

      // Its shore, and the level it settles at: the lowest of the hollow.
      const ring = [];
      const ringKeys = new Set();
      for (const c of body) {
        for (const n of neighbors(c.q, c.r)) {
          const k = this.key(n.q, n.r);
          if (!this.inBoard(n.q, n.r) || bodyKeys.has(k) || ringKeys.has(k)) continue;
          ringKeys.add(k);
          ring.push(n);
        }
      }
      const level = Math.min(...body.map(c => this.h(c.q, c.r)), ...ring.map(c => this.h(c.q, c.r)));
      for (const c of body) {
        this.setH(c.q, c.r, level);
        this.water.set(this.key(c.q, c.r), 'water');
      }
      for (const c of ring) if (this.h(c.q, c.r) > level + 1) this.setH(c.q, c.r, level + 1);

      // The outflow heads for the river, preferring downhill, and never climbs.
      // It stops the moment it is beside water that is not its own lake, so the
      // last hex reads as a mouth. One lake in four is left with no outlet.
      if (this.rng.range(0, 1) < 0.25) continue;
      let cur = seat;
      let surface = level;
      for (let step = 0; step < 16; step++) {
        const around = neighbors(cur.q, cur.r).filter(n => this.inBoard(n.q, n.r));
        const met = around.some(n => {
          const k = this.key(n.q, n.r);
          return this.water.has(k) && !bodyKeys.has(k) && this.water.get(k) !== 'stream';
        });
        if (met) break;
        const open = around.filter(n => !this.water.has(this.key(n.q, n.r)));
        if (!open.length) break;
        // closing on the river counts for more than losing a little height, or
        // the channel wanders along a contour and never arrives
        const score = n => Math.abs(n.q - (this.riverQ.get(n.r) ?? 0)) * 3 + this.h(n.q, n.r);
        const next = open.reduce((a, b) => (score(b) < score(a) ? b : a));
        if (score(next) >= score(cur) + 3) break;    // nowhere better to go
        surface = Math.min(surface, this.h(next.q, next.r));
        this.setH(next.q, next.r, surface);
        this.water.set(this.key(next.q, next.r), 'stream');
        cur = next;
      }
    }
  }

  /** A bank must not be sheer everywhere: nothing beside water stands more than three over it. */
  smoothShores() {
    for (const { q, r } of this.cells) {
      if (!this.water.has(this.key(q, r))) continue;
      const top = this.h(q, r) + 3;
      for (const n of neighbors(q, r)) {
        if (!this.inBoard(n.q, n.r) || this.water.has(this.key(n.q, n.r))) continue;
        if (this.h(n.q, n.r) > top) this.setH(n.q, n.r, top);
      }
    }
  }

  /**
   * Water never stands above the ground beside it.
   *
   * The ramp carver runs after the lakes are laid and is free to cut a bank
   * down. Where it has, the lake comes down with it; a stream settles to the
   * lowest ground it touches. Run last, when the land has stopped moving.
   */
  settleWater() {
    const seen = new Set();
    for (const start of this.cells) {
      const k0 = this.key(start.q, start.r);
      if (this.water.get(k0) !== 'water' || seen.has(k0)) continue;
      const body = [];
      const queue = [start];
      seen.add(k0);
      let level = Infinity;
      while (queue.length) {
        const cur = queue.pop();
        body.push(cur);
        level = Math.min(level, this.h(cur.q, cur.r));
        for (const n of neighbors(cur.q, cur.r)) {
          if (!this.inBoard(n.q, n.r)) continue;
          const k = this.key(n.q, n.r);
          const kind = this.water.get(k);
          if (kind === 'water') { if (!seen.has(k)) { seen.add(k); queue.push(n); } }
          else level = Math.min(level, this.h(n.q, n.r));
        }
      }
      for (const c of body) this.setH(c.q, c.r, level);
    }
    for (const { q, r } of this.cells) {
      if (this.water.get(this.key(q, r)) !== 'stream') continue;
      let low = this.h(q, r);
      for (const n of neighbors(q, r)) {
        if (this.inBoard(n.q, n.r) && !this.water.has(this.key(n.q, n.r))) low = Math.min(low, this.h(n.q, n.r));
      }
      this.setH(q, r, low);
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
  chooseSpawn() { this.spawn = this.spawnSite(); }

  /**
   * Where you would start, as the land lies now: low ground on the near bank,
   * as close to the middle of the board as there is. Asked once before the
   * lakes are laid, so one can be put within reach, and again after.
   */
  spawnSite() {
    const candidates = this.cells
      .filter(c => !this.water.has(this.key(c.q, c.r))
        && this.h(c.q, c.r) <= 2
        && this.nearBank(c.q, c.r))
      .sort((a, b) => distance(a.q, a.r, 0, 0) - distance(b.q, b.r, 0, 0));
    return candidates[0]
      || this.cells.find(c => !this.water.has(this.key(c.q, c.r)))
      || { q: 0, r: 0 };
  }

  /**
   * Two kinds of barrier fall out of the mountains, and only one is a mistake.
   *
   * Low ground cut off by a step or two is an accident of the noise — had the
   * contour landed one hex over you would simply have walked around it — so it
   * gets a staircase. High ground ringed by a sheer face is the *point*: those
   * plateaus are ladder country (woodworking 4), and carving a way up would
   * throw away the reason to build one. So ramping stops at `rampCeiling` and
   * everything above it is left standing.
   */
  connectByRamps(maxRamps = 80) {
    // Pockets nothing can reach — ground ringed entirely by water, say — must
    // not stop the loop, or every region after them keeps its accidental wall.
    const abandoned = new Set();
    let reachable = this.reachableFrom(this.spawn, true);

    for (let pass = 0; pass < maxRamps; pass++) {
      const seed = this.cells.find(c => !reachable.has(this.key(c.q, c.r))
        && !this.water.has(this.key(c.q, c.r))
        && this.h(c.q, c.r) <= this.rampCeiling
        && !abandoned.has(this.key(c.q, c.r)));
      if (!seed) return;

      const region = this.floodRegion(seed, reachable);
      if (region.length < 6) {
        // Too small to be worth a staircase; settle it into its surroundings.
        for (const c of region) this.levelInto(c, reachable);
      } else {
        this.carveRamp(region, reachable);
      }

      // Judge the pass by whether it actually opened anything up. A region that
      // cannot be improved is abandoned rather than retried until the budget runs
      // out, which is what lets the loop reach the regions behind it.
      const after = this.reachableFrom(this.spawn, true);
      if (after.size <= reachable.size) {
        for (const c of region) abandoned.add(this.key(c.q, c.r));
      }
      reachable = after;
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

  /**
   * Settle a stray low cell onto whichever reachable neighbour it is already
   * closest to in height, so the ground it joins is the ground it looked like it
   * belonged to. Never touches anything above the ramp ceiling.
   */
  levelInto(cell, reachable) {
    const own = this.h(cell.q, cell.r);
    if (own > this.rampCeiling) return false;
    const best = neighbors(cell.q, cell.r)
      .filter(n => reachable.has(this.key(n.q, n.r)) && !this.water.has(this.key(n.q, n.r)))
      .sort((a, b) => Math.abs(this.h(a.q, a.r) - own) - Math.abs(this.h(b.q, b.r) - own))[0];
    if (!best) return false;
    this.setH(cell.q, cell.r, this.h(best.q, best.r));
    return true;
  }

  /**
   * A staircase can leave a ledge behind: one hex too high to be climbed from
   * the low ground and too far below the plateau to be dropped onto, so neither
   * side reaches it. They always have a reachable neighbour, which is what makes
   * them fixable — and what makes them not the deliberate kind of barrier.
   */
  settleLedges(limit = 200) {
    for (let pass = 0; pass < limit; pass++) {
      const reachable = this.reachableFrom(this.spawn, true);
      const ledge = this.cells.find(c => !reachable.has(this.key(c.q, c.r))
        && !this.water.has(this.key(c.q, c.r))
        && this.h(c.q, c.r) <= this.rampCeiling
        && neighbors(c.q, c.r).some(n => reachable.has(this.key(n.q, n.r))));
      if (!ledge || !this.levelInto(ledge, reachable)) return;
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
        // `kind` is already a terrain id: 'water', 'river' or 'stream'. The
        // river runs along the bottom of the world; a lake sits where it is.
        map.place(q, r, kind, h);
        continue;
      }

      // Bare stone is kept to the peaks. The cliff faces already read as rock
      // wherever the ground steps, so spreading stony tops as well turns the
      // whole map grey and leaves nowhere green to start.
      const moisture = this.moist.fbm(q * 0.09 + 100, r * 0.09 - 50, 3);
      let terrain;
      if (h >= this.alpine) terrain = 'stony';
      else if (h >= this.upland) terrain = moisture > 0.5 ? 'steppes' : 'stony';
      else if (h >= 2) terrain = moisture > 0.42 ? 'grass' : 'steppes';
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
      // Nothing grows above the treeline; the massifs stay bare rock.
      if (!col || isWater(col.terrain) || col.h >= this.upland) continue;

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
      // Both kinds of wood carry their trees. The dense sheets have them drawn
      // in; the bare floors get them stood on top from decor/ at draw time, so a
      // sparse wood reads as a wood rather than as ground somebody already
      // cleared. Felling either one down to nothing leaves the bare floor.
      map.get(q, r).feature = {
        type: 'trees',
        kind: pine ? 'pine' : 'oak',
        remaining: dense ? this.rng.irange(3, 5) : this.rng.irange(1, 2),
      };
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
    // One of each kind of village at most, in a seeded order, so a world with
    // five villages is missing one trade — sometimes the smiths. That is the
    // scarcity working, not a bug.
    const kinds = this.rng.shuffle(['farmers', 'woodcutters', 'masons', 'fishers', 'herbalists', 'smiths']);
    const minGap = Math.max(6, Math.floor(this.radius * 0.32));
    for (const c of candidates) {
      if (this.villages.length >= this.opt.villages) break;
      if (this.villages.some(v => distance(v.q, v.r, c.q, c.r) < minGap)) continue;

      const col = map.place(c.q, c.r, 'meadow', map.heightAt(c.q, c.r));
      col.feature = {
        type: 'village',
        name: villageName(this.rng),
        kind: kinds[this.villages.length % kinds.length],
      };
      this.villages.push({ q: c.q, r: c.r });
    }
  }

  /**
   * Join the villages with paths. The road network is grown as a tree: each
   * village in turn routes to the nearest point of the network built so far,
   * whether that is a village or a road tile, so later roads branch off earlier
   * ones instead of running beside them. A tree also suits the path art, which
   * has no five-way junctions and only three of the fifteen four-ways.
   *
   * A village with no walkable route to the network gets no road at all rather
   * than a partial one. (The old greedy walk painted wherever it wandered while stuck,
   * and a walk that may not revisit a tile spirals into a solid patch of path.)
   */
  layRoads(map) {
    if (this.villages.length < 2) return;
    const connected = [this.villages[0]];
    const pending = this.villages.slice(1);

    while (pending.length) {
      // The pending village nearest the network goes next.
      let best = null;
      for (const p of pending) {
        for (const c of connected) {
          const d = distance(p.q, p.r, c.q, c.r);
          if (!best || d < best.d) best = { p, d };
        }
      }
      pending.splice(pending.indexOf(best.p), 1);

      const route = this.routeToNetwork(best.p, connected, map) ?? [];
      for (const step of route) {
        const col = map.get(step.q, step.r);
        if (!col || isWater(col.terrain) || col.feature) continue;
        map.place(step.q, step.r, 'path', col.h);
      }
      // A cut-off village still joins as a destination, so a neighbour stranded
      // on the same plateau gets a road to it.
      connected.push(best.p);
    }
  }

  /**
   * Cheapest walkable route from a village to the network (any connected
   * village or existing road tile). Dijkstra rather than A*, because the goal is
   * a set of tiles, and the board is small enough that it costs nothing.
   *
   * The costs are what shape the roads:
   *   - noise on every tile, so a road winds instead of running ruler-straight;
   *   - a little extra for a change of level, so it follows the contours;
   *   - a stiff charge for a tile touching two or more road tiles. That is the
   *     one that keeps roads one tile wide. Without it a new road happily runs
   *     alongside an old one, and two adjacent rows of path autotile into a
   *     solid paved area.
   * Steps may climb or drop one level, so every road is walkable both ways.
   * @returns {Array<{q,r}>|null} from the village to the tile it joins, or null.
   */
  routeToNetwork(from, connected, map) {
    const isRoad = (q, r) => map.get(q, r)?.terrain === 'path';
    const isGoal = (q, r) => isRoad(q, r) || connected.some(c => c.q === q && c.r === r);
    const roadContacts = (q, r) => neighbors(q, r).filter(n => isRoad(n.q, n.r)).length;

    const startKey = this.key(from.q, from.r);
    const cost = new Map([[startKey, 0]]);
    const cameFrom = new Map();
    const open = [{ q: from.q, r: from.r, g: 0 }];

    while (open.length) {
      // A linear scan for the cheapest entry; a few hundred tiles at most.
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i].g < open[bi].g) bi = i;
      const cur = open[bi];
      open[bi] = open[open.length - 1];
      open.pop();

      const curKey = this.key(cur.q, cur.r);
      if (cur.g > cost.get(curKey)) continue;   // a stale entry
      if (curKey !== startKey && isGoal(cur.q, cur.r)) {
        const route = [{ q: cur.q, r: cur.r }];
        for (let k = curKey; cameFrom.has(k);) {
          k = cameFrom.get(k);
          const [q, r] = k.split(',').map(Number);
          route.push({ q, r });
        }
        return route.reverse();
      }

      const hereH = map.heightAt(cur.q, cur.r);
      for (const n of neighbors(cur.q, cur.r)) {
        const col = map.get(n.q, n.r);
        if (!col || isWater(col.terrain)) continue;
        const climb = Math.abs(col.h - hereH);
        if (climb > 1) continue;
        // Other villages are destinations, never something a road runs through.
        if (col.feature && !isGoal(n.q, n.r)) continue;

        let step = 1 + climb * 0.5
          + (this.land.noise(n.q * 0.35, n.r * 0.35, 7.3) + 1) * 0.6;
        if (!isRoad(n.q, n.r)) step += Math.max(0, roadContacts(n.q, n.r) - 1) * 4;

        const g = cur.g + step;
        const k = this.key(n.q, n.r);
        if (g < (cost.get(k) ?? Infinity)) {
          cost.set(k, g);
          cameFrom.set(k, curKey);
          open.push({ q: n.q, r: n.r, g });
        }
      }
    }
    return null;
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
        known: false,          // revealed by Lore (mind 3)
      };
    }
  }

  /**
   * Raider camps, on the far bank: the river is what keeps them off you, and the
   * boat or bridge you need to reach them is the same one that ends the game.
   * The one farthest from the spawn is the Warlord's hold.
   */
  placeCamps(map) {
    const want = this.opt.camps ?? 3;
    const ok = (c, strict) => {
      const col = map.get(c.q, c.r);
      if (!col || isWater(col.terrain) || col.terrain === 'path') return false;
      if (col.feature && col.feature.type !== 'trees') return false;
      if (col.h > this.upland) return false;
      if (strict && this.nearBank(c.q, c.r)) return false;
      if (distance(c.q, c.r, this.spawn.q, this.spawn.r) < 10) return false;
      return neighbors(c.q, c.r).filter(n => {
        const o = map.get(n.q, n.r);
        return o && !isWater(o.terrain) && Math.abs(o.h - col.h) <= 1;
      }).length >= 4;
    };
    let pool = this.cells.filter(c => ok(c, true));
    // A world whose far bank is a sliver still gets its camps: on the near side,
    // as far from you as they can be.
    if (pool.length < want * 4) pool = this.cells.filter(c => ok(c, false));
    // The far half of the candidates, in a seeded order: far from you, but not
    // all lined up along the rim of the world.
    const far = c => distance(c.q, c.r, this.spawn.q, this.spawn.r);
    const sorted = pool.slice().sort((a, b) => far(b) - far(a));
    pool = this.rng.shuffle(sorted.slice(0, Math.max(want * 6, Math.ceil(sorted.length * 0.5))));

    const camps = [];
    for (const c of pool) {
      if (camps.length >= want) break;
      if (camps.some(o => distance(o.q, o.r, c.q, c.r) < 7)) continue;
      if ((this.villages || []).some(v => distance(v.q, v.r, c.q, c.r) < 7)) continue;
      camps.push(c);
    }
    // The Warlord sits in the farthest of them.
    camps.sort((a, b) => far(b) - far(a));
    camps.forEach((c, i) => {
      const col = map.get(c.q, c.r);
      map.place(c.q, c.r, 'steppes', col.h);
      map.get(c.q, c.r).feature = {
        type: 'camp',
        boss: i === 0,
        name: i === 0 ? "The Warlord's Hold" : `${campName(this.rng)} Camp`,
        burned: false,
      };
    });
  }

  /**
   * Where the raiders cross the river.
   *
   * A war band used to pole its rafts over wherever the water happened to be,
   * so there was no approach to hold and nowhere worth putting a wall. Now the
   * river is closed to them except at a few crossings: narrow water between two
   * banks low enough to land on. That is what turns "they are coming" into
   * "they are coming *that way*". Your own bridges are crossings too, which is
   * the price of one.
   *
   * A crossing is a straight run of river hexes, each marked with a feature so
   * it saves with the map. They are for rafts: you still need a boat or a
   * bridge, and the far bank stays as gated as it was.
   *
   * Three are wanted, spread along the river. More are opened if a camp would
   * otherwise have no way to the near bank at all, and a world where even that
   * fails is left with the whole river open, as it used to be.
   */
  placeCrossings(map) {
    const step = (a, b) => { const d = b.h - a.h; return d <= 2 && d >= -2; };
    const spans = [];
    for (const c of this.cells) {
      const start = map.get(c.q, c.r);
      if (!start || isWater(start.terrain) || !this.nearBank(c.q, c.r)) continue;
      for (let e = 0; e < 6; e++) {
        const tiles = [];
        let cur = start, land = null;
        for (let i = 0; i <= CROSSING_SPAN; i++) {
          const n = neighbor(cur.q, cur.r, e);
          const col = map.get(n.q, n.r);
          if (!col || !step(cur, col)) break;
          if (isOpenWater(col.terrain)) { tiles.push(col); cur = col; continue; }
          if (!isWater(col.terrain)) land = col;
          break;
        }
        if (!land || !tiles.length || this.nearBank(land.q, land.r)) continue;
        spans.push({ start, land, tiles });
      }
    }
    if (!spans.length) return;

    // Narrowest first, in a seeded order among equals.
    const order = this.rng.shuffle(spans).sort((a, b) => a.tiles.length - b.tiles.length);
    const gap = Math.max(6, Math.floor(this.radius * 0.3));
    const chosen = [];
    const open = span => {
      chosen.push(span);
      for (const t of span.tiles) t.feature = { type: 'crossing' };
      map.crossings = null;
    };
    // Not on your doorstep: a band that lands beside the hearth has no approach
    // to defend, and the first night is over before you have seen it coming.
    const clear = span => distance(span.start.q, span.start.r, this.spawn.q, this.spawn.r) >= CROSSING_CLEAR;
    for (const span of order) {
      if (chosen.length >= CROSSINGS) break;
      if (!clear(span)) continue;
      if (chosen.some(o => distance(o.start.q, o.start.r, span.start.q, span.start.r) < gap)) continue;
      open(span);
    }

    const camps = [...map].filter(c => c.feature?.type === 'camp');
    const stranded = () => camps.filter(c => !findPath(map, c, this.spawn, { raider: true, limit: 8000 }));
    for (const span of order) {
      if (!stranded().length || chosen.length >= CROSSINGS * 3) break;
      if (!chosen.includes(span) && !span.tiles.some(t => t.feature)) open(span);
    }
    if (stranded().length) {
      for (const span of chosen) for (const t of span.tiles) delete t.feature;
      map.crossings = null;
    }
  }
}

/** How many lakes a world gets, and how many hexes each. */
const LAKES = [5, 8];
const LAKE_SIZE = [2, 8];

/** The highest ground a lake will sit in: the rolling country, not the hills. */
const LAKE_CEILING = 5;

/** How many places the raiders can cross the river. */
export const CROSSINGS = 3;

/** How far from where you start the nearest crossing may be. */
const CROSSING_CLEAR = 8;

/** The widest water a crossing spans. */
const CROSSING_SPAN = 4;

const CAMP_A = ['Ash', 'Black', 'Red', 'Bone', 'Crow', 'Wolf', 'Skull', 'Iron'];
const CAMP_B = ['fang', 'hand', 'tooth', 'brand', 'claw', 'scar'];
const campName = rng => rng.pick(CAMP_A) + rng.pick(CAMP_B);

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
    } else if (col.terrain === 'stream') {
      const hit = resolvers.stream(map.waterMask(col.q, col.r));
      col.sprite = hit.sprite;
      col.frame = hit.frame;
    } else if (col.terrain === 'river') {
      // The river autotiles off the same shoreline set as a lake, so it carries
      // banks rather than meeting the grass at a hard edge.
      const hit = resolvers.river(map.landMask(col.q, col.r), col.q, col.r);
      col.sprite = hit.sprite;
      col.frame = hit.frame;
    }
  }
  return map;
}
