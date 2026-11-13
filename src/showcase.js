// showcase.js — Interactive visual showcase for the HexGame-mind art revamp.

import { loadTileset, BRIDGE_SHEET, bridgeFrame } from './world/tileset.js';
import { WorldMap } from './world/mapformat.js';
import { tileCenter, columnBaseY, GEOM, neighbor } from './world/hexgrid.js';
import { drawColumn } from './render/columns.js';
import { drawStructure, drawVillage, drawCamp, drawBridgeDeck, drawLadder, drawLadderTop, drawCrossing } from './render/structures.js';
import { drawPawn } from './game/player.js';
import { drawFigure, drawDog } from './render/units.js';

let zoom = 4;
let paused = false;
let nightMode = false;
let raidedMode = false;
let simTime = 0;

function makeBuffer(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return { canvas: c, ctx };
}

function present(targetCanvas, bufCanvas, scale) {
  const w = bufCanvas.width * scale;
  const h = bufCanvas.height * scale;
  if (targetCanvas.width !== w || targetCanvas.height !== h) {
    targetCanvas.width = w;
    targetCanvas.height = h;
  }
  const ctx = targetCanvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(bufCanvas, 0, 0, w, h);
  if (nightMode) {
    ctx.fillStyle = 'rgba(14, 18, 52, 0.34)';
    ctx.fillRect(0, 0, w, h);
  }
}

/** Build a small scenic valley diorama showing every revamped asset together. */
function buildDioramaMap(resolvers) {
  const map = new WorldMap({ seed: 'showcase', resolvers });
  for (let q = 0; q <= 9; q++) {
    for (let r = 0; r <= 5; r++) {
      let terrain = 'grass';
      let h = 2;
      if (r === 4) { terrain = 'river'; h = 0; }
      else if (r === 5) { terrain = 'steppes'; h = 2; }
      else if (q >= 6 && r <= 1) { terrain = 'stony'; h = 5; }
      else if (q === 5 && r === 1) { terrain = 'stony'; h = 4; }
      else if (q === 0 && r === 0) { terrain = 'oak_wood'; h = 2; }
      else if (q === 9 && r === 2) { terrain = 'pine_wood'; h = 3; }
      map.place(q, r, terrain, h);
    }
  }
  // Auto-tile river shorelines
  for (const col of map) {
    if (col.terrain === 'river') {
      let landMask = 0;
      for (let e = 0; e < 6; e++) {
        const nb = map.get(neighbor(col.q, col.r, e).q, neighbor(col.q, col.r, e).r);
        if (!nb || nb.terrain !== 'river') landMask |= (1 << e);
      }
      const sp = resolvers.river(landMask, col.q, col.r);
      col.sprite = sp.sprite;
      col.frame = sp.frame;
    }
  }
  return map;
}

