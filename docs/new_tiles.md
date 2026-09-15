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

### Coverage gaps in the shipped art — since filled

The art as delivered did not cover every mask. It does now: see *Filling the
autotile gaps, and streams* at the end of this file. Recorded here because the
shape of the original set still explains how the sheets are organised.

**Paths** (by number of connections, as shipped)

| connections | shipped | missing |
|---|---|---|
| 1 | 6 / 6 | — |
| 2 | 15 / 15 | — |
| 3 | 14 / 20 | the six *three-consecutive-edge* fans (e.g. N+NE+SE) |
| 4 | 3 / 15 | 12 |
| 5 | 0 / 6 | all |
| 6 | 1 / 1 | — |

Dead ends, straights and every corner were fully covered. Junctions were not.

**Lake shores** — only *contiguous* shorelines shipped: 1, 2, 3 or 4 land edges in
a consecutive run (6 of each). Missing were any broken shoreline (land on
opposite sides with water between), and 5 or 6 land edges.

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

---

# Filling the autotile gaps, and streams

`tools/newtiles_channels.js` synthesises the path junctions the original set was
missing, a one-tile-wide stream set, and the shorelines a stream needs in order
to meet a lake. Everything lands in `new_tiles/` as 192x48 six-frame sheets.

```
node tools/newtiles_channels.js          # write the sheets
node tools/newtiles_index.js --json      # re-derive index.json from the pixels
node tools/newtiles_scene.js out.png 4   # a lake, streams feeding it, and a track
```

After it runs, all three tables cover every one of the 63 masks:

| set | before | after |
|---|---|---|
| paths | 39 / 63 | **63 / 63** |
| lake shorelines | 24 / 63 | **63 / 63** |
| streams | — | **63 / 63** |

## Why synthesis, not flipping

Flipping yields nothing. The shipped sheets already hold all six rotations of
every shape they cover, so the set is closed under rotation; and the Left/Right
branch sheets are already mirrors of each other, so it is closed under reflection
too. Every missing mask had to be built.

## Method

A path arm is a constant-width band from one edge to the middle of the tile.
`Tiles_PathsStraight` holds three straights (N-S, NE-SW, SE-NW), so splitting
each through the centre yields six arms **drawn by the artist**. Any mask is then
the union of its arms plus a small disc at the centre, which rounds dead ends and
keeps junctions solid.

The band edges are rebuilt rather than copied, because a union creates borders
the source never had. The structure is read off the art: fill, a 1px darker rim
just inside the region, and a 1px dark-grass shadow just outside where the track
cuts the turf. A stream is the same three-band structure with the lake's colours
— sandy shore outside, the lake's under-bank shadow inside, lake water in the
middle — so a stream running into a lake merges with it rather than butting up
against it. Streams are eroded one pixel narrower than a cart track.

A lake tile is the **inverse** of a channel: grass laid on water instead of water
laid on grass. Same painter, different region. The six land bands are lifted from
`Tiles_LakeSidesOne`, one per edge.

Validation: synthesised versions of pieces the artist *did* draw were rendered
beside the originals before trusting the method on the missing ones. The straight
is near-identical and the six-way junction very close; synthesised corners sweep
slightly wider than the hand-drawn ones.

## Three things the renders caught

- **Seams.** A channel pixel at the hex boundary is not a border — the channel
  continues into the next tile. Treating it as one drew a dark rim across every
  tile join, banding the stream into segments.
- **Floating decor read as land.** The artist floats lily pads and reeds in open
  water. They are green, so a naive "not water" test called them land and every
  unioned shoreline came out shot through with islands. Only land that reaches
  the rim counts.
- **Banks closing the mouth.** Each source shore tile has land on one edge only,
  so its bank spreads sideways into the neighbouring edges' territory. Unioned,
  those overhangs sealed shut the very edge the tile was supposed to leave open.
  Each band is now clipped to the wedge it faces.

Water is also filtered to the components that actually reach an open edge, so a
pinched-off pocket cannot render as a little walled pond mid-tile — which is what
appeared where the first stream met the lake.

## Integration

`index.json` stays **derived from the pixels**: the new sheets are probed like any
other art by `tools/newtiles_index.js`, which now also emits `streamByMask`. As a
cross-check, all 63 stream tiles read back blind as exactly the mask they were
built for.

`tests/autotile.test.mjs` previously asserted the gaps as invariants — that paths
stopped at 14 three-ways and that shorelines were contiguous-only. Those
assertions described a limitation that no longer holds and now assert full
coverage instead. The fallback machinery is still tested.

Streams are registered as water in the sheet tables, so they load and round-trip
through the map format. Giving them a **terrain id and a resolver of their own**
is a gameplay decision and is not done here — the art and the mask table are
ready for it.

## Streams as terrain, and where they come from

`stream` is its own terrain id: water, one hex wide, autotiled from
`WorldMap.waterMask` — the edges whose neighbour is *any* water. Because it
carries the lake's own colours, a stream that reaches a pond or the river joins
it rather than stopping at the shore. `makeResolvers().stream(connMask)` reads
`index.streamByMask`, the same shape as the path and lake tables.

Worldgen adds them in `addPondsAndStreams()`, between carving the river and
smoothing the shores so the new banks get eased too:

