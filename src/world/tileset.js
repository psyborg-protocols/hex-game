// tileset.js
// What terrain exists, which sheet draws it, and how the autotiled sets resolve.
//
// The sheets are complete tiles, not overlays — every frame carries its own
// ground, so a hex picks exactly one sprite. See docs/new_tiles.md.

import { hashPick } from '../core/rng.js';
import { EDGE_BITS, configure } from './hexgrid.js';

export const TILE_DIR = 'new_tiles';

/** Every sheet in new_tiles/. All are 192x48 — six 32x48 frames, no gutters. */
export const SHEET_NAMES = [
  'Tiles_GrassBase1', 'Tiles_GrassBase2', 'Tiles_GrassBase3',
  'Tiles_DecorNoTrees', 'Tiles_DecorOak', 'Tiles_DecorPine',
  'Tiles_ForestFloor', 'Tiles_PineFloor', 'Tiles_Steppes', 'Tiles_Stony',
  'Tiles_FarmingBase', 'Tiles_FarmingCabbage', 'Tiles_FarmingPumpkins', 'Tiles_FarmingTomatos',
  'Tiles_LakeBase', 'Tiles_FlowingWater',
  'Tiles_LakeSidesOne', 'Tiles_LakeSidesTwo', 'Tiles_LakeSidesThree', 'Tiles_LakeSidesFour',
  'Tiles_PathEnd', 'Tiles_PathsStraight', 'Tiles_PathSmallCorner', 'Tiles_PathWideCorner',
  'Tiles_PathCrosses', 'Tiles_PathBranchCrossLeft', 'Tiles_PathBranchCrossRight',
];

export const FRAMES_PER_SHEET = 6;

/**
 * The terrain vocabulary. `sheets` are interchangeable variants — a hex picks one
 * by coordinate hash, so the same world always looks the same.
 *
 *   walk      can be walked onto (subject to the height rules in pathfinding)
 *   water     counts as water for shorelines, fishing and bridges
 *   autotile  resolved from a neighbour mask instead of a hash
 *   overhang  art rises into the headroom above the tile
 */
export const TERRAIN = {
  grass:        { name: 'Grassland',    sheets: ['Tiles_GrassBase1', 'Tiles_GrassBase2', 'Tiles_GrassBase3'], walk: true },
  meadow:       { name: 'Meadow',       sheets: ['Tiles_DecorNoTrees'], walk: true, forage: true },
  oak_wood:     { name: 'Oak Wood',     sheets: ['Tiles_DecorOak'],  walk: true, trees: 'oak',  overhang: true },
  pine_wood:    { name: 'Pine Wood',    sheets: ['Tiles_DecorPine'], walk: true, trees: 'pine', overhang: true },
  forest_floor: { name: 'Forest Floor', sheets: ['Tiles_ForestFloor'], walk: true },
  pine_floor:   { name: 'Pine Floor',   sheets: ['Tiles_PineFloor'], walk: true },
  steppes:      { name: 'Steppes',      sheets: ['Tiles_Steppes'], walk: true },
  stony:        { name: 'Stony Ground', sheets: ['Tiles_Stony'], walk: true, stone: true },
  farm:         { name: 'Field',        sheets: ['Tiles_FarmingBase'], walk: true, farm: true },
  water:        { name: 'Water',        sheets: ['Tiles_LakeBase'], walk: false, water: true, autotile: 'lake' },
  river:        { name: 'River',        sheets: ['Tiles_FlowingWater'], walk: false, water: true, flowing: true },
  path:         { name: 'Path',         sheets: ['Tiles_PathEnd'], walk: true, autotile: 'path' },
};

/** Crop sheets: two variants of a three-stage sequence, frames 0-2 and 3-5. */
export const CROPS = {
  cabbage: { sheet: 'Tiles_FarmingCabbage', item: 'cabbage' },
  pumpkin: { sheet: 'Tiles_FarmingPumpkins', item: 'pumpkin' },
  tomato:  { sheet: 'Tiles_FarmingTomatos', item: 'tomato' },
};
export const CROP_STAGES = 3;

