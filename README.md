# Hex World

A 2.5D hex survival/crafting game built on **real anthropological discovery
sequences**: true scarcity (worlds gate you), redundancy (multiple routes to
every gated achievement), non-linear progression (skills unlock gates in both
directions), and maximum interdependence between five skill domains.

Plain ES modules and canvas 2D. No build step, no dependencies.

```
node tools/serve.js          # then open http://localhost:8080
node tests/all.mjs           # 128 tests, ~2s
```

`http://localhost:8080/?seed=alpha` generates a named world;
`?load=1` restores the saved game; `?free=1` turns on free-resource mode for
testing; `/editor.html` is the map editor.

## Layout

```
index.html            the game
editor.html/.css/.js  the map editor

src/
  main.js             bootstrap, frame loop, and the wiring between world and UI
  core/
    camera.js         pan, integer zoom, follow, and the device-pixel rule
    rng.js            seeded noise and hashes (carried over from the old game)
  world/
    hexgrid.js        THE lattice — flat-top, odd-q. Everything imports this.
    tileset.js        terrain vocabulary and the autotile resolvers
    mapformat.js      one map format, read and written by game and editor
    worldgen.js       seeded worlds: elevation, mountains, river, woods, villages
    pathfinding.js    A* with the climb/drop rules, ladders and bridges
  render/
    renderer.js       1x buffer, one integer upscale, back-to-front draw order
    columns.js        stacks drawn as cliffs (see "Cliffs" below)
    decor.js          trees and props stood on tiles (see docs/decor.md)
    structures.js     placeholder art for buildings
  game/
    state.js  inventory.js  skills.js  crafting.js  economy.js
    harvests.js  context.js  actions.js  player.js  save.js
  ui/
    ui.js  panels/{inventory,crafting,build,skills,trade,menu}.js

data/                 the economy: 93 items, 85 recipes, 5 skills x 7 levels
new_tiles/            27 tile sheets + index.json (lattice + autotile tables)
decor/                40-sprite prop sheet + index.json (trees, rocks, crops)
icons/                93 item icons, 5 skill glyphs, 35 ability icons
tools/                the art pipeline, and serve.js
tests/                node test suites, no framework
docs/ research/       how the art was made, and the design research behind it
```

`skill_map.md` is the design spine — read it before changing the economy.

## How it works

**The lattice.** `src/world/hexgrid.js` is the single source of truth: flat-top
hexes in odd-q offset coordinates, `stepX 26`, `stepY 24`, odd columns pushed
down 12. Game and editor both import it, so they cannot drift.
`tests/hexgrid.test.mjs` proves the plane tiles with zero gaps and zero overlaps.

**Cliffs.** A tile frame is a flat-top hexagon in rows 16-39 extruded straight
down by its 8px wall — every tile already carries its own side section. So
`columns.js` just stacks whole frames, each lifted by exactly that wall height:
each copy covers the face of the one below and leaves only its side showing, so
an *h*-high column draws one surface over *h* bands of wall. On stone those bands
read as bedding planes, on grass as a cut earth bank. Nothing is synthesised, and
the game and the editor draw a column with the same function.

**Scale.** Everything is drawn at 1x into an offscreen buffer and upscaled once
by a whole number, with smoothing off. Fractional device pixel ratios are floored
for the same reason. `docs/new_tiles.md` is explicit that this art crawls at
fractional zoom.

**The economy.** `data/game_data.js` is the source of truth. Recipes carry
`tools` (a list of slots, each one item or an any-of) and `needs` (world gates:
`skill:x:n` or `built:item`). A tool slot naming something with a `build` recipe
means "stand at one", not "carry one". `checkRecipe` returns its reasons rather
than a boolean — with this many gates, a list that only says no is unplayable.

**Where things come from.** Ten raw materials are inputs to recipes and the
output of none, so the world supplies them. `src/game/harvests.js` binds every
harvest to terrain and is the one place that decides what a hex is worth walking
to. Harvests spend the world: woods fell to bare floor, cliffs mine down until
they can be climbed, veins run out.

**The knowledge gate.** Ore exists in the map from generation but is invisible
and unusable until Mind 4 (Lore) reveals it, a few hexes at a time, and each vein
is finite. A world with no prospectable ore is a stone-age world with
metalworking fully locked. That is the scarcity anchor, not a bug — and
`tests/economy.test.mjs` proves the stone age stays fully playable inside it.

