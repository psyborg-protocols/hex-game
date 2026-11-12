// raiders.js
// The war bands across the river, and everyone else who walks the map: raiders,
// the guards at their camps, and the militia a rally banner calls up.
//
// The rhythm is the strategic heart of the game. Raids come every day or two
// from whichever camps are still standing, with a warning first — longer if you
// have a watchtower — and they go for what you have built. Walls make them hack
// through or go round, watchtowers shoot them, a shrine puts everything near it
// off limits. Burning the camps is the only way to make it stop, and the camps
// are across the water.
//
// Units are plain objects kept on `state.units`, so a save in the middle of a
// raid comes back in the middle of a raid. Everything here reports what happened
// as a list of events for main.js to show; nothing here touches the DOM.

import { neighbors, distance } from '../world/hexgrid.js';
import { isWater } from '../world/tileset.js';
import { findPath } from '../world/pathfinding.js';
import { clash } from './combat.js';
import { DAY_LENGTH, dayOf, itemName } from './state.js';
import { destroyStructure } from './actions.js';
import { villageKey } from './economy.js';
import { addItem, countItem } from './inventory.js';
import { defenseDice } from './gear.js';

export const KINDS = {
  // Slower than you on purpose: you can always outrun a war band, and you can
  // watch one coming across the map and decide what to do about it.
  raider:  { name: 'Raider',  hp: 4,  atk: 2, def: 1, speed: 1.15, cd: 1.6, gold: [2, 4] },
  brute:   { name: 'Brute',   hp: 7,  atk: 3, def: 2, speed: 0.95, cd: 1.8, gold: [5, 8] },
  warlord: { name: 'Warlord', hp: 14, atk: 4, def: 3, speed: 1.0, cd: 1.7, gold: [30, 30] },
  militia: { name: 'Militia', hp: 7,  atk: 2, def: 2, speed: 2.4, cd: 1.5, gold: [0, 0] },
};

/** The first raid comes partway into the second day. */
export const FIRST_RAID_AT = DAY_LENGTH * 1.55;
/** Seconds of warning before a raid sets out; a watchtower doubles it. */
export const WARNING = 35;

const AGGRO = 2;           // raiders turn on you this close
const GUARD_AGGRO = 3;
const GUARD_LEASH = 6;
const PILLAGE_SECONDS = 18;
const TOWER_RANGE = 3;
const TOWER_EVERY = 2.2;
const SHRINE_RADIUS = 2;

let nextId = 1;

export function makeUnit(kind, faction, at, extra = {}) {
  const k = KINDS[kind];
  return {
    id: nextId++, kind, faction,
    q: at.q, r: at.r, hp: k.hp, maxHp: k.hp,
    path: [], leg: null, cd: 0.5 + Math.random(), facing: 1,
    mode: 'raid', target: null, home: null, carry: [], repath: 0, pillage: 0,
    ...extra,
  };
}

const key = (q, r) => `${q},${r}`;
const alive = u => u.hp > 0;
export const hostiles = state => (state.units || []).filter(u => u.faction === 'raider' && alive(u));

/** Camps not yet burned. */
export function campsLeft(map) {
  const out = [];
  for (const col of map) if (col.feature?.type === 'camp' && !col.feature.burned) out.push(col);
  return out;
}

export function allCamps(map) {
  const out = [];
  for (const col of map) if (col.feature?.type === 'camp') out.push(col);
  return out;
}

/** Raiders still standing guard at a camp. */
export function guardsAt(state, camp) {
  return (state.units || []).filter(u => alive(u) && u.faction === 'raider'
    && u.mode === 'guard' && u.home && u.home.q === camp.q && u.home.r === camp.r).length;
}

/** Open ground around a hex to stand units on. */
function standingRoom(map, at, n, taken = new Set()) {
  const out = [];
  const seen = new Set([key(at.q, at.r)]);
  const queue = [at];
  while (queue.length && out.length < n) {
    const cur = queue.shift();
    for (const nb of neighbors(cur.q, cur.r)) {
      const k = key(nb.q, nb.r);
      if (seen.has(k)) continue;
      seen.add(k);
      const col = map.get(nb.q, nb.r);
      if (!col || isWater(col.terrain)) continue;
      queue.push(nb);
      if (!taken.has(k) && !col.feature?.wall) { out.push({ q: nb.q, r: nb.r }); taken.add(k); }
      if (out.length >= n) break;
    }
  }
  return out;
}

