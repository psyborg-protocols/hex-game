// wild_dogs.js
// Rare wandering wild dogs: found deep in the forest across the river, or
// emerging from hiding on the near bank by day. Can be fed to tame (50% chance
// with Mind 2), or may ambush sleepers left unprotected at night.

import { neighbors, distance } from '../world/hexgrid.js';
import { isWater } from '../world/tileset.js';
import { findPath, canStep } from '../world/pathfinding.js';
import { clash } from './combat.js';
import { dayOf, isFree } from './state.js';
import { addItem, countItem, removeItem } from './inventory.js';
import { defenseDice } from './gear.js';
import { levelOf } from './skills.js';
import { ensureDog } from './dog.js';

export const WILD_DOG_HP = 5;
export const WILD_DOG_ATK = 2;
export const WILD_DOG_DEF = 1;
export const TAME_CHANCE = 0.5;

const WOODS = new Set(['oak_wood', 'pine_wood', 'forest_floor', 'pine_floor']);

const asRoll = rng => (typeof rng === 'function' ? rng : rng ? () => rng.next() : Math.random);

function nextDogId(state) {
  let maxId = 0;
  for (const d of state.wildDogs || []) if ((d.id || 0) > maxId) maxId = d.id;
  return maxId + 1;
}

function riverBounds(map) {
  const byRow = new Map();
  let sumAll = 0;
  let countAll = 0;
  for (const col of map) {
    if (col.terrain !== 'river') continue;
    let entry = byRow.get(col.r);
    if (!entry) { entry = { min: col.q, max: col.q }; byRow.set(col.r, entry); }
    else {
      if (col.q < entry.min) entry.min = col.q;
      if (col.q > entry.max) entry.max = col.q;
    }
    sumAll += col.q;
    countAll += 1;
  }
  const fallback = countAll ? sumAll / countAll : null;
  return {
    hasRiver: countAll > 0,
    centerAt(r) {
      const b = byRow.get(r);
      return b ? (b.min + b.max) / 2 : fallback;
    },
  };
}

/** True when a dry column sits on the far bank across the main river. */
export function isFarBank(map, col, bounds = riverBounds(map)) {
  if (!col || isWater(col.terrain) || !bounds.hasRiver) return false;
  const mid = bounds.centerAt(col.r);
  return mid != null && col.q > mid;
}

function canStandWildDog(col) {
  if (!col || isWater(col.terrain) || col.feature?.wall) return false;
  const ft = col.feature?.type;
  if (ft === 'village' || ft === 'camp') return false;
  if (ft === 'structure' && col.feature?.item === 'hut') return false;
  return true;
}

function makeWildDog(state, at, region, hostile = false) {
  return {
    id: nextDogId(state),
    q: at.q,
    r: at.r,
    hp: WILD_DOG_HP,
    maxHp: WILD_DOG_HP,
    facing: 1,
    region,
    hostile,
    spooked: 0,
  };
}

function farBankCandidates(map, state, bounds) {
  const occupied = new Set((state.wildDogs || []).map(d => `${d.q},${d.r}`));
  const forest = [];
  const dry = [];
  for (const col of map) {
    if (!isFarBank(map, col, bounds) || !canStandWildDog(col)) continue;
    if (occupied.has(`${col.q},${col.r}`)) continue;
    if (WOODS.has(col.terrain)) forest.push(col);
    else dry.push(col);
  }
  return forest.length ? forest : dry;
}

/** Seed 2-3 wild dogs in the forests on the far side of the river. */
export function seedWildDogs(map, state, rng = Math.random) {
  const r = asRoll(rng);
  state.wildDogs ||= [];
  if (state.wildDogsSeeded) return state.wildDogs;
  const bounds = riverBounds(map);
  const pool = farBankCandidates(map, state, bounds);
  const want = Math.min(pool.length, 2 + Math.floor(r() * 2));
  const picked = [];
  const remaining = pool.slice();
  while (picked.length < want && remaining.length) {
    const idx = Math.floor(r() * remaining.length);
    const chosen = remaining.splice(idx, 1)[0];
    if (picked.some(p => distance(p.q, p.r, chosen.q, chosen.r) < 4) && remaining.length >= want - picked.length) {
      continue;
    }
    picked.push(chosen);
  }
  for (const col of picked) {
    state.wildDogs.push(makeWildDog(state, col, 'far', false));
  }
  state.wildDogsSeeded = true;
  return state.wildDogs;
}

export function wildDogAt(state, q, r) {
  return (state.wildDogs || []).find(d => d.hp > 0 && d.q === q && d.r === r) || null;
}

