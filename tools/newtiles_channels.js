// newtiles_channels.js — synthesise the missing path pieces, and a matching
// one-tile-wide stream set, in the style of new_tiles/.
//
// WHY SYNTHESIS AND NOT FLIPPING
// The existing path sheets already hold all six rotations of every shape they
// cover, so the set is closed under rotation; and the Left/Right branch sheets
// are already mirrors of each other, so it is closed under reflection too.
// Flipping therefore yields nothing new — every missing mask has to be built.
//
// METHOD
// A path arm is a constant-width band running from one edge to the middle of the
// tile. Tiles_PathsStraight holds three straights (N-S, NE-SW, SE-NW); splitting
// each in half through the centre gives six real arms, drawn by the artist. Any
// connection mask is then the union of its arms plus a small disc at the centre,
// which rounds dead ends and fills junctions.
//
// The band edges are rebuilt from that region rather than copied, because the
// union creates new borders the original art never had. The structure is read
// off the source: a path is fill, a 1px darker rim just inside the region, and a
// 1px dark-grass shadow just outside it where it cuts into the turf. A stream is
// the same three-band structure with the lake's colours — sandy shore outside,
// dark water inside, water in the middle — so a stream meeting a lake merges.
//
// Usage: node tools/newtiles_channels.js [outdir]     (default: new_tiles)
import { readPng } from './png_read.js';
import { encodePngRGBA } from './png_write.js';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';

const SRC = 'new_tiles';
const FW = 32, FH = 48, FRAMES = 6;
const FACE_TOP = 16, FACE_H = 24;
const CX = 15.5, CY = FACE_TOP + FACE_H / 2 - 0.5;   // centre of the top face

// Edge order, clockwise from the flat top — matches index.json's edgeOrder.
export const EDGES = ['N', 'NE', 'SE', 'S', 'SW', 'NW'];
// unit-ish direction from the tile centre out to each edge midpoint
const DIR = {
  N: [0, -1], NE: [0.85, -0.53], SE: [0.85, 0.53],
  S: [0, 1], SW: [-0.85, 0.53], NW: [-0.85, -0.53],
};

const near = (a, b, t = 8) => Math.abs(a[0] - b[0]) <= t && Math.abs(a[1] - b[1]) <= t && Math.abs(a[2] - b[2]) <= t;

// ------------------------------------------------------------------ arms
const PATH_FILL = [250, 176, 117], PATH_EDGE = [230, 158, 110];

/** The six arms, taken from the artist's own straights and split at the centre. */
function extractArms() {
  const img = readPng(`${SRC}/Tiles_PathsStraight.png`);
  const px = (f, x, y) => {
    const i = (y * img.width + f * FW + x) * 4;
    return img.data[i + 3] === 0 ? null : [img.data[i], img.data[i + 1], img.data[i + 2]];
  };
  const axes = [['N', 'S'], ['NE', 'SW'], ['SE', 'NW']];   // frames 0, 1, 2
  const arms = {};
  axes.forEach(([a, b], f) => {
    for (const e of [a, b]) arms[e] = Array.from({ length: FH }, () => Array(FW).fill(false));
    for (let y = FACE_TOP; y < FACE_TOP + FACE_H; y++)
      for (let x = 0; x < FW; x++) {
        const c = px(f, x, y);
        if (!c || !(near(c, PATH_FILL) || near(c, PATH_EDGE))) continue;
        for (const e of [a, b]) {
          const d = DIR[e];
          // a small overlap at the centre so unioned arms never leave a pinhole
          if ((x - CX) * d[0] + (y - CY) * d[1] >= -1.5) arms[e][y][x] = true;
        }
      }
  });
  return arms;
}

// ------------------------------------------------------------------ masks
export const rot = (m, k) => {
  let r = 0;
  for (let b = 0; b < 6; b++) if (m & (1 << b)) r |= 1 << ((b + k) % 6);
  return r & 63;
};
const popcount = (m) => { let c = 0; for (let b = 0; b < 6; b++) if (m & (1 << b)) c++; return c; };
/** all six rotations of a mask, starting from itself */
const family = (m) => Array.from({ length: 6 }, (_, k) => rot(m, k));

