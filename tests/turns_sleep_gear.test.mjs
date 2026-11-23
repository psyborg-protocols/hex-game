// turns_sleep_gear.test.mjs — turn-based day/night cycle, move & action allowances,
// late-night energy drain vs rate-limited eating, sleeping & night hazards,
// wild dogs (far-bank, daytime emergence, 50% taming), and worn gear slots.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test, eq, ok, run } from './_harness.mjs';
import { WorldMap } from '../src/world/mapformat.js';
import { makeResolvers, isWater } from '../src/world/tileset.js';
import { generateWorld } from '../src/world/worldgen.js';
import { distance, neighbors } from '../src/world/hexgrid.js';
import { RECIPES, VILLAGE_KINDS } from '../data/game_data.js';
import {
  createState, dayOf, isNight, moonOf, DAY_TURNS, NIGHT_TURNS, TURNS_PER_DAY,
  BASE_MOVE_DISTANCE, ACTIONS_PER_TURN, MIDNIGHT, SMALL_HOURS, PASS_OUT, FATIGUE, fatigueOf,
} from '../src/game/state.js';
import {
  addItem, countItem, countInPack, capacity, usedSlots,
  equipFromPack, unequipSlot, ensureWorn, topUp, MAX_BITES_PER_TURN, donFromPack,
  maxEnergy, restedMaxEnergy,
} from '../src/game/inventory.js';
import { attackDice, defenseDice, reach, moveBonus, bestWeapon, playerGearSnapshot } from '../src/game/gear.js';
import { ensureVillage } from '../src/game/economy.js';
import { checkRecipe } from '../src/game/crafting.js';
import {
  advanceTurn, spendMoveStep, spendAction, maxMoveDistance, hexesPerTurn,
} from '../src/game/turns.js';
import { sleepNight, canSleep, passOut, VILLAGE_SLEEP_COST } from '../src/game/sleep.js';
import {
  seedWildDogs, stepWildDogs, tryTameWildDog, isFarBank,
} from '../src/game/wild_dogs.js';
import { addXp } from '../src/game/skills.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const index = JSON.parse(readFileSync(join(root, 'new_tiles', 'index.json'), 'utf8'));
const resolvers = makeResolvers(index);

function flatWorld(terrain = 'grass', w = 15, d = 15) {
  const map = new WorldMap({ seed: 'turns-test' });
  for (let q = 0; q < w; q++) for (let r = 0; r < d; r++) map.place(q, r, terrain, 1);
  map.spawn = { q: 7, r: 7 };
  return { map, resolvers, seed: 'turns-test' };
}

test('day-night cycle is strictly 12 day turns followed by 12 night turns', () => {
  eq(DAY_TURNS, 12);
  eq(NIGHT_TURNS, 12);
  eq(TURNS_PER_DAY, 24);

  const s = createState();
  eq(dayOf(s).day, 1);
  eq(dayOf(s).phaseTurn, 1);
  eq(isNight(s), false);

  s.turn = 11;
  eq(dayOf(s).phaseTurn, 12);
  eq(isNight(s), false, 'turn 11 (12th turn) is still day');

  s.turn = 12;
  eq(isNight(s), true, 'turn 12 starts night');
  eq(dayOf(s).phaseTurn, 1);

  s.turn = 23;
  eq(isNight(s), true);
  eq(dayOf(s).phaseTurn, 12);

  s.turn = 24;
  eq(dayOf(s).day, 2);
  eq(isNight(s), false, 'turn 24 starts day 2');
  eq(moonOf(s).day, 2);
});

