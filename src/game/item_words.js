// item_words.js
// What the Wanderer makes of a thing, when you point at it.
//
// One line of what it is, and at most the one use nearest to hand, in their
// own voice ("I could probably..."). Never where it came from: you are holding
// it. Never the numbers: the detail panel has those. Some lines change as you
// learn: a branch is kindling until you have lit a fire, and a handle after.
//
// Items not named here say their plain description from the data.

import { ITEMS } from './state.js';

const done = (s, key) => (s?.stats?.[key] || 0) > 0;
const made = (s, id) => (s?.stats?.made?.[id] || 0) > 0;

const WORDS = {
  branch: s => (done(s, 'firesLit')
    ? 'A dry branch. I could probably make a handle out of this...'
    : 'A dry branch. I could probably start a fire with this...'),
  flint: s => (done(s, 'firesLit') ? 'A sharp flintstone.' : 'A sharp flintstone. I could start a fire with this.'),
  reed: s => (made(s, 'cord')
    ? 'Reeds. I could probably weave a basket out of these...'
    : 'Reeds. I could probably twist these into cord...'),
  cord: s => (done(s, 'snares') ? 'Good strong cord.' : 'Cord. I could probably set a snare with this...'),
};

/** The line for an item, for this player. */
export function itemWords(state, id) {
  const say = WORDS[id];
  return say ? say(state) : (ITEMS[id]?.desc || '');
}
