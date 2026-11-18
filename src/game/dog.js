// dog.js
// Your companion shepherd dog: follows you as you travel, wanders up to one
// hex around you when you stop, and can be ordered to sit and guard any hex —
// wagging its tail, occasionally getting up to pace, and attacking raiders
// that come near.

import { neighbors, distance } from '../world/hexgrid.js';
import { isWater } from '../world/tileset.js';
import { findPath, canStep, isBridged } from '../world/pathfinding.js';
import { clash } from './combat.js';
import { countItem } from './inventory.js';
import { KINDS } from './raiders.js';

export const DOG_SPEED = 3.5;
export const DOG_ATK = 2;
export const DOG_CD = 1.2;
export const DOG_AGGRO = 3;
export const DOG_LEASH = 5;

const PACE_POINTS = [
  { ox: -5, oy: 1 },
  { ox: 4, oy: -2 },
  { ox: 5, oy: 2 },
  { ox: -4, oy: -2 },
];

export function makeDog(at) {
  return {
    q: at.q,
    r: at.r,
    facing: 1,
    mode: 'follow',
    guardAt: null,
    leg: null,
    path: [],
    repath: 0,
    ox: 0,
    oy: 0,
    stance: 'idle',
    wanderCd: 1.5,
    pace: null,
    cd: 0,
    attackAt: -10,
    wag: false,
  };
}

/** Ensure state.dog exists iff the player carries a dog. */
export function ensureDog(map, state, player) {
  if (!countItem(state, 'dog')) {
    state.dog = null;
    return null;
  }
  if (!state.dog || !map.get(state.dog.q, state.dog.r)) {
    state.dog = makeDog({ q: player.q, r: player.r });
  }
  return state.dog;
}

/** Command the dog to sit and guard a hex. */
export function commandDogGuard(map, state, player, target, opts = {}) {
  const dog = ensureDog(map, state, player);
  if (!dog) return { ok: false, reason: 'You do not have a dog.' };
  const col = map.get(target.q, target.r);
  if (!col || (isWater(col.terrain) && !isBridged(map, target)) || col.feature?.wall) {
    return { ok: false, reason: 'Your dog cannot guard there.' };
  }
  let route = [];
  if (dog.q !== target.q || dog.r !== target.r) {
    const p = findPath(map, dog, target, { boat: !!opts.boat, limit: 2500 });
    if (!p) return { ok: false, reason: 'Your dog cannot reach that spot.' };
    route = p.slice(1);
  }
  dog.mode = 'guard';
  dog.guardAt = { q: target.q, r: target.r };
  dog.path = route;
  dog.repath = 2;
  dog.pace = null;
  dog.ox = 0;
  dog.oy = 0;
  dog.wanderCd = 4 + Math.random() * 3;
  return { ok: true, alreadyThere: route.length === 0 && !dog.leg };
}

/** Call the dog back to follow you. */
export function commandDogFollow(state) {
  if (!state.dog) return false;
  state.dog.mode = 'follow';
  state.dog.guardAt = null;
  state.dog.path = [];
  state.dog.pace = null;
  state.dog.wanderCd = 1.2;
  return true;
}

function beginLeg(map, dog, next) {
  const col = map.get(next.q, next.r);
  const slow = isWater(col?.terrain) && !isBridged(map, next) ? 1.8 : 1;
  if (next.q !== dog.q) dog.facing = next.q > dog.q ? 1 : -1;
  dog.leg = {
    from: { q: dog.q, r: dog.r },
    to: { q: next.q, r: next.r },
    t: 0,
    duration: slow / DOG_SPEED,
  };
}

function walkToward(map, dog, goal, dt, boat) {
  dog.repath -= dt;
  const end = dog.path[dog.path.length - 1];
  if (!dog.path.length || dog.repath <= 0 || !end || end.q !== goal.q || end.r !== goal.r) {
    const p = findPath(map, dog, goal, { boat, limit: 2500 });
    dog.path = p ? p.slice(1) : [];
    dog.repath = 1.5 + Math.random() * 0.5;
  }
  const next = dog.path[0];
  if (!next) return false;
  if (!canStep(map, dog, next, { boat })) {
    dog.path = [];
    return false;
  }
  dog.path.shift();
  beginLeg(map, dog, next);
  return true;
}

