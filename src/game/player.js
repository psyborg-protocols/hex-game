// player.js
// Where the player is, where they are walking, and the animated explorer who
// stands in for them: idle breathing, walking stride, ladder climbing, rowing
// a boat across the river, harvesting/mining swings, and combat lunges.

import { tileCenter } from '../world/hexgrid.js';
import { isWater } from '../world/tileset.js';
import { isBridged } from '../world/pathfinding.js';
import { drawPawn } from '../render/player_sprite.js';

export { drawPawn };
export const WALK_TILES_PER_SEC = 3.2;

const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

export class Player {
  constructor(map, at) {
    this.map = map;
    this.q = at.q;
    this.r = at.r;
    this.path = [];        // remaining columns, current tile first
    this.leg = null;       // { from, to, t, duration }
    this.facing = 1;       // +1 right, -1 left (when dir === 'side')
    this.dir = 'side';     // 'side' | 'up' | 'down'
    this.walkPhase = 0;    // continuous locomotion phase [0, 1) across multi-hex walks
    this.seated = false;   // resting beside the cold campfire at start
    this.animTime = 0;     // accumulated animation clock (seconds)
    this.actionAnim = null;// { kind, start, until }
    this.equipped = null;  // 6-slot snapshot { head, hand, offhand, body, feet, pack, chopTool, mineTool }
    this.onArrive = null;
    this.onStep = null;    // called with (q, r) each time a tile is reached
    this.speedAt = null;   // (from, to) => speed multiplier for that step
  }

  /** Face toward an adjacent or distant hex across 4 directions (up, down, left, right). */
  faceToward(q, r) {
    if (q === this.q && r === this.r) return;
    if (q === this.q) {
      this.dir = r < this.r ? 'up' : 'down';
    } else {
      this.dir = 'side';
      this.facing = q > this.q ? 1 : -1;
    }
  }

  get h() { return Math.max(0, this.map.surfaceAt(this.q, this.r)); }
  get moving() { return !!this.leg; }

  /** Trigger a brief character action animation ('chop' | 'mine' | 'forage' | 'attack' | 'build'). */
  triggerAction(kind, durationSec = 0.55) {
    this.seated = false;
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
   * Interpolated screen position with per-tile quadratic easing across every
   * step, hopping only when stepping up/down elevation or climbing ladders.
   */
  get pos() {
    if (!this.leg) {
      const { cx, cy } = this.restingPos;
      return { x: cx, y: cy };
    }
    const { from, to, t } = this.leg;
    const ah = Math.max(0, this.map.surfaceAt(from.q, from.r));
    const bh = Math.max(0, this.map.surfaceAt(to.q, to.r));
    const a = tileCenter(from.q, from.r, ah);
    const b = tileCenter(to.q, to.r, bh);
    const clampedT = Math.min(1, t);
    const e = ease(clampedT);
    const hop = this.climbing
      ? Math.sin(clampedT * Math.PI) * 1
      : (ah !== bh ? Math.sin(clampedT * Math.PI) * 1.5 : 0);
    return {
      x: a.cx + (b.cx - a.cx) * e,
      y: a.cy + (b.cy - a.cy) * e - hop,
    };
  }

  /** Start walking a route. Pass the array findPath returned. */
  follow(path, onArrive = null) {
    this.seated = false;
    if (!path || path.length < 2) {
      this.path = [];
      this.leg = null;
      this.walkPhase = 0;
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
    this.walkPhase = 0;
    this.onArrive = null;
  }

  beginLeg() {
    const next = this.path.shift();
    if (!next) {
      this.leg = null;
      this.walkPhase = 0;
      const done = this.onArrive;
      this.onArrive = null;
      if (done) done();
      return;
    }
    const from = { q: this.q, r: this.r };
    this.faceToward(next.q, next.r);
    const mult = this.speedAt ? this.speedAt(from, next) : 1;
    this.leg = { from, to: next, t: 0, duration: 1 / (WALK_TILES_PER_SEC * mult) };
  }

  update(dt) {
    this.animTime += dt;
    if (this.actionAnim && this.animTime >= this.actionAnim.until) {
      this.actionAnim = null;
    }
    if (!this.leg) {
      this.walkPhase = 0;
      return;
    }
    this.walkPhase = (this.walkPhase + dt * 2.2) % 1;
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
      dir: this.dir,
      moving: this.moving,
      legT: this.leg ? this.leg.t : 0,
      walkPhase: this.walkPhase,
      climbing: this.climbing,
      boat: this.onWater,
      seated: this.seated && !this.moving && !action,
      action,
      equipped: this.equipped,
    });
  }
}

