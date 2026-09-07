// tiles.js — terrain hex tiles, 32x37, SWEETIE-16, same palette as the item icons.
//
// THE RULE THAT MATTERS
// Every bit of value contrast belongs to an OBJECT, never to the background.
// Scattered patches of a contrasting tone on a flat base is the definition of
// camouflage; contrast that describes a tuft, a boulder or a leaf is form. This
// matters doubly on SWEETIE-16, whose greens jump ~90 luminance between steps —
// there is no such thing as subtle area-mottling in this palette, so the light
// and dark tones are spent only on lit tops, shaded undersides and cast shadows.
//
// So each tile is built as:
//   1. a flat base tone over the whole hex — 80%+ of the tile stays this colour
//   2. sparse directional micro-texture: 1-3px strokes, standing up for grass,
//      lying flat for litter, angled for stone chips and needles. Direction is
//      what makes texture read as ground rather than as noise.
//   3. real features with form — a clump of blades with lit tips, a boulder with
//      a lit cap, a flower on a stem, a mushroom, a fallen leaf. Every feature
//      gets a contact shadow so it sits ON the ground instead of floating.
//   4. a 1px rim in the terrain's own shade tone, so the hex grid reads faintly
//
// Features are placed with H.scatter, whose spacing is measured across the wrap,
// so nothing clumps against its own wrapped copy at the border. Every pixel goes
// through H.px, which folds anything crossing the border back to where the
// neighbouring tile continues it.
//
// Repetition: one tile repeated always patterns. Each terrain ships several
// variants; pick one per hex from a positional hash.

import { H } from './hexcanvas.js';

// --- micro-texture ----------------------------------------------------------
// short strokes. dir 'v' stands them up (grass), 'h' lays them flat (litter),
// 'd' angles them, 'x' angles them either way (stone chips, pine needles).
const strokes = (h, pts, c, len = 2, dir = 'v') => {
  for (const [x, y] of pts) {
    const lean = dir === 'x' ? (h.rnd() < 0.5 ? 1 : -1) : 1;
    for (let i = 0; i < len; i++) {
      if (dir === 'v') h.px(x, y - i, c);
      else if (dir === 'h') h.px(x + i, y, c);
      else h.px(x + lean * i, y - i, c);
    }
  }
};

