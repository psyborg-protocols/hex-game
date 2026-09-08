// main.js — bootstrap, the frame loop, and the wiring between world and UI.

import { loadTileset } from './world/tileset.js';
import { drawStructure, drawVillage } from './render/structures.js';
import { generateWorld } from './world/worldgen.js';
import { findPath } from './world/pathfinding.js';
import { Renderer } from './render/renderer.js';
import { Camera, pixelScale } from './core/camera.js';
import { Rng } from './core/rng.js';
import { Player } from './game/player.js';
import { pickHex, tileCenter, traceTopFace, distance } from './world/hexgrid.js';

import { createState, itemName, RECIPES } from './game/state.js';
import { walkOneStep } from './game/inventory.js';
import { craft } from './game/crafting.js';
import { ensureVillage, buy, sell } from './game/economy.js';
import { determineContext } from './game/context.js';
import { harvest, prospect, build, placementSpots, growCrops, eat, refreshArt } from './game/actions.js';
import { harvestSpec } from './game/harvests.js';
import { saveLocal, loadLocal, writeLocal, downloadSave, readSaveFile } from './game/save.js';

import { UI } from './ui/ui.js';
import { inventoryPanel } from './ui/panels/inventory.js';
import { craftingPanel } from './ui/panels/crafting.js';
import { skillsPanel } from './ui/panels/skills.js';
import { tradePanel } from './ui/panels/trade.js';
import { buildPanel } from './ui/panels/build.js';
import { menuPanel } from './ui/panels/menu.js';


