// newtiles_map.js — lay the new_tiles sprites out on their hex lattice and
// render a PNG, to check the derived geometry against the actual artwork.
//
// Geometry measured from the art (see docs/new_tiles.md):
//   frame        32 x 48
//   top face     flat-top hexagon 32 wide x 24 tall, at rows 16..39
//   wall         8px, rows 40..47
//   headroom     16px, rows 0..15, for trees and other tall decor
//   layout       x = col*26,  y = row*24 + (col & 1)*12   (flat-top, odd-q)
//   draw order   back to front by screen y, because walls and tall decor
//                overlap the tiles behind them
import { writeFileSync, readdirSync } from 'node:fs';
import { readPng } from './png_read.js';
import { png } from './preview.js';

export const FRAME_W = 32, FRAME_H = 48;
export const FACE_TOP = 16, FACE_H = 24, WALL_H = 8;
export const STEP_X = 26, STEP_Y = 24, COL_OFFSET_Y = 12;
const DIRS = ['new_tiles', 'new_tiles_gen'];

const sheets = new Map();
export function frame(sheet, i) {
  if (!sheets.has(sheet)) {
    let img = null;
    for (const d of DIRS) { try { img = readPng(`${d}/${sheet}.png`); break; } catch { /* try next dir */ } }
    if (!img) throw new Error(`sheet not found in ${DIRS.join(' or ')}: ${sheet}`);
    sheets.set(sheet, img);
  }
  const img = sheets.get(sheet);
  return { img, ox: i * FRAME_W };
}

export function renderMap(cells, cols, rows, file, scale = 3, bg = [40, 44, 52]) {
  // world extent, allowing for headroom above and the wall below
  const W = (cols - 1) * STEP_X + FRAME_W;
  const H = (rows - 1) * STEP_Y + COL_OFFSET_Y + FRAME_H;
  const buf = Buffer.alloc(W * H * 3);
  for (let i = 0; i < buf.length; i += 3) { buf[i] = bg[0]; buf[i + 1] = bg[1]; buf[i + 2] = bg[2]; }

  // painter's algorithm: back to front by screen y, then by column
  const order = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) order.push([c, r]);
  order.sort((a, b) => (a[1] * STEP_Y + (a[0] & 1) * COL_OFFSET_Y) - (b[1] * STEP_Y + (b[0] & 1) * COL_OFFSET_Y) || a[0] - b[0]);

  for (const [c, r] of order) {
    const pick = cells(c, r);
    if (!pick) continue;
    const { img, ox } = frame(pick[0], pick[1]);
    const px0 = c * STEP_X, py0 = r * STEP_Y + (c & 1) * COL_OFFSET_Y;
    for (let y = 0; y < FRAME_H; y++)
      for (let x = 0; x < FRAME_W; x++) {
        const s = (y * img.width + ox + x) * 4;
        if (img.data[s + 3] === 0) continue;
        const dx = px0 + x, dy = py0 + y;
        if (dx < 0 || dy < 0 || dx >= W || dy >= H) continue;
        const d = (dy * W + dx) * 3;
        buf[d] = img.data[s]; buf[d + 1] = img.data[s + 1]; buf[d + 2] = img.data[s + 2];
      }
  }

  const SW = W * scale, SH = H * scale;
  const out = Buffer.alloc(SW * SH * 3);
  for (let y = 0; y < SH; y++)
    for (let x = 0; x < SW; x++) {
      const s = (Math.floor(y / scale) * W + Math.floor(x / scale)) * 3;
      const d = (y * SW + x) * 3;
      out[d] = buf[s]; out[d + 1] = buf[s + 1]; out[d + 2] = buf[s + 2];
    }
  writeFileSync(file, png(SW, SH, out));
  return { W: SW, H: SH };
}

if (process.argv[2] && process.argv[1].replace(/\\/g, '/').split('/').pop() === 'newtiles_map.js') {
  const file = process.argv[2];
  const mode = process.argv[3] || 'grass';
  const grass = ['Tiles_GrassBase1', 'Tiles_GrassBase2', 'Tiles_GrassBase3'];
  const hash = (c, r) => Math.abs(((c * 73856093) ^ (r * 19349663)) >>> 0);
  let cells;
  if (mode === 'grass') {
    cells = (c, r) => [grass[hash(c, r) % 3], hash(c + 7, r + 3) % 6];
  } else if (mode === 'mixed') {
    cells = (c, r) => {
      const h = hash(c, r);
      if (c >= 2 && c <= 4 && r >= 2 && r <= 3) return ['Tiles_LakeBase', h % 6];
      if (c === 1 && r >= 1) return ['Tiles_PathsStraight', 0];
      if (h % 5 === 0) return ['Tiles_DecorPine', h % 6];
      if (h % 7 === 0) return ['Tiles_DecorOak', h % 6];
      if (h % 11 === 0) return ['Tiles_FarmingPumpkins', h % 6];
      return [grass[h % 3], (h >> 3) % 6];
    };
  } else if (mode === 'blend') {
    const plan = [
      ['Tiles_GrassBase1','Tiles_GrassBase2','Tiles_Steppes','Tiles_Steppes','Tiles_Stony','Tiles_Stony','Tiles_Stony','Tiles_Steppes'],
      ['Tiles_DecorOak','Tiles_GrassBase3','Tiles_GrassBase1','Tiles_Steppes','Tiles_Stony','Tiles_PineFloor','Tiles_Stony','Tiles_Steppes'],
      ['Tiles_ForestFloor','Tiles_DecorOak','Tiles_GrassBase2','Tiles_FlowingWater','Tiles_FlowingWater','Tiles_PineFloor','Tiles_DecorPine','Tiles_Stony'],
      ['Tiles_ForestFloor','Tiles_ForestFloor','Tiles_FlowingWater','Tiles_LakeBase','Tiles_LakeBase','Tiles_FlowingWater','Tiles_PineFloor','Tiles_DecorPine'],
      ['Tiles_DecorOak','Tiles_ForestFloor','Tiles_FlowingWater','Tiles_LakeBase','Tiles_FlowingWater','Tiles_PineFloor','Tiles_PineFloor','Tiles_DecorPine'],
      ['Tiles_GrassBase1','Tiles_GrassBase3','Tiles_FarmingPumpkins','Tiles_GrassBase2','Tiles_FlowingWater','Tiles_ForestFloor','Tiles_DecorPine','Tiles_PineFloor'],
      ['Tiles_GrassBase2','Tiles_FarmingBase','Tiles_FarmingPumpkins','Tiles_GrassBase1','Tiles_Steppes','Tiles_ForestFloor','Tiles_PineFloor','Tiles_Stony'],
    ];
    cells = (c, rw) => {
      const row = plan[((rw % plan.length) + plan.length) % plan.length];
      const name = row[((c % row.length) + row.length) % row.length];
      return [name, hash(c + 5, rw + 11) % 6];
    };
  } else {
    cells = () => [mode, 0];
  }
  const r = renderMap(cells, 8, 7, file, Number(process.argv[4]) || 3);
  console.log(`${file} ${r.W}x${r.H} (${mode})`);
}
