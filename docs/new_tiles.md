# new_tiles — what they are and how to use them

Everything below was measured from the artwork by `tools/newtiles_index.js` and
verified by composing the sprites on the lattice (`tools/newtiles_map.js`), not
read off a spec sheet.

## Format

| | |
|---|---|
| sheets | 27 PNGs, each 192 x 48, RGBA — the original 22, plus the five generated terrains described at the end of this file, which now live in `new_tiles/` alongside them |
| frames | 6 per sheet, **32 x 48** each, packed left to right, no gutters |
| alpha | binary (0 or 255), with no exceptions |
| resolution | native 1x (not a pre-scaled export) |
| colours | 1276 distinct across the set; not an indexed palette |

These are **2.5D hexes with a side wall**, not flat top-down tiles. Each frame is:

```
rows  0-15   headroom — trees and other tall decor rise into this
rows 16-39   the hex top face: a flat-top hexagon, 32 wide x 24 tall
rows 40-47   the earth wall, 8px, the "thickness" of the tile
```

The top face is a flat-top hexagon with a 20px flat top and bottom edge and a
6px horizontal run on each diagonal.

## Layout

```
x = col * 26
y = row * 24 + (col & 1) * 12
```

Flat-top, **odd-q offset** — odd *columns* are pushed down by half a tile. Verified
exactly: the top face covers 624 px and the lattice cell is 26 x 24 = 624 px, and
a brute-force sweep of a 25,600 px interior region finds zero gaps and zero
overlaps.

**Draw back to front, sorted by screen y.** This is not optional. Each tile's wall
is meant to be covered by the tile in front of it, and trees overhang the tiles
behind. Sorting by `row * 24 + (col & 1) * 12` is sufficient.

## Scaling

Nearest neighbour, **integer factors only** (2x, 3x, 4x).

- The alpha is hard and the art is native 1x, so nearest neighbour is exactly
  right — there is nothing to interpolate and no pre-existing upscale to fight.
- At fractional zoom (1.5x, 2.5x) some source pixels become 2 screen pixels and
  others 3. It shows up worst on the hex diagonals and the 1px wall highlight,
  which start to crawl and shimmer.
- **Scale the layout constants by the same factor.** At 3x: `x = col*78`,
  `y = row*72 + (col&1)*36`.

The most robust approach is to render the whole map at 1x into an offscreen
buffer and upscale that buffer once. Every sprite then lands on the same pixel
grid by construction, and the layout maths stays in integers. Drawing each sprite
pre-scaled also works, but only if positions stay on integer multiples.

Engine settings:

| | |
|---|---|
| Canvas / CSS | `image-rendering: pixelated`, integer scale |
| Unity | Filter Mode **Point**, Compression **None**, Mip Maps **off**, PPU 32 |
| Godot | Texture filter **Nearest**; enable snap 2D transforms/vertices to pixel |
| WebGL / raw GL | `GL_NEAREST` for both min and mag, no mipmaps |

Mip maps in particular will quietly ruin this art at any zoom — turn them off.

## What each sheet contains

**Complete tiles, not overlays.** Every frame includes its own ground. There is no
separate "trees" layer to composite over a base, so you pick one tile per hex.
If you want pines on something other than the stock grass, that needs new art.

| sheet | frames |
|---|---|
| `Tiles_GrassBase1/2/3` | 3 sheets x 6 = 18 interchangeable grass variants |
| `Tiles_DecorNoTrees` | 6 grass tiles with rocks, logs, bushes, mushrooms |
| `Tiles_DecorOak`, `Tiles_DecorPine` | 6 each, wooded tiles; these overhang upward |
| `Tiles_FarmingBase` | 6 ploughed-soil tiles (plain, furrowed, crows, scarecrow) |
| `Tiles_FarmingCabbage/Pumpkins/Tomatos` | **3 growth stages x 2 variants**: frames 0-2 and 3-5 are each a sequence |
| `Tiles_LakeBase` | 6 open-water tiles (lilies, a duck, a jetty) |
| `Tiles_LakeSidesOne/Two/Three/Four` | shoreline pieces, indexed by land edges |
| `Tiles_Path*` | 7 sheets of path pieces, indexed by connections |

## Autotiling

Paths and shorelines are connection-mask sets. Edges are numbered clockwise from
the flat top: `N=1, NE=2, SE=4, S=8, SW=16, NW=32`. The full mapping is written to
`new_tiles/index.json` by `node tools/newtiles_index.js --json`.

The lake pieces follow a clean rule — for `LakeSidesK`, frame `i` puts land on the
`K` consecutive edges ending at edge `(i - 1) mod 6`:

```js
frame = (firstLandEdge + K) % 6      // K = number of contiguous land edges
```

### Coverage gaps — the real work

Neither set is complete, so a generator that produces arbitrary shapes will hit
missing art:

**Paths** (by number of connections)

| connections | have / possible | missing |
|---|---|---|
| 1 | 6 / 6 | — |
| 2 | 15 / 15 | — |
| 3 | 14 / 20 | the six *three-consecutive-edge* fans (e.g. N+NE+SE) |
| 4 | 3 / 15 | 12 |
| 5 | 0 / 6 | all |
| 6 | 1 / 1 | — |

Dead ends, straights and every corner are fully covered. Junctions are not.

**Lake shores** — only *contiguous* shorelines exist: 1, 2, 3 or 4 land edges in a
consecutive run (6 of each). Missing: any non-contiguous shoreline (a channel with
land on opposite sides), and 5 or 6 land edges (a single-hex pond).

Three options: constrain generation to the supported masks, fall back to the
nearest supported mask, or draw the missing pieces.

## Blemishes

