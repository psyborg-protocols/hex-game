// shared.js
// Which parts of the game are one world everyone shares, and which belong to one
// player. Single-player keeps it all in one `state`, as it always has; in a room
// the host's copy of the shared parts is the truth, and every browser keeps the
// rest to itself (see src/net/).
//
// The map's columns are shared too, but they live on the WorldMap, not here.

/** `state` keys that are the shared world, not one player's. */
export const SHARED_KEYS = [
  'built',        // every structure, with its owner
  'units',        // raiders, guards, militia
  'raid',         // this moon's raid
  'raidedUntil',  // villages shuttered after a raid
  'towerClock',
  'unitSeq',      // the next unit id, so ids never collide between browsers
  'wildDogs',
  'wildDogsSeeded',
  'taken',        // depleted resource nodes ("q,r:harvest" -> turn)
  'picked',
  'clock',        // the world clock in a room (see worldClock)
];

/** A deep copy of the shared slice of `state`. */
export function sharedSlice(state) {
  const out = {};
  for (const k of SHARED_KEYS) if (state[k] !== undefined) out[k] = structuredClone(state[k]);
  return out;
}

/** Copy a shared slice (or part of one) into `state`. */
export function applyShared(state, slice) {
  for (const k of SHARED_KEYS) if (k in slice) state[k] = structuredClone(slice[k]);
  return state;
}

/** Keys that only mean something while you are in a room. */
const ROOM_KEYS = ['room', 'clock', 'waitingForDawn'];

/** A deep copy of one player's own progress: everything that is not the shared world. */
export function personalSlice(state) {
  const out = {};
  for (const [k, v] of Object.entries(state)) {
    if (SHARED_KEYS.includes(k) || ROOM_KEYS.includes(k)) continue;
    out[k] = structuredClone(v);
  }
  return out;
}

/** Who you are, for owning structures: your id in a room, or 'local' alone. */
export const ownerOf = state => state?.room?.playerId || 'local';

/** In Competitive, only what you built yourself counts for your goals and bonuses. */
export const isCompetitive = state => state?.room?.mode === 'competitive';

/** The owner filter a goal or bonus should use: yours in Competitive, anyone's otherwise. */
export const goalOwner = state => (isCompetitive(state) ? ownerOf(state) : undefined);

/**
 * The clock the world keeps. Alone, it is your own turn. In a room the host sets
 * `state.clock` from everyone's turns; a guest's copy follows the host's.
 */
export const worldClock = state => (state?.clock != null ? state.clock : (state?.turn || 0));
