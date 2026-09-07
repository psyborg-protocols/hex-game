// renderer.js
// The whole world is drawn at 1x into an offscreen buffer and that buffer is
// upscaled once, by a whole number, with smoothing off. Every sprite then lands
// on the same pixel grid by construction and the layout maths stays in integers —
// the approach docs/new_tiles.md recommends over scaling each sprite as it is
// drawn.

import { GEOM, columnBaseY, tileCenter, traceTopFace } from '../world/hexgrid.js';
import { drawColumn, columnPixelHeight } from './columns.js';
import { pixelScale } from '../core/camera.js';

export class Renderer {
  constructor(canvas, res) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.res = res;

    this.buffer = document.createElement('canvas');
    this.bctx = this.buffer.getContext('2d');

    this.sky = '#171a21';
    this.drawables = [];   // reused every frame to keep the GC quiet
  }

  /** Size the backing store to the element, accounting for device pixel ratio. */
  resize(camera) {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = pixelScale();
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    camera.setViewport(w, h);
    this.buffer.width = camera.viewW;
    this.buffer.height = camera.viewH;
    this.bctx.imageSmoothingEnabled = false;
    this.ctx.imageSmoothingEnabled = false;
  }

  /**
   * @param {WorldMap} map
   * @param {Camera} camera
   * @param {{hover?:{q,r}, entities?:Array, overlays?:Array}} opts
   *   entities: { q, r, h, draw(ctx, cx, cy) } — drawn interleaved with the
   *   columns by depth, so a player behind a tall hex is correctly hidden.
   */
  render(map, camera, opts = {}) {
    const { hover = null, entities = [], overlays = [] } = opts;
    const b = this.bctx;

    b.fillStyle = this.sky;
    b.fillRect(0, 0, this.buffer.width, this.buffer.height);

    const ox = camera.originX;
    const oy = camera.originY;
    b.save();
    b.translate(-ox, -oy);

    const view = camera.viewBounds(GEOM.frameHeight);
    this.collect(map, view, entities);

    for (const d of this.drawables) {
      if (d.column) drawColumn(b, this.res, d.column);
      else d.entity.draw(b, d.cx, d.cy, this.res);
    }

    if (hover) this.drawHover(b, map, hover);
    for (const o of overlays) o(b, camera);

    b.restore();

    // One upscale of the finished frame.
    this.ctx.drawImage(this.buffer,
      0, 0, this.buffer.width, this.buffer.height,
      0, 0, this.buffer.width * camera.scale, this.buffer.height * camera.scale);
  }

  /**
   * Gather what is on screen, back to front.
   *
   * Sorting by the column's ground line is what makes the 2.5D read: each tile's
   * wall is meant to be covered by the tile in front of it, and trees overhang
   * the tiles behind. Entities sort by the same key as the column they stand on,
   * one layer later, so they sit on their own tile and behind the next row.
   */
  collect(map, view, entities) {
    const list = this.drawables;
    list.length = 0;

    // Rows first: a column's art can reach up by its height plus tree headroom,
    // so scan further back in r than the visible rectangle strictly needs.
    const rLo = Math.floor(view.top / GEOM.stepY) - 2;
    const rHi = Math.ceil(view.bottom / GEOM.stepY) + 2;
    const qLo = Math.floor((view.left - GEOM.frameWidth) / GEOM.stepX) - 1;
    const qHi = Math.ceil(view.right / GEOM.stepX) + 1;

    for (let r = rLo; r <= rHi; r++) {
      for (let q = qLo; q <= qHi; q++) {
        const col = map.get(q, r);
        if (!col) continue;
        const base = columnBaseY(q, r);
        // Cull columns whose whole drawn extent is above the view.
        if (base + GEOM.topFaceTop + GEOM.topFaceHeight - columnPixelHeight(col.h) > view.bottom) continue;
        if (base + GEOM.frameHeight + col.h * GEOM.wallHeight < view.top) continue;
        list.push({ y: base, x: q, layer: 0, column: col });
      }
    }

    for (const e of entities) {
      const h = e.h ?? map.heightAt(e.q, e.r);
      const { cx, cy } = tileCenter(e.q, e.r, Math.max(0, h));
      list.push({ y: columnBaseY(e.q, e.r), x: e.q, layer: 1, entity: e, cx, cy });
    }

    list.sort((a, b) => (a.y - b.y) || (a.x - b.x) || (a.layer - b.layer));
  }

  drawHover(ctx, map, hover) {
    const h = Math.max(0, map.heightAt(hover.q, hover.r));
    const { cx, cy } = tileCenter(hover.q, hover.r, h);
    traceTopFace(ctx, cx, cy);
    ctx.fillStyle = 'rgba(255, 248, 220, 0.16)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 248, 220, 0.75)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}
