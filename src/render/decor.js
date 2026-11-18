// decor.js
// Standing things on tiles, from decor/Decor.png.
//
// The tile sheets are complete tiles, not overlays — a wooded hex from
// `Tiles_DecorOak` carries its own trees, drawn by the artist. But the generated
// terrains (`Tiles_ForestFloor`, `Tiles_PineFloor` and the rest) are bare, which
// docs/new_tiles.md calls out as a gap: "a pine floor with pines would need the
// tree sprites composited in". This is that compositing, done at draw time
// rather than baked, so that felling a wood can actually thin it out — the trees
// drawn are the trees left standing.
//
// Sprite boxes come from decor/index.json, measured from the alpha by
// tools/decor_index.js. Each carries a foot point, the spot you line up with the
// centre of a hex's top face.

import { hash2, hashPick } from '../core/rng.js';
import { tileCenter } from '../world/hexgrid.js';
import { litImage } from './columns.js';

export const DECOR_DIR = 'decor';

/** Where on a top face a prop may stand, as offsets from its centre. */
const SPOTS = [
  { dx: -7, dy: -1 }, { dx: 6, dy: -3 }, { dx: 0, dy: 4 },
  { dx: -4, dy: 5 }, { dx: 8, dy: 3 }, { dx: -9, dy: 4 },
];

/** Most trees a single hex draws, however much wood is left on it. */
export const MAX_TREES = 5;

export async function loadDecor(basePath = DECOR_DIR) {
  const index = await fetch(`${basePath}/index.json`).then(r => r.json());
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('decor: sheet failed to load'));
    img.src = `${basePath}/Decor.png`;
  });
  return { index, image };
}

/**
 * Draw one named sprite standing on (cx, cy) — its foot point, not its corner.
 */
export function drawSprite(ctx, decor, name, cx, cy, sheet = decor.image) {
  const box = decor.index.sprites[name];
  if (!box) return;
  ctx.drawImage(sheet,
    box.x, box.y, box.w, box.h,
    Math.round(cx - box.footX), Math.round(cy - box.footY), box.w, box.h);
}

/**
 * Which terrains stand trees on them, and what kind. Every wood does, dense or
 * sparse: the dense woods used to use the artist's Tiles_DecorOak/Pine sheets
 * with the trees drawn into the tile, which no hover outline could go under.
 */
const PROP_WOODS = { forest_floor: 'oak', pine_floor: 'pine', oak_wood: 'oak', pine_wood: 'pine' };

/** Sheets with trees drawn into the tile. Old saves still name them. */
export const BAKED_SHEETS = new Set(['Tiles_DecorOak', 'Tiles_DecorPine']);

/**
 * The trees a wooded column draws, with their spots and sprite names.
 *
 * Pure — no canvas — so the renderer and the picker can both ask it and agree
 * on what is where. Sorted near-to-far *within* the hex so a tree at the back
 * of the top face is drawn behind one at the front. Between hexes the
 * renderer's own back-to-front order already does the right thing, and the
 * canopies overhang upward into the headroom of the tile behind, which is what
 * the sheets do too.
 */
export function placeTrees(col) {
  const kind = PROP_WOODS[col.terrain];
  if (!kind) return [];

  const trees = col.feature?.type === 'trees' ? col.feature.remaining : 0;
  if (!trees) return [];

  const count = Math.min(MAX_TREES, trees);

  // A stable per-hex rotation of the spot list, so neighbouring hexes do not all
  // put their first tree in the same place.
  const shift = hashPick(col.q, col.r, SPOTS.length, 91);
  const placed = [];
  for (let i = 0; i < count; i++) {
    const spot = SPOTS[(shift + i) % SPOTS.length];
    // Bigger trees on the hexes that have more wood left, with enough variation
    // that a wood is not a row of identical cutouts.
    const stage = 1 + hashPick(col.q * 7 + i, col.r * 13 + i, 3, 41);
    placed.push({ ...spot, name: `${kind}_${stage}` });
  }
  placed.sort((a, b) => a.dy - b.dy);
  return placed;
}

