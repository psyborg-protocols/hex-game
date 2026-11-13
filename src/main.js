// main.js — bootstrap, the frame loop, and the wiring between world and UI.

import { loadTileset, BRIDGE_SHEET, bridgeFrame, isWater } from './world/tileset.js';
import { loadDecor } from './render/decor.js';
import { drawStructure, drawVillage, drawCamp, drawBridgeDeck, drawLadder, drawLadderTop, drawCrossing, hpBar } from './render/structures.js';
import { drawUnit, unitPos, drawDog } from './render/units.js';
import { generateWorld } from './world/worldgen.js';
import { findPath, isBridged } from './world/pathfinding.js';
import { Renderer } from './render/renderer.js';
import { Camera, pixelScale } from './core/camera.js';
import { Rng } from './core/rng.js';
import { Player } from './game/player.js';
import { pickHex, pointInHex, tileCenter, traceTopFace, distance, neighbors, GEOM } from './world/hexgrid.js';

import { createState, itemName, RECIPES, ITEMS, dayOf, moonOf, isNight, DAY_LENGTH, hasBuilt } from './game/state.js';
import { walkOneStep, recomputeEnergy, countItem, removeItem, foodValue } from './game/inventory.js';
import { craft } from './game/crafting.js';
import { ensureVillage, buy, sell, giveFavour, villageContext, isTrusted, isRaided } from './game/economy.js';
import { determineContext, villageNear } from './game/context.js';
import { harvest, prospect, build, placementSpots, growCrops, refreshArt, penaltyOnDeath } from './game/actions.js';
import { harvestSpec } from './game/harvests.js';
import { saveLocal, loadLocal, writeLocal, downloadSave, readSaveFile } from './game/save.js';
import { ensureMind, isKnown, HIDDEN } from './game/discovery.js';
import { onStep as mindStep, onExplored, onTrade } from './game/mind.js';
import { Explorer } from './game/explorer.js';
import { attackDice, reach, maxHp } from './game/gear.js';
import { levelOf } from './game/skills.js';
import { checkJourney, STAGES } from './game/journey.js';
import {
  updateUnits, garrisonCamps, guardsAt, hostiles, strike, spoils, rally, burnCamp,
  campsLeft, ensureRaidState, raidSize, abroad, KINDS,
} from './game/raiders.js';
import { drawExploreCharge, Pings, loadResourceIcons, drawResourceIcons, drawScenicRings } from './render/discovery_fx.js';
import { chime } from './ui/chime.js';

import { UI } from './ui/ui.js';
import { inventoryPanel } from './ui/panels/inventory.js';
import { craftingPanel } from './ui/panels/crafting.js';
import { skillsPanel } from './ui/panels/skills.js';
import { tradePanel } from './ui/panels/trade.js';
import { buildPanel } from './ui/panels/build.js';
import { menuPanel } from './ui/panels/menu.js';
import { stashPanel } from './ui/panels/stash.js';
import { messagePanel, HOW_TO_PLAY } from './ui/panels/message.js';

/** Seconds between your swings. */
const PLAYER_COOLDOWN = 1.1;

