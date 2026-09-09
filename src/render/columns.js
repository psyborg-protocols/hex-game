// columns.js
// Drawing a column of tiles.
//
// The art already solves this. A 32x48 frame is a flat-top hexagon in rows 16-39
// extruded straight down by an 8px earth wall — every tile carries its own side
// section. Stacking whole frames, each lifted by exactly that wall height, is
// therefore all a cliff needs: each copy covers the face of the one below it and
// leaves only its side showing, so an h-high column draws one surface over h
// bands of wall. On stone those bands read as bedding planes; on grass the tan
// bank reads as cut earth.
//
// Nothing here synthesises pixels. Earlier versions baked cliff-face variants and
// spliced filler rows to avoid seams that, rendered, turn out to be the thing
// that makes a tall column look like rock. The editor drew it this way from the
// start and was right.

import { frameOrigin, GEOM } from '../world/hexgrid.js';

/**
 * Height lighting. Applied per *level*, not per column, which is what gives a
 * cliff face its gradient: the stacked bands darken as they descend, so a tall
 * column reads as standing in its own shadow at the foot and catching the light
 * at the top.
 *
 * `LIGHT_BASE` is the height that renders untouched — ground above it lightens,
 * ground below it darkens. It sits at 3 because that is roughly the median of a
 * generated world, so the country you actually walk around in is the neutral
 * exposure and only the lake beds and the massifs reach the extremes. Setting it
 * at worldgen's `baseHeight` of 5 was the obvious guess and came out wrong: most
 * of the map is below that, so the whole world rendered dim.
 *
 * The range is deliberately lopsided: 20% of darkening against 10% of lift.
 * Brightening this art destroys it much faster than shading it does — the stone
 * and steppes sheets are already pale, and at +30% they blew out to near-white
 * and lost their texture entirely. Shadow has room to work; highlight does not.
 *
 * Deliberately a constant rather than derived from the map — mining a cliff down
 * must not re-light the world around it.
 */
export const LIGHT_BASE = 3;
export const LIGHT_STEP = 0.05;
export const LIGHT_MIN = 0.80;
export const LIGHT_MAX = 1.10;

/** Brightness multiplier for ground at `level`. */
export function brightnessAt(level) {
  const b = 1 + (level - LIGHT_BASE) * LIGHT_STEP;
  return b < LIGHT_MIN ? LIGHT_MIN : b > LIGHT_MAX ? LIGHT_MAX : b;
}

/**
 * A copy of `img` at the exposure for `level`, baked once and cached on `res`.
 *
 * `ctx.filter` does this in one line, and that was the first version — but it
 * flushes canvas state on every change, and the exposure changes per level, so
 * it changed on nearly every blit. Measured over a heavy frame of 400 blits:
 *
 *   no lighting            6.3 ms
 *   ctx.filter per blit  193.3 ms      <- about five frames a second
 *   baked variants        13.5 ms
 *
 * So the filter still does the work, just once per (sheet, exposure) pair at
 * first use instead of thousands of times a second. There are only ten distinct
 * exposures between LIGHT_MIN and LIGHT_MAX, so the cache tops out around 270
 * small canvases and stays well inside a 16.7ms budget.
 */
export function litImage(res, key, img, level) {
  const b = brightnessAt(level);
  if (b === 1 || !img) return img;

  const cache = (res.litCache ||= new Map());
  const id = `${key}|${b.toFixed(2)}`;
  const hit = cache.get(id);
  if (hit) return hit;

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const c = canvas.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.filter = `brightness(${(b * 100).toFixed(0)}%)`;
  c.drawImage(img, 0, 0);
  cache.set(id, canvas);
  return canvas;
}

/**
 * Draw one column, bottom level first so each level covers the one beneath it.
 *
 * @param {CanvasRenderingContext2D} ctx  world-space context (already translated)
 * @param {{images:Object}} res
 * @param {{q,r,h,sprite,frame}} col
 */
export function drawColumn(ctx, res, col) {
  const img = res.images[col.sprite];
  if (!img) return;

  const sx = col.frame * GEOM.frameWidth;
  const x = frameOrigin(col.q, col.r, 0).x;

  for (let level = 0; level <= col.h; level++) {
    ctx.drawImage(litImage(res, col.sprite, img, level),
      sx, 0, GEOM.frameWidth, GEOM.frameHeight,
      x, frameOrigin(col.q, col.r, level).y, GEOM.frameWidth, GEOM.frameHeight);
  }
}
