// player.js
// Where the player is, where they are walking, and the animated explorer who
// stands in for them: idle breathing, walking stride, ladder climbing, rowing
// a boat across the river, harvesting/mining swings, and combat lunges.

import { tileCenter } from '../world/hexgrid.js';
import { isWater } from '../world/tileset.js';
import { isBridged } from '../world/pathfinding.js';

export const WALK_TILES_PER_SEC = 3.2;

const INK = '#1b1420';
const px = (ctx, c, x, y, w = 1, h = 1) => {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

export class Player {
  constructor(map, at) {
    this.map = map;
    this.q = at.q;
    this.r = at.r;
    this.path = [];        // remaining columns, current tile first
    this.leg = null;       // { from, to, t, duration }
    this.facing = 1;       // +1 right, -1 left
    this.animTime = 0;     // accumulated animation clock (seconds)
    this.actionAnim = null;// { kind, start, until }
    this.equipped = null;  // optional { weapon, shield }
    this.onArrive = null;
    this.onStep = null;    // called with (q, r) each time a tile is reached
    this.speedAt = null;   // (from, to) => speed multiplier for that step
  }

  get h() { return Math.max(0, this.map.surfaceAt(this.q, this.r)); }
  get moving() { return !!this.leg; }

  /** Trigger a brief character action animation ('chop' | 'mine' | 'forage' | 'attack' | 'build'). */
  triggerAction(kind, durationSec = 0.55) {
    this.actionAnim = {
      kind,
      start: this.animTime,
      until: this.animTime + durationSec,
    };
  }

  /** Whether the player is currently floating on unbridged water. */
  get onWater() {
    if (!this.map) return false;
    const col = this.map.get(this.q, this.r);
    return !!col && isWater(col.terrain) && !isBridged(this.map, { q: this.q, r: this.r });
  }

  /** Whether the current leg is climbing or descending a ladder cliff. */
  get climbing() {
    if (!this.leg || !this.map) return false;
    const ah = Math.max(0, this.map.surfaceAt(this.leg.from.q, this.leg.from.r));
    const bh = Math.max(0, this.map.surfaceAt(this.leg.to.q, this.leg.to.r));
    return Math.abs(bh - ah) >= 2;
  }

  /** Centre of the tile the player is standing on, ignoring any leg in progress. */
  get restingPos() {
    return tileCenter(this.q, this.r, this.h);
  }

  /**
   * Interpolated screen position. During a leg the pawn arcs upward, except
   * when climbing a ladder where they ascend steadily up the cliff face.
   */
  get pos() {
    if (!this.leg) {
      const { cx, cy } = this.restingPos;
      return { x: cx, y: cy };
    }
    const { from, to, t } = this.leg;
    const a = tileCenter(from.q, from.r, Math.max(0, this.map.surfaceAt(from.q, from.r)));
    const b = tileCenter(to.q, to.r, Math.max(0, this.map.surfaceAt(to.q, to.r)));
    const e = ease(t);
    const hop = this.climbing
      ? Math.sin(t * Math.PI) * 1
      : Math.sin(t * Math.PI) * (2 + Math.abs(b.cy - a.cy) * 0.12);
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
    const mult = this.speedAt ? this.speedAt(from, next) : 1;
    this.leg = { from, to: next, t: 0, duration: 1 / (WALK_TILES_PER_SEC * mult) };
  }

  update(dt) {
    this.animTime += dt;
    if (this.actionAnim && this.animTime >= this.actionAnim.until) {
      this.actionAnim = null;
    }
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
      if (this.onStep) this.onStep(this.q, this.r);
      this.beginLeg();
    }
  }

  /**
   * The renderer hands us the centre of our own tile; we ignore it and use the
   * interpolated position, so the pawn moves smoothly while still sorting by
   * whole tiles.
   */
  draw(ctx, ghost = false) {
    const { x, y } = this.pos;
    let action = null;
    if (this.actionAnim) {
      const dur = Math.max(0.01, this.actionAnim.until - this.actionAnim.start);
      action = {
        kind: this.actionAnim.kind,
        p: Math.min(1, Math.max(0, (this.animTime - this.actionAnim.start) / dur)),
      };
    }
    drawPawn(ctx, Math.round(x), Math.round(y), this.facing, ghost, {
      t: this.animTime,
      moving: this.moving,
      legT: this.leg ? this.leg.t : 0,
      climbing: this.climbing,
      boat: this.onWater,
      action,
      equipped: this.equipped,
    });
  }
}

