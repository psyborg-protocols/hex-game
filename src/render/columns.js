// columns.js
// Drawing a stack of tiles as a cliff rather than a wedding cake.
//
// What the art actually is, measured from the alpha rather than read off a spec:
// a 32x48 frame whose opaque region is a flat-top hexagon occupying rows 16-39,
// extruded straight down by the 8px wall. That extrusion is why rows 27-36 are
// the full 32px wide — the hexagon's left and right vertices, at rows 27-28,
// dragged down eight rows.
//
// Two consequences follow, and both bit:
//
//   1. Stacking whole frames (what editor.js does) has the right silhouette but
//      the wrong texture: each copy is only lifted 8px while its top face is
//      24px tall, so 16px of *grass* stays visible per level and a tall column
//      reads as a staircase of ledges.
//
//   2. Repeating just the 8px wall strip has the right texture and the wrong
//      silhouette. The wall rows taper from 28px wide down to 20px, but the
//      column's true side profile is the full 32px from row 27 all the way to
//      row 36 + 8h. Repeating the strip therefore leaves a triangular notch of
//      background showing down each side of every tall column.
//
// So: bake a cliff variant of each frame whose whole silhouette is earth, and
// stack that under one real tile. The silhouette is then exactly the union of
// the sprite shape at each level — correct by construction — and only the top
// level shows its surface.

import { frameOrigin, GEOM } from '../world/hexgrid.js';
import { FRAMES_PER_SHEET } from '../world/tileset.js';

/** How many depth shades to bake. Levels below the last one reuse the darkest. */
export const SHADE_LEVELS = 8;

const WALL_TOP = GEOM.frameHeight - GEOM.wallHeight;   // 40
const FACE_TOP = GEOM.topFaceTop;                      // 16

/** Darkening of a level `i` below the top face. Gentle: the texture does the work. */
export function shadeFactor(i) {
  return Math.max(0.68, 1 - 0.05 * i);
}

/** Total drawn height of a column, in 1x pixels. Used for culling. */
export const columnPixelHeight = h => GEOM.frameHeight + h * GEOM.wallHeight;

/**
 * Bake, for every sheet, a version of each frame with the top face replaced by
 * the tile's own wall texture, at each depth shade.
 *
 * Atlas layout: x = frame * 32, y = shade * 48.
 */
export function buildCliffAtlas(images) {
  const atlas = {};
  const w = GEOM.frameWidth * FRAMES_PER_SHEET;

  for (const [name, img] of Object.entries(images)) {
    if (!img) continue;

    const read = document.createElement('canvas');
    read.width = img.width;
    read.height = img.height;
    const rc = read.getContext('2d', { willReadFrequently: true });
    rc.imageSmoothingEnabled = false;
    rc.drawImage(img, 0, 0);

    let src;
    try {
      src = rc.getImageData(0, 0, img.width, img.height);
    } catch {
      continue;   // canvas tainted; the column just falls back to plain frames
    }

    const base = bakeCliffFrames(src, w);

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = GEOM.frameHeight * SHADE_LEVELS;
    const c = canvas.getContext('2d');
    c.imageSmoothingEnabled = false;

    const baseCanvas = document.createElement('canvas');
    baseCanvas.width = w;
    baseCanvas.height = GEOM.frameHeight;
    baseCanvas.getContext('2d').putImageData(base, 0, 0);

    for (let shade = 0; shade < SHADE_LEVELS; shade++) {
      const y = shade * GEOM.frameHeight;
      c.drawImage(baseCanvas, 0, y);
      if (shade === 0) continue;
      c.save();
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = `rgba(14, 11, 22, ${(1 - shadeFactor(shade)).toFixed(3)})`;
      c.fillRect(0, y, w, GEOM.frameHeight);
      c.restore();
    }
    atlas[name] = canvas;
  }
  return atlas;
}

/**
 * Fill the whole silhouette of every frame with wall texture.
 *
 * The wall is only 20-28px wide but the silhouette reaches 32, so horizontal
 * sampling reflects back into the wall's interior rather than clamping — a clamp
 * would smear the wall's dark edge pixels up to six columns wide down each side.
 * The outline is then redrawn as one pixel on the real silhouette boundary.
 */
