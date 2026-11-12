// main.js — bootstrap, the frame loop, and the wiring between world and UI.

import { loadTileset, BRIDGE_SHEET, bridgeFrame, isWater } from './world/tileset.js';
import { loadDecor } from './render/decor.js';
import { drawStructure, drawVillage, drawCamp, drawBridgeDeck, hpBar } from './render/structures.js';
import { drawUnit, unitPos, drawDog } from './render/units.js';
import { generateWorld } from './world/worldgen.js';
import { findPath, isBridged } from './world/pathfinding.js';
import { Renderer } from './render/renderer.js';
import { Camera, pixelScale } from './core/camera.js';
import { Rng } from './core/rng.js';
import { Player } from './game/player.js';
import { pickHex, tileCenter, traceTopFace, distance, neighbors, frameOrigin } from './world/hexgrid.js';

import { createState, itemName, RECIPES, ITEMS, dayOf, isNight, DAY_LENGTH, hasBuilt } from './game/state.js';
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
  campsLeft, ensureRaidState, KINDS,
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
      game.ui.notify(`You made ${made}.`);
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
        return game.ui.notify(out === 'ladder' ? 'Stand at the foot of a cliff too high to climb.'
          : out === 'bridge' ? 'Stand at the water’s edge, facing a crossing no wider than 9 hexes.'
            : 'No level, open ground here to build on.');
      }
      game.ui.notify('Click a highlighted hex to build. Esc to cancel.');
    },

    doHarvest(id) {
      const spec = harvestSpec(id);
      game.ui.clearContext();
      const ms = { fell_tree: 1100, mine_cliff: 1200, mine_ore: 1200, hunt: 1300 }[id] || 800;
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
        game.ui.ping({ kind: 'trade', title: `${col.feature.name} trusts you`, sub: 'Trade, workshop and maps open' });
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
        game.ui.ping({ kind: 'victory', kicker: 'Camp burned', title: camp.feature.name, sub: `+${gold} gold · ${campsLeft(map).length} left` });
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
    for (const l of levels || []) game.ui.ping({ kind: 'level', title: `${skill[0].toUpperCase()}${skill.slice(1)} ${l}`, sub: 'New recipes unlocked' });
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
    if (result.found.oreSign) game.ui.notify('Traces of ore glint in the rock nearby. Read the rock to find the vein.');
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
      } else if (f.type === 'structure') {
        features.push({ q: col.q, r: col.r, draw: (ctx, cx, cy) => drawStructure(ctx, Math.round(cx), Math.round(cy), f.item, performance.now() / 1000, f) });
      } else if (f.type === 'field' && f.hp < f.maxHp) {
        features.push({ q: col.q, r: col.r, draw: (ctx, cx, cy) => hpBar(ctx, Math.round(cx), Math.round(cy) - 8, f.hp / f.maxHp, '#d9b45b') });
      } else if (f.type === 'ore' && f.known && f.remaining > 0) {
        features.push({ q: col.q, r: col.r, draw: (ctx, cx, cy) => drawVein(ctx, Math.round(cx), Math.round(cy)) });
      }
    }
    for (const s of map.structures) {
      if (s.type !== 'bridge') continue;
      for (const t of s.tiles) {
        const o = frameOrigin(t.q, t.r, 0);
        features.push({ q: t.q, r: t.r, h: 0, draw: ctx => drawBridgeDeck(ctx, deck, bridgeFrame(s.edge), o.x, o.y) });
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

  const dogEntity = () => {
    if (!countItem(state, 'dog')) return [];
    const p = player.pos;
    return [{ q: player.q, r: player.r, draw: ctx => drawDog(ctx, p.x - player.facing * 9, p.y + 3, player.facing, performance.now() / 1000) }];
  };

  const drawOverlays = (ctx) => {
    if (placing) {
      for (const spot of placing.spots) {
        const tiles = spot.span ? spot.span.tiles : [spot];
        for (const t of tiles) {
          const { cx, cy } = tileCenter(t.q, t.r, Math.max(0, t.h));
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
    // Raid target marker: where the band is heading.
    const raid = state.raid;
    if (raid?.warned && raid.target) {
      const { cx, cy } = tileCenter(raid.target.q, raid.target.r, Math.max(0, map.heightAt(raid.target.q, raid.target.r)));
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
      traceTopFace(ctx, cx, cy);
      ctx.strokeStyle = `rgba(209, 89, 109, ${0.5 + pulse * 0.5})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Your health, over your head, when you are hurt.
    if (state.hp < maxHp(state)) {
      const p = player.pos;
      hpBar(ctx, Math.round(p.x), Math.round(p.y) - 20, state.hp / maxHp(state), '#7ad15a');
    }
    if (!preview || preview.length < 2) return;
    ctx.fillStyle = 'rgba(255, 248, 220, 0.5)';
    for (let i = 1; i < preview.length; i++) {
      const { cx, cy } = tileCenter(preview[i].q, preview[i].r, Math.max(0, map.heightAt(preview[i].q, preview[i].r)));
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
    if (step.exhausted && state.stepsWalked % 10 === 0) game.ui.notify('You are starving. Find food: forage, hunt or fish.', 2600, 'bad');
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
    if (n) game.ui.ping({ kind: 'raid', kicker: 'The banner is raised', title: `${n} militia join you`, sub: 'For the vale!' });
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
    const roll = strike(state, foe, attackDice(state));
    foe.hitAt = performance.now();
    game.ui.showDice(unitAnchor(foe), roll, { friendly: true });
    if (foe.hp <= 0) fell(foe, 'player');
  }

  function fell(u, by) {
    if (u.faction !== 'raider') {
      game.ui.notify(`A ${KINDS[u.kind].name.toLowerCase()} from the villages has fallen.`);
      return;
    }
    if (by === 'player' || by === 'tower' || by?.faction === 'ally') {
      const got = spoils(state, u);
      game.ui.floatText(unitAnchor(u), got.text, 'gain');
      if (u.kind === 'warlord') {
        state.stats.warlord = true;
        game.ui.ping({ kind: 'victory', kicker: 'The Warlord is dead', title: 'Burn the hold', sub: 'His guards will scatter.' });
      } else chime('copper', 0.05);
    }
    afterChange();
  }

  function handleEvents(events) {
    for (const e of events) {
      if (e.type === 'warn') {
        const where = e.target?.kind === 'village' ? 'a village' : 'your homestead';
        game.ui.ping({ kind: 'raid', kicker: 'Raiders sighted', title: `War band from ${e.from.name}`, sub: `Heading for ${where} — about ${e.seconds}s${e.tower ? ' (your watchtower saw them early)' : ''}` });
      } else if (e.type === 'raid') {
        game.ui.notify(`${e.size} raider${e.size > 1 ? 's' : ''} set out from ${e.from.name}!`, 3500, 'bad');
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
        game.ui.notify(`Raiders tore down your ${itemName(e.item)}${e.loot?.length ? ' and looted the stash' : ''}!`, 3500, 'bad');
        rebuildFeatures();
        refreshArt(world, [map.get(e.q, e.r)].filter(Boolean));
        afterChange();
      } else if (e.type === 'ransack') {
        // hp bars show it
      } else if (e.type === 'villageRaided') {
        game.ui.notify(`${e.name} has been raided. Its market is shut until tomorrow.`, 3500, 'bad');
      }
    }
  }

  function updateAlert() {
    const raid = state.raid;
    const out = hostiles(state).filter(u => u.mode !== 'guard').length;
    if (out) game.ui.setAlert(`⚔ ${out} raider${out > 1 ? 's' : ''} in your lands`);
    else if (raid?.warned) game.ui.setAlert(`⚠ Raid from ${raid.from?.name} in ${Math.max(0, Math.round(raid.nextAt - state.time))}s`);
    else game.ui.setAlert('');
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
    if (moved && !placing) preview = hover && !player.moving ? findPath(map, player, hover, pathOpts()) : null;
  });

  canvas.addEventListener('pointerup', e => {
    canvas.releasePointerCapture(e.pointerId);
    const wasDrag = drag.moved > 4;
    drag.active = false;
    if (wasDrag || dead) return;

    const target = hexAt(e);
    if (!target) return;

    if (placing) {
      const result = build(world, state, player, placing.recipeId, target, game.craftingContext());
      game.ui.notify(result.message);
      if (result.ok) {
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
    if (/^[1-6]$/.test(e.key) && !game.ui.openPanelName) game.ui.pickContext(Number(e.key) - 1);
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
      entities: [...features, ...unitEntities(), ...dogEntity(), player],
      overlays: [
        drawOverlays,
        ctx => drawExploreCharge(ctx, map, explorer.charge, now),
        ctx => pings.draw(ctx, map, now),
        ...(eye ? [(ctx, cam) => drawScenicRings(ctx, map, state, cam.viewBounds(32))] : []),
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
        label = foe ? `${KINDS[foe.kind].name} — ${foe.hp}/${foe.maxHp} hp, ${KINDS[foe.kind].atk} atk, ${KINDS[foe.kind].def} def`
          : f?.type === 'village' ? `${f.name} (${f.kind})${isTrusted(state, col.q, col.r) ? ' — trusts you' : ''}`
            : f?.type === 'camp' ? `${f.name}${f.burned ? ' (burned)' : ` — ${guardsAt(state, col)} guards`}`
              : f?.type === 'structure' ? `${f.name}${f.maxHp ? ` ${f.hp}/${f.maxHp}` : ''}`
                : `${col.terrain.replace(/_/g, ' ')} · height ${col.h}`;
      }
      hudTerrain.textContent = label;
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
  if (!restored) game.showHelp(true);

  setInterval(() => { if (!dead) saveLocal(world, state, player); }, 45000);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && !dead) saveLocal(world, state, player);
  });

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
