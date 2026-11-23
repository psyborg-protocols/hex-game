// player_sprite.test.mjs — equipment-aware 4-direction player sprite & 6-slot snapshot tests.

import { test, eq, ok, run } from './_harness.mjs';
import { ITEMS } from '../data/game_data.js';
import { WorldMap } from '../src/world/mapformat.js';
import { createState } from '../src/game/state.js';
import { addItem, equipFromPack, unequipSlot, ensureWorn, countInPack } from '../src/game/inventory.js';
import { playerGearSnapshot } from '../src/game/gear.js';
import { Player } from '../src/game/player.js';
import { drawPawn, normalizeEquipped } from '../src/render/player_sprite.js';

/** Minimal Canvas 2D mock capturing all drawn integer pixels keyed by `"x,y"`. */
function makeMockCtx() {
  const ops = [];
  const grid = new Map();
  let fillStyle = '#000000';
  return {
    get fillStyle() { return fillStyle; },
    set fillStyle(v) { fillStyle = v; },
    save() {},
    restore() {},
    fillRect(x, y, w, h) {
      ok(Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(w) && Number.isFinite(h),
        `non-finite fillRect(${x}, ${y}, ${w}, ${h})`);
      const rx = Math.round(x), ry = Math.round(y), rw = Math.round(w), rh = Math.round(h);
      ops.push({ x: rx, y: ry, w: rw, h: rh, c: fillStyle });
      for (let yy = ry; yy < ry + rh; yy++) {
        for (let xx = rx; xx < rx + rw; xx++) {
          grid.set(`${xx},${yy}`, fillStyle);
        }
      }
    },
    signature() {
      return [...grid.entries()].sort((a, b) => a[0].localeCompare(b[0]))
        .map(([k, v]) => `${k}=${v}`).join('|');
    },
    grid,
    ops,
  };
}

function renderSig(facing = 1, ghost = false, anim = {}) {
  const ctx = makeMockCtx();
  drawPawn(ctx, 50, 50, facing, ghost, anim);
  ok(ctx.grid.size > 0, 'sprite should draw non-empty pixels');
  return ctx.signature();
}

test('walking_stick shares hand slot with weapons, updates live, and migrates legacy offhand saves', () => {
  eq(ITEMS.walking_stick.slot, 'hand', 'walking_stick must occupy hand slot');

  const s = createState();
  const empty = playerGearSnapshot(s);
  eq(empty.hand, null);
  eq(empty.offhand, null);
  eq(empty.head, null);
  eq(empty.body, null);
  eq(empty.feet, null);
  eq(empty.pack, null);

  addItem(s, 'walking_stick', 1);
  addItem(s, 'shield', 1);
  addItem(s, 'hide_armor', 1);
  addItem(s, 'boots', 1);
  addItem(s, 'amulet', 1);
  addItem(s, 'basket', 1);
  addItem(s, 'iron_axe', 1);
  addItem(s, 'pickaxe', 1);

  const snap = playerGearSnapshot(s);
  eq(snap.head, 'amulet');
  eq(snap.hand, 'walking_stick');
  eq(snap.offhand, 'shield');
  eq(snap.body, 'hide_armor');
  eq(snap.feet, 'boots');
  eq(snap.pack, 'basket');
  eq(snap.chopTool, 'iron_axe');
  eq(snap.mineTool, 'pickaxe');

  // Equipping a sword swaps walking_stick back into pack (impossible to hold both)
  addItem(s, 'sword', 1);
  const swordIdx = s.inventory.findIndex(x => x?.id === 'sword');
  ok(swordIdx >= 0);
  ok(equipFromPack(s, swordIdx).ok);
  eq(playerGearSnapshot(s).hand, 'sword');
  eq(countInPack(s, 'walking_stick'), 1, 'walking_stick returns to pack when sword equipped');

  ok(unequipSlot(s, 'offhand').ok);
  eq(playerGearSnapshot(s).offhand, null);

  // Legacy save migration: offhand walking_stick moves cleanly
  const leg1 = createState();
  leg1.worn.offhand = 'walking_stick';
  eq(ensureWorn(leg1).hand, 'walking_stick');
  eq(ensureWorn(leg1).offhand, null);

  const leg2 = createState();
  leg2.worn.hand = 'sword';
  leg2.worn.offhand = 'walking_stick';
  eq(ensureWorn(leg2).hand, 'sword');
  eq(ensureWorn(leg2).offhand, null);
  eq(countInPack(leg2, 'walking_stick'), 1, 'legacy dual-held walking_stick moves to pack without loss');
});

