// hexgrid.js
// The one source of truth for the lattice. The game and editor.html both import
// this, so they cannot drift apart.
//
// Flat-top hexes in **odd-q offset** coordinates: odd columns are pushed down by
// half a tile. Measured from the artwork, not guessed — see docs/new_tiles.md.
// The numbers below mirror new_tiles/index.json; tests/hexgrid.test.mjs asserts
// they still match it.
//
// A sprite frame is 32x48:
//   rows  0-15  headroom (trees overhang into the tile behind)
//   rows 16-39  the top face, a flat-top hexagon 32 wide x 24 tall
//   rows 40-47  the earth wall, the tile's visible thickness
//
// One top face covers 624px and the lattice cell is 26 x 24 = 624px, which is
// why the plane tiles with no gaps and no overlaps.

export const GEOM = {
  stepX: 26,
  stepY: 24,
  oddColumnOffsetY: 12,
  frameWidth: 32,
  frameHeight: 48,
  topFaceTop: 16,
  topFaceHeight: 24,
  wallHeight: 8,
};

/** Edge numbering, clockwise from the flat top. Matches index.json's edgeOrder. */
export const EDGE_ORDER = ['N', 'NE', 'SE', 'S', 'SW', 'NW'];
export const EDGE_BITS = { N: 1, NE: 2, SE: 4, S: 8, SW: 16, NW: 32 };

/**
 * Adopt the geometry from a loaded new_tiles/index.json. The defaults above are
 * already correct; this exists so the art can move without a code change.
 */
export function configure(index) {
  if (!index) return GEOM;
  GEOM.stepX = index.layout.stepX;
  GEOM.stepY = index.layout.stepY;
  GEOM.oddColumnOffsetY = index.layout.oddColumnOffsetY;
  GEOM.frameWidth = index.frame.width;
  GEOM.frameHeight = index.frame.height;
  GEOM.topFaceTop = index.topFace.top;
  GEOM.topFaceHeight = index.topFace.height;
  GEOM.wallHeight = index.wallHeight;
  return GEOM;
}

// ---------------------------------------------------------------- keys

export const key = (q, r, h) => `${q},${r},${h}`;
export const columnKey = (q, r) => `${q},${r}`;

export function parseKey(k) {
  const [q, r, h] = k.split(',').map(Number);
  return { q, r, h };
}

/**
 * True for columns that sit half a tile lower. `q & 1` is deliberate: it gives
 * the right parity for negative q, where `q % 2` would give -1.
 */
export const isOddColumn = q => (q & 1) === 1;

// ---------------------------------------------------------------- geometry

/** Screen y of a column's ground line, before any height. Also the depth-sort key. */
export function columnBaseY(q, r) {
  return r * GEOM.stepY + (isOddColumn(q) ? GEOM.oddColumnOffsetY : 0);
}

/**
 * Centre of the top face of the tile at (q, r, h), in world pixels at 1x.
 * Raising h by one lifts the tile by exactly one wall height.
 */
export function tileCenter(q, r, h = 0) {
  const cx = q * GEOM.stepX + GEOM.frameWidth / 2;
  const cy = columnBaseY(q, r)
    + GEOM.topFaceTop
    + GEOM.topFaceHeight / 2
    - h * GEOM.wallHeight;
  return { cx, cy };
}

/** Top-left corner at which to blit a 32x48 frame so its top face lands on (q, r, h). */
export function frameOrigin(q, r, h = 0) {
  const { cx, cy } = tileCenter(q, r, h);
  return {
    x: cx - GEOM.frameWidth / 2,
    y: cy - (GEOM.topFaceTop + GEOM.topFaceHeight / 2),
  };
}

/** The six corners of a top face, clockwise from the top-left of the flat top. */
export function topFaceCorners(cx, cy) {
  const hw = GEOM.frameWidth / 2;        // 16
  const hh = GEOM.topFaceHeight / 2;     // 12
  const flat = hw - 6;                   // 10 — the flat run is 20px wide
  return [
    { x: cx - flat, y: cy - hh },
    { x: cx + flat, y: cy - hh },
    { x: cx + hw, y: cy },
    { x: cx + flat, y: cy + hh },
    { x: cx - flat, y: cy + hh },
    { x: cx - hw, y: cy },
  ];
}