/** Spawn a hostile wild dog right beside the player (used when ambushed at night). */
export function spawnAmbushWildDog(map, state, player, rng = Math.random) {
  const r = asRoll(rng);
  state.wildDogs ||= [];
  const adj = neighbors(player.q, player.r)
    .map(n => map.get(n.q, n.r))
    .filter(c => canStandWildDog(c) && canStep(map, player, c, {}));
  const spot = adj.length ? adj[Math.floor(r() * adj.length)] : map.get(player.q, player.r) || player;
  const wd = makeWildDog(state, spot, 'ambush', true);
  wd.prey = player.id || 'local'; // it hunts the sleeper it found
  if (player.q !== wd.q) wd.facing = player.q > wd.q ? 1 : -1;
  state.wildDogs.push(wd);
  return wd;
}

function stepRandom(map, wd, players, r) {
  const opts = neighbors(wd.q, wd.r)
    .map(n => map.get(n.q, n.r))
    .filter(c => canStandWildDog(c) && canStep(map, wd, c, {}) && !players.some(p => c.q === p.q && c.r === p.r));
  if (!opts.length) return;
  const next = opts[Math.floor(r() * opts.length)];
  if (next.q !== wd.q) wd.facing = next.q > wd.q ? 1 : -1;
  wd.q = next.q;
  wd.r = next.r;
}

/**
 * Advance wild dogs by one turn: daytime emergence, night hiding, roaming, and hostile pursuit.
 * `player` is whoever's turn this is (new dogs show up near them). In a room the
 * host passes `opts.players` ([{ id, q, r, defense }]) so dogs see everyone,
 * `opts.hurt(playerId, damage)` for bites, and `opts.clock` for the world's time.
 */
export function stepWildDogs(world, state, player, rng = Math.random, events = [], opts = {}) {
  const r = asRoll(rng);
  const { map } = world;
  if (!state.wildDogsSeeded) seedWildDogs(map, state, r);
  state.wildDogs = (state.wildDogs || []).filter(d => d.hp > 0);
  const players = opts.players || [{ id: 'local', q: player.q, r: player.r, defense: defenseDice(state) }];
  const hurt = opts.hurt || ((id, damage) => { state.hp = Math.max(0, state.hp - damage); });

  const dInfo = dayOf(opts.clock != null ? { turn: opts.clock } : state);
  const bounds = riverBounds(map);

  // At dawn, night-ambush dogs slink back into the dark.
  if (dInfo.turnInDay === 0) {
    state.wildDogs = state.wildDogs.filter(d => d.region !== 'ambush');
  }

  if (!dInfo.isNight) {
    // Rare near-bank emergence out of hiding during the day.
    const hasNear = state.wildDogs.some(d => d.region === 'near' && !d.hostile);
    if (!hasNear && r() < 0.08) {
      const nearWoods = [];
      const nearOpen = [];
      for (const col of map) {
        if (isFarBank(map, col, bounds) || !canStandWildDog(col)) continue;
        const d = distance(col.q, col.r, player.q, player.r);
        if (d < 6 || d > 15) continue;
        if (WOODS.has(col.terrain)) nearWoods.push(col);
        else if (['meadow', 'grass', 'steppes'].includes(col.terrain)) nearOpen.push(col);
      }
      const pool = nearWoods.length ? nearWoods : nearOpen;
      if (pool.length) {
        const spot = pool[Math.floor(r() * pool.length)];
        state.wildDogs.push(makeWildDog(state, spot, 'near', false));
      }
    }
    // Replenish far-bank forest packs if thinned out.
    const farCount = state.wildDogs.filter(d => d.region === 'far').length;
    if (farCount < 2 && r() < 0.04) {
      const pool = farBankCandidates(map, state, bounds);
      if (pool.length) {
        const spot = pool[Math.floor(r() * pool.length)];
        state.wildDogs.push(makeWildDog(state, spot, 'far', false));
      }
    }
  } else {
    // Shy wild dogs on the near bank slip back into hiding at night.
    state.wildDogs = state.wildDogs.filter(d => !(d.region === 'near' && !d.hostile));
  }

  for (const wd of state.wildDogs) {
    if (wd.hp <= 0) continue;
    if (!wd.hostile) {
      const steps = 1 + (r() < 0.45 ? 1 : 0);
      for (let i = 0; i < steps; i++) stepRandom(map, wd, players, r);
      continue;
    }

    // Hostile wild dog pursues its prey (or whoever is nearest) up to 3 hexes and bites when adjacent.
    const prey = players.find(p => p.id === wd.prey)
      || players.slice().sort((a, b) => distance(wd.q, wd.r, a.q, a.r) - distance(wd.q, wd.r, b.q, b.r))[0];
    if (!prey) continue;
    if (distance(wd.q, wd.r, prey.q, prey.r) > 1) {
      const beside = neighbors(prey.q, prey.r)
        .map(n => map.get(n.q, n.r))
        .filter(c => canStandWildDog(c))
        .sort((a, b) => distance(a.q, a.r, wd.q, wd.r) - distance(b.q, b.r, wd.q, wd.r));
      const goal = beside.find(c => (c.q === wd.q && c.r === wd.r) || findPath(map, wd, c, { limit: 1200 }));
      if (goal && !(goal.q === wd.q && goal.r === wd.r)) {
        const p = findPath(map, wd, goal, { limit: 1200 });
        if (p && p.length > 1) {
          const hop = p[Math.min(3, p.length - 1)];
          if (hop.q !== wd.q) wd.facing = hop.q > wd.q ? 1 : -1;
          wd.q = hop.q;
          wd.r = hop.r;
        }
      }
    }

    if (distance(wd.q, wd.r, prey.q, prey.r) <= 1) {
      if (prey.q !== wd.q) wd.facing = prey.q > wd.q ? 1 : -1;
      const roll = clash(WILD_DOG_ATK, prey.defense ?? defenseDice(state), { next: r });
      hurt(prey.id, roll.damage);
      events.push({ type: 'wildDogClash', who: wd, roll, playerId: prey.id, at: { q: prey.q, r: prey.r } });
    }
  }

  state.wildDogs = state.wildDogs.filter(d => d.hp > 0);
  return state.wildDogs;
}

