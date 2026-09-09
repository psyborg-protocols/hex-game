// newtiles_gen.js — generate new terrain sheets in the style of new_tiles/.
//
// METHOD
// Nothing here is drawn from scratch. Tiles_GrassBase1 frame 0 is used as a
// structural template: its 32x48 sprite is classified into WALL / RIM / INTERIOR,
// the wall is copied pixel-for-pixel, the rim is recoloured, and only the top
// face is retextured. Geometry, silhouette and wall shading therefore match the
// existing art exactly, by construction rather than by eye.
//
// PALETTES
// Every colour is either sampled from the existing sheets (rock greys from
// DecorNoTrees, soil from FarmingBase, sand from the path tiles, blues from
// LakeBase, greens from DecorPine) or interpolated between two of them. The
// crucial property copied from the original art is how TIGHT the ramps are:
// their grass base is rgb(162,183,46) and its mottle rgb(150,173,38), about 10
// luminance apart. Wide steps are what make area-mottling read as camouflage;
// narrow steps let it read as ground. Each terrain below keeps the same
// relationship as theirs — mottle ~-10, rim ~-19, detail ~-33 luminance.
//
// Usage: node tools/newtiles_gen.js [outdir]      (default: new_tiles_gen)
import { readPng } from './png_read.js';
import { encodePngRGBA } from './png_write.js';
import { mkdirSync, writeFileSync } from 'node:fs';

const SRC = 'new_tiles/Tiles_GrassBase1.png';
const FW = 32, FH = 48, FRAMES = 6;

// ---------------------------------------------------------------- template
const GRASS_BASE = [162, 183, 46];
const GRASS_RIM = [152, 164, 42];
const near = (a, b) => Math.abs(a[0] - b[0]) <= 6 && Math.abs(a[1] - b[1]) <= 6 && Math.abs(a[2] - b[2]) <= 6;

function loadTemplate() {
  const img = readPng(SRC);
  const kind = [], wall = [];
  for (let y = 0; y < FH; y++) {
    kind.push([]); wall.push([]);
    for (let x = 0; x < FW; x++) {
      const i = (y * img.width + x) * 4;
      const px = [img.data[i], img.data[i + 1], img.data[i + 2]];
      const a = img.data[i + 3];
      if (a === 0) { kind[y].push('empty'); wall[y].push(null); continue; }
      if (near(px, GRASS_BASE)) { kind[y].push('interior'); wall[y].push(null); }
      else if (near(px, GRASS_RIM)) { kind[y].push('rim'); wall[y].push(null); }
      else { kind[y].push('wall'); wall[y].push(px); }
    }
  }
  let wallMin = Infinity, wallMax = -Infinity;
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++)
    if (kind[y][x] === 'wall') { const L = LUM(wall[y][x]); if (L < wallMin) wallMin = L; if (L > wallMax) wallMax = L; }
  return { kind, wall, wallMin, wallMax };
}

// ---------------------------------------------------------------- wall re-hue
// The wall is re-coloured by LUMINANCE rather than by swapping four fixed tones.
// Each wall pixel's brightness is measured as a position within the original
// wall's range, then reproduced at the same relative position in the new ramp.
// That preserves the wall's entire shading structure — the lit front face, the
// darker sides, the outline, and the subtle per-pixel noise the artist left in
// it — while changing only its hue. Swapping four tones would have flattened it.
export const LUM = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
// pull a colour toward its own grey: "slightly muted"
const mute = (c, amount) => { const L = LUM(c); return c.map((v) => clamp(v + (L - v) * amount)); };
// restate a colour at a target luminance, blending to white or black as needed
function atLum(c, target) {
  const L = LUM(c);
  if (target >= L) { const t = (target - L) / Math.max(1, 255 - L); return c.map((v) => clamp(v + (255 - v) * t)); }
  const t = target / Math.max(1, L);
  return c.map((v) => clamp(v * t));
}

