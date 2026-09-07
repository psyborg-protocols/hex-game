# Game Assets — Discovery-Path Crafting Game

Data + art for a hex-world survival/crafting game built on **real anthropological
discovery sequences**: true scarcity (worlds gate you), redundancy (multiple routes
to every gated achievement), non-linear progression (skills unlock gates in both
directions), and maximum interdependence between five skill domains.

## Layout

```
research/discovery_paths.md   Anthropological research: real discovery chronology per
                              skill (Acheulean→atlatl→bow→pottery→farming→metallurgy,
                              smiths-as-priests, Dunbar numbers, gift economies,
                              meditation/ritual evidence) + 10 design laws.
skill_map.md                  Skill/dependency map: bootstrap path, circular gates
                              (tongs→tongs), cross-skill gates, redundancy pairs.
data/game_data.js             Source of truth (ES module).
data/game_data.json           Generated export (node tools/to_json.js).
tools/pcanvas.js              16x16 pixel-canvas authoring helper (auto-outline).
tools/preview.js              Renders icons to a PNG contact sheet (no deps) for review.
tools/hexcanvas.js            Hex tile geometry, lattice and seam-free drawing canvas.
tools/tiles.js                8 terrain tile draw functions.
tools/generate_tiles.js       Validates tiles -> writes tiles/*.svg + tileset.json.
tools/tile_preview.js         Lays tiles on the lattice; --verify proves the tiling.
tools/pixel_art_1.js          27 gathering/food icons (draw functions).
tools/pixel_art_2.js          37 wood/stone/oven icons (draw functions).
tools/pixel_art_3.js          33 home/metal/metal/mind icons + 5 skill glyphs.
tools/generate_icons.js       Validates grids → writes all SVGs.
tools/to_json.js              Exports game_data.json from game_data.js.
icons/*.svg                   91 item icons (16x16, SWEETIE-16, one <path> per color).
icons/skills/*.svg            5 skill glyphs.
icons/abilities/*.svg         35 ability icons (glyph + level pips, lvl 1–7).
tiles/*.svg                   8 terrain hex tiles x 4 variants (32x37, pointy-top).
tiles/tileset.json            Hex size + lattice steps an engine needs to lay them out.
```

## Data model

- **91 items** with id, name, stack size, icon, category, and base price.
- **~70 recipes**: inputs (item → count), output (item → count), skill, level, xp,
  `tools` (item id or `[id, ...]` = any-of), and `needs` (buildings/structures that
  must exist — the world-scarcity gates).
- **SKILL_INFO**: 5 skills × 7 levels of ability descriptions.
- **SKILL_DEPS / CIRCULAR_DEPS / CROSS_SKILL_GATES**: the non-linear graph,
  including intentional circular dependencies (e.g. forging tongs needs tongs —
  you improvise with the previous tier or a bone set).

### Skills
| Skill | Covers |
|---|---|
| stoneworking | knapping, grinding, walls, hearths/ovens, quarrying, smelting support |
| woodworking | felling, beams, furniture, boats/bridges/carts, farming tools |
| homesteading | planting→harvest, cooking tiers, houses, smokehouse, granary, water |
| metalworking | ore prospecting (via lore), smelting, forging, tiered tools |
| mind | prayer/meditation, nature attentiveness, resource awareness, trade & strangers |

## Tiers (per real historical sequences)
- Ovens: hearth → stone_oven → clay_oven → kiln → bakehouse (5)
- Tongs: bone_tongs → tongs → fine_tongs (3)
- Adze: stone_adze → bone_adze → axe (3)
- Pots: pot → fine_pot (2) · Hoe: wood_hoe → hoe (2) · Plough: wood_plough → plough (2)
- Arrows: arrow → fine_arrow (2)
- Ores/ingots: deliberately **one** tier — no copper/bronze/steel split.

## Regenerating

```
node tools/generate_icons.js       # validate + write icons/
node tools/generate_tiles.js       # validate + write tiles/
node tools/tile_preview.js --verify # prove the hex tiling is gapless
node tools/to_json.js              # rewrite data/game_data.json
```

Art is authored as draw-functions on the 16x16 canvas (`tools/pcanvas.js`), rendered
with the SWEETIE-16 palette and an automatic 1px ink outline. Every object is shaded
with a three-tone material ramp (wood `y-o-r`, stone `x-s-d`, metal `x`+`c` glint,
bone `w-x-s`, foliage `g-G-t`, flesh `o-r-p`) lit from the top-left; tiered tools keep
one silhouette and change only material and fixing. See `docs/icon_pipeline.md`.

To look at the art:

```
node tools/preview.js sheet.png 8 6 all      # every icon, 8 columns, 6x scale
node tools/preview.js one.png 1 10 stone_axe # a single icon, big
```

## Terrain tiles

Eight hex terrains — meadow, grassland, steppes, stony, forest bed, pine forest
bed, stream, deep water — as 32x37 pointy-top hexagons, regular to within a pixel
(w/h 0.8649 vs 0.8660). The inset staircase is palindromic, which is what makes
the hexagons interlock: one hex covers 896px and the lattice cell is 32x28 = 896px,
so the plane is covered with no gaps or overlaps. Drawing folds across the border
under the lattice, so texture flows unbroken between tiles. Four variants per
terrain kill the repeat pattern. `tiles/tileset.json` carries the hex size and
lattice steps an engine needs to lay them out. See `docs/tile_pipeline.md`.

To look at the tiles (all three lay hexes on the real lattice and cycle variants
per hex, so what you judge is what the game draws):

```
node tools/tile_preview.js sheet.png        # all eight, patches side by side
node tools/tile_preview.js field.png meadow # one terrain over a field
node tools/tile_preview.js map.png --map    # mixed map, terrains meeting
node tools/tile_preview.js --verify         # prove the tiling is gapless
```
