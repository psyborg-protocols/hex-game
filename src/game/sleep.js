// sleep.js
// Sleeping through the night, warmth, village inns, and wild dog ambushes.
//
// At night you must sleep: awake at midnight and you are tired all tomorrow, and
// one turn before dawn you pass out where you stand (see MIDNIGHT in state.js).
// - Not beside a campfire (hearth) or village, and no cloak -> chance of taking cold damage.
// - Not in/next to a village or hut -> chance a wild dog attacks & wakes you.
// - Sleeping at a village costs VILLAGE_SLEEP_COST coins.

import { distance } from '../world/hexgrid.js';
import { TURNS_PER_DAY, dayOf, isNight, moonOf, builtNear, isFree } from './state.js';
import { maxEnergy, countItem } from './inventory.js';
import { maxHp, defenseDice } from './gear.js';
import { villageNear } from './context.js';
import { isRaided } from './economy.js';
import { abroad } from './raiders.js';
import { clash } from './combat.js';
import { spawnAmbushWildDog } from './wild_dogs.js';
import { advanceTurn } from './turns.js';

export const VILLAGE_SLEEP_COST = 3;
export const COLD_CHANCE_PER_TURN = 0.08;
export const DOG_AMBUSH_CHANCE_PER_TURN = 0.06;

/** Describe shelter, warmth, coin cost, and raid status for sleeping at `at`. */
export function sleepContext(map, state, at) {
  const village = villageNear(map, at);
  const inVillage = !!village && !isRaided(state, village.q, village.r);
  const nearFire = builtNear(state, 'hearth', at, 1, distance);
  const inHut = builtNear(state, 'hut', at, 1, distance);
  const cloaked = !!state.cloak;
  const warm = nearFire || inVillage || cloaked;
  const safeFromDogs = inVillage || inHut;
  const cost = inVillage ? VILLAGE_SLEEP_COST : 0;
  const canAfford = isFree(state) || (state.gold || 0) >= cost;
  const m = moonOf(state);
  const raidActive = m.phase === 'raid' && (state.raid?.stage !== 'done' || abroad(state).length > 0);
  return { village, inVillage, nearFire, inHut, cloaked, warm, safeFromDogs, cost, canAfford, raidActive };
}

/** Whether the player can start sleeping right now at `at`. */
export function canSleep(map, state, at) {
  const ctx = sleepContext(map, state, at);
  if (!isNight(state)) return { ok: false, reason: 'You can only sleep at night.', ctx };
  if (ctx.raidActive) return { ok: false, reason: 'You cannot sleep while raiders are abroad!', ctx };
  if (ctx.inVillage && !ctx.canAfford) {
    return { ok: false, reason: `Sleeping in ${ctx.village.feature.name} costs ${ctx.cost} gold.`, ctx };
  }
  return { ok: true, ctx };
}

/**
 * Sleep through the remaining turns of night.
 * Returns outcome details: coldDamage, wokenByDog, ambushDamage, ambushDog, goldSpent, slept, died.
 */
export function sleepNight(world, state, player, { rng = Math.random } = {}) {
  const check = canSleep(world.map, state, player);
  if (!check.ok) return { ok: false, message: check.reason, ctx: check.ctx };

  const { ctx } = check;
  const goldSpent = isFree(state) ? 0 : ctx.cost;
  if (goldSpent > 0) state.gold -= goldSpent;
  return restUntilDawn(world, state, player, ctx, rng, goldSpent);
}

/**
 * Stayed up until the turn before dawn: you drop where you stand and sleep till
 * morning, whatever is around you. No inn takes your coin, raiders or not, and the
 * cold and the wild dogs get their chance as on any night spent there.
 */
export function passOut(world, state, player, { rng = Math.random } = {}) {
  const ctx = { ...sleepContext(world.map, state, player), cost: 0 };
  const res = restUntilDawn(world, state, player, ctx, rng, 0);
  res.passedOut = true;
  if (!res.died) res.message = `You collapse from exhaustion where you stand. ${res.message}`;
  return res;
}

