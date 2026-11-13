// newtiles_bridge.js — a plank bridge deck that crosses a hex edge to edge.
//
// It is the artist's jetty (Tiles_LakeBase frames 4 and 5) made longer and a
// little wider: the same five wood tones, 2-pixel rails, plank pitch of three,
// and corner posts. The jetty is 10 wide and 15 long and stops in open water;
// this runs the full span of a top face and is as wide as a path, so a road can
// walk onto it.
//
// Three frames, one per hex axis — N-S, NE-SW, NW-SE — because a hex has three
// pairs of opposite edges and the last two are mirror images. They are drawn as
// an overlay on top of whatever tile is underneath rather than as a terrain, so
// the posts are free to hang below the face and the caps to rise above it.
//
// Usage: node tools/newtiles_bridge.js [out.png]
import { writeFileSync } from 'node:fs';
import { encodePngRGBA } from './png_write.js';

const FRAME_W = 32, FRAME_H = 48, FRAMES = 6;
const FACE_TOP = 16, FACE_H = 24;

// Pixel centres, so a run's endpoints can sit on an edge midpoint rather than
// half a pixel off it. The face is a flat-top hexagon 32 x 24 at rows 16..39.
const CX = FRAME_W / 2;                  // 16
const CY = FACE_TOP + FACE_H / 2;        // 28
const HW = FRAME_W / 2;                  // 16 — to the left and right vertices
const HH = FACE_H / 2;                   // 12
const FLAT = HW - 6;                     // 10 — half the flat top run

/** The artist's wood, lifted straight off the jetty, plus rich trim tones. */
const OUTLINE = [92, 46, 24];    // outer dark border & end beams
const RAIL_TOP = [146, 79, 44];  // lit inner curb / rail edge
const SEAM = [118, 62, 34];      // the gap between two planks
const POST = [146, 75, 51];      // a post's shaded face
const MID = [164, 93, 56];       // plank grain
const LIGHT = [178, 106, 66];    // sunlit plank
const CROWN = [194, 122, 76];    // subtle central arch highlight
const BOLT = [72, 42, 32];       // iron nail/bolt dot
const CAP = [214, 152, 86];      // carved timber post cap finial

const RAIL = 2;                  // pixels of dark edge down each side
const PITCH = 3;                 // a plank is two pixels of face and one of seam

/**
 * The three runs. `thick` is the deck's width measured across the axis it is
 * drawn along: the vertical run is stepped down the rows and measured in
 * columns, the diagonals are stepped across the columns and measured in rows.
 *
 * A path is 12 wide on the N-S frame and 10 tall on the diagonals. The ground
 * plane is squashed vertically, so a deck lying across the view foreshortens;
 * matching those two numbers is what makes the bridge look path-width on all
 * three axes instead of fat on two of them.
 */
// The diagonals run 13:6, not the 2:1 a diagonal usually wants in pixel art. A
// step to the NE neighbour moves the screen by (+26, -12), so a deck drawn at
// 2:1 leaves its tile half a pixel high and enters the next half a pixel low,
// and a chain of them zigzags at every joint. 13:6 costs one three-wide tread
// in an otherwise two-wide stair and lands dead on the edge midpoints.
const RUNS = [
  { name: 'NS', dir: [0, 1], thick: 12 },
  { name: 'NESW', dir: [13, -6], thick: 10 },
  { name: 'NWSE', dir: [13, 6], thick: 10 },
];

const norm = ([x, y]) => { const m = Math.hypot(x, y); return [x / m, y / m]; };

/** Is a pixel centre inside the top face? The deck is clipped to it; posts are not. */
function inFace(px, py) {
  const dx = Math.abs(px - CX), dy = Math.abs(py - CY);
  if (dx > HW || dy > HH) return false;
  if (dx > FLAT) return dy <= -2 * (dx - HW);
  return true;
}

/** A cheap stable hash, so the grain is the same every time the tool is run. */
const hash = n => Math.abs(((n * 2654435761) ^ (n << 13)) >>> 0);

/**
 * Distance along the run, offset to stay positive so the modulo below does not
 * flip sign at the middle of the tile. The footprint and the painter must agree
 * on this to a pixel, or the notch in the silhouette lands beside its seam
 * instead of on it.
 */
function runU(run, px, py) {
  const d = norm(run.dir);
  return (px - CX) * d[0] + (py - CY) * d[1] + 64;
}
const isSeam = u => Math.floor(u) % PITCH === PITCH - 1;