const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/**
 * Draw the handcrafted pixel-art explorer at (x, y) on 1x canvas grid.
 * Supports idle breathing, 4-phase walk stride, ladder climbing, coracle boat
 * rowing on water, harvesting/mining swings, and combat blade slashes.
 */
export function drawPawn(ctx, x, y, facing = 1, ghost = false, anim = {}) {
  const {
    t = 0,
    moving = false,
    legT = 0,
    climbing = false,
    boat = false,
    action = null,
    equipped = null,
  } = anim;

  const f = facing >= 0 ? 1 : -1;

  // Water coracle / rowboat mode
  if (boat) {
    drawBoatRider(ctx, x, y, f, t, moving, legT, ghost);
    return;
  }

  // Contact shadow (omitted on ghost silhouette pass)
  if (!ghost) {
    ctx.fillStyle = 'rgba(20, 16, 30, 0.34)';
    ctx.fillRect(x - 5, y, 10, 2);
    ctx.fillRect(x - 4, y - 1, 8, 1);
    ctx.fillRect(x - 4, y + 2, 8, 1);
  }

  // Climbing pose on ladders
  if (climbing) {
    const climbPhase = Math.floor(legT * 6) % 2;
    const cy = y - 1;
    // Boots alternating rungs
    px(ctx, INK, x - 3, cy - 2 - (climbPhase ? 2 : 0), 3, 3);
    px(ctx, '#6b4228', x - 2, cy - 1 - (climbPhase ? 2 : 0), 1, 1);
    px(ctx, INK, x, cy - 2 - (climbPhase ? 0 : 2), 3, 3);
    px(ctx, '#6b4228', x + 1, cy - 1 - (climbPhase ? 0 : 2), 1, 1);
    // Cloak back view + leather pack
    px(ctx, INK, x - 4, cy - 10, 8, 8);
    px(ctx, '#8c3745', x - 3, cy - 9, 6, 6);
    px(ctx, '#b85060', x - 3, cy - 9, 2, 5);
    px(ctx, '#63232f', x + 1, cy - 9, 2, 6);
    // Backpack on shoulders
    px(ctx, INK, x - 2, cy - 8, 5, 4);
    px(ctx, '#9e683a', x - 1, cy - 7, 3, 2);
    // Reaching hands
    px(ctx, INK, x - 4, cy - 12 - (climbPhase ? 0 : 2), 2, 3);
    px(ctx, '#eccca2', x - 4, cy - 12 - (climbPhase ? 0 : 2), 1, 1);
    px(ctx, INK, x + 2, cy - 12 - (climbPhase ? 2 : 0), 2, 3);
    px(ctx, '#eccca2', x + 3, cy - 12 - (climbPhase ? 2 : 0), 1, 1);
    // Hooded head from behind
    px(ctx, INK, x - 3, cy - 15, 6, 5);
    px(ctx, '#963d4c', x - 2, cy - 14, 4, 3);
    px(ctx, '#bd5968', x - 2, cy - 14, 2, 2);
    return;
  }

  // Compute stride, breathing, and action offsets
  const breathe = !moving && !action && Math.sin(t * 2.6) > 0.35 ? 1 : 0;
  const stride = moving ? Math.sin(legT * Math.PI * 2) : 0;
  const stepLift = moving ? Math.round(Math.abs(Math.cos(legT * Math.PI * 2))) : 0;
  const lunge = action?.kind === 'attack' ? Math.round(Math.sin(action.p * Math.PI) * 2) * f : 0;
  const crouch = action?.kind === 'forage' ? Math.round(Math.sin(action.p * Math.PI) * 2) : 0;

  const bx = x + lunge;
  const by = y - stepLift + crouch;

  // 1. Trailing traveller's backpack on the back shoulder
  const packX = bx - f * 4;
  px(ctx, INK, packX - 1, by - 9 + breathe, 3, 5);
  px(ctx, '#8f5b32', packX, by - 8 + breathe, 1, 3);
  px(ctx, '#c48d56', packX, by - 8 + breathe, 1, 1);

  // 2. Flowing crimson-and-ochre cloak body (billows back while walking)
  const billow = moving ? -f * (Math.abs(stride) > 0.4 ? 2 : 1) : 0;
  px(ctx, INK, bx - 4 + Math.min(0, billow), by - 9 + breathe, 8 + Math.abs(billow), 7);
  px(ctx, INK, bx - 3, by - 10 + breathe, 6, 1);
  // Cloak fill: deep shade right, main body, sunlit left edge
  px(ctx, '#6b2835', bx - 3 + Math.min(0, billow), by - 9 + breathe, 6 + Math.abs(billow), 6);
  px(ctx, '#963d4c', bx - 3, by - 9 + breathe, 5, 6);
  px(ctx, '#bd5968', bx - 3, by - 9 + breathe, 2, 5);
  // Gold cloak hem & throat clasp
  px(ctx, '#e2c26b', bx - 2, by - 4 + breathe, 4, 1);
  px(ctx, '#ffcd75', bx + f, by - 9 + breathe, 1, 1);

  // 3. Boots / feet (drawn after cloak hem so walking stride stays clearly visible)
  const footA = Math.round(stride * 2);
  const footB = -footA;
  const liftA = moving && footA > 0 ? 1 : 0;
  const liftB = moving && footB > 0 ? 1 : 0;
  px(ctx, INK, bx - 3 + footA, y - 2 - liftA, 3, 3);
  px(ctx, '#6b4228', bx - 2 + footA, y - 1 - liftA, 2, 1);
  px(ctx, INK, bx + 1 + footB, y - 2 - liftB, 3, 3);
  px(ctx, '#8f5b32', bx + 1 + footB, y - 1 - liftB, 2, 1);

  // 4. Head, peaked traveller's hood & face
  const hy = by - 14 + breathe;
  px(ctx, INK, bx - 3, hy, 6, 5);
  px(ctx, INK, bx - 2, hy - 1, 4, 1);
  px(ctx, INK, bx - f * 2, hy - 2, 2, 1); // peaked hood tip
  // Hood cowl
  px(ctx, '#963d4c', bx - 2, hy, 4, 2);
  px(ctx, '#bd5968', bx - 2, hy, 2, 2);
  px(ctx, '#963d4c', bx - f, hy - 1, 2, 1);
  // Warm skin face turned toward facing
  px(ctx, '#eccca2', bx - 1 + (f > 0 ? 0 : -1), hy + 1, 3, 3);
  px(ctx, '#d4aa78', bx - (f > 0 ? 1 : 0), hy + 3, 2, 1);
  // Crisp eye
  px(ctx, INK, bx + (f > 0 ? 1 : -1), hy + 2, 1, 1);

  // 5. Held gear / walking staff / tool swing / combat slash
  const staffX = bx + f * 4;
  if (action && (action.kind === 'chop' || action.kind === 'mine' || action.kind === 'build')) {
    const swing = Math.sin(action.p * Math.PI);
    const tx = bx + f * (3 + Math.round(swing * 3));
    const ty = by - 11 + Math.round(swing * 6);
    px(ctx, INK, bx + f * 2, by - 8, 2, 2);
    px(ctx, '#8e5a32', tx - f, ty, 1, 4);
    px(ctx, INK, tx - 1, ty - 2, 3, 3);
    px(ctx, action.kind === 'mine' ? '#b8d0df' : '#d4dde6', tx, ty - 1, 2, 2);
    if (action.p > 0.45 && action.p < 0.85) {
      // Impact sparks / wood chips
      const col = action.kind === 'mine' ? '#ffe588' : '#e2c26b';
      px(ctx, col, tx + f * 2, ty + 2, 1, 1);
      px(ctx, col, tx + f * 3, ty, 1, 1);
    }
  } else if (action && action.kind === 'attack') {
    const sx = bx + f * 5;
    const sy = by - 8;
    // Blade lunge + crescent slash arc
    px(ctx, '#f7f4e8', sx, sy - 1, f * 3, 1);
    px(ctx, '#ffe288', sx + f * 2, sy - 4, 1, 3);
    px(ctx, '#f7a53b', sx + f * 3, sy - 2, 1, 4);
    px(ctx, '#ffe288', sx + f * 2, sy + 2, 1, 2);
  } else {
    // Explorer's ash walking staff (or iron sword tip if equipped) with subtle arm swing
    const swingY = moving ? Math.round(-stride * 1.5) : breathe;
    px(ctx, INK, staffX - 1, by - 12 + swingY, 3, 12);
    px(ctx, '#8e5a32', staffX, by - 11 + swingY, 1, 10);
    px(ctx, '#c48d56', staffX, by - 11 + swingY, 1, 3);
    if (equipped?.weapon) {
      px(ctx, '#d4dde6', staffX, by - 13 + swingY, 1, 3);
    } else {
      px(ctx, '#e2c26b', staffX, by - 12 + swingY, 1, 1);
    }
  }
}