test('background turn progress counts 9 hexes, 3 actions, or any combination, and boots/walking stick scale distance', () => {
  const world = flatWorld();
  const s = createState();
  const player = { q: 7, r: 7 };

  eq(BASE_MOVE_DISTANCE, 9);
  eq(ACTIONS_PER_TURN, 3);
  eq(maxMoveDistance(s), 9, 'healthy energy gives 9 hexes per turn');
  eq(hexesPerTurn(s), 9);

  s.energy = 0;
  eq(maxMoveDistance(s), 5, 'zero energy slows base hexes per turn to 5');
  s.energy = 20;

  addItem(s, 'boots', 1);
  eq(maxMoveDistance(s), 11, 'wearing Leather Boots sets pace to 11 hexes/turn');
  addItem(s, 'walking_stick', 1);
  eq(maxMoveDistance(s), 13, 'wearing Walking Stick + Boots sets pace to 13 hexes/turn');
  eq(moveBonus(s), 4);

  // Equipping a sword replaces walking_stick in hand (cannot wield both at once)
  addItem(s, 'sword', 1);
  const swordIdx = s.inventory.findIndex(x => x?.id === 'sword');
  ok(swordIdx >= 0);
  ok(equipFromPack(s, swordIdx).ok);
  eq(ensureWorn(s).hand, 'sword');
  eq(moveBonus(s), 2, 'replacing walking_stick with sword leaves only boots move bonus');

  ok(unequipSlot(s, 'feet').ok);
  eq(maxMoveDistance(s), 9, 'unequipping boots drops pace back to base 9 hexes/turn');

  // Fresh state: 9 hexes/turn, 3 actions/turn
  const s2 = createState();

  // 1) 9 hexes = 1 turn
  for (let i = 0; i < 8; i++) {
    eq(spendMoveStep(world, s2, player).advanced, false, `step ${i + 1} should not yet advance turn`);
  }
  const step9 = spendMoveStep(world, s2, player);
  eq(step9.advanced, true, '9th hex advances turn');
  eq(s2.turn, 1);

  // 2) 3 actions = 1 turn
  eq(spendAction(world, s2, player, 1).advanced, false);
  eq(spendAction(world, s2, player, 1).advanced, false);
  eq(spendAction(world, s2, player, 1).advanced, true, '3rd action advances turn');
  eq(s2.turn, 2);

  // 3) Mixed combination 1: 3 hexes (3/9) + 2 actions (6/9) = 1 turn
  for (let i = 0; i < 3; i++) eq(spendMoveStep(world, s2, player).advanced, false);
  eq(spendAction(world, s2, player, 1).advanced, false);
  eq(spendAction(world, s2, player, 1).advanced, true, '3 hexes + 2 actions advances turn');
  eq(s2.turn, 3);
  ok(s2.turnProgress < 1e-6);

  // 4) Mixed combination 2: 6 hexes (6/9) + 1 action (3/9) = 1 turn
  for (let i = 0; i < 6; i++) eq(spendMoveStep(world, s2, player).advanced, false);
  eq(spendAction(world, s2, player, 1).advanced, true, '6 hexes + 1 action advances turn');
  eq(s2.turn, 4);
  ok(s2.turnProgress < 1e-6);

  // 5) Fractional carry-over: 5 hexes (5/9) + 2 actions (6/9) = 1 turn + 2/9 carried over
  for (let i = 0; i < 5; i++) eq(spendMoveStep(world, s2, player).advanced, false);
  eq(spendAction(world, s2, player, 1).advanced, false);
  eq(spendAction(world, s2, player, 1).advanced, true, '5 hexes + 2 actions rolls turn over');
  eq(s2.turn, 5);
  ok(Math.abs(s2.turnProgress - 2 / 9) < 1e-6, `expected 2/9 carry-over, got ${s2.turnProgress}`);

  // 6) Continuous long walk never stops or clamps: 18 steps = 2 turns
  s2.turnProgress = 0;
  for (let i = 0; i < 18; i++) spendMoveStep(world, s2, player);
  eq(s2.turn, 7, '18 continuous steps advance 2 turns without stopping');
});

