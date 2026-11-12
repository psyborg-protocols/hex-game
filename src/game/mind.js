// mind.js
// Where Mind xp comes from.
//
// Not from making things. Mind is what you learn by going places: walking the
// roads, arriving at villages, getting a long way from any of them, trading, and
// exploring somewhere worth the stop. It comes in spurts. Each one is a moment
// you can name ("you reached the summit", "you know every road") rather than a
// point per step, so there is nothing to grind by pacing back and forth.
//
// The achievements are hidden. Nothing lists what is left to find; the game only
// says so when you have found one. Each function here returns the moments it
// produced, and the UI decides how loudly to announce them.

import { neighbors } from '../world/hexgrid.js';
import { TERRAIN } from '../world/tileset.js';
import { addXp } from './skills.js';
import {
  ensureMind, exploreHex, revealAround, factsOf, distanceFromCivilisation,
  TIERS, TRADE_REVEAL_RADIUS,
} from './discovery.js';

/** Xp for arriving somewhere for the first time, and trading there. */
export const VILLAGE_XP = 8;
export const FIRST_TRADE_XP = 5;

/**
 * The hidden achievements. `test` gets (state, facts) and is checked after
 * anything that could complete one; completion is permanent.
 */
export const ACHIEVEMENTS = [
  // Exploring.
  { id: 'explore_10', name: 'A Curious Eye', xp: 5, test: s => count(s.mind.explored) >= 10 },
  { id: 'explore_40', name: 'Surveyor', xp: 12, test: s => count(s.mind.explored) >= 40 },
  { id: 'explore_100', name: 'Cartographer', xp: 25, test: s => count(s.mind.explored) >= 100 },
  { id: 'explore_250', name: 'Nothing Left Unturned', xp: 40, test: s => count(s.mind.explored) >= 250 },
  { id: 'first_gold', name: 'Breathtaking', xp: 10, test: s => Object.values(s.mind.explored).includes(3) },

  // The roads.
  { id: 'roads_15', name: 'On the Road', xp: 6, test: s => count(s.mind.roads) >= 15 },
  { id: 'roads_40', name: 'Wayfarer', xp: 15, test: s => count(s.mind.roads) >= 40 },
  { id: 'roads_all', name: 'Every Road', xp: 30, test: (s, f) => f.roads > 0 && count(s.mind.roads) >= Math.ceil(f.roads * 0.9) },

  // People.
  { id: 'villages_all', name: 'Well Travelled', xp: 30, test: (s, f) => f.villages > 1 && count(s.mind.villages) >= f.villages },
  { id: 'traded_3', name: 'A Known Face', xp: 15, test: s => count(s.mind.traded) >= 3 },

  // Distance from everyone.
  { id: 'far_6', name: 'Off the Beaten Track', xp: 6, test: s => s.mind.farthest >= 6 },
  { id: 'far_10', name: 'Into the Wild', xp: 15, test: s => s.mind.farthest >= 10 },
  { id: 'far_15', name: 'Far From Any Hearth', xp: 30, test: s => s.mind.farthest >= 15 },

  // Places.
  { id: 'summit', name: 'Roof of the World', xp: 40, test: (s, f) => f.here && f.here === f.summit },
  { id: 'treeline', name: 'Above the Treeline', xp: 15, test: (s, f) => f.here && f.here.h >= f.alpine },
  { id: 'edge', name: "The World's Edge", xp: 10, test: (s, f) => f.here && f.atEdge },
  { id: 'beyond', name: 'Beyond Reach', xp: 25, test: (s, f) => f.here && f.beyond },
];

const count = o => Object.keys(o || {}).length;
const key = (q, r) => `${q},${r}`;

/** A moment worth announcing. */
const moment = (kind, title, xp, extra = {}) => ({ kind, title, xp, ...extra });

/**
 * Award a batch of moments' xp, and attach the levels they reached.
 * @returns {{moments, levels:number[]}}
 */
function settle(state, moments) {
  const total = moments.reduce((s, m) => s + (m.xp || 0), 0);
  return { moments, levels: total ? addXp(state, 'mind', total) : [] };
}

// ------------------------------------------------------------- world facts

/**
 * What the achievements need to know about the world, worked out once per map.
 * "Beyond reach" is ground you could not walk to from the spawn on the world's
 * first day, without a ladder or a bridge: the far bank, a cliff-top plateau.
 */