/** Draw the explorer seated in a wooden coracle/rowboat with animated oar & ripples. */
function drawBoatRider(ctx, x, y, f, t, moving, legT, ghost) {
  const bob = Math.sin(t * 2.4) > 0.3 ? 1 : 0;
  const by = y + bob;

  if (!ghost) {
    // Water reflection shadow + lapping ripples
    ctx.fillStyle = 'rgba(18, 24, 58, 0.34)';
    ctx.fillRect(x - 7, by + 2, 14, 2);
    const rip = Math.floor(t * 3) % 2;
    px(ctx, 'rgba(232, 244, 255, 0.55)', x - 8 - rip, by + 2, 2, 1);
    px(ctx, 'rgba(232, 244, 255, 0.55)', x + 7 + rip, by + 1, 2, 1);
  }

  // Seated explorer upper body inside hull
  px(ctx, INK, x - 3, by - 9, 6, 6);
  px(ctx, '#963d4c', x - 2, by - 8, 4, 4);
  px(ctx, '#bd5968', x - 2, by - 8, 2, 3);
  px(ctx, INK, x - 3, by - 14, 6, 5);
  px(ctx, '#963d4c', x - 2, by - 13, 4, 2);
  px(ctx, '#eccca2', x - 1 + (f > 0 ? 0 : -1), by - 11, 3, 2);
  px(ctx, INK, x + (f > 0 ? 1 : -1), by - 11, 1, 1);

  // Wooden rowboat hull
  px(ctx, INK, x - 8, by - 4, 16, 5);
  px(ctx, INK, x - 6, by + 1, 12, 2);
  px(ctx, '#5e381d', x - 7, by - 3, 14, 3);
  px(ctx, '#8e5a32', x - 6, by - 3, 12, 2);
  px(ctx, '#be8550', x - 6, by - 3, 7, 1);
  // Bow accent in facing direction
  px(ctx, '#e2c26b', x + f * 6, by - 4, 1, 1);

  // Animated rowing oar
  const stroke = moving ? Math.round(Math.sin(legT * Math.PI * 2) * 2) : Math.round(Math.sin(t * 1.8));
  px(ctx, INK, x - 1 + stroke, by - 3, 2, 6);
  px(ctx, '#c48d56', x + stroke, by - 2, 1, 4);
  px(ctx, '#e5c690', x + stroke, by + 2, 2, 1);
}