class Frame {
  constructor() { this.px = new Map(); }
  set(x, y, c) {
    if (x >= 0 && y >= 0 && x < FRAME_W && y < FRAME_H) this.px.set(y * FRAME_W + x, c);
  }
}

/**
 * Lay out the deck's footprint.
 *
 * Stepping along the run's long axis in whole pixels — rows for the vertical
 * run, columns for the diagonals — is what keeps the rails clean. A diagonal
 * drops half a row per column, so its band shifts one row every two columns and
 * the rail comes out as an even 2:1 stair. Thresholding a perpendicular
 * distance instead leaves single-pixel bites out of it.
 *
 * Each pixel carries how far it sits from the nearer side of the band, which is
 * what the rail keys off, and how far across the band it is, which is what the
 * grain keys off. Depth alone is mirror-symmetric, and grain drawn from it
 * comes out as a pattern rather than as boards.
 */
function footprint(run) {
  const vertical = run.dir[0] === 0;
  const slope = vertical ? 0 : run.dir[1] / run.dir[0];
  const half = run.thick / 2;
  const band = new Map();

  const key = (x, y) => y * FRAME_W + x;
  const steps = vertical ? FACE_H : FRAME_W;
  for (let s = 0; s < steps; s++) {
    const i = vertical ? FACE_TOP + s : s;
    // Centre of the band on the short axis, in pixel-centre coordinates.
    const c = vertical ? CX : CY + slope * (i + 0.5 - CX);
    // A seam pulls the deck in a pixel each side, the way each plank on the
    // jetty overhangs the gap below it. Only the vertical run can do this: on a
    // diagonal a seam crosses columns at a slant, so insetting whole columns
    // would chew holes in the stair instead of notching it.
    const inset = vertical && isSeam(runU(run, c, i + 0.5)) ? 1 : 0;
    const lo = Math.ceil(c - half + inset - 0.5);
    const hi = Math.floor(c + half - inset - 0.5);

    for (let j = lo; j <= hi; j++) {
      const x = vertical ? j : i;
      const y = vertical ? i : j;
      if (!inFace(x + 0.5, y + 0.5)) continue;
      band.set(key(x, y), { depth: Math.min(j - lo, hi - j), across: j - lo });
    }
  }
  return band;
}

/** Paint the planking into a footprint. */
function planks(f, run, band) {
  // The end board: one pixel of dark where the deck meets the hex edge, so two
  // bridges laid end to end show a beam over the joint rather than a butt seam.
  const off = run.dir[0] === 0 ? [0, 1] : [2, run.dir[1] > 0 ? 1 : -1];
  const has = (x, y) => band.has(y * FRAME_W + x);

  for (const [k, cell] of band) {
    const x = k % FRAME_W, y = (k - x) / FRAME_W;
    const u = runU(run, x + 0.5, y + 0.5);
    const end = !has(x + off[0], y + off[1]) || !has(x - off[0], y - off[1]);

    if (cell.depth === 0 || end) { f.set(x, y, OUTLINE); continue; }
    if (cell.depth === 1) {
      // Inner curb rail: top-left curb catches the light, opposite curb is shaded,
      // with iron bolt studs every couple of planks.
      const plank = Math.floor(u / PITCH);
      const isBolt = !isSeam(u) && plank % 2 === 0 && Math.floor(u) % PITCH === 0;
      if (isBolt) { f.set(x, y, BOLT); continue; }
      const litSide = run.dir[0] === 0 ? x < CX : y < CY + (run.dir[1] / run.dir[0]) * (x + 0.5 - CX);
      f.set(x, y, litSide ? RAIL_TOP : SEAM);
      continue;
    }
    if (isSeam(u)) { f.set(x, y, SEAM); continue; }
    // Subtle arch/camber brightness near the middle of the span, plus staggered woodgrain.
    const plank = Math.floor(u / PITCH);
    const distFromCenter = Math.abs(u - 64);
    const grain = (cell.across + (hash(plank * 7 + (run.dir[0] ? 3 : 0)) % 5)) % 5;
    if (distFromCenter < 4.5 && grain >= 2 && (plank % 2 === 0)) {
      f.set(x, y, CROWN);
    } else {
      f.set(x, y, grain < 2 ? MID : LIGHT);
    }
  }
}

