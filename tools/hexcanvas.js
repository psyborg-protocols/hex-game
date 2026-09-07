// hexcanvas.js — 32x37 pointy-top hex tile canvas with lattice-aware drawing.
//
// GEOMETRY
// The tile is a pointy-top hexagon 32px wide and 37px tall. Its left-edge inset
// per row steps 2,2,1,2,2,1,2,2 — a palindromic staircase averaging 1.75 px/row,
// against the 1.732 (= 2/sqrt3) a regular hexagon wants. Width/height is
// 32/37 = 0.8649 where a regular hexagon is 0.8660, so the shape is regular to
// within a pixel, and the staircase is symmetric enough to read as a clean edge.
//
// The palindrome is not cosmetic — it is what makes the hexagons interlock. With
// insets a[1..m] the meshing condition is a[u] + a[m+1-u] = W/2 for every u, which
// this profile satisfies exactly (every pair sums to 16). Consequence: one hex
// covers 896 px and the lattice cell is 32*28 = 896 px, so the plane is covered
// with no gaps and no overlaps. `tools/tile_preview.js --verify` proves it by
// brute force.
//
// LATTICE
// A hex at grid position (i, j) sits at i*V1 + j*V2. In row/column terms that is
// column step 32, row step 28, odd rows shifted right by 16.
//
// SEAMLESSNESS
// Every drawing call goes through fold(), which maps a point outside the hexagon
// back to the equivalent point inside it. A cluster drawn across the border
// therefore reappears on the far side exactly where the neighbouring tile would
// continue it, so texture flows unbroken across a field of identical tiles.

export const HEX_W = 32;
export const HEX_H = 37;

// left inset per row: 9-row cap, 19 full-width rows, 9-row cap (mirrored)
const CAP = [15, 13, 11, 10, 8, 6, 5, 3, 1];
export const INSET = [...CAP, ...Array(19).fill(0), ...CAP.slice().reverse()];

export const V1 = [32, 0];   // one hex to the right
export const V2 = [16, 28];  // one hex down-right

export function inHex(x, y) {
  if (y < 0 || y >= HEX_H) return false;
  const a = INSET[y];
  return x >= a && x < HEX_W - a;
}

// Map any point to the equivalent pixel inside the base hex (null if unreachable).
export function fold(x, y) {
  x = Math.round(x); y = Math.round(y);
  if (inHex(x, y)) return [x, y];
  for (let j = -2; j <= 2; j++)
    for (let i = -2; i <= 2; i++) {
      if (!i && !j) continue;
      const fx = x - i * V1[0] - j * V2[0];
      const fy = y - i * V1[1] - j * V2[1];
      if (inHex(fx, fy)) return [fx, fy];
    }
  return null;
}

// Distance between two points measured on the hex torus, so clusters near the
// border keep their spacing from the copies that wrap around.
export function latticeDist(ax, ay, bx, by) {
  let best = Infinity;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const dx = ax - (bx + i * V1[0] + j * V2[0]);
      const dy = ay - (by + i * V1[1] + j * V2[1]);
      best = Math.min(best, Math.hypot(dx, dy));
    }
  return best;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Reciprocal lattice vectors: K1.V1 = 1, K1.V2 = 0, etc. Any cosine built on
// integer combinations of these is exactly periodic under the hex lattice, so
// the low-frequency value field wraps perfectly.
const DET = V1[0] * V2[1] - V1[1] * V2[0]; // 896
const K1 = [V2[1] / DET, -V2[0] / DET];
const K2 = [-V1[1] / DET, V1[0] / DET];

// Smooth lattice-periodic noise in roughly [-1, 1].
export const SOFT = [[1, 0], [0, 1], [1, 1], [1, -1], [2, 0], [0, 2], [2, 1], [1, 2]];
export const FINE = [[2, 1], [1, 2], [3, 0], [0, 3], [2, -2], [3, 1], [1, 3], [3, -2]];

export function makeNoise(rnd, harmonics = SOFT) {
  const terms = harmonics.map(([m, n]) => ({
    kx: m * K1[0] + n * K2[0],
    ky: m * K1[1] + n * K2[1],
    amp: 1 / Math.hypot(m, n),
    phase: rnd() * Math.PI * 2,
  }));
  const norm = terms.reduce((s, t) => s + t.amp, 0);
  return (x, y) => {
    let v = 0;
    for (const t of terms) v += t.amp * Math.cos(2 * Math.PI * (t.kx * x + t.ky * y) + t.phase);
    return v / norm;
  };
}

// broad shape plus a fine term, so patch edges come out ragged and organic
export function terrainField(rnd, fineWeight = 0.45) {
  const soft = makeNoise(rnd, SOFT), fine = makeNoise(rnd, FINE);
  return (x, y) => soft(x, y) + fineWeight * fine(x, y);
}