/** Stand the guards at every camp. Called once, when a world starts. */
export function garrisonCamps(map, state) {
  state.units ||= [];
  for (const camp of campsLeft(map)) {
    if (guardsAt(state, camp)) continue;
    const roster = camp.feature.boss ? ['warlord', 'brute', 'brute', 'raider'] : ['raider', 'raider', 'brute'];
    const spots = standingRoom(map, camp, roster.length);
    roster.forEach((kind, i) => {
      const at = spots[i] || camp;
      state.units.push(makeUnit(kind, 'raider', at, { mode: 'guard', home: { q: camp.q, r: camp.r } }));
    });
  }
}

// ---------------------------------------------------------------- raids

export function ensureRaidState(state) {
  state.raid ||= { nextAt: FIRST_RAID_AT, warned: false, count: 0, from: null, target: null };
  return state.raid;
}

/** How big the next band is, by the day. */
export function raidRoster(day) {
  const n = Math.min(6, 1 + Math.floor(day / 2.5));
  const roster = Array.from({ length: n }, () => 'raider');
  if (day >= 6) roster[0] = 'brute';
  if (day >= 10) roster[1] = 'brute';
  return roster;
}

/** What a band goes for: something you built, far from any shrine, else a village. */
function chooseTarget(map, state, from) {
  const shrines = state.built.filter(b => b.item === 'shrine');
  const sheltered = b => shrines.some(s => distance(s.q, s.r, b.q, b.r) <= SHRINE_RADIUS);
  const worth = { hut: 5, field: 4, workbench: 3, forge: 3, hearth: 3, watchtower: 2, palisade: 1, stone_wall: 1 };
  const choices = state.built
    .filter(b => worth[b.item] && !sheltered(b))
    .map(b => ({ b, score: worth[b.item] * 10 - distance(b.q, b.r, from.q, from.r) * 0.3 + Math.random() * 6 }))
    .sort((a, b) => b.score - a.score);
  if (choices.length) return { kind: 'structure', q: choices[0].b.q, r: choices[0].b.r };
  // Nothing of yours to burn: they go for the nearest village instead.
  let best = null;
  for (const col of map) {
    if (col.feature?.type !== 'village') continue;
    const d = distance(col.q, col.r, from.q, from.r);
    if (!best || d < best.d) best = { col, d };
  }
  return best ? { kind: 'village', q: best.col.q, r: best.col.r } : null;
}

/** Tick the raid clock. Emits warn / raid events. */
function tickSchedule(world, state, events) {
  const raid = ensureRaidState(state);
  const camps = campsLeft(world.map).filter(c => !c.feature.boss);
  const sources = camps.length ? camps : campsLeft(world.map);
  if (!sources.length) return;

  const tower = state.built.some(b => b.item === 'watchtower');
  const lead = WARNING * (tower ? 2 : 1);

  if (!raid.warned && state.time >= raid.nextAt - lead) {
    raid.warned = true;
    const from = sources[Math.floor(Math.random() * sources.length)];
    raid.from = { q: from.q, r: from.r, name: from.feature.name };
    raid.target = chooseTarget(world.map, state, from);
    events.push({ type: 'warn', from: raid.from, target: raid.target, seconds: Math.round(raid.nextAt - state.time), tower });
  }

  if (raid.warned && state.time >= raid.nextAt) {
    const from = world.map.get(raid.from.q, raid.from.r);
    raid.warned = false;
    raid.count++;
    raid.nextAt = state.time + DAY_LENGTH * (1.3 + Math.random() * 0.5);
    if (!from || from.feature?.burned) return;
    // Recheck the target: what you had when warned may be gone or sheltered now.
    const target = chooseTarget(world.map, state, from) || raid.target;
    if (!target) return;
    const roster = raidRoster(dayOf(state).day);
    const spots = standingRoom(world.map, from, roster.length,
      new Set((state.units || []).map(u => key(u.q, u.r))));
    roster.forEach((kind, i) => {
      const at = spots[i] || from;
      state.units.push(makeUnit(kind, 'raider', at, { mode: 'raid', target: { ...target }, home: { q: from.q, r: from.r } }));
    });
    events.push({ type: 'raid', from: raid.from, target, size: roster.length });
  }
}