// The sheets, each a rotation family in a fixed order — the same frame ordering
// the original path sheets use, so a stream sheet is frame-for-frame comparable
// with its path counterpart.
const FAMILIES = {
  End:          family(8),            // one connection: S, N, SW, NE, SE, NW
  Straight:     [9, 18, 36],          // opposite pairs (only three exist)
  SmallCorner:  family(3),            // two adjacent, 60 degrees
  WideCorner:   family(5),            // two with one edge skipped, 120 degrees
  TriFan:       family(7),            // three consecutive
  BranchLeft:   family(41),
  BranchRight:  family(11),
  Crosses:      [42, 21, 54, 27, 45, 63],   // the alternating Ys, alternating 4s, and the six-way
  QuadRun:      family(15),           // four consecutive
  QuadSpur:     family(23),           // three consecutive plus one detached
  Five:         family(62),           // five connections
};

// ------------------------------------------------------------------ styles
// Both are the same three-band structure; only the colours differ.
// `outer` sits on the ground just outside the channel, `edge` just inside it.
const STYLES = {
  path: {
    prefix: 'Tiles_Path',
    fill: PATH_FILL,
    edge: PATH_EDGE,
    outer: [127, 139, 30],            // dark grass, where the track cuts the turf
    ripple: null,
  },
  stream: {
    prefix: 'Tiles_Stream',
    // sampled from Tiles_LakeBase / Tiles_LakeSidesOne so a stream running into
    // a lake is the same water, and the banks match the lake's shoreline
    fill: [145, 161, 243],
    edge: [127, 126, 201],            // the lake's under-bank water shadow
    outer: [220, 141, 100],           // the lake's sandy shore
    ripple: [156, 168, 244],
    narrow: 1,                        // a stream, not a canal
  },
};

// ------------------------------------------------------------------ render
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadBase() {
  const img = readPng(`${SRC}/Tiles_GrassBase1.png`);
  return (frame) => {
    const out = Buffer.alloc(FW * FH * 4);
    for (let y = 0; y < FH; y++)
      for (let x = 0; x < FW; x++) {
        const s = (y * img.width + frame * FW + x) * 4, d = (y * FW + x) * 4;
        for (let k = 0; k < 4; k++) out[d + k] = img.data[s + k];
      }
    return out;
  };
}

/**
 * A lake tile is the inverse of a channel: instead of a band of water laid on
 * grass, it is grass laid on water. Same three-band structure, so the same
 * painter does both — only the region differs.
 *
 * The six land bands are lifted from Tiles_LakeSidesOne, one per edge, so the
 * shore depth and shape are the artist's.
 */
export function extractShores() {
  const img = readPng(`${SRC}/Tiles_LakeSidesOne.png`);
  const WATER = [145, 159, 240], UNDER = [127, 126, 201];
  const byFrame = ['NW', 'N', 'NE', 'SE', 'S', 'SW'];   // measured from the art
  const shores = {};
  byFrame.forEach((edge, f) => {
    const raw = Array.from({ length: FH }, () => Array(FW).fill(false));
    const face = Array.from({ length: FH }, () => Array(FW).fill(false));
    for (let y = FACE_TOP; y < FACE_TOP + FACE_H; y++)
      for (let x = 0; x < FW; x++) {
        const i = (y * img.width + f * FW + x) * 4;
        if (img.data[i + 3] === 0) continue;
        face[y][x] = true;
        const c = [img.data[i], img.data[i + 1], img.data[i + 2]];
        if (!near(c, WATER, 12) && !near(c, UNDER, 12)) raw[y][x] = true;
      }
    // Keep only the land that reaches the tile rim. The artist floats lily pads
    // and reeds in the open water; those are green, so a naive "not water" test
    // calls them land and every unioned shoreline comes out shot through with
    // little islands. The real bank is the one component touching the edge.
    const band = Array.from({ length: FH }, () => Array(FW).fill(false));
    const seen = Array.from({ length: FH }, () => Array(FW).fill(false));
    const onRim = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .some(([dx, dy]) => !(face[y + dy] && face[y + dy][x + dx]));
    for (let y = FACE_TOP; y < FACE_TOP + FACE_H; y++)
      for (let x = 0; x < FW; x++) {
        if (!raw[y][x] || seen[y][x]) continue;
        const cells = [], stack = [[x, y]];
        seen[y][x] = true;
        let touches = false;
        while (stack.length) {
          const [cx, cy] = stack.pop();
          cells.push([cx, cy]);
          if (onRim(cx, cy)) touches = true;
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= FW || ny >= FH) continue;
            if (!raw[ny][nx] || seen[ny][nx]) continue;
            seen[ny][nx] = true; stack.push([nx, ny]);
          }
        }
        if (touches) for (const [cx, cy] of cells) band[cy][cx] = true;
      }
    // Clip the band to its own edge's wedge. Each source tile has land on one
    // edge only, so its bank spreads sideways into the neighbouring edges'
    // territory; unioned, those overhangs closed off the very mouth the tile is
    // supposed to leave open. Assigning every pixel to the edge it faces keeps
    // adjacent banks meeting cleanly and open edges genuinely open.
    for (let y = FACE_TOP; y < FACE_TOP + FACE_H; y++)
      for (let x = 0; x < FW; x++) {
        if (!band[y][x]) continue;
        const vx = x - CX, vy = (y - CY) * 1.35;   // the face is wider than tall
        let bestE = null, best = -Infinity;
        for (const e of EDGES) {
          const d = DIR[e][0] * vx + DIR[e][1] * vy;
          if (d > best) { best = d; bestE = e; }
        }
        if (bestE !== edge) band[y][x] = false;
      }
    shores[edge] = band;
  });
  return shores;
}

