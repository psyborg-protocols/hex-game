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
import { pickHex, pointInHex, tileCenter, traceTopFace, distance, neighbors, columnBaseY, GEOM } from './world/hexgrid.js';

import { createState, itemName, RECIPES, ITEMS, dayOf, moonOf, isNight, DAY_LENGTH, hasBuilt } from './game/state.js';
import { walkOneStep, recomputeEnergy, countItem, removeItem, foodValue, usedSlots, capacity } from './game/inventory.js';
import { craft, checkRecipe, recipeKnown } from './game/crafting.js';
import { ensureVillage, buy, sell, giveFavour, villageContext, isTrusted, isRaided } from './game/economy.js';
import { villageNear } from './game/context.js';
import { harvest, shakeTree, prospect, build, relightCampfire, placementSpots, growCrops, refreshArt, penaltyOnDeath } from './game/actions.js';
import { harvestSpec } from './game/harvests.js';
import { saveLocal, loadLocal, writeLocal, downloadSave, readSaveFile } from './game/save.js';
import { ensureMind, isKnown, isExplored, isMeditated, scenicOf, harvestsHere, HIDDEN } from './game/discovery.js';
import { resolveClick } from './game/pick.js';
import { makeMasks } from './render/masks.js';
import { createFx, drawColumnNodes, drawCampfire, SHAKE_MS } from './render/resources.js';
import { onStep as mindStep, onExplored, onMeditated, onTrade } from './game/mind.js';
import { Explorer } from './game/explorer.js';
import { attackDice, reach, maxHp } from './game/gear.js';
import { levelOf } from './game/skills.js';
import { checkJourney, STAGES } from './game/journey.js';
import {
  updateUnits, garrisonCamps, guardsAt, hostiles, strike, spoils, rally, burnCamp,
  campsLeft, ensureRaidState, raidSize, abroad, KINDS,
} from './game/raiders.js';
import { drawExploreCharge, drawMeditationGlow, Pings, loadResourceIcons, drawResourceIcons, drawScenicRings } from './render/discovery_fx.js';
import { chime, updateMeditationHum } from './ui/chime.js';

import { UI } from './ui/ui.js';
import { inventoryPanel } from './ui/panels/inventory.js';
import { craftingPanel } from './ui/panels/crafting.js';
import { skillsPanel } from './ui/panels/skills.js';
import { tradePanel } from './ui/panels/trade.js';
import { buildPanel } from './ui/panels/build.js';
import { menuPanel } from './ui/panels/menu.js';
import { stashPanel } from './ui/panels/stash.js';
import { messagePanel, HOW_TO_PLAY } from './ui/panels/message.js';

const ITEM_THOUGHTS = {
  branch: 'A dry branch! With a piece of flint I can relight the cold campfire — or bind two stones and reed cord into a stone axe.',
  stone: 'Solid stones. With a branch and reed cord, I can lash together a stone axe or a stone hammer.',
  reed: 'Supple reeds! I can twist these into cord for tools, snares, and ladders, or weave a basket for more pack room.',
  cord: 'Twisted cord! Now I can bind a stone axe to fell trees, or set a snare where rabbits hop.',
  berries: 'Sweet wild berries. Carrying food keeps my energy up — and villages often ask for berries as a first favour.',
  grain: 'Wild grain! Once my Homesteading grows, I can sow a field that reaps fourfold.',
  log: 'Heavy timber. I can ring stones with logs for a hearth — and once I have a flint knife, whittle logs into planks for a ladder.',
  stone_axe: "A stone axe! Now I can fell whole trees for logs — though I'll need a flint knife to dress them into planks.",
  stone_hammer: "A stone hammer! I can dress stone blocks, quarry stone and flint from cliff faces, and chip away ore.",
  stone_knife: 'A sharp flint knife! Now I can whittle logs into planks to build ladders, and skin hides when I hunt.',
  plank: 'Smooth wooden planks! With reed cord and Woodworking 3, I can lean a ladder against the high cliffs — or build a workbench.',
  meat: 'Raw meat will feed me in a pinch, but cooking it at a hearth doubles the energy it gives.',
  fish: 'Fresh fish will keep me going, and cooking it over a hearth doubles the energy.',
  hide: 'Tough hide — with my knife I can stitch warm hide armour, a leather pack, or slice extra cord.',
  clay: 'Wet riverbank clay. Fired at a hearth it makes a pot for stew and healing salve — and later, a forge.',
  herb: 'Wild medicinal herbs. With clay and a pot, I can mix healing salve or cook rich stew.',
  herb_seed: 'Rare herb seeds from the tall grass! With two of these and Homesteading 2, I can sow an herb patch of my own.',
  flint: 'Sharp flint! With a dry branch I can strike a spark to relight the campfire — or knap a flint knife.',
  ore: "Heavy iron ore! I'll need a stone forge and green-wood tongs to smelt this into ingots.",
  ingot: 'Fresh iron ingot! At the forge I can smith an iron axe, a pickaxe, or an iron saw.',
};