const mindFacts = new WeakMap();
function worldFactsFor(map) {
  let f = mindFacts.get(map);
  if (f) return f;
  let roads = 0, villages = 0, peak = 0;
  for (const col of map) {
    if (col.terrain === 'path') roads++;
    if (col.feature?.type === 'village') villages++;
    if (col.h > peak) peak = col.h;
  }
  f = {
    roads, villages,
    summit: factsOf(map).summit,
    // The same line worldgen draws for the treeline: just over half the ceiling.
    alpine: Math.max(8, Math.round(Math.max(peak, 12) * 0.55)),
    walkable: walkableFromSpawn(map),
  };
  mindFacts.set(map, f);
  return f;
}

function walkableFromSpawn(map) {
  const seen = new Set();
  const start = map.spawn && map.get(map.spawn.q, map.spawn.r);
  if (!start) return seen;
  const queue = [start];
  seen.add(key(start.q, start.r));
  while (queue.length) {
    const cur = queue.shift();
    for (const n of neighbors(cur.q, cur.r)) {
      const k = key(n.q, n.r);
      if (seen.has(k)) continue;
      const col = map.get(n.q, n.r);
      if (!col || TERRAIN[col.terrain]?.water) continue;
      const climb = col.h - cur.h;
      if (climb > 1 || climb < -2) continue;
      seen.add(k);
      queue.push(col);
    }
  }
  return seen;
}

function checkAchievements(map, state, here = null) {
  const mind = ensureMind(state);
  const base = worldFactsFor(map);
  const f = {
    ...base,
    here,
    atEdge: here ? neighbors(here.q, here.r).some(n => !map.get(n.q, n.r)) : false,
    beyond: here ? base.walkable.size > 0 && !base.walkable.has(key(here.q, here.r)) : false,
  };
  const out = [];
  for (const a of ACHIEVEMENTS) {
    if (mind.done[a.id]) continue;
    if (!a.test(state, f)) continue;
    mind.done[a.id] = 1;
    out.push(moment('achievement', a.name, a.xp, { id: a.id }));
  }
  return out;
}

// ------------------------------------------------------------------ events

/**
 * The player has arrived on a tile. Counts roads walked, villages reached and
 * distance from civilisation, then checks the achievements.
 */
export function onStep(world, state, at) {
  const { map } = world;
  const mind = ensureMind(state);
  const col = map.get(at.q, at.r);
  if (!col) return settle(state, []);
  const moments = [];

  if (col.terrain === 'path') mind.roads[key(col.q, col.r)] = 1;

  // A village counts as visited from the hex beside it, where you trade from.
  for (const c of [col, ...neighbors(col.q, col.r).map(n => map.get(n.q, n.r))]) {
    if (c?.feature?.type !== 'village') continue;
    const k = key(c.q, c.r);
    if (mind.villages[k]) continue;
    mind.villages[k] = 1;
    moments.push(moment('village', `Arrived at ${c.feature.name}`, VILLAGE_XP));
  }

  const far = distanceFromCivilisation(map, col.q, col.r);
  if (Number.isFinite(far) && far > mind.farthest) mind.farthest = far;

  moments.push(...checkAchievements(map, state, col));
  return settle(state, moments);
}

/**
 * Standing still long enough explored the hex. A scenic find is a moment of its
 * own; an ordinary hex is not, though it still counts towards the milestones.
 */
export function onExplored(world, state, at) {
  const { map } = world;
  const found = exploreHex(map, state, at.q, at.r);
  if (!found) return { found: null, ...settle(state, []) };

  const moments = [];
  if (found.tier > 0) {
    moments.push(moment('scenic', found.name, found.xp, { tier: found.tier, tierName: TIERS[found.tier].name }));
  }
  moments.push(...checkAchievements(map, state, map.get(at.q, at.r)));
  return { found, ...settle(state, moments) };
}

/**
 * A trade actually went through. The first one at a village earns a little and
 * buys you what they know about the country round it.
 */
export function onTrade(world, state, village) {
  const { map } = world;
  const mind = ensureMind(state);
  const k = key(village.q, village.r);
  if (mind.traded[k]) return { revealed: [], ...settle(state, []) };

  mind.traded[k] = 1;
  // Wayfinding (Mind 4): a village that trusts you tells you twice as much.
  const radius = TRADE_REVEAL_RADIUS * ((state.skills?.mind?.level ?? 1) >= 4 ? 2 : 1);
  const revealed = revealAround(map, state, village.q, village.r, radius);
  const name = village.feature?.name || 'the village';
  const moments = [moment('trade', `Trusted at ${name}`, FIRST_TRADE_XP)];
  moments.push(...checkAchievements(map, state, null));
  return { revealed, ...settle(state, moments) };
}

/** For a summary in the skills panel: what has been found so far. */
export function completedAchievements(state) {
  const done = state.mind?.done || {};
  return ACHIEVEMENTS.filter(a => done[a.id]);
}

