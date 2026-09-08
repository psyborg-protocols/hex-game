// mapformat.js
// One map format, two producers: the seeded generator and editor.html.
//
// The editor thinks in individual stacked tiles keyed "q,r,h"; the game thinks in
// columns — one terrain, one height, one surface sprite per (q, r). Both views
// are kept here so a hand-edited map opens in the game and a generated map opens
// in the editor.

import { columnKey, neighbors, EDGE_BITS, EDGE_ORDER } from './hexgrid.js';
import { TERRAIN, CROPS, variantFor, terrainOf, isWater } from './tileset.js';

export const MAP_VERSION = 2;

/** Sheet name -> terrain id, for reading maps the editor wrote. */
const SHEET_TO_TERRAIN = (() => {
  const m = new Map();
  for (const [id, t] of Object.entries(TERRAIN)) for (const s of t.sheets) m.set(s, id);
  // The autotiled sets name many sheets that the terrain table does not list.
  for (const s of ['Tiles_LakeSidesOne', 'Tiles_LakeSidesTwo', 'Tiles_LakeSidesThree', 'Tiles_LakeSidesFour']) {
    m.set(s, 'water');
  }
  for (const s of ['Tiles_PathEnd', 'Tiles_PathsStraight', 'Tiles_PathSmallCorner', 'Tiles_PathWideCorner',
    'Tiles_PathCrosses', 'Tiles_PathBranchCrossLeft', 'Tiles_PathBranchCrossRight']) {
    m.set(s, 'path');
  }
  for (const [id, c] of Object.entries(CROPS)) m.set(c.sheet, 'farm');
  return m;
})();

/** The editor's palette ids, for maps that carry them. */
const PALETTE_TO_TERRAIN = {
  Grass: 'grass', Decor: 'meadow', Farming: 'farm', Lake: 'water', Path: 'path',
  Steppes: 'steppes', Stony: 'stony', Forest: 'forest_floor', Pine: 'pine_floor', Flowing: 'river',
};

/**
 * A world. Columns are the unit of gameplay: you stand on a column, mine a
 * column, build on a column.
 *
 *   column = { h, terrain, sprite, frame, feature? }
 *   h       top level, 0 = ground. A column of h=3 shows three walls of cliff.
 *   feature { type, ... } — trees, ore, a village, a crop; the things you act on.
 */
export class WorldMap {
  constructor({ seed = 'default', name = 'untitled' } = {}) {
    this.seed = seed;
    this.name = name;
    this.columns = new Map();     // "q,r" -> column
    this.structures = [];         // ladders, bridges — they span two columns
    this.spawn = { q: 0, r: 0 };
    this.bounds = null;           // cached {minQ,maxQ,minR,maxR}
    this.peak = null;             // cached tallest column
  }

  // ------------------------------------------------------------ columns

  get(q, r) { return this.columns.get(columnKey(q, r)); }
  has(q, r) { return this.columns.has(columnKey(q, r)); }

  /** Height of a column, or -1 where there is nothing at all. */
  heightAt(q, r) {
    const c = this.columns.get(columnKey(q, r));
    return c ? c.h : -1;
  }

  terrainAt(q, r) {
    const c = this.columns.get(columnKey(q, r));
    return c ? c.terrain : null;
  }

  set(q, r, column) {
    this.columns.set(columnKey(q, r), { q, r, ...column });
    this.bounds = null;
    this.peak = null;
    return this.columns.get(columnKey(q, r));
  }

  /**
   * The tallest column, which is how far above its own ground line the map's art
   * can reach — the renderer needs it to know how far past the viewport to scan.
   *
   * Mining lowers `h` in place rather than through `set`, so this can be left
   * standing one level high. That is the safe direction: it costs a row of extra
   * scanning, where an under-estimate would clip a mountain off the screen.
   */
  peakHeight() {
    if (this.peak === null) {
      this.peak = 0;
      for (const c of this.columns.values()) if (c.h > this.peak) this.peak = c.h;
    }
    return this.peak;
  }

  /** Place terrain, choosing a sprite variant unless one is given. */
  place(q, r, terrain, h = 0, extra = {}) {
    const v = extra.sprite ? { sprite: extra.sprite, frame: extra.frame ?? 0 } : variantFor(terrain, q, r);
    return this.set(q, r, { h, terrain, ...v, ...extra });
  }

  delete(q, r) {
    this.bounds = null;
    this.peak = null;
    return this.columns.delete(columnKey(q, r));
  }

  *[Symbol.iterator]() { yield* this.columns.values(); }
  get size() { return this.columns.size; }