test('4-direction facing (side, down, up) and 4-frame walk cycle render cleanly across all poses', () => {
  // Side, Down, Up differ cleanly both idle and across every walk frame
  for (const dir of ['side', 'down', 'up']) {
    const idleSig = renderSig(1, false, { dir, moving: false });
    const frameSigs = [0, 0.25, 0.5, 0.75].map(wp => renderSig(1, false, { dir, moving: true, walkPhase: wp }));
    for (let i = 0; i < frameSigs.length; i++) {
      for (let j = i + 1; j < frameSigs.length; j++) {
        ok(frameSigs[i] !== frameSigs[j], `${dir} walk frame ${i} and ${j} must animate distinctly`);
      }
    }
    ok(frameSigs[1] !== idleSig, `${dir} passing frame differs from idle`);
  }

  const sideIdle = renderSig(1, false, { dir: 'side', moving: false });
  const downIdle = renderSig(1, false, { dir: 'down', moving: false });
  const upIdle = renderSig(1, false, { dir: 'up', moving: false });
  ok(sideIdle !== downIdle && downIdle !== upIdle && sideIdle !== upIdle,
    'side, down, and up silhouettes must look distinctly different');

  // Legacy offhand walking_stick + hand sword in normalizeEquipped drops offhand
  const merged = normalizeEquipped({ hand: 'sword', offhand: 'walking_stick' });
  eq(merged.hand, 'sword');
  eq(merged.offhand, null, 'normalizeEquipped prevents holding sword and walking_stick at once');

  const poses = [
    { name: 'idle', anim: { t: 0, moving: false } },
    { name: 'moving', anim: { t: 0.4, moving: true, walkPhase: 0.25 } },
    { name: 'downMove', anim: { t: 0.4, dir: 'down', moving: true, walkPhase: 0.5 } },
    { name: 'upMove', anim: { t: 0.4, dir: 'up', moving: true, walkPhase: 0.5 } },
    { name: 'seated', anim: { t: 0, seated: true } },
    { name: 'climbing', anim: { t: 0.3, moving: true, legT: 0.4, climbing: true } },
    { name: 'boat', anim: { t: 0.2, moving: true, legT: 0.3, boat: true } },
    { name: 'attack', anim: { t: 0.2, action: { kind: 'attack', p: 0.5 } } },
    { name: 'chop', anim: { t: 0.2, action: { kind: 'chop', p: 0.5 } } },
    { name: 'mine', anim: { t: 0.2, action: { kind: 'mine', p: 0.5 } } },
    { name: 'build', anim: { t: 0.2, action: { kind: 'build', p: 0.5 } } },
    { name: 'forage', anim: { t: 0.2, action: { kind: 'forage', p: 0.5 } } },
  ];

  for (const { name, anim } of poses) {
    for (const facing of [1, -1]) {
      for (const ghost of [false, true]) {
        const ctx = makeMockCtx();
        drawPawn(ctx, 40, 40, facing, ghost, anim);
        ok(ctx.grid.size >= 30, `${name} facing=${facing} ghost=${ghost} drew ${ctx.grid.size} pixels`);
      }
    }
  }
});

test('walking stick and sword have sleek silhouettes and no phantom gear appears when bare', () => {
  // Walking stick only renders when equipped
  for (const poseName of ['side', 'down', 'up', 'seated', 'climbing', 'boat']) {
    const baseAnim = poseName === 'seated' ? { seated: true }
      : poseName === 'climbing' ? { climbing: true, moving: true, legT: 0.25 }
        : poseName === 'boat' ? { boat: true, moving: true, legT: 0.25 }
          : { dir: poseName, moving: false };
    const bareSig = renderSig(1, false, { ...baseAnim, equipped: {} });
    const stickSig = renderSig(1, false, { ...baseAnim, equipped: { hand: 'walking_stick' } });
    const packSig = renderSig(1, false, { ...baseAnim, equipped: { pack: 'leather_pack' } });
    ok(bareSig !== stickSig, `${poseName}: walking_stick must visibly alter pixels`);
    ok(bareSig !== packSig, `${poseName}: leather_pack must visibly alter pixels`);
  }

  // Slender walking stick & sword widths (no fat 4px slabs)
  const bareCtx = makeMockCtx();
  drawPawn(bareCtx, 50, 50, 1, false, { dir: 'side', equipped: {} });
  const stickCtx = makeMockCtx();
  drawPawn(stickCtx, 50, 50, 1, false, { dir: 'side', equipped: { hand: 'walking_stick' } });
  const stickDiffYs = new Map();
  for (const [k, c] of stickCtx.grid) {
    if (bareCtx.grid.get(k) === c) continue;
    const [xx, yy] = k.split(',').map(Number);
    if (!stickDiffYs.has(yy)) stickDiffYs.set(yy, new Set());
    stickDiffYs.get(yy).add(xx);
  }
  for (const [yy, xs] of stickDiffYs) {
    ok(xs.size <= 2, `walking_stick row y=${yy - 50} too wide (${xs.size}px)`);
  }

  const swordCtx = makeMockCtx();
  drawPawn(swordCtx, 50, 50, 1, false, { dir: 'side', equipped: { hand: 'sword' } });
  for (let dy = -16; dy <= -8; dy++) {
    let cols = 0;
    for (let dx = 3; dx <= 8; dx++) {
      const k = `${50 + dx},${50 + dy}`;
      if (swordCtx.grid.get(k) !== bareCtx.grid.get(k)) cols++;
    }
    ok(cols <= 2, `sword blade at dy=${dy} should be slim (<=2px, got ${cols}px)`);
  }
});