test('bedtime: awake at midnight you are tired all tomorrow, exhausted three turns on', () => {
  const world = flatWorld();
  const s = createState();
  const player = { q: 7, r: 7 };
  eq(MIDNIGHT, 18, 'midnight is halfway through the night');
  eq(SMALL_HOURS, 21);
  eq(PASS_OUT, TURNS_PER_DAY - 1, 'one turn before dawn');

  // Up until the turn before midnight: warned, nothing lost yet.
  s.turn = DAY_TURNS;
  let r;
  while (dayOf(s).turnInDay < MIDNIGHT - 1) r = advanceTurn(world, s, player);
  eq(r.warn, 'midnight', 'the turn before midnight warns');
  eq(fatigueOf(s), 0);
  eq(maxEnergy(s), restedMaxEnergy(s));

  // Midnight: tired, with energy above the lowered max cut back at once.
  s.energy = restedMaxEnergy(s);
  r = advanceTurn(world, s, player);
  eq(r.fatigued, 1);
  eq(fatigueOf(s), 1);
  eq(maxEnergy(s), Math.round(restedMaxEnergy(s) * (1 - FATIGUE[1].cut)));
  eq(s.energy, maxEnergy(s), 'energy over the tired max is lost');

  // Three turns past midnight: exhausted, a larger cut.
  r = advanceTurn(world, s, player);
  r = advanceTurn(world, s, player);
  eq(r.warn, 'small_hours');
  r = advanceTurn(world, s, player);
  eq(r.fatigued, 2);
  eq(maxEnergy(s), Math.round(restedMaxEnergy(s) * (1 - FATIGUE[2].cut)));
  ok(FATIGUE[2].cut > FATIGUE[1].cut, 'exhausted is worse than tired');

  // It lasts all of tomorrow, and lifts at the next dusk.
  s.turn = TURNS_PER_DAY + DAY_TURNS - 1; // the last day turn of tomorrow
  eq(fatigueOf(s), 2, 'still exhausted on the last turn of tomorrow');
  s.turn += 1;
  eq(fatigueOf(s), 0, 'rested again from tomorrow\'s dusk');

  // Asleep before midnight: no penalty.
  const early = createState();
  early.turn = MIDNIGHT - 2;
  early.built.push({ item: 'hut', q: 7, r: 7 }, { item: 'hearth', q: 7, r: 8 });
  ok(sleepNight(world, early, player, { rng: () => 0.99 }).ok);
  eq(fatigueOf(early), 0, 'sleeping before midnight costs nothing');
  eq(early.energy, maxEnergy(early));

  // Free mode is for testing: no fatigue.
  const free = createState({ free: true });
  free.turn = MIDNIGHT - 1;
  advanceTurn(world, free, player);
  eq(fatigueOf(free), 0);
});

test('bedtime: awake one turn before dawn, you pass out where you stand', () => {
  const world = flatWorld();
  const s = createState({ gold: 10 });
  const player = { q: 7, r: 7 };
  s.turn = SMALL_HOURS - 1;
  let r = advanceTurn(world, s, player);
  eq(r.fatigued, 2);
  r = advanceTurn(world, s, player);
  eq(r.warn, 'pass_out', 'the turn before warns you');
  eq(r.passOut, false);
  r = advanceTurn(world, s, player);
  eq(r.passOut, true, 'one turn before dawn you drop');

  // Walking into that turn stops the roll-over there.
  const walker = createState();
  walker.turn = PASS_OUT - 1;
  walker.turnProgress = 0.95;
  const step = spendAction(world, walker, player, 3);
  eq(step.passOut, true);
  eq(walker.turn, PASS_OUT, 'no turns roll past the collapse');
  eq(walker.turnProgress, 0);

  // Passing out sleeps you to dawn where you stand, with no inn fee even in a village.
  world.map.get(8, 7).feature = { type: 'village', name: 'Oakhaven', kind: 'farmers' };
  s.turn = PASS_OUT;
  const res = passOut(world, s, { q: 8, r: 7 }, { rng: () => 0.99 });
  ok(res.ok && res.passedOut);
  eq(res.goldSpent, 0);
  eq(s.gold, 10);
  eq(s.turn % TURNS_PER_DAY, 0, 'woke at dawn');
  ok(/collapse/.test(res.message));
  eq(fatigueOf(s), 2, 'still exhausted all day after passing out');
  eq(s.energy, maxEnergy(s), 'wakes with the exhausted max');
});

test('food is eaten at most once per turn', () => {
  const s = createState();
  s.inventory = s.inventory.map(() => null);
  addItem(s, 'berries', 30);

  // Verify topUp refuses to eat more than MAX_BITES_PER_TURN per turn
  s.eatenThisTurn = 0;
  s.energy = 1;
  const eaten = topUp(s);
  eq(eaten.length, MAX_BITES_PER_TURN);
  eq(topUp(s).length, 0, 'cannot eat a second time on the same turn');
});

