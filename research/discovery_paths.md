# Discovery Paths: Anthropological Patterns
### Research notes for the hex-world skill/economy design

Five skill domains: **Stoneworking, Woodworking, Homesteading, Metalworking, Mind.**
Method: reconstruct the *actual* order in which technologies appear in the archaeological record, then extract the **dependency logic** (what each technology presupposes) rather than the exact dates. The game compresses ~300,000 years into one player lifetime; what must survive is the *shape of the dependency graph*, not the chronology.

---

## 1. STONEWORKING — the universal root

**Real sequence**
1. **Oldowan (≈2.6 Ma)** — knapped choppers and flake tools. No hafting, no planning beyond the next strike.
2. **Acheulean (≈1.76 Ma)** — hand axes. First evidence of *mental templates*: the maker holds a shape in mind that the stone does not yet show.
3. **Levallois / prepared-core (≈300 ka)** — the core is pre-shaped so every flake comes out the same. *Process design before product design.*
4. **Microliths + hafting (≈50 ka)** — small blades set into wood/bone handles. The tool becomes a **sandwich**: stone edge + organic handle + sinew/resin bind. One artifact, three materials.
5. **Polished Neolithic axes (≈10 ka)** — grinding (poling) replaces pure knapping. A different physics: abrasion over fracture.
6. **Querns and grindstones** — stone that works on *grain*, not on wood. The first "machine" (grinding grain = the first food processing step).
7. **Masonry (≈7 ka onward)** — shaped blocks, walls, hearths, ovens, forges. Stone stops being a tool and becomes *infrastructure*.

**Patterns for the game**
- Stone is the only technology with **no prerequisites** — it is the root node of the whole graph (matches the sample design: stone 1 = quarry).
- **Hafting is the hidden unlock.** A stone edge + branch + sinew = the first *real* tools (stone axe, stone knife, adzes). Sinew is therefore a universal cross-skill ingredient.
- **Grinding is a separate sub-chain** (quern → grindstone → whetstone). It never gets superseded by metal — in real history querns survived into the modern era. Stone tools should persist as *tier-1 items and unique items* (whetstone, quern, anvil stone, hearth), never be fully replaced.
- **Masonry is the capstone**: walls, ovens, forges, kilns. Everything high-temperature (metals, pottery, bricks) stands on stoneworking L6+.
- Knapping and grinding are two *different* mental models — two branches of the same skill, both retained (chisel/knapping vs quern/whetstone/grinding).

## 2. WOODWORKING — the invisible half of prehistory

**Real sequence**
1. **Digging sticks, clubs, fire-hardened points (2.5 Ma+)** — wood is used from the very start but is invisible to archaeology.
2. **Cordage and basketry (≈30 ka)** — twisted fiber, plaited baskets. The *container* precedes the pot.
3. **Atlatl (≈20–30 ka) → Bow (≈20–70 ka)** — a throwing stick that becomes a spring-loaded lever. Note: **atlatl before bow** — the bow is the more advanced, more material-demanding tool (good stiff stave + strong string).
4. **Antler/bone adzes, harpoons, needles (Mesolithic)** — the *other* half of the tool sandwich. Antler adzes fell trees and shaped dugouts long before metal.
5. **Bow-drill, dugout canoes, sledges (≈10–13 ka)** — wood *machines*.
6. **Wheel and cart (≈3500 BCE)** — one of the last great pre-industrial inventions, and purely wooden.