**The river.** It divides the board and is meant to. The far bank waits on a
bridge (woodworking 6) or a boat (woodworking 5). The generator therefore puts
the spawn and every village on the near one.

**The mountains.** Base terrain gets its own low ceiling (`baseHeight`) and the
massifs get the rest, up to 20 levels — the split the old three.js generator used,
and the reason its worlds were rolling country with real mountains in them rather
than uniform noise nobody could cross. The two barriers that fall out of that are
not treated alike. Low ground cut off by a step or two is an accident of the
noise and gets a staircase; high ground ringed by a sheer face is left standing,
because those plateaus are ladder country (woodworking 4) and carving a way up
would throw away the reason to build one. Ramping therefore stops at
`rampCeiling`, and `tests/worldgen.test.mjs` holds both halves of that: nothing
low is ever walled off, and something high always is.

## Free-resource mode

A testing switch: `?free=1`, or the toggle under **Game → Testing**. It turns
off every *cost* — materials, tools, skill levels, `needs` gates, energy, gold,
rental fees — and not one *rule*. Harvests still only work on the terrain they
belong to, buildings still need legal ground, cliffs still have to be climbed,
the river still has to be crossed, and felling a wood still uses it up. XP is
still awarded, so you level up as you go.

It is one flag on the state, read through `isFree` in `src/game/state.js`, so it
saves and loads with the game and there is exactly one thing to grep for. The
HUD says `FREE RESOURCES` while it is on, because nothing is more confusing than
wondering why a recipe you have no materials for is green.

The one cost it keeps is a full pack: free mode would otherwise drop what you
just made without saying so.

## Placeholder art

The asset set covers terrain, paths, shorelines and crops. It has no characters
and no buildings, so the player and every structure are drawn procedurally in the
tile palette's idiom — dark outline, light from the top left. Swapping in real
sprites means replacing `drawPawn` in `src/game/player.js` and `drawStructure` in
`src/render/structures.js`, and nothing else.

Item icons use SWEETIE-16, which shares no colours with the tiles, so they appear
only on UI panels and never on the map.

## Tests

No framework — `tests/_harness.mjs` is thirty lines.

| suite | what it pins down |
|---|---|
| `hexgrid` | the lattice tiles the plane, neighbours are reciprocal at both parities, picking prefers the column in front |
| `autotile` | all 64 masks land on real art; path coverage matches what `docs/new_tiles.md` measured |
| `decor` | the prop index still describes the sheet, and the game only asks for sprites it has |
| `worldgen` | determinism, the low country is all walkable, the high ground stays gated, peaks reach 20 |
| `pathfinding` | climb 1 / drop 2, ladders, bridges, and every returned step is legal |
| `economy` | the graph is consistent, and the whole discovery path is walkable from an empty pack — by planning backwards, not by crafting greedily |
| `world` | harvesting, felling, mining, prospecting and building change the map correctly |
| `save` | a save restores the world you left, not the world the seed would generate |
| `freemode` | the testing switch lifts every cost and not one rule |

## The art pipeline

Unchanged, and still the way to regenerate the assets:

```
node tools/generate_icons.js          # validate + write icons/
node tools/generate_tiles.js          # validate + write tiles/
node tools/newtiles_index.js --json   # derive the autotile tables
node tools/newtiles_gen.js            # generate matching extra terrain
node tools/newtiles_map.js out.png mixed 4
node tools/decor_index.js --json      # derive the decor sprite boxes
node tools/to_json.js                 # rewrite data/game_data.json
```

See `docs/icon_pipeline.md`, `docs/tile_pipeline.md`, `docs/new_tiles.md` and
`docs/decor.md` — `new_tiles.md` is the reference for anything that touches how
tiles are drawn.

## Known gaps

- **Path junction art.** 12 of 15 four-connection pieces and all six
  five-connection ones do not exist. Roads are grown as a tree to avoid them;
  unsupported masks fall back to the nearest supported one, preferring to drop a
  connection rather than invent one.
- **Non-contiguous shorelines** have no art either, and get the same treatment.
- **No character or building sprites**, as above.