// --- features ---------------------------------------------------------------
// one blade of grass, leaning by `lean` per row
const blade = (h, x, y, len, lean, c) => {
  for (let i = 0; i < len; i++) h.px(x + Math.round(lean * i), y - i, c);
};
// a clump of grass: blades fanning out, lit at the tips, shadow on the ground
const clump = (h, x, y, tip, body, shade) => {
  h.px(x + 1, y + 1, shade); h.px(x + 2, y + 1, shade);
  blade(h, x, y, 3, -0.4, body);
  blade(h, x + 1, y, 4, 0, body);
  blade(h, x + 2, y, 3, 0.4, body);
  h.px(x - 1, y - 2, tip); h.px(x + 1, y - 3, tip); h.px(x + 3, y - 2, tip);
};
// a bigger, coarser tussock for dry country
const tussock = (h, x, y, tip, body, shade) => {
  h.rect(x + 1, y + 1, 3, 1, shade);
  blade(h, x, y, 4, -0.5, body);
  blade(h, x + 1, y, 5, -0.2, body);
  blade(h, x + 2, y, 5, 0.2, body);
  blade(h, x + 3, y, 4, 0.5, body);
  h.px(x - 2, y - 3, tip); h.px(x, y - 4, tip); h.px(x + 3, y - 4, tip); h.px(x + 5, y - 3, tip);
};
// a low shrub: rounded mass, lit top-left, shaded bottom-right, contact shadow
const bush = (h, x, y, tip, body, shade) => {
  h.rect(x + 1, y - 3, 3, 1, body);
  h.rect(x, y - 2, 5, 2, body);
  h.rect(x + 1, y, 3, 1, body);
  h.px(x + 1, y - 3, tip); h.px(x + 2, y - 3, tip); h.px(x, y - 2, tip);
  h.px(x + 4, y - 2, shade); h.px(x + 4, y - 1, shade); h.px(x + 3, y, shade);
  h.rect(x + 2, y + 1, 3, 1, shade);
};
// a small stone
const pebble = (h, x, y, hi, mid, shade) => {
  h.px(x + 1, y - 1, hi); h.px(x + 2, y - 1, hi);
  h.rect(x, y, 4, 1, mid);
  h.px(x + 3, y, shade); h.rect(x + 1, y + 1, 3, 1, shade);
};
// a boulder: lit cap, body, dark underside, cast shadow to the lower right
const boulder = (h, x, y, hi, mid, lo, shade) => {
  h.rect(x + 1, y - 3, 4, 1, hi);
  h.rect(x, y - 2, 6, 1, mid); h.px(x, y - 2, hi); h.px(x + 1, y - 2, hi);
  h.rect(x, y - 1, 6, 1, mid);
  h.rect(x + 1, y, 5, 1, lo);
  h.px(x + 5, y - 2, lo); h.px(x + 5, y - 1, lo);
  h.rect(x + 2, y + 1, 5, 1, shade); h.px(x + 6, y, shade);
};
// a flower on a stem — a coloured dot alone is noise, a stem makes it a plant
const flower = (h, x, y, petal, stem) => {
  h.px(x, y, stem);
  h.rect(x, y - 2, 2, 2, petal);
  h.px(x + 1, y - 1, stem);
};
// a seeded stalk of dry grass
const stalk = (h, x, y, stem, head) => {
  h.px(x, y, stem); h.px(x, y - 1, stem); h.px(x + 1, y - 2, stem);
  h.px(x + 1, y - 3, head); h.px(x + 1, y - 4, head); h.px(x + 2, y - 4, head);
};
// a patch of bare earth showing through the sward
const earth = (h, x, y, soil, edge) => {
  h.rect(x + 1, y, 4, 1, soil);
  h.rect(x, y + 1, 6, 1, soil);
  h.rect(x + 1, y + 2, 4, 1, soil);
  h.px(x + 2, y + 1, edge); h.px(x + 4, y, edge); h.px(x + 1, y + 2, edge);
};
// a fallen broadleaf with a vein and a shadow under its lower edge
const leaf = (h, x, y, c, vein, shade) => {
  h.px(x + 1, y, c); h.px(x + 2, y, c);
  h.px(x, y + 1, c); h.px(x + 1, y + 1, vein); h.px(x + 2, y + 1, c); h.px(x + 3, y + 1, c);
  h.px(x + 1, y + 2, c); h.px(x + 2, y + 2, c);
  h.px(x + 2, y + 3, shade); h.px(x + 3, y + 2, shade);
};
// a forked twig lying on the ground
const twig = (h, x, y, c, shade) => {
  for (let i = 0; i < 6; i++) h.px(x + i, y + (i > 2 ? 1 : 0), c);
  h.px(x + 3, y - 1, c); h.px(x + 4, y - 2, c);
  for (let i = 1; i < 6; i++) h.px(x + i, y + (i > 2 ? 2 : 1), shade);
};
// a mushroom: cap, stem, and the shadow it throws
const mushroom = (h, x, y, cap, gill, stem, shade) => {
  h.px(x, y - 2, cap); h.px(x + 1, y - 2, cap);
  h.px(x - 1, y - 1, cap); h.px(x, y - 1, cap); h.px(x + 1, y - 1, cap); h.px(x + 2, y - 1, gill);
  h.px(x, y, stem); h.px(x + 1, y, gill);
  h.px(x + 1, y + 1, shade); h.px(x + 2, y + 1, shade);
};
// a pine cone
const cone = (h, x, y, dark, light, shade) => {
  h.px(x + 1, y - 3, dark); h.px(x + 2, y - 3, dark);
  h.px(x, y - 2, dark); h.px(x + 1, y - 2, light); h.px(x + 2, y - 2, dark); h.px(x + 3, y - 2, light);
  h.px(x, y - 1, light); h.px(x + 1, y - 1, dark); h.px(x + 2, y - 1, light); h.px(x + 3, y - 1, dark);
  h.px(x + 1, y, dark); h.px(x + 2, y, dark);
  h.px(x + 2, y + 1, shade); h.px(x + 3, y + 1, shade);
};
// a moss cushion
const moss = (h, x, y, hi, body, shade) => {
  h.rect(x + 1, y - 1, 3, 1, body);
  h.rect(x, y, 5, 1, body);
  h.px(x + 1, y - 1, hi); h.px(x + 2, y - 1, hi);
  h.px(x + 4, y, shade); h.rect(x + 1, y + 1, 3, 1, shade);
};
// a rock breaking the surface, with foam gathered around it
const waterRock = (h, x, y, hi, mid, foam) => {
  h.px(x + 1, y - 1, hi); h.px(x + 2, y - 1, hi);
  h.rect(x, y, 4, 2, mid); h.px(x + 3, y, hi);
  h.px(x - 1, y, foam); h.px(x - 1, y + 1, foam);
  h.rect(x, y + 2, 3, 1, foam); h.px(x + 4, y + 1, foam);
};
// a length of current: a flat 1px streak that kinks once
const streak = (h, x, y, len, c) => {
  for (let i = 0; i < len; i++) h.px(x + i, y + (i > len / 2 ? 1 : 0), c);
};

