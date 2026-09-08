// editor.js — the map editor.
//
// It shares the game's lattice, tileset and column renderer rather than keeping
// its own copies, so what you author here is exactly what the game draws: same
// hex geometry, same autotile fallbacks, same cliff faces. Maps round-trip
// through the same format the generator writes.
//
// Controls
//   left drag           paint the selected terrain
//   shift + left        raise the column a level
//   right drag          lower the column a level, and away at zero
//   middle drag / alt  pan
//   wheel               zoom, whole steps only

import { loadTileset, TERRAIN, variantFor } from './src/world/tileset.js';
import { drawColumn } from './src/render/columns.js';
import { WorldMap } from './src/world/mapformat.js';
import { pixelScale } from './src/core/camera.js';
import { resolveAutotiles } from './src/world/worldgen.js';
import {
  GEOM, tileCenter, columnBaseY, pickHex, traceTopFace, neighbors,
} from './src/world/hexgrid.js';

const canvas = document.getElementById('view');
const ctx = canvas.getContext('2d');

const ZOOM_STEPS = [1, 2, 3, 4, 6, 8];

const view = { x: -80, y: -80, scale: 3 };
const input = { painting: false, erasing: false, panning: false, last: null, lastHex: null };

let res = null;
let map = new WorldMap({ name: 'untitled' });
let selected = 'grass';
let hover = null;

// ---------------------------------------------------------------- palette

/** Everything you can paint: the terrains, plus a plain height brush. */
const BRUSHES = [
  ...Object.entries(TERRAIN).map(([id, t]) => ({ id, name: t.name })),
];

function buildPalette() {
  const root = document.getElementById('palette');
  root.innerHTML = '';
  for (const brush of BRUSHES) {
    const el = document.createElement('div');
    el.className = 'palette-item' + (brush.id === selected ? ' selected' : '');
    el.innerHTML = `<div class="palette-icon"></div><span>${brush.name}</span>`;

    // Show the terrain's own first frame as the swatch; the crop is in the CSS.
    const sheet = TERRAIN[brush.id].sheets[0];
    el.querySelector('.palette-icon').style.backgroundImage = `url(new_tiles/${sheet}.png)`;

    el.addEventListener('click', () => {
      selected = brush.id;
      for (const other of root.children) other.classList.remove('selected');
      el.classList.add('selected');
    });
    root.appendChild(el);
  }
}

// ------------------------------------------------------------------ edits

const heightAt = (q, r) => map.heightAt(q, r);

function paint(q, r) {
  const existing = map.get(q, r);
  const h = existing ? existing.h : groundLevelNear(q, r);
  map.place(q, r, selected, h);
  retileAround(q, r);
}

/** A new column starts level with whatever it is next to, not at zero. */
function groundLevelNear(q, r) {
  const heights = neighbors(q, r).map(n => map.heightAt(n.q, n.r)).filter(h => h >= 0);
  if (!heights.length) return 0;
  return Math.round(heights.reduce((a, b) => a + b, 0) / heights.length);
}

function raise(q, r) {
  const col = map.get(q, r);
  if (!col) return paint(q, r);
  col.h = Math.min(20, col.h + 1);
}

function lower(q, r) {
  const col = map.get(q, r);
  if (!col) return;
  if (col.h <= 0) {
    map.delete(q, r);
    retileAround(q, r);
    return;
  }
  col.h--;
}

/** Re-resolve the autotiled sets around an edit; a shoreline is not local. */
function retileAround(q, r) {
  const touched = [{ q, r }, ...neighbors(q, r)];
  for (const t of touched) {
    const col = map.get(t.q, t.r);
    if (!col) continue;
    if (col.terrain === 'water') {
      const hit = res.resolvers.lake(map.landMask(col.q, col.r), col.q, col.r);
      col.sprite = hit.sprite;
      col.frame = hit.frame;
    } else if (col.terrain === 'path') {
      const hit = res.resolvers.path(map.pathMask(col.q, col.r));
      col.sprite = hit.sprite;
      col.frame = hit.frame;
    } else {
      const v = variantFor(col.terrain, col.q, col.r);
      col.sprite = v.sprite;
      col.frame = v.frame;
    }
  }
}

// ----------------------------------------------------------------- render

function resize() {
  const box = document.getElementById('canvas-container');
  const dpr = pixelScale();
  canvas.width = Math.round(box.clientWidth * dpr);
  canvas.height = Math.round(box.clientHeight * dpr);
  ctx.imageSmoothingEnabled = false;
}

