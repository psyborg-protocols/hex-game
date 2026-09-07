# Skill Map & Dependency Graph

Five skills, 7 levels each. Arrows mean **requires**. Two roots (stone, wood), one knowledge gate (Mind → ore), one infrastructure cap (stoneworking masonry → heat), and social scale as the endgame.

```
                    ┌─────────────────────────────────────────────┐
                    │                  MIND                       │
                    │ 1 attention → 2 ritual → 3 story            │
                    │ 4 LORE (prospect!) → 5 medicine             │
                    │ 6 totem/shrine → 7 oracle                  │
                    │   ▲ sinew/bone      │ trust, trade, dogs    │
                    └──────┬──────────────┤                       │
                           │              ▼                       │
 ┌──────────────┐   ore   ┌──────────────┴──────────────┐   tongs/
 │ STONEWORKING │────────▶│        METALWORKING         │   hammer
 │ 1 hammer,    │  (L1    │ 1 prospect (needs mind 4)   │◀─ cycles
 │   chisel     │   gate) │ 2 bone tongs, bellows,      │  (tongs→
 │ 2 stone axe, │         │    SMELT (needs forge!)     │   tongs,
 │   rock wall  │  forge  │ 3 knife, saw (stone anvil)  │   hammer→
 │ 3 block,     │────────▶│ 4 axe, pickaxe, hoe         │   hammer,
 │   quern,     │  (L6)   │ 5 anvil, tongs, hammer      │   anvil)
 │   stone oven │         │ 6 ref. tongs, chisel, sword │
 │ 4 wall, adze,│  whet-  │ 7 adze (final tier), arrows │
 │   grindstone,│ stone   └──────────────┬──────────────┘
 │   anvil      │────────▶│              │ ingot
 │ 5 whetstone, │  (L5-7) │              │
 │   stone house│         │              ▼
 │ 6 FORGE      │   wood  ┌──────────────┴──────────────┐
 │ 7 quarry     │────────▶│        HOMESTEADING         │
 └──────┬───────┘  (fuel) │ 1 HEARTH, cook              │
        │ stone           │ 2 hoe, pot, field           │
        │ blocks          │ 3 stew, bread, smokehouse   │
        ▼                 │ 4 clay oven, granary, dog   │
   (all masonry:          │ 5 brick, market, well       │
    ovens, forge,         │ 6 plough(wood), kiln        │
    quarry, shrine)       │ 7 ingot plough, bakehouse   │
                          └──────▲──────────▲───────────┘
                                 │          │
 ┌───────────────────────────────┴──┐        │ log/beam/
 │          WOODWORKING             │        │ plank
 │ 1 branch, cord, basket          │        │
 │ 2 rough log, log, beam (chisel) │───────▶│
 │ 3 bone adze, bone saw, plank,   │        │
 │   arrows                        │  cabin │
 │ 4 fence, ladder, rod, chair     │───────▶│ (granary
 │ 5 cabin, table, boat (adze)     │  needs  │  needs
 │ 6 bridge, chest, cart (wheel)   │  house) │  house)
 │ 7 bow (beam + sinew)            │        │
 └──────────────────────────────────┘        │
        │ sinew/branch (hafts everything)────┘
```

## The bootstrap path (archaeologically canonical)

1. **Gather** branch, stone, berries (free, no tools)
2. **Stone 1** stone hammer + chisel → **Wood 2** (chop) → rough log → log
3. **Wood 1** cord + basket → **Homestead 1** HEARTH (stone+log) → cooked meat
4. **Stone 2** stone axe → **Wood 2–3** beam (whittle) → plank (bone saw)
5. **Homestead 2** pot + field → grain → **Stone 3** quern → **Homestead 3** bread
6. **Mind 1–3** amulet, drum, journal (trust) → **Mind 4 LORE** → *ore appears*
7. **Stone 3–6** stone oven → anvil → **FORGE**
8. **Metal 2** bellows + bone tongs + ore + fuel → **ingot** (the great unlock)
9. **Metal 3–5** knife, saw, axe, pickaxe, anvil, tongs (cycle), hammer (cycle)
10. **Homestead 4–7** smokehouse → granary (needs cabin!) → well → kiln → plough → bakehouse
11. **Wood 5–7** cabin → table → boat → bridge → cart → bow
12. **Mind 5–7** salve → totem → shrine → **oracle** (map, 2x prospecting)

## Redundancy pairs (scarcity counterweights)

| Problem | Route A | Route B |
|---|---|---|
| Beam | whittle (branch ×2, any sharp edge) | saw (log, bone/inot saw) |
| River | bridge (wood 6) | boat (wood 5) |
| Chop | stone axe / adze | ingot axe |
| Hammer | stone hammer (free-ish) | ingot hammer (cycle) |
| Tongs | bone (metal 2) | ingot (cycle) → refined (whetstone) |
| Adze | bone (wood 3) | stone (stone 4) → ingot (metal 7) |
| Anvil | stone (stone 4) | ingot (metal 5) |
| Food | hearth cook (L1) | smokehouse (keep) / stew / bread |
| Water | river (fishing) | well (farm + quenching) |
| Transport | on foot | cart (wood 6) |

## Cycles (by design, all real)

- **tongs → tongs**: bone tongs → ingot tongs (made with tongs) → refined tongs (made with ingot tongs + whetstone)
- **hammer → hammer**: ingot hammer requires any existing hammer
- **whetstone ↔ metal**: stone whetstone sharpens all metal; ingot chisel carves finer whetstones
- **kiln ↔ brick**: kilns are built of bricks fired in the ovens they supersede
- **adze ↔ boat**: the adze shapes the boat; the boat carries the stone and ore that made the adze

## The single knowledge gate

`metalworking:1` (prospecting) requires `mind:4` (Lore). Ore only exists in the world after Lore has revealed it, and each vein is finite. A world with no prospectable ore is a stone-age world: metalworking is fully locked. This is the "true scarcity" anchor of the whole economy.
