// tile_preview.js — lay hex tiles out on the real lattice and render a PNG,
// plus a brute-force proof that the hexagon tiles the plane exactly.
//
// Usage:
//   node tools/tile_preview.js --verify                 # tiling proof, no image
//   node tools/tile_preview.js patch.png meadow         # a field of one tile
//   node tools/tile_preview.js all.png                  # every tile, 3x3 patches
//   node tools/tile_preview.js map.png --map            # mixed terrain map
import { writeFileSync } from 'node:fs';
import { png } from './preview.js';
import { HEX_W, HEX_H, INSET, V1, V2, inHex, drawTile } from './hexcanvas.js';
import { TILES, drawTerrain } from './tiles.js';
import { PALETTE } from './palette.js';

// how many variants of each terrain are generated and cycled over a map
export const VARIANTS = 4;
// cheap positional hash, so a given hex always draws the same variant
export const pickVariant = (c, r) => Math.abs(((c * 73856093) ^ (r * 19349663)) >>> 0) % VARIANTS;
export const variantsOf = (name) =>
  Array.from({ length: VARIANTS }, (_, i) => drawTerrain(name, 1 + i * 977));

const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

// ---------------------------------------------------------------- tiling proof
export function verify() {
  const problems = [];
  // 1. the meshing identity the interlock depends on
  const cap = INSET.slice(0, 9);
  for (let u = 0; u < cap.length; u++) {
    const sum = cap[u] + cap[cap.length - 1 - u];
    if (sum !== HEX_W / 2) problems.push(`inset pair ${u}: ${cap[u]}+${cap[cap.length - 1 - u]} = ${sum}, need ${HEX_W / 2}`);
  }
  // 2. hex area must equal the lattice cell area
  const area = INSET.reduce((s, a) => s + (HEX_W - 2 * a), 0);
  const cell = Math.abs(V1[0] * V2[1] - V1[1] * V2[0]);
  if (area !== cell) problems.push(`hex covers ${area}px but the lattice cell is ${cell}px`);
  // 3. brute force: every pixel of a large region belongs to exactly one hex
  const X0 = -40, X1 = 200, Y0 = -40, Y1 = 200;
  const count = new Map();
  for (let j = -6; j <= 14; j++)
    for (let i = -6; i <= 14; i++) {
      const ox = i * V1[0] + j * V2[0], oy = i * V1[1] + j * V2[1];
      for (let y = 0; y < HEX_H; y++)
        for (let x = INSET[y]; x < HEX_W - INSET[y]; x++) {
          const px = ox + x, py = oy + y;
          if (px < X0 || px >= X1 || py < Y0 || py >= Y1) continue;
          const k = py * 1000 + px;
          count.set(k, (count.get(k) || 0) + 1);
        }
    }
  // only judge the interior, where every covering hex is inside the loop above
  let gaps = 0, overlaps = 0, checked = 0;
  for (let y = Y0 + 60; y < Y1 - 60; y++)
    for (let x = X0 + 60; x < X1 - 60; x++) {
      const n = count.get(y * 1000 + x) || 0;
      checked++;
      if (n === 0) gaps++;
      else if (n > 1) overlaps++;
    }
  if (gaps) problems.push(`${gaps} uncovered pixel(s) — the tiling has gaps`);
  if (overlaps) problems.push(`${overlaps} doubly-covered pixel(s) — the tiling overlaps`);

  // 4. every drawn tile pixel must land inside the hexagon
  for (const [name, fn] of Object.entries(TILES)) {
    const g = drawTerrain(name, 1);
    if (g.length !== HEX_H) { problems.push(`${name}: ${g.length} rows, need ${HEX_H}`); continue; }
    let holes = 0, outside = 0, bad = 0;
    g.forEach((row, y) => {
      if (row.length !== HEX_W) problems.push(`${name} row ${y}: width ${row.length}`);
      for (let x = 0; x < HEX_W; x++) {
        const ch = row[x], within = inHex(x, y);
        if (within && ch === '.') holes++;
        if (!within && ch !== '.') outside++;
        if (ch !== '.' && !(ch in PALETTE)) bad++;
      }
    });
    if (holes) problems.push(`${name}: ${holes} unpainted pixel(s) inside the hex`);
    if (outside) problems.push(`${name}: ${outside} pixel(s) outside the hex`);
    if (bad) problems.push(`${name}: ${bad} pixel(s) with a colour outside the palette`);
  }

  const ratio = (HEX_W / HEX_H).toFixed(4);
  console.log(problems.length
    ? `TILING PROBLEMS:\n  ${problems.join('\n  ')}`
    : `tiling verified: ${area}px hex == ${cell}px lattice cell, ${checked} interior pixels each covered exactly once\n` +
      `geometry: ${HEX_W}x${HEX_H}, w/h ${ratio} (regular hexagon is 0.8660), col step ${V1[0]}, row step ${V2[1]}, odd-row offset ${V2[0]}`);
  return problems.length === 0;
}