/** Water region for a lake tile with land on the given edges. */
function lakeRegion(landMask, shores, inFace) {
  const R = Array.from({ length: FH }, () => Array(FW).fill(false));
  for (let y = FACE_TOP; y < FACE_TOP + FACE_H; y++)
    for (let x = 0; x < FW; x++) {
      if (!inFace(x, y)) continue;
      let land = false;
      for (let b = 0; b < 6; b++)
        if ((landMask & (1 << b)) && shores[EDGES[b]][y][x]) { land = true; break; }
      R[y][x] = !land;
    }
  // a tile ringed by land on every edge still has to read as water: carve a pool
  if (landMask === 63)
    for (let y = FACE_TOP; y < FACE_TOP + FACE_H; y++)
      for (let x = 0; x < FW; x++)
        if (Math.hypot(x - CX, y - CY) <= 3.6 && inFace(x, y)) R[y][x] = true;

  // Keep only water that actually reaches an open edge. Where two land bands
  // overlap they can pinch the water into a pocket, and a pocket surrounded by
  // its own shore band renders as a little walled pond in the middle of the
  // tile — which is what showed up where a stream met the lake.
  const seen = Array.from({ length: FH }, () => Array(FW).fill(false));
  const comps = [];
  const onRim = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !inFace(x + dx, y + dy));
  for (let y = FACE_TOP; y < FACE_TOP + FACE_H; y++)
    for (let x = 0; x < FW; x++) {
      if (!R[y][x] || seen[y][x]) continue;
      const cells = [], stack = [[x, y]];
      seen[y][x] = true;
      let open = false;
      while (stack.length) {
        const [cx, cy] = stack.pop();
        cells.push([cx, cy]);
        if (onRim(cx, cy)) open = true;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= FW || ny >= FH) continue;
          if (!R[ny][nx] || seen[ny][nx] || !inFace(nx, ny)) continue;
          seen[ny][nx] = true; stack.push([nx, ny]);
        }
      }
      comps.push({ cells, open });
    }
  const keep = comps.some((c) => c.open)
    ? comps.filter((c) => c.open)                                  // open water
    : comps.sort((a, b) => b.cells.length - a.cells.length).slice(0, 1);  // enclosed pond
  for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) R[y][x] = false;
  for (const c of keep) for (const [x, y] of c.cells) R[y][x] = true;
  return R;
}