export const TILES = {
  // lush pasture in flower: grass standing thicker in some patches than others,
  // flowers growing in colonies the way they actually do, one shrub
  meadow: (h) => {
    h.fill('G');
    strokes(h, h.clumped(3, 4, 7, 3), 't', 2, 'v');
    strokes(h, h.clumped(3, 4, 7, 3), 'g', 2, 'v');
    for (const [x, y] of h.clumped(2, 3, 6, 5)) clump(h, x, y, 'g', 'G', 't');
    const petals = ['w', 'r', 'B', 'p'];
    h.clumped(2, 2, 4, 4).forEach(([x, y], i) => flower(h, x, y, petals[i % petals.length], 't'));
    for (const [x, y] of h.scatter(1, 12)) bush(h, x, y, 'g', 'G', 't');
  },

  // plain pasture: grazed shorter and drier, bare earth worn through in places
  grassland: (h) => {
    h.fill('G');
    strokes(h, h.clumped(3, 5, 8, 3), 't', 2, 'v');
    strokes(h, h.clumped(2, 4, 6, 3), 'g', 2, 'v');
    for (const [x, y] of h.scatter(2, 11)) earth(h, x, y, 'r', 'o');
    for (const [x, y] of h.clumped(2, 2, 5, 5)) clump(h, x, y, 'g', 'G', 't');
    for (const [x, y] of h.clumped(2, 2, 5, 5)) stalk(h, x, y, 'G', 'y');
    for (const [x, y] of h.scatter(1, 12)) pebble(h, x, y, 'x', 's', 'd');
  },

  // dry steppe: straw over sun-baked ground, coarse tussocks, cracked earth
  steppes: (h) => {
    h.fill('y');
    strokes(h, h.clumped(2, 4, 7, 3), 'o', 2, 'v');
    for (const [x, y] of h.scatter(3, 10)) earth(h, x, y, 'o', 'r');
    for (const [x, y] of h.clumped(2, 2, 6, 6)) tussock(h, x, y, 'y', 'o', 'r');
    for (const [x, y] of h.scatter(1, 12)) tussock(h, x, y, 'g', 'G', 't');
    for (const [x, y] of h.clumped(2, 2, 5, 4)) stalk(h, x, y, 'o', 'y');
    for (const [x, y] of h.scatter(2, 11)) pebble(h, x, y, 'x', 's', 'd');
  },

  // scree: boulders and gravel gathered in drifts over open bedrock
  stony: (h) => {
    h.fill('x');
    strokes(h, h.clumped(3, 4, 7, 3), 's', 2, 'x');
    for (const [x, y] of h.scatter(2, 13)) boulder(h, x, y, 'w', 'x', 's', 'd');
    for (const [x, y] of h.clumped(2, 2, 6, 5)) pebble(h, x, y, 'x', 's', 'd');
    for (const [x, y] of h.scatter(3, 9)) h.dash(x, y, h.rnd() < 0.5 ? 1 : -1, 1, 3 + Math.floor(h.rnd() * 3), 'd');
    for (const [x, y] of h.scatter(2, 12)) moss(h, x, y, 'G', 't', 'd');
  },

  // broadleaf litter: leaves drifted into banks over humus, twigs, moss, fungi
  forest_bed: (h) => {
    h.fill('r');
    strokes(h, h.clumped(3, 5, 7, 3), 'p', 2, 'h');
    strokes(h, h.clumped(2, 3, 6, 3), 'o', 2, 'h');
    for (const [x, y] of h.clumped(2, 3, 6, 5)) leaf(h, x, y, 'o', 'y', 'p');
    for (const [x, y] of h.clumped(1, 2, 5, 5)) leaf(h, x, y, 'y', 'o', 'p');
    for (const [x, y] of h.scatter(2, 11)) moss(h, x, y, 'g', 'G', 't');
    for (const [x, y] of h.clumped(1, 2, 4, 3)) mushroom(h, x, y, 'w', 'x', 'y', 'p');
    for (const [x, y] of h.scatter(1, 12)) twig(h, x, y, 'd', 'p');
  },

  // needle duff: darker and finer, needles lying every way, cones and fungi
  pine_forest_bed: (h) => {
    h.fill('r');
    strokes(h, h.clumped(4, 6, 8, 3), 'p', 3, 'x');
    strokes(h, h.clumped(2, 4, 6, 3), 'o', 3, 'x');
    for (const [x, y] of h.scatter(3, 10)) {
      h.rect(x, y, 5, 1, 'p'); h.rect(x + 1, y + 1, 4, 1, 'p'); h.px(x + 2, y, 'd');
    }
    for (const [x, y] of h.clumped(1, 2, 5, 5)) cone(h, x, y, 'd', 'p', 'p');
    for (const [x, y] of h.scatter(3, 10)) moss(h, x, y, 'G', 't', 'd');
    for (const [x, y] of h.clumped(1, 2, 4, 3)) mushroom(h, x, y, 'r', 'p', 'y', 'd');
    for (const [x, y] of h.scatter(1, 12)) twig(h, x, y, 'd', 'p');
  },

  // shallow running water: current streaks, rocks breaking the surface with foam
  stream: (h) => {
    h.fill('B');
    strokes(h, h.clumped(3, 5, 8, 3), 'b', 3, 'h');
    strokes(h, h.clumped(3, 4, 7, 3), 'c', 3, 'h');
    for (const [x, y] of h.clumped(2, 2, 5, 5)) { h.rect(x, y, 3, 1, 'x'); h.rect(x, y + 1, 3, 1, 's'); }
    for (const [x, y] of h.clumped(2, 2, 6, 5)) streak(h, x, y, 5 + Math.floor(h.rnd() * 3), 'c');
    for (const [x, y] of h.scatter(2, 12)) waterRock(h, x, y, 'x', 's', 'w');
  },

  // open deep water: dark, calm, long slow swells — the quiet foil to the stream
  deep_water: (h) => {
    h.fill('b');
    strokes(h, h.clumped(3, 4, 9, 4), 'n', 4, 'h');
    for (const [x, y] of h.clumped(2, 3, 7, 5)) streak(h, x, y, 7 + Math.floor(h.rnd() * 4), 'B');
    for (const [x, y] of h.clumped(2, 2, 6, 5)) streak(h, x, y, 4 + Math.floor(h.rnd() * 3), 'n');
    for (const [x, y] of h.scatter(2, 12)) { h.px(x, y, 'c'); h.px(x + 1, y, 'c'); }
  },
};

// The shade tone each terrain draws its hex rim in — the terrain's own dark
// step, never ink, so the grid reads as a faint crease rather than a drawn line.
export const RIM = {
  meadow: 't',
  grassland: 't',
  steppes: 'o',
  stony: 's',
  forest_bed: 'p',
  pine_forest_bed: 'p',
  stream: 'b',
  deep_water: 'n',
};

// Draw a named terrain, rim included. Callers should use this rather than
// drawTile so a tile can never be emitted without its hex border.
export function drawTerrain(name, seed) {
  const h = new H(seed);
  TILES[name](h);
  h.rim(RIM[name]);
  return h.grid();
}
