// world_gen.js
// Contains world generation logic for hexagon shaped boards with seeded randomness.
// Defines SeededPerlin, Rng, helper functions (axialToWorld, fbm, ridged), and HexWorld class.
import * as THREE from 'three';

const STICKER_ROTATION = Math.PI / 6;
const STICKER_SCALE = 1;

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(a) {
  return function() {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class SeededPerlin {
  constructor(seedStr = 'default') {
    const seed32 = xmur3(seedStr)();
    const rand = mulberry32(seed32);
    const perm = new Array(256).fill(0).map((_, i) => i);
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    this.p = new Array(512);
    for (let i = 0; i < 512; i++) {
      this.p[i] = perm[i & 255];
    }
  }
  static fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  static lerp(t, a, b) { return a + t * (b - a); }
  grad(hash, x, y, z) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
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
    const A = this.p[X] + Y, AA = this.p[A] + Z, AB = this.p[A + 1] + Z;
    const B = this.p[X + 1] + Y, BA = this.p[B] + Z, BB = this.p[B + 1] + Z;
    return SeededPerlin.lerp(w,
      SeededPerlin.lerp(v,
        SeededPerlin.lerp(u, this.grad(this.p[AA], x, y, z), this.grad(this.p[BA], x - 1, y, z)),
        SeededPerlin.lerp(u, this.grad(this.p[AB], x, y - 1, z), this.grad(this.p[BB], x - 1, y - 1, z))
      ),
      SeededPerlin.lerp(v,
        SeededPerlin.lerp(u, this.grad(this.p[AA + 1], x, y, z - 1), this.grad(this.p[BA + 1], x - 1, y, z - 1)),
        SeededPerlin.lerp(u, this.grad(this.p[AB + 1], x, y - 1, z - 1), this.grad(this.p[BB + 1], x - 1, y - 1, z - 1))
      )
    );
  }
}

class Rng {
  constructor(seedStr) {
    this.rand = mulberry32(xmur3(seedStr)());
  }
  next() { return this.rand(); }
  range(a, b) { return a + (b - a) * this.rand(); }
  irange(a, b) { return Math.floor(this.range(a, b + 1)); }
  pick(arr) { return arr[this.irange(0, arr.length - 1)]; }
}

export function axialToWorld(q, r, radius) {
  const x = radius * (3 / 2) * q;
  const z = radius * Math.sqrt(3) * (r + q / 2);
  return { x, z };
}

function fbm(perlin, x, y, octaves = 4, lacunarity = 2.0, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += amp * perlin.noise(x * freq, y * freq);
    norm += amp;
    amp *= gain; freq *= lacunarity;
  }
  return sum / norm;
}

function ridged(perlin, x, y, octaves = 4, lacunarity = 2.0, gain = 0.5) {
  let amp = 1, freq = 1, sum = 0, norm = 0;
  for (let i = 0; i < octaves; i++) {
    const n = perlin.noise(x * freq, y * freq);
    const r = 1 - Math.abs(n);
    sum += amp * r;
    norm += amp;
    amp *= gain; freq *= lacunarity;
  }
  return sum / norm;
}