/** Paint one channel tile: grass base, then the three bands of the channel. */
function renderTile(mask, arms, style, base, seed, regionOverride = null) {
  const buf = base;
  const rnd = mulberry32(seed);
  const nb = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [x + dx, y + dy]);
  const inFace = (x, y) => y >= FACE_TOP && y < FACE_TOP + FACE_H &&
    buf[(y * FW + x) * 4 + 3] !== 0 && y - FACE_TOP < FACE_H;

  // region = union of the arms, plus a disc at the centre that rounds dead ends
  // and keeps junctions solid
  const R = regionOverride || Array.from({ length: FH }, () => Array(FW).fill(false));
  if (!regionOverride) for (let b = 0; b < 6; b++) {
    if (!(mask & (1 << b))) continue;
    const a = arms[EDGES[b]];
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) if (a[y][x]) R[y][x] = true;
  }
  if (!regionOverride) for (let y = FACE_TOP; y < FACE_TOP + FACE_H; y++)
    for (let x = 0; x < FW; x++)
      if (Math.hypot(x - CX, y - CY) <= (style.narrow ? 3.4 : 4.2) && inFace(x, y)) R[y][x] = true;
  // erode, but never at the hex boundary — that would pull the channel back from
  // the edge and break the join with the next tile
  for (let n = 0; !regionOverride && n < (style.narrow || 0); n++) {
    const keep = R.map((row) => row.slice());
    for (let y = FACE_TOP; y < FACE_TOP + FACE_H; y++)
      for (let x = 0; x < FW; x++) {
        if (!R[y][x]) continue;
        const atRim = nb(x, y).some(([nx, ny]) => !inFace(nx, ny));
        if (atRim) continue;
        if (nb(x, y).some(([nx, ny]) => inFace(nx, ny) && !R[ny][nx])) keep[y][x] = false;
      }
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) R[y][x] = keep[y][x];
  }

  const set = (x, y, c) => {
    if (!inFace(x, y)) return;
    const i = (y * FW + x) * 4;
    buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
  };

  // outer band first, so the inner bands paint over it where they meet
  for (let y = FACE_TOP; y < FACE_TOP + FACE_H; y++)
    for (let x = 0; x < FW; x++) {
      if (R[y][x] || !inFace(x, y)) continue;
      if (nb(x, y).some(([nx, ny]) => nx >= 0 && nx < FW && ny >= 0 && ny < FH && R[ny][nx])) set(x, y, style.outer);
    }
  for (let y = FACE_TOP; y < FACE_TOP + FACE_H; y++)
    for (let x = 0; x < FW; x++) {
      if (!R[y][x] || !inFace(x, y)) continue;
      const border = nb(x, y).some(([nx, ny]) => inFace(nx, ny) && !R[ny][nx]);
      set(x, y, border ? style.edge : style.fill);
    }
  // a few short current streaks, the idiom the lake tiles use for ripples
  if (style.ripple) {
    for (let t = 0; t < 60; t++) {
      const x = 3 + Math.floor(rnd() * (FW - 8)), y = FACE_TOP + 2 + Math.floor(rnd() * (FACE_H - 4));
      const len = 2 + Math.floor(rnd() * 3);
      let ok = true;
      for (let i = -1; i <= len; i++) if (!(R[y] && R[y][x + i]) || !inFace(x + i, y)) { ok = false; break; }
      if (!ok) continue;
      for (let i = 0; i < len; i++) set(x + i, y, style.ripple);
    }
  }
  return buf;
}

// ------------------------------------------------------------------ build
const outDir = process.argv[2] || SRC;
mkdirSync(outDir, { recursive: true });
const arms = extractArms();
const base = loadBase();

// which path masks the shipped art already covers
const index = existsSync(`${SRC}/index.json`) ? JSON.parse(readFileSync(`${SRC}/index.json`, 'utf8')) : { pathByMask: {}, lakeByLandMask: {} };
// --all regenerates pieces the artist already drew, so synthesis can be compared
// against the real thing before trusting it on the missing ones
const havePath = process.argv.includes('--all') ? new Set() : new Set(Object.keys(index.pathByMask || {}).map(Number));

