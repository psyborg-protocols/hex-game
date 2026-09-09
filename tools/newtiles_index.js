// newtiles_index.js — works out, from the artwork itself, which edges each frame
// of each directional sheet connects, and reports the resulting lookup tables.
// Usage: node tools/newtiles_index.js [--json]
import { readPng } from './png_read.js';
import { writeFileSync } from 'node:fs';

const DIR = 'new_tiles';
const FW = 32;

// Edge order used everywhere below: clockwise from the flat top edge.
export const EDGES = ['N', 'NE', 'SE', 'S', 'SW', 'NW'];

// Several probe points just inside each edge of the top face (rows 16..39), so a
// single stray pixel cannot decide an edge.
const PROBES = {
  N:  [[14, 17], [16, 17], [18, 18]],
  NE: [[26, 21], [28, 23], [27, 22]],
  SE: [[26, 34], [28, 32], [27, 33]],
  S:  [[14, 38], [16, 38], [18, 37]],
  SW: [[5, 34], [3, 32], [4, 33]],
  NW: [[5, 21], [3, 23], [4, 22]],
};

const isWater = (r, g, b) => b > r + 20 && b > g + 10;
// the path is a desaturated sand colour: warm, light, and low blue
const isPath = (r, g, b) => r > 170 && g > 130 && b < 165 && r - b > 45 && g - b > 15 && !(g > r);

function edgeKind(img, fi, edge) {
  let water = 0, path = 0, n = 0;
  for (const [x, y] of PROBES[edge]) {
    const i = (y * img.width + fi * FW + x) * 4;
    if (img.data[i + 3] === 0) continue;
    const [r, g, b] = [img.data[i], img.data[i + 1], img.data[i + 2]];
    n++;
    if (isWater(r, g, b)) water++;
    else if (isPath(r, g, b)) path++;
  }
  if (!n) return 'none';
  if (water * 2 > n) return 'water';
  if (path * 2 > n) return 'path';
  return 'land';
}

export function maskOf(sheet, fi, kind) {
  const img = readPng(`${DIR}/${sheet}.png`);
  let m = 0;
  EDGES.forEach((e, bit) => { if (edgeKind(img, fi, e) === kind) m |= 1 << bit; });
  return m;
}

const PATH_SHEETS = ['Tiles_PathEnd', 'Tiles_PathsStraight', 'Tiles_PathSmallCorner',
  'Tiles_PathWideCorner', 'Tiles_PathBranchCrossLeft', 'Tiles_PathBranchCrossRight', 'Tiles_PathCrosses'];
const LAKE_SHEETS = ['Tiles_LakeSidesOne', 'Tiles_LakeSidesTwo', 'Tiles_LakeSidesThree', 'Tiles_LakeSidesFour'];

export function buildIndex() {
  const paths = {};   // connection mask -> [sheet, frame]
  const pathRows = [];
  for (const s of PATH_SHEETS) {
    const img = readPng(`${DIR}/${s}.png`);
    for (let fi = 0; fi < 6; fi++) {
      let m = 0;
      EDGES.forEach((e, bit) => { if (edgeKind(img, fi, e) === 'path') m |= 1 << bit; });
      pathRows.push({ sheet: s, frame: fi, mask: m });
      if (m && !(m in paths)) paths[m] = [s, fi];
    }
  }
  const lakes = {};   // land-edge mask -> [sheet, frame]
  const lakeRows = [];
  for (const s of LAKE_SHEETS) {
    const img = readPng(`${DIR}/${s}.png`);
    for (let fi = 0; fi < 6; fi++) {
      let m = 0;
      EDGES.forEach((e, bit) => { if (edgeKind(img, fi, e) === 'land') m |= 1 << bit; });
      lakeRows.push({ sheet: s, frame: fi, mask: m });
      if (m && !(m in lakes)) lakes[m] = [s, fi];
    }
  }
  return { paths, lakes, pathRows, lakeRows };
}

const names = (m) => EDGES.filter((_, b) => m & (1 << b)).join('+') || '-';
const popcount = (m) => EDGES.reduce((s, _, b) => s + ((m >> b) & 1), 0);

if (process.argv[1].replace(/\\/g, '/').split('/').pop() === 'newtiles_index.js') {
  const { paths, lakes, pathRows, lakeRows } = buildIndex();

  console.log('PATH pieces — frame -> connected edges (bit order N,NE,SE,S,SW,NW)\n');
  let cur = '';
  for (const r of pathRows) {
    if (r.sheet !== cur) { cur = r.sheet; console.log(`  ${cur}`); }
    console.log(`    frame ${r.frame}  mask ${String(r.mask).padStart(2)}  ${names(r.mask)}`);
  }
  console.log('\nPATH coverage by number of connections:');
  for (let k = 0; k <= 6; k++) {
    const want = [];
    for (let m = 0; m < 64; m++) if (popcount(m) === k) want.push(m);
    const have = want.filter((m) => m in paths);
    const missing = want.filter((m) => !(m in paths));
    console.log(`  ${k} connection(s): ${have.length}/${want.length}` +
      (missing.length && k > 0 ? `   missing: ${missing.map(names).join(', ')}` : ''));
  }

  console.log('\nLAKE shore pieces — frame -> LAND edges');
  cur = '';
  for (const r of lakeRows) {
    if (r.sheet !== cur) { cur = r.sheet; console.log(`  ${cur}`); }
    console.log(`    frame ${r.frame}  mask ${String(r.mask).padStart(2)}  ${names(r.mask)}`);
  }
  console.log('\nLAKE coverage by number of land edges:');
  for (let k = 0; k <= 6; k++) {
    const want = [];
    for (let m = 0; m < 64; m++) if (popcount(m) === k) want.push(m);
    const have = want.filter((m) => m in lakes);
    console.log(`  ${k} land edge(s): ${have.length}/${want.length}`);
  }

  if (process.argv.includes('--json')) {
    writeFileSync('new_tiles/index.json', JSON.stringify({
      frame: { width: 32, height: 48 },
      topFace: { top: 16, height: 24, width: 32 },
      wallHeight: 8, headroom: 16,
      layout: { stepX: 26, stepY: 24, oddColumnOffsetY: 12, orientation: 'flat-top, odd-q (columns offset)' },
      drawOrder: 'back to front by screen y; walls and tall decor overlap the tiles behind',
      edgeOrder: EDGES,
      pathByMask: paths,
      lakeByLandMask: lakes,
    }, null, 2) + '\n');
    console.log('\nwrote new_tiles/index.json');
  }
}
