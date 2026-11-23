// turns.js
// Background turn progression from combined movement and actions, plus
// bedtime: stay up past midnight and tomorrow costs you (see MIDNIGHT in state.js).
//
// Each day is 12 turns and each night is 12 turns. Walking is never capped or
// interrupted: 9 hexes (at healthy energy; improved by boots or a walking stick),
// 3 actions, or any weighted combination advances a turn in the background.

import {
  BASE_MOVE_DISTANCE, ACTIONS_PER_TURN, TURNS_PER_DAY, dayOf, isFree,
  MIDNIGHT, SMALL_HOURS, PASS_OUT, setFatigue,
} from './state.js';
import { maxEnergy, topUp, ensureWorn } from './inventory.js';
import { moveBonus, maxHp } from './gear.js';
import { growCrops } from './actions.js';
import { stepWildDogs } from './wild_dogs.js';

export { BASE_MOVE_DISTANCE, ACTIONS_PER_TURN };
export const MIN_MOVE_DISTANCE = 4;

/**
 * Hexes of movement that equal one full turn, scaled by energy plus worn
 * boots/walking stick.
 */
export function maxMoveDistance(state) {
  const max = maxEnergy(state);
  const ratio = max > 0 ? (state.energy ?? 0) / max : 0;
  const base = isFree(state)
    ? BASE_MOVE_DISTANCE
    : (state.energy ?? 0) <= 0
      ? 5
      : ratio < 0.25
        ? 6
        : ratio < 0.55
          ? 7
          : BASE_MOVE_DISTANCE;
  return Math.max(MIN_MOVE_DISTANCE, base + moveBonus(state));
}

export const hexesPerTurn = maxMoveDistance;

/** Backfill turn-related fields on older saves or raw test states. */
export function ensureTurnState(state) {
  ensureWorn(state);
  if (state.turn == null) state.turn = 0;
  if (state.turnProgress == null || Number.isNaN(state.turnProgress)) state.turnProgress = 0;
  if (state.eatenThisTurn == null) state.eatenThisTurn = 0;
  if (state.fatigue === undefined) state.fatigue = null;
  // Older saves counted sleep debt instead; bedtime replaced it.
  delete state.sleepDebt;
  delete state.awakeNightTurns;
  if (!state.wildDogs) state.wildDogs = [];
  return state;
}

/**
 * Advance the world by one turn: bedtime, food top-up, crops, and wild dogs.
 *
 * Awake at night, three turns matter: MIDNIGHT makes you tired for all of
 * tomorrow, SMALL_HOURS exhausted, and PASS_OUT drops you where you stand
 * (`passOut` in the result; the caller sleeps you till dawn). The turn before
 * each is a warning (`warn`).
 */
export function advanceTurn(world, state, player, ctx = {}) {
  ensureTurnState(state);
  const wasInfo = dayOf(state);

  state.turn = Math.max(0, Math.floor(state.turn || 0)) + 1;
  state.eatenThisTurn = 0;
  if (ctx.resetProgress) state.turnProgress = 0;

  const dayInfo = dayOf(state);
  const becameNight = !wasInfo.isNight && dayInfo.isNight;
  const becameDawn = wasInfo.isNight && !dayInfo.isNight;

  let fatigued = 0;
  let warn = null;
  let passOut = false;
  if (dayInfo.isNight && !ctx.sleeping) {
    const t = dayInfo.turnInDay;
    if (!isFree(state) && t === MIDNIGHT) fatigued = setFatigue(state, 1);
    else if (!isFree(state) && t === SMALL_HOURS) fatigued = setFatigue(state, 2);
    else if (t === PASS_OUT) passOut = true;
    if (!isFree(state) && t === MIDNIGHT - 1) warn = 'midnight';
    else if (!isFree(state) && t === SMALL_HOURS - 1) warn = 'small_hours';
    else if (t === PASS_OUT - 1) warn = 'pass_out';
    // Tiredness bites at once: energy above the lowered max is lost.
    if (fatigued) state.energy = Math.min(state.energy ?? 0, maxEnergy(state));
  }

  // Rate-limited eating: at most MAX_BITES_PER_TURN item per turn.
  const eaten = topUp(state);

  // Slow passive recovery: +1 HP once per full day out of combat.
  if (!ctx.inCombat && state.turn % TURNS_PER_DAY === 0 && state.hp > 0 && state.hp < maxHp(state)) {
    state.hp = Math.min(maxHp(state), state.hp + 1);
  }

  const cropsChanged = world?.map ? growCrops(world, state) : [];
  const events = [];
  if (world?.map && player && !ctx.sleeping) {
    stepWildDogs(world, state, player, ctx.rng, events);
  }

  return {
    turn: state.turn,
    dayInfo,
    eaten,
    cropsChanged,
    events,
    becameNight,
    becameDawn,
    fatigued,
    warn,
    passOut,
  };
}

/** Add `delta` turn progress; rolls one or more turns whenever progress reaches 1. */
export function addTurnProgress(world, state, player, delta, ctx = {}) {
  ensureTurnState(state);
  state.turnProgress = Math.max(0, (state.turnProgress || 0) + delta);
  let count = 0;
  let last = null;
  while (state.turnProgress >= 1 - 1e-9) {
    state.turnProgress = Math.max(0, state.turnProgress - 1);
    last = advanceTurn(world, state, player, ctx);
    count += 1;
    // Passing out ends the night here; nothing more rolls over.
    if (last.passOut) {
      state.turnProgress = 0;
      break;
    }
  }
  return {
    advanced: count > 0,
    count,
    turnProgress: state.turnProgress,
    ...(last || {}),
  };
}

/** Record one hex walked toward turn progress (1 / hexesPerTurn). */
export function spendMoveStep(world, state, player, ctx = {}) {
  return addTurnProgress(world, state, player, 1 / maxMoveDistance(state), ctx);
}

/** Record `cost` actions toward turn progress (cost / ACTIONS_PER_TURN). */
export function spendAction(world, state, player, cost = 1, ctx = {}) {
  return addTurnProgress(world, state, player, cost / ACTIONS_PER_TURN, ctx);
}