// ------------------------------------------------------------- movement

function pathFor(map, u, goal) {
  // Militia walk by the raiders' looser rules too: they are locals, and know
  // the fords and the goat paths you do not.
  let p = findPath(map, u, goal, { raider: true, limit: 2500 });
  if (!p && u.faction === 'raider') p = findPath(map, u, goal, { raider: true, breakWalls: true, limit: 2500 });
  return p;
}

/** The free hex next to `t` nearest `u`, to walk to when you mean to stand by it. */
function besideHex(map, u, t) {
  let best = null;
  for (const n of neighbors(t.q, t.r)) {
    const col = map.get(n.q, n.r);
    if (!col || isWater(col.terrain) || col.feature?.wall) continue;
    const d = distance(n.q, n.r, u.q, u.r);
    if (!best || d < best.d) best = { q: n.q, r: n.r, d };
  }
  return best || { q: t.q, r: t.r };
}

function walkToward(map, u, goal, dt) {
  u.repath -= dt;
  const end = u.path[u.path.length - 1];
  if (!u.path.length || u.repath <= 0 || !end || end.q !== goal.q || end.r !== goal.r) {
    const p = pathFor(map, u, goal);
    u.path = p ? p.slice(1) : [];
    u.repath = 2 + Math.random();
  }
  const next = u.path[0];
  if (!next) return;
  const col = map.get(next.q, next.r);
  // A wall in the way is hacked at, not walked through.
  if (col?.feature?.wall && u.faction === 'raider') {
    u.bashing = { q: next.q, r: next.r };
    return;
  }
  u.path.shift();
  const slow = isWater(col?.terrain) ? 2.2 : 1;
  if (next.q !== u.q) u.facing = next.q > u.q ? 1 : -1;
  u.leg = { from: { q: u.q, r: u.r }, to: next, t: 0, duration: slow / KINDS[u.kind].speed };
}

function advanceLeg(u, dt) {
  if (!u.leg) return;
  u.leg.t += dt / u.leg.duration;
  if (u.leg.t >= 0.5) { u.q = u.leg.to.q; u.r = u.leg.to.r; }
  if (u.leg.t >= 1) u.leg = null;
}

// ---------------------------------------------------------------- the tick

/**
 * Advance every unit, the towers and the raid clock by `dt` seconds.
 * @param ctx {{world, state, player:{q,r,moving}, events:Array, rng}}
 */
