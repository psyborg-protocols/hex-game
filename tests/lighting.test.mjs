// lighting.test.mjs — height lighting is a curve with a few properties that are
// easy to break by nudging a constant, so they are written down here.

import { test, run, eq, ok } from './_harness.mjs';
import {
  brightnessAt, litImage, LIGHT_BASE, LIGHT_STEP, LIGHT_MIN, LIGHT_MAX,
} from '../src/render/columns.js';
import { DEFAULTS } from '../src/world/worldgen.js';

test('the base height renders untouched', () => {
  eq(brightnessAt(LIGHT_BASE), 1, 'the neutral height should not be tinted');
});

test('below the base darkens, above it lightens', () => {
  ok(brightnessAt(LIGHT_BASE - 1) < 1, 'lower ground should be shaded');
  ok(brightnessAt(0) < brightnessAt(LIGHT_BASE - 1), 'the lowest ground should be darkest');
  ok(brightnessAt(LIGHT_BASE + 1) > 1, 'higher ground should be lit');
  ok(brightnessAt(LIGHT_BASE + 2) > brightnessAt(LIGHT_BASE + 1), 'lift should keep rising');
});

test('the step is one increment per level inside the clamps', () => {
  const a = brightnessAt(LIGHT_BASE);
  const b = brightnessAt(LIGHT_BASE + 1);
  ok(Math.abs((b - a) - LIGHT_STEP) < 1e-9, `expected a ${LIGHT_STEP} step, got ${b - a}`);
});

test('it never runs away, at any height the world can produce', () => {
  for (let h = 0; h <= DEFAULTS.maxHeight; h++) {
    const b = brightnessAt(h);
    ok(b >= LIGHT_MIN && b <= LIGHT_MAX, `height ${h} lit to ${b}, outside the clamps`);
  }
  eq(brightnessAt(DEFAULTS.maxHeight), LIGHT_MAX, 'the peak should sit at the top of the range');
  eq(brightnessAt(0), LIGHT_MIN > 1 - LIGHT_BASE * LIGHT_STEP ? LIGHT_MIN : 1 - LIGHT_BASE * LIGHT_STEP,
    'the lowest ground should be at the bottom of the range or on the ramp');
});

test('it is monotonic, so height always reads the same direction', () => {
  for (let h = 1; h <= DEFAULTS.maxHeight; h++) {
    ok(brightnessAt(h) >= brightnessAt(h - 1), `lighting dipped between ${h - 1} and ${h}`);
  }
});

test('shadow has more room than highlight', () => {
  // Brightening this art washes it out much faster than shading dulls it, so the
  // range is deliberately lopsided. If someone symmetrises it, the pale stone and
  // steppes sheets blow out to near-white.
  ok(1 - LIGHT_MIN > LIGHT_MAX - 1,
    `range should favour shadow, got -${(1 - LIGHT_MIN).toFixed(2)} / +${(LIGHT_MAX - 1).toFixed(2)}`);
});

test('the base sits where the ground actually is, not at worldgen baseHeight', () => {
  // Centring on baseHeight was the obvious guess and rendered the world dim,
  // because most of a map lies below it.
  ok(LIGHT_BASE < DEFAULTS.baseHeight,
    'the neutral exposure should sit below the base-terrain ceiling');
  ok(LIGHT_BASE > 0, 'centring on 0 is just the old lighter-only ramp');
});

test('a neutral level needs no baked variant at all', () => {
  // The short circuit matters: it is what keeps the cache from holding a
  // pointless identity copy of every sheet, and it runs without a DOM.
  const img = { width: 192, height: 48 };
  const res = {};
  eq(litImage(res, 'sheet', img, LIGHT_BASE), img, 'neutral should return the original image');
  eq(res.litCache, undefined, 'neutral should not have allocated a cache');
  eq(litImage(res, 'sheet', null, 0), null, 'a missing image should pass straight through');
});

run('lighting');
