// camera.js
// Pan, integer zoom, and following the player.
//
// The camera works entirely in 1x world pixels and never holds a fractional
// position. That is what keeps the art clean: docs/new_tiles.md is explicit that
// this tileset must be scaled by whole numbers with nearest-neighbour, or the hex
// diagonals and the 1px wall highlight crawl.

export const ZOOM_STEPS = [2, 3, 4, 5, 6];

/**
 * Backing-store scale for the canvas — the device pixel ratio, floored.
 *
 * A ratio of 1.5 is common, and honouring it exactly would put a fractional
 * factor between the buffer and the screen, which is precisely what
 * docs/new_tiles.md says makes the hex diagonals and the 1px wall highlight
 * crawl. Rounding down loses a little sharpness on such displays and keeps every
 * step of the chain a whole number, which matters more for this art.
 */
export const pixelScale = () =>
  Math.max(1, Math.min(3, Math.floor(window.devicePixelRatio || 1)));

export class Camera {
  constructor({ scale = 3 } = {}) {
    this.x = 0;             // world px at the viewport's left edge
    this.y = 0;             // world px at the viewport's top edge
    this.scale = ZOOM_STEPS.includes(scale) ? scale : 3;
    this.targetX = 0;
    this.targetY = 0;
    this.viewW = 1;         // viewport size in world px
    this.viewH = 1;
  }

  setViewport(pixelW, pixelH) {
    this.viewW = Math.ceil(pixelW / this.scale);
    this.viewH = Math.ceil(pixelH / this.scale);
  }

  /** Centre the view on a world point, immediately. */
  centerOn(wx, wy) {
    this.targetX = wx - this.viewW / 2;
    this.targetY = wy - this.viewH / 2;
    this.x = this.targetX;
    this.y = this.targetY;
  }

  /** Ask the camera to move here; `update` eases towards it. */
  moveTo(wx, wy) {
    this.targetX = wx - this.viewW / 2;
    this.targetY = wy - this.viewH / 2;
  }

  panBy(dxWorld, dyWorld) {
    this.targetX += dxWorld;
    this.targetY += dyWorld;
    this.x = this.targetX;
    this.y = this.targetY;
  }

  update(dt) {
    // Exponential ease, frame-rate independent.
    const k = 1 - Math.exp(-10 * dt);
    this.x += (this.targetX - this.x) * k;
    this.y += (this.targetY - this.y) * k;
  }

  /**
   * Zoom one step, keeping the world point under (screenX, screenY) put.
   * @param {number} dir  +1 in, -1 out
   */
  zoom(dir, screenX, screenY, pixelW, pixelH) {
    const i = ZOOM_STEPS.indexOf(this.scale);
    const next = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, i + dir))];
    if (next === this.scale) return false;

    const anchor = this.screenToWorld(screenX, screenY);
    this.scale = next;
    this.setViewport(pixelW, pixelH);
    // Put the anchor back under the cursor.
    this.targetX = anchor.x - screenX / this.scale;
    this.targetY = anchor.y - screenY / this.scale;
    this.x = this.targetX;
    this.y = this.targetY;
    return true;
  }

  /** Rounded origin actually used for drawing — never fractional. */
  get originX() { return Math.round(this.x); }
  get originY() { return Math.round(this.y); }

  screenToWorld(sx, sy) {
    return { x: sx / this.scale + this.x, y: sy / this.scale + this.y };
  }

  worldToScreen(wx, wy) {
    return { x: (wx - this.originX) * this.scale, y: (wy - this.originY) * this.scale };
  }

  /** Visible world rectangle, padded so tall columns and trees are not clipped. */
  viewBounds(pad = 64) {
    return {
      left: this.originX - pad,
      top: this.originY - pad,
      right: this.originX + this.viewW + pad,
      bottom: this.originY + this.viewH + pad,
    };
  }
}