/**
 * The screen-space box of every tree `col` draws, in draw order. Measured from
 * the same placement and index the renderer uses, so a click is tested against
 * exactly what is on screen — including the part that overhangs into the tiles
 * around it.
 */
export function treeBoxes(col, index, sway = 0) {
  const { cy } = tileCenter(col.q, col.r, col.h);
  const cx = tileCenter(col.q, col.r, col.h).cx + sway;   // drawColumnDecor shifts by the same
  return placeTrees(col).map(p => {
    const box = index.sprites[p.name];
    if (!box) return null;
    return {
      q: col.q, r: col.r,
      x: cx + p.dx - box.footX,
      y: cy + p.dy - box.footY,
      w: box.w, h: box.h,
      dy: p.dy, name: p.name,
    };
  }).filter(Boolean);
}

/** Where litter lies: low on the face, round the edges, clear of the trunks. */
const LITTER_SPOTS = [
  { dx: -11, dy: 2 }, { dx: 10, dy: -1 }, { dx: 2, dy: 8 },
  { dx: -3, dy: -7 }, { dx: 12, dy: 5 }, { dx: -7, dy: 8 },
];

/**
 * The small things on a woodland floor: mushrooms, and fallen logs under oaks.
 * The artist's dense-wood tiles had them drawn in; drawn from the decor sheet
 * instead, they stay when the trees are felled, the way they would.
 *
 * Only mushrooms and logs. Bushes and rocks are left out on purpose: in this
 * game a bush is berries and a rock is stone, and scenery that looks like
 * something you can gather is a trap.
 */
export function placeLitter(col) {
  const kind = PROP_WOODS[col.terrain];
  if (!kind) return [];
  const dense = col.terrain === 'oak_wood' || col.terrain === 'pine_wood';
  const roll = hashPick(col.q, col.r, 6, 53);            // 0..5
  const count = dense ? (roll < 2 ? 1 : roll < 5 ? 2 : 3) : (roll < 3 ? 0 : 1);
  const names = kind === 'oak'
    ? ['mushroom_0', 'mushroom_1', 'mushroom_2', 'log_0', 'log_1']
    : ['mushroom_0', 'mushroom_1', 'mushroom_2', 'mushroom_1'];
  const shift = hashPick(col.q, col.r, LITTER_SPOTS.length, 67);
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push({ ...LITTER_SPOTS[(shift + i * 2) % LITTER_SPOTS.length],
      name: names[hashPick(col.q * 5 + i, col.r * 3 + i, names.length, 71)], litter: true });
  }
  return out;
}

/**
 * Stand the trees a wooded column still has on it, and its litter.
 * @param {string|null} treeMode  a lighting mode for the trees alone ('glow'
 *   when hovered); the litter keeps `dim`
 */
export function drawColumnDecor(ctx, res, col, dim = false, sway = 0, treeMode = null) {
  const decor = res.decor;
  if (!decor) return;

  const placed = [...placeTrees(col), ...placeLitter(col)];
  if (!placed.length) return;
  // Near-to-far within the hex, litter and trunks alike, so a mushroom in front
  // of a tree is drawn over its foot.
  placed.sort((a, b) => a.dy - b.dy);

  // Lit with the tile they stand on. A tree at full brightness on a shadowed hex
  // reads as pasted on rather than growing there.
  const { cx, cy } = tileCenter(col.q, col.r, col.h);
  const sheet = litImage(res, 'decor', decor.image, col.h, dim);
  const trees = treeMode ? litImage(res, 'decor', decor.image, col.h, treeMode) : sheet;
  for (const p of placed) {
    // Litter lies on the ground and does not sway with a shaken tree.
    drawSprite(ctx, decor, p.name, cx + p.dx + (p.litter ? 0 : sway), cy + p.dy, p.litter ? sheet : trees);
  }
}

/** A felled wood keeps its stumps, so you can see where it was. */
export function stumpFor(terrain) {
  const kind = PROP_WOODS[terrain];
  return kind ? `${kind}_stump` : null;
}

export { hash2 };
