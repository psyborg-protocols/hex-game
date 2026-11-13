// render_showcase_pngs.js — Renders 4x integer-scaled preview PNG sheets of the
// revamped pixel art directly from structures.js, player.js, units.js, and
// new_tiles/Tiles_Bridge.png using a tiny software 2D context shim.
//
// Usage: node tools/render_showcase_pngs.js [outDir]

import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { readPng } from './png_read.js';
import { encodePngRGBA } from './png_write.js';
import { drawStructure, drawVillage, drawCamp, drawBridgeDeck, drawLadder, drawLadderTop, drawCrossing } from '../src/render/structures.js';
import { drawPawn } from '../src/game/player.js';
import { drawFigure, drawDog } from '../src/render/units.js';
import { GEOM } from '../src/world/hexgrid.js';

function parseColor(s) {
  if (!s) return [0, 0, 0, 255];
  if (s.startsWith('#')) {
    const hex = s.slice(1);
    const n = parseInt(hex, 16);
    if (hex.length === 6) return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const p = m[1].split(',').map(Number);
    return [p[0] | 0, p[1] | 0, p[2] | 0, p.length > 3 ? Math.round(p[3] * 255) : 255];
  }
  return [255, 255, 255, 255];
}

function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    const intersect = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi + 1e-9) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

class SoftCtx {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.buf = Buffer.alloc(w * h * 4);
    this.fillStyle = '#000000';
    this.path = [];
    this.clipPoly = null;
    this.stack = [];
  }
  blendPixel(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    if (this.clipPoly && !pointInPoly(x + 0.5, y + 0.5, this.clipPoly)) return;
    const a = c[3] / 255;
    const o = (y * this.w + x) * 4;
    if (a >= 0.999) {
      this.buf[o] = c[0]; this.buf[o + 1] = c[1]; this.buf[o + 2] = c[2]; this.buf[o + 3] = 255;
    } else if (a > 0) {
      const ia = 1 - a;
      this.buf[o] = Math.round(c[0] * a + this.buf[o] * ia);
      this.buf[o + 1] = Math.round(c[1] * a + this.buf[o + 1] * ia);
      this.buf[o + 2] = Math.round(c[2] * a + this.buf[o + 2] * ia);
      this.buf[o + 3] = 255;
    }
  }
  fillRect(x, y, w, h) {
    const c = parseColor(this.fillStyle);
    const x0 = Math.round(x), y0 = Math.round(y);
    const x1 = Math.round(x + w), y1 = Math.round(y + h);
    for (let yy = Math.min(y0, y1); yy < Math.max(y0, y1); yy++) {
      for (let xx = Math.min(x0, x1); xx < Math.max(x0, x1); xx++) {
        this.blendPixel(xx, yy, c);
      }
    }
  }
  beginPath() { this.path = []; }
  moveTo(x, y) { this.path.push([x, y]); }
  lineTo(x, y) { this.path.push([x, y]); }
  rect(x, y, w, h) { this.path.push([x, y], [x + w, y], [x + w, y + h], [x, y + h]); }
  closePath() {}
  clip() { this.clipPoly = this.path.slice(); }
  save() { this.stack.push(this.clipPoly ? this.clipPoly.slice() : null); }
  restore() { this.clipPoly = this.stack.pop() || null; }
  fill() {
    if (this.path.length < 3) return;
    const c = parseColor(this.fillStyle);
    let minX = this.w, minY = this.h, maxX = 0, maxY = 0;
    for (const [x, y] of this.path) {
      if (x < minX) minX = Math.floor(x);
      if (y < minY) minY = Math.floor(y);
      if (x > maxX) maxX = Math.ceil(x);
      if (y > maxY) maxY = Math.ceil(y);
    }
    for (let y = Math.max(0, minY); y <= Math.min(this.h - 1, maxY); y++) {
      for (let x = Math.max(0, minX); x <= Math.min(this.w - 1, maxX); x++) {
        if (pointInPoly(x + 0.5, y + 0.5, this.path)) this.blendPixel(x, y, c);
      }
    }
  }
  drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) {
    dx = Math.round(dx); dy = Math.round(dy);
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const s = ((sy + y) * img.width + (sx + x)) * 4;
        if (img.data[s + 3] === 0) continue;
        this.blendPixel(dx + x, dy + y, [img.data[s], img.data[s + 1], img.data[s + 2], img.data[s + 3]]);
      }
    }
  }
}

function upscaleAndWrite(ctx, file, scale = 4) {
  const SW = ctx.w * scale, SH = ctx.h * scale;
  const out = Buffer.alloc(SW * SH * 4);
  for (let y = 0; y < SH; y++) {
    const sy = Math.floor(y / scale);
    for (let x = 0; x < SW; x++) {
      const sx = Math.floor(x / scale);
      const s = (sy * ctx.w + sx) * 4;
      const d = (y * SW + x) * 4;
      out[d] = ctx.buf[s]; out[d + 1] = ctx.buf[s + 1]; out[d + 2] = ctx.buf[s + 2]; out[d + 3] = 255;
    }
  }
  writeFileSync(file, encodePngRGBA(SW, SH, out));
  console.log(`wrote ${file} (${SW}x${SH})`);
}

const outDir = process.argv[2] || '.';
mkdirSync(outDir, { recursive: true });

const grass1 = readPng('new_tiles/Tiles_GrassBase1.png');
const grass2 = readPng('new_tiles/Tiles_GrassBase2.png');
const steppes = readPng('new_tiles/Tiles_Steppes.png');
const stony = readPng('new_tiles/Tiles_Stony.png');
const lake = readPng('new_tiles/Tiles_LakeBase.png');
const bridge = readPng('new_tiles/Tiles_Bridge.png');

