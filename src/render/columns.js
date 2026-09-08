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
    ctx.drawImage(img,
      sx, 0, GEOM.frameWidth, GEOM.frameHeight,
      x, frameOrigin(col.q, col.r, level).y, GEOM.frameWidth, GEOM.frameHeight);
  }
}