export function updateUnits(ctx, dt) {
  const { world, state, player, events } = ctx;
  const { map } = world;
  state.units ||= [];

  tickSchedule(world, state, events);

  const units = state.units;
  const playerHere = { q: player.q, r: player.r };
  const enemiesOf = u => units.filter(o => alive(o) && o.faction !== u.faction);

  for (const u of units) {
    if (!alive(u)) continue;
    u.cd -= dt;
    u.bashing = null;
    advanceLeg(u, dt);
    if (u.leg) continue;

    const k = KINDS[u.kind];
    const dPlayer = distance(u.q, u.r, playerHere.q, playerHere.r);

    // --- who to fight -----------------------------------------------------
    let foe = null;
    if (u.faction === 'raider') {
      const allies = enemiesOf(u);
      const near = allies.map(a => ({ a, d: distance(a.q, a.r, u.q, u.r) })).sort((x, y) => x.d - y.d)[0];
      const range = u.mode === 'guard' ? GUARD_AGGRO : AGGRO;
      if (!ctx.playerDown && dPlayer <= range && !isWater(map.get(player.q, player.r)?.terrain)) foe = { player: true, q: playerHere.q, r: playerHere.r, d: dPlayer };
      if (near && near.d <= range && (!foe || near.d < foe.d)) foe = { unit: near.a, q: near.a.q, r: near.a.r, d: near.d };
      if (u.mode === 'guard' && u.home && distance(u.q, u.r, u.home.q, u.home.r) > GUARD_LEASH) foe = null;
    } else {
      const near = enemiesOf(u).map(a => ({ a, d: distance(a.q, a.r, u.q, u.r) })).sort((x, y) => x.d - y.d)[0];
      if (near && near.d <= 4) foe = { unit: near.a, q: near.a.q, r: near.a.r, d: near.d };
    }

    if (foe) {
      if (foe.d <= 1) {
        if (u.cd <= 0) {
          u.cd = k.cd;
          if (foe.player) {
            const roll = clash(k.atk, defenseDice(state));
            state.hp -= roll.damage;
            events.push({ type: 'clash', who: u, target: 'player', roll, at: playerHere });
          } else {
            const roll = clash(k.atk, KINDS[foe.unit.kind].def);
            foe.unit.hp -= roll.damage;
            events.push({ type: 'clash', who: u, target: foe.unit, roll, at: { q: foe.unit.q, r: foe.unit.r } });
            if (!alive(foe.unit)) events.push({ type: 'fell', unit: foe.unit, by: u });
          }
        }
      } else {
        walkToward(map, u, besideHex(map, u, foe), dt);
      }
      continue;
    }

    // --- nothing to fight: about their business ---------------------------
    if (u.faction !== 'raider') {
      // Militia keep near you.
      if (dPlayer > 2) walkToward(map, u, besideHex(map, u, playerHere), dt);
      continue;
    }

    if (u.mode === 'guard') {
      if (u.home && distance(u.q, u.r, u.home.q, u.home.r) > 1) walkToward(map, u, besideHex(map, u, u.home), dt);
      continue;
    }

    if (u.mode === 'return') {
      // Home, or nowhere left to go home to: either way they leave the board.
      if (!u.home || distance(u.q, u.r, u.home.q, u.home.r) <= 1) { u.hp = 0; u.gone = true; continue; }
      walkToward(map, u, besideHex(map, u, u.home), dt);
      continue;
    }

    // mode 'raid'
    const t = u.target;
    if (!t) { u.mode = 'return'; continue; }
    const tcol = map.get(t.q, t.r);
    const stillThere = t.kind === 'village' ? tcol?.feature?.type === 'village'
      : (tcol?.feature?.type === 'structure' || tcol?.feature?.type === 'field');
    if (!stillThere) { retarget(map, state, u); continue; }

    if (distance(u.q, u.r, t.q, t.r) <= 1) {
      if (t.kind === 'village') {
        u.pillage += dt;
        if (u.pillage >= PILLAGE_SECONDS) {
          state.raidedUntil ||= {};
          const k2 = villageKey(t.q, t.r);
          if (!(state.raidedUntil[k2] > state.time)) {
            state.raidedUntil[k2] = (dayOf(state).day) * DAY_LENGTH;
            events.push({ type: 'villageRaided', name: tcol.feature.name, q: t.q, r: t.r });
          }
          u.mode = 'return';
        }
      } else if (u.cd <= 0) {
        u.cd = k.cd;
        tcol.feature.hp = (tcol.feature.hp ?? 4) - 1;
        events.push({ type: 'ransack', who: u, q: t.q, r: t.r });
        if (tcol.feature.hp <= 0) {
          const fallen = destroyStructure(world, state, tcol);
          if (fallen) {
            u.carry.push(...fallen.loot);
            events.push({ type: 'destroyed', item: fallen.item, q: t.q, r: t.r, loot: fallen.loot });
          }
          for (const o of units) if (o !== u && o.target && o.target.q === t.q && o.target.r === t.r) retarget(map, state, o);
          retarget(map, state, u);
        }
      }
      continue;
    }

    if (u.bashing === null) walkToward(map, u, besideHex(map, u, t), dt);
    if (u.bashing && u.cd <= 0) {
      const wall = map.get(u.bashing.q, u.bashing.r);
      u.cd = k.cd;
      wall.feature.hp -= 1;
      events.push({ type: 'ransack', who: u, q: wall.q, r: wall.r });
      if (wall.feature.hp <= 0) {
        const fallen = destroyStructure(world, state, wall);
        events.push({ type: 'destroyed', item: fallen?.item || 'palisade', q: wall.q, r: wall.r, loot: [] });
        u.path = [];
      }
    }
  }

  towers(ctx, dt);

  // The dead and the departed leave the board.
  state.units = units.filter(u => alive(u));
}