// ---------------------------------------------------------------- canvas
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Face {
  constructor(tpl, seed) {
    this.tpl = tpl;
    this.rnd = mulberry32(seed);
    this.px = Array.from({ length: FH }, () => Array(FW).fill(null));
  }
  // paint only inside the top face; the rim and wall are never overdrawn
  set(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= FW || y >= FH) return;
    if (this.tpl.kind[y][x] !== 'interior') return;
    this.px[y][x] = c;
  }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  dash(x, y, dx, dy, len, c) { for (let i = 0; i < len; i++) this.set(x + dx * i, y + dy * i, c); }
  // scattered points inside the face, no two closer than minDist
  scatter(n, minDist) {
    const pts = [];
    for (let t = 0; t < 3000 && pts.length < n; t++) {
      const x = Math.floor(this.rnd() * FW), y = Math.floor(this.rnd() * FH);
      if (this.tpl.kind[y] === undefined || this.tpl.kind[y][x] !== 'interior') continue;
      if (pts.every(([px, py]) => Math.hypot(px - x, py - y) >= minDist)) pts.push([x, y]);
    }
    return pts;
  }
  // Smooth value noise on a coarse grid. The original art mottles with LARGE
  // connected patches, not small clusters — it gets away with that because the
  // tones are only ~10 luminance apart. A noise field reproduces that shape.
  noise(scale) {
    const N = Math.ceil(FW / scale) + 3, M = Math.ceil(FH / scale) + 3;
    const g = Array.from({ length: M }, () => Array.from({ length: N }, () => this.rnd()));
    const sm = (t) => t * t * (3 - 2 * t);
    return (x, y) => {
      const fx = x / scale, fy = y / scale;
      const i = Math.min(N - 2, Math.floor(fx)), j = Math.min(M - 2, Math.floor(fy));
      const tx = sm(fx - i), ty = sm(fy - j);
      const a = g[j][i] * (1 - tx) + g[j][i + 1] * tx;
      const b = g[j + 1][i] * (1 - tx) + g[j + 1][i + 1] * tx;
      return a * (1 - ty) + b * ty;
    };
  }
  // paint the top `coverage` fraction of the face, so density is exact
  mottle(coverage, c, scale = 7) {
    if (coverage <= 0) return;
    const broad = this.noise(scale), fine = this.noise(2.5);
    const fn = (x, y) => broad(x, y) + 0.35 * fine(x, y);
    const vals = [];
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++)
      if (this.tpl.kind[y][x] === 'interior') vals.push(fn(x, y));
    vals.sort((a, b) => a - b);
    const th = vals[Math.floor((1 - coverage) * vals.length)];
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++)
      if (this.tpl.kind[y][x] === 'interior' && fn(x, y) >= th) this.px[y][x] = c;
  }
  // Stamp a small sprite given as rows of characters mapped to colours.
  // The original art draws every solid object with a dark outline right around
  // it — that outline is what makes a rock read as an object rather than a
  // smudge, so features here are authored as explicit little sprites.
  stamp(x, y, rows, map) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const c = map[row[i]];
        if (c) this.set(x + i, y + j, c);
      }
    });
  }
  // a chunky stone: lit cap, body, dark underside, contact shadow
  stone(x, y, light, mid, dark, shadow) {
    this.rect(x + 1, y - 1, 3, 1, light);
    this.rect(x, y, 5, 1, mid);
    this.rect(x, y + 1, 5, 1, dark);
    this.rect(x + 1, y + 2, 4, 1, shadow);
  }
  // irregular low-contrast patch, the unit of mottling
  patch(x, y, c, size = 4) {
    const cells = [[0, 0]];
    let cx = x, cy = y;
    for (let i = 0; i < size; i++) {
      cx += Math.round(this.rnd() * 2 - 1); cy += Math.round(this.rnd() * 2 - 1);
      cells.push([cx - x, cy - y]);
    }
    for (const [dx, dy] of cells) { this.set(x + dx, y + dy, c); this.set(x + dx + 1, y + dy, c); }
  }
}