async function boot() {
  const canvas = document.getElementById('view');
  const [tileset, decor] = await Promise.all([loadTileset(), loadDecor()]);
  const res = { images: tileset.images, decor, resolvers: tileset.resolvers, index: tileset.index };

  const params = new URLSearchParams(location.search);
  const restored = params.get('load') === '1' ? loadLocal() : null;

  const seed = restored?.seed || params.get('seed') || String(Date.now());
  const map = restored ? restored.map : generateWorld({ seed, resolvers: res.resolvers });
  const world = { map, resolvers: res.resolvers, seed };
  const rng = new Rng(`${seed}:play`);

  const state = restored ? restored.state : createState();
  if (params.get('free') === '1') state.free = true;
  ensureMind(state);
  state.stats ||= {};
  state.trust ||= {};
  state.goals ||= {};
  state.stash ||= new Array(16).fill(null);
  if (state.hp == null) state.hp = maxHp(state);
  ensureRaidState(state);
  if (!restored) garrisonCamps(map, state);
  recomputeEnergy(state);

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
  let features = [];
  let eye = false;
  let swing = 0;               // seconds until you can strike again
  let regen = 0;
  let cropClock = 0;
  let hudClock = 0;
  let saveClock = 0;
  let combatUntil = 0;         // world time; regen pauses while fighting
  let dead = false;
  const explorer = new Explorer(map, state);
  const pings = new Pings();
  const resourceIcons = loadResourceIcons();
  const drag = { active: false, x: 0, y: 0, moved: 0 };

  const hasBoat = () => countItem(state, 'boat') > 0 || state.free;
  const pathOpts = () => ({ boat: hasBoat() });
  const playerPos = () => player.pos;
  const unitAnchor = u => () => unitPos(map, u);

  // ------------------------------------------------------------- the game

  const game = {
    state, world, map, player, camera, rng, tileCenter,
    panels: {
      inventory: inventoryPanel, crafting: craftingPanel, skills: skillsPanel, trade: tradePanel,
      build: buildPanel, menu: menuPanel, stash: stashPanel, message: messagePanel,
    },

    /** What crafting needs to know about where the player is standing. */
    craftingContext() {
      const vcol = villageNear(map, player);
      if (vcol) ensureVillage(state, vcol.feature, vcol.q, vcol.r, seed);
      return { at: { q: player.q, r: player.r }, village: villageContext(state, vcol), distance };
    },

    doCraft(recipeId) {
      if (RECIPES[recipeId]?.category === 'build') return game.beginPlacement(recipeId);
      const result = craft(state, recipeId, game.craftingContext());
      if (!result.ok) return game.ui.notify(result.reasons[0]);
      const made = result.produced.map(p => `${p.qty} ${itemName(p.id)}`).join(', ');
      game.ui.notify(`+ ${made}`, 3200, 'gain');
      if (/^(cook_|stew|fish_stew)/.test(recipeId)) state.stats.cooked = (state.stats.cooked || 0) + 1;
      if (/^smelt/.test(recipeId)) state.stats.smelted = (state.stats.smelted || 0) + 1;
      chime('tick', 0.05);
      announceLevels(result.recipe.skill, result.levelsGained);
      afterChange();
    },

    beginPlacement(recipeId) {
      placing = { recipeId, spots: placementSpots(world, state, player, recipeId) };
      game.ui.closePanel();
      game.ui.clearContext();
      if (!placing.spots.length) {
        const out = Object.keys(RECIPES[recipeId].output)[0];
        placing = null;
        return game.ui.notify(out === 'ladder' ? 'A ladder wants a cliff beside you, too high to climb.'
          : out === 'bridge' ? 'A bridge wants the water’s edge, and a far bank within nine hexes.'
            : 'No level, open ground here.');
      }
    },

    doHarvest(id) {
      const spec = harvestSpec(id);
      game.ui.clearContext();
      const ms = { fell_tree: 1100, mine_cliff: 1200, mine_ore: 1200, hunt: 1300 }[id] || 800;
      const animKind = id === 'fell_tree' ? 'chop' : (id === 'mine_cliff' || id === 'mine_ore') ? 'mine' : 'forage';
      player.triggerAction(animKind, ms / 1000);
      game.ui.showProgress(spec.verb, ms, player).then(ok => {
        if (!ok) return;
        const result = harvest(world, state, player, id, rng);
        if (result.ok) {
          game.ui.floatText(playerPos, result.message, 'gain');
          if (id === 'harvest_field') state.stats.reaped = (state.stats.reaped || 0) + 1;
          announceLevels(spec.skill, result.levels);
          if (result.changed?.length) {
            refreshArt(world, result.changed.filter(c => c.terrain !== 'farm'));
            rebuildFeatures();
          }
        } else game.ui.notify(result.message);
        afterChange();
      });
    },

    doProspect() {
      game.ui.clearContext();
      player.triggerAction('forage', 1.4);
      game.ui.showProgress('Reading the rock', 1400, player).then(() => {
        const result = prospect(world, state, player);
        game.ui.notify(result.message);
        if (result.found?.length) chime('silver');
        announceLevels('metalworking', result.levels);
        rebuildFeatures();
        afterChange();
      });
    },

    doTrade(villageCol) {
      ensureVillage(state, villageCol.feature, villageCol.q, villageCol.r, seed);
      game.ui.openPanel('trade', { village: villageCol });
    },

    doFavour(col) {
      const result = giveFavour(state, col);
      game.ui.notify(result.message);
      if (result.ok) {
        chime('gold');
        const r = onTrade(world, state, col);
        announceMind(r);
        game.ui.murmur(`${col.feature.name} trusts you.`, { tone: 'good', ms: 5200 });
      }
      afterChange();
    },

    doBuy(col, itemId) {
      const result = buy(state, col, itemId);
      game.ui.notify(result.message);
      afterChange();
    },

    doSell(col, itemId) {
      const result = sell(state, col, itemId);
      game.ui.notify(result.message);
      afterChange();
    },

    doBurn(camp) {
      if (guardsAt(state, camp)) return game.ui.notify('Its guards still stand.');
      game.ui.clearContext();
      game.ui.showProgress('Torching the camp', 1600, player).then(() => {
        const { gold } = burnCamp(state, camp);
        rebuildFeatures();
        chime('gold');
        const left = campsLeft(map).length;
        game.ui.ping({ kind: 'victory', title: `${camp.feature.name} burns`, sub: left ? `${left} left` : '' });
        game.ui.floatText(playerPos, `+${gold} gold`, 'gain');
        afterChange();
        if (!campsLeft(map).length && !state.won) victory();
      });
    },

    toggleEye() { eye = !eye; game.ui.setEye(eye); },

    doToggleFree() {
      state.free = !state.free;
      recomputeEnergy(state);
      game.ui.notify(state.free ? 'Free resources on — nothing costs anything.' : 'Free resources off.');
      afterChange();
    },

    doSave() {
      game.ui.notify(saveLocal(world, state, player) ? 'Game saved.' : 'Could not save — this browser is blocking storage.');
      game.ui.refreshPanel();
    },
    doLoad() { location.search = '?load=1'; },
    doNewWorld(newSeed) { location.search = `?seed=${encodeURIComponent(newSeed || Date.now())}`; },
    doExport() { downloadSave(world, state, player); },
    async doImport(file) {
      try {
        writeLocal(await readSaveFile(file));
        location.search = '?load=1';
      } catch (err) {
        game.ui.notify(`That is not a save file: ${err.message}`);
      }
    },

    showHelp(first = false) {
      game.ui.openPanel('message', {
        title: first ? 'Hex Quest' : 'How to play',
        html: HOW_TO_PLAY,
        buttons: [{ label: first ? 'Begin' : 'Back to the game' }],
      });
    },

    onPanelClosed() { refreshContext(); },
  };

  game.ui = new UI(game);
  game.ui.updateHud();

  function afterChange() {
    const j = checkJourney(state, world);
    for (const g of j.goals) game.ui.ping({ kind: 'goal', title: g.text });
    for (const st of j.stages) {
      const i = STAGES.indexOf(st);
      const next = STAGES[i + 1];
      if (next) game.ui.ping({ kind: 'stage', kicker: `Chapter ${i + 2}`, title: next.name, sub: next.blurb });
    }
    game.ui.refreshPanel();
    game.ui.updateHud();
    refreshContext();
  }

  function announceLevels(skill, levels) {
    for (const l of levels || []) game.ui.ping({ kind: 'level', title: `${skill} ${l}` });
    if (levels?.length) game.ui.nudge('crafting');
  }

  function announceMind(result) {
    for (const m of result.moments) game.ui.ping(m);
    announceLevels('mind', result.levels);
  }

  function explored(done, now) {
    const result = onExplored(world, state, done);
    if (!result.found) return;
    pings.add(done.q, done.r, result.found.tier, now);
    if (!result.found.tier) chime('tick', 0.035);
    const finds = result.found.resources.map(id => itemName(HIDDEN[id].icon));
    if (finds.length) game.ui.floatText(playerPos, `found ${finds.join(', ')}`, 'find');
    if (result.found.oreSign) game.ui.notify('Ore glints in the rock near here.');
    announceMind(result);
    afterChange();
  }

  // --------------------------------------------------------- world drawing

  function rebuildFeatures() {
    features = [];
    const deck = res.images[BRIDGE_SHEET];
    for (const col of map) {
      const f = col.feature;
      if (!f) continue;
      if (f.type === 'village') {
        features.push({ q: col.q, r: col.r, draw: (ctx, cx, cy) => drawVillage(ctx, Math.round(cx), Math.round(cy), performance.now() / 1000, f.kind, { raided: isRaided(state, col.q, col.r) }) });
      } else if (f.type === 'camp') {
        features.push({ q: col.q, r: col.r, draw: (ctx, cx, cy) => drawCamp(ctx, Math.round(cx), Math.round(cy), performance.now() / 1000, f) });
      } else if (f.type === 'structure' && f.item === 'ladder') {
        // Drawn below from map.structures, against the face it climbs.
      } else if (f.type === 'structure') {
        features.push({ q: col.q, r: col.r, draw: (ctx, cx, cy) => drawStructure(ctx, Math.round(cx), Math.round(cy), f.item, performance.now() / 1000, f) });
      } else if (f.type === 'field' && f.hp < f.maxHp) {
        features.push({ q: col.q, r: col.r, draw: (ctx, cx, cy) => hpBar(ctx, Math.round(cx), Math.round(cy) - 8, f.hp / f.maxHp, '#d9b45b') });
      } else if (f.type === 'crossing') {
        features.push({ q: col.q, r: col.r, draw: (ctx, cx, cy) => drawCrossing(ctx, Math.round(cx), Math.round(cy), col.q, col.r, performance.now() / 1000) });
      } else if (f.type === 'ore' && f.known && f.remaining > 0) {
        features.push({ q: col.q, r: col.r, draw: (ctx, cx, cy) => drawVein(ctx, Math.round(cx), Math.round(cy)) });
      }
    }
    for (const s of map.structures) {
      if (s.type === 'ladder') {
        const edge = neighbors(s.from.q, s.from.r).findIndex(n => n.q === s.to.q && n.r === s.to.r);
        if (edge < 0) continue;
        // Heights are read as it is drawn: mining the face shortens the ladder.
        const centre = c => { const p = tileCenter(c.q, c.r, Math.max(0, map.heightAt(c.q, c.r))); return { x: Math.round(p.cx), y: Math.round(p.cy) }; };
        if (edge === 0 || edge === 1 || edge === 5) {
          // The face is turned towards us: the ladder stands on the foot hex.
          features.push({ q: s.from.q, r: s.from.r, draw: ctx => drawLadder(ctx, centre(s.from), edge,
            Math.max(0, map.heightAt(s.to.q, s.to.r) - map.heightAt(s.from.q, s.from.r)) * GEOM.wallHeight) });
        } else {
          // The face is turned away: only the top shows, over the far lip.
          features.push({ q: s.to.q, r: s.to.r, draw: ctx => drawLadderTop(ctx, centre(s.to), (edge + 3) % 6) });
        }
      }
      if (s.type !== 'bridge') continue;
      for (const t of s.tiles) {
        const at = map.bridgeAt(t.q, t.r);
        if (!at) continue;
        const { cx, cy } = tileCenter(t.q, t.r, at.h);
        const drop = Math.max(0, at.h - Math.max(0, map.heightAt(t.q, t.r))) * GEOM.wallHeight;
        features.push({ q: t.q, r: t.r, h: at.h, draw: ctx => drawBridgeDeck(ctx, deck, bridgeFrame(s.edge ?? 0), { x: cx, y: cy }, drop, performance.now() / 1000) });
      }
    }
  }
  rebuildFeatures();

  function drawVein(ctx, x, y) {
    ctx.fillStyle = '#1b1420';
    ctx.fillRect(x - 4, y - 4, 9, 6);
    ctx.fillStyle = '#c9a227';
    ctx.fillRect(x - 3, y - 3, 3, 2);
    ctx.fillRect(x + 1, y - 1, 3, 2);
    ctx.fillStyle = '#f0dc8a';
    ctx.fillRect(x - 3, y - 3, 1, 1);
  }

  const unitEntities = () => (state.units || []).map(u => ({
    q: u.q, r: u.r,
    draw: ctx => drawUnit(ctx, map, u, performance.now()),
  }));

  const chargeEntity = now => (explorer.charge
    ? [{ q: explorer.charge.q, r: explorer.charge.r, draw: ctx => drawExploreCharge(ctx, map, explorer.charge, now) }]
    : []);

  const dogEntity = () => {
    if (!countItem(state, 'dog')) return [];
    const p = player.pos;
    return [{ q: player.q, r: player.r, draw: ctx => drawDog(ctx, p.x - player.facing * 9, p.y + 3, player.facing, performance.now() / 1000) }];
  };

  /** A bridge is highlighted where its deck will be, not down on the water. */
  const spotHeight = (spot, t) => (spot.span ? spot.span.h : Math.max(0, t.h));

  const drawOverlays = (ctx) => {
    if (placing) {
      for (const spot of placing.spots) {
        const tiles = spot.span ? spot.span.tiles : [spot];
        for (const t of tiles) {
          const { cx, cy } = tileCenter(t.q, t.r, spotHeight(spot, t));
          traceTopFace(ctx, cx, cy);
          ctx.fillStyle = t === tiles[0] ? 'rgba(217, 180, 91, 0.32)' : 'rgba(217, 180, 91, 0.12)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(217, 180, 91, 0.9)';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
      return;
    }
    // The raid that is coming: the way it will take, and what it is after.
    const raid = state.raid;
    if (raid && (raid.stage === 'omen' || raid.stage === 'night')) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
      if (raid.route && raid.route.length > 1) {
        // A dashed red line from their camp to what they are after, the dashes
        // marching the way the band will. It has to be legible at a glance
        // from any zoom: it is the one thing that says where to build.
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'butt';
        ctx.beginPath();
        raid.route.forEach((s, i) => {
          const { cx, cy } = tileCenter(s.q, s.r, Math.max(0, map.surfaceAt(s.q, s.r)));
          if (i) ctx.lineTo(Math.round(cx), Math.round(cy)); else ctx.moveTo(Math.round(cx), Math.round(cy));
        });
        ctx.strokeStyle = 'rgba(24, 8, 14, 0.7)';
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.setLineDash([5, 4]);
        ctx.lineDashOffset = -(performance.now() / 70) % 9;
        ctx.strokeStyle = 'rgba(240, 96, 112, 0.95)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
      }
      if (raid.target) {
        const { cx, cy } = tileCenter(raid.target.q, raid.target.r, Math.max(0, map.surfaceAt(raid.target.q, raid.target.r)));
        traceTopFace(ctx, cx, cy);
        ctx.fillStyle = `rgba(209, 89, 109, ${0.12 + pulse * 0.14})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(240, 96, 112, ${0.6 + pulse * 0.4})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    // Your health, over your head, when you are hurt.
    if (state.hp < maxHp(state)) {
      const p = player.pos;
      hpBar(ctx, Math.round(p.x), Math.round(p.y) - 20, state.hp / maxHp(state), '#7ad15a');
    }
    if (!preview || preview.length < 2) return;
    ctx.fillStyle = 'rgba(255, 248, 220, 0.5)';
    for (let i = 1; i < preview.length; i++) {
      const { cx, cy } = tileCenter(preview[i].q, preview[i].r, Math.max(0, map.surfaceAt(preview[i].q, preview[i].r)));
      ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 2, 2);
    }
  };

  /** Night falls over the last quarter of each day. */
  const nightShade = (ctx) => {
    const { frac } = dayOf(state);
    let a = 0;
    if (frac > 0.72) a = Math.min(1, (frac - 0.72) / 0.06);
    if (frac > 0.96) a = Math.max(0, 1 - (frac - 0.96) / 0.04);
    if (a <= 0) return;
    ctx.fillStyle = `rgba(14, 18, 52, ${0.38 * a})`;
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  };

  /** Red arrows at the screen edge pointing at raiders you cannot see. */
  const edgeArrows = (ctx, cam) => {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    const m = 26 * pixelScale();
    const cxs = W / 2, cys = H / 2;
    for (const u of hostiles(state)) {
      if (u.mode === 'guard') continue;
      const wp = unitPos(map, u);
      const p = cam.worldToScreen(wp.x, wp.y);
      if (p.x > 0 && p.y > 0 && p.x < W && p.y < H) continue;
      const ang = Math.atan2(p.y - cys, p.x - cxs);
      const k = Math.min((W / 2 - m) / Math.abs(Math.cos(ang) || 1e-6), (H / 2 - m) / Math.abs(Math.sin(ang) || 1e-6));
      const x = cxs + Math.cos(ang) * k, y = cys + Math.sin(ang) * k;
      const s = 9 * pixelScale();
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.fillStyle = 'rgba(209, 89, 109, 0.92)';
      ctx.strokeStyle = 'rgba(20, 10, 14, 0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s, 0); ctx.lineTo(-s, -s * 0.8); ctx.lineTo(-s * 0.4, 0); ctx.lineTo(-s, s * 0.8);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  };

  // --------------------------------------------------------------- context

  function refreshContext() {
    if (player.moving || placing || dead) return game.ui.clearContext();
    const ctx = determineContext(world, state, player, { guardsLeft: c => guardsAt(state, c) });
    game.ui.setContext(ctx.offers, player, offer => {
      if (offer.kind === 'harvest') game.doHarvest(offer.id);
      else if (offer.kind === 'prospect') game.doProspect();
      else if (offer.kind === 'trade') game.doTrade(offer.village);
      else if (offer.kind === 'stash') game.ui.openPanel('stash');
      else if (offer.kind === 'burn') game.doBurn(offer.camp);
    });
  }

  player.speedAt = (from, to) => {
    const a = map.get(from.q, from.r), b = map.get(to.q, to.r);
    let m = 1;
    if (b && isWater(b.terrain) && !isBridged(map, to)) m *= 0.65;
    if (a?.terrain === 'path' && b?.terrain === 'path' && countItem(state, 'cart')) m *= 1.6;
    if (state.energy <= 0 && foodValue(state) === 0 && !state.free) m *= 0.55;
    return m;
  };

  player.onStep = () => {
    const col = map.get(player.q, player.r);
    const step = walkOneStep(state, { cartOnRoad: col?.terrain === 'path' && countItem(state, 'cart') > 0 });
    if (step.exhausted && state.stepsWalked % 10 === 0) game.ui.notify('You are starving.', 3600, 'bad');
    if (col && (isWater(col.terrain) || isBridged(map, player)) && !state.stats.crossed) state.stats.crossed = 1;
    announceMind(mindStep(world, state, player));
    maybeRally();
    afterChangeLight();
  };

  /** A step is too frequent for the full refresh; just the cheap parts. */
  function afterChangeLight() {
    const j = checkJourney(state, world);
    for (const g of j.goals) game.ui.ping({ kind: 'goal', title: g.text });
    for (const st of j.stages) {
      const next = STAGES[STAGES.indexOf(st) + 1];
      if (next) game.ui.ping({ kind: 'stage', kicker: `Chapter ${STAGES.indexOf(st) + 2}`, title: next.name, sub: next.blurb });
    }
    game.ui.updateHud();
  }

  /** Carry the banner near a camp and the villages that trust you come. */
  function maybeRally() {
    if (!countItem(state, 'rally_banner')) return;
    const camp = campsLeft(map).find(c => distance(c.q, c.r, player.q, player.r) <= 4);
    if (!camp) return;
    state.rallied ||= {};
    const k = `${camp.q},${camp.r}`;
    if (state.rallied[k]) return;
    const trusted = Object.values(state.trust).filter(t => t.done).length;
    if (!trusted) return;
    state.rallied[k] = 1;
    const n = rally(state, player, map, trusted);
    if (n) game.ui.murmur(`${n} from the villages stand with you.`, { tone: 'good', ms: 6000 });
  }

  // ----------------------------------------------------------------- combat

  function nearestFoe() {
    let best = null;
    for (const u of hostiles(state)) {
      const d = distance(u.q, u.r, player.q, player.r);
      if (d > reach(state)) continue;
      if (!best || d < best.d) best = { u, d };
    }
    return best?.u || null;
  }

  function playerStrikes(dt) {
    swing -= dt;
    if (swing > 0 || player.moving || dead) return;
    const foe = nearestFoe();
    if (!foe) return;
    swing = PLAYER_COOLDOWN;
    combatUntil = state.time + 4;
    if (foe.q !== player.q) player.facing = foe.q > player.q ? 1 : -1;
    player.triggerAction('attack', 0.45);
    const roll = strike(state, foe, attackDice(state));
    foe.hitAt = performance.now();
    game.ui.showDice(unitAnchor(foe), roll, { friendly: true });
    if (foe.hp <= 0) fell(foe, 'player');
  }

  function fell(u, by) {
    if (u.faction !== 'raider') {
      game.ui.notify('One of the villagers has fallen.', 4200, 'bad');
      return;
    }
    if (by === 'player' || by === 'tower' || by?.faction === 'ally') {
      const got = spoils(state, u);
      game.ui.floatText(unitAnchor(u), got.text, 'gain');
      if (u.kind === 'warlord') {
        state.stats.warlord = true;
        game.ui.ping({ kind: 'victory', title: 'The Warlord is dead' });
      } else chime('copper', 0.05);
    }
    afterChange();
  }

  function handleEvents(events) {
    for (const e of events) {
      if (e.type === 'omen') {
        const where = e.target?.kind === 'village' ? 'a village' : 'your homestead';
        const waves = e.waves.length > 1 ? ` in ${e.waves.length} waves` : '';
        game.ui.ping({ kind: 'raid', title: `${e.tower ? 'Fires at' : 'Smoke over'} ${e.from.name}`, sub: `${e.size} of them tonight${waves}, for ${where}` });
      } else if (e.type === 'nightfall') {
        chime('raid');
      } else if (e.type === 'raid') {
        // The line under the moon counts them; nothing more needs saying.
      } else if (e.type === 'held' || e.type === 'dawn') {
        const felled = e.felled ? `${e.felled} of them fell` : '';
        const when = e.type === 'dawn' ? 'Dawn' : 'They have gone';
        if (e.lost) game.ui.ping({ kind: 'raid', title: `${when}. The night cost you`, sub: felled });
        else game.ui.ping({ kind: 'victory', title: `${when}. The valley held`, sub: felled });
        afterChange();
      } else if (e.type === 'clash') {
        if (e.target === 'player') {
          combatUntil = state.time + 4;
          e.who.facing = player.q >= e.who.q ? 1 : -1;
          game.ui.showDice(playerPos, e.roll);
          if (e.roll.damage) chime('tick', 0.03);
        } else if (e.target.faction) {
          e.target.hitAt = performance.now();
          game.ui.showDice(unitAnchor(e.target), e.roll, { friendly: e.target.faction === 'raider' });
        }
      } else if (e.type === 'arrow') {
        e.who.hitAt = performance.now();
        game.ui.showDice(unitAnchor(e.who), e.roll, { friendly: true });
      } else if (e.type === 'fell') {
        fell(e.unit, e.by);
      } else if (e.type === 'destroyed') {
        game.ui.notify(`The ${itemName(e.item).toLowerCase()} is down${e.loot?.length ? ', and the stash is gone' : ''}.`, 5200, 'bad');
        rebuildFeatures();
        refreshArt(world, [map.get(e.q, e.r)].filter(Boolean));
        afterChange();
      } else if (e.type === 'ransack') {
        // hp bars show it
      } else if (e.type === 'villageRaided') {
        game.ui.notify(`${e.name} has been raided.`, 5200, 'bad');
      }
    }
  }

  function updateAlert() {
    const raid = state.raid;
    const m = moonOf(state);
    const out = abroad(state).length;
    const clock = s => { const t = Math.max(0, Math.round(s)); return t >= 60 ? `${Math.floor(t / 60)}m ${String(t % 60).padStart(2, '0')}s` : `${t}s`; };
    if (raid?.stage === 'night') {
      const left = raid.waves.length - raid.sent;
      const more = left ? `, ${left} more wave${left > 1 ? 's' : ''} to come` : '';
      game.ui.setAlert(`${out} abroad${more} · dawn in ${clock(m.dawnAt - state.time)}`, 'raid');
    } else if (raid?.stage === 'omen') {
      game.ui.setAlert(`${raidSize(raid.waves)} at dusk · ${clock(m.duskAt - state.time)}`, 'omens');
    } else if (out) {
      game.ui.setAlert(`${out} still abroad`, 'omens');
    } else game.ui.setAlert('');
  }

  function healthTick(dt) {
    if (dead) return;
    const max = maxHp(state);
    if (state.hp > max) state.hp = max;
    // Salve, when it matters.
    if (state.hp <= Math.min(4, max / 3) && countItem(state, 'salve')) {
      removeItem(state, 'salve', 1);
      state.hp = Math.min(max, state.hp + ITEMS.salve.heal);
      game.ui.floatText(playerPos, '+5 salve', 'heal');
    }
    if (state.hp <= 0) return die();
    if (state.hp >= max) { regen = 0; return; }
    const near = item => state.built.some(b => b.item === item && distance(b.q, b.r, player.q, player.r) <= (item === 'shrine' ? 2 : 1));
    const home = near('hearth') || near('hut') || near('shrine');
    const fighting = state.time < combatUntil;
    if (fighting && !near('shrine')) return;
    regen += dt;
    const every = home ? 1.2 : (state.energy > 0 ? 6 : Infinity);
    if (regen >= every) { regen = 0; state.hp = Math.min(max, state.hp + 1); }
  }

  function homeHex() {
    for (const item of ['hut', 'hearth']) {
      const b = state.built.find(x => x.item === item);
      if (b) {
        for (const n of [{ q: b.q, r: b.r }, ...neighbors(b.q, b.r)]) {
          const col = map.get(n.q, n.r);
          if (col && !isWater(col.terrain) && !(col.feature?.wall)) return { q: n.q, r: n.r };
        }
      }
    }
    return map.spawn;
  }

  function die() {
    dead = true;
    player.stop();
    state.stats.deaths = (state.stats.deaths || 0) + 1;
    const loss = penaltyOnDeath(state);
    const home = homeHex();
    // Out on a raid, the band that killed you goes home with what it took.
    game.ui.openPanel('message', {
      sticky: true,
      title: 'You have fallen',
      html: `<p class="lede">You wake by your fire, aching.</p>
        <p>You lost ${loss.gold} gold and half of everything that was not a tool or gear.
        What is in your hut's stash is safe.</p>`,
      buttons: [{ label: 'Get up', run: () => {
        player.q = home.q; player.r = home.r; player.path = []; player.leg = null;
        state.hp = maxHp(state);
        dead = false;
        follow = true;
        afterChange();
      } }],
    });
  }

  function victory() {
    state.won = true;
    const { day } = dayOf(state);
    game.ui.openPanel('message', {
      title: 'The vale is free',
      html: `<p class="lede">The last camp burns. No more war bands will cross the river.</p>
        <div class="stats">
          <div><b>${day}</b><span>days</span></div>
          <div><b>${state.stats.kills || 0}</b><span>raiders felled</span></div>
          <div><b>${state.stats.campsBurned || 0}</b><span>camps burned</span></div>
          <div><b>${Object.values(state.trust).filter(t => t.done).length}</b><span>villages trust you</span></div>
          <div><b>${state.stats.crafted || 0}</b><span>things made</span></div>
          <div><b>${state.stats.deaths || 0}</b><span>falls</span></div>
        </div>
        <p class="dim">The world is yours to keep building in.</p>`,
      buttons: [{ label: 'Keep playing' }, { label: 'New world', run: () => game.doNewWorld() }],
    });
  }

  // ----------------------------------------------------------------- input

  const worldAt = e => {
    const rect = canvas.getBoundingClientRect();
    const d = pixelScale();
    return camera.screenToWorld((e.clientX - rect.left) * d, (e.clientY - rect.top) * d);
  };
  const hexAt = e => {
    const w = worldAt(e);
    return pickHex(w.x, w.y, (q, r) => map.surfaceAt(q, r), 3, map.peakHeight());
  };

  /** Can you actually see this hex, or is taller ground standing in front of it? */
  const inView = (q, r) => {
    const { cx, cy } = tileCenter(q, r, Math.max(0, map.surfaceAt(q, r)));
    const hit = pickHex(cx, cy, (a, b) => map.surfaceAt(a, b), 3, map.peakHeight());
    return !!hit && hit.q === q && hit.r === r;
  };

  /**
   * Which highlighted spot is under the pointer, while placing.
   *
   * Not pickHex: that answers with the hex you can *see* there, and a spot is
   * often behind the ground you are standing on. A river down in its gorge,
   * due north of you, is drawn under your own hex, and clicking its highlight
   * used to pick your feet. The highlights are what is on screen, so they are
   * what gets hit-tested, and any hex of a bridge's span will do.
   */
  const spotAt = e => {
    const w = worldAt(e);
    let best = null;
    for (const spot of placing?.spots || []) {
      for (const t of spot.span ? spot.span.tiles : [spot]) {
        const { cx, cy } = tileCenter(t.q, t.r, spotHeight(spot, t));
        if (!pointInHex(w.x, w.y, cx, cy)) continue;
        const d = Math.hypot(w.x - cx, w.y - cy);
        if (!best || d < best.d) best = { spot, d };
      }
    }
    return best?.spot || null;
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
    if (moved && !placing) preview = hover && !player.moving ? findPath(map, player, hover, pathOpts()) : null;
  });

  canvas.addEventListener('pointerup', e => {
    canvas.releasePointerCapture(e.pointerId);
    const wasDrag = drag.moved > 4;
    drag.active = false;
    if (wasDrag || dead) return;

    const target = (placing && spotAt(e)) || hexAt(e);
    if (!target) return;

    if (placing) {
      // A click anywhere but a highlight puts the thing away again. The lit
      // hexes are the whole instruction; there is no other mode to explain.
      if (!spotAt(e)) { placing = null; refreshContext(); return; }
      const result = build(world, state, player, placing.recipeId, target, game.craftingContext());
      if (!result.ok) game.ui.notify(result.message);
      if (result.ok) {
        player.triggerAction('build', 0.45);
        chime('copper', 0.06);
        announceLevels(RECIPES[placing.recipeId].skill, result.levels);
        placing = null;
        rebuildFeatures();
        afterChange();
      }
      return;
    }

    // Clicking a raider walks you up to it; the fight starts on its own.
    const foe = hostiles(state).find(u => u.q === target.q && u.r === target.r);
    let goal = target;
    if (foe) {
      const d = distance(foe.q, foe.r, player.q, player.r);
      if (d <= reach(state)) return;
      const beside = neighbors(foe.q, foe.r).map(n => map.get(n.q, n.r)).filter(Boolean)
        .sort((a, b) => distance(a.q, a.r, player.q, player.r) - distance(b.q, b.r, player.q, player.r));
      goal = beside.find(c => findPath(map, player, c, pathOpts())) || target;
    }

    const route = findPath(map, player, goal, pathOpts());
    if (!route) {
      const col = map.get(target.q, target.r);
      return game.ui.notify(col && isWater(col.terrain) ? 'You need a boat or a bridge to cross water.'
        : 'No way up. Mine the face, or build a ladder.');
    }
    follow = true;
    preview = null;
    game.ui.clearContext();
    player.follow(route, refreshContext);
  });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const d = pixelScale();
    if (camera.zoom(e.deltaY > 0 ? -1 : 1, (e.clientX - rect.left) * d, (e.clientY - rect.top) * d, canvas.width, canvas.height)) {
      renderer.resize(camera);
    }
  }, { passive: false });

  window.addEventListener('resize', () => renderer.resize(camera));
  window.addEventListener('keyup', e => { if (e.code === 'Space' && !typing(e)) e.preventDefault(); });
  window.addEventListener('keydown', e => {
    if (typing(e)) return;
    if (e.key === 'Escape') {
      if (placing) { placing = null; refreshContext(); return; }
      if (e.handledByPanel || game.ui.openPanelName) return;     // ui.js closed a panel
      game.ui.openPanel('menu');
      return;
    }
    if (game.ui.sticky) return;
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) game.toggleEye(); }
    const k = e.key.toLowerCase();
    if (k === 'f') follow = true;
    if (k === 'i') game.ui.togglePanel('inventory');
    if (k === 'c') game.ui.togglePanel('crafting');
    if (k === 'b') game.ui.togglePanel('build');
    if (k === 'k') game.ui.togglePanel('skills');
    if (/^[1-9]$/.test(e.key) && !game.ui.openPanelName) game.ui.pickContext(Number(e.key) - 1);
  });

  // ------------------------------------------------------------ frame loop

  const hudTerrain = document.getElementById('hud-terrain');
  let last = performance.now();

  function frame(now) {
    tick(now);
    requestAnimationFrame(frame);
  }

  function tick(now) {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    const running = !game.ui.paused && !dead;

    player.update(dt);

    if (running) {
      state.time += dt;
      const events = [];
      updateUnits({ world, state, player, events, playerDown: dead }, dt);
      handleEvents(events);
      playerStrikes(dt);
      healthTick(dt);

      cropClock += dt;
      if (cropClock > 1) {
        cropClock = 0;
        if (growCrops(world, state).length) rebuildFeatures();
      }
      hudClock += dt;
      if (hudClock > 0.25) { hudClock = 0; game.ui.updateHud(); updateAlert(); }
    }

    const done = explorer.update(dt, player, running && !placing && !game.ui.busy);
    if (done) explored(done, now);

    if (follow) {
      const p = player.pos;
      camera.moveTo(p.x, p.y);
    }
    camera.update(dt);

    renderer.render(map, camera, {
      hover: placing ? null : hover,
      // The exploring glow belongs to the hex you stand on, so it is drawn with
      // that hex and hidden by whatever hides the hex. As an overlay it was
      // painted over everything: stand behind a peak and the ring ran round the
      // mountain's face, as if that were what you were exploring.
      entities: [...features, ...chargeEntity(now), ...pings.entities(map, now, inView), ...unitEntities(), ...dogEntity(), player],
      overlays: [
        drawOverlays,
        ctx => pings.draw(ctx, map, now, inView),
        ...(eye ? [(ctx, cam) => drawScenicRings(ctx, map, state, cam.viewBounds(32))] : []),
        // You, and anyone else, faintly through whatever stands in front. Over
        // a figure in plain view this repaints its own pixels and changes
        // nothing; behind a cliff or a wood it is how you find them again.
        ctx => {
          ctx.save();
          ctx.globalAlpha = 0.38;
          for (const u of state.units || []) drawUnit(ctx, map, u, performance.now(), true);
          player.draw(ctx, true);
          ctx.restore();
        },
      ],
      screenOverlays: [
        nightShade,
        ...(eye ? [(ctx, cam) => drawResourceIcons(ctx, cam, map, state, resourceIcons, now)] : []),
        edgeArrows,
      ],
      dim: eye ? col => !isKnown(state, col.q, col.r) : null,
    });

    game.ui.positionAnchors(camera, map, pixelScale());

    if (hudTerrain) {
      const col = hover && map.get(hover.q, hover.r);
      let label = '';
      if (col) {
        const f = col.feature;
        const foe = hostiles(state).find(u => u.q === col.q && u.r === col.r);
        label = foe ? `${KINDS[foe.kind].name.toLowerCase()} · ${foe.hp}/${foe.maxHp} · ${KINDS[foe.kind].atk} attack, ${KINDS[foe.kind].def} defence`
          : f?.type === 'village' ? `${f.name}, ${f.kind}${isTrusted(state, col.q, col.r) ? ' · trusts you' : ''}`
            : f?.type === 'camp' ? `${f.name}${f.burned ? ', burned' : ` · ${guardsAt(state, col)} guards`}`
              : f?.type === 'structure' ? `${f.name}${f.maxHp ? ` ${f.hp}/${f.maxHp}` : ''}`
                : f?.type === 'crossing' ? 'a raiders’ crossing'
                  : '';
      }
      if (hudTerrain.textContent !== label) hudTerrain.textContent = label;
    }
  }
  requestAnimationFrame(frame);

  /** Run the world forward by hand, a frame at a time — for testing from the console. */
  game.advance = (seconds = 1) => {
    for (let t = 0; t < seconds; t += 0.05) tick(last + 50);
    return state.time;
  };

  refreshContext();
  announceMind(mindStep(world, state, player));
  checkJourney(state, world);
  game.ui.updateHud();
  // The opening is the first chapter's name and nothing else. How to play is
  // under the cog for whoever wants it; the corner gives the first hint itself
  // after a few seconds of standing there.
  if (!restored) game.ui.showCard(STAGES[0].name, STAGES[0].blurb);

  // There is one save slot, and every open tab writes to it. `?nosave=1` keeps
  // a tab opened to test something from overwriting the game you are playing.
  if (params.get('nosave') !== '1') {
    setInterval(() => { if (!dead) saveLocal(world, state, player); }, 45000);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && !dead) saveLocal(world, state, player);
    });
  }

  game.renderer = renderer;
  game.getPlacing = () => placing;
  window.game = game;
}

/** Keys typed into a text box are not hotkeys. */
const typing = e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '') || e.target?.isContentEditable;

boot().catch(err => {
  console.error(err);
  document.getElementById('hud-stats').textContent = `boot failed: ${err.message}`;
});