/** Seconds between your swings. */
const PLAYER_COOLDOWN = 1.1;

async function boot() {
  const canvas = document.getElementById('view');
  const [tileset, decor] = await Promise.all([loadTileset(), loadDecor()]);
  const res = { images: tileset.images, decor, resolvers: tileset.resolvers, index: tileset.index };
  // Per-asset hit regions, measured from the art's own alpha (see pick.js).
  res.masks = makeMasks(res);

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
  state.thoughts ||= {};
  state.stash ||= new Array(16).fill(null);
  if (state.hp == null) state.hp = maxHp(state);
  ensureRaidState(state);
  if (!restored) garrisonCamps(map, state);
  recomputeEnergy(state);

  const camera = new Camera({ scale: 3 });
  const renderer = new Renderer(canvas, res);
  renderer.resize(camera);

  const player = new Player(map, restored?.player || map.spawn);
  if (!restored) player.seated = true;
  const start = player.restingPos;
  camera.centerOn(start.cx, start.cy);

  let hover = null;
  let hoverWorld = null;
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
  const fx = createFx();
  const explorer = new Explorer(map, state);
  const pings = new Pings();
  const resourceIcons = loadResourceIcons();
  const drag = { active: false, x: 0, y: 0, moved: 0 };
  let knownCraftCount = Object.values(RECIPES).filter(r => r.category !== 'build' && recipeKnown(state, r)).length;
  let knownBuildCount = Object.values(RECIPES).filter(r => r.category === 'build' && recipeKnown(state, r)).length;

  const hasBoat = () => countItem(state, 'boat') > 0 || state.free;
  const canMine = () => state.free || countItem(state, 'pickaxe') > 0 || countItem(state, 'stone_hammer') > 0;
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
      checkItemThoughts(result.produced.map(p => p.id));
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
          fx.version++;
          game.ui.floatText(playerPos, result.message, 'gain');
          if (id === 'harvest_field') state.stats.reaped = (state.stats.reaped || 0) + 1;
          announceLevels(spec.skill, result.levels);
          checkItemThoughts((result.gained || []).map(g => g.id));
          if (result.changed?.length) {
            refreshArt(world, result.changed.filter(c => c.terrain !== 'farm'));
          }
          rebuildFeatures();
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
        const now = performance.now();
        for (const c of r.revealed || []) fx.found.set(`${c.q},${c.r}`, now);
        fx.version++;
        announceMind(r);
        game.ui.murmur(`${col.feature.name} trusts you.`, { tone: 'good', ms: 5200 });
      }
      afterChange();
    },

    doBuy(col, itemId) {
      const result = buy(state, col, itemId);
      game.ui.notify(result.message);
      if (result.ok) checkItemThoughts([itemId]);
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

    doRelight() {
      const can = state.free || (countItem(state, 'branch') >= 1 && countItem(state, 'flint') >= 1);
      if (!can) {
        player.triggerAction('forage', 0.35);
        const check = relightCampfire(world, state, player);
        return game.ui.notify(check.message);
      }
      game.ui.clearContext();
      player.triggerAction('forage', 0.9);
      game.ui.showProgress('Lighting campfire', 900, player).then(ok => {
        if (!ok) return;
        const result = relightCampfire(world, state, player);
        if (!result.ok) return game.ui.notify(result.message);
        chime('gold');
        game.ui.floatText(playerPos, '+ Campfire lit', 'gain');
        game.ui.murmur(result.message, { tone: 'good', ms: 5200 });
        announceLevels('homesteading', result.levels);
        rebuildFeatures();
        afterChange();
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

  function thinkOnce(id, text, ms = 5400) {
    if (!text) return false;
    state.thoughts ||= {};
    if (state.thoughts[id]) return false;
    state.thoughts[id] = 1;
    game.ui.murmur(text, { ms });
    return true;
  }

  function checkItemThoughts(itemIds = []) {
    let spoke = false;
    for (const id of itemIds) {
      if (ITEM_THOUGHTS[id] && thinkOnce(`item:${id}`, ITEM_THOUGHTS[id])) {
        spoke = true;
        break;
      }
    }
    if (!spoke && usedSlots(state) >= capacity(state) - 1 && !countItem(state, 'basket')) {
      thinkOnce('pack_full', 'My pack is nearly full. Four reeds and two branches would weave a basket for four more slots.');
    }
    if (map.spawn && !map.get(map.spawn.q, map.spawn.r)?.feature
      && countItem(state, 'branch') >= 1 && countItem(state, 'flint') >= 1) {
      thinkOnce('ready_to_relight', 'I have both a branch and flint! I can return to the cold campfire and relight it.', 6000);
    }
  }

  function unreachableHint(col) {
    if (col && isWater(col.terrain)) {
      return countItem(state, 'plank') >= 6
        ? 'Too deep to wade. I can lay a bridge across narrow water from the Build menu.'
        : 'The water is too deep to wade. If only I had a boat, or enough planks for a bridge...';
    }
    if (countItem(state, 'plank') >= 3 && countItem(state, 'cord') >= 2) {
      if (!state.free && levelOf(state, 'woodworking') < 3) {
        return 'I have planks and cord for a ladder, but I need Woodworking 3 to lash one together.';
      }
      return "Too high to scramble up — I can build a ladder from the Build menu while standing at the cliff's foot.";
    }
    if (countItem(state, 'stone_knife') > 0) {
      return 'If only I had a ladder... With my knife and an axe, I can whittle logs into planks and lash them with cord.';
    }
    return "If only I had a ladder... I'll need planks (cut with an axe and knife) and reed cord to build one.";
  }

  function afterChange() {
    const j = checkJourney(state, world);
    for (const g of j.goals) game.ui.ping({ kind: 'goal', title: g.text });
    for (const st of j.stages) {
      const i = STAGES.indexOf(st);
      const next = STAGES[i + 1];
      if (next) game.ui.ping({ kind: 'stage', kicker: `Chapter ${i + 2}`, title: next.name, sub: next.blurb });
    }
    const nowCraft = Object.values(RECIPES).filter(r => r.category !== 'build' && recipeKnown(state, r)).length;
    const nowBuild = Object.values(RECIPES).filter(r => r.category === 'build' && recipeKnown(state, r)).length;
    if (nowCraft > knownCraftCount) game.ui.nudge('crafting');
    if (nowBuild > knownBuildCount) game.ui.nudge('build');
    knownCraftCount = nowCraft;
    knownBuildCount = nowBuild;
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
    fx.found.set(`${done.q},${done.r}`, now);
    for (const c of result.found.revealed || []) fx.found.set(`${c.q},${c.r}`, now);
    fx.version++;
    pings.add(done.q, done.r, result.found.tier, now);
    if (!result.found.tier) chime('tick', 0.035);
    const finds = result.found.resources.map(id => (HIDDEN[id].label || itemName(HIDDEN[id].icon)));
    if (finds.length && inView(done.q, done.r)) game.ui.floatText(playerPos, `found ${finds.join(', ')}`, 'find');
    if (result.found.oreSign) game.ui.notify('Ore glints in the rock near here.');
    const revealedCount = result.found.revealed?.length || 0;
    if (revealedCount >= 6) {
      state.thoughts ||= {};
      state.thoughts.vista_reached = 1;
      thinkOnce(`vista:${done.q},${done.r}`, 'From this height, the land below opens up before you.');
    } else if (revealedCount >= 1 && !state.thoughts?.vista_reached) {
      thinkOnce('hill_vantage', 'Standing three steps above the ground below lets me see over the edge — climbing a real peak would reveal much more.');
    }
    if (result.found.tier > 0) {
      const tip = thinkOnce('scenic_meditate', 'This looks like a beautiful place to sit down — click yourself to meditate.');
      if (!tip) game.ui.murmur('This looks like a beautiful place to sit down.', { ms: 4600 });
    } else if (revealedCount === 0 && !state.thoughts?.vista_reached && Object.keys(state.mind?.explored || {}).length >= 8) {
      thinkOnce('seek_high_ground', 'If only I could get higher up, I could see all around...');
    }
    if (map.spawn && done.q === map.spawn.q && done.r === map.spawn.r && !map.get(done.q, done.r)?.feature) {
      thinkOnce('cold_campfire', 'The campfire here is cold. If I find a dry branch and a piece of flint, I can strike a spark and relight it.', 5800);
    }
    announceMind(result);
    afterChange();
  }

  // --------------------------------------------------------- world drawing

  function rebuildFeatures() {
    features = [];
    const deck = res.images[BRIDGE_SHEET];
    const spawn = map.spawn && map.get(map.spawn.q, map.spawn.r);
    if (spawn && !spawn.feature) {
      features.push({
        q: spawn.q, r: spawn.r,
        draw: (ctx, cx, cy) => drawCampfire(ctx, Math.round(cx) - 5, Math.round(cy) + 3, fx.hover?.kind === 'campfire'),
      });
    }
    for (const col of map) {
      const f = col.feature;
      if (!f) continue;
      if (f.type === 'village') {
        features.push({ q: col.q, r: col.r, draw: (ctx, cx, cy) => drawVillage(ctx, Math.round(cx), Math.round(cy), performance.now() / 1000, f.kind, { raided: isRaided(state, col.q, col.r) }) });
      } else if (f.type === 'camp') {
        features.push({ q: col.q, r: col.r, draw: (ctx, cx, cy) => drawCamp(ctx, Math.round(cx), Math.round(cy), performance.now() / 1000, f) });
      } else if (f.type === 'structure' && f.item === 'ladder') {
        // Drawn below from map.structures, against the face it climbs.
      } else if (f.type === 'structure' && f.camp) {
        features.push({
          q: col.q, r: col.r,
          draw: (ctx, cx, cy) => {
            const x = Math.round(cx) - 5, y = Math.round(cy) + 3;
            const hot = !placing && !dead && hover?.q === col.q && hover?.r === col.r;
            drawCampfire(ctx, x, y, hot, true, performance.now() / 1000);
            if (f.hp < f.maxHp) hpBar(ctx, x, y - 9, f.hp / f.maxHp);
          },
        });
      } else if (f.type === 'structure') {
        features.push({ q: col.q, r: col.r, draw: (ctx, cx, cy) => drawStructure(ctx, Math.round(cx), Math.round(cy), f.item, performance.now() / 1000, f) });
      } else if (f.type === 'field' && f.hp < f.maxHp) {
        features.push({ q: col.q, r: col.r, draw: (ctx, cx, cy) => hpBar(ctx, Math.round(cx), Math.round(cy) - 8, f.hp / f.maxHp, '#d9b45b') });
      } else if (f.type === 'crossing') {
        features.push({ q: col.q, r: col.r, draw: (ctx, cx, cy) => drawCrossing(ctx, Math.round(cx), Math.round(cy), col.q, col.r, performance.now() / 1000) });
      } else if (f.type === 'ore' && f.known && f.remaining > 0) {
        features.push({
          q: col.q, r: col.r,
          draw: (ctx, cx, cy) => drawVein(ctx, Math.round(cx), Math.round(cy),
            fx.hover?.kind === 'ore' && fx.hover.q === col.q && fx.hover.r === col.r),
        });
      }
    }
    for (const s of map.structures) {
      if (s.type === 'ladder') {
        const edge = neighbors(s.from.q, s.from.r).findIndex(n => n.q === s.to.q && n.r === s.to.r);
        if (edge < 0) continue;
        // Heights are read as it is drawn.
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

  function drawVein(ctx, x, y, hot = false) {
    if (hot) {
      ctx.save();
      ctx.strokeStyle = '#fff5cf';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(x, y - 1, 7, 5, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
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

  const chargeEntity = now => (explorer.charge && inView(explorer.charge.q, explorer.charge.r)
    ? [{ q: explorer.charge.q, r: explorer.charge.r, draw: ctx => drawExploreCharge(ctx, map, explorer.charge, now) }]
    : []);

  const meditationEntity = now => (explorer.meditation && inView(explorer.meditation.q, explorer.meditation.r)
    ? [{ q: explorer.meditation.q, r: explorer.meditation.r, draw: ctx => drawMeditationGlow(ctx, map, explorer.meditation, now) }]
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
      const footH = Math.max(0, map.heightAt(player.q, player.r));
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
          if (placing.recipeId === 'ladder' && t.h > footH) {
            const base = tileCenter(t.q, t.r, footH);
            ctx.save();
            ctx.setLineDash([3, 3]);
            traceTopFace(ctx, base.cx, base.cy);
            ctx.fillStyle = 'rgba(217, 180, 91, 0.14)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(217, 180, 91, 0.7)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.restore();
          }
        }
      }
      return;
    }
    // The raid that is coming: the way it will take, and what it is after.
    const raid = state.raid;
    if (raid && (raid.stage === 'omen' || raid.stage === 'night')) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
      if (raid.route && raid.route.length > 1) {
        // Subtle ember-red trail showing the band's expected path without cluttering the terrain.
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.lineCap = 'butt';
        ctx.beginPath();
        raid.route.forEach((s, i) => {
          const { cx, cy } = tileCenter(s.q, s.r, Math.max(0, map.surfaceAt(s.q, s.r)));
          if (i) ctx.lineTo(Math.round(cx), Math.round(cy)); else ctx.moveTo(Math.round(cx), Math.round(cy));
        });
        ctx.strokeStyle = 'rgba(24, 10, 14, 0.18)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.setLineDash([3, 5]);
        ctx.lineDashOffset = -(performance.now() / 140) % 8;
        ctx.strokeStyle = `rgba(196, 82, 92, ${0.32 + pulse * 0.12})`;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
      }
      if (raid.target) {
        const { cx, cy } = tileCenter(raid.target.q, raid.target.r, Math.max(0, map.surfaceAt(raid.target.q, raid.target.r)));
        traceTopFace(ctx, cx, cy);
        ctx.fillStyle = `rgba(196, 82, 92, ${0.06 + pulse * 0.05})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(210, 90, 102, ${0.28 + pulse * 0.16})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
    // Hovered tree, ripe field, or tall grass gets a soft pale rim on its hex.
    if (fx.hover && (fx.hover.kind === 'tree' || fx.hover.kind === 'field' || fx.hover.kind === 'grain')) {
      const col = map.get(fx.hover.q, fx.hover.r);
      if (col) {
        const { cx, cy } = tileCenter(col.q, col.r, Math.max(0, col.h));
        traceTopFace(ctx, cx, cy);
        ctx.strokeStyle = 'rgba(255, 248, 220, 0.55)';
        ctx.lineWidth = 1;
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
    game.ui.clearContext();
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
    const mindRes = mindStep(world, state, player);
    if (mindRes.revealed?.length) {
      const now = performance.now();
      for (const c of mindRes.revealed) fx.found.set(`${c.q},${c.r}`, now);
      fx.version++;
    }
    announceMind(mindRes);
    if (mindRes.moments.some(m => m.kind === 'village')) {
      thinkOnce('first_village', 'A village! Doing their favour earns gold and opens their market — a good place to buy a flint knife.');
    }
    if (col && scenicOf(map, col).tier > 0 && isExplored(state, col.q, col.r) && !isMeditated(state, col.q, col.r)) {
      const tip = thinkOnce('scenic_meditate', 'This looks like a beautiful place to sit down — click yourself to meditate.');
      if (!tip) game.ui.murmur('This looks like a beautiful place to sit down.', { ms: 4600 });
    }
    maybeRally();
    if (map.spawn && !map.get(map.spawn.q, map.spawn.r)?.feature) {
      thinkOnce('cold_campfire', 'The campfire here is cold. If I find a dry branch and a piece of flint, I can strike a spark and relight it.', 5800);
    }
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
    // Damage is serious: food never heals, only salve heals actively, and passive
    // recovery is slow (1 hp per day out of combat).
    const fighting = state.time < combatUntil;
    if (fighting) return;
    regen += dt;
    if (regen >= DAY_LENGTH) { regen = 0; state.hp = Math.min(max, state.hp + 1); }
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
    const footH = Math.max(0, map.heightAt(player.q, player.r));
    let best = null;
    for (const spot of placing?.spots || []) {
      for (const t of spot.span ? spot.span.tiles : [spot]) {
        const { cx, cy } = tileCenter(t.q, t.r, spotHeight(spot, t));
        const inTop = pointInHex(w.x, w.y, cx, cy);
        const footCy = !spot.span && t.h > footH ? tileCenter(t.q, t.r, footH).cy : cy;
        const onFace = !inTop && !spot.span && t.h > footH
          && Math.abs(w.x - cx) <= GEOM.frameWidth / 2
          && w.y >= cy - GEOM.topFaceHeight / 2
          && w.y <= footCy + GEOM.topFaceHeight / 2;
        if (!inTop && !onFace) continue;
        // Prefer exact top-face hits first; on cliff walls prefer front-most columns.
        const tier = inTop ? 0 : 1;
        const front = -columnBaseY(t.q, t.r);
        const d = inTop ? Math.hypot(w.x - cx, w.y - cy) : Math.abs(w.x - cx);
        if (!best || tier < best.tier
          || (tier === best.tier && (front < best.front || (front === best.front && d < best.d)))) {
          best = { spot, tier, front, d };
        }
      }
    }
    return best?.spot || null;
  };

  const hitNodeAt = (e, hex) => {
    if (!hex) return null;
    const w = worldAt(e);
    // Trees are picked by their drawn art, not by the hex under the pointer:
    // a canopy overhangs into the tiles around it. The whole decision lives in
    // pick.js so it is testable without a browser.
    const node = resolveClick(w.x, w.y, map, state, hex, res.decor.index, res.masks, performance.now() / 1000);
    if (node) return node;
    if (map.spawn && hex.q === map.spawn.q && hex.r === map.spawn.r) {
      const spawnCol = map.get(map.spawn.q, map.spawn.r);
      if (spawnCol && !spawnCol.feature) {
        const { cx, cy } = tileCenter(spawnCol.q, spawnCol.r, spawnCol.h);
        if (Math.hypot(w.x - (cx - 5), w.y - (cy + 3)) <= 11) {
          return { kind: 'campfire', q: spawnCol.q, r: spawnCol.r, dx: -5, dy: 3, ready: true };
        }
      }
    }
    return null;
  };

  /** Vertical exposed wall of a steep hex (two or more steps above a land neighbour). */
  function cliffInfoAt(w, hex) {
    if (!w || !hex) return null;
    const face = map.get(hex.q, hex.r);
    if (!face || isWater(face.terrain)) return null;
    const { cx, cy } = tileCenter(face.q, face.r, Math.max(0, face.h));
    if (pointInHex(w.x, w.y, cx, cy) || w.y <= cy) return null;
    const feet = neighbors(face.q, face.r)
      .map(n => map.get(n.q, n.r))
      .filter(f => f && !isWater(f.terrain) && face.h - f.h >= 2)
      .sort((a, b) => distance(a.q, a.r, player.q, player.r) - distance(b.q, b.r, player.q, player.r));
    return feet.length ? { face, feet } : null;
  }

  function walkToAndDo(col, maxDist, fn) {
    if (!col) return false;
    if (distance(player.q, player.r, col.q, col.r) <= maxDist) {
      fn();
      return true;
    }
    let route = findPath(map, player, col, pathOpts());
    if (!route && maxDist >= 1) {
      const around = neighbors(col.q, col.r).map(n => map.get(n.q, n.r)).filter(Boolean)
        .sort((a, b) => distance(a.q, a.r, player.q, player.r) - distance(b.q, b.r, player.q, player.r));
      for (const c of around) {
        route = findPath(map, player, c, pathOpts());
        if (route) break;
      }
    }
    if (!route) {
      game.ui.notify(unreachableHint(col));
      return true;
    }
    follow = true;
    preview = null;
    game.ui.clearContext();
    player.follow(route, () => {
      refreshContext();
      if (distance(player.q, player.r, col.q, col.r) <= maxDist) fn();
    });
    return true;
  }

  function interactCliff(info) {
    if (!canMine()) {
      game.ui.notify('If I had the right tool, I might be able to mine that...');
      return;
    }
    const runAtFoot = () => {
      const entry = harvestsHere(map, state, player).find(h => h.spec.id === 'mine_cliff');
      if (entry?.ok) game.doHarvest('mine_cliff');
      else game.ui.notify(entry?.reasons?.[0] || 'No cliff to mine from here.');
    };
    if (info.feet.some(f => f.q === player.q && f.r === player.r)) {
      runAtFoot();
      return;
    }
    for (const foot of info.feet) {
      const route = findPath(map, player, foot, pathOpts());
      if (route) {
        follow = true;
        preview = null;
        game.ui.clearContext();
        player.follow(route, () => {
          refreshContext();
          if (info.feet.some(f => f.q === player.q && f.r === player.r)) runAtFoot();
        });
        return;
      }
    }
    game.ui.notify(unreachableHint(info.feet[0] || info.face));
  }

  function workNode(node) {
    if (node.kind === 'campfire') {
      game.doRelight();
      return;
    }
    if (node.kind === 'ore') {
      const entry = harvestsHere(map, state, player).find(h => h.spec.id === 'mine_ore');
      if (!entry || !entry.ok) {
        player.triggerAction('mine', 0.35);
        game.ui.notify(canMine()
          ? (entry?.reasons?.[0] || 'Cannot mine that vein right now.')
          : 'If I had a stone hammer or pickaxe, I might be able to mine that ore vein...');
        return;
      }
      game.doHarvest('mine_ore');
      return;
    }
    if (node.kind === 'bee') {
      state.taken ||= {};
      state.taken[`${node.q},${node.r}:bee`] = 1;
      fx.version++;
      player.triggerAction('forage', 0.35);
      chime('tick', 0.05);
      state.hp = Math.max(0, state.hp - 1);
      game.ui.floatText(playerPos, '-1 bee sting!', 'bad');
      game.ui.murmur('Ouch! The meadow bee stung you and buzzed off.', { ms: 4200 });
      if (state.hp <= 0) { die(); return; }
      afterChange();
      return;
    }
    if (node.kind === 'tree' && !state.free && countItem(state, 'stone_axe') === 0 && countItem(state, 'iron_axe') === 0) {
      fx.shake.set(`${node.q},${node.r}`, performance.now());
      player.facing = node.dx >= 0 ? 1 : -1;
      player.triggerAction('chop', SHAKE_MS / 1000);
      chime('tick', 0.04);
      const res = shakeTree(world, state, { q: node.q, r: node.r });
      if (res.gained?.length) {
        game.ui.floatText(playerPos, '+ 1 Branch', 'gain');
        checkItemThoughts(res.gained.map(g => g.id));
        game.ui.notify('A branch shakes loose — you need an axe to fell the tree.');
      } else {
        game.ui.notify('Nothing else shakes loose. You need an axe to fell the tree.');
      }
      afterChange();
      return;
    }
    const entry = harvestsHere(map, state, player).find(h => h.spec.id === node.harvest);
    if (!entry || !entry.ok) {
      player.triggerAction('forage', 0.35);
      game.ui.notify(entry?.reasons?.[0] || 'Nothing left here right now.');
      return;
    }
    game.doHarvest(node.harvest);
  }

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
    hoverWorld = hit ? worldAt(e) : null;
    fx.hover = (!placing && !dead && hit) ? hitNodeAt(e, hit) : null;
    const hoverCol = hit && map.get(hit.q, hit.r);
    const interactive = !placing && !dead && hit && (
      !!fx.hover
      || (hoverCol?.feature?.type === 'village')
      || (hoverCol?.feature?.type === 'structure' && ['hut', 'hearth', 'workbench', 'forge'].includes(hoverCol.feature.item))
      || (hoverCol?.feature?.type === 'camp' && !hoverCol.feature.burned && !guardsAt(state, hoverCol))
      || !!cliffInfoAt(hoverWorld, hit)
      || (!player.moving && hit.q === player.q && hit.r === player.r && (
        (scenicOf(map, hoverCol).tier > 0 && isExplored(state, player.q, player.r) && !isMeditated(state, player.q, player.r))
        || (['stony', 'steppes'].includes(hoverCol?.terrain) && (levelOf(state, 'mind') >= 3 || state.free))
      ))
    );
    canvas.style.cursor = interactive ? 'pointer' : '';
    if (moved && !placing) preview = hover && !player.moving ? findPath(map, player, hover, pathOpts()) : null;
  });

  canvas.addEventListener('pointerup', e => {
    canvas.releasePointerCapture(e.pointerId);
    const wasDrag = drag.moved > 4;
    drag.active = false;
    if (wasDrag || dead) return;

    const chosen = placing ? spotAt(e) : null;
    const target = chosen || hexAt(e);
    if (!target) return;

    if (placing) {
      // A click anywhere but a highlight puts the thing away again. The lit
      // hexes are the whole instruction; there is no other mode to explain.
      if (!chosen) { placing = null; refreshContext(); return; }
      const result = build(world, state, player, placing.recipeId, chosen, game.craftingContext());
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
    } else {
      const clickWorld = worldAt(e);
      const clickPos = player.pos;
      const onPlayerBody = !player.moving
        && target.q === player.q && target.r === player.r
        && Math.hypot(clickWorld.x - clickPos.x, clickWorld.y - (clickPos.y - 7)) <= 9;
      const node = hitNodeAt(e, target);
      const clickedCol = map.get(target.q, target.r);
      const structureAction = clickedCol?.feature?.type === 'structure'
        ? (clickedCol.feature.item === 'hut' ? () => game.ui.openPanel('stash')
          : ['hearth', 'workbench', 'forge'].includes(clickedCol.feature.item) ? () => game.ui.openPanel('crafting')
            : null)
        : null;

      // Clicking your own figure sits/stands or meditates on scenic ground.
      if (target.q === player.q && target.r === player.r && onPlayerBody) {
        const here = map.get(player.q, player.r);
        const sc = scenicOf(map, here);
        if (sc.tier > 0 && isExplored(state, player.q, player.r)) {
          player.stop();
          player.seated = true;
          follow = true;
          preview = null;
          if (!isMeditated(state, player.q, player.r)) {
            explorer.startMeditation(player.q, player.r);
            game.ui.murmur('You sit down and quiet your thoughts...', { ms: 3400 });
          } else {
            game.ui.murmur('You sit awhile and take in the view.', { ms: 3000 });
          }
          refreshContext();
          return;
        }
        if (!player.moving) {
          player.seated = !player.seated;
          refreshContext();
          return;
        }
      }

      // Clicking a visible resource node, cold campfire, or ore vein works it.
      if (node && (!onPlayerBody || target.q !== player.q || target.r !== player.r)) {
        const workCol = map.get(node.q, node.r);
        const maxDist = (node.kind === 'campfire' || node.kind === 'ore') ? 1 : 0;
        walkToAndDo(workCol, maxDist, () => workNode(node));
        return;
      }

      // Clicking a village, interactive station/hut, or unburned raider camp acts on arrival.
      if (clickedCol?.feature?.type === 'village') {
        walkToAndDo(clickedCol, 1, () => game.doTrade(clickedCol));
        return;
      }
      if (structureAction) {
        walkToAndDo(clickedCol, 1, structureAction);
        return;
      }
      if (clickedCol?.feature?.type === 'camp' && !clickedCol.feature.burned) {
        walkToAndDo(clickedCol, 1, () => game.doBurn(clickedCol));
        return;
      }

      // Clicking bare ground underfoot: scenic meditation, or Mind >= 3 prospecting on stony/steppes.
      if (target.q === player.q && target.r === player.r && !player.moving) {
        const here = map.get(player.q, player.r);
        const sc = scenicOf(map, here);
        if (sc.tier > 0 && isExplored(state, player.q, player.r) && !isMeditated(state, player.q, player.r)) {
          player.stop();
          player.seated = true;
          follow = true;
          preview = null;
          explorer.startMeditation(player.q, player.r);
          game.ui.murmur('You sit down and quiet your thoughts...', { ms: 3400 });
          refreshContext();
          return;
        }
        if (['stony', 'steppes'].includes(here?.terrain) && (levelOf(state, 'mind') >= 3 || state.free)) {
          game.doProspect();
          return;
        }
        if (sc.tier > 0 && isExplored(state, player.q, player.r)) {
          player.stop();
          player.seated = true;
          follow = true;
          preview = null;
          game.ui.murmur('You sit awhile and take in the view.', { ms: 3000 });
          refreshContext();
          return;
        }
      }

      // Clicking a steep cliff wall hints for a tool or walks to mine it.
      const cliff = cliffInfoAt(clickWorld, target);
      if (cliff) {
        interactCliff(cliff);
        return;
      }
    }

    const route = findPath(map, player, goal, pathOpts());
    if (!route) return game.ui.notify(unreachableHint(map.get(target.q, target.r)));
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

    const medDone = running ? explorer.updateMeditation(dt, player, !placing && !game.ui.busy) : null;
    updateMeditationHum(
      running && !!explorer.meditation,
      explorer.meditation ? explorer.meditation.t / explorer.meditation.duration : 0,
    );
    if (medDone) {
      const res = onMeditated(world, state, medDone);
      if (res.meditated) {
        pings.add(medDone.q, medDone.r, medDone.tier, now);
        chime('meditate', 0.07);
        if (res.meditated.xp) game.ui.floatText(playerPos, `+${res.meditated.xp} Mind`, 'gain');
        game.ui.murmur('Your mind clears, and the land feels sharper.', { tone: 'good', ms: 4500 });
        announceLevels('mind', res.levels);
        afterChange();
      }
    }

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
      entities: [...features, ...chargeEntity(now), ...meditationEntity(now), ...pings.entities(map, now, inView), ...unitEntities(), ...dogEntity(), player],
      overlays: [
        drawOverlays,
        ctx => pings.draw(ctx, map, now, inView),
        ...(eye ? [(ctx, cam) => drawScenicRings(ctx, map, state, cam.viewBounds(32), inView)] : []),
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
        ...(eye ? [(ctx, cam) => drawResourceIcons(ctx, cam, map, state, resourceIcons, now, inView)] : []),
        edgeArrows,
      ],
      dim: col => eye ? (!isKnown(state, col.q, col.r) ? 'dim' : '') : (!isKnown(state, col.q, col.r) ? 'dormant' : ''),
      sway: col => {
        const t0 = fx.shake.get(`${col.q},${col.r}`);
        if (t0 == null) return 0;
        const elapsed = now - t0;
        if (elapsed >= SHAKE_MS) { fx.shake.delete(`${col.q},${col.r}`); return 0; }
        return Math.round(Math.sin(elapsed / 35) * 2 * (1 - elapsed / SHAKE_MS));
      },
      props: (ctx, col, mode) => drawColumnNodes(ctx, res, map, state, col, now, fx, mode),
    });

    game.ui.positionAnchors(camera, map, pixelScale());

    if (hudTerrain) {
      const col = hover && map.get(hover.q, hover.r);
      let label = '';
      if (col) {
        const f = col.feature;
        const foe = hostiles(state).find(u => u.q === col.q && u.r === col.r);
        const structureHint = f?.type === 'structure'
          ? ({ hut: 'click for stash', hearth: 'click to craft & cook', workbench: 'click to craft', forge: 'click to smelt' }[f.item] || '')
          : '';
        label = foe ? `${KINDS[foe.kind].name.toLowerCase()} · ${foe.hp}/${foe.maxHp} · ${KINDS[foe.kind].atk} attack, ${KINDS[foe.kind].def} defence`
          : fx.hover?.kind === 'ore' ? `ore vein · ${canMine() ? 'click to mine' : 'needs hammer or pickaxe'}`
            : cliffInfoAt(hoverWorld, hover) ? `cliff face · ${canMine() ? 'click to mine stone & flint' : 'needs hammer or pickaxe'}`
              : f?.type === 'village' ? `${f.name}, ${f.kind}${isTrusted(state, col.q, col.r) ? ' · trusts you' : ''}`
                : f?.type === 'camp' ? `${f.name}${f.burned ? ', burned' : guardsAt(state, col) ? ` · ${guardsAt(state, col)} guards` : ' · click to burn'}`
                  : f?.type === 'structure' ? `${f.name}${f.maxHp ? ` ${f.hp}/${f.maxHp}` : ''}${structureHint ? ` · ${structureHint}` : ''}`
                    : f?.type === 'crossing' ? 'a raiders’ crossing'
                      : (!f && map.spawn && col.q === map.spawn.q && col.r === map.spawn.r) ? 'cold campfire · relight with branch & flint'
                        : (!f && !fx.hover && hover.q === player.q && hover.r === player.r && ['stony', 'steppes'].includes(col.terrain) && (levelOf(state, 'mind') >= 3 || state.free)) ? 'stony ground · click to prospect for ore'
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