function besideHex(map, dog, target, boat) {
  const candidates = [];
  for (const n of neighbors(target.q, target.r)) {
    const col = map.get(n.q, n.r);
    if (!col || col.feature?.wall) continue;
    if (isWater(col.terrain) && !isBridged(map, n) && !boat) continue;
    candidates.push({ q: n.q, r: n.r, d: distance(n.q, n.r, dog.q, dog.r) });
  }
  candidates.sort((a, b) => a.d - b.d);
  for (const c of candidates) {
    if ((c.q === dog.q && c.r === dog.r) || findPath(map, dog, c, { boat, limit: 2500 })) return c;
  }
  return { q: target.q, r: target.r };
}

function startPace(dog, rng = Math.random) {
  const pt = PACE_POINTS[Math.floor(rng() * PACE_POINTS.length)];
  dog.pace = {
    phase: 'out',
    fromX: dog.ox || 0,
    fromY: dog.oy || 0,
    toX: pt.ox,
    toY: pt.oy,
    t: 0,
    duration: 0.75,
    pause: 0.8 + rng() * 0.8,
    moving: true,
  };
  if (Math.abs(pt.ox - (dog.ox || 0)) > 0.5) {
    dog.facing = pt.ox >= (dog.ox || 0) ? 1 : -1;
  }
}

function advancePace(dog, dt) {
  const p = dog.pace;
  if (!p) return;
  if (p.moving) {
    p.t += dt / p.duration;
    const k = Math.min(1, p.t);
    const e = k * k * (3 - 2 * k);
    dog.ox = p.fromX + (p.toX - p.fromX) * e;
    dog.oy = p.fromY + (p.toY - p.fromY) * e;
    dog.stance = 'pace';
    if (p.t >= 1) {
      dog.ox = p.toX;
      dog.oy = p.toY;
      p.moving = false;
      p.t = 0;
    }
    return;
  }
  dog.stance = 'idle';
  p.pause -= dt;
  if (p.pause <= 0) {
    if (p.phase === 'out') {
      p.phase = 'back';
      p.fromX = dog.ox;
      p.fromY = dog.oy;
      p.toX = 0;
      p.toY = 0;
      p.t = 0;
      p.duration = 0.75;
      p.moving = true;
      if (Math.abs(p.toX - p.fromX) > 0.5) dog.facing = p.toX >= p.fromX ? 1 : -1;
    } else {
      dog.ox = 0;
      dog.oy = 0;
      dog.pace = null;
    }
  }
}

function wanderNearPlayer(map, dog, player, boat, rng = Math.random) {
  const candidates = [];
  for (const n of [{ q: player.q, r: player.r }, ...neighbors(player.q, player.r)]) {
    if (distance(n.q, n.r, dog.q, dog.r) !== 1) continue;
    const col = map.get(n.q, n.r);
    if (!col || col.feature?.wall) continue;
    if (isWater(col.terrain) && !isBridged(map, n) && !boat) continue;
    if (canStep(map, dog, n, { boat })) candidates.push(n);
  }
  if (!candidates.length) return;
  const pick = candidates[Math.floor(rng() * candidates.length)];
  beginLeg(map, dog, pick);
}

function engageFoe(map, state, dog, foe, events, dt, boat) {
  dog.pace = null;
  dog.wag = false;
  const dFoe = distance(dog.q, dog.r, foe.q, foe.r);
  if (dFoe <= 1) {
    if (foe.q !== dog.q) dog.facing = foe.q > dog.q ? 1 : -1;
    dog.stance = 'attack';
    if (dog.cd <= 0) {
      dog.cd = DOG_CD;
      dog.attackAt = state.time;
      const roll = clash(DOG_ATK, KINDS[foe.kind].def);
      foe.hp -= roll.damage;
      events.push({ type: 'dogClash', who: dog, target: foe, roll, at: { q: foe.q, r: foe.r } });
      if (foe.hp <= 0) events.push({ type: 'fell', unit: foe, by: 'dog' });
    }
  } else {
    dog.stance = 'move';
    walkToward(map, dog, besideHex(map, dog, foe, boat), dt, boat);
  }
}

