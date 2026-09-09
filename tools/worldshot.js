// worldshot.js — render a generated world to PNG, so worldgen changes can be
// looked at rather than only counted. Uses the same lattice and painter's order
// as the game.
// Usage: node tools/worldshot.js out.png [seed] [scale] [radius]
import { readFileSync } from 'node:fs';
import { generateWorld } from '../src/world/worldgen.js';
import { makeResolvers } from '../src/world/tileset.js';
import { renderMap } from './newtiles_map.js';

const out = process.argv[2] || 'world.png';
const seed = process.argv[3] ?? 42;
const scale = Number(process.argv[4]) || 3;
const radius = Number(process.argv[5]) || 16;

const index = JSON.parse(readFileSync('new_tiles/index.json', 'utf8'));
const map = generateWorld({ seed: isNaN(Number(seed)) ? seed : Number(seed), radius, resolvers: makeResolvers(index) });

let minQ = Infinity, maxQ = -Infinity, minR = Infinity, maxR = -Infinity;
for (const c of map) {
  minQ = Math.min(minQ, c.q); maxQ = Math.max(maxQ, c.q);
  minR = Math.min(minR, c.r); maxR = Math.max(maxR, c.r);
}
const cols = maxQ - minQ + 1, rows = maxR - minR + 1;
const cell = (c, r) => {
  const col = map.get(c + minQ, r + minR);
  return col ? [col.sprite, col.frame] : null;
};
const res = renderMap(cell, cols, rows, out, scale);
const counts = {};
for (const c of map) counts[c.terrain] = (counts[c.terrain] || 0) + 1;
console.log(`${out} ${res.W}x${res.H}  seed=${seed}`);
console.log(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join('  '));
