// main.js — bootstrap and the frame loop.

import { loadTileset } from './world/tileset.js';
import { buildCliffAtlas } from './render/columns.js';
import { generateWorld } from './world/worldgen.js';
import { findPath } from './world/pathfinding.js';
import { Renderer } from './render/renderer.js';
import { Camera } from './core/camera.js';
import { Player } from './game/player.js';
import { pickHex, tileCenter, traceTopFace } from './world/hexgrid.js';

const DPR = () => Math.min(window.devicePixelRatio || 1, 2);

async function boot() {
  const canvas = document.getElementById('view');
  const hud = document.getElementById('hud-stats');

  const tileset = await loadTileset();
  const res = {
    images: tileset.images,
    cliffAtlas: buildCliffAtlas(tileset.images),
    resolvers: tileset.resolvers,
    index: tileset.index,
  };

  const seed = new URLSearchParams(location.search).get('seed') || String(Date.now());
  const map = generateWorld({ seed, resolvers: res.resolvers });

  const camera = new Camera({ scale: 3 });
  const renderer = new Renderer(canvas, res);
  renderer.resize(camera);

  const player = new Player(map, map.spawn);
  const start = player.restingPos;
  camera.centerOn(start.cx, start.cy);

  let hover = null;
  let follow = true;          // camera keeps the player in view until you pan
  let preview = null;          // the route the cursor is proposing
  const drag = { active: false, x: 0, y: 0, moved: 0 };

  const worldAt = e => {
    const rect = canvas.getBoundingClientRect();
    const d = DPR();
    return camera.screenToWorld((e.clientX - rect.left) * d, (e.clientY - rect.top) * d);
  };

  const updateHover = e => {
    const w = worldAt(e);
    const hit = pickHex(w.x, w.y, (q, r) => map.heightAt(q, r));
    const changed = !hit !== !hover || (hit && hover && (hit.q !== hover.q || hit.r !== hover.r));
    hover = hit;
    if (changed) {
      preview = hover && !player.moving
        ? findPath(map, { q: player.q, r: player.r }, hover)
        : null;
    }
  };

  canvas.addEventListener('pointerdown', e => {
    drag.active = true;
    drag.moved = 0;
    drag.x = e.clientX;
    drag.y = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', e => {
    if (drag.active) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (drag.moved > 4) {
        camera.panBy(-dx * DPR() / camera.scale, -dy * DPR() / camera.scale);
        follow = false;
      }
      drag.x = e.clientX;
      drag.y = e.clientY;
    }
    updateHover(e);
  });

  canvas.addEventListener('pointerup', e => {
    canvas.releasePointerCapture(e.pointerId);
    const wasDrag = drag.moved > 4;
    drag.active = false;
    if (wasDrag) return;

    // Resolve the target from the click itself rather than from the last hover:
    // a tap has no preceding move, and neither does a touch.
    const w = worldAt(e);
    const target = pickHex(w.x, w.y, (q, r) => map.heightAt(q, r));
    if (!target) return;

    const route = findPath(map, { q: player.q, r: player.r }, target);
    if (!route) {
      notify('No way through.');
      return;
    }
    follow = true;
    player.follow(route);
    preview = null;
  });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const d = DPR();
    if (camera.zoom(e.deltaY > 0 ? -1 : 1,
      (e.clientX - rect.left) * d, (e.clientY - rect.top) * d,
      canvas.width, canvas.height)) {
      renderer.resize(camera);
    }
  }, { passive: false });

  window.addEventListener('resize', () => renderer.resize(camera));
  window.addEventListener('keydown', e => {
    if (e.key === 'c') { follow = true; }
    if (e.key === 'Escape') { player.stop(); }
  });

  /** Faint dots along the route the cursor is proposing. */
  const drawPreview = ctx => {
    if (!preview || preview.length < 2) return;
    ctx.fillStyle = 'rgba(255, 248, 220, 0.5)';
    for (let i = 1; i < preview.length; i++) {
      const step = preview[i];
      const { cx, cy } = tileCenter(step.q, step.r, Math.max(0, map.heightAt(step.q, step.r)));
      ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 2, 2);
    }
    const last = preview[preview.length - 1];
    const { cx, cy } = tileCenter(last.q, last.r, Math.max(0, map.heightAt(last.q, last.r)));
    traceTopFace(ctx, cx, cy);
    ctx.strokeStyle = 'rgba(217, 180, 91, 0.9)';
    ctx.lineWidth = 1;
    ctx.stroke();
  };

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    player.update(dt);
    if (follow) {
      const p = player.pos;
      camera.moveTo(p.x, p.y);
    }
    camera.update(dt);

    renderer.render(map, camera, {
      hover,
      entities: [player],
      overlays: [drawPreview],
    });

    const col = hover && map.get(hover.q, hover.r);
    hud.innerHTML = [
      `<b>${col ? col.terrain.replace(/_/g, ' ') : '—'}</b>`,
      col ? `<span class="dim">${hover.q}, ${hover.r} &middot; height ${col.h}</span>` : '',
      col?.feature ? `<span class="dim">${describeFeature(col.feature)}</span>` : '',
      `<span class="dim">seed ${seed} &middot; ${camera.scale}x</span>`,
    ].filter(Boolean).join('<br>');

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  window.game = { map, camera, renderer, player, res, seed };
}

function describeFeature(f) {
  if (f.type === 'village') return `village of ${f.name}`;
  if (f.type === 'trees') return `${f.remaining} ${f.kind} trees`;
  if (f.type === 'ore') return f.known ? `ore vein (${f.remaining})` : 'stone';
  return f.type;
}

let notifyTimer = null;
function notify(message, ms = 2200) {
  const root = document.getElementById('notifications');
  const el = document.createElement('div');
  el.className = 'notification';
  el.textContent = message;
  root.appendChild(el);
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => el.remove(), ms);
}

boot().catch(err => {
  console.error(err);
  document.getElementById('hud-stats').textContent = `boot failed: ${err.message}`;
});