// ---------------------------------------------------------------- patch render
function blit(buf, W, H, grid, ox, oy) {
  for (let y = 0; y < HEX_H; y++)
    for (let x = INSET[y]; x < HEX_W - INSET[y]; x++) {
      const ch = grid[y][x];
      if (ch === '.') continue;
      const px = ox + x, py = oy + y;
      if (px < 0 || py < 0 || px >= W || py >= H) continue;
      const [r, g, b] = rgb(PALETTE[ch]);
      const i = (py * W + px) * 3;
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
    }
}

// rows x cols of hexes on the lattice
export function renderPatch(pick, cols, rows, file, scale = 3) {
  const W = cols * V1[0], H = rows * V2[1] + (HEX_H - V2[1]);
  const buf = Buffer.alloc(W * H * 3, 24);
  for (let r = 0; r < rows; r++)
    for (let c = -1; c <= cols; c++) {
      const ox = c * V1[0] + (r % 2) * V2[0], oy = r * V2[1];
      blit(buf, W, H, pick(c, r), ox, oy);
    }
  // nearest-neighbour upscale
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

const args = process.argv.slice(2);
if (args.length && process.argv[1] && process.argv[1].endsWith('tile_preview.js')) {
  if (args[0] === '--verify') {
    process.exit(verify() ? 0 : 1);
  } else if (args.includes('--map')) {
    const file = args[0];
    const names = Object.keys(TILES);
    const grids = Object.fromEntries(names.map((n) => [n, variantsOf(n)]));
    // a hand-laid map so each terrain meets several others
    const plan = [
      ['meadow', 'meadow', 'grassland', 'grassland', 'steppes', 'steppes'],
      ['forest_bed', 'meadow', 'grassland', 'steppes', 'steppes', 'stony'],
      ['pine_forest_bed', 'forest_bed', 'stream', 'stream', 'stony', 'stony'],
      ['pine_forest_bed', 'stream', 'deep_water', 'deep_water', 'stream', 'stony'],
      ['forest_bed', 'grassland', 'stream', 'deep_water', 'deep_water', 'meadow'],
      ['meadow', 'grassland', 'grassland', 'stream', 'meadow', 'meadow'],
    ];
    const r = renderPatch((c, rw) => grids[plan[((rw % plan.length) + plan.length) % plan.length][((c % 6) + 6) % 6]][pickVariant(c, rw)],
      6, plan.length, file, 4);
    console.log(`${file} ${r.W}x${r.H} (mixed map)`);
  } else if (args[1]) {
    const file = args[0], name = args[1];
    if (!TILES[name]) { console.error(`no tile "${name}" — have: ${Object.keys(TILES).join(', ')}`); process.exit(1); }
    const vs = variantsOf(name);
    const r = renderPatch((c, rw) => vs[pickVariant(c, rw)], 5, 7, file, 4);
    console.log(`${file} ${r.W}x${r.H} (${name} field)`);
  } else {
    // contact sheet: a 3x4 patch of every tile, side by side
    const file = args[0];
    const names = Object.keys(TILES);
    const grids = names.map((n) => variantsOf(n));
    const PW = 3 * V1[0], PH = 4 * V2[1] + (HEX_H - V2[1]);
    const cols = 4, rowsN = Math.ceil(names.length / cols), pad = 6, lab = 0;
    const W = cols * (PW + pad) + pad, H = rowsN * (PH + pad + lab) + pad;
    const buf = Buffer.alloc(W * H * 3, 24);
    names.forEach((n, k) => {
      const bx = pad + (k % cols) * (PW + pad), by = pad + Math.floor(k / cols) * (PH + pad + lab);
      for (let r = 0; r < 4; r++)
        for (let c = -1; c <= 3; c++) {
          const ox = bx + c * V1[0] + (r % 2) * V2[0], oy = by + r * V2[1];
          for (let y = 0; y < HEX_H; y++)
            for (let x = INSET[y]; x < HEX_W - INSET[y]; x++) {
              const ch = grids[k][pickVariant(c, r)][y][x];
              if (ch === '.') continue;
              const px = ox + x, py = oy + y;
              if (px < bx || px >= bx + PW || py < by || py >= by + PH) continue;
              const [rr, gg, bb] = rgb(PALETTE[ch]);
              const i = (py * W + px) * 3;
              buf[i] = rr; buf[i + 1] = gg; buf[i + 2] = bb;
            }
        }
    });
    const scale = 3, SW = W * scale, SH = H * scale;
    const out = Buffer.alloc(SW * SH * 3);
    for (let y = 0; y < SH; y++)
      for (let x = 0; x < SW; x++) {
        const s = (Math.floor(y / scale) * W + Math.floor(x / scale)) * 3;
        const d = (y * SW + x) * 3;
        out[d] = buf[s]; out[d + 1] = buf[s + 1]; out[d + 2] = buf[s + 2];
      }
    writeFileSync(file, png(SW, SH, out));
    console.log(`${file} ${SW}x${SH} (${names.length} tiles: ${names.join(', ')})`);
  }
}
