# From beta to production: the plan

Stages 0 and 1 are built; the rest is still a proposal. It covers the one big design change the game needs —
how exploring, homesteading and defence share the clock — and the production work
around it. `skill_map.md` stays the design spine; this would rewrite its "Raids"
section and add to the rest.

## What is wrong now

Read off the code, not guessed:

1. **One clock runs everything, and it never rests.** A day is 180 seconds. The
   first raid sets out 4m39s in, and another follows every 4 to 5½ minutes for the
   rest of the game, wherever you are and whatever you are doing
   (`raiders.js: FIRST_RAID_AT`, `tickSchedule`). There is no stretch of the game
   in which nothing is coming, so there is nowhere for a calm game to live, and
   walking far from home to explore is punished by losing the hut.
2. **Homesteading is clicks in a menu.** A field is one click, a 108 second wait,
   and one click. Cooking is a button. Food is a fuel number: stew differs from
   berries only in how much energy fits in a slot. The three crop sheets in the
   art (cabbage, pumpkin, tomato) are picked at random and all yield grain.
3. **Exploring pays in Mind xp and nothing else.** A gold-tier find gives 15 xp.
   Nothing comes home from it.
4. **Defence has no shape.** Raiders raft across any water and walk at one
   structure picked by score, so there is no approach to hold. The tools are a
   wall, a tower and a shrine; your own fighting is an automatic swing. A band is
   six at most. It is a nuisance on a timer, not a siege.
5. **The three compete for the same seconds instead of feeding each other.**

## The proposal: three tempos, one moon

Time runs in **moons**. A moon is three days, and the HUD shows where you are in
it. Each part of it belongs to one way of playing:

| Part of the moon | Length | What it is for | The promise |
|---|---|---|---|
| **Fair days** | 2 days and the third morning | exploring, homesteading | No raid sets out. Ever. |
| **Omens** | the third afternoon | getting ready | The route and the size of the band are shown on the map. |
| **Raid night** | the third night | defence | Waves come down that route until dawn, then it is over. |

A day becomes about 7 minutes, so a moon is about 21: roughly 17 calm minutes and
a hard 3 to 4. The first moon's raid is two raiders, so the first night teaches
rather than kills.

Why a fixed clock rather than "start the night when you are ready": a world shared
by several players needs one clock nobody controls, and a calm game is only calm
if the quiet is a promise rather than a hope.

### Exploring: bring something home

- **Finds.** Scenic places give things as well as xp: wild seed (the only source
  of the better crops), a sketch (a recipe you cannot learn any other way: a
  dish, a trap), and at gold tier a **vantage** that reveals a wide circle of
  country and shows the next raid's route a day early.
- **Scouting.** Getting close to a camp unseen tells you what the next band is
  made of. Burning a supply cache on the far bank makes the next one smaller.
- Fair days are what make long trips possible: nothing happens to the homestead
  while you are away.

### Homesteading: slow on purpose, and it matters

The calm game is paced by the world, not by how fast you click. Nothing in it can
be hurried, and being there is what improves it.

- **A meal is a choice about tomorrow.** Sitting down to a cooked dish at a
  hearth gives one named effect until the next evening: more health (roast), work
  that costs less (bread), healing anywhere and a defence die at night (stew),
  faster exploring and a wider eye (fish stew). One at a time. What to cook is
  what you mean to do next.
- **Crops are different from each other, and want tending.** Grain, cabbage,
  pumpkin and tomato grow at different speeds and go into different dishes. A
  field looked after once a day gives a fine harvest instead of a plain one.
- **Villages prosper on what you bring them.** Each asks for different goods each
  moon. Deliveries raise its prosperity: first trade, then its station and a
  fighter sent to your wall on raid nights, then rare stock and a palisade of its
  own. A village that is raided slips back.
- **The wall runs on the kitchen.** Towers shoot arrows made in the fair days.
  Militia fight for whoever fed them.

### Defence: a real siege, briefly

- **Lanes.** Raiders cross the river only at their raft crossings (about three
  a world) and at your own bridges, and the omen shows which. Where to build is
  a decision. *(Built.)*
- **More to build:** spike traps, a gate you pass and they do not, a beacon that
  lengthens a tower's reach at night.
- **More to face:** torchers that run for the fields, shield-bearers that arrows
  cannot hurt from the front, brutes for the walls. Three waves a night.
- **Spoils.** A night held pays in iron and trophies, which is what the push
  across the river is built from.

### How it becomes multiplayer

Each tempo's output is another's input, so the three are roles as soon as there
are three players:

```
   EXPLORE ── seed, sketches, ore, the raid's route ──▶ HOME
      ▲                                                  │
      │                                    meals, arrows, militia,
 boat, bridge, iron                        prosperous villages
      │                                                  ▼
      └──────────── spoils, a safe valley ◀────────── DEFEND
```

The homesteader is not a slower fighter. They are the supply line: the scout's
reach and the wall's strength are both set by what was grown and cooked, and
neither can be had faster by anyone. On raid night their place is the hearth,
which heals and feeds the wall, not the gate.

Alone, you move through all three every moon.

## Order of work

| # | Stage | What changes | Size |
|---|---|---|---|
| 0 | **Fixes** (done) | bridges, ladders, hidden-hex clicks, exploring ring, UI layout | — |
| 1 | **The Moon** (done) | longer day, the moon clock and dial, fair days, omens with a drawn route, raft crossings, raid nights in waves | — |
| 2 | **The Hearth** | meals with effects, four real crops and tending, village prosperity and wants | large |
| 3 | **The Wall** | traps, gate, beacon, arrows, new raiders, fed militia | medium |
| 4 | **The Wilds** | finds, sketches, vantages, scouting and caches | medium |
| 5 | **Production** | see below | medium |
| 6 | **Multiplayer groundwork** | see below | medium |

Stage 1 comes first because it is what the other three stand on, and it changes
how the game feels more than anything else here.

### Production

- A title screen, settings (sound, text size, colour-blind tier colours), and
  more than one save, with a version on each and a migration path.
- Sound: there are seven chimes and nothing else. Footsteps, work, weather, night.
- The first ten minutes: the opening is a wall of text; make it the first chapter.
- Touch: the layout now fits a phone, the controls do not (no pinch, no long-press).
- Character and building art are still drawn in code (`player.js`,
  `structures.js`).
- **A balance bot.** A headless player that runs whole games across seeds and
  reports minutes to each chapter, deaths, and how each raid night went. Tuning
  three tempos by hand, one playthrough at a time, will not converge.

### Multiplayer groundwork

Cheap now, expensive later:

- `state` mixes the player (pack, skills, health) with the world (buildings,
  units, the raid clock). Split them.
- The simulation calls `Math.random` and `performance.now`. Raids, dice and
  spoils have to run off a seeded generator carried in the state.
- A fixed simulation tick, separate from drawing.

## What needs deciding

1. **The clock.** A fixed moon (recommended) or nights the player calls.
2. **Length.** This aims at a whole game of about three hours, eight or nine
   moons. Shorter means fewer moons, not shorter days.
3. **Scope of stage 2.** It is the biggest addition of new rules. It can be cut to
   meals-with-effects and village prosperity alone, leaving crops as they are.
