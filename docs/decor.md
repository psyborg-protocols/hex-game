# decor — the prop sheet, and how the game stands things on tiles

Everything below was measured from the artwork by `tools/decor_index.js`, not
read off a spec sheet.

## Format

| | |
|---|---|
| sheet | `decor/Decor.png`, 80 x 160, RGBA |
| grid | 16 x 16 — five columns by ten rows |
| sprites | 40, one per cell |
| alpha | 0, 51 and 255 |
| resolution | native 1x |

The five columns are **growth stages**, small on the left. Most subjects occupy
one row; the two tree bands occupy two, because a full-grown canopy rises out of
the cell above its trunk.

| rows | contents |
|---|---|
| 0-1 | `pine_0`..`pine_3`, then `pine_stump` |
| 2-3 | `oak_0`..`oak_3`, then `oak_stump` |
| 4 | `mushroom_0`..`mushroom_2`, `log_0`, `log_1` |
| 5 | `rock_0`..`rock_4` |
| 6 | `bush_0`..`bush_2`, `seedling_0`, `seedling_1` |
| 7 | `pumpkin_0`..`pumpkin_4` |
| 8 | `cabbage_0`..`cabbage_4` |
| 9 | `tomato_0`..`tomato_4` |

`decor/index.json` carries a measured box per sprite plus a **foot point** —
the spot you line up with the centre of a hex's top face to stand it there.
Regenerate it with:

```
node tools/decor_index.js            # report what it measured
node tools/decor_index.js --json     # ... and rewrite decor/index.json
```

### Segmentation is per cell, not per blob

The obvious way to find the sprites — flood fill the opaque pixels — is wrong
here. The cabbage in row 8 and the tomato in row 9 touch at the row boundary, so
a fill merges them into one 24px-tall blob. Clipping to the grid band splits them
correctly, and every one of the 40 cells then comes out with exactly one sprite.

### The soft pixels are shadows

161 pixels carry alpha 51, all `rgb(100, 0, 56)`, all clustered at the base of a
sprite. They are contact shadows, not the stray-pixel blemish `new_tiles.md`
describes in `Tiles_DecorNoTrees.png`. **Do not flatten them** — at full alpha
they would become opaque magenta.

## How the game uses it

The tile sheets are complete tiles, not overlays: a wooded hex from
`Tiles_DecorOak` carries trees the artist drew. But the *generated* terrains
(`Tiles_ForestFloor`, `Tiles_PineFloor`) are bare, which `new_tiles.md` names as a
gap — "a pine floor with pines would need the tree sprites composited in".

`src/render/decor.js` is that compositing, done at draw time rather than baked.
A column whose terrain is `forest_floor` or `pine_floor` and which carries a
`{ type: 'trees', kind, remaining }` feature gets up to `MAX_TREES` trees stood
on its top face, positioned by a hash of the coordinate so the world does not
shimmer and neighbouring hexes do not line up.

Drawing rather than baking is what lets **felling thin a wood out**: the trees on
screen are the trees still standing, so each chop removes one, and the last chop
leaves the bare floor. Chopping is therefore offered wherever a `trees` feature
has anything left, not on a fixed list of terrains.

The dense woods are left alone. The artist's sheets already have trees on them,
and better ones.

Rocks, bushes, logs, mushrooms and the three crops are indexed and unused so far.
`groups` in the index exists so a caller can ask for "a rock" without knowing
which cell it lives in.
