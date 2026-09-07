// save.js
// Keeping a game.
//
// The world is saved whole rather than re-generated from its seed, because it is
// no longer the world the seed produced: woods have been felled to bare floor,
// cliffs mined down, veins emptied, structures put up. The seed is kept anyway,
// so a save says which world it came from.

import { WorldMap } from '../world/mapformat.js';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'hexworld.save';

export function serialize(world, state, player) {
  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    seed: world.seed,
    // Columns only: `tiles` exists purely so editor.html can open a map, and it
    // roughly doubles the size of a save for nothing.
    map: { ...world.map.toJSON(), tiles: undefined },
    state,
    player: { q: player.q, r: player.r },
  };
}

export function deserialize(data) {
  if (!data || data.version !== SAVE_VERSION) {
    throw new Error(`unreadable save (version ${data?.version ?? 'none'})`);
  }
  const map = WorldMap.fromJSON(data.map);
  return { map, state: data.state, player: data.player, seed: data.seed };
}

// -------------------------------------------------------------- local slot

export function saveLocal(world, state, player) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(serialize(world, state, player)));
    return true;
  } catch (err) {
    // A full or blocked store should not take the game down mid-play.
    console.warn('could not save', err);
    return false;
  }
}

export function loadLocal() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? deserialize(JSON.parse(raw)) : null;
  } catch (err) {
    console.warn('could not load', err);
    return null;
  }
}

/**
 * Put an already-parsed save — one read from a file — into the local slot, so an
 * import comes back up through exactly the same path a normal load takes.
 */
export function writeLocal(bundle) {
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    seed: bundle.seed,
    map: { ...bundle.map.toJSON(), tiles: undefined },
    state: bundle.state,
    player: bundle.player,
  }));
}

export function hasLocal() {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

export function clearLocal() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch { /* nothing to do */ }
}

/** When the local save was written, for the menu to show. */
export function localSavedAt() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw).savedAt : null;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------- files

export function downloadSave(world, state, player) {
  const blob = new Blob([JSON.stringify(serialize(world, state, player))],
    { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `hexworld-${world.seed}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function readSaveFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(deserialize(JSON.parse(reader.result)));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
