# Writing review 1: the opening and Stranded

Everything a player reads from the first screen until the campfire burns again: the opening,
the first thoughts, exploring, gathering, the first tools, the craft and build screens, and
the details you get by pointing at things.

**How to mark it up.** Reply by number: `1.4 ok`, `1.7 → "your line"`, or `1.9 drop`.
You can also edit the **Proposed** column here and tell me. **✋** marks a call I'd rather
you make. **done** marks lines I changed in the last pass, for you to confirm or overrule.

The rules we're working to:
- No numbers, levels or menu names in speech, narration or thoughts.
- Exact figures only where you ask for them: pointing at something, the pack and the craft
  screens.
- Original and right for the setting, nothing colloquial, "nightfall" not "dusk".

---

## Status after your first pass (applied, not yet pushed)

**Decisions**
- **A** done. The game opens on "Across the River": a friendly premise ending "Be careful of
  barbarians!", the three lines, and Begin. How to play stays under Game.
- **B** done. Chapters get a title card. Level-ups get a plain line ("You have grown more skilled
  with wood.", "Your mind has grown clearer."). Achievements float their name over you. Goals stay
  silent. The Stranded blurb was "You have a handful of berries and the clothes you stand in.",
  which the opening now says, so it is "A cold campfire, and the whole day ahead of you." ✋ for
  you to check.
- **C** done. On the map: "You don't know how to do that yet.", "You'd need an axe for that."
  A spent hex says it plainly ("The bush has been picked clean.") and, tried again, that it
  comes back ("Picked clean. It will grow back eventually...").

**Lines**
- 1.1 title → Across the River (page title, opening, join screen). 1.2 rewritten; 1.3 as proposed.
- 2.1, 2.2, 2.3 your lines. First branch with no flint: "If only I had some flint to light this,
  I could start a fire..." (and the flint version), until a fire has been lit.
- 2.4 fires after five explored hexes if you have seen nothing from high ground yet, then again at
  ten and twenty, each a little different. 2.6 kept the original.
- 3.1 said as what you see ("There's a berry bush here. There's flint on the ground here."), and
  no hex holds more than two hidden things.
- 3.3, 3.4 kept the originals. Sitting gives back a little energy, the first time each day.
- 3.5 meditation now ends on one of about seventy sayings from Avot, Kohelet and Mishlei, each
  with its source (src/game/sayings.js). They cycle before any repeats.
- 3.7 the skills screen counts places as quiet / serene / sublime.
- 4.2 tall grass → Forage. 4.4 Light Campfire. 4.5 Mine. 4.6 Prospect. 4.8–4.10, 4.12, 4.13,
  4.15, 4.16 as proposed. 4.14 as above (C). 4.18, 4.20 originals. 4.19 "Ouch! A bee stung you!"
- Fire: the lit campfire burns a day, then goes back to cold ashes ("The campfire has burned down
  to ashes."). A hearth costs five logs and burns five days; click it to add wood (a day a log, up
  to ten days); a cold one needs five logs to catch again.
- 5.1 removed: you are always walked to the fire first, so it never showed. 5.2, 5.3 your lines.
- 6.4, 6.5 the craft screen lists what is missing as "Woodworking 2", "1 Branch", in red.
  6.6 as proposed. 6.8 now "Ashford's workbench is yours to use." / "Ashford keeps its workshop
  for those it trusts." (for the village rework). 6.9 removed.
- 7.x items speak in the Wanderer's voice, one nearest use, and change as you learn (branch,
  flint, reed, cord). Your lines for 7.4, 7.5, 7.7, 7.15, 7.16; the rest follow the pattern.
- 8 the top-left corner is drawn: a sun (or moon) with twelve beads for the turns, pale blue to
  gold by day, dark to moonlight by night; heart and energy icons on the bars; three beads for the
  moon's days, the last red on a raid night. Pointing at it shows icons with numbers.
- 2.8–2.20, the first-pickup thoughts, now follow the same pattern: one nearest use each. Items
  with a Wanderer line think that line ("Wood. I could do anything with this!"). The rest have
  their own, e.g. stone "Good heavy rocks. I could probably make an axe with one of these..."
- Not answered, left as they were: 2.5, 2.7, 3.2, 4.17, 5.4–5.6, 6.1, 6.2.

**For later**
- The hearth's look: a small sloped stone oven, not a fire pit.
- The recipes: less obtuse, when they are redone.
- 6.8 the village screens, and 6.10 the skill and craft tree.

---

## Decide these first ✋

These shape everything below.

**A. The opening.** The first screen is a 15-section rules page ("How to play"), before
the player has clicked anything. Your memory note says the world should lead the player, not
text. I propose:
- The first screen shows only the premise and three short lines: walk, look, use.
- The full How to play moves to the Game menu, as a reference.
- The cold campfire, and the thoughts that follow, carry the first minutes.

