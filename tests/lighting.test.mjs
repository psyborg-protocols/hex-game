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
  eq(brightnessAt(0), LIGHT_MIN > 1 - LIGHT_BASE * LIGHT_STEP ? LIGHT_MIN : 1 - LIGHT_BASE * LIGHT_STEP,
    'the lowest ground should be at the bottom of the range or on the ramp');
});

test('it is monotonic, so height always reads the same direction', () => {
  for (let h = 1; h <= DEFAULTS.maxHeight; h++) {
    ok(brightnessAt(h) >= brightnessAt(h - 1), `lighting dipped between ${h - 1} and ${h}`);
  }
});

test('the lift runs free across the whole height range', () => {
  // The ceiling is set above what the ramp can reach, so height keeps reading as
  // height all the way to the peak instead of flattening out partway up.
  const peak = brightnessAt(DEFAULTS.maxHeight);
  ok(peak < LIGHT_MAX, `the peak clamps at ${peak}; the ramp should never reach LIGHT_MAX`);
  ok(peak > 1.8, `the tallest ground should be strongly lit, got ${peak}`);

  // Every step below the peak must still be a real step, or tall ground goes flat.
  for (let h = LIGHT_BASE; h < DEFAULTS.maxHeight; h++) {
    ok(brightnessAt(h + 1) > brightnessAt(h), `lighting flattened between ${h} and ${h + 1}`);
  }
});

test('the clamps are a safety net, not part of the look', () => {
  // With the ceiling raised, the whole height a world can generate — 0 to 20 —
  // fits inside the range with room to spare, so neither clamp actually binds.
  // They exist for hand-edited maps, which can stack higher than worldgen does.
  ok(brightnessAt(0) > LIGHT_MIN, 'the shadow floor should not be reached by generated ground');
  ok(brightnessAt(DEFAULTS.maxHeight) < LIGHT_MAX, 'the highlight ceiling should not be reached either');

  // But they must still hold for a column taller than any generator makes.
  ok(brightnessAt(200) === LIGHT_MAX, 'an absurdly tall column should clamp');
  ok(brightnessAt(-200) === LIGHT_MIN, 'an absurdly deep one should clamp too');
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