export class HexWorld {
  constructor(options) {
    this.boardRadius = options.boardRadius;
    this.radius = options.radius;
    this.hScale = options.hScale;
    this.maxHeight = options.maxHeight;
    this.noiseScale = options.noiseScale;
    this.seed = options.seed;

    this.width = this.boardRadius * 2 + 1;
    this.depth = this.boardRadius * 2 + 1;

    this.perlin = new SeededPerlin(this.seed + '-perlin');
    this.rng = new Rng(this.seed + '-rng');

    this.heightMap = [];
    this.blockMap = [];
    this.featureMap = []; // 'none' | 'forest' | 'city'
    this.propSpawns = []; // list of prop spawn instructions

    for (let r = 0; r < this.depth; r++) {
      this.heightMap[r] = [];
      this.blockMap[r] = [];
      this.featureMap[r] = [];
      for (let q = 0; q < this.width; q++) {
        this.heightMap[r][q] = 0;
        this.blockMap[r][q] = 'stone';
        this.featureMap[r][q] = 'none';
      }
    }
  }
  isInside(q, r) {
    const aq = q - this.boardRadius;
    const ar = r - this.boardRadius;
    return (Math.abs(aq) <= this.boardRadius &&
            Math.abs(ar) <= this.boardRadius &&
            Math.abs(aq + ar) <= this.boardRadius);
  }
  generateBase() {
    for (let r = 0; r < this.depth; r++) {
      for (let q = 0; q < this.width; q++) {
        if (!this.isInside(q, r)) continue;
        const nx = (q - this.boardRadius) / this.boardRadius;
        const ny = (r - this.boardRadius) / this.boardRadius;
        const warpX = 0.4 * fbm(this.perlin, nx * 0.6 + 31.1, ny * 0.6 - 17.3, 3, 2.2, 0.55);
        const warpY = 0.4 * fbm(this.perlin, nx * 0.6 - 12.7, ny * 0.6 + 24.5, 3, 2.2, 0.55);
        const wx = nx + warpX, wy = ny + warpY;
        let e = 0.6 * fbm(this.perlin, wx * this.noiseScale * 10, wy * this.noiseScale * 10, 4, 2.0, 0.55);
        e = (e + 0.6) / 1.2;
        e = Math.pow(e * 0.9, 1.2);
        const height = Math.round(e * this.maxHeight * 0.4);
        this.heightMap[r][q] = Math.min(this.maxHeight, Math.max(0, height));
      }
    }
  }
  addMountains(count = 3) {
    const centres = [];
    let attempts = 0;
    while (centres.length < count && attempts < count * 5) {
      const q = this.rng.irange(0, this.width - 1);
      const r = this.rng.irange(0, this.depth - 1);
      if (this.isInside(q, r)) centres.push({ q, r });
      attempts++;
    }
    centres.forEach(({ q: cq, r: cr }) => {
      const peak = this.rng.irange(Math.floor(this.maxHeight * 0.6), this.maxHeight);
      const rad = this.rng.irange(Math.floor(this.boardRadius * 0.2), Math.floor(this.boardRadius * 0.3));
      for (let r = 0; r < this.depth; r++) {
        for (let q = 0; q < this.width; q++) {
          if (!this.isInside(q, r)) continue;
          const dx = q - cq, dy = r - cr;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < rad) {
            const t = 1 - (dist / rad);
            const bump = Math.round(peak * Math.pow(t, 1.2));
            this.heightMap[r][q] = Math.min(this.maxHeight, this.heightMap[r][q] + bump);
          }
        }
      }
      for (let r = 0; r < this.depth; r++) {
        for (let q = 0; q < this.width; q++) {
          if (!this.isInside(q, r)) continue;
          const nx = (q - cq) * 0.06;
          const ny = (r - cr) * 0.06;
          const ridge = ridged(this.perlin, nx, ny, 3, 2.1, 0.55);
          const edge = Math.max(0, ridge - 0.7) * 12;
          if (edge > 0) {
            this.heightMap[r][q] = Math.min(this.maxHeight, this.heightMap[r][q] + Math.round(edge));
          }
        }
      }
    });
  }
  carveRiver() {
    const widthTiles = Math.max(2, Math.floor(this.boardRadius * 0.15));
    const phase = this.rng.range(0, Math.PI * 2);
    for (let r = 0; r < this.depth; r++) {
      const cx = Math.floor(this.boardRadius + (this.boardRadius * 0.5) * Math.sin(r * 0.12 + phase) + this.rng.range(-2, 2));
      for (let dq = -widthTiles; dq <= widthTiles; dq++) {
        const qIndex = cx + dq;
        if (qIndex >= 0 && qIndex < this.width && this.isInside(qIndex, r)) {
          const drop = (widthTiles - Math.abs(dq) + 1);
          this.heightMap[r][qIndex] = Math.max(0, this.heightMap[r][qIndex] - (4 + drop));
          this.blockMap[r][qIndex] = 'water';
        }
      }
    }
  }
  carveCliffWithRamp() {
    const q0 = Math.floor(this.boardRadius * 0.2);
    const q1 = Math.floor(this.boardRadius * 0.5);
    const r0 = Math.floor(this.boardRadius * 0.1);
    const r1 = Math.floor(this.boardRadius * 0.5);
    const drop = 6;
    for (let r = r0; r <= r1; r++) {
      for (let q = q0; q <= q1; q++) {
        if (!this.isInside(q, r)) continue;
        this.heightMap[r][q] = Math.max(0, this.heightMap[r][q] - drop);
      }
    }
    const rampQ = q1 + 1;
    for (let r = r0; r <= r1; r++) {
      if (!this.isInside(rampQ, r)) continue;
      const t = (r - r0) / Math.max(1, (r1 - r0));
      const step = Math.round(t * drop);
      this.heightMap[r][rampQ] = Math.min(this.maxHeight, this.heightMap[r][rampQ] + step);
    }
  }
  assignBlocks() {
    for (let r = 0; r < this.depth; r++) {
      for (let q = 0; q < this.width; q++) {
        if (!this.isInside(q, r)) continue;
        if (this.blockMap[r][q] === 'water') continue;
        const h = this.heightMap[r][q];
        const nx = (q - this.boardRadius) * this.noiseScale * 1.5 + 100;
        const ny = (r - this.boardRadius) * this.noiseScale * 1.5 - 50;
        const moisture = (this.perlin.noise(nx, ny) + 1) / 2;
        const oreNoise = (this.perlin.noise(nx * 3.1, ny * 3.1, 8.9) + 1) / 2;
        let type;
        if (h > 0 && oreNoise > 0.88 && h <= this.maxHeight - 1) {
          type = 'ore';
        } else if (h <= Math.floor(this.maxHeight * 0.3)) {
          type = 'marble';
        } else {
          type = 'stone';
        }
        if (h === 0 && moisture > 0.55) {
          type = 'water';
        }
        this.blockMap[r][q] = type;
      }
    }
  }
  assignFeatures() {
    const nearWater = (q, r) => {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dq = -1; dq <= 1; dq++) {
          if (dq === 0 && dr === 0) continue;
          const nq = q + dq, nr = r + dr;
          if (!this.isInside(nq, nr)) continue;
          if (this.blockMap[nr][nq] === 'water') return true;
        }
      }
      return false;
    };
    const isFlatNeighborhood = (q, r, tol = 1) => {
      const h0 = this.heightMap[r][q];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dq = -1; dq <= 1; dq++) {
          const nq = q + dq, nr = r + dr;
          if (!this.isInside(nq, nr)) continue;
          if (Math.abs(this.heightMap[nr][nq] - h0) > tol) return false;
        }
      }
      return true;
    };

    for (let r = 0; r < this.depth; r++) {
      for (let q = 0; q < this.width; q++) {
        if (!this.isInside(q, r)) continue;
        if (this.blockMap[r][q] === 'water') continue;

        const h = this.heightMap[r][q];
        const nx = (q - this.boardRadius) * this.noiseScale + 12.3;
        const ny = (r - this.boardRadius) * this.noiseScale - 7.7;
        const moist = (this.perlin.noise(nx * 1.7, ny * 1.7) + 1) / 2;
        const civ = (this.perlin.noise(nx * 3.3 + 50, ny * 3.3 - 20, 7.5) + 1) / 2;

        if (this.featureMap[r][q] === 'none') {
          if (h >= 2 && h <= Math.floor(this.maxHeight * 0.5) && moist > 0.55 && this.rng.next() < 0.45) {
            this.featureMap[r][q] = 'forest';
          }
        }
        if (this.featureMap[r][q] === 'none') {
          if (isFlatNeighborhood(q, r, 1) && nearWater(q, r) && civ > 0.4 && this.rng.next() < 0.3) {
            this.featureMap[r][q] = 'city';
          }
        }
      }
    }

    for (let r = 0; r < this.depth; r++) {
      for (let q = 0; q < this.width; q++) {
        if (this.featureMap[r][q] !== 'city') continue;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dq = -1; dq <= 1; dq++) {
            const nq = q + dq, nr = r + dr;
            if (!this.isInside(nq, nr)) continue;
            if (this.featureMap[nr][nq] === 'forest') this.featureMap[nr][nq] = 'none';
          }
        }
      }
    }
    
    this.propSpawns.length = 0;
    for (let r = 0; r < this.depth; r++) {
      for (let q = 0; q < this.width; q++) {
        const feat = this.featureMap[r][q];
        if (feat === 'none') continue;
        const h = this.heightMap[r][q];
        const { x, z } = axialToWorld(q - this.boardRadius, r - this.boardRadius, this.radius);
        if (feat === 'forest') {
          const count = 2 + this.rng.irange(0, 2);
          for (let i = 0; i < count; i++) {
            const jx = this.rng.range(-0.35, 0.35);
            const jz = this.rng.range(-0.35, 0.35);
            this.propSpawns.push({
              type: 'forest', q, r, x: x + jx, z: z + jz, y: (h + 1) * this.hScale,
              scale: this.rng.range(0.6, 1.1), rotY: this.rng.range(0, Math.PI * 2),
            });
          }
        } else if (feat === 'city') {
            this.propSpawns.push({
              type: 'city', q, r, x: x + this.rng.range(-0.1, 0.1), z: z + this.rng.range(-0.1, 0.1),
              y: (h + 1) * this.hScale, scale: this.rng.range(0.9, 1.1), rotY: this.rng.range(0, Math.PI * 2),
            });
        }
      }
    }
    let existingCities = 0;
    for (let rr = 0; rr < this.depth; rr++) {
      for (let qq = 0; qq < this.width; qq++) {
        if (this.featureMap[rr][qq] === 'city') existingCities++;
      }
    }
    const minCities = Math.max(6, Math.floor(this.boardRadius / 4) + 2);
    let attempts = 0;
    while (existingCities < minCities && attempts < 200) {
      const qRandom = this.rng.irange(0, this.width - 1);
      const rRandom = this.rng.irange(0, this.depth - 1);
      if (!this.isInside(qRandom, rRandom)) { attempts++; continue; }
      if (this.blockMap[rRandom][qRandom] === 'water') { attempts++; continue; }
      if (this.heightMap[rRandom][qRandom] < 1) { attempts++; continue; }
      const baseHeight = this.heightMap[rRandom][qRandom];
      let flat = true;
      for (let dr = -1; dr <= 1 && flat; dr++) {
        for (let dq = -1; dq <= 1; dq++) {
          const nq = qRandom + dq;
          const nr = rRandom + dr;
          if (!this.isInside(nq, nr)) continue;
          if (Math.abs(this.heightMap[nr][nq] - baseHeight) > 1) { flat = false; break; }
        }
      }
      if (!flat) { attempts++; continue; }
      this.featureMap[rRandom][qRandom] = 'city';
      existingCities++;
      const { x, z } = axialToWorld(qRandom - this.boardRadius, rRandom - this.boardRadius, this.radius);
      this.propSpawns.push({
        type: 'city', q: qRandom, r: rRandom, x: x + this.rng.range(-0.1, 0.1),
        z: z + this.rng.range(-0.1, 0.1), y: (this.heightMap[rRandom][qRandom] + 1) * this.hScale,
        scale: this.rng.range(0.9, 1.1), rotY: this.rng.range(0, Math.PI * 2)
      });
      attempts++;
    }
  }

  /**
   * REFACTORED buildMesh
   * This version uses InstancedMesh to draw all hexes in a small number of draw calls,
   * dramatically improving performance.
   */
  buildMesh(textures) {
    const group = new THREE.Group();
    const pickGroup = new THREE.Group();

    // 1. Prepare Geometries and Materials
    const baseGeo = new THREE.CylinderGeometry(this.radius, this.radius, this.hScale, 6);
    baseGeo.translate(0, this.hScale / 2, 0);
    baseGeo.rotateY(Math.PI / 6);

    const capGeo = new THREE.CircleGeometry(this.radius, 6);
    capGeo.rotateX(-Math.PI / 2);

    const materialCache = this.createMaterialCache(textures);

    // 2. Count instances needed for each material type
    const instanceCounts = {};
    for (let r = 0; r < this.depth; r++) {
      for (let q = 0; q < this.width; q++) {
        if (!this.isInside(q, r)) continue;
        const h = this.heightMap[r][q];
        const type = this.blockMap[r][q];
        const layers = type === 'water' ? 1 : h + 1;

        for (let y = 0; y < layers; y++) {
          const isTop = (type !== 'water' && y === h);
          const matKey = isTop ? 'grass' : type; // Grass on top, block type on sides
          instanceCounts[matKey] = (instanceCounts[matKey] || 0) + 1;
        }
      }
    }

    // 3. Create InstancedMeshes
    const instancedMeshes = {};
    const dummy = new THREE.Object3D(); // Helper object for matrix transforms
    for (const key in instanceCounts) {
      const count = instanceCounts[key];
      const mat = materialCache[key] || new THREE.MeshLambertMaterial({ color: this.getColorForType(key) });
      const geo = key === 'grass' ? capGeo : baseGeo;
      const mesh = new THREE.InstancedMesh(geo, mat, count);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      group.add(mesh);
      instancedMeshes[key] = { mesh, index: 0 };
    }

    // 4. Position instances
    for (let r = 0; r < this.depth; r++) {
      for (let q = 0; q < this.width; q++) {
        if (!this.isInside(q, r)) continue;
        
        const h = this.heightMap[r][q];
        const type = this.blockMap[r][q];
        const { x, z } = axialToWorld(q - this.boardRadius, r - this.boardRadius, this.radius);
        const layers = type === 'water' ? 1 : h + 1;

        for (let y = 0; y < layers; y++) {
          const isTop = (type !== 'water' && y === h);
          
          // Set side cylinder instance
          const sideKey = type;
          if (!isTop && instancedMeshes[sideKey]) {
            const imesh = instancedMeshes[sideKey];
            dummy.position.set(x, y * this.hScale, z);
            dummy.updateMatrix();
            imesh.mesh.setMatrixAt(imesh.index++, dummy.matrix);
          }

          // Set top cap instance
          if (isTop && instancedMeshes['grass']) {
             const imesh = instancedMeshes['grass'];
             const stickerScale = STICKER_SCALE;
             dummy.position.set(x, (y + 1) * this.hScale + 0.001, z);
             dummy.scale.set(stickerScale, stickerScale, stickerScale);
             dummy.updateMatrix();
             imesh.mesh.setMatrixAt(imesh.index++, dummy.matrix);
             dummy.scale.set(1, 1, 1); // Reset scale
          }
        }
        
        // Add invisible picking surface at the top
        const topLayer = type === 'water' ? 0 : h;
        const pickRadius = this.radius;
        const pickGeo = new THREE.CylinderGeometry(pickRadius, pickRadius, 0.05, 6);
        pickGeo.translate(0, 0.025, 0);
        pickGeo.rotateY(Math.PI / 6);
        const pickMat = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0, transparent: true });
        const pickMesh = new THREE.Mesh(pickGeo, pickMat);
        pickMesh.position.set(x, (topLayer + 1) * this.hScale + 0.001, z);
        pickMesh.userData = { qIndex: q, rIndex: r };
        pickGroup.add(pickMesh);
      }
    }
    
    // Notify three.js that instance matrices have been updated
    Object.values(instancedMeshes).forEach(im => im.mesh.instanceMatrix.needsUpdate = true);

    this.pickGroup = pickGroup;
    return group;
  }

  createMaterialCache(textures) {
      const materialCache = {};
      if (textures) {
        Object.keys(textures).forEach((tKey) => {
          const uri = textures[tKey];
          if (!uri) return;
          const tex = new THREE.TextureLoader().load(uri);
          tex.magFilter = THREE.NearestFilter;
          tex.minFilter = THREE.NearestFilter;
          
          if (tKey === 'grass') {
            tex.center.set(0.5, 0.5);
            tex.rotation = STICKER_ROTATION;
            tex.needsUpdate = true;
          }
          
          const mat = new THREE.MeshLambertMaterial({ map: tex });
          
          if(tKey === 'grass') {
              mat.polygonOffset = true;
              mat.polygonOffsetFactor = -1;
              mat.polygonOffsetUnits = -1;
          }

          materialCache[tKey] = mat;
        });
      }
      return materialCache;
  }

  getColorForType(type) {
    switch (type) {
      case 'water': return 0x2b7fff;
      case 'grass': return 0x2a9d3e;
      case 'stone': return 0x808080;
      case 'marble': return 0xf0f0f0;
      case 'ore': return 0xffd700;
      case 'dirt': return 0x9b7653;
      default: return 0x808080;
    }
  }

  getHeight(q, r) {
    if (q < 0 || q >= this.width || r < 0 || r >= this.depth) return -Infinity;
    if (!this.isInside(q, r)) return -Infinity;
    return this.heightMap[r][q];
  }

  buildProps(models) {
    const group = new THREE.Group();
    const makeInstance = (tpl) => tpl.clone(true);
    for (const spawn of this.propSpawns) {
      const tpl = spawn.type === 'forest' ? models.forest : models.city;
      if (!tpl) continue;
      const inst = makeInstance(tpl);
      inst.position.set(spawn.x, spawn.y, spawn.z);
      inst.rotation.y = spawn.rotY;
      inst.scale.setScalar(spawn.scale);
      inst.userData = { type: spawn.type, q: spawn.q, r: spawn.r };
      group.add(inst);
    }
    return group;
  }
}