/** Trace a top face onto a 2D context. Does not stroke or fill. */
export function traceTopFace(ctx, cx, cy) {
  const pts = topFaceCorners(cx, cy);
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

/** Is (px, py) inside the top face centred on (cx, cy)? */
export function pointInHex(px, py, cx, cy) {
  const hw = GEOM.frameWidth / 2;
  const hh = GEOM.topFaceHeight / 2;
  const flat = hw - 6;
  const dx = Math.abs(px - cx);
  const dy = Math.abs(py - cy);
  if (dx > hw || dy > hh) return false;
  // Inside the diagonal band, the edge falls away at 2 units of y per unit of x.
  if (dx > flat) return dy <= -2 * (dx - hw);
  return true;
}

// ---------------------------------------------------------------- neighbours

// Indexed by column parity, then by EDGE_ORDER.
const NEIGHBOR_DIRS = [
  [[0, -1], [1, -1], [1, 0], [0, 1], [-1, 0], [-1, -1]], // even q
  [[0, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0]],   // odd q
];

/** The neighbour across one edge. `edge` is an index into EDGE_ORDER, or its name. */
export function neighbor(q, r, edge) {
  const i = typeof edge === 'string' ? EDGE_ORDER.indexOf(edge) : edge;
  const [dq, dr] = NEIGHBOR_DIRS[isOddColumn(q) ? 1 : 0][i];
  return { q: q + dq, r: r + dr };
}

/** All six neighbours, in EDGE_ORDER. */
export function neighbors(q, r) {
  return NEIGHBOR_DIRS[isOddColumn(q) ? 1 : 0].map(([dq, dr]) => ({ q: q + dq, r: r + dr }));
}

// ---------------------------------------------------------------- distance

/** Offset (odd-q) to axial. Axial is only used for distance and A* heuristics. */
export function toAxial(q, r) {
  return { aq: q, ar: r - ((q - (q & 1)) >> 1) };
}

/** Hex distance in tiles between two offset coordinates. */
export function distance(q1, r1, q2, r2) {
  const a = toAxial(q1, r1);
  const b = toAxial(q2, r2);
  const dq = a.aq - b.aq;
  const dr = a.ar - b.ar;
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(dq + dr)) / 2;
}

// ---------------------------------------------------------------- picking

/**
 * Which column is under the world-space point (px, py)?
 *
 * Height makes this ambiguous — a tall column's top face is drawn well above its
 * own ground line and can cover the columns behind it. So we test candidates in
 * reverse draw order (front-most and highest first) and take the first hit,
 * which is exactly the tile the player sees.
 *
 * @param {(q:number, r:number) => number} topHeight  height of a column, or -1 if empty.
 */
export function pickHex(px, py, topHeight, searchRadius = 3) {
  const approxQ = Math.round((px - GEOM.frameWidth / 2) / GEOM.stepX);
  const approxR = Math.round(py / GEOM.stepY);

  const candidates = [];
  // Tall columns nearby can reach down over this point, so search generously in r.
  for (let q = approxQ - searchRadius; q <= approxQ + searchRadius; q++) {
    for (let r = approxR - searchRadius; r <= approxR + searchRadius; r++) {
      const h = topHeight(q, r);
      candidates.push({ q, r, h, base: columnBaseY(q, r) });
    }
  }

  // Front to back: larger base y is nearer the viewer; ties broken by height.
  candidates.sort((a, b) => (b.base - a.base) || (b.h - a.h));

  for (const c of candidates) {
    const { cx, cy } = tileCenter(c.q, c.r, Math.max(0, c.h));
    if (pointInHex(px, py, cx, cy)) return { q: c.q, r: c.r, h: c.h };
  }
  return null;
}

/**
 * Draw order for a set of columns: back to front. Each tile's wall is meant to
 * be covered by the tile in front of it, so this is not optional.
 */
export function compareDrawOrder(a, b) {
  const byBase = columnBaseY(a.q, a.r) - columnBaseY(b.q, b.r);
  if (byBase !== 0) return byBase;
  return a.q - b.q;
}