function render() {
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#171a21';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.scale(view.scale, view.scale);
  ctx.translate(-Math.round(view.x), -Math.round(view.y));

  // Back to front, exactly as the game does it.
  const columns = [...map].sort((a, b) =>
    (columnBaseY(a.q, a.r) - columnBaseY(b.q, b.r)) || (a.q - b.q));
  for (const col of columns) drawColumn(ctx, res, col);

  if (hover) {
    const { cx, cy } = tileCenter(hover.q, hover.r, Math.max(0, hover.h));
    traceTopFace(ctx, cx, cy);
    ctx.fillStyle = 'rgba(255, 248, 220, 0.18)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 248, 220, 0.85)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  ctx.restore();

  const info = document.getElementById('info');
  if (info) {
    info.textContent = hover
      ? `${hover.q}, ${hover.r} · height ${Math.max(0, hover.h)} · ${map.terrainAt(hover.q, hover.r) || 'empty'}`
      : `${map.size} columns`;
  }

  requestAnimationFrame(render);
}

// ------------------------------------------------------------------ input

const toWorld = e => {
  const rect = canvas.getBoundingClientRect();
  const dpr = pixelScale();
  return {
    x: (e.clientX - rect.left) * dpr / view.scale + view.x,
    y: (e.clientY - rect.top) * dpr / view.scale + view.y,
  };
};

function hexUnder(e) {
  const w = toWorld(e);
  const hit = pickHex(w.x, w.y, heightAt);
  if (hit) return hit;
  // Off the edge of what exists: fall back to the flat lattice so you can
  // paint into empty space.
  const q = Math.round((w.x - GEOM.frameWidth / 2) / GEOM.stepX);
  const r = Math.round((w.y - (q & 1 ? GEOM.oddColumnOffsetY : 0)
    - GEOM.topFaceTop - GEOM.topFaceHeight / 2) / GEOM.stepY);
  return { q, r, h: -1 };
}

function applyStroke(hex, e) {
  const key = `${hex.q},${hex.r}`;
  if (input.lastHex === key) return;
  input.lastHex = key;
  if (input.erasing) lower(hex.q, hex.r);
  else if (e.shiftKey) raise(hex.q, hex.r);
  else paint(hex.q, hex.r);
}

function setupInput() {
  canvas.addEventListener('contextmenu', e => e.preventDefault());

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    input.last = { x: e.clientX, y: e.clientY };
    if (e.button === 1 || e.altKey) { input.panning = true; return; }
    input.painting = e.button === 0;
    input.erasing = e.button === 2;
    input.lastHex = null;
    hover = hexUnder(e);
    applyStroke(hover, e);
  });

  window.addEventListener('pointermove', e => {
    if (input.panning && input.last) {
      const dpr = pixelScale();
      view.x -= (e.clientX - input.last.x) * dpr / view.scale;
      view.y -= (e.clientY - input.last.y) * dpr / view.scale;
      input.last = { x: e.clientX, y: e.clientY };
      return;
    }
    hover = hexUnder(e);
    if (input.painting || input.erasing) applyStroke(hover, e);
  });

  window.addEventListener('pointerup', () => {
    input.painting = input.erasing = input.panning = false;
    input.lastHex = null;
  });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const i = ZOOM_STEPS.indexOf(view.scale);
    const next = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, Math.max(0, i + (e.deltaY > 0 ? -1 : 1)))];
    if (next === view.scale) return;
    const before = toWorld(e);
    view.scale = next;
    const after = toWorld(e);
    view.x += before.x - after.x;
    view.y += before.y - after.y;
  }, { passive: false });

  document.getElementById('btn-save').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(map.toJSON())], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${map.name || 'map'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  document.getElementById('btn-load').addEventListener('click', () =>
    document.getElementById('file-load').click());

  document.getElementById('file-load').addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      map = WorldMap.fromJSON(JSON.parse(ev.target.result));
      resolveAutotiles(map, res.resolvers);
      const { minQ, minR } = map.extent();
      view.x = minQ * GEOM.stepX - 40;
      view.y = minR * GEOM.stepY - 40;
    };
    reader.readAsText(file);
    e.target.value = '';
  });
}

// ------------------------------------------------------------------- boot

async function init() {
  const tileset = await loadTileset();
  res = {
    images: tileset.images,
    resolvers: tileset.resolvers,
    index: tileset.index,
  };

  // Start with a small patch so there is something to paint onto.
  const startW = 10;
  const startD = 8;
  for (let q = 0; q < startW; q++) for (let r = 0; r < startD; r++) map.place(q, r, 'grass', 0);

  buildPalette();
  resize();
  // Open looking at the patch rather than at empty space beside it.
  view.x = (startW * GEOM.stepX - canvas.width / view.scale) / 2;
  view.y = (startD * GEOM.stepY - canvas.height / view.scale) / 2;
  window.addEventListener('resize', resize);
  setupInput();
  requestAnimationFrame(render);

  window.editor = { get map() { return map; }, view, res };
}

init().catch(err => {
  console.error(err);
  document.getElementById('palette').textContent = `failed to load: ${err.message}`;
});
