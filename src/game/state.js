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

/** Turn-based day-night cycle: 12 turns of day followed by 12 turns of night. */
export const DAY_TURNS = 12;
export const NIGHT_TURNS = 12;
export const TURNS_PER_DAY = DAY_TURNS + NIGHT_TURNS;
export const DAY_LENGTH = TURNS_PER_DAY;

/** How far through a day dusk falls. Night is everything after it. */
export const DUSK = DAY_TURNS / TURNS_PER_DAY;

/**
 * Days in a moon. Time is counted in moons because the three ways of playing
 * each get a part of one: two fair days and a morning in which no raid ever sets
 * out, an afternoon of omens when the next one is shown on the map, and the
 * night it comes. See moonOf, and raiders.js for what the night brings.
 */
export const MOON_DAYS = 3;

/** Turn within the final day of a moon when omens begin (midday). */
export const OMENS_TURN = 6;
/** How far through the moon's last day the omens begin. */
export const OMENS_AT = OMENS_TURN / TURNS_PER_DAY;

export const BASE_MOVE_DISTANCE = 9;
export const ACTIONS_PER_TURN = 3;

export const WORN_SLOTS = [
  { id: 'head', label: 'Head' },
  { id: 'hand', label: 'Hand' },
  { id: 'offhand', label: 'Off-hand' },
  { id: 'body', label: 'Body' },
  { id: 'feet', label: 'Feet' },
  { id: 'pack', label: 'Pack' },
];

export const createWorn = () => ({ head: null, hand: null, offhand: null, body: null, feet: null, pack: null });

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
    surveyed: {},    // "q,r" -> scenic tier explored personally by the player
    known: {},       // "q,r" -> 1 where the hidden resources are known
    meditated: {},   // "q,r" -> 1 where the player has meditated at a scenic spot
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
  inventory[0] = { id: 'berries', qty: 5 };
  return {
    inventory,
    worn: createWorn(),
    cloak: false,           // donned for good once you put a Hooded Cloak on
    playerColor: 'crimson', // your colour: dyes the cloak (see CLOAK_COLORS)
    free,
    gold,
    energy: BASE_MAX_ENERGY,
    hp: BASE_MAX_HP,
    turn: 0,                // turn clock; see DAY_TURNS / NIGHT_TURNS
    turnProgress: 0,        // combined move + action fraction [0, 1) toward next turn
    eatenThisTurn: 0,
    awakeNightTurns: 0,
    sleepDebt: 0,
    time: 0,                // animation / real-time frame seconds
    stepsWalked: 0,
    skills: Object.fromEntries(SKILLS.map(s => [s, { level: 1, xp: 0 }])),
    built: [],              // { item, q, r }
    stash: new Array(16).fill(null),
    prices: {},             // "q,r" of a village -> { itemId: price }
    trust: {},              // "q,r" of a village -> true once its favour is done
    goals: {},              // journey goal id -> 1
    seen: { berries: 1 },   // items held or seen so far; unlocks recipes in UI
    thoughts: {},           // one-time progression hints already shown
    stats: { kills: 0, raidsRepelled: 0, campsBurned: 0, deaths: 0, crafted: 0 },
    raid: null,             // the raid schedule; see raiders.js
    wildDogs: [],
    wildDogsSeeded: false,
    won: false,
    log: [],
    mind: createMindState(),
  };
}

/** Day number (from 1), turn within day (0..23), phase turn (1..12), and fraction (0..1). */
export function dayOf(state) {
  const t = Math.max(0, Math.floor(state?.turn || 0));
  const day = Math.floor(t / TURNS_PER_DAY) + 1;
  const turnInDay = t % TURNS_PER_DAY;
  const night = turnInDay >= DAY_TURNS;
  const phaseTurn = night ? (turnInDay - DAY_TURNS + 1) : (turnInDay + 1);
  const frac = turnInDay / TURNS_PER_DAY;
  return { day, turnInDay, isNight: night, phaseTurn, frac };
}
export const isNight = state => dayOf(state).isNight;

/**
 * Where we are in the moon (in turns).
 *
 *   phase   'fair'   nothing is coming
 *           'omens'  the last afternoon: tonight's raid is known
 *           'raid'   the last night
 *
 * @returns {{moon:number, day:number, turnInDay:number, frac:number, phase:string, progress:number,
 *            startAt:number, omensAt:number, duskAt:number, dawnAt:number}}
 */
export function moonOf(state) {
  const t = Math.max(0, Math.floor(state?.turn || 0));
  const span = MOON_DAYS * TURNS_PER_DAY;
  const index = Math.floor(t / span);
  const startAt = index * span;
  const day = Math.floor((t - startAt) / TURNS_PER_DAY) + 1;
  const turnInDay = t % TURNS_PER_DAY;
  const frac = turnInDay / TURNS_PER_DAY;
  const last = day === MOON_DAYS;
  return {
    moon: index + 1,
    day,
    turnInDay,
    frac,
    phase: last && turnInDay >= DAY_TURNS ? 'raid' : last && turnInDay >= OMENS_TURN ? 'omens' : 'fair',
    progress: (t - startAt) / span,
    startAt,
    omensAt: startAt + (MOON_DAYS - 1) * TURNS_PER_DAY + OMENS_TURN,
    duskAt: startAt + (MOON_DAYS - 1) * TURNS_PER_DAY + DAY_TURNS,
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
