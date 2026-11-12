// units.js
// Drawing the people who are not you: raiders, their brutes and warlord,
// militia, villagers, and your dog. Same placeholder idiom as the player pawn —
// a shadow, an outlined cloak, a head — with silhouettes that read at a glance:
// horns mean trouble.

import { tileCenter } from '../world/hexgrid.js';
import { hpBar } from './structures.js';

const INK = '#1b1420';
const ease = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

/** Screen position of a unit mid-stride, the same way the player's is worked out. */
export function unitPos(map, u) {
  if (!u.leg) {
    const { cx, cy } = tileCenter(u.q, u.r, Math.max(0, map.heightAt(u.q, u.r)));
    return { x: cx, y: cy };
  }
  const { from, to, t } = u.leg;
  const a = tileCenter(from.q, from.r, Math.max(0, map.heightAt(from.q, from.r)));
  const b = tileCenter(to.q, to.r, Math.max(0, map.heightAt(to.q, to.r)));
  const e = ease(Math.min(1, t));
  const hop = Math.sin(Math.min(1, t) * Math.PI) * 2;
  return { x: a.cx + (b.cx - a.cx) * e, y: a.cy + (b.cy - a.cy) * e - hop };
}

const LOOK = {
  raider:  { cloak: '#5a2a2a', lit: 'rgba(160,70,60,0.35)', skin: '#d8b08c', horns: true, size: 1 },
  brute:   { cloak: '#3e2620', lit: 'rgba(150,80,60,0.3)', skin: '#c99c78', horns: true, size: 1.25 },
  warlord: { cloak: '#1f1418', lit: 'rgba(200,60,60,0.35)', skin: '#c99c78', horns: true, crown: true, size: 1.4 },
  militia: { cloak: '#2f5d8a', lit: 'rgba(110,170,230,0.35)', skin: '#e8c9a0', helm: true, size: 1 },
  villager:{ cloak: '#4f7a3a', lit: 'rgba(160,220,120,0.3)', skin: '#e8c9a0', size: 0.9 },
};

export function drawFigure(ctx, x, y, kind, facing = 1, t = 0, flash = 0) {
  const L = LOOK[kind] || LOOK.raider;
  const s = L.size;
  const w = Math.round(5 * s), h = Math.round(8 * s), hr = 3.2 * Math.min(1.2, s);

  ctx.fillStyle = 'rgba(20, 16, 30, 0.32)';
  ctx.beginPath();
  ctx.ellipse(x, y + 1, w, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(x - w, y + 1); ctx.lineTo(x - 3, y - h); ctx.lineTo(x + 3, y - h); ctx.lineTo(x + w, y + 1);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = flash > 0 ? '#ffffff' : L.cloak;
  ctx.beginPath();
  ctx.moveTo(x - w + 1, y); ctx.lineTo(x - 2, y - h + 1); ctx.lineTo(x + 2, y - h + 1); ctx.lineTo(x + w - 1, y);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = L.lit;
  ctx.fillRect(x - 3, y - h + 2, 2, h - 2);

  const hy = y - h - 2;
  ctx.fillStyle = INK;
  ctx.beginPath(); ctx.arc(x, hy, hr + 1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = L.skin;
  ctx.beginPath(); ctx.arc(x, hy, hr, 0, Math.PI * 2); ctx.fill();

  if (L.horns) {
    ctx.fillStyle = '#f0e6d2';
    ctx.fillRect(x - 4, hy - 4, 1, 2); ctx.fillRect(x - 5, hy - 5, 1, 1);
    ctx.fillRect(x + 3, hy - 4, 1, 2); ctx.fillRect(x + 4, hy - 5, 1, 1);
    ctx.fillStyle = '#4a4553';
    ctx.fillRect(x - 3, hy - 3, 6, 2);
  }
  if (L.crown) {
    ctx.fillStyle = '#ffcd75';
    ctx.fillRect(x - 2, hy - 6, 1, 2); ctx.fillRect(x, hy - 7, 1, 3); ctx.fillRect(x + 2, hy - 6, 1, 2);
  }
  if (L.helm) {
    ctx.fillStyle = '#94b0c2';
    ctx.fillRect(x - 3, hy - 3, 6, 2);
    ctx.fillStyle = '#c7d4df';
    ctx.fillRect(x - 3, hy - 3, 2, 1);
  }
  ctx.fillStyle = INK;
  ctx.fillRect(x + (facing > 0 ? 0 : -1), hy - 1, 1, 1);

  // A weapon on the leading side.
  ctx.fillStyle = '#94b0c2';
  const wx = x + facing * (w + 1);
  ctx.fillRect(wx, y - h, 1, h - 1);
  if (kind === 'brute' || kind === 'warlord') ctx.fillRect(wx - 1, y - h - 1, 3, 2);
}

export function drawUnit(ctx, map, u, now) {
  const { x, y } = unitPos(map, u);
  const flash = u.hitAt && now - u.hitAt < 140 ? 1 : 0;
  drawFigure(ctx, Math.round(x), Math.round(y), u.kind, u.facing || 1, now / 1000, flash);
  if (u.hp < u.maxHp) hpBar(ctx, Math.round(x), Math.round(y) - 20 * (u.kind === 'warlord' ? 1.2 : 1), u.hp / u.maxHp, u.faction === 'raider' ? '#d1596d' : '#7ad15a');
}

/** Your dog: trots a step behind you. */
export function drawDog(ctx, x, y, facing = 1, t = 0) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = 'rgba(20, 16, 30, 0.3)';
  ctx.beginPath(); ctx.ellipse(x, y + 1, 4, 1.5, 0, 0, Math.PI * 2); ctx.fill();
  const bob = Math.floor(t * 6) % 2;
  ctx.fillStyle = INK;
  ctx.fillRect(x - 4, y - 5 - bob, 8, 4);
  ctx.fillRect(x + facing * 3 - 1, y - 8 - bob, 4, 4);
  ctx.fillStyle = '#a87a45';
  ctx.fillRect(x - 3, y - 4 - bob, 6, 2);
  ctx.fillRect(x + facing * 3, y - 7 - bob, 2, 2);
  ctx.fillStyle = INK;
  ctx.fillRect(x - 3, y - 2, 1, 2); ctx.fillRect(x + 2, y - 2, 1, 2);
  ctx.fillRect(x - facing * 5, y - 6 - bob, 1, 2);
}
