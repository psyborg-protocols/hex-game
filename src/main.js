// main.js — bootstrap.

import { loadTileset } from './world/tileset.js';
import { buildWallAtlas } from './render/columns.js';
import { generateWorld } from './world/worldgen.js';
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

  const seed = new URLSearchParams(location.search).get('seed') || String(Date.now());
  const map = generateWorld({ seed, resolvers: res.resolvers });
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

boot().catch(err => {
  console.error(err);
  document.getElementById('hud-stats').textContent = `boot failed: ${err.message}`;
});
