// rng.js
// Seeded randomness. xmur3 + mulberry32 are carried over unchanged from the old
// world_gen.js — they gave good worlds and there is no reason to change them.

/** String -> 32-bit seed. */
export function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** 32-bit seed -> uniform [0, 1) generator. */
export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seedStr = 'default') {
    this.rand = mulberry32(xmur3(String(seedStr))());
  }
  next() { return this.rand(); }
  range(a, b) { return a + (b - a) * this.rand(); }
  irange(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[this.irange(0, arr.length - 1)]; }
  chance(p) { return this.rand() < p; }
  /** Fisher-Yates, in place, using this stream. */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.irange(0, i);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

/**
 * Stateless hash of a coordinate to a 32-bit integer.
 *
 * Used wherever a choice has to look random but must be the same every frame —
 * which tile variant a hex uses, which wall strip a cliff level uses. A stateful
 * RNG cannot do this: the renderer visits tiles in a different order each frame.
 */
export function hash2(q, r, salt = 0) {
  let h = Math.imul(q | 0, 0x27d4eb2d) ^ Math.imul(r | 0, 0x165667b1) ^ Math.imul(salt | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return (h ^ (h >>> 15)) >>> 0;
}

/** Stateless hash to an integer in [0, n). */
export const hashPick = (q, r, n, salt = 0) => hash2(q, r, salt) % n;

/**
 * Perlin noise with a seeded permutation table. Carried over from the old
 * world_gen.js so generated worlds keep the same character.
 */
export class SeededPerlin {
  constructor(seedStr = 'default') {
    const rand = mulberry32(xmur3(String(seedStr))());
    const perm = new Array(256).fill(0).map((_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    this.p = new Array(512);
    for (let i = 0; i < 512; i++) this.p[i] = perm[i & 255];
  }

  static fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  static lerp(t, a, b) { return a + t * (b - a); }

  grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : (h === 12 || h === 14) ? x : z;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise(x, y, z = 0) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    const u = SeededPerlin.fade(x);
    const v = SeededPerlin.fade(y);
    const w = SeededPerlin.fade(z);
    const p = this.p;
    const A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z;
    const B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;

    return SeededPerlin.lerp(w,
      SeededPerlin.lerp(v,
        SeededPerlin.lerp(u, this.grad(p[AA], x, y, z), this.grad(p[BA], x - 1, y, z)),
        SeededPerlin.lerp(u, this.grad(p[AB], x, y - 1, z), this.grad(p[BB], x - 1, y - 1, z))),
      SeededPerlin.lerp(v,
        SeededPerlin.lerp(u, this.grad(p[AA + 1], x, y, z - 1), this.grad(p[BA + 1], x - 1, y, z - 1)),
        SeededPerlin.lerp(u, this.grad(p[AB + 1], x, y - 1, z - 1), this.grad(p[BB + 1], x - 1, y - 1, z - 1))));
  }

  /** Fractal sum, normalised to roughly [0, 1]. */
  fbm(x, y, octaves = 4, lacunarity = 2, gain = 0.5) {
    let amp = 1, freq = 1, sum = 0, norm = 0;
    for (let i = 0; i < octaves; i++) {
      sum += amp * this.noise(x * freq, y * freq);
      norm += amp;
      amp *= gain;
      freq *= lacunarity;
    }
    return (sum / norm + 1) / 2;
  }
}
