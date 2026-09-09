# Terrain Tile Pipeline

Eight hex terrain tiles, drawn on the same SWEETIE-16 palette as the item icons
so the map and the inventory read as one game.

```
tools/hexcanvas.js       hex geometry, the lattice, and the drawing canvas
tools/tiles.js           the eight terrain draw functions
tools/generate_tiles.js  validates + writes tiles/*.svg and tiles/tileset.json
tools/tile_preview.js    lays tiles out on the real lattice, renders PNG, proves the tiling
```

## 1. The hexagon

Pointy-top, **32 x 37 px**. The left-edge inset per row steps `2,2,1,2,2,1,2,2`
down the cap — a staircase averaging 1.75 px/row against the 1.732 (`2/√3`) a
regular hexagon wants. Width/height comes out at `32/37 = 0.8649` where a regular
hexagon is `0.8660`, so it is regular to within a pixel.

The staircase is a **palindrome**, and that is not cosmetic. With insets
`a[1..m]`, two hexes interlock only if

```
a[u] + a[m+1-u] = W/2   for every u
```

This profile satisfies it exactly — every pair sums to 16. The consequence is
that one hex covers **896 px** and the lattice cell is **32 x 28 = 896 px**: the
plane is covered with no gaps and no overlaps.

A staircase of uniform 2 px steps also tiles, but forces `W ≈ H`, giving the
squat hexagon most pixel tilesets settle for. The 2,2,1 pattern buys back the
proportion while keeping the interlock exact.

## 2. Layout

A hex at grid `(col, row)` is drawn at

```
x = col * 32 + (row & 1) * 16
y = row * 28
```

`tiles/tileset.json` carries these numbers so an engine never has to rediscover
them from the artwork. The SVGs declare `128 x 148`, a uniform 4x scale of the
`32 x 37` viewBox, so the lattice stays exact at the declared size (multiply the
steps by the same factor).

## 3. Seamlessness

Every drawing call goes through `H.px`, which **folds** any point outside the
hexagon back to the equivalent point inside it under the lattice. A cluster drawn
across the border therefore reappears on the far side exactly where the
neighbouring tile would continue it — clusters loop around the edge instead of
being cut, which is Schlitter's advice for hiding seams, enforced mechanically
rather than by hand.

Two supporting pieces:

- **`terrainField`** builds value noise from cosines on the *reciprocal lattice*
  vectors, so the low-frequency shading is exactly periodic under the hex lattice
  and cannot seam either.
- **`H.scatter`** spaces clusters using `latticeDist`, distance measured across
  the wrap, so nothing clumps against its own wrapped copy at the border.

## 4. How a tile is built

1. flat base tone over the whole hex — most of the tile stays this colour
2. one broad, low-coverage patch (`H.patch`, specified as a **coverage fraction**
   rather than a threshold, so the value range stays predictable and compressed)
3. small irregular 4-pixel `mottle` clusters of the light and shade tones — never
   single pixels, never large blobs; that distinction is the whole difference
   between texture and camouflage
4. sparse key clusters carrying the terrain's identity: tufts, pebbles, leaves,
   needles, crests

Roughly 75–80% of each tile is left as flat base. That negative space is what
lets a field of them breathe.

**No ink outline.** The item icons have one; ground tiles must not. A black rim
would darken the terrain and turn the map into a board-game grid. Hex edges read
from the colour change alone.

## 5. Variants

One tile repeated over a map always patterns, however good it is. Each terrain
ships **4 variants** (`meadow.svg`, `meadow_v2.svg`, …) differing in noise phase
and cluster placement. Pick one per hex from a positional hash:

```js
const v = Math.abs((col * 73856093) ^ (row * 19349663)) % 4;
```

Any variant of a terrain is interchangeable with any other.

## 6. Value plan

Same-hue terrains are separated by value, different-hue ones may share it.
Mean luminance across all variants:

| tile | mean | reads as |
|---|---|---|
| steppes | 194 | straw |
| meadow | 189 | light lush green |
| stony | 162 | mid grey |
| stream | 146 | light blue |
| grassland | 144 | deep green |
| forest_bed | 103 | warm red-brown |
| deep_water | 91 | dark blue |
| pine_forest_bed | 79 | dark purple-brown |

Meadow vs grassland and forest bed vs pine bed are the pairs that would otherwise
collide, so they are pushed 45 and 24 apart respectively. Busy tiles (stony, pine
bed) sit against calm ones (deep water, grassland) rather than every tile being
dense.

## 7. Verify loop

```
node tools/generate_tiles.js              # validate + write tiles/
node tools/tile_preview.js --verify       # prove the tiling
```

`--verify` checks four things: the palindrome identity, hex area against lattice
cell area, a brute-force sweep confirming every pixel of a large region is
covered exactly once, and that no tile has holes, spills outside the hexagon, or
uses an off-palette colour. `generate_tiles.js` additionally decodes each written
SVG back to a grid and compares, so the file that ships is provably the geometry
that was tested.

It is worth confirming the check still bites after changing the geometry: break
the inset profile and `--verify` should report overlapping pixels and exit 1.

### Look at them

```
node tools/tile_preview.js sheet.png                 # all tiles, patches side by side
node tools/tile_preview.js field.png meadow          # one terrain over a field
node tools/tile_preview.js map.png --map             # mixed map, terrains meeting
```

All three lay hexes on the real lattice and cycle variants per hex, so what you
judge is what the game will draw. Write PNGs to a scratch directory, not the repo.