// The shore families the shipped art does not cover. The artist drew only
// CONTIGUOUS shorelines (1-4 land edges in a run); everything below is a
// shoreline broken into two or more runs, or 5-6 land edges. A stream running
// into a lake produces exactly these — a stream mouth is a gap in the shore —
// so the stream set is not usable without them.
const LAKE_FAMILIES = {
  TwoWide:   family(5),          // two land edges with a water edge between
  TwoOpp:    [9, 18, 36],        // land on opposite sides: water channels through
  ThreeL:    family(41),
  ThreeR:    family(11),
  ThreeAlt:  [21, 42],
  FourSpur:  family(23),
  FourAlt:   [27, 54, 45],
  Five:      family(62),         // a bay with a single mouth
  Six:       [63],               // an enclosed pond
};
const LAKE_STYLE = {
  prefix: 'Tiles_LakeSides',
  fill: [145, 161, 243],
  edge: [127, 126, 201],
  outer: [220, 141, 100],
  ripple: [156, 168, 244],
};

const written = { path: {}, stream: {}, lake: {} };
let sheets = 0, tiles = 0;

for (const [kind, style] of Object.entries(STYLES)) {
  for (const [famName, masks] of Object.entries(FAMILIES)) {
    // paths: only fill the gaps, the artist's own pieces stay authoritative
    const wanted = masks.map((m) => (kind === 'path' && havePath.has(m) ? 0 : m));
    if (wanted.every((m) => m === 0)) continue;
    const name = `${style.prefix}${famName}`;
    const rgba = Buffer.alloc(FW * FRAMES * FH * 4);
    for (let f = 0; f < FRAMES; f++) {
      const m = wanted[f] ?? 0;
      const tile = m ? renderTile(m, arms, style, base(f), 7717 + m * 31 + kind.length)
                     : base(f);                       // unused slot: plain ground
      for (let y = 0; y < FH; y++)
        for (let x = 0; x < FW; x++) {
          const s = (y * FW + x) * 4, d = (y * FW * FRAMES + f * FW + x) * 4;
          for (let k = 0; k < 4; k++) rgba[d + k] = tile[s + k];
        }
      if (m) { written[kind][m] = [name, f]; tiles++; }
    }
    writeFileSync(`${outDir}/${name}.png`, encodePngRGBA(FW * FRAMES, FH, rgba));
    sheets++;
    console.log(`  ${name}.png  ${wanted.map((m) => m || '-').join(' ')}`);
  }
}

console.log(`\n${tiles} tiles across ${sheets} sheets -> ${outDir}/`);
console.log(`path masks added: ${Object.keys(written.path).length} (was ${havePath.size}/63)`);
console.log(`stream masks: ${Object.keys(written.stream).length}/63`);
// ---- lake shores the artist did not draw
const haveLake = new Set(Object.keys(index.lakeByLandMask || {}).map(Number));
const shores = extractShores();
for (const [famName, masks] of Object.entries(LAKE_FAMILIES)) {
  const wanted = masks.map((m) => (haveLake.has(m) ? 0 : m));
  if (wanted.every((m) => m === 0)) continue;
  const name = `${LAKE_STYLE.prefix}${famName}`;
  const rgba = Buffer.alloc(FW * FRAMES * FH * 4);
  for (let f = 0; f < FRAMES; f++) {
    const m = wanted[f] ?? 0;
    let tile;
    if (m) {
      const b0 = base(f);
      const inFace = (x, y) => y >= FACE_TOP && y < FACE_TOP + FACE_H && b0[(y * FW + x) * 4 + 3] !== 0;
      tile = renderTile(m, arms, LAKE_STYLE, b0, 4211 + m * 17, lakeRegion(m, shores, inFace));
    } else tile = base(f);
    for (let y = 0; y < FH; y++)
      for (let x = 0; x < FW; x++) {
        const sIdx = (y * FW + x) * 4, d = (y * FW * FRAMES + f * FW + x) * 4;
        for (let k = 0; k < 4; k++) rgba[d + k] = tile[sIdx + k];
      }
    if (m) { written.lake[m] = [name, f]; tiles++; }
  }
  writeFileSync(`${outDir}/${name}.png`, encodePngRGBA(FW * FRAMES, FH, rgba));
  sheets++;
  console.log(`  ${name}.png  ${wanted.map((m) => m || '-').join(' ')}`);
}
console.log(`lake shore masks added: ${Object.keys(written.lake).length} (was ${haveLake.size}/63)`);

writeFileSync(`${outDir}/channels.json`, JSON.stringify(written, null, 2) + '\n');
