// main.js — bootstrap.
//
// M1 scaffold: loads the tileset, builds a hand-made map exercising cliffs,
// water and paths, and renders it with pan/zoom/hover. The test map is replaced
// by the seeded generator in M2.

import { loadTileset, makeResolvers } from './world/tileset.js';
import { buildWallAtlas } from './render/columns.js';
import { WorldMap } from './world/mapformat.js';
import { Renderer } from './render/renderer.js';
import { Camera } from './core/camera.js';
import { pickHex, tileCenter } from './world/hexgrid.js';

async function boot() {
  const canvas = document.getElementById('view');
  const tileset = await loadTileset();
  const res = {
    images: tileset.images,
    wallAtlas: buildWallAtlas(tileset.images),
    resolvers: tileset.resolvers,
    index: tileset.index,
  };

  const map = buildTestMap(res);
  const camera = new Camera({ scale: 3 });
  const renderer = new Renderer(canvas, res);
  renderer.resize(camera);

  const spawn = tileCenter(map.spawn.q, map.spawn.r, map.heightAt(map.spawn.q, map.spawn.r));
  camera.centerOn(spawn.cx, spawn.cy);

  let hover = null;
  const input = { dragging: false, lastX: 0, lastY: 0, moved: 0 };

  const toWorld = e => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    return camera.screenToWorld((e.clientX - rect.left) * dpr, (e.clientY - rect.top) * dpr);
  };

  canvas.addEventListener('pointerdown', e => {
    input.dragging = true;
    input.moved = 0;
    input.lastX = e.clientX;
    input.lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', e => {
    if (input.dragging) {
      const dx = e.clientX - input.lastX;
      const dy = e.clientY - input.lastY;
      input.moved += Math.abs(dx) + Math.abs(dy);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      camera.panBy(-dx * dpr / camera.scale, -dy * dpr / camera.scale);
      input.lastX = e.clientX;
      input.lastY = e.clientY;
    }
    const w = toWorld(e);
    hover = pickHex(w.x, w.y, (q, r) => map.heightAt(q, r));
  });

  canvas.addEventListener('pointerup', e => {
    input.dragging = false;
    canvas.releasePointerCapture(e.pointerId);
  });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    camera.zoom(e.deltaY > 0 ? -1 : 1,
      (e.clientX - rect.left) * dpr, (e.clientY - rect.top) * dpr,
      canvas.width, canvas.height);
    renderer.resize(camera);
  }, { passive: false });

  window.addEventListener('resize', () => renderer.resize(camera));

  const hud = document.getElementById('hud-stats');
  let last = performance.now();

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    camera.update(dt);
    renderer.render(map, camera, { hover });

    if (hover) {
      const col = map.get(hover.q, hover.r);
      hud.innerHTML = `<b>${col ? col.terrain : 'void'}</b><br>`
        + `<span class="dim">${hover.q}, ${hover.r} &middot; height ${hover.h}</span><br>`
        + `<span class="dim">zoom ${camera.scale}x &middot; ${map.size} columns</span>`;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Handy while building.
  window.game = { map, camera, renderer, res };
}

/**
 * A hand-made map that exercises the things M1 has to get right: a tall cliff, a
 * lake with a proper shoreline, a path that has to autotile, and a mix of
 * terrain variants.
 */
function buildTestMap(res) {
  const map = new WorldMap({ seed: 'm1-test', name: 'M1 test' });
  const resolvers = res.resolvers || makeResolvers(res.index);

  const W = 22, H = 18;
  for (let q = 0; q < W; q++) {
    for (let r = 0; r < H; r++) {
      // A stepped plateau climbing to the right, so cliffs of every height show.
      let h = 0;
      if (q > 12) h = Math.min(5, Math.floor((q - 12) / 1.6));
      let terrain = 'grass';
      if (h >= 4) terrain = 'stony';
      else if (h >= 2) terrain = 'steppes';
      else if ((q * 7 + r * 3) % 11 === 0) terrain = 'meadow';
      else if ((q * 5 + r * 11) % 13 === 0) terrain = 'oak_wood';
      else if ((q * 3 + r * 7) % 17 === 0) terrain = 'pine_wood';
      map.place(q, r, terrain, h);
    }
  }

  // A lake in the low ground.
  for (let q = 2; q <= 7; q++) {
    for (let r = 4; r <= 9; r++) {
      if ((q - 4.5) ** 2 + (r - 6.5) ** 2 < 7) map.place(q, r, 'water', 0);
    }
  }

  // A path running across the flat ground into the cliffs.
  for (let q = 1; q <= 13; q++) map.place(q, 12, 'path', map.heightAt(q, 12));
  for (let r = 9; r <= 12; r++) map.place(9, r, 'path', map.heightAt(9, r));

  // Resolve the two autotiled sets now that all the neighbours exist.
  for (const col of map) {
    if (col.terrain === 'water') {
      const hit = resolvers.lake(map.landMask(col.q, col.r), col.q, col.r);
      col.sprite = hit.sprite;
      col.frame = hit.frame;
    } else if (col.terrain === 'path') {
      const hit = resolvers.path(map.pathMask(col.q, col.r));
      col.sprite = hit.sprite;
      col.frame = hit.frame;
    }
  }

  map.spawn = { q: 10, r: 12 };
  return map;
}

boot().catch(err => {
  console.error(err);
  document.getElementById('hud-stats').textContent = `boot failed: ${err.message}`;
});
