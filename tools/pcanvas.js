// pcanvas.js — tiny 16x16 pixel canvas for authoring icons with guaranteed alignment.
// Draw with explicit coordinates, get an automatic 1px ink outline, emit a grid.
export const SIZE = 16;

export class P {
  constructor() {
    this.g = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  }
  px(x, y, c) {
    if (c && x >= 0 && x < SIZE && y >= 0 && y < SIZE) this.g[y][x] = c;
  }
  // erase back to empty (px() ignores null, so clearing needs its own write)
  clear(x, y, w = 1, h = 1) {
    for (let j = y; j < y + h; j++)
      for (let i = x; i < x + w; i++)
        if (i >= 0 && i < SIZE && j >= 0 && j < SIZE) this.g[j][i] = null;
  }
  rect(x, y, w, h, c) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.px(i, j, c);
  }
  hline(x, y, len, c) { this.rect(x, y, len, 1, c); }
  vline(x, y, len, c) { this.rect(x, y, 1, len, c); }
  // staircase diagonal (1px wide): steps diagonally, then straight on the longer axis
  diag(x0, y0, x1, y1, c) {
    const dx = Math.sign(x1 - x0), dy = Math.sign(y1 - y0);
    const steps = Math.min(Math.abs(x1 - x0), Math.abs(y1 - y0));
    let x = x0, y = y0, guard = 0;
    this.px(x, y, c);
    for (let i = 0; i < steps; i++) { x += dx; y += dy; this.px(x, y, c); }
    while (dx !== 0 && x !== x1 && guard++ < 64) { x += dx; this.px(x, y, c); }
    while (dy !== 0 && y !== y1 && guard++ < 64) { y += dy; this.px(x, y, c); }
  }
  // filled ellipse; pass c = null to punch a hole (rings, pot mouths, wheel hubs)
  ellipse(cx, cy, rx, ry, c) {
    const a = (rx + 0.5) * (rx + 0.5), b = (ry + 0.5) * (ry + 0.5);
    for (let dy = -ry; dy <= ry; dy++)
      for (let dx = -rx; dx <= rx; dx++)
        if ((dx * dx) / a + (dy * dy) / b <= 1) {
          if (c === null) this.clear(cx + dx, cy + dy);
          else this.px(cx + dx, cy + dy, c);
        }
  }
  circle(cx, cy, r, c) {
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++)
        if (dx * dx + dy * dy <= r * r + (r >> 1)) this.px(cx + dx, cy + dy, c);
  }
  // stepped pyramid: 1px wide at y0, growing 1px each side per row down to y1
  pyramid(cx, y0, y1, c) {
    for (let y = y0; y <= y1; y++) { const n = y - y0; this.rect(cx - n, y, 2 * n + 1, 1, c); }
  }
  outline() {
    const add = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) {
        if (this.g[y][x]) continue;
        let hit = false;
        for (let dy = -1; dy <= 1 && !hit; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < SIZE && ny >= 0 && ny < SIZE && this.g[ny][nx]) { hit = true; break; }
          }
        if (hit) add[y][x] = true;
      }
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x < SIZE; x++) if (!this.g[y][x] && add[y][x]) this.g[y][x] = 'k';
  }
  grid() {
    return this.g.map((row) => row.map((c) => c || '.').join(''));
  }
}

export function draw(fn) {
  const p = new P();
  fn(p);
  p.outline();
  return p.grid();
}
