// main.js — bootstrap, the frame loop, and the wiring between world and UI.

import { loadTileset, BRIDGE_SHEET, bridgeFrame, isWater, variantFor } from './world/tileset.js';
import { loadDecor, BAKED_SHEETS } from './render/decor.js';
import { drawStructure, drawVillage, drawCamp, drawBridgeDeck, drawLadder, drawLadderTop, drawCrossing, hpBar } from './render/structures.js';
import { drawUnit, unitPos, drawDog, dogPos } from './render/units.js';
import { ensureDog, updateDog, commandDogGuard, commandDogFollow } from './game/dog.js';
import { generateWorld } from './world/worldgen.js';
import { findPath, isBridged } from './world/pathfinding.js';
import { Renderer } from './render/renderer.js';
import { Camera, pixelScale } from './core/camera.js';
import { Rng } from './core/rng.js';
import { Player } from './game/player.js';
import { pickHex, pointInHex, tileCenter, traceTopFace, distance, neighbors, columnBaseY, GEOM } from './world/hexgrid.js';

import { createState, itemName, RECIPES, ITEMS, dayOf, moonOf, isNight, hasBuilt } from './game/state.js';
import { walkOneStep, recomputeEnergy, countItem, addItem, removeItem, foodValue, usedSlots, capacity, isWorn } from './game/inventory.js';
import { craft, checkRecipe, recipeKnown } from './game/crafting.js';
import { ensureVillage, buy, sell, giveFavour, villageContext, isTrusted, isRaided } from './game/economy.js';
import { villageNear } from './game/context.js';
import { harvest, shakeTree, prospect, build, relightCampfire, placementSpots, growCrops, refreshArt, penaltyOnDeath, destroyStructure } from './game/actions.js';
import { clash } from './game/combat.js';
import { harvestSpec } from './game/harvests.js';
import { saveLocal, loadLocal, writeLocal, downloadSave, readSaveFile } from './game/save.js';
import { ensureMind, isKnown, isExplored, isMeditated, scenicOf, harvestsHere, HIDDEN } from './game/discovery.js';
import { resolveClick } from './game/pick.js';
import { makeMasks } from './render/masks.js';
import { createFx, drawColumnNodes, drawCampfire, SHAKE_MS } from './render/resources.js';
import { onStep as mindStep, onExplored, onMeditated, onTrade } from './game/mind.js';
import { Explorer } from './game/explorer.js';
import { attackDice, defenseDice, reach, maxHp, playerGearSnapshot } from './game/gear.js';
import { levelOf } from './game/skills.js';
import { checkJourney, STAGES, currentStage } from './game/journey.js';
import {
  updateUnits, garrisonCamps, guardsAt, hostiles, strike, spoils, rally, burnCamp,
  campsLeft, ensureRaidState, raidSize, abroad, KINDS, tickSchedule, stepRaidTurn, TURN_UNIT_SECONDS,
} from './game/raiders.js';
import { ensureTurnState, advanceTurn, advanceWorldTurn, spendMoveStep, spendAction } from './game/turns.js';
import { sleepContext, canSleep, sleepNight, passOut } from './game/sleep.js';
import { seedWildDogs, tryTameWildDog, strikeWildDog, wildDogAt, WILD_DOG_DEF } from './game/wild_dogs.js';
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
import { friendsPanel } from './ui/panels/friends.js';
import { playerTradePanel } from './ui/panels/player_trade.js';
import { joinScreen } from './ui/join_screen.js';
import { Multiplayer } from './net/multiplayer.js';
import { applyShared } from './game/shared.js';
import { WorldMap } from './world/mapformat.js';

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
  // Opened from a friend's link: join their world instead of making one.
  const joined = params.get('join') ? await joinScreen(params.get('join')) : null;
  const restored = joined ? fromWelcome(joined.welcome) : (params.get('load') === '1' ? loadLocal() : null);
  // A solo save carries no room: whoever saved it was playing alone by then.
  if (restored && !joined) delete restored.state.room;

  const seed = restored?.seed || params.get('seed') || String(Date.now());
  const map = restored ? restored.map : generateWorld({ seed, resolvers: res.resolvers });
  // A save from before every tree was a sprite still has dense woods drawn
  // with the trees baked into the tile; drawn as they are now, that would be
  // two sets of trees. Give them the bare floor the trees now stand on.
  for (const col of map) {
    if (BAKED_SHEETS.has(col.sprite)) Object.assign(col, variantFor(col.terrain, col.q, col.r));
  }
  const world = { map, resolvers: res.resolvers, seed };
  const rng = new Rng(`${seed}:play`);

  const state = restored ? restored.state : createState();
  if (params.get('free') === '1') state.free = true;
  ensureMind(state);
  ensureTurnState(state);
  state.stats ||= {};
  state.trust ||= {};
  state.goals ||= {};
  state.thoughts ||= {};
  state.stash ||= new Array(16).fill(null);
  if (state.hp == null) state.hp = maxHp(state);
  ensureRaidState(state);
  if (!restored) garrisonCamps(map, state);
  if (!restored || !state.wildDogsSeeded) seedWildDogs(map, state, () => rng.next());
  recomputeEnergy(state);

  const camera = new Camera({ scale: 3 });
  const renderer = new Renderer(canvas, res);
  renderer.resize(camera);

  const player = new Player(map, restored?.player || map.spawn);
  if (!restored) player.seated = true;
  const syncPlayerGear = () => {
    player.equipped = playerGearSnapshot(state);
  };
  syncPlayerGear();
  ensureDog(map, state, player);
  const start = player.restingPos;
  camera.centerOn(start.cx, start.cy);

  let hover = null;
  let hoverWorld = null;
  let follow = true;
  let preview = null;
  let placing = null;          // { recipeId, spots }
  let dogSelected = false;
  let features = [];
  let eye = false;
  let swing = 0;               // seconds until you can strike again
  let turnSimBudget = 0;       // simulated raid-unit seconds queued by turns
  let hudClock = 0;
  let saveClock = 0;
  let combatUntilTurn = -1;
  let currentShadeAlpha = isNight(state) ? 0.36 : 0;
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
    syncPlayerGear,
    panels: {
      inventory: inventoryPanel, crafting: craftingPanel, skills: skillsPanel, trade: tradePanel,
      build: buildPanel, menu: menuPanel, stash: stashPanel, message: messagePanel, friends: friendsPanel,
      pvptrade: playerTradePanel,
    },

    /** Open this world to friends. Resolves with the share link. */
    async doHostRoom({ mode, name, color }) {
      const link = await game.mp.host({ mode, name, color });
      syncPlayerGear();
      afterChange();
      return link;
    },

    doLeaveRoom() {
      game.mp.leave();
      syncPlayerGear();
      afterChange();
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
      takeAction(1);
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
          takeAction(1);
        } else {
          game.ui.notify(result.message);
          afterChange();
        }
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
        if (result.ok) takeAction(1);
        else afterChange();
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
        takeAction(1);
        if (!campsLeft(map).length && !state.won && game.mp?.mode !== 'competitive') victory();
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
        takeAction(1);
      });
    },

    doSleep() {
      if (dead || player.moving) return;
      const check = canSleep(map, state, player);
      if (!check.ok) {
        game.ui.notify(check.reason, 3600, 'bad');
        return;
      }
      player.stop();
      player.seated = true;
      const res = sleepNight(world, state, player, { rng: () => rng.next() });
      if (!res.ok) {
        game.ui.notify(res.message, 3600, 'bad');
        return;
      }
      wakeUp(res);
    },

    doWaitTurn() {
      if (dead || player.moving) return;
      const res = advanceTurn(world, state, player, {
        inCombat: (state.turn || 0) < combatUntilTurn,
        rng: () => rng.next(),
        resetProgress: true,
      });
      onTurnAdvanced(res);
    },

    toggleEye() { eye = !eye; game.ui.setEye(eye); },

    doSetColor(id) {
      if (!game.mp.requestColor(id)) {
        game.ui.notify('Someone else has that colour.', 3000, 'bad');
        return;
      }
      syncPlayerGear();
      game.ui.refreshPanel();
    },

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

  // Friends: the room you are in, and everyone else in it.
  game.mp = new Multiplayer({
    world, state, player, ui: game.ui, maxHp,
    defense: defenseDice,
    isDown: () => dead,
    // The host's raiders or dogs hit you.
    hurtMe: (damage, roll, source, by) => {
      if (by) lastHitBy = { by, turn: state.turn || 0 };
      state.hp = Math.max(0, state.hp - damage);
      combatUntilTurn = (state.turn || 0) + 1;
      if (roll) game.ui.showDice(playerPos, roll);
      else if (damage) game.ui.floatText(playerPos, `-${damage}`, 'bad');
      if (damage) chime('tick', 0.03);
      game.ui.updateHud();
    },
    // Host: the world clock moved on a turn; the world takes its turn near whoever leads.
    runWorldTurn: leaderPos => {
      const ev = [];
      const changed = advanceWorldTurn(world, state, leaderPos, {
        rng: () => rng.next(),
        dogs: { players: game.mp.players(), hurt: game.mp.hurt, clock: state.clock },
      }, ev);
      if (changed.length) rebuildFeatures();
      handleEvents(ev);
      const m = moonOf({ turn: game.mp.raidClock() });
      if (m.phase === 'raid' || abroad(state).length > 0
        || (state.units || []).some(u => u.hp > 0 && game.mp.players().some(p => distance(u.q, u.r, p.q, p.r) <= 8))) {
        turnSimBudget = Math.min(TURN_UNIT_SECONDS * 2, turnSimBudget + TURN_UNIT_SECONDS);
      }
    },
    clash,
    // Host: a friend swings at a raider or a wild dog we keep.
    resolveStrike: (from, m) => {
      if (m.target === 'unit') {
        const u = (state.units || []).find(x => x.id === m.id && x.hp > 0);
        if (!u) return { target: 'unit', id: m.id, miss: true };
        const roll = strike(state, u, m.dice);
        u.hitAt = performance.now();
        game.ui.showDice(unitAnchor(u), roll, { friendly: true });
        return { target: 'unit', id: u.id, roll, killed: u.hp <= 0, unit: { kind: u.kind, carry: u.carry || [], q: u.q, r: u.r } };
      }
      const wd = (state.wildDogs || []).find(d => d.id === m.id && d.hp > 0);
      if (!wd) return { target: 'dog', id: m.id, miss: true };
      const roll = clash(m.dice, WILD_DOG_DEF, { next: () => rng.next() });
      wd.hp -= roll.damage;
      wd.hostile = true;
      game.ui.showDice(wildDogAnchor(wd), roll, { friendly: true });
      if (wd.hp <= 0) state.wildDogs = state.wildDogs.filter(d => d !== wd);
      return { target: 'dog', id: wd.id, roll, killed: wd.hp <= 0, at: { q: wd.q, r: wd.r } };
    },
    // Guest: how our swing went.
    onStruck: m => {
      if (m.miss) return;
      if (m.target === 'unit') {
        const u = (state.units || []).find(x => x.id === m.id) || { ...m.unit };
        game.ui.showDice(unitAnchor(u), m.roll, { friendly: true });
        if (m.killed) fell({ ...m.unit, faction: 'raider' }, 'player');
        return;
      }
      const wd = (state.wildDogs || []).find(d => d.id === m.id) || { q: m.at.q, r: m.at.r };
      game.ui.showDice(wildDogAnchor(wd), m.roll, { friendly: true });
      if (m.killed) {
        const got = [];
        if (addItem(state, 'meat', 1)) got.push('1 raw meat');
        if (countItem(state, 'stone_knife') > 0 && addItem(state, 'hide', 1)) got.push('1 hide');
        chime('copper', 0.05);
        if (got.length) game.ui.floatText(wildDogAnchor(wd), `+ ${got.join(', ')}`, 'gain');
        afterChange();
      }
    },
    // Host: a friend's dog bit a raider.
    applyDamage: m => {
      const u = (state.units || []).find(x => x.id === m.id && x.hp > 0);
      if (u) { u.hp -= m.damage; u.hitAt = performance.now(); }
    },
    hostRally: (from, m) => { rally(state, m.at, map, m.n, from); },
    removeWildDog: id => { state.wildDogs = (state.wildDogs || []).filter(d => d.id !== id); },
    // A raider your tower or militia felled, far away.
    onSpoils: unit => {
      const got = spoils(state, unit);
      game.ui.floatText(playerPos, got.text, 'gain');
      chime('copper', 0.05);
      afterChange();
    },
    onPvpHit: m => {
      const them = game.mp.remotes.get(m.target);
      if (them) game.ui.showDice(() => them.pos, m.roll, { friendly: true });
    },
    onLoot: (gold, from) => {
      state.gold += gold;
      const name = game.mp.roster.find(p => p.id === from)?.name || 'them';
      game.ui.murmur(`You took ${gold} gold from ${name}.`, { tone: 'good', ms: 5000 });
      afterChange();
    },
    // One of your huts fell, far away: to raiders, or to a rival who takes the stash.
    onHutLost: (m, from) => {
      if (m.item !== 'hut') { game.ui.notify(`Your ${itemName(m.item).toLowerCase()} is down.`, 5200, 'bad'); return; }
      const items = state.stash.filter(Boolean);
      state.stash = state.stash.map(() => null);
      const name = game.mp.roster.find(p => p.id === m.by)?.name;
      if (m.by) game.mp.sendTo(m.by, { t: 'stashLoot', items });
      game.ui.notify(m.by ? `${name || 'A rival'} broke your hut and took the stash.` : 'Your hut is down, and the stash is gone.', 5600, 'bad');
      afterChange();
    },
    onStashLoot: items => {
      const got = [];
      for (const s of items || []) { const n = addItem(state, s.id, s.qty); if (n) got.push(`${n} ${itemName(s.id)}`); }
      if (got.length) game.ui.murmur(`From their stash: ${got.join(', ')}.`, { tone: 'good', ms: 6000 });
      afterChange();
    },
    onWinner: m => {
      const mine = m.id === meId();
      state.won = state.won || mine;
      game.ui.openPanel('message', {
        title: mine ? 'You win the race' : `${m.name} wins the race`,
        html: mine
          ? '<p class="lede">You walked the whole journey first.</p>'
          : `<p class="lede">${m.name} reached the end of the journey before anyone else.</p><p>The world is still here, if you want to keep going.</p>`,
      });
    },
    onTradeChanged: (tr, opts = {}) => {
      if (opts.opened) {
        const name = game.mp.roster.find(p => p.id === tr.them)?.name || 'Someone';
        game.ui.murmur(`${name} wants to trade.`, { ms: 4000 });
        game.ui.openPanel('pvptrade');
        return;
      }
      if (game.ui.openPanelName === 'pvptrade') game.ui.refreshPanel();
      else if (tr.status === 'cancelled' && tr.note) game.ui.notify(`Trade off: ${tr.note}.`, 3200);
    },
    onTradeDone: (tr, got) => {
      chime('gold', 0.05);
      game.ui.murmur(got.length ? `Traded. You got ${got.join(', ')}.` : 'Traded.', { tone: 'good', ms: 5000 });
      afterChange();
    },
    onDawn: () => {
      game.ui.murmur('Everyone has seen the night through. A new day begins.', { tone: 'good', ms: 4600 });
      afterChange();
    },
    onRoster: () => { syncPlayerGear(); game.ui.updateHud(); },
    // Someone else changed the world: show it.
    onWorldPatched: (res, patch) => {
      if (res.cols.length || patch.built || patch.structures) {
        if (res.cols.length && game.mp.mode !== 'competitive' && !state.won && !campsLeft(map).length) victory();
        rebuildFeatures();
        if (game.mp.isHost) homeless(patch);
        refreshContext();
        game.ui.updateHud();
      }
    },
  });

  /** A camp a friend burned: its raiders out on the road have nowhere to go home to. */
  function homeless(patch) {
    for (const [k, col] of patch.cols || []) {
      if (col?.feature?.type !== 'camp' || !col.feature.burned) continue;
      const [q, r] = k.split(',').map(Number);
      for (const u of state.units || []) if (u.home && u.home.q === q && u.home.r === r && u.mode === 'return') u.home = null;
    }
  }
  if (joined) {
    game.mp.attachGuest(joined.session, joined.welcome, joined.code);
    history.replaceState(null, '', location.pathname);
    syncPlayerGear();
  }

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

  /** Show how a night's sleep (chosen or not) went, and carry on from dawn. */
  function wakeUp(res) {
    if (res.cropsChanged?.length) rebuildFeatures();
    if (res.died) {
      game.ui.notify(res.message, 4600, 'bad');
      die();
      return;
    }
    if (res.wokenByDog) {
      chime('raid');
      game.ui.floatText(playerPos, `-${res.ambushDamage} wild dog!`, 'bad');
      game.ui.murmur(res.message, { tone: 'bad', ms: 5200 });
    } else {
      chime('gold', 0.05);
      const rough = res.coldDamage > 0 || res.passedOut;
      game.ui.murmur(res.message, { tone: rough ? 'bad' : 'good', ms: res.passedOut ? 6400 : 5200 });
      if (res.coldDamage > 0) game.ui.floatText(playerPos, `-${res.coldDamage} cold`, 'bad');
    }
    const ev = [];
    if (!game.mp?.isGuest) tickSchedule(world, state, ev, game.mp.raidClock());
    handleEvents(ev);
    // In a room your night ends at dawn; the new day starts when everyone's has.
    // (Woken in the dark by a wild dog, it is still night: carry on.)
    if (game.mp?.active && !res.wokenByDog) game.mp.beginWait();
    afterChange();
  }

  /** Stayed up to the turn before dawn: drop where you stand and sleep till morning. */
  function collapse() {
    player.stop();
    player.seated = true;
    wakeUp(passOut(world, state, player, { rng: () => rng.next() }));
  }

  /** What bedtime says as the night wears on (see MIDNIGHT in state.js). */
  const BEDTIME = {
    midnight: ['Midnight is close. Sleep now, or you will be tired all tomorrow.', ''],
    small_hours: ['Your eyes are heavy. Sleep soon, or tomorrow will be worse still.', 'bad'],
    pass_out: ['You can barely stand. Sleep now, or you will drop where you are.', 'bad'],
  };

  function onTurnAdvanced(res) {
    if (!res) return;
    const events = [...(res.events || [])];
    if (!game.mp?.isGuest) tickSchedule(world, state, events, game.mp.raidClock());
    const m = moonOf(state);
    if (m.phase === 'raid' || abroad(state).length > 0
      || (state.units || []).some(u => u.hp > 0 && distance(u.q, u.r, player.q, player.r) <= 8)) {
      turnSimBudget = Math.min(TURN_UNIT_SECONDS * 2, turnSimBudget + TURN_UNIT_SECONDS);
    }
    handleEvents(events);
    if (res.cropsChanged?.length) rebuildFeatures();
    if (res.becameNight) {
      game.ui.murmur('Dusk falls — 12 turns until dawn. Find shelter and warmth to sleep.', { ms: 4600 });
    } else if (res.becameDawn) {
      game.ui.murmur('Dawn breaks across the valley.', { tone: 'good', ms: 4200 });
    }
    if (res.fatigued === 1) {
      game.ui.murmur('Midnight passes. You will be tired all tomorrow, with less energy until dusk.', { tone: 'bad', ms: 5600 });
    } else if (res.fatigued === 2) {
      game.ui.murmur('The small hours. You will be exhausted all tomorrow, with half your energy until dusk.', { tone: 'bad', ms: 5600 });
    } else if (res.warn && BEDTIME[res.warn]) {
      const [text, tone] = BEDTIME[res.warn];
      game.ui.murmur(text, { tone, ms: 5200 });
    }
    if (state.hp <= 0 && !dead) { die(); return; }
    if (res.passOut) { collapse(); return; }
    afterChange();
  }

  function takeAction(cost = 1) {
    const adv = spendAction(world, state, player, cost, {
      inCombat: (state.turn || 0) < combatUntilTurn,
      rng: () => rng.next(),
    });
    if (adv.advanced) onTurnAdvanced(adv);
    else afterChange();
  }

  function afterChange() {
    syncPlayerGear();
    game.mp?.flush();
    // Competitive: the first to finish the whole journey wins the race.
    if (game.mp?.mode === 'competitive' && !state.raceClaimed && currentStage(state).done) {
      state.raceClaimed = true;
      game.mp.claimWin();
    }
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

  const dogDrawOpts = (d, selected = dogSelected) => ({
    facing: d.facing,
    t: state.time,
    stance: d.stance,
    wag: d.wag,
    moving: !!d.leg || !!d.pace?.moving,
    legT: d.leg ? d.leg.t : (d.pace ? d.pace.t : 0),
    attacking: state.time - (d.attackAt ?? -10) < 0.28,
    selected,
  });

  const dogEntity = () => {
    const d = ensureDog(map, state, player);
    if (!d) return [];
    const p = dogPos(map, d);
    return [{ q: d.q, r: d.r, draw: ctx => drawDog(ctx, p.x, p.y, dogDrawOpts(d)) }];
  };

  const wildDogEntities = () => (state.wildDogs || []).filter(d => d.hp > 0).map(d => {
    const { cx, cy } = tileCenter(d.q, d.r, Math.max(0, map.surfaceAt(d.q, d.r)));
    return {
      q: d.q, r: d.r,
      draw: ctx => {
        drawDog(ctx, cx, cy, {
          facing: d.facing || 1,
          t: state.time,
          stance: 'idle',
          wild: true,
          hostile: !!d.hostile,
        });
        if (d.hp < d.maxHp) {
          hpBar(ctx, Math.round(cx), Math.round(cy) - 16, d.hp / d.maxHp, d.hostile ? '#d1596d' : '#d9b45b');
        }
      },
    };
  });

  const onDogBody = (w) => {
    if (!w || !countItem(state, 'dog') || !state.dog) return false;
    const p = dogPos(map, state.dog);
    return Math.hypot(w.x - p.x, w.y - (p.y - 4)) <= 8;
  };

  const onWildDogBody = (w) => {
    if (!w || !(state.wildDogs || []).length) return null;
    for (const d of state.wildDogs) {
      if (d.hp <= 0) continue;
      const { cx, cy } = tileCenter(d.q, d.r, Math.max(0, map.surfaceAt(d.q, d.r)));
      if (Math.hypot(w.x - cx, w.y - (cy - 4)) <= 9) return d;
    }
    return null;
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
    // Your health, over your head, when you are hurt.
    if (state.hp < maxHp(state)) {
      const p = player.pos;
      hpBar(ctx, Math.round(p.x), Math.round(p.y) - 21, state.hp / maxHp(state), '#7ad15a');
    }
    if (!preview || preview.length < 2) return;
    ctx.fillStyle = 'rgba(255, 248, 220, 0.5)';
    for (let i = 1; i < preview.length; i++) {
      const { cx, cy } = tileCenter(preview[i].q, preview[i].r, Math.max(0, map.surfaceAt(preview[i].q, preview[i].r)));
      ctx.fillRect(Math.round(cx) - 1, Math.round(cy) - 1, 2, 2);
    }
  };

  /** Night falls across the 12 night turns of each 24-turn day. */
  const nightShade = (ctx) => {
    if (currentShadeAlpha <= 0.005) return;
    ctx.fillStyle = `rgba(14, 18, 52, ${currentShadeAlpha.toFixed(3)})`;
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
    if (dead || placing || player.moving || game.mp?.waiting) {
      game.ui.clearContext();
      return;
    }
    const offers = [];
    if (isNight(state)) {
      const sc = sleepContext(map, state, player);
      if (!sc.raidActive) {
        const label = sc.inVillage
          ? `Sleep at ${sc.village.feature.name} (${state.free ? 'free' : `${sc.cost}g`})`
          : sc.inHut && sc.nearFire ? 'Sleep in Hut'
            : sc.inHut ? (sc.cloaked ? 'Sleep in Hut' : 'Sleep in Hut (cold)')
              : sc.nearFire ? 'Sleep by Fire (exposed)'
                : sc.cloaked ? 'Sleep Outdoors (exposed)' : 'Sleep Outdoors (cold & exposed)';
        offers.push({ id: 'sleep', label, important: true });
      }
      offers.push({ id: 'wait', label: 'Wait 1 Turn' });
    } else if (abroad(state).length > 0 || state.raid?.stage === 'night') {
      offers.push({ id: 'wait', label: 'Wait 1 Turn' });
    }
    if (!offers.length) {
      game.ui.clearContext();
      return;
    }
    game.ui.setContext(offers, player, offer => {
      if (offer.id === 'sleep') game.doSleep();
      else if (offer.id === 'wait') game.doWaitTurn();
    });
  }

  player.speedAt = (from, to) => {
    const a = map.get(from.q, from.r), b = map.get(to.q, to.r);
    let m = 1;
    if (b && isWater(b.terrain) && !isBridged(map, to)) m *= 0.65;
    if (a?.terrain === 'path' && b?.terrain === 'path' && isWorn(state, 'cart')) m *= 1.6;
    if (state.energy <= 0 && foodValue(state) === 0 && !state.free) m *= 0.55;
    return m;
  };

  player.onStep = () => {
    const col = map.get(player.q, player.r);
    const step = walkOneStep(state, { cartOnRoad: col?.terrain === 'path' && isWorn(state, 'cart') });
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
    const turnStep = spendMoveStep(world, state, player, {
      inCombat: (state.turn || 0) < combatUntilTurn,
      rng: () => rng.next(),
    });
    if (turnStep.advanced) onTurnAdvanced(turnStep);
    else afterChangeLight();
  };

  /** A step is too frequent for the full refresh; just the cheap parts. */
  function afterChangeLight() {
    game.mp?.flush();
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
    if (game.mp?.isGuest) {
      game.mp.toHost({ t: 'rally', n: trusted, at: { q: player.q, r: player.r } });
      game.ui.murmur(`${Math.min(4, trusted)} from the villages stand with you.`, { tone: 'good', ms: 6000 });
      return;
    }
    const n = rally(state, player, map, trusted, meId());
    if (n) game.ui.murmur(`${n} from the villages stand with you.`, { tone: 'good', ms: 6000 });
  }

  // ----------------------------------------------------------------- combat

  function nearestFoe() {
    let best = null;
    const r = reach(state);
    for (const u of hostiles(state)) {
      const d = distance(u.q, u.r, player.q, player.r);
      if (d > r) continue;
      if (!best || d < best.d) best = { kind: 'unit', target: u, d };
    }
    for (const wd of state.wildDogs || []) {
      if (wd.hp <= 0 || !wd.hostile) continue;
      const d = distance(wd.q, wd.r, player.q, player.r);
      if (d > r) continue;
      if (!best || d < best.d) best = { kind: 'wildDog', target: wd, d };
    }
    return best;
  }

  function wildDogAnchor(wd) {
    return () => {
      const { cx, cy } = tileCenter(wd.q, wd.r, Math.max(0, map.surfaceAt(wd.q, wd.r)));
      return { x: cx, y: cy };
    };
  }

  /** Who you are in a room ('local' alone). */
  const meId = () => state.room?.playerId || 'local';

  /**
   * Competitive: someone you chose to fight (right-click, Attack), and you keep
   * swinging while they are in reach. { kind: 'player', id } or { kind: 'structure', q, r }.
   */
  let rivalTarget = null;
  let lastHitBy = null;

  function strikeRival() {
    const t = rivalTarget;
    if (game.mp?.mode !== 'competitive') { rivalTarget = null; return false; }
    if (t.kind === 'player') {
      const them = game.mp.remotes.get(t.id);
      if (!them || them.down || them.waiting) { rivalTarget = null; return false; }
      const d = distance(them.q, them.r, player.q, player.r);
      if (d > reach(state)) {
        if (d > 4) { rivalTarget = null; game.ui.murmur(`You let ${them.card.name} go.`); }
        return false;
      }
      swing = PLAYER_COOLDOWN;
      combatUntilTurn = (state.turn || 0) + 1;
      player.faceToward(them.q, them.r);
      player.triggerAction('attack', 0.45);
      game.mp.toHost({ t: 'pvp', target: t.id, dice: attackDice(state) });
      takeAction(1);
      return true;
    }
    const col = map.get(t.q, t.r);
    if (!col || (col.feature?.type !== 'structure' && col.feature?.type !== 'field')) { rivalTarget = null; return false; }
    if (distance(t.q, t.r, player.q, player.r) > 1) return false;
    swing = PLAYER_COOLDOWN;
    player.faceToward(t.q, t.r);
    player.triggerAction('attack', 0.45);
    const roll = clash(attackDice(state), 1);
    col.feature.hp = (col.feature.hp ?? 4) - roll.damage;
    const at = () => { const c = tileCenter(t.q, t.r, Math.max(0, map.surfaceAt(t.q, t.r))); return { x: c.cx, y: c.cy }; };
    game.ui.showDice(at, roll, { friendly: true });
    if (col.feature.hp <= 0) {
      const fallen = destroyStructure(world, state, col);
      rivalTarget = null;
      rebuildFeatures();
      refreshArt(world, [map.get(t.q, t.r)].filter(Boolean));
      game.ui.murmur(`The ${itemName(fallen.item).toLowerCase()} is down.`, { tone: 'good', ms: 4200 });
      if (fallen.owner && fallen.owner !== meId()) {
        game.mp.sendTo(fallen.owner, { t: 'hutLost', q: t.q, r: t.r, item: fallen.item, by: meId() });
      }
    }
    takeAction(1);
    return true;
  }

  function playerStrikes(dt) {
    swing -= dt;
    if (swing > 0 || player.moving || dead) return;
    if (rivalTarget && strikeRival()) return;
    const found = nearestFoe();
    if (!found) return;
    const foe = found.target;
    swing = PLAYER_COOLDOWN;
    combatUntilTurn = (state.turn || 0) + 1;
    player.faceToward(foe.q, foe.r);
    player.triggerAction('attack', 0.45);
    // In a friend's world the host rolls for the raiders and dogs it keeps.
    if (game.mp?.isGuest) {
      game.mp.toHost({ t: 'strike', target: found.kind === 'wildDog' ? 'dog' : 'unit', id: foe.id, dice: attackDice(state) });
      takeAction(1);
      return;
    }
    if (found.kind === 'wildDog') {
      const res = strikeWildDog(state, foe, attackDice(state), { next: () => rng.next() });
      game.ui.showDice(wildDogAnchor(foe), res.roll, { friendly: true });
      if (res.killed) {
        chime('copper', 0.05);
        if (res.loot.length) {
          game.ui.floatText(wildDogAnchor(foe), `+ ${res.loot.map(g => `${g.qty} ${itemName(g.id)}`).join(', ')}`, 'gain');
        }
      }
      takeAction(1);
      return;
    }
    const roll = strike(state, foe, attackDice(state));
    foe.hitAt = performance.now();
    game.ui.showDice(unitAnchor(foe), roll, { friendly: true });
    if (foe.hp <= 0) fell(foe, 'player');
    takeAction(1);
  }

  function fell(u, by, owner = null) {
    if (u.faction !== 'raider') {
      game.ui.notify('One of the villagers has fallen.', 4200, 'bad');
      return;
    }
    // A kill by someone else's watchtower or militia is theirs.
    const credit = owner || (by?.faction === 'ally' ? by.owner : null);
    if (game.mp?.active && credit && credit !== meId()) {
      game.mp.sendTo(credit, { t: 'spoils', unit: { kind: u.kind, carry: u.carry || [] } });
      afterChange();
      return;
    }
    if (by === 'player' || by === 'tower' || by === 'dog' || by?.faction === 'ally') {
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
        const other = e.playerId && game.mp?.remotes.get(e.playerId);
        if (e.target === 'player' && other) {
          e.who.facing = other.q >= e.who.q ? 1 : -1;
          game.ui.showDice(() => other.pos, e.roll);
        } else if (e.target === 'player') {
          combatUntilTurn = (state.turn || 0) + 1;
          e.who.facing = player.q >= e.who.q ? 1 : -1;
          game.ui.showDice(playerPos, e.roll);
          if (e.roll.damage) chime('tick', 0.03);
        } else if (e.target.faction) {
          e.target.hitAt = performance.now();
          game.ui.showDice(unitAnchor(e.target), e.roll, { friendly: e.target.faction === 'raider' });
        }
      } else if (e.type === 'wildDogClash') {
        const bitten = e.playerId && game.mp?.remotes.get(e.playerId);
        if (bitten) {
          game.ui.showDice(() => bitten.pos, e.roll);
        } else {
          combatUntilTurn = (state.turn || 0) + 1;
          game.ui.showDice(playerPos, e.roll);
          if (e.roll.damage) chime('tick', 0.03);
        }
      } else if (e.type === 'dogClash') {
        // Your dog's bite lands on the host's raider.
        if (game.mp?.isGuest) game.mp.toHost({ t: 'damage', target: 'unit', id: e.target.id, damage: e.roll.damage });
        e.target.hitAt = performance.now();
        game.ui.showDice(unitAnchor(e.target), e.roll, { friendly: true });
      } else if (e.type === 'arrow') {
        e.who.hitAt = performance.now();
        game.ui.showDice(unitAnchor(e.who), e.roll, { friendly: true });
      } else if (e.type === 'fell') {
        fell(e.unit, e.by, e.owner);
      } else if (e.type === 'destroyed') {
        // Raiders broke a friend's hut: their stash is lost, in their browser.
        if (game.mp?.active && e.owner && e.owner !== meId()) game.mp.sendTo(e.owner, { t: 'hutLost', q: e.q, r: e.r, item: e.item });
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
    const turn = Math.max(0, Math.floor(state.turn || 0));
    const out = abroad(state).length;
    const turnsTxt = n => { const k = Math.max(0, Math.round(n)); return `${k} ${k === 1 ? 'turn' : 'turns'}`; };
    if (raid?.stage === 'night') {
      const left = raid.waves.length - raid.sent;
      const more = left ? `, ${left} more wave${left > 1 ? 's' : ''} to come` : '';
      game.ui.setAlert(`${out} abroad${more} · dawn in ${turnsTxt(m.dawnAt - turn)}`, 'raid');
    } else if (raid?.stage === 'omen') {
      game.ui.setAlert(`${raidSize(raid.waves)} at dusk · ${turnsTxt(m.duskAt - turn)}`, 'omens');
    } else if (out) {
      game.ui.setAlert(`${out} still abroad`, 'omens');
    } else game.ui.setAlert('');
  }

  function healthTick() {
    if (dead) return;
    const max = maxHp(state);
    if (state.hp > max) state.hp = max;
    // Salve, when it matters.
    if (state.hp <= Math.min(4, max / 3) && countItem(state, 'salve')) {
      removeItem(state, 'salve', 1);
      state.hp = Math.min(max, state.hp + ITEMS.salve.heal);
      game.ui.floatText(playerPos, '+5 salve', 'heal');
    }
    if (state.hp <= 0) die();
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
    rivalTarget = null;
    state.stats.deaths = (state.stats.deaths || 0) + 1;
    const loss = penaltyOnDeath(state);
    // Struck down by another player: the gold you lose is theirs.
    const killer = lastHitBy && (state.turn || 0) - lastHitBy.turn <= 1 ? lastHitBy.by : null;
    lastHitBy = null;
    if (killer && game.mp?.active && loss.gold) game.mp.sendTo(killer, { t: 'loot', gold: loss.gold });
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

  /**
   * The one hex to highlight. When the pointer is on something a click would
   * act on — a tree whose canopy reaches over the next hex, say — that is the
   * hex lit, not whichever hex happens to be under the pointer; showing both
   * read as two targets. A tree glows rather than being outlined.
   */
  function highlightFor() {
    const n = fx.hover;
    if (n && n.q != null) {
      const at = n.on || n;      // a node on the water belongs to the water hex
      return { q: at.q, r: at.r, glow: n.kind === 'tree' };
    }
    return hover;
  }

  /** How far a wood being shaken is pushed sideways at time `now` (ms). */
  function swayOf(col, now) {
    const k = `${col.q},${col.r}`;
    const t0 = fx.shake.get(k);
    if (t0 == null) return 0;
    const elapsed = now - t0;
    if (elapsed >= SHAKE_MS) { fx.shake.delete(k); return 0; }
    return Math.round(Math.sin(elapsed / 35) * 2 * (1 - elapsed / SHAKE_MS));
  }

  const hitNodeAt = (e, hex) => {
    const w = worldAt(e);
    // Trees are picked by their drawn art, not by the hex under the pointer:
    // a canopy overhangs into the tiles around it. The whole decision lives in
    // pick.js so it is testable without a browser. It is handed the same sway
    // the renderer draws with, so a shaken tree is hit where it is.
    const node = resolveClick(w.x, w.y, map, state, hex, res.decor.index, res.masks,
      performance.now() / 1000, col => swayOf(col, performance.now()));
    if (node || !hex) return node;
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

  function interactWildDog(wd) {
    if (!wd || wd.hp <= 0) return;
    if (wd.hostile) {
      const d = distance(wd.q, wd.r, player.q, player.r);
      if (d <= reach(state)) {
        swing = 0;
        playerStrikes(0.1);
        return;
      }
      walkToAndDo(map.get(wd.q, wd.r), reach(state), () => {
        swing = 0;
        playerStrikes(0.1);
      });
      return;
    }
    walkToAndDo(map.get(wd.q, wd.r), 1, () => {
      const live = wildDogAt(state, wd.q, wd.r);
      if (!live) return;
      player.faceToward(live.q, live.r);
      player.triggerAction('forage', 0.55);
      const res = tryTameWildDog(map, state, player, live, () => rng.next());
      if (!res.ok) {
        game.ui.notify(res.message, 3600, 'bad');
        return;
      }
      if (res.tamed) {
        if (game.mp?.isGuest) game.mp.toHost({ t: 'tamed', id: live.id });
        chime('gold');
        game.ui.floatText(playerPos, '+ Dog', 'gain');
        game.ui.murmur(res.message, { tone: 'good', ms: 5200 });
      } else {
        chime('tick', 0.05);
        game.ui.murmur(res.message, { ms: 4400 });
      }
      takeAction(1);
    });
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
      player.dir = 'side';
      player.facing = node.dx >= 0 ? 1 : -1;
      player.triggerAction('chop', SHAKE_MS / 1000);
      chime('tick', 0.04);
      const res = shakeTree(world, state, { q: node.q, r: node.r });
      if (res.gained?.length) {
        game.ui.floatText(playerPos, '+ 1 Branch', 'gain');
        checkItemThoughts(res.gained.map(g => g.id));
        game.ui.notify('A branch shakes loose — you need an axe to fell the tree.');
        takeAction(1);
      } else {
        game.ui.notify('Nothing else shakes loose. You need an axe to fell the tree.');
        afterChange();
      }
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

  /**
   * Right-click (or press and hold) another player for what you can do with
   * them: trade, and in Competitive fight. A rival's building can be attacked too.
   * Clicking a player never does anything by itself.
   */
  function playerMenu(e) {
    if (!game.mp?.active || dead) return;
    const hex = hexAt(e);
    if (!hex) return;
    const items = [];
    const them = game.mp.remoteAt(hex.q, hex.r);
    const competitive = game.mp.mode === 'competitive';
    if (them) {
      const name = them.card.name;
      const near = distance(them.q, them.r, player.q, player.r) <= 1;
      items.push({ label: `Trade with ${name}`, run: () => {
        if (!near) return game.ui.notify(`Walk next to ${name} to trade.`);
        if (game.mp.openTrade(them.id)) game.ui.openPanel('pvptrade');
      } });
      if (competitive) items.push({ label: `Attack ${name}`, bad: true, run: () => {
        rivalTarget = { kind: 'player', id: them.id };
        game.ui.murmur(near ? `You go for ${name}.` : `Get close to ${name} to fight.`, { tone: 'bad', ms: 3000 });
      } });
    } else if (competitive) {
      const col = map.get(hex.q, hex.r);
      const rec = state.built.find(b => b.q === hex.q && b.r === hex.r);
      if (rec && rec.owner && rec.owner !== meId() && (col?.feature?.type === 'structure' || col?.feature?.type === 'field')) {
        const owner = game.mp.roster.find(p => p.id === rec.owner)?.name || 'a rival';
        items.push({ label: `Attack ${owner}'s ${itemName(rec.item).toLowerCase()}`, bad: true, run: () => {
          rivalTarget = { kind: 'structure', q: hex.q, r: hex.r };
          game.ui.murmur('Stand beside it to tear it down.', { tone: 'bad', ms: 3000 });
        } });
      }
    }
    if (items.length) game.ui.showMenu(e.clientX, e.clientY, items);
  }
  canvas.addEventListener('contextmenu', e => { e.preventDefault(); playerMenu(e); });
  let holdTimer = null;
  canvas.addEventListener('pointerdown', e => {
    clearTimeout(holdTimer);
    if (e.pointerType !== 'mouse') {
      holdTimer = setTimeout(() => {
        if (drag.moved < 8) { drag.moved = 99; playerMenu(e); } // 99: not a tap when lifted
      }, 550);
    }
  });
  canvas.addEventListener('pointerup', () => clearTimeout(holdTimer));

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
    const ptrWorld = worldAt(e);
    hoverWorld = hit ? ptrWorld : null;
    // A canopy can be under the pointer with no hex at all (over the sky past
    // the world's edge), so the node is asked for even when `hit` is null.
    fx.hover = (!placing && !dead) ? hitNodeAt(e, hit) : null;
    const hoverCol = hit && map.get(hit.q, hit.r);
    const hoverWild = (!placing && !dead) ? (onWildDogBody(ptrWorld) || (hit && wildDogAt(state, hit.q, hit.r))) : null;
    const interactive = !placing && !dead && (dogSelected || onDogBody(ptrWorld) || !!hoverWild || !!fx.hover || !!hit && (
      (hoverCol?.feature?.type === 'village')
      || (hoverCol?.feature?.type === 'structure' && ['hut', 'hearth', 'workbench', 'forge'].includes(hoverCol.feature.item))
      || (hoverCol?.feature?.type === 'camp' && !hoverCol.feature.burned && !guardsAt(state, hoverCol))
      || !!cliffInfoAt(hoverWorld, hit)
      || (!player.moving && hit.q === player.q && hit.r === player.r && (
        (scenicOf(map, hoverCol).tier > 0 && isExplored(state, player.q, player.r) && !isMeditated(state, player.q, player.r))
        || (['stony', 'steppes'].includes(hoverCol?.terrain) && (levelOf(state, 'mind') >= 3 || state.free))
      ))
    ));
    canvas.style.cursor = interactive ? 'pointer' : '';
    if (moved && !placing) preview = hover && !player.moving && !dogSelected ? findPath(map, player, hover, pathOpts()) : null;
  });

  canvas.addEventListener('pointerup', e => {
    canvas.releasePointerCapture(e.pointerId);
    const wasDrag = drag.moved > 4;
    drag.active = false;
    if (wasDrag || dead) return;
    if (e.button === 2) return; // a right-click opens the player menu, nothing more
    if (game.mp?.waiting) { game.ui.notify('Your day is done. The new one starts when everyone has finished theirs.'); return; }

    const chosen = placing ? spotAt(e) : null;
    let target = chosen || hexAt(e);
    // Nothing but sky under the pointer — unless a canopy reaches over it.
    if (!target && !placing) {
      const tree = hitNodeAt(e, null);
      if (tree) target = { q: tree.q, r: tree.r, h: map.get(tree.q, tree.r)?.h ?? 0 };
    }
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
        takeAction(1);
      }
      return;
    }

    const clickWorld = worldAt(e);
    const onDog = onDogBody(clickWorld);
    const clickPos = player.pos;
    const onPlayer = Math.hypot(clickWorld.x - clickPos.x, clickWorld.y - (clickPos.y - 7)) <= 9;

    if (dogSelected) {
      if (onDog || onPlayer) {
        dogSelected = false;
        return;
      }
      const res = commandDogGuard(map, state, player, target, pathOpts());
      dogSelected = false;
      if (!res.ok) game.ui.notify(res.reason);
      else game.ui.notify(res.alreadyThere ? 'Your dog sits to guard here.' : 'Your dog trots off to guard that hex.');
      return;
    }

    if (onDog) {
      const dogP = dogPos(map, state.dog);
      const dDog = Math.hypot(clickWorld.x - dogP.x, clickWorld.y - (dogP.y - 4));
      const dPly = Math.hypot(clickWorld.x - clickPos.x, clickWorld.y - (clickPos.y - 7));
      if (!onPlayer || dDog <= dPly) {
        if (state.dog?.mode === 'guard') {
          commandDogFollow(state);
          game.ui.notify('Your dog trots back to follow you.');
          return;
        }
        dogSelected = true;
        preview = null;
        game.ui.notify('Dog selected — click a hex to set it to guard.');
        return;
      }
    }

    // Clicking a raider walks you up to it; clicking a wild dog interacts or fights.
    const foe = hostiles(state).find(u => u.q === target.q && u.r === target.r);
    const wd = !foe ? (onWildDogBody(clickWorld) || wildDogAt(state, target.q, target.r)) : null;
    if (wd) {
      interactWildDog(wd);
      return;
    }
    let goal = target;
    if (foe) {
      const d = distance(foe.q, foe.r, player.q, player.r);
      if (d <= reach(state)) {
        swing = 0;
        playerStrikes(0.1);
        return;
      }
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
      if (dogSelected) { dogSelected = false; return; }
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
    if (k === 'z' && !game.ui.openPanelName && !game.mp?.waiting) game.doSleep();
    if (e.key === '.' && !game.ui.openPanelName && !game.mp?.waiting) game.doWaitTurn();
    if (/^[1-9]$/.test(e.key) && !game.ui.openPanelName) game.ui.pickContext(Number(e.key) - 1);
  });

  // ------------------------------------------------------------ frame loop

  const hudTerrain = document.getElementById('hud-terrain');
  let last = performance.now();

  let lastFrameAt = performance.now();
  function frame(now) {
    lastFrameAt = performance.now();
    tick(now);
    requestAnimationFrame(frame);
  }

  function tick(now, maxDt = 0.05) {
    const dt = Math.min(maxDt, Math.max(0, (now - last) / 1000));
    last = now;
    const running = !game.ui.paused && !dead;

    player.update(dt);
    game.mp.tick(dt, now);

    if (running) {
      state.time += dt;
      const { turnInDay } = dayOf(state);
      const targetShade = turnInDay < 10 ? 0
        : turnInDay === 10 ? 0.06
          : turnInDay === 11 ? 0.17
            : turnInDay <= 21 ? 0.36
              : turnInDay === 22 ? 0.24
                : 0.11;
      currentShadeAlpha += (targetShade - currentShadeAlpha) * Math.min(1, dt * 4);

      const events = [];
      updateDog({ world, state, player, events, boat: hasBoat() }, dt);
      // In a friend's world the host moves the raiders; we only watch them come.
      const simDt = game.mp?.isGuest ? 0 : Math.min(turnSimBudget, dt * 3.0);
      if (simDt > 0) {
        turnSimBudget -= simDt;
        updateUnits(game.mp?.active
          ? { world, state, player, events, players: game.mp.players(), hurt: game.mp.hurt, clock: game.mp.raidClock() }
          : { world, state, player, events, playerDown: dead }, simDt);
      }
      handleEvents(events);
      playerStrikes(dt);
      healthTick();

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
        takeAction(1);
      }
    }

    if (follow) {
      const p = player.pos;
      camera.moveTo(p.x, p.y);
    }
    camera.update(dt);

    renderer.render(map, camera, {
      hover: placing ? null : highlightFor(),
      // The exploring glow belongs to the hex you stand on, so it is drawn with
      // that hex and hidden by whatever hides the hex. As an overlay it was
      // painted over everything: stand behind a peak and the ring ran round the
      // mountain's face, as if that were what you were exploring.
      entities: [...features, ...chargeEntity(now), ...meditationEntity(now), ...pings.entities(map, now, inView), ...unitEntities(), ...wildDogEntities(), ...dogEntity(), ...game.mp.entities(), player],
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
          for (const wd of state.wildDogs || []) {
            if (wd.hp <= 0) continue;
            const { cx, cy } = tileCenter(wd.q, wd.r, Math.max(0, map.surfaceAt(wd.q, wd.r)));
            drawDog(ctx, cx, cy, { facing: wd.facing || 1, t: state.time, stance: 'idle', wild: true, hostile: !!wd.hostile });
          }
          if (countItem(state, 'dog') && state.dog) {
            const p = dogPos(map, state.dog);
            drawDog(ctx, p.x, p.y, dogDrawOpts(state.dog, false));
          }
          game.mp.drawGhosts(ctx);
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
      sway: col => swayOf(col, now),
      props: (ctx, col, mode) => drawColumnNodes(ctx, res, map, state, col, now, fx, mode),
    });

    game.ui.positionAnchors(camera, map, pixelScale());

    if (hudTerrain) {
      const col = hover && map.get(hover.q, hover.r);
      let label = '';
      if (col) {
        const f = col.feature;
        const foe = hostiles(state).find(u => u.q === col.q && u.r === col.r);
        const wd = wildDogAt(state, col.q, col.r);
        const structureHint = f?.type === 'structure'
          ? ({ hut: 'click for stash', hearth: 'click to craft & cook', workbench: 'click to craft', forge: 'click to smelt' }[f.item] || '')
          : '';
        label = foe ? `${KINDS[foe.kind].name.toLowerCase()} · ${foe.hp}/${foe.maxHp} · ${KINDS[foe.kind].atk} attack, ${KINDS[foe.kind].def} defence`
          : wd ? (wd.hostile
            ? `wild dog (hostile) · ${wd.hp}/${wd.maxHp} · click to fight`
            : `wild dog · click with meat or meal to tame (Mind 2)`)
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
  // A tab in the background gets no animation frames. Alone that is a pause,
  // which is fine; in a room the world must go on (the host runs the raiders,
  // and everyone still tells the others where they are), so when frames stop
  // coming a timer keeps ticking, in larger steps.
  setInterval(() => {
    if (game.mp?.active && performance.now() - lastFrameAt > 500) tick(performance.now(), 1);
  }, 250);

  /** Run the world forward by `turns` turns — for testing from the console. */
  game.advance = (turns = 1) => {
    const count = Math.max(1, Math.round(turns));
    for (let i = 0; i < count; i++) {
      const res = advanceTurn(world, state, player, {
        inCombat: (state.turn || 0) < combatUntilTurn,
        rng: () => rng.next(),
      });
      const ev = [...(res.events || [])];
      stepRaidTurn({ world, state, player, events: ev, playerDown: dead });
      handleEvents(ev);
      if (res.cropsChanged?.length) rebuildFeatures();
    }
    afterChange();
    return state.turn;
  };

  refreshContext();
  announceMind(mindStep(world, state, player));
  checkJourney(state, world);
  game.ui.updateHud();

  // There is one save slot, and every open tab writes to it. `?nosave=1` keeps
  // a tab opened to test something from overwriting the game you are playing.
  // A guest's copy of someone else's world never goes into your own save slot.
  const mayAutosave = () => !dead && !(state.room && !state.room.host);
  if (params.get('nosave') !== '1') {
    setInterval(() => { if (mayAutosave()) saveLocal(world, state, player); }, 45000);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && mayAutosave()) saveLocal(world, state, player);
    });
  }

  game.renderer = renderer;
  game.getPlacing = () => placing;
  window.game = game;
}

/** A host's welcome, as a world to boot: their map and shared world, your own fresh self. */
function fromWelcome(welcome) {
  const snap = welcome.snapshot;
  const state = createState();
  applyShared(state, snap.shared);
  state.playerColor = welcome.you.color;
  // You start at the dawn of the day everyone is in.
  state.turn = snap.dawn || 0;
  return { map: WorldMap.fromJSON(snap.map), state, player: snap.spawn, seed: snap.seed };
}

/** Keys typed into a text box are not hotkeys. */
const typing = e => /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName || '') || e.target?.isContentEditable;

boot().catch(err => {
  console.error(err);
  document.getElementById('hud-stats').textContent = `boot failed: ${err.message}`;
});
