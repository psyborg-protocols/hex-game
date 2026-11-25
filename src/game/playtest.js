// playtest.js
// Test pieces for the map editor, and the game a play test starts from.
//
// The editor paints terrain; with these you can also drop in what a test needs:
// where the Wanderer starts, raiders and the rest, buildings, villages, camps,
// trees, ore, loot. "Play test" hands the map and the pieces to the game
// (index.html?playtest=1) through localStorage, and the game starts on them.
//
// Things that live on the map (buildings, fields, villages, camps, trees, ore)
// are column features, exactly as the game keeps them, so they save with the
// map. Things that live in the game's state (units, wild dogs, loot) are kept in
// a `pieces` list beside it: { units: [{kind, q, r}], dogs: [{q, r, hostile}],
// drops: [{q, r, gold, items}] }.

import { STRUCTURE_HP, itemName, ITEMS, recordBuilt, createState, moonOf, TURNS_PER_DAY } from './state.js';
import { CROPS, cropFrame, isWater } from '../world/tileset.js';
import { makeUnit, garrisonCamps } from './raiders.js';
import { makeWildDog } from './wild_dogs.js';
import { addDrop } from './drops.js';
import { WorldMap } from '../world/mapformat.js';
import { distance } from '../world/hexgrid.js';

export const PLAYTEST_KEY = 'hexquest.playtest';

const STRUCTURES = ['hut', 'hearth', 'workbench', 'forge', 'watchtower', 'palisade', 'stone_wall', 'shrine'];
const VILLAGE_KINDS = ['farmers', 'woodcutters', 'masons', 'fishers', 'herbalists', 'smiths'];

/** Everything the editor can drop in, by group. */
export const PIECES = [
  { group: 'Wanderer', id: 'player', name: 'Wanderer starts here' },

  { group: 'Units', id: 'raider', name: 'Raider', unit: 'raider', note: 'stands guard, fights you up close' },
  { group: 'Units', id: 'brute', name: 'Brute', unit: 'brute' },
  { group: 'Units', id: 'warlord', name: 'Warlord', unit: 'warlord' },
  { group: 'Units', id: 'raiding', name: 'Raider, raiding', unit: 'raider', raiding: true, note: 'goes for your buildings' },
  { group: 'Units', id: 'militia', name: 'Militia', unit: 'militia', note: 'follows you' },
  { group: 'Units', id: 'wild_dog', name: 'Wild dog', dog: { hostile: false } },
  { group: 'Units', id: 'wild_dog_hostile', name: 'Wild dog, snarling', dog: { hostile: true } },

  ...STRUCTURES.map(item => ({ group: 'Buildings', id: item, name: itemName(item), structure: item })),
  { group: 'Buildings', id: 'field', name: 'Field', field: true },

  { group: 'Places', id: 'village', name: 'Village', village: true, note: 'each one a different trade' },
  { group: 'Places', id: 'camp', name: 'Raider camp', camp: { boss: false }, note: 'comes with its guards' },
  { group: 'Places', id: 'hold', name: "Warlord's hold", camp: { boss: true } },
  { group: 'Places', id: 'oak', name: 'Oak trees', trees: 'oak' },
  { group: 'Places', id: 'pine', name: 'Pine trees', trees: 'pine' },
  { group: 'Places', id: 'ore', name: 'Ore vein', ore: true },
  { group: 'Places', id: 'loot', name: 'Loot pile', loot: true },

  { group: 'Remove', id: 'remove', name: 'Remove a piece', remove: true },
];

export const pieceById = id => PIECES.find(p => p.id === id) || null;

export const emptyPieces = () => ({ units: [], dogs: [], drops: [] });

const at = (list, q, r) => list.findIndex(x => x.q === q && x.r === r);

/** Take whatever piece is on (q, r) off it: a unit, dog or loot first, else the feature. */
export function removePiece(map, pieces, q, r) {
  for (const key of ['units', 'dogs', 'drops']) {
    const i = at(pieces[key], q, r);
    if (i >= 0) { pieces[key].splice(i, 1); return true; }
  }
  const col = map.get(q, r);
  if (!col?.feature) return false;
  const was = col.feature.type;
  delete col.feature;
  // A field, village, camp or wood leaves plain ground behind.
  if (was === 'field' || was === 'village' || was === 'camp' || was === 'trees') map.place(q, r, 'grass', col.h);
  return true;
}

/**
 * Drop piece `id` on (q, r). Returns false when it cannot go there (no ground,
 * or water). One unit, dog or loot pile per hex; a feature replaces the last.
 */
