# Icon Pipeline — Standard Workflow for Subagents

You are mastering ONE (or a few) pixel icons for this game. Your job is not to
"tweak" — it is to stare at the rendered image, judge it like a harsh art
director, and iterate until it is unmistakably the right object at 16×16.

Work in the repo root (the folder holding `tools/` and `icons/`).

## 1. The system

Icons are authored as **draw functions** on a 16×16 canvas — never as hand-counted
string grids.

- `tools/pcanvas.js` — class `P` (the canvas) and `draw(fn)`:
  - `px(x, y, c)` — single pixel
  - `rect(x, y, w, h, c)` — filled rectangle
  - `hline(x, y, len, c)` / `vline(x, y, len, c)`
  - `diag(x0, y0, x1, y1, c)` — staircase diagonal, 1px. It steps diagonally
    **first**, then runs straight, so the bend sits at the *start* point — draw
    from the bent end towards the straight end.
  - `circle(cx, cy, r, c)` — chunky pixel circle
  - `ellipse(cx, cy, rx, ry, c)` — filled ellipse; pass `c = null` to punch a
    hole (rope coils, pot mouths, wheel hubs)
  - `pyramid(cx, y0, y1, c)` — stepped pyramid (roofs)
  - `clear(x, y, w, h)` — erase back to empty
  - After your function runs, `draw()` **automatically adds a 1px ink ('k')
    outline** around the whole silhouette and returns the string grid.
    You never place the outline yourself.
    The outline is **8-directional** (diagonal-aware): diagonal/curved edges
    get a clean 45° ink band, not a stair-step sawtooth. Do NOT try to
    compensate by flattening shapes — use real diagonals (`diag`, `circle`,
    `ellipse`); the outline follows them smoothly.
- Icon files: `tools/pixel_art_1.js` (gathering/food), `tools/pixel_art_2.js`
  (wood/stone/ovens), `tools/pixel_art_3.js` (metal/mind + 5 skill glyphs).
  Each exports `{ name: (p) => { ... } }`.
- `tools/generate_icons.js` — validates all grids and writes every SVG.
- `tools/preview.js` — renders icons to a PNG contact sheet so you can look at them.

### Palette (SWEETIE-16, single chars)
| char | color | use |
|---|---|---|
| k | #1a1c2c ink | outline (automatic — you don't place it) |
| p | #5d275d purple | darkest red/berry/leather shadow |
| r | #b13e53 red | wood shadow, meat, leather, roof tile |
| o | #ef7d57 orange | **wood**, clay, flame, flesh |
| y | #ffcd75 yellow | wood highlight, grain, fire core, brass |
| g / G / t | light green / green / teal | foliage highlight / base / shadow |
| b / B | blue / sky | water and glass base / light |
| c | #73eff7 cyan | **metal edge glint**, water highlight |
| w | white | bone, cloth, specular highlight |
| x | #94b0c2 grey | **stone and metal bodies** |
| s | #566c86 slate | stone/metal shadow |
| d | #333c57 dark | holes, deep shadow, interior |
| n | #29366f navy | mystic accents, night water |

### Material ramps (light → mid → dark)
Every object is shaded with a **three-tone ramp**, not a single highlight pixel.
Light always falls from the **top-left**; the shadow tone goes on the bottom-right
edge and under overhangs.

| material | light | mid | dark |
|---|---|---|---|
| wood / clay | `y` | `o` | `r` |
| stone | `x` | `s` | `d` |
| metal | `c` (edges) / `w` (specular) | `x` | `s` |
| bone / cloth | `w` | `x` | `s` |
| foliage | `g` | `G` | `t` |
| flesh / meat | `o` | `r` | `p` |
| water / glass | `c` | `B` | `b` |
| fire | `y` | `o` | `r` |

Rules: `'.'` = empty. Reserve `w` for genuine specular hits (1–3 px) — on stone
and metal the *light* tone is `x`, not `w`. Metal is distinguished from stone by
a `c` glint along its working edge; that is what carries a tool's tier.