function bakeCliffFrames(src, width) {
  const out = new ImageData(width, GEOM.frameHeight);
  const sw = src.width;
  const at = (x, y) => (y * sw + x) * 4;

  for (let f = 0; f < FRAMES_PER_SHEET; f++) {
    const fx = f * GEOM.frameWidth;

    // Opaque span of each wall row, and the ink colour sitting at its edge.
    const spans = [];
    for (let j = 0; j < GEOM.wallHeight; j++) {
      const y = WALL_TOP + j;
      let lo = -1, hi = -1;
      for (let x = 0; x < GEOM.frameWidth; x++) {
        if (src.data[at(fx + x, y) + 3] > 127) { if (lo < 0) lo = x; hi = x; }
      }
      spans.push({ lo, hi });
    }
    const widest = spans.reduce((a, b) => (b.hi - b.lo > a.hi - a.lo ? b : a));
    const inkAt = at(fx + Math.max(0, widest.lo), WALL_TOP);
    const ink = [src.data[inkAt], src.data[inkAt + 1], src.data[inkAt + 2]];

    for (let y = FACE_TOP; y < GEOM.frameHeight; y++) {
      const span = spans[(y - FACE_TOP) % GEOM.wallHeight];
      const srcY = WALL_TOP + ((y - FACE_TOP) % GEOM.wallHeight);
      if (span.lo < 0) continue;

      for (let x = 0; x < GEOM.frameWidth; x++) {
        const s = at(fx + x, y);
        if (src.data[s + 3] <= 127) continue;   // outside the tile silhouette

        const sx = reflect(x, span.lo + 1, span.hi - 1);
        const from = at(fx + sx, srcY);
        const to = ((y * width) + fx + x) * 4;
        out.data[to] = src.data[from];
        out.data[to + 1] = src.data[from + 1];
        out.data[to + 2] = src.data[from + 2];
        out.data[to + 3] = 255;
      }
    }

    // One pixel of ink wherever the silhouette meets nothing, so the cliff keeps
    // the outline every solid object in this art has.
    for (let y = FACE_TOP; y < GEOM.frameHeight; y++) {
      for (let x = 0; x < GEOM.frameWidth; x++) {
        if (src.data[at(fx + x, y) + 3] <= 127) continue;
        const edge = (x === 0 || src.data[at(fx + x - 1, y) + 3] <= 127)
          || (x === GEOM.frameWidth - 1 || src.data[at(fx + x + 1, y) + 3] <= 127);
        if (!edge) continue;
        const to = ((y * width) + fx + x) * 4;
        out.data[to] = ink[0];
        out.data[to + 1] = ink[1];
        out.data[to + 2] = ink[2];
        out.data[to + 3] = 255;
      }
    }
  }
  return out;
}

/** Fold a coordinate back inside [lo, hi] instead of clamping onto the edge. */
function reflect(x, lo, hi) {
  if (hi <= lo) return lo;
  const span = hi - lo;
  let v = x - lo;
  const period = span * 2;
  v = ((v % period) + period) % period;
  if (v > span) v = period - v;
  return lo + v;
}

/**
 * Draw one column: the buried levels bottom-up as cliff, then its real top face.
 *
 * @param {CanvasRenderingContext2D} ctx  world-space context (already translated)
 * @param {{images:Object, cliffAtlas:Object}} res
 * @param {{q,r,h,sprite,frame}} col
 */
export function drawColumn(ctx, res, col) {
  const img = res.images[col.sprite];
  if (!img) return;

  const { x, y } = frameOrigin(col.q, col.r, col.h);
  const sx = col.frame * GEOM.frameWidth;
  const cliff = res.cliffAtlas[col.sprite];

  if (cliff) {
    // Bottom level first: each copy is 8px lower and covered by the one above.
    for (let k = col.h; k >= 1; k--) {
      const shade = Math.min(k, SHADE_LEVELS - 1);
      ctx.drawImage(cliff,
        sx, shade * GEOM.frameHeight, GEOM.frameWidth, GEOM.frameHeight,
        x, y + k * GEOM.wallHeight, GEOM.frameWidth, GEOM.frameHeight);
    }
  }

  ctx.drawImage(img, sx, 0, GEOM.frameWidth, GEOM.frameHeight,
    x, y, GEOM.frameWidth, GEOM.frameHeight);
}