/**
 * A post, 3 pixels wide and centred on `cx`, meeting the deck at `deckY`.
 *
 * Far posts show only what rises above the deck — a capped tip and one lit
 * segment — and are drawn over the end board so the shaded face reads against
 * it, exactly as on the jetty. Near posts stand in front of the deck and hang
 * below it, ending in a foot.
 */
function post(f, cx, deckY, far) {
  const col = (y, mid) => {
    f.set(cx - 1, y, OUTLINE);
    f.set(cx, y, mid);
    f.set(cx + 1, y, OUTLINE);
  };
  if (far) {
    f.set(cx, deckY - 3, OUTLINE);
    f.set(cx - 1, deckY - 2, OUTLINE);
    f.set(cx, deckY - 2, CAP);
    f.set(cx + 1, deckY - 2, OUTLINE);
    col(deckY - 1, LIGHT);
    col(deckY, POST);
    return;
  }
  f.set(cx, deckY - 3, OUTLINE);
  col(deckY - 2, CAP);
  for (let y = deckY - 1; y <= deckY + 1; y++) col(y, y === deckY - 1 ? LIGHT : POST);
  f.set(cx, deckY + 2, OUTLINE);            // the foot, standing in the water
}

/**
 * The four corner posts. A post is vertical whichever way the bridge runs, so
 * what separates the ones that show a leg from the ones that show only a tip is
 * whether the deck stands between the post and the viewer — that is, whether
 * any of the deck falls below the post in its own column. On the vertical run
 * that hides both posts at the far end; on a diagonal it hides three of the
 * four, leaving one leg at the lowest corner, which is what a narrow deck seen
 * from this angle actually does.
 */
function posts(f, run, band) {
  const d = norm(run.dir);
  const n = [-d[1], d[0]];
  const perPx = run.dir[0] === 0 ? 1 : Math.abs(n[1]);
  // Reach along the run until the face runs out; the face is convex, so walking
  // out from the middle finds the end.
  let reach = 0;
  while (inFace(CX + d[0] * (reach + 0.5), CY + d[1] * (reach + 0.5))) reach += 0.5;
  // Pull in a pixel and a half so the post straddles the rail rather than
  // hanging off the corner, which is where the jetty puts its own.
  const across = run.thick / 2 * perPx - 1.5 * perPx;

  const found = [];
  for (const s of [-1, 1]) for (const t of [-1, 1]) {
    const cx = Math.round(CX + d[0] * reach * s + n[0] * across * t - 0.5);
    const cy = CY + d[1] * reach * s + n[1] * across * t - 0.5;
    // Snap to the deck row nearest the corner. Rounding the corner alone lands
    // a pixel off wherever the stair happens to fall, and taking the column's
    // topmost or bottommost row instead drags a post off its own rail and down
    // to the other one.
    const rows = [];
    for (let y = 0; y < FRAME_H; y++) if (band.has(y * FRAME_W + cx)) rows.push(y);
    if (!rows.length) continue;
    const deckY = rows.reduce((a, b) => (Math.abs(b - cy) < Math.abs(a - cy) ? b : a));
    found.push({ cx, deckY, far: rows.some(y => y > deckY) });
  }
  // Near posts last: they stand in front of the deck and paint over it.
  for (const p of found.filter(p => p.far)) post(f, p.cx, p.deckY, true);
  for (const p of found.filter(p => !p.far)) post(f, p.cx, p.deckY, false);
}

function build(run) {
  const f = new Frame();
  const band = footprint(run);
  planks(f, run, band);
  posts(f, run, band);
  return f;
}

const out = process.argv[2] || 'new_tiles/Tiles_Bridge.png';
const rgba = Buffer.alloc(FRAME_W * FRAMES * FRAME_H * 4);
RUNS.forEach((run, i) => {
  for (const [k, c] of build(run).px) {
    const x = k % FRAME_W, y = (k - x) / FRAME_W;
    const o = (y * FRAME_W * FRAMES + i * FRAME_W + x) * 4;
    rgba[o] = c[0]; rgba[o + 1] = c[1]; rgba[o + 2] = c[2]; rgba[o + 3] = 255;
  }
});
writeFileSync(out, encodePngRGBA(FRAME_W * FRAMES, FRAME_H, rgba));
console.log(`${out}: ${RUNS.map(r => r.name).join(', ')} + ${FRAMES - RUNS.length} spare`);
