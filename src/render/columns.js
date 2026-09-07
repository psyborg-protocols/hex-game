// columns.js
// Drawing a stack of tiles as a cliff rather than a wedding cake.
//
// The tile art is one hex slab: a 24px top face over an 8px earth wall. Stacking
// whole 32x48 frames — what editor.js does — only lifts each copy by 8px, so 16px
// of the *top face* below stays visible and a tall column reads as a staircase of
// grass ledges.
//
// A column is therefore drawn as one top face at its full height, with the 8px
// wall strip repeated underneath it, once per level. The bands are shaded
// progressively darker with depth so a four-high bank reads as a bank and not as
// a repeating texture. Real per-level cliff art replaces the shading later; the
// seam geometry does not change when it does.

import { frameOrigin, GEOM } from '../world/hexgrid.js';
import { FRAMES_PER_SHEET } from '../world/tileset.js';

/** How many distinct depth shades to bake. Deeper levels reuse the darkest. */
export const SHADE_LEVELS = 10;

/** Wall strips live in the last 8 rows of a frame. */
const WALL_TOP = GEOM.frameHeight - GEOM.wallHeight;   // 40

/** Darkening applied to a strip `i` levels below the top face. */
export function shadeFactor(i) {
  return Math.max(0.55, 1 - 0.055 * i);
}

/**
 * Pre-render the wall strips at every depth shade.
 *
 * Doing this once at load keeps the hot path to plain drawImage calls — per-frame
 * ctx.filter would be correct but costs more than the whole rest of the render.
 *
 * Layout per sheet: x = frame * 32, y = shade * 8.
 */
export function buildWallAtlas(images) {
  const atlas = {};
  for (const [name, img] of Object.entries(images)) {
    if (!img) continue;
    const canvas = document.createElement('canvas');
    canvas.width = GEOM.frameWidth * FRAMES_PER_SHEET;
    canvas.height = GEOM.wallHeight * SHADE_LEVELS;
    const c = canvas.getContext('2d');
    c.imageSmoothingEnabled = false;

    for (let shade = 0; shade < SHADE_LEVELS; shade++) {
      const y = shade * GEOM.wallHeight;
      for (let frame = 0; frame < FRAMES_PER_SHEET; frame++) {
        const x = frame * GEOM.frameWidth;
        c.drawImage(img,
          x, WALL_TOP, GEOM.frameWidth, GEOM.wallHeight,
          x, y, GEOM.frameWidth, GEOM.wallHeight);
      }
      if (shade === 0) continue;
      // source-atop keeps the darkening inside the strip's own alpha, so the
      // transparent corners of the hex stay transparent.
      c.save();
      c.globalCompositeOperation = 'source-atop';
      c.fillStyle = `rgba(12, 10, 20, ${(1 - shadeFactor(shade)).toFixed(3)})`;
      c.fillRect(0, y, canvas.width, GEOM.wallHeight);
      c.restore();
    }
    atlas[name] = canvas;
  }
  return atlas;
}

/** Total drawn height of a column, in 1x pixels. Used for culling. */
export const columnPixelHeight = h => GEOM.frameHeight + h * GEOM.wallHeight;

/**
 * Draw one column: the buried walls first, then its top face.
 *
 * @param {CanvasRenderingContext2D} ctx  world-space context (already translated)
 * @param {{images:Object, wallAtlas:Object}} res
 * @param {{q,r,h,sprite,frame}} col
 */
export function drawColumn(ctx, res, col) {
  const img = res.images[col.sprite];
  if (!img) return;

  const { x, y } = frameOrigin(col.q, col.r, col.h);
  const sx = col.frame * GEOM.frameWidth;

  const atlas = res.wallAtlas[col.sprite];
  if (atlas) {
    for (let k = 1; k <= col.h; k++) {
      const shade = Math.min(k, SHADE_LEVELS - 1);
      ctx.drawImage(atlas,
        sx, shade * GEOM.wallHeight, GEOM.frameWidth, GEOM.wallHeight,
        x, y + WALL_TOP + k * GEOM.wallHeight, GEOM.frameWidth, GEOM.wallHeight);
    }
  }

  ctx.drawImage(img, sx, 0, GEOM.frameWidth, GEOM.frameHeight,
    x, y, GEOM.frameWidth, GEOM.frameHeight);
}