async function main() {
  const tileset = await loadTileset();
  const res = { images: tileset.images, resolvers: tileset.resolvers, index: tileset.index };
  const map = buildDioramaMap(res.resolvers);
  const deckImg = res.images[BRIDGE_SHEET];

  const cards = [];
  function addCard(containerId, label, sub, bw, bh, renderFn) {
    const grid = document.getElementById(containerId);
    const el = document.createElement('div');
    el.className = 'card';
    const canvas = document.createElement('canvas');
    const title = document.createElement('div');
    title.className = 'label';
    title.textContent = label;
    el.appendChild(canvas);
    el.appendChild(title);
    if (sub) {
      const s = document.createElement('div');
      s.className = 'sub';
      s.textContent = sub;
      el.appendChild(s);
    }
    grid.appendChild(el);
    const buf = makeBuffer(bw, bh);
    cards.push({ canvas, buf, bw, bh, renderFn });
  }

  // Helper to draw a single hex pedestal in a card
  function drawPedestal(ctx, sprite, frame, cx, cy, h = 1) {
    for (let lv = 0; lv <= h; lv++) {
      const yOff = cy - 28 - lv * GEOM.wallHeight;
      const img = res.images[sprite];
      if (img) ctx.drawImage(img, frame * 32, 0, 32, 48, cx - 16, yOff, 32, 48);
    }
    return { x: cx, y: cy - h * GEOM.wallHeight };
  }

  // 1. Structures
  const structItems = [
    ['hut', 'Homestead Hut', 'Half-timbered cottage + smoke'],
    ['hearth', 'Stone Hearth', 'Tripod cauldron & sparks'],
    ['workbench', 'Workbench', 'Vice, saw, mallet & shavings'],
    ['watchtower', 'Watchtower', 'Braced tower + swaying lantern'],
    ['forge', 'Stone Forge', 'Anvil, quench barrel & coals'],
    ['shrine', 'Runestone Shrine', 'Orbiting motes & glowing rune'],
    ['palisade', 'Timber Palisade', 'Sharpened stakes & lashings'],
    ['stone_wall', 'Stone Wall', 'Crenellated ashlar masonry'],
  ];
  for (const [id, label, sub] of structItems) {
    addCard('grid-structures', label, sub, 46, 56, (ctx, t) => {
      const top = drawPedestal(ctx, 'Tiles_GrassBase1', 0, 23, 52, 0);
      drawStructure(ctx, top.x, top.y, id, t);
    });
  }

  // 2. Villages & Camps
  const villageItems = [
    ['farmers', 'Farmers Village', 'Farmhouse, granary & hay bale'],
    ['woodcutters', 'Woodcutters', 'Log cabin, stack & chopping block'],
    ['masons', 'Masons Guild', 'Stone hall, A-frame hoist & blocks'],
    ['fishers', 'Fishers Haven', 'Reed cottage & drying rack'],
    ['herbalists', 'Herbalists', 'Moss roof & blooming herb bed'],
    ['smiths', 'Smiths Foundry', 'Smithy arch & hot anvil yard'],
  ];
  for (const [kind, label, sub] of villageItems) {
    addCard('grid-villages', label, sub, 48, 56, (ctx, t) => {
      const top = drawPedestal(ctx, 'Tiles_GrassBase2', 1, 24, 52, 0);
      drawVillage(ctx, top.x, top.y, t, kind, { raided: raidedMode });
    });
  }
  addCard('grid-villages', 'Raider Camp', 'Hide tents, skull stake & war banner', 48, 56, (ctx, t) => {
    const top = drawPedestal(ctx, 'Tiles_Steppes', 2, 24, 52, 0);
    drawCamp(ctx, top.x, top.y, t, { boss: false });
  });
  addCard('grid-villages', 'Warlord Hold', 'Grand pavilion & crowned totem', 48, 60, (ctx, t) => {
    const top = drawPedestal(ctx, 'Tiles_Steppes', 3, 24, 56, 0);
    drawCamp(ctx, top.x, top.y, t, { boss: true });
  });

  // 3. Player Animations
  const playerStates = [
    ['Idle Breathing', 'Cloak sway & ash staff', (t) => ({ t, moving: false })],
    ['Walking Stride', '4-phase stride & billowing cloak', (t) => ({ t, moving: true, legT: (t * 1.4) % 1 })],
    ['Ladder Climbing', 'Alternating hands & boots', (t) => ({ t, moving: true, legT: (t * 1.2) % 1, climbing: true })],
    ['Rowing Boat', 'Wooden coracle & oar stroke', (t) => ({ t, moving: true, legT: (t * 1.1) % 1, boat: true })],
    ['Chopping / Mining', 'Tool arc & impact sparks', (t) => ({ t, action: { kind: 'chop', p: (t * 1.3) % 1 } })],
    ['Combat Slash', 'Blade lunge & crescent arc', (t) => ({ t, action: { kind: 'attack', p: (t * 1.5) % 1 } })],
  ];
  for (const [label, sub, mkState] of playerStates) {
    addCard('grid-player', label, sub, 42, 46, (ctx, t) => {
      const st = mkState(t);
      const top = st.boat
        ? drawPedestal(ctx, 'Tiles_LakeBase', 0, 21, 42, 0)
        : drawPedestal(ctx, 'Tiles_GrassBase1', 0, 21, 42, 0);
      drawPawn(ctx, top.x, top.y, 1, false, st);
    });
  }

  // 4. Ladders
  const ladderSpecs = [
    ['Cliff Face (N)', 'Square-on timber ladder + hooks', 0, false],
    ['Diagonal Cliff (NE)', '2:1 angled cliff face alignment', 1, false],
    ['Diagonal Cliff (NW)', '2:1 left-facing cliff face', 5, false],
    ['Far Lip (S)', 'Hooks & rungs peeking over top', 3, true],
    ['Far Lip (SE)', 'Diagonal far-lip crest', 2, true],
  ];
  for (const [label, sub, edge, farLip] of ladderSpecs) {
    addCard('grid-ladders', label, sub, 64, 68, (ctx) => {
      // Draw lower hex and upper cliff hex in proper 2.5D order
      if (!farLip) {
        const upper = drawPedestal(ctx, 'Tiles_Stony', 1, 32 + (edge === 1 ? 13 : edge === 5 ? -13 : 0), 42, 3);
        const lower = drawPedestal(ctx, 'Tiles_GrassBase1', 0, 32, 58, 0);
        drawLadder(ctx, lower, edge, 3 * GEOM.wallHeight);
      } else {
        const lower = drawPedestal(ctx, 'Tiles_GrassBase1', 0, 32 + (edge === 2 ? 13 : 0), 62, 0);
        const upper = drawPedestal(ctx, 'Tiles_Stony', 2, 32, 46, 3);
        drawLadderTop(ctx, upper, edge);
      }
    });
  }

  // 5. Bridges & Crossings
  for (const [frame, label, sub] of [
    [0, 'Bridge (N–S)', 'Trestle piers, cross-bracing & ripples'],
    [1, 'Bridge (NE–SW)', '13:6 diagonal deck + angled piers'],
    [2, 'Bridge (NW–SE)', '13:6 mirror deck + X-bracing'],
  ]) {
    addCard('grid-bridges', label, sub, 46, 62, (ctx, t) => {
      drawPedestal(ctx, 'Tiles_LakeBase', 0, 23, 56, 0);
      const drop = 16;
      drawBridgeDeck(ctx, deckImg, frame, { x: 23, y: 56 - drop }, drop, t);
    });
  }
  addCard('grid-bridges', 'Raider Crossing', 'Lashed 5-log raft & oar', 46, 52, (ctx, t) => {
    const top = drawPedestal(ctx, 'Tiles_LakeBase', 0, 23, 48, 0);
    drawCrossing(ctx, top.x, top.y, 1, 1, t);
  });

  // 6. Units & Dog
  const unitItems = [
    ['raider', 'Raider', 'Horned helm, shield & hand-axe'],
    ['brute', 'Brute', 'Broad shoulders & heavy cleaver'],
    ['warlord', 'Warlord', 'Flowing cape, crown & war-blade'],
    ['militia', 'Village Militia', 'Kettle helm, shield & spear'],
    ['villager', 'Villager', 'Straw hat & green tunic'],
  ];
  for (const [kind, label, sub] of unitItems) {
    addCard('grid-units', label, sub, 42, 46, (ctx, t) => {
      const top = drawPedestal(ctx, 'Tiles_GrassBase1', 0, 21, 42, 0);
      drawFigure(ctx, top.x, top.y, kind, 1, t, 0, false, true, (t * 1.2) % 1);
    });
  }
  addCard('grid-units', 'Companion Dog', 'Trotting legs, collar & wagging tail', 42, 46, (ctx, t) => {
    const top = drawPedestal(ctx, 'Tiles_GrassBase1', 0, 21, 42, 0);
    drawDog(ctx, top.x, top.y, 1, t);
  });

  // Setup Diorama buffer
  const dioW = 280;
  const dioH = 196;
  const dioBuf = makeBuffer(dioW, dioH);
  const dioCanvas = document.getElementById('diorama');

  function renderDiorama(t) {
    const ctx = dioBuf.ctx;
    ctx.fillStyle = '#171a21';
    ctx.fillRect(0, 0, dioW, dioH);
    ctx.save();
    ctx.translate(4, 24);

    // Collect columns + entities in back-to-front draw order
    const list = [];
    for (const col of map) {
      list.push({ y: columnBaseY(col.q, col.r), x: col.q, layer: 0, col });
    }

    const placeStruct = (q, r, fn) => list.push({ y: columnBaseY(q, r), x: q, layer: 1, fn });

    // Homestead & fortifications (rows 1-3, cols 1-4)
    placeStruct(1, 2, (c) => { const p = tileCenter(1, 2, 2); drawStructure(c, p.cx, p.cy, 'hut', t); });
    placeStruct(2, 2, (c) => { const p = tileCenter(2, 2, 2); drawStructure(c, p.cx, p.cy, 'hearth', t); });
    placeStruct(1, 1, (c) => { const p = tileCenter(1, 1, 2); drawStructure(c, p.cx, p.cy, 'workbench', t); });
    placeStruct(2, 3, (c) => { const p = tileCenter(2, 3, 2); drawStructure(c, p.cx, p.cy, 'stone_wall', t); });
    placeStruct(3, 3, (c) => { const p = tileCenter(3, 3, 2); drawStructure(c, p.cx, p.cy, 'watchtower', t); });
    placeStruct(4, 2, (c) => { const p = tileCenter(4, 2, 2); drawStructure(c, p.cx, p.cy, 'forge', t); });
    placeStruct(4, 1, (c) => { const p = tileCenter(4, 1, 2); drawStructure(c, p.cx, p.cy, 'shrine', t); });
    placeStruct(1, 3, (c) => { const p = tileCenter(1, 3, 2); drawStructure(c, p.cx, p.cy, 'palisade', t); });

    // Trade Villages
    placeStruct(3, 0, (c) => { const p = tileCenter(3, 0, 2); drawVillage(c, p.cx, p.cy, t, 'farmers', { raided: raidedMode }); });
    placeStruct(5, 0, (c) => { const p = tileCenter(5, 0, 2); drawVillage(c, p.cx, p.cy, t, 'herbalists', { raided: raidedMode }); });
    placeStruct(8, 3, (c) => { const p = tileCenter(8, 3, 2); drawVillage(c, p.cx, p.cy, t, 'fishers', { raided: raidedMode }); });

    // Ladders onto stony plateau (q=6..9, r=0..1)
    placeStruct(6, 2, (c) => {
      const p = tileCenter(6, 2, 2);
      drawLadder(c, { x: Math.round(p.cx), y: Math.round(p.cy) }, 0, 3 * GEOM.wallHeight);
    });
    placeStruct(5, 2, (c) => {
      const p = tileCenter(5, 2, 2);
      drawLadder(c, { x: Math.round(p.cx), y: Math.round(p.cy) }, 1, 2 * GEOM.wallHeight);
    });
    placeStruct(7, 1, (c) => {
      const p = tileCenter(7, 1, 5);
      drawStructure(c, p.cx, p.cy, 'shrine', t);
    });

    // Timber Bridge across river at q=3, r=4 + Raider Crossing at q=7, r=4
    placeStruct(3, 4, (c) => {
      const p = tileCenter(3, 4, 2);
      drawBridgeDeck(c, deckImg, 0, { x: p.cx, y: p.cy }, 2 * GEOM.wallHeight, t);
    });
    placeStruct(7, 4, (c) => {
      const p = tileCenter(7, 4, 0);
      drawCrossing(c, p.cx, p.cy, 7, 4, t);
    });

    // Raider Camp on far bank (q=6, r=5)
    placeStruct(6, 5, (c) => {
      const p = tileCenter(6, 5, 2);
      drawCamp(c, p.cx, p.cy, t, { boss: true });
    });

    // Animated explorer + dog walking near hearth & bridge
    placeStruct(3, 2, (c) => {
      const p = tileCenter(3, 2, 2);
      const walk = Math.sin(t * 1.5);
      drawDog(c, Math.round(p.cx - 8), Math.round(p.cy + 3), walk >= 0 ? 1 : -1, t);
      drawPawn(c, Math.round(p.cx + walk * 4), Math.round(p.cy), walk >= 0 ? 1 : -1, false, {
        t, moving: true, legT: (t * 1.4) % 1,
      });
    });

    // Militia & Raider on far bank
    placeStruct(4, 3, (c) => {
      const p = tileCenter(4, 3, 2);
      drawFigure(c, Math.round(p.cx), Math.round(p.cy), 'militia', 1, t, 0, false, false, 0);
    });
    placeStruct(5, 5, (c) => {
      const p = tileCenter(5, 5, 2);
      drawFigure(c, Math.round(p.cx), Math.round(p.cy), 'warlord', -1, t, 0, false, false, 0);
    });
    placeStruct(8, 5, (c) => {
      const p = tileCenter(8, 5, 2);
      drawFigure(c, Math.round(p.cx), Math.round(p.cy), 'raider', -1, t, 0, false, true, (t * 1.2) % 1);
    });

    list.sort((a, b) => (a.y - b.y) || (a.x - b.x) || (a.layer - b.layer));
    for (const item of list) {
      if (item.col) drawColumn(ctx, res, item.col, false, 0);
      else item.fn(ctx);
    }

    ctx.restore();
    present(dioCanvas, dioBuf.canvas, Math.max(2, zoom - 1));
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!paused) simTime += dt;

    renderDiorama(simTime);
    for (const card of cards) {
      card.buf.ctx.fillStyle = '#171a21';
      card.buf.ctx.fillRect(0, 0, card.bw, card.bh);
      card.renderFn(card.buf.ctx, simTime);
      present(card.canvas, card.buf.canvas, zoom);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Wire toolbar controls
  document.querySelectorAll('button[data-zoom]').forEach(btn => {
    btn.addEventListener('click', () => {
      zoom = Number(btn.dataset.zoom);
      document.querySelectorAll('button[data-zoom]').forEach(b => b.classList.toggle('active', b === btn));
    });
  });
  const pauseBtn = document.getElementById('toggle-pause');
  pauseBtn.addEventListener('click', () => {
    paused = !paused;
    pauseBtn.classList.toggle('active', paused);
    pauseBtn.textContent = paused ? 'Resume' : 'Pause';
  });
  const nightBtn = document.getElementById('toggle-night');
  nightBtn.addEventListener('click', () => {
    nightMode = !nightMode;
    nightBtn.classList.toggle('active', nightMode);
  });
  const raidBtn = document.getElementById('toggle-raid');
  raidBtn.addEventListener('click', () => {
    raidedMode = !raidedMode;
    raidBtn.classList.toggle('active', raidedMode);
  });
}

main().catch(err => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f06070;padding:16px">${err.stack || err.message}</pre>`);
});