- **Ponds** are ordinary `water`, 1-3 hexes, on low ground more than four
  columns clear of the river. A one-hex pond is land on all six edges — mask 63,
  the enclosed shoreline piece, which the shipped art never had.
- **Streams** run from a pond toward the river, preferring downhill but weighting
  the river three to one so the channel arrives instead of wandering a contour.
  They stop as soon as they are beside water that is not their own pond, so the
  last hex reads as a mouth. One pond in four is left with no outlet.

Streams only ever hang off a pond and end at water or nowhere, which is what
keeps them from fencing land off: a chain that dead-ends, or that ends at the
river, can be walked around at its head. Measured across eight seeds, land
unreachable without crossing water moved by about a point either way against the
same seeds before the change — some worlds improved.

### A trap in deriving the tables

Sheets whose rotation family has fewer than six members pad the spare slots with
plain ground — and plain ground probes as land on all six edges, which is mask
63, a *legitimate* shoreline. A filler frame in an earlier sheet was therefore
claiming 63 before `Tiles_LakeSidesSix` could, and every one-hex pond drew as
blank grass. `tools/newtiles_index.js` now skips any frame that does not contain
the feature it would be indexed for, and `tests/autotile.test.mjs` checks every
table entry points at a frame that actually holds water.

The other place this bites: the editor's tile format carries no terrain id, so
the sheet name is the only record of what a tile is. Grouping the stream sheets
with the lake sheets in `SHEET_TO_TERRAIN` made streams come back from a
round-trip as lakes.

### Which LakeBase frame open water picks

`Tiles_LakeBase` frame roles, measured rather than assumed: 0 is plain open
water, 1-3 carry lilies or a duck, 4-5 carry a jetty.

Open water is by definition a hex with no land on any edge, so hashing evenly
across all six grew **jetties in the middle of the lake**, a third of the time,
moored to nothing. They are excluded from the pool and stay available to place
by hand.

Dropping them is not enough on its own: three of the four survivors are
decorated, so a flat pick decorated three hexes in four and the lake came out a
lily pond — worse than the jetties. `LAKE_OPEN_FRAMES` is therefore a weighted
pool giving roughly one decorated hex in four.

The **big river** uses `DEEP_OPEN_FRAMES`, the plain frame alone: lilies and
waterfowl belong on still water. It resolves through the same shoreline set as a
lake, so it carries banks instead of meeting the grass at a hard edge, and it no
longer draws the stony `Tiles_FlowingWater` — that art reads as shallow, which is
what the one-hex streams are for. The sheet stays available to paint by hand.

One consequence worth knowing: river and lake now draw the same sheet, so the
sheet name alone cannot tell them apart. `terrainForTile` therefore trusts the
editor's palette id ahead of the sprite, and falls back to the sheet only when
the id is missing or unknown.

## The bridge deck

`Tiles_Bridge` is the artist's jetty — `Tiles_LakeBase` frames 4 and 5 — made
longer and a little wider: the same five wood tones, 2-pixel rails, plank pitch
of three, and corner posts. The jetty is 10 wide and 15 long and stops in open
water; the deck runs the full span of a top face and is as wide as a path, so a
road can walk onto it. `tools/newtiles_bridge.js` builds it.

Three frames cover all six directions. A bridge spans a pair of opposite edges,
and edges are numbered clockwise from the flat top, so an edge and the one
facing it are three apart: `bridgeFrame(edge) === edge % 3`. N and S share frame
0, NE and SW frame 1, SE and NW frame 2 — and the last two are mirror images,
which is why three is enough.

It is **not a terrain**. It draws over whatever tile it is on, so the water
underneath keeps flowing and the posts are free to hang below the face and the
caps to rise above it. Nothing places one yet; the art and `bridgeFrame` are
what a placement pass will need.

### Why the diagonals run 13:6

A diagonal in pixel art usually wants 2:1, and the path art uses it. A bridge
cannot: a step to the NE neighbour moves the screen by `(+26, -12)`, so a deck
drawn at 2:1 leaves its tile half a pixel high and enters the next half a pixel
low, and a chain of them zigzags at every joint. Paths hide that — their edges
are soft and hand-dithered — but a hard 2-pixel rail shows it. 13:6 costs one
three-wide tread in an otherwise two-wide stair and lands dead on the edge
midpoints, so a causeway of any length reads as one continuous deck.

### Width, and why it differs per axis

A path is 12 wide on the N-S frame and 10 tall on the diagonals, and the bridge
matches both. The ground plane is squashed vertically, so a deck lying across
the view foreshortens; using one number for all three axes would make the
diagonals look fat.

### Which posts show a leg

All four corner posts are drawn, but a post is only visible below the deck when
no part of the deck stands between it and the viewer — that is, when nothing of
the deck falls below it in its own column. On the vertical run that hides both
posts at the far end, leaving two tips above and two legs below, exactly as on
the jetty. On a diagonal it hides three of the four, leaving one leg at the
lowest corner, which is what a narrow deck seen from this angle actually does.

`tools/newtiles_bridgescene.js` renders three causeways, one per run, each three
tiles long, with the jetty beside them for comparison. It walks the chains with
the game's own `neighbor()`: a run has to leave a tile by the edge its neighbour
arrives on, and eyeballing that on an odd-q lattice is exactly the mistake the
scene exists to catch.
