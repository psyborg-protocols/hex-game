// turns.js
// Background turn progression from combined movement and actions, plus
// late-night fatigue.
//
// Each day is 12 turns and each night is 12 turns. Walking is never capped or
// interrupted: 9 hexes (at healthy energy; improved by boots or a walking stick),
// 3 actions, or any weighted combination advances a turn in the background.

import {
  BASE_MOVE_DISTANCE, ACTIONS_PER_TURN, TURNS_PER_DAY, dayOf, isFree,
} from './state.js';
import { maxEnergy, topUp, ensureWorn } from './inventory.js';
import { moveBonus, maxHp } from './gear.js';
import { growCrops } from './actions.js';
import { stepWildDogs } from './wild_dogs.js';

export { BASE_MOVE_DISTANCE, ACTIONS_PER_TURN };
export const MIN_MOVE_DISTANCE = 4;
export const LATE_NIGHT_GRACE = 3;

/** Extra energy drained per turn when staying awake past LATE_NIGHT_GRACE. */
export function lateEnergyDrain(sleepDebt) {
  if (!sleepDebt || sleepDebt <= 0) return 0;
  return Math.min(8.5, 1 + sleepDebt * 0.75);
}

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
  if (state.awakeNightTurns == null) state.awakeNightTurns = 0;
  if (state.sleepDebt == null) state.sleepDebt = 0;
  if (!state.wildDogs) state.wildDogs = [];
  return state;
}

/** Advance the world by one turn: late-night drain, food top-up, crops, and wild dogs. */
export function advanceTurn(world, state, player, ctx = {}) {
  ensureTurnState(state);
  const wasInfo = dayOf(state);
  const wasLate = (state.sleepDebt || 0) > 0;

  state.turn = Math.max(0, Math.floor(state.turn || 0)) + 1;
  state.eatenThisTurn = 0;
  if (ctx.resetProgress) state.turnProgress = 0;

  const dayInfo = dayOf(state);
  const becameNight = !wasInfo.isNight && dayInfo.isNight;
  const becameDawn = wasInfo.isNight && !dayInfo.isNight;

  if (dayInfo.isNight && !ctx.sleeping) {
    state.awakeNightTurns = (state.awakeNightTurns || 0) + 1;
    if (state.awakeNightTurns > LATE_NIGHT_GRACE) {
      state.sleepDebt = Math.min(12, (state.sleepDebt || 0) + 1);
    }
  } else if (!dayInfo.isNight && becameDawn && !ctx.sleeping) {
    // Dawn arrives without sleep: reset the night counter and ease debt halfway so
    // the player remains sluggish until they rest, without locking up daytime play.
    state.awakeNightTurns = 0;
    state.sleepDebt = Math.max(0, Math.floor((state.sleepDebt || 0) / 2));
  }

  const becameLate = !wasLate && (state.sleepDebt || 0) > 0;

  let drain = 0;
  if (!isFree(state) && !ctx.sleeping && (state.sleepDebt || 0) > 0) {
    const rawDrain = lateEnergyDrain(state.sleepDebt);
    drain = dayInfo.isNight ? rawDrain : Math.min(2, rawDrain);
    state.energy = Math.max(0, (state.energy ?? 0) - drain);
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
    drain,
    eaten,
    cropsChanged,
    events,
    becameNight,
    becameDawn,
    becameLate,
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