/** Frame for a crop at growth stage 0-2, in one of the two drawn variants. */
export function cropFrame(stage, variant = 0) {
  return (variant % 2) * CROP_STAGES + Math.min(stage, CROP_STAGES - 1);
}

// ------------------------------------------------------------- autotiling

/**
 * Neither autotile set is complete (docs/new_tiles.md): paths are missing 12 of
 * 15 four-connection pieces and all six five-connection ones, and lake shores
 * exist only for contiguous runs of land. Rather than draw a hole, fall back to
 * the closest mask that does exist, preferring to *drop* a connection over
 * inventing one — a missing spur reads as a dead end, an extra one reads as a
 * bug.
 */
export function nearestMask(table, mask) {
  const supported = Object.keys(table).map(Number);
  let best = null;
  let bestCost = Infinity;
  for (const m of supported) {
    const missing = popcount(mask & ~m);   // connections we lose
    const added = popcount(m & ~mask);     // connections we invent
    const cost = missing + added * 2;      // inventing one is twice as wrong
    if (cost < bestCost) { bestCost = cost; best = m; }
  }
  return best;
}

export const popcount = n => {
  let c = 0;
  for (let i = 0; i < 6; i++) if (n & (1 << i)) c++;
  return c;
};

/** Build the autotile resolvers around a loaded new_tiles/index.json. */
export function makeResolvers(index) {
  const lake = index.lakeByLandMask;
  const path = index.pathByMask;

  return {
    /** @param landMask bits set for edges where the neighbour is *not* water. */
    lake(landMask, q = 0, r = 0) {
      if (landMask === 0) {
        return { sprite: 'Tiles_LakeBase', frame: hashPick(q, r, FRAMES_PER_SHEET, 11) };
      }
      const hit = lake[landMask] || lake[nearestMask(lake, landMask)];
      return hit
        ? { sprite: hit[0], frame: hit[1] }
        : { sprite: 'Tiles_LakeBase', frame: 0 };
    },

    /** @param connMask bits set for edges that continue the path. */
    path(connMask) {
      const hit = path[connMask] || path[nearestMask(path, connMask)];
      return hit
        ? { sprite: hit[0], frame: hit[1] }
        : { sprite: 'Tiles_PathEnd', frame: 0 };
    },
  };
}

/** Which masks the art actually covers — used by the generator to stay in bounds. */
export function supportedMasks(index) {
  return {
    lake: new Set(Object.keys(index.lakeByLandMask).map(Number)),
    path: new Set(Object.keys(index.pathByMask).map(Number)),
  };
}

// ------------------------------------------------------------- variants

/**
 * Pick a sprite and frame for a plain terrain at (q, r). Deterministic, so the
 * renderer can call it every frame without the world shimmering.
 */
export function variantFor(terrainId, q, r) {
  const t = TERRAIN[terrainId] || TERRAIN.grass;
  const sheet = t.sheets[hashPick(q, r, t.sheets.length, 7)];
  return { sprite: sheet, frame: hashPick(q, r, FRAMES_PER_SHEET, 13) };
}

/** Terrain lookup that never returns undefined. */
export const terrainOf = id => TERRAIN[id] || TERRAIN.grass;
export const isWater = id => !!terrainOf(id).water;
export const isWalkable = id => !!terrainOf(id).walk;

// ------------------------------------------------------------- loading

/**
 * Load index.json and every sheet. Browser only — the pure logic above is
 * importable in node for tests.
 */
export async function loadTileset(basePath = TILE_DIR) {
  const index = await fetch(`${basePath}/index.json`).then(r => r.json());
  configure(index);

  const images = {};
  await Promise.all(SHEET_NAMES.map(name => new Promise(resolve => {
    const img = new Image();
    img.onload = () => { images[name] = img; resolve(); };
    img.onerror = () => { console.warn(`tileset: failed to load ${name}.png`); resolve(); };
    img.src = `${basePath}/${name}.png`;
  })));

  const missing = SHEET_NAMES.filter(n => !images[n]);
  if (missing.length) console.warn('tileset: missing sheets', missing);

  return { index, images, resolvers: makeResolvers(index), EDGE_BITS };
}
