// structures.js
// Drawn art for the things you build, the villages and the raider camps.
//
// There are no building sprites in the asset set, so these are drawn in the
// tiles' own idiom: a dark outline, light from the top left, whole pixels. Each
// structure gets its own silhouette so you can read a base at a glance — the
// hearth's fire, the hut's roof, the tower's height, the wall's run of stakes.

const INK = '#1b1420';

const px = (ctx, c, x, y, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); };

/** An outlined box: ink first, then the fill one pixel in. */
function box(ctx, x, y, w, h, fill, lit) {
  px(ctx, INK, x - 1, y - 1, w + 2, h + 2);
  px(ctx, fill, x, y, w, h);
  if (lit) px(ctx, lit, x, y, Math.max(1, Math.floor(w / 3)), h);
}

function shadow(ctx, x, y, rx = 7, ry = 3) {
  ctx.fillStyle = 'rgba(20, 16, 30, 0.30)';
  ctx.beginPath();
  ctx.ellipse(x, y + 1, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function roof(ctx, cx, apexY, half, fill, lit) {
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(cx, apexY - 1);
  ctx.lineTo(cx + half + 1, apexY + half);
  ctx.lineTo(cx - half - 1, apexY + half);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(cx, apexY + 1);
  ctx.lineTo(cx + half - 1, apexY + half);
  ctx.lineTo(cx - half + 1, apexY + half);
  ctx.closePath();
  ctx.fill();
  if (lit) {
    ctx.fillStyle = lit;
    ctx.beginPath();
    ctx.moveTo(cx, apexY + 1);
    ctx.lineTo(cx - half + 1, apexY + half);
    ctx.lineTo(cx - 1, apexY + half);
    ctx.closePath();
    ctx.fill();
  }
}

function flame(ctx, x, y, t, big = 1) {
  const f = Math.floor(t * 8) % 3;
  px(ctx, '#d94f2b', x - 1, y - 2 - f % 2, 3 * big, 3 + (f === 1 ? 1 : 0));
  px(ctx, '#f7a53b', x, y - 3 - (f === 2 ? 1 : 0), 1 * big + (big > 1 ? 1 : 0), 3);
  px(ctx, '#fff1a8', x, y - 1, 1, 1);
}

const DRAW = {
  hearth(ctx, x, y, t) {
    shadow(ctx, x, y, 6, 3);
    // a ring of stones round a fire
    for (const [dx, dy] of [[-5, 0], [-3, 2], [0, 3], [3, 2], [5, 0], [3, -2], [-3, -2]]) {
      px(ctx, INK, x + dx - 1, y + dy - 1, 3, 3);
      px(ctx, '#9a9086', x + dx, y + dy, 1, 1);
    }
    px(ctx, '#5c4426', x - 2, y, 5, 1);
    flame(ctx, x, y, t, 2);
  },
  hut(ctx, x, y) {
    shadow(ctx, x, y + 1, 9, 3);
    box(ctx, x - 7, y - 7, 14, 8, '#8a6236', '#a87a45');
    px(ctx, '#6d4b2a', x - 7, y - 4, 14, 1);
    px(ctx, INK, x - 1, y - 4, 3, 5);
    px(ctx, '#f7c86b', x + 3, y - 5, 2, 2);
    roof(ctx, x, y - 16, 9, '#c9a24a', '#e2c26b');
    px(ctx, '#8d6b2c', x - 5, y - 9, 10, 1);
  },
  workbench(ctx, x, y) {
    shadow(ctx, x, y, 7, 2);
    box(ctx, x - 6, y - 5, 12, 2, '#a87a45', '#c9955a');
    px(ctx, INK, x - 6, y - 3, 2, 4); px(ctx, '#6d4b2a', x - 5, y - 3, 1, 3);
    px(ctx, INK, x + 4, y - 3, 2, 4); px(ctx, '#6d4b2a', x + 5, y - 3, 1, 3);
    px(ctx, '#c7cfd8', x - 3, y - 7, 6, 1);
    px(ctx, INK, x + 3, y - 8, 2, 2);
  },
  palisade(ctx, x, y) {
    shadow(ctx, x, y, 9, 3);
    for (let i = -4; i <= 4; i++) {
      const sx = x + i * 2 - 1;
      const top = y - 9 + ((i * 7) & 1);
      px(ctx, INK, sx, top, 2, y - top + 1);
      px(ctx, i % 2 ? '#8a6236' : '#a87a45', sx, top + 1, 1, y - top - 1);
    }
    px(ctx, '#5c4426', x - 9, y - 5, 18, 1);
  },
  stone_wall(ctx, x, y) {
    shadow(ctx, x, y, 9, 3);
    box(ctx, x - 9, y - 7, 18, 7, '#8b8378', null);
    for (let row = 0; row < 3; row++) {
      for (let i = 0; i < 4; i++) {
        const bx = x - 9 + i * 5 + (row % 2 ? 2 : 0);
        px(ctx, '#a8a093', bx, y - 7 + row * 2 + 1, 3, 1);
      }
    }
    px(ctx, '#bdb5a7', x - 9, y - 7, 18, 1);
  },
  watchtower(ctx, x, y) {
    shadow(ctx, x, y, 6, 3);
    // legs
    for (const dx of [-5, 4]) { px(ctx, INK, x + dx - 1, y - 14, 3, 15); px(ctx, '#8a6236', x + dx, y - 13, 1, 13); }
    px(ctx, '#6d4b2a', x - 4, y - 8, 8, 1); px(ctx, '#6d4b2a', x - 4, y - 4, 8, 1);
    // platform and roof
    box(ctx, x - 7, y - 20, 14, 5, '#a87a45', '#c9955a');
    px(ctx, INK, x - 3, y - 19, 2, 2); px(ctx, INK, x + 2, y - 19, 2, 2);
    roof(ctx, x, y - 28, 8, '#b13e53', '#d1596d');
  },
  forge(ctx, x, y, t) {
    shadow(ctx, x, y, 8, 3);
    box(ctx, x - 7, y - 8, 14, 9, '#7d7469', '#9a9086');
    px(ctx, INK, x - 3, y - 5, 6, 5);
    flame(ctx, x, y - 1, t, 2);
    box(ctx, x + 3, y - 15, 3, 7, '#5f574e', null);
    const puff = Math.floor(t * 2) % 3;
    px(ctx, 'rgba(200,200,210,0.5)', x + 3 + puff, y - 18 - puff, 2, 2);
  },
  shrine(ctx, x, y, t) {
    shadow(ctx, x, y, 7, 3);
    box(ctx, x - 6, y - 3, 12, 3, '#8b8378', '#a8a093');
    box(ctx, x - 2, y - 14, 4, 11, '#9d97ab', '#c3bfd1');
    const glow = 0.5 + 0.5 * Math.sin(t * 3);
    px(ctx, `rgba(115, 239, 247, ${0.5 + glow * 0.5})`, x - 1, y - 11, 2, 3);
    px(ctx, '#ffcd75', x - 1, y - 16, 2, 2);
  },
  ladder(ctx, x, y) {
    px(ctx, INK, x - 4, y - 16, 2, 17); px(ctx, INK, x + 2, y - 16, 2, 17);
    px(ctx, '#a87a45', x - 4, y - 15, 1, 15); px(ctx, '#a87a45', x + 2, y - 15, 1, 15);
    for (let i = 0; i < 5; i++) px(ctx, '#c9955a', x - 3, y - 14 + i * 3, 5, 1);
  },
};

/** Draw a structure standing on the top face centred at (x, y). */
export function drawStructure(ctx, x, y, item, t = 0, feature = null) {
  (DRAW[item] || DRAW.hearth)(ctx, x, y, t);
  if (feature && feature.maxHp && feature.hp < feature.maxHp) hpBar(ctx, x, y - 22, feature.hp / feature.maxHp, '#d9b45b');
}

export function hpBar(ctx, x, y, frac, color = '#7ad15a') {
  const w = 12;
  px(ctx, INK, x - w / 2 - 1, y - 1, w + 2, 3);
  px(ctx, '#3a1c22', x - w / 2, y, w, 1);
  px(ctx, color, x - w / 2, y, Math.max(1, Math.round(w * Math.max(0, frac))), 1);
}

const KIND_COLORS = {
  farmers: '#e2c26b', woodcutters: '#38b764', masons: '#94b0c2',
  fishers: '#41a6f6', herbalists: '#a7f070', smiths: '#ef7d57',
};

/** A village: a cluster of huts, a banner in the colour of its trade. */
export function drawVillage(ctx, x, y, t = 0, kind = 'farmers', status = {}) {
  shadow(ctx, x, y + 2, 13, 4);
  DRAW.hut(ctx, x - 7, y - 1);
  DRAW.hut(ctx, x + 7, y);
  // banner
  px(ctx, INK, x - 1, y - 20, 2, 18);
  px(ctx, '#6d4b2a', x, y - 19, 1, 16);
  const wave = Math.floor(t * 3) % 2;
  px(ctx, INK, x + 1, y - 20, 7, 6);
  px(ctx, KIND_COLORS[kind] || '#e2c26b', x + 1, y - 19, 6 - wave, 4);
  if (status.raided) {
    flame(ctx, x - 7, y - 10, t);
    flame(ctx, x + 8, y - 9, t + 0.3);
  }
}

/** A raider camp: hide tents, a fire, a war banner. Burned, it is ash and stakes. */
export function drawCamp(ctx, x, y, t = 0, feature = {}) {
  if (feature.burned) {
    shadow(ctx, x, y, 10, 3);
    px(ctx, '#3a3530', x - 8, y - 2, 16, 3);
    px(ctx, '#5a5048', x - 5, y - 3, 3, 1); px(ctx, '#5a5048', x + 3, y - 3, 4, 1);
    px(ctx, INK, x - 6, y - 7, 1, 5); px(ctx, INK, x + 5, y - 6, 1, 4);
    if (Math.floor(t * 1.5) % 2) px(ctx, 'rgba(180,180,180,0.4)', x, y - 9, 1, 2);
    return;
  }
  shadow(ctx, x, y + 1, 12, 4);
  const tent = (tx, ty, fill, lit) => {
    roof(ctx, tx, ty - 10, 6, fill, lit);
    px(ctx, INK, tx - 1, ty - 4, 2, 4);
  };
  tent(x - 6, y - 1, '#6b4a3a', '#8c6650');
  tent(x + 6, y, '#5d3f31', '#7d5a46');
  flame(ctx, x, y + 2, t);
  // war banner, bigger at the Warlord's hold
  const h = feature.boss ? 26 : 20;
  px(ctx, INK, x - 1, y - h, 2, h - 2);
  px(ctx, '#3a2a20', x, y - h + 1, 1, h - 4);
  px(ctx, INK, x + 1, y - h, 8, 7);
  px(ctx, '#b13e53', x + 1, y - h + 1, 7, 5);
  px(ctx, '#f4f4f4', x + 3, y - h + 2, 3, 2);
  px(ctx, INK, x + 4, y - h + 3, 1, 1);
  if (feature.boss) { px(ctx, '#ffcd75', x - 2, y - h - 2, 4, 2); }
}

/** A bridge deck over one water hex. */
export function drawBridgeDeck(ctx, img, frame, x, y) {
  if (!img) {
    px(ctx, INK, x + 6, y + 20, 20, 10);
    px(ctx, '#a87a45', x + 7, y + 21, 18, 8);
    return;
  }
  ctx.drawImage(img, frame * 32, 0, 32, 48, x, y, 32, 48);
}