// ---------------------------------------------------------------- terrains
// Tone order per terrain: base, mottle (~-10 luminance), rim (~-19), detail
// (~-33) — the same spacing the original grass tile uses. `d` is the frame
// index 0..5, doubling as the detail level: frame 0 is nearly plain, like theirs.
const MOTTLE_COVER = [0, 0.12, 0.20, 0.28, 0.36, 0.24];

// Feature sprites. O = outline, L = lit top, B = body, S = shade, and terrain
// specific letters below. Every solid object carries a full dark outline, which
// is how the original art separates an object from the ground.
const ROCK_BIG = [
  '...OOOO...',
  '..OLLLLO..',
  '.OLBBBBLO.',
  'OBBBBBBBBO',
  'OSBBBBBBSO',
  '.OSSSSSSO.',
  '..OOOOOO..',
];
const ROCK_SMALL = [
  '..OOO..',
  '.OLLLO.',
  'OBBBBBO',
  'OSSBSSO',
  '.OOOOO.',
];
const CONE = [
  '.OOO.',
  'OLBLO',
  'OBLBO',
  'OLBLO',
  '.OOO.',
];
const MUSHROOM = [
  '.OOO.',
  'OCCCO',
  '.OSO.',
  '..O..',
];

const TERRAINS = {
  steppes: {
    base: [200, 182, 92], mottle: [188, 168, 80], detail: [168, 146, 68], rim: [178, 158, 74],
    wall: { from: [196, 154, 88], mute: 0.22, top: -2, range: 68 },
    green: [139, 162, 42], stoneO: [96, 100, 121], stoneL: [161, 166, 195],
    stoneB: [150, 156, 188], stoneS: [136, 133, 166],
    draw(f, d) {
      f.mottle(MOTTLE_COVER[d], this.mottle, 8);
      // dry tussocks: a small fan of blades with a shaded root
      for (const [x, y] of f.scatter(1 + d * 2, 6)) {
        f.set(x, y + 1, this.detail); f.set(x + 1, y + 1, this.detail);
        f.dash(x, y, -0.4, -1, 3, this.detail);
        f.dash(x + 1, y, 0, -1, 4, this.detail);
        f.dash(x + 2, y, 0.4, -1, 3, this.detail);
      }
      // the odd clump still holding green
      for (const [x, y] of f.scatter(d > 2 ? 2 : 1, 9)) {
        f.dash(x, y, 0, -1, 3, this.green);
        f.dash(x + 1, y, 0.4, -1, 2, this.green);
        f.set(x, y + 1, this.detail);
      }
      for (const [x, y] of f.scatter(d, 8)) f.dash(x, y, 1, 0, 4, this.detail);   // cracked ground
      if (d > 2) for (const [x, y] of f.scatter(1, 10))
        f.stamp(x, y, ROCK_SMALL, { O: this.stoneO, L: this.stoneL, B: this.stoneB, S: this.stoneS });
    },
  },

  stony: {
    // the ground is pitched darker than the rock body so the boulders read
    base: [138, 142, 168], mottle: [128, 132, 158], detail: [108, 112, 138], rim: [120, 124, 150],
    wall: { from: [146, 150, 178], mute: 0.20, top: 10, range: 74 },
    O: [96, 100, 121], L: [161, 166, 195], B: [150, 156, 188], S: [136, 133, 166],
    moss: [139, 162, 42],
    draw(f, d) {
      f.mottle(MOTTLE_COVER[d], this.mottle, 8);
      const map = { O: this.O, L: this.L, B: this.B, S: this.S };
      if (d > 1) for (const [x, y] of f.scatter(d > 3 ? 2 : 1, 12)) f.stamp(x, y, ROCK_BIG, map);
      for (const [x, y] of f.scatter(1 + Math.floor(d / 2), 9)) f.stamp(x, y, ROCK_SMALL, map);
      for (const [x, y] of f.scatter(Math.floor(d / 2), 7)) {   // loose gravel
        f.rect(x, y, 2, 1, this.L); f.rect(x, y + 1, 2, 1, this.O);
      }
      for (const [x, y] of f.scatter(d, 7)) f.dash(x, y, 1, 1, 4, this.O);        // cracks
      if (d > 2) for (const [x, y] of f.scatter(1, 10)) {                          // lichen
        f.rect(x, y, 3, 1, this.moss); f.rect(x + 1, y + 1, 2, 1, [122, 133, 43]);
      }
    },
  },

  forest_floor: {
    base: [163, 116, 70], mottle: [150, 106, 64], detail: [124, 86, 52], rim: [138, 97, 59],
    wall: { from: [174, 124, 78], mute: 0.24, top: 20, range: 68 },
    gold: [206, 152, 80], rust: [180, 110, 62], twig: [112, 59, 31], moss: [139, 162, 42],
    draw(f, d) {
      f.mottle(MOTTLE_COVER[d], this.mottle, 8);
      // fallen leaves: a blade with a vein and a shaded lower edge
      for (const [x, y] of f.scatter(1 + d * 2, 5)) {
        const c = f.rnd() < 0.5 ? this.gold : this.rust;
        f.stamp(x, y, ['.CC.', 'CCCC', '.SS.'], { C: c, S: this.detail });
      }
      for (const [x, y] of f.scatter(d, 8)) {          // twigs
        f.dash(x, y, 1, 0.34, 5, this.twig);
        f.dash(x + 1, y + 1, 1, 0.34, 3, this.detail);
      }
      if (d > 1) for (const [x, y] of f.scatter(1, 9)) {                           // moss cushion
        f.rect(x + 1, y, 3, 1, this.moss);
        f.rect(x, y + 1, 5, 1, this.moss);
        f.rect(x + 1, y + 2, 3, 1, [122, 133, 43]);
      }
      if (d > 3) for (const [x, y] of f.scatter(1, 10))                            // fungi
        f.stamp(x, y, MUSHROOM, { O: this.twig, C: [225, 230, 240], S: this.gold });
    },
  },

  pine_floor: {
    base: [128, 88, 56], mottle: [118, 80, 50], detail: [96, 63, 40], rim: [108, 73, 45],
    wall: { from: [152, 108, 70], mute: 0.24, top: 28, range: 66 },
    needle: [168, 112, 58], green: [105, 115, 28], coneO: [70, 40, 22],
    coneL: [140, 96, 58], coneB: [104, 68, 40],
    draw(f, d) {
      f.mottle(MOTTLE_COVER[d], this.mottle, 8);
      // needle litter: fine strokes lying every which way
      for (const [x, y] of f.scatter(4 + d * 3, 4)) {
        const s = f.rnd() < 0.5 ? 1 : -1;
        f.dash(x, y, s, 0.5, 3, f.rnd() < 0.4 ? this.needle : this.detail);
      }
      for (const [x, y] of f.scatter(1 + d, 6)) {      // green sprigs
        const s = f.rnd() < 0.5 ? 1 : -1;
        f.dash(x, y, s, -0.5, 3, this.green);
        f.dash(x + s, y, s, -0.5, 2, this.green);
      }
      if (d > 1) for (const [x, y] of f.scatter(1 + (d > 3 ? 1 : 0), 9))           // cones
        f.stamp(x, y, CONE, { O: this.coneO, L: this.coneL, B: this.coneB });
      if (d > 3) for (const [x, y] of f.scatter(1, 10))                            // fungi
        f.stamp(x, y, MUSHROOM, { O: this.coneO, C: [196, 90, 70], S: [206, 152, 80] });
    },
  },

  flowing_water: {
    // water has no rim in the original lake tiles, and ripples are 1px light
    // horizontal dashes — both idioms are copied here
    // pitched lighter and more turquoise than the still lake water, so a stream
    // reads as shallow and moving where it meets a lake rather than merging into it
    base: [151, 180, 242], mottle: [139, 168, 232], detail: [126, 153, 222], rim: null,
    wall: { from: [136, 156, 190], mute: 0.22, top: -14, range: 70 },
    ripple: [172, 200, 250], foam: [232, 240, 255],
    O: [96, 100, 121], L: [161, 166, 195], B: [150, 156, 188], S: [136, 133, 166],
    draw(f, d) {
      f.mottle(MOTTLE_COVER[d] * 0.8, this.mottle, 9);
      // longer, strictly horizontal streaks read as flow rather than as chop
      for (const [x, y] of f.scatter(7 + d * 3, 4)) f.rect(x, y, 4 + Math.floor(f.rnd() * 4), 1, this.ripple);
      for (const [x, y] of f.scatter(3 + d * 2, 5)) f.rect(x, y, 5 + Math.floor(f.rnd() * 4), 1, this.detail);
      for (const [x, y] of f.scatter(2 + d, 6)) {      // a brighter crest with its shadow under it
        const len = 4 + Math.floor(f.rnd() * 3);
        f.rect(x, y, len, 1, this.foam);
        f.rect(x + 1, y + 1, len - 1, 1, this.detail);
      }
      // stones breaking the surface, foam gathered against them
      for (const [x, y] of f.scatter(d > 1 ? 2 : 1, 9)) {
        f.stamp(x, y, ROCK_SMALL, { O: this.O, L: this.L, B: this.B, S: this.S });
        f.rect(x - 1, y + 4, 6, 1, this.foam);
        f.set(x - 1, y + 1, this.foam); f.set(x - 1, y + 2, this.foam);
      }
      for (const [x, y] of f.scatter(1 + d, 6)) f.rect(x, y, 2, 1, this.foam);
    },
  },
};