async function boot() {
  const canvas = document.getElementById('view');
  const tileset = await loadTileset();
  const res = {
    images: tileset.images,
    resolvers: tileset.resolvers,
    index: tileset.index,
  };

  // A saved game is restored whole rather than regenerated: by the time you
  // save it, the world is no longer the one its seed produced.
  const params = new URLSearchParams(location.search);
  const restored = params.get('load') === '1' ? loadLocal() : null;

  const seed = restored?.seed || params.get('seed') || String(Date.now());
  const map = restored ? restored.map : generateWorld({ seed, resolvers: res.resolvers });
  const world = { map, resolvers: res.resolvers, seed };
  const rng = new Rng(`${seed}:play`);

  const state = restored ? restored.state : createState();
  const camera = new Camera({ scale: 3 });
  const renderer = new Renderer(canvas, res);
  renderer.resize(camera);

  const player = new Player(map, restored?.player || map.spawn);
  const start = player.restingPos;
  camera.centerOn(start.cx, start.cy);

  let hover = null;
  let follow = true;
  let preview = null;
  let placing = null;          // { recipeId, spots }
  let features = [];           // columns carrying something to draw
  const drag = { active: false, x: 0, y: 0, moved: 0 };

  // ------------------------------------------------------------- the game

  const game = {
    state, world, map, player, camera, rng,
    tileCenter,
    panels: {
      inventory: inventoryPanel,
      crafting: craftingPanel,
      skills: skillsPanel,
      trade: tradePanel,
      build: buildPanel,
      menu: menuPanel,
    },

    /** What crafting needs to know about where the player is standing. */
    craftingContext() {
      const ctx = determineContext(world, state, player);
      const village = ctx.village
        ? (ensureVillage(state, ctx.village.feature, ctx.village.q, ctx.village.r, seed),
          ctx.village.feature)
        : null;
      return { at: { q: player.q, r: player.r }, village, distance };
    },

    doCraft(recipeId) {
      // A build recipe is not made here — it is paid for when it is sited, so
      // crafting it now and again on placement would charge for it twice.
      if (RECIPES[recipeId]?.category === 'build') return game.beginPlacement(recipeId);

      const result = craft(state, recipeId, game.craftingContext());
      if (!result.ok) return game.ui.notify(result.reasons[0]);
      const made = result.produced.map(p => `${p.qty} ${itemName(p.id)}`).join(', ');
      game.ui.notify(`You made ${made}.`);
      announceLevels(result.recipe.skill, result.levelsGained);
      for (const r of result.rented) game.ui.notify(`Paid ${r.fee}g to borrow the ${itemName(r.id)}.`);
      game.ui.refreshPanel();
      refreshContext();
    },

    beginPlacement(recipeId) {
      placing = { recipeId, spots: placementSpots(world, state, player, recipeId) };
      game.ui.closePanel();
      game.ui.clearContext();   // the next click sites the building, not a harvest
      if (!placing.spots.length) {
        placing = null;
        return game.ui.notify('No level ground here to build on.');
      }
      game.ui.notify('Click a highlighted hex to site it. Escape to cancel.');
    },

    doHarvest(id) {
      const spec = harvestSpec(id);
      game.ui.clearContext();
      game.ui.showProgress(spec.verb, 900, player).then(() => {
        const result = harvest(world, state, player, id, rng);
        game.ui.notify(result.message);
        if (result.ok) {
          announceLevels(spec.skill, result.levels);
          if (result.changed?.length) {
            refreshArt(world, result.changed.filter(c => c.terrain !== 'farm'));
            rebuildFeatures();
          }
        }
        refreshContext();
        game.ui.updateHud();
      });
    },

    doProspect() {
      game.ui.clearContext();
      game.ui.showProgress('Prospecting', 1400, player).then(() => {
        const result = prospect(world, state, player, rng);
        game.ui.notify(result.message);
        rebuildFeatures();
        refreshContext();
        game.ui.updateHud();
      });
    },

    doTrade(villageCol) {
      ensureVillage(state, villageCol.feature, villageCol.q, villageCol.r, seed);
      game.ui.openPanel('trade', { village: villageCol });
    },

    doBuy(col, itemId) {
      game.ui.notify(buy(state, col.q, col.r, itemId).message);
      game.ui.refreshPanel();
    },

    doSell(col, itemId) {
      game.ui.notify(sell(state, col.q, col.r, itemId).message);
      game.ui.refreshPanel();
    },

    doEat(itemId) {
      game.ui.notify(eat(state, itemId).message);
      game.ui.refreshPanel();
    },

    doSave() {
      game.ui.notify(saveLocal(world, state, player)
        ? 'Game saved.'
        : 'Could not save — this browser is blocking storage.');
      game.ui.refreshPanel();
    },

    // Loading and world changes go through a reload rather than swapping the
    // map, state and player out from under everything that closed over them.
    doLoad() { location.search = '?load=1'; },
    doNewWorld(newSeed) {
      location.search = `?seed=${encodeURIComponent(newSeed || Date.now())}`;
    },
    doExport() { downloadSave(world, state, player); },

    async doImport(file) {
      try {
        const data = await readSaveFile(file);
        // Park it in the local slot and come back up through the same path a
        // normal load takes, so there is only one way a game gets restored.
        writeLocal(data);
        location.search = '?load=1';
      } catch (err) {
        game.ui.notify(`That is not a save file: ${err.message}`);
      }
    },
  };

  game.ui = new UI(game);
  game.ui.updateHud();

  function announceLevels(skill, levels) {
    for (const l of levels || []) game.ui.notify(`Your ${skill} rises to ${l}.`);
  }

  // --------------------------------------------------------- world drawing

  /** Columns with something standing on them, collected for the depth sort. */
  function rebuildFeatures() {
    features = [];
    for (const col of map) {
      const f = col.feature;
      if (!f) continue;
      if (f.type === 'village') {
        features.push({ q: col.q, r: col.r, draw: (ctx, cx, cy) => drawVillage(ctx, Math.round(cx), Math.round(cy)) });
      } else if (f.type === 'structure') {
        features.push({ q: col.q, r: col.r, draw: (ctx, cx, cy) => drawStructure(ctx, Math.round(cx), Math.round(cy), f.item) });
      } else if (f.type === 'ore' && f.known && f.remaining > 0) {
        features.push({ q: col.q, r: col.r, draw: (ctx, cx, cy) => drawVein(ctx, Math.round(cx), Math.round(cy)) });
      }
    }
  }
  rebuildFeatures();

  function drawVein(ctx, x, y) {
    // A found seam: a couple of bright flecks in the rock, so a revealed vein
    // reads at a glance without needing an icon on the map.
    ctx.fillStyle = '#1b1420';
    ctx.fillRect(x - 4, y - 4, 9, 6);
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(x - 3, y - 3, 3, 2);
    ctx.fillRect(x + 1, y - 1, 3, 2);
    ctx.fillStyle = '#f0dc8a';
    ctx.fillRect(x - 3, y - 3, 1, 1);
  }

  const drawOverlays = ctx => {
    if (placing) {
      for (const spot of placing.spots) {
        const { cx, cy } = tileCenter(spot.q, spot.r, spot.h);
        traceTopFace(ctx, cx, cy);
        ctx.fillStyle = 'rgba(217, 180, 91, 0.28)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(217, 180, 91, 0.9)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      return;
    }
    if (!preview || preview.length < 2) return;
    ctx.fillStyle = 'rgba(255, 248, 220, 0.5)';
    for (let i = 1; i < preview.length; i++) {
      const { cx, cy } = tileCenter(preview[i].q, preview[i].r, Math.max(0, map.heightAt(preview[i].q, preview[i].r)));
      ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 2, 2);
    }
  };

  // --------------------------------------------------------------- context

  function refreshContext() {
    if (player.moving || placing) return game.ui.clearContext();
    const ctx = determineContext(world, state, player);
    game.ui.setContext(ctx.offers, player, offer => {
      if (offer.kind === 'harvest') game.doHarvest(offer.id);
      else if (offer.kind === 'prospect') game.doProspect();
      else if (offer.kind === 'trade') game.doTrade(offer.village);
    });
  }

  player.onStep = () => {
    const hunger = walkOneStep(state);
    if (hunger.ate) game.ui.notify(`You eat some ${itemName(hunger.ate)}.`);
    if (hunger.hungry) game.ui.notify('You are hungry.');
    if (hunger.starving) game.ui.notify('You are starving.');
    const grown = growCrops(world, state);
    if (grown.length) rebuildFeatures();
    game.ui.updateHud();
  };

  // ----------------------------------------------------------------- input

  const worldAt = e => {
    const rect = canvas.getBoundingClientRect();
    const d = pixelScale();
    return camera.screenToWorld((e.clientX - rect.left) * d, (e.clientY - rect.top) * d);
  };
  const hexAt = e => {
    const w = worldAt(e);
    return pickHex(w.x, w.y, (q, r) => map.heightAt(q, r));
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
        camera.panBy(-dx * pixelScale() / camera.scale, -dy * pixelScale() / camera.scale);
        follow = false;
      }
      drag.x = e.clientX;
      drag.y = e.clientY;
    }
    const hit = hexAt(e);
    const moved = !hit !== !hover || (hit && hover && (hit.q !== hover.q || hit.r !== hover.r));
    hover = hit;
    if (moved && !placing) {
      preview = hover && !player.moving ? findPath(map, player, hover) : null;
    }
  });

  canvas.addEventListener('pointerup', e => {
    canvas.releasePointerCapture(e.pointerId);
    const wasDrag = drag.moved > 4;
    drag.active = false;
    if (wasDrag) return;

    const target = hexAt(e);
    if (!target) return;

    if (placing) {
      const result = build(world, state, player, placing.recipeId, target, game.craftingContext());
      game.ui.notify(result.message);
      if (result.ok) {
        announceLevels(RECIPES[placing.recipeId].skill, result.levels);
        placing = null;
        rebuildFeatures();
        refreshContext();
        game.ui.updateHud();
      }
      return;
    }

    const route = findPath(map, player, target);
    if (!route) return game.ui.notify('No way through.');
    follow = true;
    preview = null;
    game.ui.clearContext();
    player.follow(route, refreshContext);
  });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const d = pixelScale();
    if (camera.zoom(e.deltaY > 0 ? -1 : 1,
      (e.clientX - rect.left) * d, (e.clientY - rect.top) * d, canvas.width, canvas.height)) {
      renderer.resize(camera);
    }
  }, { passive: false });

  window.addEventListener('resize', () => renderer.resize(camera));
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (placing) { placing = null; refreshContext(); }
      else player.stop();
    }
    if (e.key === 'c') follow = true;
    if (e.key === 'i') game.ui.togglePanel('inventory');
    if (e.key === 'k') game.ui.togglePanel('crafting');
    if (e.key === 'b') game.ui.togglePanel('build');
  });

  // ------------------------------------------------------------ frame loop

  const hudTerrain = document.getElementById('hud-terrain');
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
      hover: placing ? null : hover,
      entities: [...features, player],
      overlays: [drawOverlays],
    });

    game.ui.positionAnchors(camera, map, pixelScale());

    if (hudTerrain) {
      const col = hover && map.get(hover.q, hover.r);
      hudTerrain.textContent = col
        ? `${col.terrain.replace(/_/g, ' ')} · height ${col.h}`
        : '';
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  refreshContext();

  // Autosave, so a closed tab does not cost an evening. Quiet on failure — the
  // Game panel is where saving is meant to be confirmed.
  setInterval(() => saveLocal(world, state, player), 45000);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveLocal(world, state, player);
  });

  // A handle for poking at a running game from the console.
  game.renderer = renderer;
  game.getPlacing = () => placing;
  window.game = game;
}

boot().catch(err => {
  console.error(err);
  document.getElementById('hud-stats').textContent = `boot failed: ${err.message}`;
});
