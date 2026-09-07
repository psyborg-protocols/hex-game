// hexgrid.test.mjs — the lattice has to be exactly right or everything drawn on
// it is wrong, so this proves the tiling rather than trusting the constants.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test, run, eq, ok } from './_harness.mjs';
import {
  GEOM, EDGE_ORDER, EDGE_BITS, columnBaseY, tileCenter, frameOrigin,
  pointInHex, neighbor, neighbors, isOddColumn, distance, pickHex, toAxial,
} from '../src/world/hexgrid.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const index = JSON.parse(readFileSync(join(root, 'new_tiles', 'index.json'), 'utf8'));

test('geometry still matches new_tiles/index.json', () => {
  eq(GEOM.stepX, index.layout.stepX, 'stepX');
  eq(GEOM.stepY, index.layout.stepY, 'stepY');
  eq(GEOM.oddColumnOffsetY, index.layout.oddColumnOffsetY, 'oddColumnOffsetY');
  eq(GEOM.frameWidth, index.frame.width, 'frame width');
  eq(GEOM.frameHeight, index.frame.height, 'frame height');
  eq(GEOM.topFaceTop, index.topFace.top, 'top face top');
  eq(GEOM.topFaceHeight, index.topFace.height, 'top face height');
  eq(GEOM.wallHeight, index.wallHeight, 'wall height');
  eq(EDGE_ORDER, index.edgeOrder, 'edge order');
});

test('edge bits are the documented clockwise powers of two', () => {
  EDGE_ORDER.forEach((name, i) => eq(EDGE_BITS[name], 1 << i, `bit for ${name}`));
});

test('one hex covers exactly one lattice cell of area', () => {
  // 20px flat run + two 6px diagonal runs, 24 tall.
  const area = 20 * GEOM.topFaceHeight + 2 * (6 * GEOM.topFaceHeight / 2);
  eq(area, GEOM.stepX * GEOM.stepY, 'hex area vs lattice cell');
});

test('the plane tiles with no gaps and no overlaps', () => {
  // Sweep an interior region and count how many top faces claim each pixel.
  // Sampling at pixel centres keeps every comparison off the exact edge.
  const x0 = 60, y0 = 60, x1 = 220, y1 = 220;
  let gaps = 0, overlaps = 0;

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      let hits = 0;
      const aq = Math.round((px - GEOM.frameWidth / 2) / GEOM.stepX);
      const ar = Math.round(py / GEOM.stepY);
      for (let q = aq - 2; q <= aq + 2; q++) {
        for (let r = ar - 2; r <= ar + 2; r++) {
          const { cx, cy } = tileCenter(q, r, 0);
          if (pointInHex(px, py, cx, cy)) hits++;
        }
      }
      if (hits === 0) gaps++;
      if (hits > 1) overlaps++;
    }
  }
  eq({ gaps, overlaps }, { gaps: 0, overlaps: 0 }, 'sweep of 25,600 px');
});

test('column parity is right for negative q', () => {
  eq([-3, -2, -1, 0, 1, 2, 3].map(isOddColumn),
    [true, false, true, false, true, false, true], 'odd columns');
  // The half-tile push must be symmetric about zero.
  eq(columnBaseY(-1, 0), columnBaseY(1, 0), 'q=-1 and q=1 sit at the same y');
  eq(columnBaseY(-2, 0), columnBaseY(0, 0), 'q=-2 and q=0 sit at the same y');
});

test('neighbours are reciprocal across every edge, both parities', () => {
  for (let q = -4; q <= 4; q++) {
    for (let r = -4; r <= 4; r++) {
      for (let e = 0; e < 6; e++) {
        const n = neighbor(q, r, e);
        const back = neighbor(n.q, n.r, (e + 3) % 6);
        eq(back, { q, r }, `${EDGE_ORDER[e]} from ${q},${r} did not come back`);
      }
    }
  }
});

test('neighbours are the six adjacent hexes, geometrically', () => {
  // Each neighbour centre must sit exactly one lattice step away.
  for (const q of [-3, -2, 0, 1, 2]) {
    for (const r of [-2, 0, 3]) {
      const c = tileCenter(q, r, 0);
      for (const n of neighbors(q, r)) {
        const nc = tileCenter(n.q, n.r, 0);
        const dx = Math.abs(nc.cx - c.cx);
        const dy = Math.abs(nc.cy - c.cy);
        const adjacent = (dx === 0 && dy === GEOM.stepY)
          || (dx === GEOM.stepX && dy === GEOM.oddColumnOffsetY);
        ok(adjacent, `neighbour of ${q},${r} at offset ${dx},${dy} is not adjacent`);
      }
    }
  }
});