/** After a target falls: the next thing of yours nearby, or home with the loot. */
function retarget(map, state, u) {
  const shrines = state.built.filter(b => b.item === 'shrine');
  const next = state.built
    .filter(b => !['ladder', 'bridge', 'shrine'].includes(b.item)
      && !shrines.some(s => distance(s.q, s.r, b.q, b.r) <= SHRINE_RADIUS)
      && distance(b.q, b.r, u.q, u.r) <= 5)
    .sort((a, b) => distance(a.q, a.r, u.q, u.r) - distance(b.q, b.r, u.q, u.r))[0];
  if (next && u.carry.length < 3) { u.target = { kind: 'structure', q: next.q, r: next.r }; u.path = []; }
  else { u.mode = 'return'; u.target = null; u.path = []; }
}

/** Watchtowers loose an arrow at the nearest raider in range. */
function towers(ctx, dt) {
  const { state, events } = ctx;
  state.towerClock = (state.towerClock || 0) + dt;
  if (state.towerClock < TOWER_EVERY) return;
  state.towerClock = 0;
  for (const b of state.built) {
    if (b.item !== 'watchtower') continue;
    const foe = hostiles(state)
      .map(u => ({ u, d: distance(u.q, u.r, b.q, b.r) }))
      .filter(x => x.d <= TOWER_RANGE)
      .sort((a, c) => a.d - c.d)[0];
    if (!foe) continue;
    const roll = clash(2, KINDS[foe.u.kind].def);
    foe.u.hp -= roll.damage;
    events.push({ type: 'arrow', from: b, who: foe.u, roll });
    if (!alive(foe.u)) events.push({ type: 'fell', unit: foe.u, by: 'tower' });
  }
}

// ------------------------------------------------------------- the player

/** You swing at a unit. Returns the roll. */
export function strike(state, unit, attackDice, rng = null) {
  const roll = clash(attackDice, KINDS[unit.kind].def, rng);
  unit.hp -= roll.damage;
  return roll;
}

/** What a fallen raider leaves you: gold, whatever it stole, sometimes more. */
export function spoils(state, unit) {
  const k = KINDS[unit.kind];
  const [lo, hi] = k.gold;
  const gold = lo + Math.floor(Math.random() * (hi - lo + 1));
  state.gold += gold;
  const items = [];
  for (const s of unit.carry || []) {
    const got = addItem(state, s.id, s.qty);
    if (got) items.push({ id: s.id, qty: got });
  }
  if (unit.kind === 'brute' && Math.random() < 0.5 && addItem(state, 'ingot', 1)) items.push({ id: 'ingot', qty: 1 });
  if (unit.kind === 'raider' && Math.random() < 0.4 && addItem(state, 'hide', 1)) items.push({ id: 'hide', qty: 1 });
  if (unit.kind === 'warlord') for (const [id, n] of [['ingot', 3], ['iron_mail', 1]]) if (addItem(state, id, n)) items.push({ id, qty: n });
  state.stats.kills = (state.stats.kills || 0) + 1;
  return { gold, items, text: [`${gold} gold`, ...items.map(i => `${i.qty} ${itemName(i.id)}`)].join(', ') };
}

/** Raise the militia: one fighter per village that trusts you, up to four. */
export function rally(state, player, map, trustedCount) {
  const n = Math.min(4, trustedCount);
  const spots = standingRoom(map, player, n, new Set((state.units || []).map(u => key(u.q, u.r))));
  for (const at of spots) state.units.push(makeUnit('militia', 'ally', at, { mode: 'follow' }));
  return spots.length;
}

/** Torch a camp whose guards are all down. */
export function burnCamp(state, camp) {
  camp.feature.burned = true;
  state.stats.campsBurned = (state.stats.campsBurned || 0) + 1;
  // Raiders from it who are out on a raid have nowhere to go home to.
  for (const u of state.units || []) {
    if (u.home && u.home.q === camp.q && u.home.r === camp.r && u.mode === 'return') u.home = null;
  }
  const gold = camp.feature.boss ? 40 : 15;
  state.gold += gold;
  return { gold };
}

export { countItem };