/**
 * Attempt to tame a non-hostile wild dog with Cooked Meal or Raw Meat (50% chance).
 * Requires Mind 2 (unless free-resource mode is active).
 */
export function tryTameWildDog(map, state, player, wildDog, rng = Math.random) {
  const r = asRoll(rng);
  if (!wildDog || wildDog.hp <= 0) return { ok: false, message: 'No wild dog there.' };
  if (wildDog.hostile) return { ok: false, message: 'This wild dog is snarling — it will not be tamed.' };
  if (countItem(state, 'dog') > 0) return { ok: false, message: 'You already have a loyal dog.' };
  if (!isFree(state) && levelOf(state, 'mind') < 2) {
    return { ok: false, message: 'Needs Mind 2 before a wild dog will trust you.' };
  }
  if (distance(player.q, player.r, wildDog.q, wildDog.r) > 1) {
    return { ok: false, message: 'Move beside the wild dog to offer food.' };
  }

  let foodUsed = null;
  if (!isFree(state)) {
    foodUsed = countItem(state, 'meal') > 0 ? 'meal' : countItem(state, 'meat') > 0 ? 'meat' : null;
    if (!foodUsed) {
      return { ok: false, message: 'Carry a Cooked Meal or Raw Meat to tame a wild dog.' };
    }
    removeItem(state, foodUsed, 1);
  }

  if (r() < TAME_CHANCE) {
    state.wildDogs = (state.wildDogs || []).filter(d => d.id !== wildDog.id);
    addItem(state, 'dog', 1);
    const companion = ensureDog(map, state, player);
    if (companion) {
      companion.q = wildDog.q;
      companion.r = wildDog.r;
    }
    return {
      ok: true,
      tamed: true,
      foodUsed,
      message: 'The wild dog takes the food gently and stays at your heel!',
    };
  }

  // Failed attempt: bolt 2-4 hexes away; spooked 3 times -> flees for good.
  wildDog.spooked = (wildDog.spooked || 0) + 1;
  if (wildDog.spooked >= 3) {
    state.wildDogs = (state.wildDogs || []).filter(d => d.id !== wildDog.id);
    return {
      ok: true,
      tamed: false,
      fled: true,
      foodUsed,
      message: 'The wild dog snatches the scrap and bolts into the brush.',
    };
  }

  const away = [];
  for (const col of map) {
    if (!canStandWildDog(col)) continue;
    const d = distance(col.q, col.r, wildDog.q, wildDog.r);
    if (d >= 2 && d <= 4 && distance(col.q, col.r, player.q, player.r) > 1 && findPath(map, wildDog, col, { limit: 400 })) {
      away.push(col);
    }
  }
  if (away.length) {
    const pick = away[Math.floor(r() * away.length)];
    if (pick.q !== wildDog.q) wildDog.facing = pick.q > wildDog.q ? 1 : -1;
    wildDog.q = pick.q;
    wildDog.r = pick.r;
  }
  return {
    ok: true,
    tamed: false,
    fled: false,
    foodUsed,
    message: 'The wild dog snatches the food and darts back — try approaching again.',
  };
}

/** Strike a wild dog in combat. */
export function strikeWildDog(state, wildDog, atkDice, rng = null) {
  const roll = clash(atkDice, WILD_DOG_DEF, rng);
  wildDog.hp -= roll.damage;
  wildDog.hostile = true;
  if (wildDog.hp > 0) return { roll, killed: false, loot: [] };

  state.wildDogs = (state.wildDogs || []).filter(d => d.id !== wildDog.id);
  const loot = [];
  const meat = addItem(state, 'meat', 1);
  if (meat) loot.push({ id: 'meat', qty: meat });
  if (countItem(state, 'stone_knife') > 0) {
    const hide = addItem(state, 'hide', 1);
    if (hide) loot.push({ id: 'hide', qty: hide });
  }
  return { roll, killed: true, loot };
}
