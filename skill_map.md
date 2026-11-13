# Skill Map & Progression — Hex Quest

Five skills, five levels each, 56 items. Every level opens something; every item
has a job. `data/game_data.js` is the source of truth and
`tests/economy.test.mjs` checks the laws below.

## The five chapters

The game is paced by five chapters, shown in the corner with their goals. They
are milestones, not quests: nobody asks you for them, they are just where the
gates naturally fall.

| # | Chapter | Goals | What it unlocks |
|---|---|---|---|
| 1 | **Stranded** | explore 5 places · twist cord · stone axe · hearth | food you can cook, a respawn point |
| 2 | **Homestead** | cook a meal · earn a village's trust · sow a field · raise a hut | trade, stations, grain, a stash, +6 energy |
| 3 | **Hold the Line** | fight off a raid · wall or watchtower · arm yourself · cross the river | the far bank, where the camps are |
| 4 | **The Iron Age** | Lore (Mind 3) · find ore · smelt an ingot · forge iron | swords, mail, pickaxes |
| 5 | **The Reckoning** | burn a camp · kill the Warlord · burn every camp | victory |

The first raid comes on the last night of the first moon whatever chapter you
are in, so chapter 3 tends to arrive on its own.

## The skills

```
STONEWORKING            WOODWORKING             HOMESTEADING
1 knife, axe, hammer    1 cord, basket, rod     1 HEARTH, cook
2 dress blocks          2 planks, palisade,     2 field, bread, pot
3 stone wall, FORGE       WORKBENCH             3 HUT, stew, hide armour
4 whetstone, SHRINE*    3 ladder, bow, shield   4 leather pack, dog*
5 master masonry        4 BOAT, watchtower      5 trail rations
                        5 BRIDGE, cart*

METALWORKING            MIND (from exploring, not crafting)
1 wood tongs, SMELT     1 herbs, amulet
2 iron axe, pickaxe     2 salve, dogs trust you
3 IRON TONGS, saw       3 LORE: ore shows, prospecting
4 sword, iron mail      4 wayfinding: villages reveal 2x
5 master smith          5 rally banner
```
`*` crosses skills: the shrine needs Mind 3, the dog Mind 2, the cart an ingot.

## The bootstrap

1. **Explore** — stand still on hexes; berries, flint, clay and fish show up.
2. **Reeds → cord**, **stone + branch + cord → axe and hammer**, flint → knife.
3. **Fell trees → logs**, **stone + logs → hearth**. Hunt with a cord snare, cook.
4. **Visit a village**, do its favour, and it trades and lends its station.
5. **Planks → workbench → bow, shield, boat**. **Hut** for the stash and energy.
6. **Explore for Mind 3** (Lore) → read the rock → ore. Or buy it from smiths.
7. **Blocks + clay + logs → forge**. **Tongs → smelt → iron tongs** (tongs make tongs).
8. **Sword, mail**, a **rally banner**, a **boat or bridge** — and across the river.

## Laws, and where they are checked

| Law | Example | Test |
|---|---|---|
| Significance | every item is an input, tool, station or has an effect | `significance: every item…` |
| Minimal archetypes | ≤ 60 items; one "ore", one "ingot", no tiers of chisel | `the item list stays small` |
| Redundancy | cord from reeds or hide · planks by axe or saw · river by boat or bridge · ore by hammer or pickaxe · ore from Lore or smiths | `redundancy: …` |
| Circularity | iron tongs are made with tongs; green-wood tongs break the cycle | `circularity: …` |
| Reachability | the whole graph climbs from an empty pack | `the whole graph is reachable…` |
| Scarcity | finite veins; five villages, six kinds — some worlds have no smiths | worldgen, raids |
| Food is never "used" | the pack tops your energy up; raw food is saved for the hearth | `food is eaten on its own…` |

## The moon, and the raids

Time runs in **moons** of three seven-minute days (`state.js: moonOf`). Each
part of a moon belongs to one way of playing:

| Part | When | What it is for |
|---|---|---|
| **Fair days** | days 1 and 2, and the third morning | exploring, homesteading. No raid ever sets out. |
| **Omens** | the third afternoon | getting ready: the camp, the numbers and the route are shown |
| **Raid night** | the third night | defence, until dawn |

- Three camps on the far bank; the farthest is the **Warlord's Hold**.
- One raid a moon, from a random camp. The omens draw its route on the map; a
  **watchtower** brings them at first light instead of after noon.
- Raiders raft the river only at the **crossings** the map marks (about three a
  world), and walk over any **bridge** you build. That is where a defence goes.
- Waves set out at dusk, 25 seconds apart. At dawn whoever is left goes home.
- Bands grow: 2 raiders in one wave on the first moon, two more each moon up to
  16 in three waves, with a brute for every second moon. Each camp you burn
  takes a quarter off.
- They go for what you built (hut and fields first), never anything within 2 hexes
  of a shrine. With nothing to burn, they raid a village and shut its market
  for a day.
- **Walls** are hacked through or walked round. **Watchtowers** shoot (2 dice, range 3).
- **Combat** is dice: attack dice hit on 4+, defence dice block on 5+.
- Burning every camp wins the game.