function restUntilDawn(world, state, player, ctx, rng, goldSpent) {
  const rollFn = typeof rng === 'function' ? rng : () => rng.next();

  const remaining = Math.max(1, TURNS_PER_DAY - dayOf(state).turnInDay);
  let slept = 0;
  let coldDamage = 0;
  let wokenByDog = false;
  let ambushDamage = 0;
  let ambushDog = null;
  const cropsChanged = [];

  for (let i = 0; i < remaining; i++) {
    const step = advanceTurn(world, state, player, { sleeping: true, rng: rollFn });
    slept += 1;
    if (step.cropsChanged?.length) cropsChanged.push(...step.cropsChanged);

    if (!ctx.warm && coldDamage < 3 && rollFn() < COLD_CHANCE_PER_TURN) {
      coldDamage += 1;
      state.hp = Math.max(0, state.hp - 1);
      if (state.hp <= 0) break;
    }

    const dogChance = countItem(state, 'dog') > 0
      ? DOG_AMBUSH_CHANCE_PER_TURN * 0.5
      : DOG_AMBUSH_CHANCE_PER_TURN;
    if (!ctx.safeFromDogs && rollFn() < dogChance) {
      const roll = clash(2, defenseDice(state), { next: rollFn });
      ambushDamage = Math.max(1, roll.damage);
      state.hp = Math.max(0, state.hp - ambushDamage);
      ambushDog = spawnAmbushWildDog(world.map, state, player, rollFn);
      wokenByDog = true;
      break;
    }
  }

  if (state.hp <= 0) {
    return {
      ok: true,
      died: true,
      slept,
      coldDamage,
      ambushDamage,
      wokenByDog,
      ambushDog,
      goldSpent,
      ctx,
      cropsChanged,
      message: wokenByDog ? 'A wild dog tore at you in the dark!' : 'The night chill overcame you in your sleep.',
    };
  }

  if (wokenByDog) {
    const eMax = maxEnergy(state);
    const eGain = Math.round(Math.max(0, eMax - state.energy) * (slept / remaining));
    state.energy = Math.min(eMax, state.energy + eGain);
    state.turnProgress = 0;
    return {
      ok: true,
      died: false,
      slept,
      coldDamage,
      ambushDamage,
      wokenByDog: true,
      ambushDog,
      goldSpent,
      ctx,
      cropsChanged,
      message: `A wild dog ambushed you for ${ambushDamage} damage and woke you up!`,
    };
  }

  // Slept safely to dawn: ambush dogs and near-bank shy dogs slink off.
  state.wildDogs = (state.wildDogs || []).filter(d => d.region !== 'ambush' && d.region !== 'near');
  state.eatenThisTurn = 0;

  const eMax = maxEnergy(state);
  state.energy = (ctx.warm || ctx.inHut) ? eMax : Math.max(state.energy, Math.round(eMax * 0.8));

  const hpMax = maxHp(state);
  if (ctx.inHut) state.hp = hpMax;
  else if (ctx.inVillage) state.hp = Math.min(hpMax, state.hp + 3);
  else if (ctx.nearFire) state.hp = Math.min(hpMax, state.hp + 2);

  state.turnProgress = 0;

  const parts = [];
  if (ctx.inVillage && goldSpent) parts.push(`You slept warmly at ${ctx.village.feature.name} (-${goldSpent}g).`);
  else if (ctx.inVillage) parts.push(`You slept at ${ctx.village.feature.name}.`);
  else if (ctx.inHut && ctx.nearFire) parts.push('You slept soundly in your hut by the hearth.');
  else if (ctx.inHut) parts.push('You slept safely in your hut.');
  else if (ctx.nearFire) parts.push('You slept by the fire.');
  else parts.push('Dawn breaks after a rough night outdoors.');
  if (coldDamage > 0) parts.push(`The night chill cost ${coldDamage} HP.`);

  return {
    ok: true,
    died: false,
    slept,
    coldDamage,
    ambushDamage: 0,
    wokenByDog: false,
    ambushDog: null,
    goldSpent,
    ctx,
    cropsChanged,
    message: parts.join(' '),
  };
}