// ---------------------------------------------------------------- build
// Build one wall pixel: same relative brightness, new hue.
// spec.wall = { from, mute, top, range } — from defaults to the terrain base,
// top is how far the brightest wall pixel sits above the top-face base (the
// original art puts its sunlit front face slightly brighter than the top), and
// range is the wall's luminance spread, compressed a little to mute it.
const wallCache = new Map();
function wallColour(tpl, spec, orig) {
  const w = spec.wall || {};
  const key = spec.base.join(',') + '|' + orig.join(',');
  if (wallCache.has(key)) return wallCache.get(key);
  const from = mute(w.from || spec.base, w.mute ?? 0.34);
  const top = LUM(spec.base) + (w.top ?? 10);
  const range = w.range ?? 66;
  const t = (LUM(orig) - tpl.wallMin) / Math.max(1, tpl.wallMax - tpl.wallMin);
  const c = atLum(from, top - (1 - t) * range);
  wallCache.set(key, c);
  return c;
}

function buildSheet(tpl, name, spec) {
  const rgba = Buffer.alloc(FW * FRAMES * FH * 4);
  for (let fi = 0; fi < FRAMES; fi++) {
    const f = new Face(tpl, 1000 + fi * 7919 + name.length * 31);
    spec.draw(f, fi);                       // fi doubles as the detail level 0..5
    for (let y = 0; y < FH; y++)
      for (let x = 0; x < FW; x++) {
        const k = tpl.kind[y][x];
        let c = null;
        if (k === 'wall') c = wallColour(tpl, spec, tpl.wall[y][x]);
        else if (k === 'rim') c = spec.rim || spec.base;   // water has no rim
        else if (k === 'interior') c = f.px[y][x] || spec.base;
        const o = (y * FW * FRAMES + fi * FW + x) * 4;
        if (c) { rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2]; rgba[o + 3] = 255; }
      }
  }
  return encodePngRGBA(FW * FRAMES, FH, rgba);
}

const outDir = process.argv[2] || 'new_tiles_gen';
mkdirSync(outDir, { recursive: true });
const tpl = loadTemplate();
const counts = tpl.kind.flat().reduce((m, k) => (m[k] = (m[k] || 0) + 1, m), {});
console.log(`template from ${SRC}: ${counts.interior} interior, ${counts.rim} rim, ${counts.wall} wall px`);
for (const [name, spec] of Object.entries(TERRAINS)) {
  const file = `${outDir}/Tiles_${name.replace(/(^|_)(\w)/g, (_, __, c) => c.toUpperCase())}.png`;
  writeFileSync(file, buildSheet(tpl, name, spec));
  console.log(`  wrote ${file}`);
}