test('every wearable item in ITEMS has distinct pixel art vs bare and vs siblings in every view', () => {
  const bySlot = new Map();
  for (const item of Object.values(ITEMS)) {
    if (!item.slot) continue;
    if (!bySlot.has(item.slot)) bySlot.set(item.slot, []);
    bySlot.get(item.slot).push(item.id);
  }

  for (const [slotKey, ids] of bySlot.entries()) {
    for (const pose of [
      { name: 'side', anim: { dir: 'side', moving: false } },
      { name: 'down', anim: { dir: 'down', moving: false } },
      { name: 'up', anim: { dir: 'up', moving: false } },
      { name: 'seated', anim: { seated: true } },
      { name: 'climbing', anim: { moving: true, legT: 0.25, climbing: true } },
    ]) {
      const bareSig = renderSig(1, false, { ...pose.anim, equipped: {} });
      const sigs = new Map();
      for (const id of ids) {
        const sig = renderSig(1, false, { ...pose.anim, equipped: { [slotKey]: id } });
        ok(sig !== bareSig, `${pose.name} ${slotKey}=${id} must differ from bare`);
        for (const [otherId, otherSig] of sigs) {
          ok(sig !== otherSig, `${pose.name} ${slotKey}: '${id}' must differ from '${otherId}'`);
        }
        sigs.set(id, sig);
      }
    }
  }
});

test('attack, chop, and mine animations vary cleanly by equipped weapons and tools', () => {
  const unarmedAtk = renderSig(1, false, { action: { kind: 'attack', p: 0.6 }, equipped: {} });
  const swordAtk = renderSig(1, false, { action: { kind: 'attack', p: 0.6 }, equipped: { hand: 'sword' } });
  const bowDraw = renderSig(1, false, { action: { kind: 'attack', p: 0.3 }, equipped: { hand: 'bow' } });
  const bowShot = renderSig(1, false, { action: { kind: 'attack', p: 0.7 }, equipped: { hand: 'bow' } });
  ok(unarmedAtk !== swordAtk, 'sword attack differs from unarmed jab');
  ok(swordAtk !== bowDraw && swordAtk !== bowShot, 'bow attack differs from sword slash');
  ok(bowDraw !== bowShot, 'bow shot release differs from drawstring draw');

  const shakeChop = renderSig(1, false, { action: { kind: 'chop', p: 0.5 }, equipped: {} });
  const stoneChop = renderSig(1, false, { action: { kind: 'chop', p: 0.5 }, equipped: { chopTool: 'stone_axe' } });
  const ironChop = renderSig(1, false, { action: { kind: 'chop', p: 0.5 }, equipped: { chopTool: 'iron_axe' } });
  ok(shakeChop !== stoneChop && stoneChop !== ironChop && shakeChop !== ironChop,
    'chop animations distinguish bare shake, stone_axe, and iron_axe');

  const hammerMine = renderSig(1, false, { action: { kind: 'mine', p: 0.5 }, equipped: { mineTool: 'stone_hammer' } });
  const pickMine = renderSig(1, false, { action: { kind: 'mine', p: 0.5 }, equipped: { mineTool: 'pickaxe' } });
  ok(hammerMine !== pickMine, 'mine animations distinguish stone_hammer and pickaxe');
});

test('Player directional facing, continuous multi-hex glide, and Player.draw work cleanly', () => {
  const map = new WorldMap({ seed: 'player-4dir' });
  for (let q = 0; q < 5; q++) for (let r = 0; r < 5; r++) map.place(q, r, 'grass', 1);
  const p = new Player(map, { q: 2, r: 2 });

  // Vertical movement sets up/down; horizontal movement sets side + facing +/-1
  p.faceToward(2, 1);
  eq(p.dir, 'up', 'north neighbor sets dir up');
  p.faceToward(2, 3);
  eq(p.dir, 'down', 'south neighbor sets dir down');
  p.faceToward(1, 2);
  eq(p.dir, 'side');
  eq(p.facing, -1, 'west neighbor sets facing -1');
  p.faceToward(3, 2);
  eq(p.dir, 'side');
  eq(p.facing, 1, 'east neighbor sets facing +1');

  // Mid-stride continuous interpolation across flat multi-hex path
  const start = p.pos;
  p.follow([{ q: 2, r: 2 }, { q: 3, r: 2 }, { q: 4, r: 2 }]);
  p.update(0.1);
  ok(p.moving, 'player should be mid-stride');
  ok(p.walkPhase > 0, 'walkPhase advances continuously');
  const mid = p.pos;
  ok(Number.isFinite(mid.x) && Number.isFinite(mid.y), 'interpolated mid-stride pos must be finite');
  ok(mid.x > start.x, 'mid-stride x advances smoothly toward destination');
  const ctx = makeMockCtx();
  p.draw(ctx);
  ok(ctx.grid.size > 0, 'Player.draw renders non-empty pixels mid-stride');
});

run('player_sprite');