- ~~One semi-transparent pixel: `Tiles_DecorNoTrees.png` at (130, 22), frame 4,
  alpha 38.~~ **Fixed.** Flattened to 0, because that position is transparent in
  all five other frames — it sits on the hexagon's upper-left diagonal, one pixel
  outside the silhouette every frame otherwise shares. The alpha is now binary
  across the whole set with no exceptions.
- The palette carries a lot of near-duplicate colours — the grass base alone uses
  141 shades, many differing by 1-3 per channel and imperceptible. Fine as-is;
  quantise first if you ever want palette swaps or recolouring.

## Fit with the existing assets

Two things to decide:

1. **Palette.** Zero of the 1276 tile colours are in SWEETIE-16, which the 133 item
   icons use. Side by side, the map and the inventory will read as two different
   games. Either recolour the tiles toward the icon palette, redo the icons
   against the tile palette, or accept the split (defensible if icons only ever
   appear on UI panels, not on the map).
2. **Terrain coverage.** This set is grass / lake / farm / path / woods. It has
   nothing for steppes, stony ground, forest floor, pine floor, or flowing
   water — five of the eight terrains in the earlier tile brief. The terrain model
   needs to shrink to what exists, or the set needs extending.

## Tools

```
node tools/newtiles_index.js --json     # derive the autotile tables -> new_tiles/index.json
node tools/newtiles_map.js out.png grass 4   # render a grass field at 4x
node tools/newtiles_map.js out.png mixed 4   # lake, paths, trees, crops
```

`tools/png_read.js` is a dependency-free PNG decoder used by both.

---

# Generating matching terrain

`tools/newtiles_gen.js` produces five extra terrain sheets in the same style:
steppes, stony, forest floor, pine floor and flowing water, written to
`new_tiles_gen/` as 192x48 sheets of 6 frames, identical in format to the
originals.

```
node tools/newtiles_gen.js [outdir]           # default new_tiles_gen/
node tools/newtiles_map.js out.png blend 4    # generated tiles next to the originals
```

## How it matches the style

Nothing is drawn from scratch. `Tiles_GrassBase1` frame 0 is used as a
**structural template**: its sprite is classified into WALL / RIM / INTERIOR, the
wall is copied pixel-for-pixel, the rim is recoloured, and only the top face is
retextured. Geometry, silhouette and wall shading therefore match by
construction. A check confirms it — every generated sheet has a silhouette and
wall byte-identical to the source, and binary alpha.

Three things were read off the original art rather than guessed:

1. **The ramps are tight.** Their grass base is `rgb(162,183,46)` and its mottle
   `rgb(150,173,38)` — about 10 luminance apart. That is the whole reason their
   mottling reads as ground. Every generated terrain keeps the same spacing:
   mottle ~-10, rim ~-19, detail ~-33 luminance from base.
2. **Mottling is large and connected**, not small clusters — patches ten-plus
   pixels across. That only works because of (1); at wide palette steps the same
   shapes read as camouflage. A smooth noise field thresholded to an exact
   coverage fraction reproduces it, with coverage rising across frames 0-5 so
   frame 0 is nearly plain, like theirs.
3. **Every solid object has a dark outline right around it.** Their boulders are
   a 1px outline, a lit top edge, a body and a shade. Without that outline a rock
   reads as a smudge; sprites here are authored as explicit little stamps.

Colours are sampled from the existing sheets — rock greys from `DecorNoTrees`,
soil from `FarmingBase`, blues from `LakeBase`, greens from `DecorPine` — or
interpolated between two of them, so the palette cannot drift.

Two deliberate departures: **stony** pitches its ground darker than the rock body
so the boulders read against it, and **flowing water** is lighter and more
turquoise than the still lake, so a stream meeting a lake reads as moving
shallow water rather than merging invisibly. Like the lake tiles, it has no rim.

## Walls

The wall takes the terrain's own colour, slightly muted, rather than the stock tan.
It is re-hued **by luminance**, not by swapping four fixed tones: each wall pixel's
brightness is measured as a position within the original wall's range and
reproduced at the same relative position in the new ramp. That keeps the whole
shading structure the artist built — lit front face, darker sides, dark outline —
and only changes the hue. Swapping tones would have flattened it.

Per terrain, `wall: { from, mute, top, range }`:

- `from` — the hue to build from; `mute` — how far to pull it toward its own grey
- `top` — where the brightest wall pixel sits relative to the top-face base
- `range` — the wall's luminance spread, compressed slightly to mute it

One thing that needed care: **a wall has to separate from its own top face or the
tile stops reading as 3D.** The original gets that separation from hue — green top,
tan wall. Where the terrain is already earth-coloured there is no hue contrast to
lean on, so the bank is set darker and warmer than the surface instead. The first
attempt at steppes had a pale wall under a pale straw top and the tile went flat.

Flowing water is the deliberate exception: its wall is a wet grey-blue bed rather
than water-coloured, because a turquoise wall reads as a floating block of water
instead of a bank.

Side effect worth knowing: re-hueing collapses the near-duplicate noise in the
original wall (imperceptible 1-3 value jitter), so the generated sheets carry
~34 colours against the source's ~141. The visible structure is unchanged.

## What these do NOT include

- **No autotile pieces.** These are base tiles only. There are no shoreline
  transitions for flowing water, and no path variants crossing them.
- **No decor variants.** The originals ship both a bare base and wooded versions;
  these are bare only. A "pine floor with pines" tile would need the tree sprites
  composited in.
- **Not hand-drawn.** They are procedurally assembled from the real palette and
  the real structure, which gets the family resemblance right, but an artist
  would give each tile intent — a drift of scree, a worn track — that a
  generator does not invent.