export class H {
  constructor(seed = 1) {
    this.g = Array.from({ length: HEX_H }, () => Array(HEX_W).fill(null));
    this.rnd = mulberry32(seed);
    this.noise = makeNoise(this.rnd);
  }
  px(x, y, c) {
    if (!c) return;
    const f = fold(x, y);
    if (f) this.g[f[1]][f[0]] = c;
  }
  rect(x, y, w, h, c) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.px(x + i, y + j, c);
  }
  hline(x, y, len, c) { this.rect(x, y, len, 1, c); }
  vline(x, y, len, c) { this.rect(x, y, 1, len, c); }
  fill(c) {
    for (let y = 0; y < HEX_H; y++)
      for (let x = INSET[y]; x < HEX_W - INSET[y]; x++) this.g[y][x] = c;
  }
  // Paint the highest (dir > 0) or lowest (dir < 0) `frac` of a value field.
  // Working in quantiles rather than raw thresholds means coverage is exact and
  // predictable, which is how the value range per tile is kept compressed.
  patch(fn, frac, dir, c) {
    const vals = [];
    for (let y = 0; y < HEX_H; y++)
      for (let x = INSET[y]; x < HEX_W - INSET[y]; x++) vals.push(fn(x, y));
    vals.sort((a, b) => a - b);
    const i = dir > 0 ? Math.floor((1 - frac) * vals.length) : Math.floor(frac * vals.length);
    const th = vals[Math.max(0, Math.min(vals.length - 1, i))];
    for (let y = 0; y < HEX_H; y++)
      for (let x = INSET[y]; x < HEX_W - INSET[y]; x++) {
        const v = fn(x, y);
        if (dir > 0 ? v >= th : v <= th) this.g[y][x] = c;
      }
  }
  // 1px inner border, so the hex grid stays faintly readable when tiled.
  // Drawn in the terrain's own shade tone rather than ink — a black rim would
  // darken the ground and turn the map into a board game grid.
  // `density` dithers it: 1 is a solid line, 0.5 lays it on every other pixel,
  // which reads as a faint crease rather than a drawn border.
  rim(c, density = 0.5) {
    for (let y = 0; y < HEX_H; y++)
      for (let x = INSET[y]; x < HEX_W - INSET[y]; x++) {
        if (inHex(x - 1, y) && inHex(x + 1, y) && inHex(x, y - 1) && inHex(x, y + 1)) continue;
        if (density >= 1 || (x + y) % 2 === 0) this.g[y][x] = c;
      }
  }
  blob(cx, cy, r, c) {
    const rr = r * r + (r >> 1);
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++)
        if (dx * dx + dy * dy <= rr) this.px(cx + dx, cy + dy, c);
  }
  // short 1px stroke — the unit of texture; never place a lone pixel
  dash(x, y, dx, dy, len, c) {
    for (let i = 0; i < len; i++) this.px(x + Math.round(dx * i), y + Math.round(dy * i), c);
  }
  // Poisson-ish placement: n points inside the hex, no two closer than minDist
  // measured across the wrap, so nothing clumps at the seam.
  scatter(n, minDist, tries = 4000) {
    const pts = [];
    for (let t = 0; t < tries && pts.length < n; t++) {
      const x = Math.floor(this.rnd() * HEX_W);
      const y = Math.floor(this.rnd() * HEX_H);
      if (!inHex(x, y)) continue;
      if (pts.every(([px, py]) => latticeDist(x, y, px, py) >= minDist)) pts.push([x, y]);
    }
    return pts;
  }
  // Natural distributions clump; even spacing reads as regular and man-made.
  // This picks a few anchors and gathers points around each, leaving open ground
  // between — the islands of detail that make terrain look grown rather than
  // sprinkled. Points fold, so a clump straddling the border wraps correctly.
  clumped(anchors, perAnchor, spread, minDist) {
    const out = [];
    for (const [ax, ay] of this.scatter(anchors, spread * 1.6)) {
      for (let k = 0; k < perAnchor; k++) {
        for (let t = 0; t < 40; t++) {
          const f = fold(Math.round(ax + (this.rnd() * 2 - 1) * spread),
                         Math.round(ay + (this.rnd() * 2 - 1) * spread));
          if (!f) continue;
          if (out.every(([px, py]) => latticeDist(f[0], f[1], px, py) >= minDist)) { out.push(f); break; }
        }
      }
    }
    return out;
  }
  grid() {
    return this.g.map((row) => row.map((c) => c || '.').join(''));
  }
}

export function drawTile(fn, seed) {
  const h = new H(seed);
  fn(h);
  return h.grid();
}
