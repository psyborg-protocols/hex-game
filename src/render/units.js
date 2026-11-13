// units.js
// Crisp integer-pixel figures for raiders, brutes, the warlord, village militia,
// villagers, and your companion dog. Matches the new_tiles/ dark outline and
// top-left key light idiom, with animated strides and distinct silhouettes.

import { tileCenter } from '../world/hexgrid.js';
import { hpBar } from './structures.js';

const INK = '#1b1420';
const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

const px = (ctx, c, x, y, w = 1, h = 1) => {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

/** Screen position of a unit mid-stride, the same way the player's is worked out. */
export function unitPos(map, u) {
  if (!u.leg) {
    const { cx, cy } = tileCenter(u.q, u.r, Math.max(0, map.surfaceAt(u.q, u.r)));
    return { x: cx, y: cy };
  }
  const { from, to, t } = u.leg;
  const a = tileCenter(from.q, from.r, Math.max(0, map.surfaceAt(from.q, from.r)));
  const b = tileCenter(to.q, to.r, Math.max(0, map.surfaceAt(to.q, to.r)));
  const e = ease(Math.min(1, t));
  const hop = Math.sin(Math.min(1, t) * Math.PI) * 2;
  return { x: a.cx + (b.cx - a.cx) * e, y: a.cy + (b.cy - a.cy) * e - hop };
}

const LOOK = {
  raider:  { cloak: '#6e2e30', lit: '#9e4747', shade: '#471b1d', skin: '#d8b08c', horns: true, shield: true, size: 1 },
  brute:   { cloak: '#4d2c24', lit: '#7a483a', shade: '#2f1914', skin: '#c99c78', horns: true, bigAxe: true, size: 1.25 },
  warlord: { cloak: '#2c1820', lit: '#8c2a3a', shade: '#190c11', skin: '#c99c78', horns: true, crown: true, cape: true, size: 1.4 },
  militia: { cloak: '#2f5d8a', lit: '#568ec4', shade: '#1f3e5e', skin: '#e8c9a0', helm: true, shield: true, spear: true, size: 1 },
  villager:{ cloak: '#4f7a3a', lit: '#7aa85b', shade: '#355425', skin: '#e8c9a0', hat: true, size: 0.9 },
};

/**
 * Draw any non-player character at integer pixel coordinates (x, y).
 */
export function drawFigure(ctx, x, y, kind, facing = 1, t = 0, flash = 0, ghost = false, moving = false, legT = 0) {
  const L = LOOK[kind] || LOOK.raider;
  const s = L.size;
  const f = facing >= 0 ? 1 : -1;
  const hw = Math.round(4 * s);
  const h = Math.round(8 * s);

  const breathe = !moving && Math.sin(t * 2.4 + x) > 0.4 ? 1 : 0;
  const stride = moving ? Math.sin(legT * Math.PI * 2) : 0;
  const stepLift = moving ? Math.round(Math.abs(Math.cos(legT * Math.PI * 2))) : 0;
  const by = y - stepLift;

  if (!ghost) {
    ctx.fillStyle = 'rgba(20, 16, 30, 0.32)';
    ctx.fillRect(x - hw - 1, y, hw * 2 + 2, 2);
    ctx.fillRect(x - hw, y - 1, hw * 2, 1);
  }

  // Warlord flowing cape behind body
  if (L.cape) {
    px(ctx, INK, x - hw - 2, by - h, hw * 2 + 4, h + 1);
    px(ctx, flash > 0 ? '#ffffff' : '#6e1c2b', x - hw - 1, by - h + 1, hw * 2 + 2, h - 1);
  }

  // Stepping boots
  const footA = Math.round(stride * 2);
  px(ctx, INK, x - 3 + footA, y - 2, 2, 3);
  px(ctx, '#4d2c1b', x - 3 + footA, y - 1, 1, 1);
  px(ctx, INK, x + 1 - footA, y - 2, 2, 3);
  px(ctx, '#6b3e26', x + 1 - footA, y - 1, 1, 1);

  // Tapered torso / tunic
  px(ctx, INK, x - hw, by - h + breathe, hw * 2, h - 1);
  px(ctx, INK, x - hw + 1, by - h - 1 + breathe, hw * 2 - 2, 1);
  const fill = flash > 0 ? '#ffffff' : L.cloak;
  const lit = flash > 0 ? '#ffffff' : L.lit;
  const shade = flash > 0 ? '#ffffff' : L.shade;
  px(ctx, fill, x - hw + 1, by - h + 1 + breathe, hw * 2 - 2, h - 3);
  px(ctx, lit, x - hw + 1, by - h + 1 + breathe, Math.max(2, Math.floor(hw * 0.7)), h - 4);
  px(ctx, shade, x + 1, by - h + 1 + breathe, Math.max(1, hw - 2), h - 3);
  // Belt / fur trim
  px(ctx, L.horns ? '#70584a' : '#a87a45', x - hw + 1, by - 4 + breathe, hw * 2 - 2, 1);

  // Head (rounded crown silhouette)
  const hr = s > 1.2 ? 3 : 2;
  const hy = by - h - hr - 1 + breathe;
  px(ctx, INK, x - hr - 1, hy - hr + 1, hr * 2 + 2, hr * 2);
  px(ctx, INK, x - hr, hy - hr, hr * 2, hr * 2 + 1);
  px(ctx, flash > 0 ? '#ffffff' : L.skin, x - hr, hy - hr + 1, hr * 2, hr * 2 - 1);

  if (L.horns) {
    // Iron helmet & curved pale horns
    px(ctx, '#4f5566', x - hr, hy - hr, hr * 2, 2);
    px(ctx, '#8892a8', x - hr, hy - hr, hr, 1);
    px(ctx, INK, x - hr - 2, hy - hr - 3, 2, 3);
    px(ctx, '#f0e6d2', x - hr - 1, hy - hr - 2, 1, 2);
    px(ctx, INK, x + hr, hy - hr - 3, 2, 3);
    px(ctx, '#f0e6d2', x + hr, hy - hr - 2, 1, 2);
  }
  if (L.crown) {
    // Warlord spiked gold crown
    px(ctx, '#ffcd75', x - 3, hy - hr - 2, 1, 2);
    px(ctx, '#ffcd75', x, hy - hr - 3, 1, 3);
    px(ctx, '#ffcd75', x + 2, hy - hr - 2, 1, 2);
  }
  if (L.helm) {
    // Kettle helm
    px(ctx, INK, x - hr - 2, hy - hr - 1, hr * 2 + 4, 2);
    px(ctx, '#94b0c2', x - hr - 1, hy - hr - 1, hr * 2 + 2, 2);
    px(ctx, '#c7d4df', x - hr - 1, hy - hr - 1, hr + 1, 1);
  }
  if (L.hat) {
    // Straw/felt villager hat
    px(ctx, INK, x - hr - 2, hy - hr, hr * 2 + 4, 2);
    px(ctx, '#e2c26b', x - hr - 1, hy - hr, hr * 2 + 2, 1);
    px(ctx, '#c4963e', x - hr, hy - hr - 1, hr * 2, 1);
  }

  // Eye
  px(ctx, L.crown ? '#f06070' : INK, x + (f > 0 ? 1 : -1), hy, 1, 1);

  // Off-hand shield
  if (L.shield) {
    const sx = x - f * (hw + 1);
    px(ctx, INK, sx - 1, by - h + 1 + breathe, 3, 5);
    px(ctx, L.helm ? '#4b82b8' : '#7a4a2e', sx, by - h + 2 + breathe, 2, 3);
    px(ctx, '#e2c26b', sx, by - h + 3 + breathe, 1, 1);
  }

  // Leading-side weapon
  const wx = x + f * (hw + 1);
  if (L.spear) {
    px(ctx, INK, wx, by - h - 5 + breathe, 2, h + 4);
    px(ctx, '#8e5a32', wx, by - h - 2 + breathe, 1, h);
    px(ctx, '#d4dde6', wx, by - h - 5 + breathe, 1, 3);
  } else if (L.bigAxe) {
    px(ctx, INK, wx, by - h - 4 + breathe, 2, h + 2);
    px(ctx, '#8e5a32', wx, by - h - 1 + breathe, 1, h - 1);
    px(ctx, INK, wx - 1, by - h - 4 + breathe, 4, 4);
    px(ctx, '#b8c4d4', wx, by - h - 3 + breathe, 2, 2);
    if (L.crown) px(ctx, '#f06070', wx + 1, by - h - 2 + breathe, 1, 1);
  } else if (!L.hat) {
    px(ctx, INK, wx, by - h - 2 + breathe, 2, h);
    px(ctx, '#8e5a32', wx, by - h + 1 + breathe, 1, h - 3);
    px(ctx, '#b8c4d4', wx + f, by - h - 1 + breathe, 2, 2);
  }
}

export function drawUnit(ctx, map, u, now, ghost = false) {
  const { x, y } = unitPos(map, u);
  const flash = u.hitAt && now - u.hitAt < 140 ? 1 : 0;
  drawFigure(
    ctx,
    Math.round(x),
    Math.round(y),
    u.kind,
    u.facing || 1,
    now / 1000,
    flash,
    ghost,
    !!u.leg,
    u.leg ? u.leg.t : 0,
  );
  if (u.hp < u.maxHp) {
    hpBar(ctx, Math.round(x), Math.round(y) - 20 * (u.kind === 'warlord' ? 1.2 : 1), u.hp / u.maxHp, u.faction === 'raider' ? '#d1596d' : '#7ad15a');
  }
}

/** Your companion shepherd dog: trots beside you with a wagging tail & red collar. */
export function drawDog(ctx, x, y, facing = 1, t = 0) {
  x = Math.round(x);
  y = Math.round(y);
  const f = facing >= 0 ? 1 : -1;
  const bob = Math.floor(t * 7) % 2;
  const wag = Math.floor(t * 10) % 2;

  ctx.fillStyle = 'rgba(20, 16, 30, 0.3)';
  ctx.fillRect(x - 4, y, 8, 2);

  // Trotting legs
  px(ctx, INK, x - 3, y - 2 - (bob ? 0 : 1), 2, 3);
  px(ctx, '#7c4c2c', x - 3, y - 2 - (bob ? 0 : 1), 1, 2);
  px(ctx, INK, x + 2, y - 2 - bob, 2, 3);
  px(ctx, '#a87a45', x + 2, y - 2 - bob, 1, 2);

  // Body + sunlit back
  px(ctx, INK, x - 4, y - 6 - bob, 8, 5);
  px(ctx, '#a87a45', x - 3, y - 5 - bob, 6, 3);
  px(ctx, '#cf9b5e', x - 3, y - 5 - bob, 4, 1);

  // Red collar
  px(ctx, '#d1596d', x + f * 2, y - 6 - bob, 1, 3);

  // Head, muzzle & pointed ear
  const hx = x + f * 3;
  px(ctx, INK, hx - 2, y - 9 - bob, 5, 4);
  px(ctx, '#a87a45', hx - 1, y - 8 - bob, 3, 2);
  px(ctx, '#cf9b5e', hx - 1, y - 8 - bob, 2, 1);
  px(ctx, INK, hx - f, y - 10 - bob, 2, 2); // ear
  px(ctx, INK, hx + f * 2, y - 8 - bob, 1, 1); // nose

  // Wagging tail
  px(ctx, INK, x - f * 5, y - 6 - bob - wag, 2, 2);
  px(ctx, '#cf9b5e', x - f * 5, y - 6 - bob - wag, 1, 1);
}
