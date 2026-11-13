// resources.js
// Drawing the things on a hex that you can work: rocks, fallen branches, reed
// beds, berry bushes, a rabbit, the rings a fish leaves on the water.
//
// Where they are and whether they are ready is game/nodes.js; this is only what
// each looks like. Rocks, branches and bushes come off the artist's prop sheet.
// The rest the sheet does not have, so they are drawn here in its idiom: a dark
// outline, a few tones, light from the top left, whole pixels.
//
// Three small motions do the explaining that text used to:
//   a thing you are pointing at lifts a pixel and gets a pale rim, which is how
//     you learn that it is a thing and not scenery
//   a thing newly found grows in, rather than appearing
//   a wood you push at shakes

import { tileCenter, neighbors } from '../world/hexgrid.js';
import { TERRAIN } from '../world/tileset.js';
import { isKnown } from '../game/discovery.js';
import { drawSprite } from './decor.js';
import { litImage } from './columns.js';
import { nodesAt } from '../game/nodes.js';

const INK = '#1b1420';
const px = (ctx, c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

const ROCK_SPRITES = ['rock_0', 'rock_1', 'rock_2', 'rock_4'];
const BUSH_SPRITES = ['bush_0', 'bush_1', 'bush_2'];

/** How long a newly found thing takes to grow in, and a pushed wood to settle. */
export const GROW_MS = 700;
export const SHAKE_MS = 420;

/**
 * Passing state for the props: what is being pointed at, what was just found,
 * what was just shaken. Owned by main.js, read here and by decor.js.
 */
export function createFx() {
  return { hover: null, found: new Map(), shake: new Map(), version: 0, cache: new Map() };
}

/**
 * A hex's nodes, remembered for half a second. Every visible column asks every
 * frame, and the answer changes only when something is taken (main.js bumps
 * `fx.version`) or regrows.
 */
export function nodesFor(map, state, col, now, fx) {
  const stamp = `${fx.version}|${Math.floor(now / 500)}`;
  const k = `${col.q},${col.r}`;
  const hit = fx.cache.get(k);
  if (hit && hit.stamp === stamp) return hit.nodes;
  if (fx.cache.size > 4000) fx.cache.clear();
  const nodes = nodesAt(map, state, col);
  fx.cache.set(k, { stamp, nodes });
  return nodes;
}

const sameNode = (a, b) => !!a && !!b && a.kind === b.kind && a.q === b.q && a.r === b.r && a.dx === b.dx && a.dy === b.dy;

function cattails(ctx, x, y, variant, t) {
  const sway = Math.sin(t * 1.4 + x * 0.7) > 0.3 ? 1 : 0;
  const stalks = variant ? [[-2, 8], [1, 10], [3, 7]] : [[-3, 9], [0, 7], [2, 10]];
  for (const [dx, h] of stalks) {
    px(ctx, '#3f6b2a', x + dx, y - h + 3, 1, h - 3);
    px(ctx, '#5f8f3a', x + dx + sway, y - h + 1, 1, 3);
    // the brown head, which is the whole of what says "reed"
    px(ctx, INK, x + dx + sway - 1, y - h - 2, 3, 4);
    px(ctx, '#7a4a26', x + dx + sway, y - h - 1, 1, 3);
  }
  px(ctx, '#5f8f3a', x - 4, y - 2, 1, 2); px(ctx, '#5f8f3a', x + 4, y - 3, 1, 3);
}

function stubble(ctx, x, y) {
  for (const dx of [-3, -1, 1, 3]) px(ctx, '#7d8a4a', x + dx, y - 2 + (dx & 1), 1, 2);
}

function berries(ctx, x, y) {
  for (const [dx, dy] of [[-3, -5], [1, -7], [3, -3], [-1, -2], [0, -4]]) {
    px(ctx, '#7a1f2e', x + dx, y + dy, 2, 2);
    px(ctx, '#e0485a', x + dx, y + dy, 1, 1);
  }
}

function herb(ctx, x, y, t) {
  px(ctx, '#3f6b2a', x, y - 4, 1, 4);
  px(ctx, '#5f8f3a', x - 2, y - 3, 2, 1); px(ctx, '#5f8f3a', x + 1, y - 2, 2, 1);
  px(ctx, INK, x - 1, y - 7, 3, 3);
  px(ctx, '#e9e2ff', x, y - 6, 1, 1);
  px(ctx, '#b9a4f0', x - 1, y - 6, 1, 1); px(ctx, '#b9a4f0', x + 1, y - 6, 1, 1);
  px(ctx, '#b9a4f0', x, y - 7, 1, 1); px(ctx, '#b9a4f0', x, y - 5, 1, 1);
  // a butterfly, now and then, which is what you see first from a distance
  const k = (t * 0.9 + x * 0.13) % 5;
  if (k < 2.2) {
    const bx = x + Math.round(Math.sin(k * 4) * 3), by = y - 10 - Math.round(Math.abs(Math.sin(k * 6)) * 2);
    px(ctx, '#fff3b0', bx, by, 1, 1);
    if (Math.floor(t * 9) % 2) { px(ctx, '#fff3b0', bx - 1, by - 1, 1, 1); px(ctx, '#fff3b0', bx + 1, by - 1, 1, 1); }
  }
}

function flint(ctx, x, y, t) {
  px(ctx, INK, x - 3, y - 3, 6, 4);
  px(ctx, '#3d3a48', x - 2, y - 2, 4, 2);
  px(ctx, '#6d6a7c', x - 2, y - 2, 2, 1);
  // the glint
  if ((t * 0.8 + x * 0.21) % 3 < 0.22) { px(ctx, '#ffffff', x, y - 3, 1, 1); px(ctx, '#ffffff', x - 1, y - 4, 1, 1); px(ctx, '#ffffff', x + 1, y - 4, 1, 1); }
  else px(ctx, '#c9c6d8', x, y - 2, 1, 1);
}

function clay(ctx, x, y) {
  px(ctx, INK, x - 5, y - 3, 10, 4);
  px(ctx, '#a3552f', x - 4, y - 2, 8, 2);
  px(ctx, '#c9744a', x - 4, y - 2, 4, 1);
  px(ctx, '#7c3c20', x + 1, y - 1, 3, 1);
}

function rabbit(ctx, x, y, variant, t) {
  const hop = (t * 1.3 + x * 0.3) % 4 < 0.3 ? 1 : 0;
  const f = variant ? -1 : 1;
  y -= hop;
  ctx.fillStyle = 'rgba(20, 16, 30, 0.28)';
  ctx.fillRect(x - 3, y, 6, 1);
  px(ctx, INK, x - 3, y - 4, 6, 4);
  px(ctx, '#9a7b5a', x - 2, y - 3, 4, 2);
  px(ctx, '#c4a17a', x - 2, y - 3, 2, 1);
  // head and ears on the side it faces
  px(ctx, INK, x + f * 2 - 1, y - 6, 3, 3);
  px(ctx, '#9a7b5a', x + f * 2, y - 5, 1, 1);
  px(ctx, INK, x + f * 2, y - 8, 1, 2);
  px(ctx, '#f4f0e6', x - f * 3, y - 3, 1, 1);
}

/** Rings where a fish rose, on the water beside the bank you would fish from. */
function fishRings(ctx, x, y, t) {
  const k = (t * 0.55 + x * 0.07) % 1;
  ctx.save();
  ctx.lineWidth = 1;
  for (const phase of [0, 0.45]) {
    const p = (k + phase) % 1;
    ctx.strokeStyle = `rgba(236, 244, 255, ${(1 - p) * 0.75})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 2 + p * 7, 1 + p * 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
  if (k < 0.12) px(ctx, '#e9f2ff', x, y - 2, 1, 2);
}

/** The pale rim under a thing you are pointing at. */
function rim(ctx, x, y, w = 6) {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 248, 220, 0.9)';
  ctx.fillStyle = 'rgba(255, 248, 220, 0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(x, y, w, w * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawNode(ctx, res, sheet, n, x, y, t) {
  switch (n.kind) {
    case 'stone': drawSprite(ctx, res.decor, ROCK_SPRITES[n.variant % ROCK_SPRITES.length], x, y + 2, sheet); break;
    case 'branch': drawSprite(ctx, res.decor, 'log_0', x, y + 2, sheet); break;
    case 'reeds': if (n.ready) cattails(ctx, x, y, n.variant, t); else stubble(ctx, x, y); break;
    case 'berries':
      drawSprite(ctx, res.decor, BUSH_SPRITES[n.variant % BUSH_SPRITES.length], x, y + 2, sheet);
      if (n.ready) berries(ctx, x, y);
      break;
    case 'herb': herb(ctx, x, y, t); break;
    case 'flint': flint(ctx, x, y, t); break;
    case 'clay': clay(ctx, x, y); break;
    case 'game': rabbit(ctx, x, y, n.variant, t); break;
    default: break;
  }
}

/**
 * Draw what stands on one column. Called by the renderer straight after the
 * column itself, so it is hidden by whatever stands in front, like the column.
 *
 * @param mode  how the column was drawn: '', 'dim' or 'dormant'
 */
export function drawColumnNodes(ctx, res, map, state, col, now, fx, mode = '') {
  if (!res.decor) return;
  const t = now / 1000;
  const k = `${col.q},${col.r}`;
  const born = fx.found.get(k);
  const grow = born != null ? Math.min(1, (now - born) / GROW_MS) : 1;

  // Fish belong to a bank but are drawn on the water beside it.
  if (TERRAIN[col.terrain]?.water) {
    for (const nb of neighbors(col.q, col.r)) {
      if (!isKnown(state, nb.q, nb.r)) continue;
      const bank = map.get(nb.q, nb.r);
      if (!bank) continue;
      for (const n of nodesFor(map, state, bank, now, fx)) {
        if (!n.on || n.on.q !== col.q || n.on.r !== col.r) continue;
        const { cx, cy } = tileCenter(col.q, col.r, col.h);
        if (sameNode(fx.hover, n)) rim(ctx, cx, cy, 9);
        fishRings(ctx, Math.round(cx), Math.round(cy), t);
      }
    }
    return;
  }

  const nodes = nodesFor(map, state, col, now, fx);
  if (!nodes.length) return;
  const { cx, cy } = tileCenter(col.q, col.r, col.h);
  const sheet = litImage(res, 'decor', res.decor.image, col.h, mode);
  for (const n of [...nodes].sort((a, b) => a.dy - b.dy)) {
    if (n.on || n.kind === 'tree' || n.kind === 'field') continue;
    const x = Math.round(cx + n.dx), y = Math.round(cy + n.dy);
    const hot = sameNode(fx.hover, n);
    if (hot) rim(ctx, x, y + 1);
    // Hidden things grow in when the hex is first known; the rest were always there.
    const hidden = n.kind === 'berries' || n.kind === 'herb' || n.kind === 'flint' || n.kind === 'clay';
    if (hidden && grow < 1) {
      const s = 0.25 + 0.75 * grow * (2 - grow);
      ctx.save();
      ctx.translate(x, y + 2); ctx.scale(s, s); ctx.translate(-x, -(y + 2));
      drawNode(ctx, res, sheet, n, x, y, t);
      ctx.restore();
    } else {
      drawNode(ctx, res, sheet, n, x, y - (hot ? 1 : 0), t);
    }
  }
}

/** A cold camp: where you wake. A ring of stones, ash, and a charred log or two. */
export function drawCampfire(ctx, x, y) {
  ctx.fillStyle = 'rgba(20, 16, 30, 0.28)';
  ctx.beginPath(); ctx.ellipse(x, y + 1, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
  for (const [dx, dy] of [[-5, 0], [-3, 2], [0, 3], [3, 2], [5, 0], [3, -2], [-3, -2], [0, -3]]) {
    px(ctx, INK, x + dx - 1, y + dy - 1, 3, 3);
    px(ctx, '#857c72', x + dx, y + dy, 1, 1);
  }
  px(ctx, '#4a4440', x - 2, y - 1, 5, 2);
  px(ctx, '#6f6862', x - 1, y - 1, 2, 1);
  px(ctx, INK, x - 3, y, 4, 1); px(ctx, '#2a2420', x + 1, y - 1, 3, 1);
}
