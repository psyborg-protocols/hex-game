// state.js
// The player's whole mutable state, and the vocabulary derived from
// data/game_data.js that the rest of the game asks about.

import { ITEMS, RECIPES, SKILL_INFO, STRUCTURE_HP } from '../../data/game_data.js';

export { ITEMS, RECIPES, SKILL_INFO, STRUCTURE_HP };

export const SKILLS = Object.keys(SKILL_INFO);
export const MAX_LEVEL = 5;

/** Pack slots before any basket, pack or cart. */
export const BASE_SLOTS = 16;
/** The array is this long so gear can open slots without reshaping it. */
export const MAX_SLOTS = 40;

export const BASE_MAX_ENERGY = 20;
export const BASE_MAX_HP = 10;

/**
 * Seconds in a day: seven minutes. It was three, and with a raid every day or
 * two that left no stretch of the game in which nothing was coming.
 */
export const DAY_LENGTH = 420;

/** How far through a day dusk falls. Night is everything after it. */
export const DUSK = 0.72;

/**
 * Days in a moon. Time is counted in moons because the three ways of playing
 * each get a part of one: two fair days and a morning in which no raid ever sets
 * out, an afternoon of omens when the next one is shown on the map, and the
 * night it comes. See moonOf, and raiders.js for what the night brings.
 */
export const MOON_DAYS = 3;

/** How far through the moon's last day the omens begin. */
export const OMENS_AT = 0.4;

/**
 * Items that are structures rather than carryable goods: anything a recipe with
 * category 'build' produces. A recipe that lists one of these as a *tool* means
 * "you must be working at one", not "you must be carrying one".
 */
export const BUILDINGS = new Set(
  Object.values(RECIPES).filter(r => r.category === 'build')
    .flatMap(r => Object.keys(r.output)));

/** How close you have to be to a structure to work at it. */
export const BUILD_REACH = 1;

export const isBuilding = id => BUILDINGS.has(id);
export const itemName = id => ITEMS[id]?.name || id;

/**
 * Free-resource mode: a testing switch that turns off every *cost* while leaving
 * every *rule* in place. One flag, read through `isFree`.
 */
export const isFree = state => !!state?.free;

/** The part of the state Mind keeps: what you have explored and found. */
export function createMindState() {
  return {
    explored: {},    // "q,r" -> scenic tier (0 = common)
    known: {},       // "q,r" -> 1 where the hidden resources are known
    oreSigns: {},    // "q,r" -> 1 where an explored hex showed traces of ore
    roads: {},       // "q,r" -> 1 for each road tile walked
    villages: {},    // "q,r" -> 1 for each village visited
    traded: {},      // "q,r" -> 1 for each village traded with
    farthest: 0,     // furthest you have been from a road or village
    done: {},        // achievement id -> 1
  };
}

export function createState({ gold = 10, free = false } = {}) {
  const inventory = new Array(MAX_SLOTS).fill(null);
  // A few berries in your pocket, so the first minute is spent exploring rather
  // than starving.
  inventory[0] = { id: 'berries', qty: 6 };
  return {
    inventory,
    free,
    gold,
    energy: BASE_MAX_ENERGY,
    hp: BASE_MAX_HP,
    time: 0,                // world seconds; see DAY_LENGTH
    stepsWalked: 0,
    skills: Object.fromEntries(SKILLS.map(s => [s, { level: 1, xp: 0 }])),
    built: [],              // { item, q, r }
    stash: new Array(16).fill(null),
    prices: {},             // "q,r" of a village -> { itemId: price }
    trust: {},              // "q,r" of a village -> true once its favour is done
    goals: {},              // journey goal id -> 1
    stats: { kills: 0, raidsRepelled: 0, campsBurned: 0, deaths: 0, crafted: 0 },
    raid: null,             // the raid schedule; see raiders.js
    won: false,
    log: [],
    mind: createMindState(),
  };
}

/** Day number (from 1) and how far through it we are (0..1). */
export function dayOf(state) {
  const t = state.time || 0;
  return { day: Math.floor(t / DAY_LENGTH) + 1, frac: (t % DAY_LENGTH) / DAY_LENGTH };
}
export const isNight = state => dayOf(state).frac >= DUSK;

/**
 * Where we are in the moon.
 *
 *   phase   'fair'   nothing is coming
 *           'omens'  the last afternoon: tonight's raid is known
 *           'raid'   the last night
 *
 * The times are world seconds, for anything that has to count down to them.
 * @returns {{moon:number, day:number, frac:number, phase:string, progress:number,
 *            startAt:number, omensAt:number, duskAt:number, dawnAt:number}}
 */
export function moonOf(state) {
  const t = state.time || 0;
  const span = MOON_DAYS * DAY_LENGTH;
  const index = Math.floor(t / span);
  const startAt = index * span;
  const day = Math.floor((t - startAt) / DAY_LENGTH) + 1;
  const frac = (t % DAY_LENGTH) / DAY_LENGTH;
  const last = day === MOON_DAYS;
  return {
    moon: index + 1,
    day,
    frac,
    phase: last && frac >= DUSK ? 'raid' : last && frac >= OMENS_AT ? 'omens' : 'fair',
    progress: (t - startAt) / span,
    startAt,
    omensAt: startAt + (MOON_DAYS - 1 + OMENS_AT) * DAY_LENGTH,
    duskAt: startAt + (MOON_DAYS - 1 + DUSK) * DAY_LENGTH,
    dawnAt: startAt + span,
  };
}

// ------------------------------------------------------------- structures

export function recordBuilt(state, item, q, r) {
  state.built.push({ item, q, r });
  return state.built[state.built.length - 1];
}

export function forgetBuilt(state, q, r) {
  state.built = state.built.filter(b => !(b.q === q && b.r === r));
}

/** Does this structure exist anywhere in the world yet? What `needs` asks. */
export const hasBuilt = (state, item) => state.built.some(b => b.item === item);

/**
 * Is there one within reach of `at`? What a *tool* slot naming a structure asks.
 * Distance is measured by the caller, since only it knows the grid.
 */
export function builtNear(state, item, at, withinTiles, distanceFn) {
  if (!at) return false;
  return state.built.some(b => b.item === item
    && distanceFn(b.q, b.r, at.q, at.r) <= withinTiles);
}