const pedestal = (ctx, sheet, frame, cx, cy, h = 0) => {
  for (let lv = 0; lv <= h; lv++) {
    ctx.drawImage(sheet, frame * 32, 0, 32, 48, cx - 16, cy - 28 - lv * GEOM.wallHeight, 32, 48);
  }
  return { x: cx, y: cy - h * GEOM.wallHeight };
};

// 1. Huts, Homestead Structures, All 6 Villages, and Camps
{
  const ctx = new SoftCtx(230, 146);
  ctx.fillStyle = '#171a21';
  ctx.fillRect(0, 0, ctx.w, ctx.h);

  const structs = ['hut', 'hearth', 'workbench', 'watchtower', 'forge', 'shrine'];
  structs.forEach((id, i) => {
    const cx = 24 + i * 36, cy = 44;
    const top = pedestal(ctx, grass1, i % 4, cx, cy, 0);
    drawStructure(ctx, top.x, top.y, id, 0.7);
  });

  const villages = ['farmers', 'woodcutters', 'masons', 'fishers', 'herbalists', 'smiths'];
  villages.forEach((kind, i) => {
    const cx = 24 + i * 36, cy = 92;
    const top = pedestal(ctx, grass2, i % 4, cx, cy, 0);
    drawVillage(ctx, top.x, top.y, 0.7, kind, {});
  });

  // Row 3: Palisade, Stone Wall, Raider Camp, Warlord Hold
  drawStructure(ctx, pedestal(ctx, grass1, 0, 36, 134, 0).x, 134, 'palisade', 0.7);
  drawStructure(ctx, pedestal(ctx, grass1, 1, 80, 134, 0).x, 134, 'stone_wall', 0.7);
  drawCamp(ctx, pedestal(ctx, steppes, 2, 132, 134, 0).x, 134, 0.7, { boss: false });
  drawCamp(ctx, pedestal(ctx, steppes, 3, 184, 134, 0).x, 134, 0.7, { boss: true });

  upscaleAndWrite(ctx, join(outDir, 'preview_villages_and_huts.png'), 4);
}

// 2. Bridges & Ladders
{
  const ctx = new SoftCtx(230, 128);
  ctx.fillStyle = '#171a21';
  ctx.fillRect(0, 0, ctx.w, ctx.h);

  // Top row: 3 Bridge axes + Crossing raft
  [0, 1, 2].forEach((frame, i) => {
    const cx = 28 + i * 50, cy = 50;
    pedestal(ctx, lake, 0, cx, cy, 0);
    drawBridgeDeck(ctx, bridge, frame, { x: cx, y: cy - 16 }, 16, 0.6);
  });
  const crossTop = pedestal(ctx, lake, 0, 184, 48, 0);
  drawCrossing(ctx, crossTop.x, crossTop.y, 2, 1, 0.6);

  // Bottom row: Ladders on N, NE, NW, and Far Lip S
  {
    const cx = 28, cy = 112;
    pedestal(ctx, stony, 1, cx, cy - 16, 3);
    const low = pedestal(ctx, grass1, 0, cx, cy, 0);
    drawLadder(ctx, low, 0, 3 * GEOM.wallHeight);
  }
  {
    const cx = 78, cy = 112;
    pedestal(ctx, stony, 2, cx + 13, cy - 12, 3);
    const low = pedestal(ctx, grass1, 0, cx, cy, 0);
    drawLadder(ctx, low, 1, 3 * GEOM.wallHeight);
  }
  {
    const cx = 138, cy = 112;
    pedestal(ctx, stony, 3, cx - 13, cy - 12, 3);
    const low = pedestal(ctx, grass1, 0, cx, cy, 0);
    drawLadder(ctx, low, 5, 3 * GEOM.wallHeight);
  }
  {
    const cx = 188, cy = 116;
    pedestal(ctx, grass1, 0, cx, cy, 0);
    const up = pedestal(ctx, stony, 0, cx, cy - 14, 3);
    drawLadderTop(ctx, up, 3);
  }

  upscaleAndWrite(ctx, join(outDir, 'preview_bridges_and_ladders.png'), 4);
}

// 3. Player Animations & Units
{
  const ctx = new SoftCtx(230, 102);
  ctx.fillStyle = '#171a21';
  ctx.fillRect(0, 0, ctx.w, ctx.h);

  const playerPoses = [
    { sheet: grass1, anim: { t: 0.2, moving: false } },
    { sheet: grass1, anim: { t: 0.4, moving: true, legT: 0.25 } },
    { sheet: grass1, anim: { t: 0.4, moving: true, legT: 0.3, climbing: true } },
    { sheet: lake, anim: { t: 0.4, moving: true, legT: 0.25, boat: true } },
    { sheet: grass1, anim: { t: 0.5, action: { kind: 'chop', p: 0.55 } } },
    { sheet: grass1, anim: { t: 0.5, action: { kind: 'attack', p: 0.5 } } },
  ];
  playerPoses.forEach((p, i) => {
    const cx = 24 + i * 36, cy = 40;
    const top = pedestal(ctx, p.sheet, 0, cx, cy, 0);
    drawPawn(ctx, top.x, top.y, 1, false, p.anim);
  });

  const unitKinds = ['raider', 'brute', 'warlord', 'militia', 'villager'];
  unitKinds.forEach((kind, i) => {
    const cx = 24 + i * 36, cy = 88;
    const top = pedestal(ctx, grass2, 0, cx, cy, 0);
    drawFigure(ctx, top.x, top.y, kind, 1, 0.5, 0, false, true, 0.25);
  });
  const dogTop = pedestal(ctx, grass2, 0, 204, 88, 0);
  drawDog(ctx, dogTop.x, dogTop.y, 1, 0.5);

  upscaleAndWrite(ctx, join(outDir, 'preview_player_and_units.png'), 4);
}
