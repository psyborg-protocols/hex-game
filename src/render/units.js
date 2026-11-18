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

/** Screen position of the companion dog: linear interpolation across legs (no per-hex hop/pause) plus sub-hex offset. */
export function dogPos(map, dog) {
  if (!dog.leg) {
    const { cx, cy } = tileCenter(dog.q, dog.r, Math.max(0, map.surfaceAt(dog.q, dog.r)));
    return { x: cx + (dog.ox || 0), y: cy + (dog.oy || 0) };
  }
  const { from, to, t } = dog.leg;
  const ah = Math.max(0, map.surfaceAt(from.q, from.r));
  const bh = Math.max(0, map.surfaceAt(to.q, to.r));
  const a = tileCenter(from.q, from.r, ah);
  const b = tileCenter(to.q, to.r, bh);
  const k = Math.min(1, Math.max(0, t));
  const climb = Math.abs(bh - ah) >= 2 ? Math.sin(k * Math.PI) * 1.5 : 0;
  return {
    x: a.cx + (b.cx - a.cx) * k + (dog.ox || 0),
    y: a.cy + (b.cy - a.cy) * k - climb + (dog.oy || 0),
  };
}

/**
 * Your companion shepherd dog: painterly pixel art matching the rabbit's
 * soft-shaded silhouette, with trotting, standing, sitting, tail-wagging,
 * and lunging poses.
 */
export function drawDog(ctx, x, y, opts = 1, legacyT = 0) {
  const o = typeof opts === 'object' && opts !== null
    ? opts
    : { facing: opts, t: legacyT, moving: true, legT: legacyT * 1.4 };
  const f = (o.facing ?? 1) >= 0 ? 1 : -1;
  const t = o.t ?? 0;
  const stance = o.stance || (o.moving ? 'move' : 'idle');
  const moving = !!o.moving;
  const legT = o.legT ?? 0;
  const wag = !!o.wag;
  const attacking = !!o.attacking;
  const selected = !!o.selected;

  x = Math.round(x);
  y = Math.round(y);

  if (selected) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 244, 196, 0.92)';
    ctx.fillStyle = 'rgba(255, 244, 196, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y, 6, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  const lunge = attacking ? 2 : 0;
  const bob = moving ? (Math.abs(Math.cos(legT * Math.PI * 2)) > 0.65 ? 1 : 0) : 0;
  const dyBase = y - bob;

  const dot = (c, dx, dy, w = 1, h = 1) => {
    const pxX = f > 0 ? x + dx + lunge : x - dx - lunge - (w - 1);
    px(ctx, c, pxX, dyBase + dy, w, h);
  };

  // Soft ground shadow
  ctx.fillStyle = 'rgba(33, 24, 27, 0.24)';
  ctx.fillRect(x - 4 + (f * lunge), y, stance === 'sit' ? 8 : 9, 1);

  const wagShift = wag ? (Math.floor(t * 10) % 2) : 0;

  if (stance === 'sit') {
    // Tail resting low behind haunches, lifting to wag
    dot('#4a2e1b', -4, -2 - wagShift, 2, 1);
    dot('#c88d4e', -5, -2 - wagShift * 2, 1, 1);

    // Seated haunches & tucked hind paw
    dot('#7c4b27', -3, -4, 3, 3);
    dot('#9e6538', -2, -4, 2, 2);
    dot('#e0ae6e', -1, -1, 2, 1);
    dot('#f0cfa0', 0, -1, 1, 1);

    // Upright chest, dark saddle & straight front legs
    dot('#4a2e1b', -2, -5, 2, 1);
    dot('#9e6538', -1, -6, 3, 3);
    dot('#c88d4e', 0, -6, 2, 3);
    dot('#e0ae6e', 1, -5, 1, 4);
    dot('#c88d4e', 0, -3, 1, 2);
    dot('#f0cfa0', 1, -1, 1, 1);

    // Red collar + brass tag
    dot('#c94356', 0, -6, 2, 1);
    dot('#eb6c7d', 1, -6, 1, 1);
    dot('#f2cc68', 2, -5, 1, 1);

    // Alert head, muzzle & pointed shepherd ears
    dot('#4a2e1b', 0, -10, 1, 2);
    dot('#7c4b27', 1, -10, 1, 1);
    dot('#9e6538', 0, -9, 3, 3);
    dot('#c88d4e', 1, -9, 2, 2);
    dot('#e0ae6e', 3, -8, 2, 2);
    dot('#2c1b12', 4, -8, 1, 1); // nose
    dot('#2c1b12', 2, -8, 1, 1); // eye
    return;
  }

  // Standing, trotting, pacing, or lunging
  const stride = moving ? Math.sin(legT * Math.PI * 2) : 0;
  const backStep = stride > 0.25 ? -1 : stride < -0.25 ? 1 : 0;
  const frontStep = -backStep;
  const breathe = !moving && !attacking && Math.sin(t * 2.5 + x) > 0.5 ? 1 : 0;

  // Far-side legs (darker)
  dot('#4a2e1b', -3 - backStep, -2, 1, 2);
  dot('#4a2e1b', 1 - frontStep, -2, 1, 2);

  // Bushy tail (wags when happy/idle)
  dot('#4a2e1b', -5, -5 - wagShift, 2, 1);
  dot('#9e6538', -6, -6 - wagShift, 2, 1);
  dot('#f0cfa0', -6, -6 - wagShift, 1, 1);

  // Body & shepherd saddle
  dot('#4a2e1b', -4, -6 + breathe, 5, 1);
  dot('#7c4b27', -4, -5 + breathe, 6, 2);
  dot('#9e6538', -3, -5 + breathe, 5, 2);
  dot('#c88d4e', -2, -4 + breathe, 4, 1);
  dot('#e0ae6e', 1, -4 + breathe, 2, 2);

  // Near-side legs & pale paws
  dot('#9e6538', -3 + backStep, -3, 1, 2);
  dot('#f0cfa0', -3 + backStep, -1, 1, 1);
  dot('#c88d4e', 1 + frontStep, -3, 1, 2);
  dot('#f0cfa0', 1 + frontStep, -1, 1, 1);

  // Red collar + brass tag
  dot('#c94356', 1, -6 + breathe, 2, 2);
  dot('#eb6c7d', 2, -6 + breathe, 1, 1);
  dot('#f2cc68', 2, -4 + breathe, 1, 1);

  // Head, muzzle, nose, eye & pointed ears
  const headDrop = attacking ? 1 : 0;
  dot('#4a2e1b', 1, -10 + breathe + headDrop, 1, 2);
  dot('#7c4b27', 2, -10 + breathe + headDrop, 1, 1);
  dot('#9e6538', 1, -9 + breathe + headDrop, 3, 3);
  dot('#c88d4e', 2, -9 + breathe + headDrop, 2, 2);
  dot('#e0ae6e', 4, -8 + breathe + headDrop, 2, 2);
  dot('#2c1b12', 5, -8 + breathe + headDrop, 1, 1); // nose
  dot('#2c1b12', 3, -8 + breathe + headDrop, 1, 1); // eye
}
