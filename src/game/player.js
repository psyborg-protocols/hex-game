// player.js
// Where the player is, where they are walking, and the placeholder that stands
// in for them until there is character art.
//
// There is no character sprite anywhere in the asset set — tiles, item icons and
// decor only — so this draws a small shaded pawn keyed to the tile palette. It is
// deliberately a marker and not an attempt at a character: replacing it means
// swapping drawPawn for a sprite blit and nothing else.

import { tileCenter } from '../world/hexgrid.js';

export const WALK_TILES_PER_SEC = 3.2;

export class Player {
  constructor(map, at) {
    this.map = map;
    this.q = at.q;
    this.r = at.r;
    this.path = [];        // remaining columns, current tile first
    this.leg = null;       // { from, to, t, duration }
    this.facing = 1;       // +1 right, -1 left
    this.onArrive = null;
    this.onStep = null;    // called with (q, r) each time a tile is reached
  }

  get h() { return Math.max(0, this.map.heightAt(this.q, this.r)); }
  get moving() { return !!this.leg; }

  /** Centre of the tile the player is standing on, ignoring any leg in progress. */
  get restingPos() {
    return tileCenter(this.q, this.r, this.h);
  }

  /**
   * Interpolated screen position. During a leg the pawn also arcs upward, which
   * sells stepping up a bank far better than sliding does.
   */
  get pos() {
    if (!this.leg) {
      const { cx, cy } = this.restingPos;
      return { x: cx, y: cy };
    }
    const { from, to, t } = this.leg;
    const a = tileCenter(from.q, from.r, Math.max(0, this.map.heightAt(from.q, from.r)));
    const b = tileCenter(to.q, to.r, Math.max(0, this.map.heightAt(to.q, to.r)));
    const e = ease(t);
    const hop = Math.sin(t * Math.PI) * (2 + Math.abs(b.cy - a.cy) * 0.12);
    return {
      x: a.cx + (b.cx - a.cx) * e,
      y: a.cy + (b.cy - a.cy) * e - hop,
    };
  }

  /** Start walking a route. Pass the array findPath returned. */
  follow(path, onArrive = null) {
    if (!path || path.length < 2) {
      this.path = [];
      this.leg = null;
      if (onArrive) onArrive();
      return;
    }
    this.path = path.slice(1);
    this.onArrive = onArrive;
    this.beginLeg();
  }

  stop() {
    this.path = [];
    this.leg = null;
    this.onArrive = null;
  }

  beginLeg() {
    const next = this.path.shift();
    if (!next) {
      this.leg = null;
      const done = this.onArrive;
      this.onArrive = null;
      if (done) done();
      return;
    }
    const from = { q: this.q, r: this.r };
    if (next.q !== from.q) this.facing = next.q > from.q ? 1 : -1;
    this.leg = { from, to: next, t: 0, duration: 1 / WALK_TILES_PER_SEC };
  }

  update(dt) {
    if (!this.leg) return;
    this.leg.t += dt / this.leg.duration;

    // Hand the depth sorter the tile the pawn visually belongs to.
    if (this.leg.t >= 0.5) {
      this.q = this.leg.to.q;
      this.r = this.leg.to.r;
    }

    if (this.leg.t >= 1) {
      this.q = this.leg.to.q;
      this.r = this.leg.to.r;
      // One tile walked. Hunger, crop growth and anything else on the clock
      // runs off this rather than off elapsed time, so standing still is free.
      if (this.onStep) this.onStep(this.q, this.r);
      this.beginLeg();
    }
  }

  /**
   * The renderer hands us the centre of our own tile; we ignore it and use the
   * interpolated position, so the pawn moves smoothly while still sorting by
   * whole tiles.
   */
  draw(ctx) {
    const { x, y } = this.pos;
    drawPawn(ctx, Math.round(x), Math.round(y), this.facing);
  }
}

const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/**
 * The placeholder figure: a shadow, a cloaked body and a head, outlined the way
 * every object in this art is outlined. Drawn in whole pixels at 1x so it stays
 * crisp through the integer upscale.
 */
function drawPawn(ctx, x, y, facing) {
  // Shadow on the tile face.
  ctx.fillStyle = 'rgba(20, 16, 30, 0.32)';
  ctx.beginPath();
  ctx.ellipse(x, y + 1, 5, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  const ink = '#1b1420';
  const cloak = '#8c3f4b';
  const cloakLit = 'rgba(184, 86, 96, 0.26)';
  const skin = '#e8c9a0';

  // Body: a tapered cloak, outlined first so the fill sits inside the ink.
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.moveTo(x - 5, y + 1);
  ctx.lineTo(x - 3, y - 8);
  ctx.lineTo(x + 3, y - 8);
  ctx.lineTo(x + 5, y + 1);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = cloak;
  ctx.beginPath();
  ctx.moveTo(x - 4, y);
  ctx.lineTo(x - 2, y - 7);
  ctx.lineTo(x + 2, y - 7);
  ctx.lineTo(x + 4, y);
  ctx.closePath();
  ctx.fill();

  // A lit edge on the side the light comes from, matching the tiles' top-left key.
  ctx.fillStyle = cloakLit;
  ctx.fillRect(x - 3, y - 6, 2, 6);

  // Head.
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(x, y - 10, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(x, y - 10, 2.4, 0, Math.PI * 2);
  ctx.fill();

  // Which way they are looking.
  ctx.fillStyle = ink;
  ctx.fillRect(x + (facing > 0 ? 0 : -1), y - 11, 1, 1);
}