### Tier rule
A tiered tool keeps **the same silhouette** across tiers and changes only the
material and the fixing: stone (`x` body, `w` ground edge, cord lashing in `y`)
< bone (`w` body, `x` shading) < metal (`x` body, `c` edge, forged socket/ferrule).
Render the family side by side and confirm each step reads as "same tool, better
material".

## 2. The verify loop (use exactly this)

Validate everything:

```
node tools/generate_icons.js
```
Must print `OK: 98 base icons (items+skills), 35 ability icons written to icons/`
and exit 0. Any validation error = stop and fix.

### Render icons and LOOK at them (your main tool)

```
node tools/preview.js out.png <cols> <scale> <name> [name ...]
node tools/preview.js out.png 8 6 all
```
`scale` 8–10 is big enough to judge a single icon; `6` suits a full sheet.
Then **read** the PNG (the read tool displays it). You MUST actually look at the
image every iteration. Do not guess. Write PNGs to a scratch directory, not the repo.

The tool has no dependencies (it writes the PNG itself), so it works anywhere
Node runs — no Inkscape, no image libraries.

## 3. The quality bar (viral indie pixel art)

Judge each render against ALL of these, in this order:

1. **Silhouette test** — squint: does the black outline alone say what it is?
   One clear focal shape, no floating fragments, no 1px gaps inside an object.
2. **Recognizability** — could a 10-year-old name it in 2 seconds? If not, the
   shape is wrong, not the colors.
3. **Anatomy of the tool** — a tool must show its working parts: an axe has a
   BLADE (flared, with a keen edge), a haft, and the fixing between them
   (lashing on stone tiers, a forged socket on metal ones). A hammer head is
   perpendicular to the handle. An adze's blade sits ACROSS the haft. A chisel
   has a flat cutting face.
4. **Form, not flatness** — three tones per material, light from the top-left.
   A shape filled with one flat color reads as a sticker, not an object.
5. **Tier contrast** — render tiered families side by side; each step must show
   a visible upgrade.
6. **Centering & weight** — margin on all sides; visual mass consistent with the
   family. Your *content* may reach rows/cols 1–14; the auto-outline uses the
   0 and 15 border, so nothing you draw should sit there.

## 4. Craft notes (learned the hard way)

- **Overlapping shapes fuse.** The auto-outline wraps the union, so two circles
  touching become one blob. Either keep a **1px empty channel** between separate
  parts (the ink fills it and gives you a free divider line), or fuse them
  deliberately and separate the lobes with an interior **dark tone** — that reads
  as one cluster rather than two objects.
- **Symmetry kills readability.** Two identical shapes side by side read as a
  face, a pair of trousers, or antennae. Offset them, vary their lengths, or put
  one behind the other.
- **Decorations need two pixels.** A lone pixel (a spark, a star, a steam mark)
  gets its own ink ring and reads as dirt. Make it a 2px dash or a small cluster.
- **Diagonals are 1px staircases** (`diag`). They look right; don't "thicken"
  them with parallel lines.
- **Stems/handles must connect**: every part of an object must touch its
  neighbour (8-directionally), or the ink will draw a divider where you wanted unity.
- **Skill glyphs must finish by row 12.** The ability icons blank rows 14–15 to
  draw the level pips; if your glyph's ink outline lands on row 14 it gets
  chopped and the shape reads as cut off.
- Don't add new helpers to pcanvas.js unless truly needed; the existing set
  covers everything.
- Only edit the icon file(s) for your batch. Never touch game data or other batches.

## 5. Definition of done

For each icon you own:
1. `node tools/generate_icons.js` → OK, exit 0.
2. Rendered at scale 8+, **you have looked at it**, and it passes the quality bar.
3. If it has a tier family, the family sheet shows clean progression.
4. Report: per icon — what was wrong (from the render), what you changed, and
   the final silhouette in one sentence.