function findFoeNear(state, anchor, dog, aggro = DOG_AGGRO, leash = DOG_LEASH) {
  return (state.units || [])
    .filter(u => u.faction === 'raider' && u.hp > 0
      && distance(u.q, u.r, anchor.q, anchor.r) <= leash
      && (distance(u.q, u.r, anchor.q, anchor.r) <= aggro || distance(u.q, u.r, dog.q, dog.r) <= 2))
    .sort((a, b) => distance(a.q, a.r, dog.q, dog.r) - distance(b.q, b.r, dog.q, dog.r))[0] || null;
}

function easeOffset(dog, targetX, targetY, dt) {
  const k = Math.min(1, dt * 8);
  dog.ox += (targetX - (dog.ox || 0)) * k;
  dog.oy += (targetY - (dog.oy || 0)) * k;
  if (Math.abs(dog.ox - targetX) < 0.05) dog.ox = targetX;
  if (Math.abs(dog.oy - targetY) < 0.05) dog.oy = targetY;
}

/**
 * Advance the dog by `dt` seconds.
 * @param ctx {{world, state, player, events:Array, boat?:boolean, rng?:Function}}
 */
export function updateDog(ctx, dt) {
  const { world, state, player, events, boat = false, rng = Math.random } = ctx;
  const { map } = world;
  const dog = ensureDog(map, state, player);
  if (!dog) return null;

  dog.cd = Math.max(0, (dog.cd || 0) - dt);

  if (dog.leg) {
    dog.leg.t += dt / dog.leg.duration;
    easeOffset(dog, 0, 0, dt);
    dog.stance = 'move';
    dog.wag = false;
    if (dog.leg.t >= 0.5) {
      dog.q = dog.leg.to.q;
      dog.r = dog.leg.to.r;
    }
    if (dog.leg.t < 1) return dog;
    dog.q = dog.leg.to.q;
    dog.r = dog.leg.to.r;
    dog.leg = null;
  }

  if (dog.mode === 'guard' && dog.guardAt) {
    const g = dog.guardAt;
    const foe = findFoeNear(state, g, dog);

    if (foe) {
      easeOffset(dog, 0, 0, dt);
      dog.wanderCd = Math.max(dog.wanderCd || 0, 4 + rng() * 3);
      engageFoe(map, state, dog, foe, events, dt, boat);
      return dog;
    }

    if (dog.q !== g.q || dog.r !== g.r) {
      dog.pace = null;
      easeOffset(dog, 0, 0, dt);
      dog.wag = false;
      dog.stance = 'move';
      walkToward(map, dog, g, dt, boat);
      return dog;
    }

    if (dog.pace) {
      dog.wag = false;
      advancePace(dog, dt);
      return dog;
    }

    dog.stance = 'sit';
    easeOffset(dog, 0, 0, dt);
    dog.wag = ((state.time * 1.1 + g.q * 0.7) % 4.5) < 1.3;
    dog.wanderCd -= dt;
    if (dog.wanderCd <= 0) {
      dog.wanderCd = 5.5 + rng() * 4.5;
      startPace(dog, rng);
    }
    return dog;
  }

  // Follow mode
  dog.pace = null;
  const foe = findFoeNear(state, player, dog, 2, 4);
  if (foe) {
    easeOffset(dog, 0, 0, dt);
    engageFoe(map, state, dog, foe, events, dt, boat);
    return dog;
  }

  const dPlayer = distance(dog.q, dog.r, player.q, player.r);
  const playerNext = player.leg?.to;
  const movingAway = player.moving && playerNext && distance(dog.q, dog.r, playerNext.q, playerNext.r) > 1;

  if (dPlayer > 1 || movingAway) {
    easeOffset(dog, 0, 0, dt);
    dog.wag = false;
    dog.stance = 'move';
    const goal = player.moving ? { q: player.q, r: player.r } : besideHex(map, dog, player, boat);
    walkToward(map, dog, goal, dt, boat);
    return dog;
  }

  // Stopped near player: wander within 1 hex of player
  dog.stance = 'idle';
  dog.wag = ((state.time * 0.9) % 5.0) < 1.5;
  if (dog.q === player.q && dog.r === player.r) {
    easeOffset(dog, -(dog.facing || 1) * 7, 3, dt);
  } else {
    easeOffset(dog, 0, 0, dt);
  }

  if (!player.moving) {
    dog.wanderCd -= dt;
    if (dog.wanderCd <= 0) {
      dog.wanderCd = 2.5 + rng() * 3.0;
      wanderNearPlayer(map, dog, player, boat, rng);
    }
  }
  return dog;
}