export function placePiece(map, pieces, id, q, r) {
  const p = pieceById(id);
  const col = map.get(q, r);
  if (!p || !col) return false;
  if (p.remove) return removePiece(map, pieces, q, r);
  if (isWater(col.terrain) && !p.loot) return false;
  const h = col.h;

  if (p.id === 'player') { map.spawn = { q, r }; return true; }
  if (p.unit) {
    const i = at(pieces.units, q, r);
    const unit = { kind: p.unit, q, r, ...(p.raiding ? { raiding: true } : {}) };
    if (i >= 0) pieces.units[i] = unit; else pieces.units.push(unit);
    return true;
  }
  if (p.dog) {
    const i = at(pieces.dogs, q, r);
    const dog = { q, r, hostile: p.dog.hostile };
    if (i >= 0) pieces.dogs[i] = dog; else pieces.dogs.push(dog);
    return true;
  }
  if (p.loot) {
    const i = at(pieces.drops, q, r);
    const pile = { q, r, gold: 10, items: [{ id: 'hide', qty: 1 }, { id: 'log', qty: 2 }] };
    if (i >= 0) pieces.drops[i] = pile; else pieces.drops.push(pile);
    return true;
  }

  // Map features, as the game and the world generator write them.
  if (p.structure) {
    const hp = STRUCTURE_HP[p.structure] || 8;
    col.feature = { type: 'structure', item: p.structure, name: itemName(p.structure), hp, maxHp: hp, ...(ITEMS[p.structure]?.wall ? { wall: true } : {}) };
  } else if (p.field) {
    const crops = Object.keys(CROPS);
    const crop = crops[Math.abs(q * 7 + r * 13) % crops.length];
    map.place(q, r, 'farm', h, { sprite: CROPS[crop].sheet, frame: cropFrame(0, 0) });
    map.get(q, r).feature = {
      type: 'field', kind: 'grain', crop, variant: 0, ripe: false, plantedAt: 0,
      hp: STRUCTURE_HP.field, maxHp: STRUCTURE_HP.field,
    };
  } else if (p.village) {
    const used = [...map].filter(c => c.feature?.type === 'village').map(c => c.feature.kind);
    const kind = VILLAGE_KINDS.find(k => !used.includes(k)) || VILLAGE_KINDS[used.length % VILLAGE_KINDS.length];
    map.place(q, r, 'meadow', h);
    map.get(q, r).feature = { type: 'village', name: `${kind[0].toUpperCase()}${kind.slice(1)}' Rest`, kind };
  } else if (p.camp) {
    map.place(q, r, 'steppes', h);
    map.get(q, r).feature = { type: 'camp', boss: p.camp.boss, name: p.camp.boss ? "The Warlord's Hold" : 'Test Camp', burned: false };
  } else if (p.trees) {
    map.place(q, r, p.trees === 'pine' ? 'pine_floor' : 'forest_floor', h);
    map.get(q, r).feature = { type: 'trees', kind: p.trees, remaining: 3 };
  } else if (p.ore) {
    map.place(q, r, 'stony', h);
    map.get(q, r).feature = { type: 'ore', remaining: 8, known: true };
  }
  return true;
}

/** When the play test starts. */
export const START_TIMES = {
  morning: { name: 'Morning', turn: () => 0 },
  dusk: { name: 'Nightfall', turn: () => TURNS_PER_DAY / 2 },
  omens: { name: 'Raid day, omens', turn: () => moonOf({ turn: 0 }).omensAt },
  raid: { name: 'Raid night', turn: () => moonOf({ turn: 0 }).duskAt },
};

/** What the editor hands the game. */
export function playtestData(map, pieces, setup = {}) {
  return { map: map.toJSON(), pieces, setup };
}

/**
 * The game a play test starts from: the editor's map, with its pieces in it.
 * Returns what a loaded save does: { map, state, player, seed }.
 */
export function buildPlaytest(data) {
  const map = WorldMap.fromJSON(data.map);
  const pieces = { ...emptyPieces(), ...(data.pieces || {}) };
  const setup = data.setup || {};
  const state = createState({ gold: setup.gold ?? 10, free: !!setup.free });
  state.turn = START_TIMES[setup.start]?.turn() || 0;
  state.units = [];
  state.wildDogs = [];
  // Only the dogs you put down: none are scattered at random.
  state.wildDogsSeeded = true;

  // What stands on the map was built by you.
  for (const col of map) {
    const f = col.feature;
    if (f?.type === 'structure' && f.item) recordBuilt(state, f.item, col.q, col.r);
    else if (f?.type === 'field') { recordBuilt(state, 'field', col.q, col.r); f.plantedAt = state.turn; }
  }

  // Camps come with their guards, as in a generated world.
  garrisonCamps(map, state);

  const camps = [...map].filter(c => c.feature?.type === 'camp' && !c.feature.burned);
  const nearest = (list, u) => list.slice().sort((a, b) => distance(a.q, a.r, u.q, u.r) - distance(b.q, b.r, u.q, u.r))[0] || null;
  for (const u of pieces.units) {
    if (u.kind === 'militia') {
      state.units.push(makeUnit('militia', 'ally', u, { mode: 'follow', owner: 'local' }, state));
      continue;
    }
    if (u.raiding) {
      // Out raiding: for the nearest thing of yours (or a village), home to the nearest camp.
      const goals = [...state.built.map(b => ({ kind: 'structure', q: b.q, r: b.r })),
        ...[...map].filter(c => c.feature?.type === 'village').map(c => ({ kind: 'village', q: c.q, r: c.r }))];
      const target = nearest(goals, u);
      const home = nearest(camps, u);
      state.units.push(makeUnit(u.kind, 'raider', u, {
        mode: target ? 'raid' : 'guard', target, home: home ? { q: home.q, r: home.r } : { q: u.q, r: u.r },
      }, state));
      continue;
    }
    // Standing guard where you put them: they come for you when you come close.
    state.units.push(makeUnit(u.kind, 'raider', u, { mode: 'guard', home: { q: u.q, r: u.r } }, state));
  }

  for (const d of pieces.dogs) state.wildDogs.push(makeWildDog(state, d, 'test', !!d.hostile));
  for (const d of pieces.drops) addDrop(state, d.q, d.r, d);

  const spawn = map.get(map.spawn?.q, map.spawn?.r) ? map.spawn : [...map][0];
  return { map, state, player: { q: spawn.q, r: spawn.r }, seed: `playtest:${Date.now()}` };
}