  extent() {
    if (this.bounds) return this.bounds;
    let minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity;
    for (const c of this.columns.values()) {
      if (c.q < minQ) minQ = c.q;
      if (c.q > maxQ) maxQ = c.q;
      if (c.r < minR) minR = c.r;
      if (c.r > maxR) maxR = c.r;
    }
    this.bounds = this.columns.size
      ? { minQ, maxQ, minR, maxR }
      : { minQ: 0, maxQ: 0, minR: 0, maxR: 0 };
    return this.bounds;
  }

  // ------------------------------------------------------------ masks

  /**
   * Edge mask for autotiling. `matches(column, q, r)` decides whether the
   * neighbour across an edge counts; a missing neighbour is passed as null.
   */
  edgeMask(q, r, matches) {
    let mask = 0;
    neighbors(q, r).forEach((n, i) => {
      if (matches(this.get(n.q, n.r), n.q, n.r)) mask |= (1 << i);
    });
    return mask;
  }

  /** Bits set on edges where this water tile meets land — what lake shores index on. */
  landMask(q, r) {
    return this.edgeMask(q, r, col => !col || !isWater(col.terrain));
  }

  /** Bits set on edges that continue a path. */
  pathMask(q, r) {
    return this.edgeMask(q, r, col => !!col && col.terrain === 'path');
  }

  // ------------------------------------------------------------ structures

  addStructure(s) { this.structures.push(s); return s; }

  structureAt(q, r) {
    return this.structures.find(s =>
      (s.from && s.from.q === q && s.from.r === r) ||
      (s.to && s.to.q === q && s.to.r === r) ||
      (s.q === q && s.r === r));
  }

  // ------------------------------------------------------------ serialise

  /**
   * The wire format. `tiles` is exactly the shape editor.js saves and loads —
   * one entry per stacked level — so an exported map opens in the editor.
   */
  toJSON() {
    const tiles = [];
    const columns = [];
    for (const c of this.columns.values()) {
      for (let h = 0; h <= c.h; h++) {
        // Only the top level shows its face; the ones below are buried, but the
        // editor expects a full stack, so they carry the same sprite.
        tiles.push([`${c.q},${c.r},${h}`, { id: paletteIdFor(c.terrain), sprite: c.sprite, frame: c.frame }]);
      }
      columns.push([columnKey(c.q, c.r), {
        h: c.h, terrain: c.terrain, sprite: c.sprite, frame: c.frame,
        ...(c.feature ? { feature: c.feature } : {}),
      }]);
    }
    return {
      version: MAP_VERSION,
      name: this.name,
      seed: this.seed,
      spawn: this.spawn,
      structures: this.structures,
      columns,
      tiles,
    };
  }

  static fromJSON(data) {
    const map = new WorldMap({ seed: data.seed, name: data.name });
    map.spawn = data.spawn || { q: 0, r: 0 };
    map.structures = data.structures || [];

    if (Array.isArray(data.columns)) {
      // A map this game wrote: the column view is authoritative.
      for (const [key, col] of data.columns) {
        const [q, r] = key.split(',').map(Number);
        map.set(q, r, col);
      }
      return map;
    }

    // A map the editor wrote: collapse each "q,r,h" stack into one column.
    const raw = Array.isArray(data) ? data : data.tiles;
    for (const [key, tile] of raw) {
      const [q, r, h] = key.split(',').map(Number);
      const existing = map.get(q, r);
      if (existing && existing.h >= h) continue;   // keep the topmost face
      map.set(q, r, {
        h,
        terrain: terrainForTile(tile),
        sprite: tile.sprite,
        frame: tile.frame ?? 0,
      });
    }
    return map;
  }
}

/** Best guess at what terrain an editor tile represents. */
export function terrainForTile(tile) {
  if (tile.terrain && TERRAIN[tile.terrain]) return tile.terrain;
  const bySheet = SHEET_TO_TERRAIN.get(tile.sprite);
  if (bySheet) return bySheet;
  const byPalette = PALETTE_TO_TERRAIN[tile.id];
  if (byPalette) return byPalette;
  return 'grass';
}

/** The editor palette id a terrain belongs to, so round-tripping keeps its brush. */
export function paletteIdFor(terrain) {
  if (terrain === 'water') return 'Lake';
  if (terrain === 'path') return 'Path';
  const found = Object.entries(PALETTE_TO_TERRAIN).find(([, t]) => t === terrain);
  return found ? found[0] : terrain;
}

export { EDGE_BITS, EDGE_ORDER };
