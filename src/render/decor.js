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

export const DECOR_DIR = 'decor';

/** Where on a top face a prop may stand, as offsets from its centre. */
const SPOTS = [
  { dx: -7, dy: -1 }, { dx: 6, dy: -3 }, { dx: 0, dy: 4 },
  { dx: -4, dy: 5 }, { dx: 8, dy: 3 }, { dx: -9, dy: 4 },
];

/** Most trees a single hex draws, however much wood is left on it. */
export const MAX_TREES = 4;

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
export function drawSprite(ctx, decor, name, cx, cy) {
  const box = decor.index.sprites[name];
  if (!box) return;
  ctx.drawImage(decor.image,
    box.x, box.y, box.w, box.h,
    Math.round(cx - box.footX), Math.round(cy - box.footY), box.w, box.h);
}

/**
 * Which terrains grow their trees as props. The artist's wooded sheets are left
 * alone — they already have trees, and better ones.
 */
const PROP_WOODS = { forest_floor: 'oak', pine_floor: 'pine' };

/**
 * Stand the trees a wooded column still has on it.
 *
 * Sorted near-to-far *within* the hex so a tree at the back of the top face is
 * drawn behind one at the front. Between hexes the renderer's own back-to-front
 * order already does the right thing, and the canopies overhang upward into the
 * headroom of the tile behind, which is what the sheets do too.
 */
export function drawColumnDecor(ctx, res, col) {
  const decor = res.decor;
  if (!decor) return;

  const kind = PROP_WOODS[col.terrain];
  if (!kind) return;

  const trees = col.feature?.type === 'trees' ? col.feature.remaining : 0;
  if (!trees) return;

  const { cx, cy } = tileCenter(col.q, col.r, col.h);
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
  for (const p of placed) drawSprite(ctx, decor, p.name, cx + p.dx, cy + p.dy);
}

/** A felled wood keeps its stumps, so you can see where it was. */
export function stumpFor(terrain) {
  const kind = PROP_WOODS[terrain];
  return kind ? `${kind}_stump` : null;
}

export { hash2 };