**B. Chapters, goals, level-ups and achievements are invisible.**
- Since the top-right corner was cleared, the chapter name ("Stranded"), its line ("You have a
  handful of berries and the clothes you stand in."), its four goals, every level-up and every
  Mind achievement ("A Curious Eye", "Breathtaking"…) only play a sound. No text appears.
- I propose:
  - A short title card when a chapter begins: name and one line.
  - A brief line on a level-up, e.g. "Your hands are surer with wood now."
  - Achievements named as they happen.
  - Goals stay unseen, as quiet milestones.

  Or keep all of it silent.

**C. Requirement messages.** When something can't be done, the message is mechanical: "Needs
homesteading level 2.", "Needs stone axe or iron axe.", "Picked clean — back in 5 turns.",
"Needs 0.5 energy — carry some food." I propose:
- **Gathering** (on the map) speaks plainly, without numbers: "You don't know how to do
  that yet.", "You'd need an axe.", "Picked clean. It will grow back."
- **The craft screen** is the reference, so it keeps exact requirements: "Needs Woodworking 2
  (you have 1)".

---

## 1. The first screen

| # | Where | Now | Proposed |
|---|---|---|---|
| 1.1 | Opening, title | Hex Quest | (the game's name, your call ✋) |
| 1.2 | Opening, lede | Raiders hold the far bank of the river. You hold a handful of berries. Build a life on this side, then cross over and burn their camps. | Raiders hold the far bank of the river. You have a handful of berries and the clothes you stand in. Make a life on this side; then cross over, and burn their camps. |
| 1.3 | Opening, the three lines (if A) | — | Click the land to walk. Stand still a while to look around you. Click what you find to use it. |
| 1.4 | Opening, button | Begin | Begin |

How to play stays as the reference under the Game menu. Its sections are reviewed in the last
chapter, with the other screens.

## 2. The first minutes: thoughts

The Wanderer's own voice: first person, brief, noticing.

| # | When | Now | Proposed |
|---|---|---|---|
| 2.1 | Standing by the cold campfire | The campfire here is cold. A dry branch and a piece of flint would bring it back to life. | done |
| 2.2 | Holding a branch and flint | A branch and a piece of flint. The cold campfire could burn again. | done |
| 2.3 | On a rise | From up here I can see over the edge. From a real peak I could see half the valley. | done |
| 2.4 | Low ground, first time | If I could get higher, I could see all around. | done |
| 2.5 | A scenic place, first time | A beautiful place. I could sit here a while and let my thoughts settle. (Click yourself to sit.) | done, but ✋ keep the "(Click yourself to sit.)" hint? It's the only in-game clue that meditating exists. |
| 2.6 | A scenic place, later | This looks like a beautiful place to sit down. | A place worth stopping for. |
| 2.7 | Pack nearly full | My pack is nearly full. A basket of woven reeds and branches would carry more. | done |

**First time holding an item**

| # | Item | Now | Proposed |
|---|---|---|---|
| 2.8 | Branch | A dry branch. Struck with flint, it could wake the cold campfire. Bound to a stone, it could be an axe. | done |
| 2.9 | Stone | Good heavy stones. Lashed to a branch with cord, one would make an axe, or a hammer. | done |
| 2.10 | Reed | Reeds, long and supple. Twisted, they make cord; woven, a basket. | done |
| 2.11 | Cord | Cord. A stone can be bound to a handle now, or a snare set where the rabbits run. | done |
| 2.12 | Berries | Wild berries. Enough to keep me on my feet a while, and the villages are glad of them. | done |
| 2.13 | Flint | Flint, sharp as glass. Against a dry branch it throws sparks; knapped, it makes a knife. | done |
| 2.14 | Log | A log, heavy and green. Ringed with stones, it would make a hearth. With a knife, it could be split into planks. | done |
| 2.15 | Stone axe | An axe at last. The trees are mine to fell, though planks will want a knife as well. | done |
| 2.16 | Flint knife | A keen flint edge. Logs can be whittled into planks, and game skinned for its hide. | done |
| 2.17 | Stone hammer | A hammer. Stone can be dressed into blocks now, and the cliff faces quarried. | done |
| 2.18 | Raw meat | Raw meat. It will do in a pinch, but cooked over a fire it would go much further. | done |
| 2.19 | Fish | A fresh fish. Better cooked than raw, if I can find a fire. | done |
| 2.20 | Clay | River clay. Fired in a hearth it makes a pot, for stew and salve. A forge would want it too. | done |

## 3. Exploring and sitting

| # | When | Now | Proposed |
|---|---|---|---|
| 3.1 | Exploring turns something up (floats over you) | found berries, flint | You spot berries and flint. |
| 3.2 | Ore nearby | Ore glints in the rock near here. | Ore glints in the rock nearby. |
| 3.3 | Sitting to meditate | You sit down and quiet your thoughts... | You sit, and let your thoughts settle. |
| 3.4 | Sitting where you already have | You sit awhile and take in the view. | You sit a while and take in the view. |
| 3.5 | Meditation done | Your mind clears, and the land feels sharper. | (keep) |
| 3.6 | Meditation done (floats) | +7 Mind | +7 Mind ✋ a number at the moment of gain. Fine by the rules, but you may prefer just "Mind". |
| 3.7 | Place kinds (the skills screen) | Common · Quiet · Serene · Sublime, counted as copper/silver/gold | (keep the names) ✋ the counts show as "copper / silver / gold": keep, or use the names? |

## 4. Gathering

**Labels on the action bar.** They're short, like verbs on a button, so the tone is fine. A few
are worth tightening:

| # | Now | Proposed |
|---|---|---|
| 4.1 | Forage | (keep) |
| 4.2 | Gather Tall Grass | Gather Wild Grain |
| 4.3 | Pick Herbs · Gather Branches · Fell a Tree · Cut Reeds · Dig Clay · Gather Stone · Pick Flint · Hunt · Fish | (keep) |
| 4.4 | Relight Campfire | (keep) |
| 4.5 | Mine the Face | Quarry the Cliff |
| 4.6 | Read the Rock | (keep) |

**Results and refusals.**

| # | When | Now | Proposed |
|---|---|---|---|
| 4.7 | A haul (floats) | + 2 Berries | (keep) |
| 4.8 | Nothing to gather | Not here. | There is nothing to gather here. |
| 4.9 | Out of energy | Too tired. Carry some food. | Too tired to work. You need something to eat. |
| 4.10 | Hunting with no snare | You need cord for a snare. | You need cord to set a snare. |
| 4.11 | Pack full | Your pack is full. | (keep) |
| 4.12 | Missing skill (see C) | Needs homesteading level 2. | You don't know how to do that yet. ✋ |
| 4.13 | Missing tool (see C) | Needs stone axe or iron axe. | You'd need an axe for that. ✋ (written per tool: an axe, a hammer, a knife, a rod…) |
| 4.14 | Already taken (see C) | Picked clean — back in 5 turns. | Picked clean. It will grow back. ✋ |
| 4.15 | (the same, other kinds) | Stripped of seed · The game has fled · The fish have gone quiet · Nothing left lying here · Cut to the stubble · Dug out · Picked over | (keep the phrases, drop the countdown) |
| 4.16 | Shaking a tree, no axe | A branch shakes loose — you need an axe to fell the tree. | A branch shakes loose. To bring the tree down, you'd need an axe. |
| 4.17 | Shaking it again | Nothing else shakes loose. You need an axe to fell the tree. | Nothing more shakes loose. Only an axe would bring this tree down. |
| 4.18 | A cliff, no tool | If I had the right tool, I might be able to mine that... | With the right tool, I could cut into that rock. |
| 4.19 | Stung while foraging | A bee stings you and drifts off over the meadow. | done |
| 4.20 | Starving while walking | You are starving. | You are faint with hunger. |

## 5. The campfire, and the first hearth

| # | When | Now | Proposed |
|---|---|---|---|
| 5.1 | Not beside it | Stand by the campfire to relight it. | (keep) |
| 5.2 | Missing both | Needs a branch and a piece of flint to relight the campfire. | You need a dry branch and a piece of flint. |
| 5.3 | Missing one | Needs a dry branch to catch the spark. / Needs a piece of flint to strike a spark. | You need a dry branch to catch the spark. / You need flint to strike a spark. |
| 5.4 | It catches (narration) | Sparks catch in the dry kindling, and the campfire comes back to life. | done |
| 5.5 | It catches (floats) | + Campfire lit | (keep) |
| 5.6 | Building anything | You built a Hearth. | You build a hearth. ✋ present tense, like the rest of the narration |

## 6. The Craft and Build screens

The reference screens, so exact requirements stay here (see C). Only the prose changes.

| # | Where | Now | Proposed |
|---|---|---|---|
| 6.1 | Craft, nothing ready | Nothing you can make right now. Look under a skill to see what each recipe is waiting on. | Nothing you can make just now. Each skill's list shows what a recipe is waiting on. |
| 6.2 | Craft, empty skill | Gather from the land to discover what can be made. | What you gather will show you what can be made. |
| 6.3 | A recipe with no inputs | nothing but effort | (keep) |
| 6.4 | Missing skill | Needs woodworking level 2 (you are 1). | Needs Woodworking 2 (you have 1). |
| 6.5 | Missing goods | Needs 1 more Branch. | Needs 1 more Branch. (keep) |
| 6.6 | Too tired | Needs 0.5 energy — carry some food. | Too tired. Eat something first. |
| 6.7 | Pack full | No room to carry it. | (keep) |
| 6.8 | At a village | At Ashford. You may work at their Workbench. / Earn their trust and you may use their workshop. | (keep) |
| 6.9 | Build, intro | Built on your hex or the one beside it, on level ground. A ladder leans on the cliff beside you; a bridge starts at the water's edge. Raiders go for what you build, so think about where. | Build on level ground, here or beside you. A ladder leans on the cliff beside you; a bridge starts at the water's edge. Raiders come for what you build, so choose the place with care. |
| 6.10 | Build, nothing yet | Gather stone, wood, or grain to discover what you can build. | Stone, wood and grain will show you what you can build. |

## 7. Items you meet first (pointing at them)

✋ **Direction for all item descriptions:** one line of what it *is*, then what it's *for*.
The detail panel already shows the numbers (+4 slots, +2 hexes per turn), so a description
needn't repeat them.

| # | Item | Now | Proposed |
|---|---|---|---|
| 7.1 | Berries | A handful of food. Found by foraging explored meadows and woods. | Sweet, and filling enough. Found by foraging meadows and woods you have explored. |
| 7.2 | Branch | Hafts every early tool, or sparks your cold campfire back to life with flint. Gathered from woods and meadows. | Dry and straight. Every early tool wants one for a handle, and with flint it will light a fire. |
| 7.3 | Reed | Cut by low water. Twisted into cord, woven into baskets and thatch. | Grows where the shore is low. Twisted into cord, or woven into baskets and thatch. |
| 7.4 | Stone | Picked up below any rise, or mined out of a cliff face. | Lies at the foot of any rise, or can be quarried from a cliff. |
| 7.5 | Flint | A sharp edge. Strike against a branch to relight your campfire, or knap into knives, amulets and whetstones. | Holds an edge like nothing else. Strikes sparks from a branch; knapped, it makes knives, amulets and whetstones. |
| 7.6 | Cord | Binds heads to hafts. Also sets a snare (used up when hunting without a bow). | Binds a head to its handle. Also sets a snare, which is lost when you hunt without a bow. |
| 7.7 | Log | Felled with an axe. Fuel, framing, and planks. | (keep) |
| 7.8 | Clay | Dug at low banks. Pots, salve, and the forge lining. | Dug from low banks. Pots, salve, and the lining of a forge. |
| 7.9 | Raw meat | From hunting. Cook it at a hearth for far more energy. | From the hunt. Cooked at a hearth, it goes much further. |
| 7.10 | Fish | Caught with a rod by the water. Cook it at a hearth. | Caught with a rod where the fish are known to be. Better cooked. |
| 7.11 | Flint knife | Whittles logs into planks for ladders, skins game for hide, and cuts hide into cord. | (keep) |
| 7.12 | Stone axe | Fells trees for logs and splits logs into planks. | (keep) |
| 7.13 | Stone hammer | Dresses stone into blocks, quarries cliff faces and (slowly) ore. | Dresses stone into blocks, and quarries cliff faces. Slowly, it will break ore. |
| 7.14 | Basket | +4 pack slots while worn. | Woven reeds, worn on the back. Carries more. |
| 7.15 | Walking stick | A simple wooden walking stick. +2 hexes per turn while held. | A good stick lengthens the stride. |
| 7.16 | Fishing rod | Fish from any bank where fish are known to be. | (keep) |
| 7.17 | Hearth | Cook, bake and fire pots here. Rest beside it to heal. Your respawn point. | Cook, bake and fire pots here. Rest beside it to heal, and wake beside it if you fall. |
| 7.18 | Cooked meal | Twice the energy of the raw meat it came from. | Hot food: twice as filling as the raw meat it came from. |

## 8. The corner details (pointing at the HUD)

This is the "exact figures on request" place, so numbers are fine. The question is which
ones are worth showing at all. ✋

| # | Now | Proposed |
|---|---|---|
| 8.1 | 10/10 health · 20/20 energy | (keep) |
| 8.2 | food for 17 more (1 bite/turn) | food enough for 17 energy more |
| 8.3 | 9 hexes/turn · 3 actions/turn · turn 4 | 9 hexes a turn · 3 actions a turn ✋ drop "turn 4"? |
| 8.4 | 10 gold · 7/16 slots · 1 attack, 1 defence | (keep) |
| 8.5 | moon 1, day 1 of 3 · fair days | Moon 1, day 1 of 3 · fair days |
| 8.6 | Tired from staying up — max energy 15 of 20 until nightfall | (keep) |