test('sleeping outdoors risks cold and wild dog ambush; campfire warms; hut/village protects; village costs coins', () => {
  const world = flatWorld();
  const player = { q: 7, r: 7 };

  // 1) Exposed outdoors with guaranteed low RNG: takes cold damage and gets woken by wild dog
  const exposed = createState();
  exposed.turn = DAY_TURNS + 2;
  const exposedRes = sleepNight(world, exposed, player, { rng: () => 0.01 });
  ok(exposedRes.ok);
  ok(exposedRes.coldDamage >= 1, 'outdoors without fire should take cold damage');
  eq(exposedRes.wokenByDog, true, 'unprotected outdoors should be woken by a wild dog');
  ok(exposedRes.ambushDamage >= 1, 'wild dog ambush should hurt');
  ok(exposedRes.ambushDog && exposedRes.ambushDog.hostile, 'hostile wild dog spawns beside sleeper');
  ok(exposed.turn < TURNS_PER_DAY, 'waking up stops short of dawn');

  // 2) Beside hearth (campfire), no hut/village: warm (0 cold) even with low RNG, still exposed to wild dog
  const byFire = createState();
  byFire.turn = DAY_TURNS + 2;
  byFire.built.push({ item: 'hearth', q: 7, r: 7 });
  const fireRes = sleepNight(world, byFire, player, { rng: () => 0.01 });
  eq(fireRes.coldDamage, 0, 'campfire prevents cold damage');
  eq(fireRes.wokenByDog, true, 'hearth alone without hut/village still risks wild dog ambush');

  // 3) Hut + hearth: completely safe & warm until dawn
  const inHut = createState();
  inHut.turn = DAY_TURNS + 4;
  inHut.energy = 4;
  inHut.hp = 5;
  inHut.built.push({ item: 'hearth', q: 7, r: 7 }, { item: 'hut', q: 7, r: 8 });
  const hutRes = sleepNight(world, inHut, player, { rng: () => 0.01 });
  eq(hutRes.coldDamage, 0);
  eq(hutRes.wokenByDog, false, 'hut prevents wild dog ambush');
  eq(inHut.turn, TURNS_PER_DAY, 'slept cleanly until dawn');
  eq(inHut.hp, 10, 'hut heals fully on sleep');

  // 4) Village sleep costs coins, prevents cold and wild dogs, refuses when broke
  world.map.get(8, 7).feature = { type: 'village', name: 'Oakhaven', kind: 'farmers' };
  const poor = createState({ gold: VILLAGE_SLEEP_COST - 1 });
  poor.turn = DAY_TURNS;
  ok(!canSleep(world.map, poor, { q: 8, r: 7 }).ok, 'cannot sleep at village without enough coins');

  const rich = createState({ gold: 10 });
  rich.turn = DAY_TURNS + 1;
  const vRes = sleepNight(world, rich, { q: 8, r: 7 }, { rng: () => 0.01 });
  ok(vRes.ok);
  eq(vRes.coldDamage, 0);
  eq(vRes.wokenByDog, false);
  eq(vRes.goldSpent, VILLAGE_SLEEP_COST);
  eq(rich.gold, 10 - VILLAGE_SLEEP_COST);
});

test('dogs are not craftable, spawn as wild dogs across river and rarely by day, and tame at 50% with Mind 2', () => {
  eq(RECIPES.tame_dog, undefined, 'tame_dog recipe must be removed');

  const map = generateWorld({ seed: 'wilddogs', radius: 22, resolvers });
  const world = { map, resolvers, seed: 'wilddogs' };
  const s = createState();
  const player = { q: map.spawn.q, r: map.spawn.r };

  seedWildDogs(map, s, () => 0.42);
  ok(s.wildDogs.length >= 2, 'seeds wild dogs on the far bank');
  for (const wd of s.wildDogs) {
    ok(isFarBank(map, map.get(wd.q, wd.r)), 'seeded wild dog must be on the far bank across the river');
  }

  // Daytime near-bank emergence when RNG rolls < 0.08
  s.turn = 2; // daytime
  stepWildDogs(world, s, player, () => 0.02);
  ok(s.wildDogs.some(d => d.region === 'near'), 'rare wild dog emerges on near bank during day');

  // Nighttime hides shy near-bank wild dogs
  s.turn = DAY_TURNS + 1;
  stepWildDogs(world, s, player, () => 0.5);
  ok(!s.wildDogs.some(d => d.region === 'near' && !d.hostile), 'near-bank wild dog hides at night');

  // Taming requires Mind 2 + Meat/Meal and uses 50% chance
  const adj = neighbors(player.q, player.r).map(n => map.get(n.q, n.r)).find(c => c && !isWater(c.terrain));
  const wd = { id: 999, q: adj.q, r: adj.r, hp: 5, maxHp: 5, facing: 1, region: 'near', hostile: false, spooked: 0 };
  s.wildDogs.push(wd);
  addItem(s, 'meal', 3);

  ok(!tryTameWildDog(map, s, player, wd, () => 0.1).ok, 'requires Mind 2');
  addXp(s, 'mind', 100);

  // Failed roll (0.75 >= 0.5): consumes 1 meal and bolts
  const failRes = tryTameWildDog(map, s, player, wd, () => 0.75);
  ok(failRes.ok && !failRes.tamed, 'roll >= 0.5 fails to tame');
  eq(countItem(s, 'meal'), 2);

  // Move adjacent again and succeed (0.2 < 0.5)
  wd.q = adj.q; wd.r = adj.r;
  const winRes = tryTameWildDog(map, s, player, wd, () => 0.2);
  ok(winRes.ok && winRes.tamed, 'roll < 0.5 tames the wild dog');
  eq(countItem(s, 'dog'), 1);
  ok(s.dog, 'companion dog spawned');
});

