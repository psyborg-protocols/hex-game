// decor_index.js
// Derive decor/index.json from the art, the way tools/newtiles_index.js does for
// the tile sheets: measure the sprites, do not read them off a spec.
//
//   node tools/decor_index.js            # report what it found
//   node tools/decor_index.js --json     # ... and write decor/index.json
//
// decor/Decor.png is 80x160 on a 16x16 grid: five columns of growth stages by
// ten rows. Most subjects sit in one row; the two tree bands span two, because a
// full-grown canopy rises out of the cell above its trunk.
//
// Segmentation is per grid cell, not by connected components. The cabbage in row
// 8 and the tomato in row 9 touch at the row boundary, so a flood fill merges
// them into one 24px-tall blob; clipping to the band splits them correctly.

const fs = require('fs');
const path = require('path');
const { readPng } = require('./png_read.js');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'decor', 'Decor.png');
const OUT = path.join(ROOT, 'decor', 'index.json');

const CELL = 16;

/**
 * What each band of the sheet holds, top to bottom. `rows` is how many grid rows
 * the subject may occupy; `names` runs left to right across the five columns.
 */
const BANDS = [
  { row: 0, rows: 2, names: ['pine_0', 'pine_1', 'pine_2', 'pine_3', 'pine_stump'] },
  { row: 2, rows: 2, names: ['oak_0', 'oak_1', 'oak_2', 'oak_3', 'oak_stump'] },
  { row: 4, rows: 1, names: ['mushroom_0', 'mushroom_1', 'mushroom_2', 'log_0', 'log_1'] },
  { row: 5, rows: 1, names: ['rock_0', 'rock_1', 'rock_2', 'rock_3', 'rock_4'] },
  { row: 6, rows: 1, names: ['bush_0', 'bush_1', 'bush_2', 'seedling_0', 'seedling_1'] },
  { row: 7, rows: 1, names: ['pumpkin_0', 'pumpkin_1', 'pumpkin_2', 'pumpkin_3', 'pumpkin_4'] },
  { row: 8, rows: 1, names: ['cabbage_0', 'cabbage_1', 'cabbage_2', 'cabbage_3', 'cabbage_4'] },
  { row: 9, rows: 1, names: ['tomato_0', 'tomato_1', 'tomato_2', 'tomato_3', 'tomato_4'] },
];

/** Named groups, so callers can ask for "a rock" without knowing the sheet. */
const GROUPS = {
  pine: ['pine_0', 'pine_1', 'pine_2', 'pine_3'],
  oak: ['oak_0', 'oak_1', 'oak_2', 'oak_3'],
  stumps: ['pine_stump', 'oak_stump'],
  rocks: ['rock_0', 'rock_1', 'rock_2', 'rock_3', 'rock_4'],
  bushes: ['bush_0', 'bush_1', 'bush_2'],
  litter: ['log_0', 'log_1', 'mushroom_0', 'mushroom_1', 'mushroom_2'],
};

function build() {
  const png = readPng(SRC);
  const { width: W, height: H, data } = png;
  const alpha = (x, y) => data[(y * W + x) * 4 + 3];

  const sprites = {};
  const report = [];

  for (const band of BANDS) {
    const y0 = band.row * CELL;
    const y1 = Math.min(H, y0 + band.rows * CELL);

    band.names.forEach((name, col) => {
      const x0 = col * CELL;
      const x1 = Math.min(W, x0 + CELL);

      let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1, opaque = 0, soft = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const a = alpha(x, y);
          if (a === 0) continue;
          if (a < 255) soft++; else opaque++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }

      if (maxX < 0) {
        report.push(`  ${name.padEnd(12)} EMPTY CELL`);
        return;
      }

      const box = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
      // Where the sprite meets the ground, relative to its own box: what you line
      // up with the centre of a hex's top face when you stand it on a tile.
      box.footX = Math.round(box.w / 2);
      box.footY = box.h;
      sprites[name] = box;
      report.push(`  ${name.padEnd(12)} ${String(box.w).padStart(2)}x${String(box.h).padStart(2)}`
        + ` at ${box.x},${box.y}  ${String(opaque).padStart(4)}px`
        + (soft ? `  (+${soft} soft)` : ''));
    });
  }

  return { png, sprites, report };
}

const { png, sprites, report } = build();

console.log(`decor/Decor.png  ${png.width}x${png.height}, ${CELL}x${CELL} grid`);
console.log(report.join('\n'));
console.log(`\n${Object.keys(sprites).length} sprites in ${Object.keys(GROUPS).length} groups`);

if (process.argv.includes('--json')) {
  const out = {
    sheet: 'decor/Decor.png',
    width: png.width,
    height: png.height,
    cell: CELL,
    note: 'Boxes are measured from the alpha by tools/decor_index.js. foot* is the '
      + 'ground contact point within the box, for standing a sprite on a hex.',
    sprites,
    groups: GROUPS,
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(`\nwrote ${path.relative(ROOT, OUT)}`);
}