**Patterns for the game**
- Wood's dependency is **soft**: it needs only stone (to chop) and time. It should be the *fast* skill, the one that unblocks everything while metal is still gated.
- **The tool sandwich again**: nearly every wooden tool (axe, adze, pick, hoe) = stick + working edge + sinew lash. Sinew shows up in woodworking, stoneworking *and* metalworking — maximum interdependence through one cheap resource.
- **Adze vs axe is the canonical real redundancy**: adze = side-blow (shaping, hollowing, boats); axe = end-blow (felling, splitting). Three real tiers: antler/bone → stone → metal. (The user's tier principle, directly attested.)
- **Crossing a river: bridge or boat** — both real, both wooden, both end-game woodworking. Keep as the designed redundancy pair.
- **The wheel is a late, broad-reaching node** → cart at woodworking L6, gated by nothing exotic (planks, beams, cord) but powerful (transport, later plough synergy).

## 3. METALWORKING — knowledge-gated, ritual-born

**Real sequence**
1. **Fire first.** Copper's low melting point (~1,085 °C) means the first "melts" likely happened **in cooking fires**. Smelting is a child of the hearth.
2. **Cold-hammered native copper (≈9000–8000 BCE)** — surface copper, shaped with stone. *Metal object without metallurgy* — and these objects were overwhelmingly **ornaments and amulets**, not tools.
3. **Melting and casting (≈5500 BCE)** — bead making, small casts.
4. **Ore smelting (≈5000–4000 BCE, Fertile Crescent)** — requires: a specific ore, a fuel that burns hot, a **bellows/air flow**, a crucible or slag pit, and *tongs* to handle the billet. This is a **package**, not an invention.
5. **Alloying/bronze (≈3300 BCE)** — a *deliberate* chemical choice, not an accident.
6. **Iron (≈1200 BCE)** — needs much higher heat; bellows and quenching become mandatory.
7. The smithy chain: **crucible → bellows → anvil → tongs → quenching/annealing**, each step presupposing the last.

**Patterns for the game**
- **Ore is the scarcest resource in the world** and it is *knowledge-gated*: real prospecting knowledge was often held by ritual specialists (cf. "smith-priests"; the first furnaces appear at ritual sites). → **Prospecting is a Mind (Lore L4) ability, not a metalworking one.** Metalworking L1 can *mine* but only what the Mind reveals.
- **The smelting package**: forge (stoneworking L6) + fuel (wood) + bellows (wood + hide) + tongs → first ingot. One skill cannot do it alone — maximum interdependence, exactly as designed.
- **First metal objects are small**: knife, chisel, hook, amulet — *not* the sword. The sword is the apex (L6–7). Matches the sample's ordering.
- **Circular dependencies are real and famous**: it takes tongs to make tongs, a hammer to make a hammer, a saw to cut the saw-pit. Keep: `bone_tongs → tongs → fine_tongs`, each made with its predecessor.
- **The anvil is a stone→metal tier** (stone anvil for early forging, metal anvil for fine work) — a real attested sequence (stone anvils predate metal ones by millennia).
- **Whetstone is a stone item that upgrades metal** — the one direction in which stone beats metal. Keep as the designed asymmetry.

## 4. HOMESTEADING — cooking, storage, surplus

**Real sequence**
1. **The cooking hearth (fire, ≈1–400 ka; managed hearths from ~400 ka).** Wrangham's cooking hypothesis: cooked food → better nutrition → larger brains. **Cooking is the oldest "technology" that changed the species.** It is *not* a building; it is the first hearth.
2. **Pottery (≈20 ka in East Asia; widespread ≈10 ka)** — vessels that can boil and store. Cooking upgrades from "roast" to "stew/porridge" = a genuine caloric jump.
3. **Storage → sedentism** — grain caches, granaries. Storing surplus is what makes staying in one place rational.
4. **Agriculture (≈10–12 ka, multi-hearth: Fertile Crescent, China, Mesoamerica, Andes, Africa)** — note: **farming came after pottery and sedentism**, not before. The sample's ordering (hearth → pot → field) is archaeologically correct.
5. **Preservation: smoking, drying, fermenting (≈10 ka)** — the first food engineering; enables the first surpluses to survive the winter.
6. **Plough and irrigation (≈6–4 ka)** — metal-tipped eventually; the plough is the first tool that *needs an animal or a team*, i.e. social scale.
7. **Market/trade infrastructure (≈4 ka)** — surplus + storage + strangers = the market.

**Patterns for the game**
- **Hearth = homesteading L1 = the first build in the entire game** (after bare gathering). Everything thermal chains from it: pot → ovens → bricks → kilns.
- **The oven is the single best tiered structure in real history**: cooking pit → stone oven → clay oven → kiln → communal bakehouse. Five tiers, exactly as specified. Each tier is a real stage (open fire, masonry hearth, fired-clay dome, high-temperature kiln, village bakery).
- **Farming needs a house** (user principle) — and in fact needs *storage*: the granary is gated on a cabin. Farming without storage is a trap (surplus rots) — a genuine scarcity mechanic with a real basis.
- **Field → grain → quern → bread**: grain only becomes food through *two* other skills (stoneworking quern, homesteading oven). Interdependence as designed.
- **Smokehouse before plough** — preservation precedes the plough in real life; in the game it precedes it too (smokehouse L3, plough L6–7).
- **The well** is a late homesteading node (digging + lining with stone + wood) — it serves farming (drought) *and* metalworking (quenching). One item, two skills.

## 5. MIND — attention, prayer, resource-knowledge, social cohesion

**Real sequence**
1. **Attention to nature is subsistence** — before it is "spiritual," reading weather, seasons, animal behavior and plant phenology is *food*. Ethnoscience: foragers hold dense, systematic knowledge of their environment that we only later call "ecology."
2. **Animism (the earliest detectable religion; burials with goods from ≈100 ka, ochre, figurines ≈35–25 ka)** — agency in nature. The same attention that finds food finds *meaning*.
3. **Ancestor veneration (delayed-return societies)** — the dead as present social actors. Model: belief in an afterlife → ancestor worship → shamanism, co-evolving with group size (Kessler & Haidt; PMC4958132).
4. **Ritual as social glue (Dunbar)** — gossip maintains trust to ~150; beyond that, *shared ritual* is the mechanism that scales trust. Drums, feasts, totems, processions. → Ritual scales with village size: a solo player needs amulets; a village needs totems and shrines.
5. **Resource ethics / taboos** — real foragers enforce sustainable harvest through *sacred rules* (taboo species, first-fruit offerings, not taking from the same place twice). **Resource awareness is moralized into ritual.**
6. **Strangers and trade (Mauss's gift)** — trade with strangers runs on *trust technology*: hospitality rules, oaths, gift-giving, shared meals at a table. The "market" is a social artifact before it is an economic one.

**Patterns for the game**
- **Mind is the knowledge skill.** Its L1–L3 are *perception* (foraging bonuses, herbs, weather), L4 is **Lore = prospecting** (the ore gate), L5 is medicine, L6–L7 are *social scale* (totem, shrine, trade with strangers).
- **Prayer/ritual = measurable buffs, not flavor**: blessing (foraging +), drum (group rituals → trade/trust +), totem (strangers become safe/trade hub), oracle (prospect 2×, reveals map). Every ritual item in real life has a *social function*; the game makes that function mechanical.
- **The amulet is the first metal candidate**: real early metal was amulets and beads. If a player can smelt, the first *mind* item should be castable in metal (amulet tier: bone → ingot). (Kept as a light tier, 2 tiers.)
- **Dog** — the only domestication that predates farming. Tamed via *bonding* (Mind) + feeding (Homesteading). It is the first "social tech": guard, hunter, companion.
- **Table and chair are Mind-adjacent social items** (owned by homesteading/woodworking, but their *function* is social: table = trade bonus, the real "shared meal" node).

---

## 6. Cross-cutting patterns (the actual design laws)

| # | Pattern | Real-world basis | Game rule |
|---|---------|------------------|-----------|
| 1 | **Technologies arrive as packages** | Leroi-Gourhan's *chaîne opératoire*; smelting needs fuel+bellows+crucible+tongs | No recipe works in one skill alone at the frontier; every L5+ recipe crosses skills |
| 2 | **Hafting is the universal joint** | Stone edge + wood handle + sinew lash, 50 ka → present | `sinew` and `cord` appear in recipes of all four craft skills |
| 3 | **The scarce thing is knowledge, not material** | Prospecting, alloying, and seasons are know-how; first metals were prestige/ritual objects | Ore is gated by Mind (Lore). Smelting gated by Forge (stoneworking). Bread gated by quern + oven |
| 4 | **Ritual precedes utility in high-cost tech** | Furnaces at ritual sites; first copper = amulets; ovens at communal sites | Mind items (amulet, totem, shrine, oracle) are *required* or strongly bonus for the apex nodes (prospect 2×, trade, safety) |
| 5 | **Redundancy is natural, not designed** | Atlatl/bow; adze/axe; dugout/bridge; knife/whittle | Every frontier node has ≥1 alternate route with different cost/quality (axe vs knife beams, bridge vs boat, 3 adze tiers) |
| 6 | **Cycles are real** | Tongs-to-make-tongs; saw-pits cut with saws; whetstone ↔ metal edge | `bone_tongs→tongs→fine_tongs`, `hammer→hammer`, whetstone upgrades metal, metal chisel carves better whetstones |
| 7 | **Stone is never finished** | Querns, grindstones, anvil-stones, hearths survive into modernity | Stone items persist as unique/tier-1 items forever (whetstone, quern, stone anvil, forge) |
| 8 | **Energy gates everything** | Every labor chain is food-gated; cooking is the root | Food auto-consumes with travel/action (no cooking mini-game); hearth L1 is the first build |
| 9 | **Containers precede cooking** | Basket (30 ka) → pot (20–10 ka) → hearth upgrades | Basket (wood L1) → pot (hom L2) → stew (hom L3): the container ladder |
| 10 | **Social scale = ritual scale** | Dunbar's 150; ritual scales trust beyond gossip range | Mind L1–3 = solo (herb, amulet, drum); L4–5 = knowledge (lore, salve); L6–7 = village (totem, shrine, oracle, markets) |

### The canonical bootstrap path (what the archaeology says a player *will* actually do)

```
gather (branch, stone, berries)
  → stone_hammer (stone 1)
  → cord + basket (wood 1)
  → hearth (hom 1: stone+log) → cooked_meat
  → stone_axe + stone_chisel (stone 2)
  → log → beam/plank (wood 2–3, knife/whittle)
  → pot (hom 2, fired in hearth)
  → cabin (wood 5: log+beam+plank, hammer)
  → field (hom 2) + grain → quern (stone 3) → bread
  → drum + journal (mind 2–3) → Lore (mind 4) → PROSPECT (ore!)
  → stone_oven (stone 3) → ... → forge (stone 6)
  → smelt (metal 2: forge+fuel+ore) → ingot
  → knife, saw, axe, pickaxe (metal 3–4)
  → tongs cycle → anvil → fine tools → sword (metal 6–7)
  → smokehouse, granary, well, plough (hom 4–7)
  → bridge / boat / cart (wood 5–6)
  → totem, shrine, oracle, market (mind 6–7, hom 5)
```

Note the shape: **two roots** (stone, wood), **one knowledge gate** (Mind→ore), **one infrastructure cap** (stoneworking masonry enabling all heat), and **social scale as the endgame** — not weapons. The sword is a side-branch; the *village* is the main quest.

### Key sources
- Prehistoric technology (Wikipedia/academic surveys): Oldowan → Acheulean → Levallois → microlith → polished Neolithic → masonry.
- Leroi-Gourhan, *chaîne opératoire* (1964); Sassaman on metallurgical production chains.
- Kessler & Haidt, "Hunter-Gatherers and the Origins of Religion" (PMC4958132): afterlife → ancestor worship → shamanism, co-evolving with group size.
- Dunbar, *Grooming, Gossip and the Evolution of Language* — 150-person trust bound; ritual scales trust beyond it.
- Mauss, *The Gift* — trade with strangers as trust technology.
- Wrangham, *Catching Fire* — cooking as the root technology.
- Copper/bronze/iron chronology (≈9000 BCE native copper → ≈5500 BCE casting → ≈4000 BCE smelting → ≈3300 BCE bronze → ≈1200 BCE iron; cf. AZoM, UFL "Copper and Bronze" chapters).
- EXARC 2019: Mesolithic antler adzes as woodworking tools pre-metal.
- Neolithic Revolution surveys (OpenStax, National Geographic): multi-hearth, post-pottery, storage-first.