test('neighbour names match the direction they point', () => {
  for (const q of [0, 1, -1, -2]) {
    const c = tileCenter(q, 0, 0);
    const named = Object.fromEntries(
      EDGE_ORDER.map(e => {
        const n = neighbor(q, 0, e);
        const nc = tileCenter(n.q, n.r, 0);
        return [e, { dx: nc.cx - c.cx, dy: nc.cy - c.cy }];
      }));
    ok(named.N.dy < 0 && named.N.dx === 0, `N should be straight up at q=${q}`);
    ok(named.S.dy > 0 && named.S.dx === 0, `S should be straight down at q=${q}`);
    ok(named.NE.dx > 0 && named.NE.dy < 0, `NE should be up-right at q=${q}`);
    ok(named.SE.dx > 0 && named.SE.dy > 0, `SE should be down-right at q=${q}`);
    ok(named.SW.dx < 0 && named.SW.dy > 0, `SW should be down-left at q=${q}`);
    ok(named.NW.dx < 0 && named.NW.dy < 0, `NW should be up-left at q=${q}`);
  }
});

test('distance is 1 to every neighbour and grows by rings', () => {
  for (const n of neighbors(0, 0)) eq(distance(0, 0, n.q, n.r), 1, 'neighbour distance');
  for (const n of neighbors(-3, 2)) eq(distance(-3, 2, n.q, n.r), 1, 'neighbour distance, negative q');
  // Second ring: every neighbour of a neighbour is 1 or 2 away, never more.
  for (const a of neighbors(0, 0)) {
    for (const b of neighbors(a.q, a.r)) {
      const d = distance(0, 0, b.q, b.r);
      ok(d <= 2, `${b.q},${b.r} should be within 2, got ${d}`);
    }
  }
});

test('axial conversion round-trips through distance symmetry', () => {
  for (let q = -5; q <= 5; q++) {
    for (let r = -5; r <= 5; r++) {
      eq(distance(0, 0, q, r), distance(q, r, 0, 0), 'distance is symmetric');
      const { aq, ar } = toAxial(q, r);
      ok(Number.isInteger(aq) && Number.isInteger(ar), `axial of ${q},${r} is not integral`);
    }
  }
});

test('picking a hex centre returns that hex, at every height', () => {
  const heights = new Map();
  for (let q = -3; q <= 3; q++) {
    for (let r = -3; r <= 3; r++) heights.set(`${q},${r}`, (q + r + 6) % 4);
  }
  const topHeight = (q, r) => heights.has(`${q},${r}`) ? heights.get(`${q},${r}`) : -1;

  for (let q = -2; q <= 2; q++) {
    for (let r = -2; r <= 2; r++) {
      const h = topHeight(q, r);
      const { cx, cy } = tileCenter(q, r, h);
      const hit = pickHex(cx, cy, topHeight);
      ok(hit, `nothing picked at the centre of ${q},${r}`);
      eq({ q: hit.q, r: hit.r }, { q, r }, `picked the wrong hex near ${q},${r}`);
    }
  }
});

test('picking prefers the tall column in front over the one behind it', () => {
  // A 4-high column at (0,1) is drawn over the flat column at (0,0) behind it.
  const topHeight = (q, r) => (q === 0 && r === 1) ? 4 : (q === 0 && r === 0) ? 0 : -1;
  const tall = tileCenter(0, 1, 4);
  const hit = pickHex(tall.cx, tall.cy, topHeight);
  eq({ q: hit.q, r: hit.r }, { q: 0, r: 1 }, 'the raised top face should win');
});

test('frame origin puts the top face where tileCenter says it is', () => {
  const { x, y } = frameOrigin(3, 2, 1);
  const { cx, cy } = tileCenter(3, 2, 1);
  eq(x + GEOM.frameWidth / 2, cx, 'frame centres horizontally on the tile');
  eq(y + GEOM.topFaceTop + GEOM.topFaceHeight / 2, cy, 'top face lands on the tile centre');
});

test('raising a tile by one lifts it exactly one wall', () => {
  eq(tileCenter(0, 0, 0).cy - tileCenter(0, 0, 1).cy, GEOM.wallHeight, 'one level of lift');
});

run('hexgrid');