test('worn item bar slots control combat/move stats while tools in pack still work for recipes', () => {
  const s = createState();
  s.inventory = s.inventory.map(() => null);

  // Add sword -> auto-equips to hand; add stone_axe -> goes to pack
  addItem(s, 'sword', 1);
  addItem(s, 'stone_axe', 1);
  eq(ensureWorn(s).hand, 'sword');
  eq(bestWeapon(s)?.id, 'sword');
  eq(attackDice(s), 4);
  eq(countInPack(s, 'stone_axe'), 1);

  // Stone axe in pack still counts for recipes needing stone_axe
  addItem(s, 'log', 2);
  addItem(s, 'plank', 4);
  addXp(s, 'woodworking', 100);
  ok(checkRecipe(s, 'workbench', {}).ok, 'stone_axe in pack still satisfies workbench tool slot');

  // Equipping bow swaps sword into pack and sets reach to 2
  addItem(s, 'bow', 1);
  const bowIdx = s.inventory.findIndex(x => x?.id === 'bow');
  ok(bowIdx >= 0);
  ok(equipFromPack(s, bowIdx).ok);
  eq(ensureWorn(s).hand, 'bow');
  eq(reach(s), 2, 'wearing bow grants reach 2');
  eq(attackDice(s), 3);

  // Armour stats only apply while worn
  addItem(s, 'iron_mail', 1);
  eq(defenseDice(s), 3, '1 base + 2 iron_mail while worn');
  ok(unequipSlot(s, 'body').ok);
  eq(defenseDice(s), 1, 'unequipped iron_mail in pack grants no defence bonus');

  // Pack slot unequip guards against overflow
  addItem(s, 'basket', 1);
  eq(capacity(s), 20);
  for (let i = 0; i < 16; i++) addItem(s, 'pot', 1);
  ok(usedSlots(s) >= 16);
  const badUnequip = unequipSlot(s, 'pack');
  ok(!badUnequip.ok, 'cannot unequip pack when items exceed base 16 slots');
});

test('the hooded cloak is donned for good, keeps off the night chill, and is sold in villages', () => {
  const s = createState();
  eq(s.cloak, false, 'a new wanderer has no cloak');
  eq(s.playerColor, 'crimson');
  eq(playerGearSnapshot(s).cloak, false);

  addItem(s, 'cloak', 2);
  eq(ensureWorn(s).body, null, 'a cloak never auto-equips into a worn slot');
  const idx = s.inventory.findIndex(x => x?.id === 'cloak');
  ok(donFromPack(s, idx).ok);
  eq(s.cloak, true);
  eq(countItem(s, 'cloak'), 1, 'donning uses up one cloak');
  ok(!donFromPack(s, s.inventory.findIndex(x => x?.id === 'cloak')).ok, 'only one cloak can be worn');
  ok(!donFromPack(s, s.inventory.findIndex(x => x?.id === 'berries')).ok, 'berries cannot be put on');

  s.playerColor = 'ocean';
  const snap = playerGearSnapshot(s);
  eq(snap.cloak, true);
  eq(snap.color, 'ocean');

  // Sleeping rough with the worst luck: no chill reaches a cloaked sleeper.
  const world = flatWorld();
  s.turn = DAY_TURNS + 2;
  const res = sleepNight(world, s, { q: 7, r: 7 }, { rng: () => 0.01 });
  ok(res.ok);
  eq(res.coldDamage, 0, 'the cloak keeps off the night chill');

  // Farmers sell it, including at a village first visited before cloaks existed.
  ok(VILLAGE_KINDS.farmers.sells.includes('cloak') && VILLAGE_KINDS.herbalists.sells.includes('cloak'));
  const old = createState();
  old.prices['3,4'] = { grain: 1 };
  ensureVillage(old, { kind: 'farmers' }, 3, 4, 'seed');
  ok(old.prices['3,4'].cloak > 0, "an old save's farmers stock cloaks");
  eq(old.prices['3,4'].grain, 1, 'existing prices are kept');
});

run('turns_sleep_gear');
