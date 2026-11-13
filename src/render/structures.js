// structures.js
// Handcrafted 2.5D pixel-art architecture for homestead buildings, villages,
// raider camps, river crossings, cliff ladders, and timber bridges.
//
// Drawn at native 1x resolution using integer pixel plotting so every sprite
// shares the dark outline (#1b1420), top-left key lighting, and crisp binary
// edges of the new_tiles/ and decor/ artwork through the integer upscale.

const INK = '#1b1420';

const px = (ctx, c, x, y, w = 1, h = 1) => {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

/** Crisp 1px integer Bresenham line — zero anti-aliasing. */
function linePx(ctx, c, x0, y0, x1, y1) {
  x0 = Math.round(x0); y0 = Math.round(y0);
  x1 = Math.round(x1); y1 = Math.round(y1);
  ctx.fillStyle = c;
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  const dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    ctx.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

/** Stamp an ASCII pixel sprite anchored at (x, y) using a color lookup map. */
function stamp(ctx, x, y, rows, map) {
  const bx = Math.round(x), by = Math.round(y);
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j];
    for (let i = 0; i < row.length; i++) {
      const c = map[row[i]];
      if (c) {
        ctx.fillStyle = c;
        ctx.fillRect(bx + i, by + j, 1, 1);
      }
    }
  }
}

/** An outlined box with optional top-left lit face and right shade band. */
function box(ctx, x, y, w, h, fill, lit = null, shade = null) {
  px(ctx, INK, x - 1, y - 1, w + 2, h + 2);
  px(ctx, fill, x, y, w, h);
  if (lit) px(ctx, lit, x, y, Math.max(1, Math.floor(w * 0.4)), h);
  if (shade) px(ctx, shade, x + w - Math.max(1, Math.floor(w * 0.28)), y, Math.max(1, Math.floor(w * 0.28)), h);
}

/** Crisp pixel ground contact shadow. */
function shadow(ctx, x, y, rx = 7, ry = 3) {
  ctx.fillStyle = 'rgba(20, 16, 30, 0.30)';
  for (let dy = -ry; dy <= ry; dy++) {
    const k = dy / Math.max(1, ry);
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - k * k)));
    if (hw > 0) ctx.fillRect(Math.round(x - hw), Math.round(y + dy), hw * 2, 1);
  }
}

/**
 * Stepped pixel-art gable or conical roof (no anti-aliased triangle edges).
 * Draws a crisp 1px ink outline, sunlit left slope, mid body, shaded right
 * slope, and optional horizontal shingle/thatch texture rows.
 */
function pixelRoof(ctx, cx, apexY, halfW, height, pal, texture = true) {
  const ax = Math.round(cx), ay = Math.round(apexY);
  for (let r = 0; r <= height; r++) {
    const t = r / Math.max(1, height);
    // Slight bell-curve flare near the eaves for an organic cottage silhouette
    const hw = Math.max(1, Math.round(t * halfW + (t > 0.65 ? 1 : 0)));
    const y = ay + r;
    // Ink outline
    px(ctx, INK, ax - hw - 1, y, hw * 2 + 2, 1);
    if (r === 0) continue;
    // Left lit slope & right shaded slope
    const mid = Math.max(1, Math.round(hw * 0.15));
    px(ctx, pal.lit, ax - hw, y, hw, 1);
    px(ctx, pal.mid, ax, y, Math.max(1, hw - mid), 1);
    px(ctx, pal.shade, ax + Math.max(1, Math.floor(hw * 0.45)), y, Math.ceil(hw * 0.55), 1);
    if (texture && r % 3 === 0 && r < height - 1) {
      px(ctx, pal.shade, ax - hw + 1, y, hw * 2 - 2, 1);
      px(ctx, pal.mid, ax - hw + 1, y, Math.max(1, Math.floor(hw * 0.7)), 1);
    }
  }
  // Eaves bottom ink rim & warm highlight ridge
  const yBot = ay + height + 1;
  px(ctx, INK, ax - halfW - 1, yBot, halfW * 2 + 2, 1);
  if (pal.ridge) px(ctx, pal.ridge, ax - 1, ay + 1, 2, Math.max(1, Math.floor(height * 0.5)));
}

// Curated material palettes harmonized with new_tiles/
const PAL = {
  thatch:  { lit: '#e5c165', mid: '#c4963e', shade: '#8d6526', ridge: '#f3d884' },
  mossRoof:{ lit: '#8db85a', mid: '#638a3b', shade: '#436027', ridge: '#a8cf74' },
  slate:   { lit: '#94acc2', mid: '#687f96', shade: '#46576b', ridge: '#b8cde0' },
  shingle: { lit: '#d46373', mid: '#a83c4e', shade: '#742534', ridge: '#ea8b97' },
  reedRoof:{ lit: '#c8b47c', mid: '#9c8956', shade: '#6f5f38', ridge: '#e2d29d' },
  hide:    { lit: '#9c7156', mid: '#78503c', shade: '#523426', ridge: '#b88b6d' },
  hideDark:{ lit: '#855c46', mid: '#634131', shade: '#42291e', ridge: '#9e7258' },
  plaster: { lit: '#dfd2bc', mid: '#c2b198', shade: '#96846d' },
  timber:  { lit: '#be8550', mid: '#8e5a32', shade: '#5e381d', dark: '#3e2312' },
  stone:   { lit: '#b8b3c4', mid: '#8b8698', shade: '#615d6d', dark: '#423f4d' },
};

/** Animated multi-tone pixel campfire with rising spark ember. */
function flame(ctx, x, y, t, big = 1) {
  const f = Math.floor(t * 7) % 4;
  const flicker = (f === 1 || f === 3) ? 1 : 0;
  if (big > 1) {
    px(ctx, '#9e2b1c', x - 3, y - 3 - flicker, 6, 4);
    px(ctx, '#e05328', x - 2, y - 4 - (f % 2), 4, 4);
    px(ctx, '#f7a53b', x - 1, y - 3 - ((f + 1) % 2), 2, 3);
    px(ctx, '#fff3b0', x, y - 2, 1, 2);
    // Rising spark
    const sy = Math.floor(t * 5) % 6;
    if (sy < 4) px(ctx, sy < 2 ? '#fff1a8' : '#f7a53b', x + ((f % 2) ? 1 : -1), y - 6 - sy, 1, 1);
  } else {
    px(ctx, '#d94f2b', x - 1, y - 2 - (f % 2), 3, 3 + flicker);
    px(ctx, '#f7a53b', x, y - 3 - ((f + 1) % 2), 1, 3);
    px(ctx, '#fff1a8', x, y - 1, 1, 1);
  }
}

/** Gentle chimney smoke puffs drifting up-right. */
function smoke(ctx, x, y, t, dark = false) {
  for (let i = 0; i < 2; i++) {
    const phase = ((t * 0.9 + i * 0.5) % 1);
    const sx = Math.round(x + phase * 4);
    const sy = Math.round(y - phase * 7);
    const a = (1 - phase) * (dark ? 0.55 : 0.45);
    ctx.fillStyle = dark ? `rgba(60, 56, 68, ${a})` : `rgba(225, 228, 238, ${a})`;
    ctx.fillRect(sx, sy, phase < 0.5 ? 2 : 1, phase < 0.5 ? 2 : 1);
  }
}

/** Animated pennant flag on a timber pole. */
function banner(ctx, x, y, h, color, litColor, t, war = false) {
  // Pole & finial
  px(ctx, INK, x - 1, y - h, 2, h);
  px(ctx, PAL.timber.mid, x, y - h + 1, 1, h - 2);
  px(ctx, war ? '#ffcd75' : '#e2c26b', x - 1, y - h - 1, 2, 1);
  const w = Math.floor(t * 3.5) % 2;
  const fh = war ? 6 : 5;
  const fw = war ? 8 : 7;
  // Forked swallowtail flag
  px(ctx, INK, x + 1, y - h + 1, fw, fh);
  px(ctx, color, x + 1, y - h + 2, fw - 1 - w, fh - 2);
  if (litColor) px(ctx, litColor, x + 1, y - h + 2, fw - 2 - w, 1);
  // Swallowtail notch
  px(ctx, INK, x + fw - 1 - w, y - h + 3, 1, 1);
  if (war) {
    // Skull emblem on war banner
    px(ctx, '#f4efe6', x + 2, y - h + 3, 3, 2);
    px(ctx, INK, x + 3, y - h + 4, 1, 1);
  }
}

/** Warm cottage hut helper shared by homestead hut & village variants. */
function drawCottage(ctx, x, y, t = 0, opts = {}) {
  const {
    roofPal = PAL.thatch,
    wallPal = PAL.plaster,
    w = 14,
    h = 8,
    roofH = 8,
    chimney = true,
    windowGlow = true,
    woodpile = false,
    timberFrame = true,
  } = opts;

  const half = Math.floor(w / 2);
  shadow(ctx, x, y + 1, half + 3, 3);

  // Cobblestone doorstep
  px(ctx, INK, x - 3, y + 1, 6, 2);
  px(ctx, PAL.stone.mid, x - 2, y + 1, 4, 1);
  px(ctx, PAL.stone.lit, x - 2, y + 1, 2, 1);

  // Main walls
  box(ctx, x - half, y - h, w, h, wallPal.mid, wallPal.lit, wallPal.shade);

  if (timberFrame) {
    // Corner oak posts and middle beam
    px(ctx, PAL.timber.dark, x - half, y - h, 1, h);
    px(ctx, PAL.timber.dark, x + half - 1, y - h, 1, h);
    px(ctx, PAL.timber.shade, x - half, y - Math.floor(h / 2) - 1, w, 1);
    px(ctx, PAL.timber.dark, x - half, y - 1, w, 1);
  }

  // Plank door with brass handle
  px(ctx, INK, x - 2, y - 5, 4, 6);
  px(ctx, PAL.timber.shade, x - 1, y - 4, 2, 4);
  px(ctx, PAL.timber.mid, x - 1, y - 4, 1, 4);
  px(ctx, '#f7c86b', x, y - 2, 1, 1);

  // Warm paned window
  if (windowGlow) {
    const glow = 0.8 + 0.2 * Math.sin(t * 2.6 + x);
    px(ctx, INK, x + 2, y - 6, 4, 4);
    px(ctx, glow > 0.85 ? '#ffe38a' : '#f5b64c', x + 3, y - 5, 2, 2);
    px(ctx, '#fff6c4', x + 3, y - 5, 1, 1);
  }

  // Optional stacked firewood under left eaves
  if (woodpile) {
    px(ctx, INK, x - half - 3, y - 3, 4, 4);
    px(ctx, PAL.timber.mid, x - half - 2, y - 2, 2, 2);
    px(ctx, PAL.timber.lit, x - half - 2, y - 2, 1, 1);
    px(ctx, PAL.thatch.lit, x - half - 1, y - 1, 1, 1);
  }

  // Chimney behind roof slope
  if (chimney) {
    const cx = x + Math.floor(half * 0.55);
    const cy = y - h - roofH + 2;
    box(ctx, cx, cy, 3, 6, PAL.stone.mid, PAL.stone.lit, PAL.stone.shade);
    px(ctx, INK, cx - 1, cy - 1, 5, 1);
    smoke(ctx, cx + 1, cy - 2, t, false);
  }

  // Eaves drop shadow on wall
  px(ctx, 'rgba(27, 20, 32, 0.35)', x - half, y - h, w, 1);

  // Overhanging stepped roof
  pixelRoof(ctx, x, y - h - roofH, half + 2, roofH, roofPal, true);
  // Crossed timber gable finials at peak
  px(ctx, INK, x - 2, y - h - roofH - 2, 1, 2);
  px(ctx, INK, x + 1, y - h - roofH - 2, 1, 2);
  px(ctx, PAL.timber.lit, x - 1, y - h - roofH - 1, 2, 1);
}

const DRAW = {
  hearth(ctx, x, y, t = 0) {
    shadow(ctx, x, y + 1, 8, 3);
    // Fieldstone fire ring
    const stones = [
      [-6, 0], [-5, 2], [-2, 3], [1, 3], [4, 2], [6, 0],
      [4, -2], [1, -3], [-2, -3], [-5, -2],
    ];
    for (const [dx, dy] of stones) {
      px(ctx, INK, x + dx - 1, y + dy - 1, 3, 3);
      px(ctx, PAL.stone.mid, x + dx, y + dy, 2, 1);
      px(ctx, PAL.stone.lit, x + dx, y + dy, 1, 1);
    }
    // Glowing coal bed & crossed firewood
    px(ctx, '#5e1b18', x - 3, y - 1, 6, 3);
    px(ctx, '#c43e22', x - 2, y, 4, 1);
    px(ctx, PAL.timber.dark, x - 3, y + 1, 6, 1);
    px(ctx, PAL.timber.mid, x - 2, y, 4, 1);
    // Rustic wooden cooking tripod + iron pot
    linePx(ctx, INK, x - 5, y + 1, x, y - 10);
    linePx(ctx, INK, x + 5, y + 1, x, y - 10);
    linePx(ctx, PAL.timber.lit, x - 4, y, x, y - 9);
    px(ctx, INK, x - 2, y - 7, 4, 3);
    px(ctx, '#4f5566', x - 1, y - 6, 2, 2);
    px(ctx, '#8892a8', x - 1, y - 6, 1, 1);
    // Dancing flames
    flame(ctx, x, y + 1, t, 2);
  },

  hut(ctx, x, y, t = 0) {
    drawCottage(ctx, x, y, t, {
      roofPal: PAL.thatch,
      wallPal: PAL.plaster,
      w: 14,
      h: 8,
      roofH: 8,
      chimney: true,
      windowGlow: true,
      woodpile: true,
    });
  },

  workbench(ctx, x, y) {
    shadow(ctx, x, y + 1, 8, 3);
    // Sturdy pegged legs
    px(ctx, INK, x - 7, y - 4, 3, 5);
    px(ctx, PAL.timber.shade, x - 6, y - 4, 1, 4);
    px(ctx, INK, x + 4, y - 4, 3, 5);
    px(ctx, PAL.timber.shade, x + 5, y - 4, 1, 4);
    // Stretcher bar & wood shavings underneath
    px(ctx, INK, x - 5, y - 2, 10, 2);
    px(ctx, PAL.timber.dark, x - 4, y - 2, 8, 1);
    px(ctx, '#e2c26b', x - 2, y + 1, 2, 1);
    px(ctx, '#c9955a', x + 1, y + 1, 1, 1);
    // Heavy split-plank tabletop
    box(ctx, x - 7, y - 7, 14, 3, PAL.timber.mid, PAL.timber.lit, PAL.timber.shade);
    px(ctx, PAL.timber.dark, x - 7, y - 5, 14, 1);
    // Front vice handle on left corner
    px(ctx, INK, x - 8, y - 6, 2, 4);
    px(ctx, PAL.stone.lit, x - 8, y - 5, 1, 2);
    // Hand saw & wooden mallet on top
    px(ctx, INK, x - 4, y - 9, 7, 2);
    px(ctx, '#c7d4df', x - 3, y - 8, 5, 1);
    px(ctx, PAL.timber.lit, x + 2, y - 9, 2, 2);
    px(ctx, INK, x + 4, y - 10, 3, 3);
    px(ctx, PAL.timber.mid, x + 5, y - 9, 1, 1);
  },

  palisade(ctx, x, y) {
    shadow(ctx, x, y + 1, 10, 3);
    // Angled rear support struts
    for (const dx of [-6, 5]) {
      linePx(ctx, INK, x + dx, y - 6, x + dx + (dx < 0 ? -2 : 2), y + 1);
    }
    // Staggered sharpened timber stakes
    for (let i = -4; i <= 4; i++) {
      const sx = x + i * 2 - 1;
      const top = y - 10 - ((i * 5) & 1);
      px(ctx, INK, sx - 1, top, 3, y - top + 2);
      // Sharpened pale timber tip
      px(ctx, '#e5c690', sx, top + 1, 1, 2);
      px(ctx, i % 2 ? PAL.timber.mid : PAL.timber.lit, sx, top + 3, 1, y - top - 2);
    }
    // Lashed horizontal cross-rail
    px(ctx, INK, x - 10, y - 6, 20, 3);
    px(ctx, PAL.timber.shade, x - 9, y - 5, 18, 1);
    px(ctx, '#e2c26b', x - 6, y - 6, 1, 3);
    px(ctx, '#e2c26b', x + 5, y - 6, 1, 3);
  },

  stone_wall(ctx, x, y) {
    shadow(ctx, x, y + 1, 10, 3);
    // Crenellated merlons on top
    for (const mx of [-9, -3, 3, 7]) {
      box(ctx, x + mx, y - 10, 3, 2, PAL.stone.lit, '#d2cfe0', PAL.stone.mid);
    }
    // Ashlar masonry wall body
    box(ctx, x - 9, y - 7, 18, 8, PAL.stone.mid, PAL.stone.lit, PAL.stone.shade);
    // Mortar lines & staggered stone highlights
    for (let row = 0; row < 3; row++) {
      const ry = y - 7 + row * 3;
      if (row > 0) px(ctx, PAL.stone.dark, x - 9, ry - 1, 18, 1);
      for (let i = 0; i < 4; i++) {
        const bx = x - 8 + i * 4 + (row % 2 ? 2 : 0);
        if (bx < x + 8) {
          px(ctx, PAL.stone.dark, bx + 2, ry, 1, 2);
          px(ctx, row === 0 ? '#d2cfe0' : PAL.stone.lit, bx, ry, 2, 1);
        }
      }
    }
    // Moss tufts at base
    px(ctx, '#5f8f3a', x - 7, y, 2, 1);
    px(ctx, '#8db85a', x + 4, y - 1, 2, 1);
  },

  watchtower(ctx, x, y, t = 0) {
    shadow(ctx, x, y + 1, 8, 3);
    // Stone pier footings
    for (const dx of [-5, 3]) {
      box(ctx, x + dx, y - 2, 3, 3, PAL.stone.mid, PAL.stone.lit, PAL.stone.shade);
    }
    // Tapered timber trestle legs
    linePx(ctx, INK, x - 5, y - 2, x - 4, y - 14);
    linePx(ctx, INK, x - 4, y - 2, x - 3, y - 14);
    linePx(ctx, PAL.timber.lit, x - 4, y - 3, x - 3, y - 14);
    linePx(ctx, INK, x + 5, y - 2, x + 4, y - 14);
    linePx(ctx, INK, x + 4, y - 2, x + 3, y - 14);
    linePx(ctx, PAL.timber.mid, x + 4, y - 3, x + 3, y - 14);
    // X-bracing & cross-beams
    linePx(ctx, PAL.timber.shade, x - 3, y - 4, x + 3, y - 12);
    linePx(ctx, PAL.timber.shade, x + 3, y - 4, x - 3, y - 12);
    px(ctx, INK, x - 4, y - 9, 8, 1);
    // Mini access ladder up left side
    for (let ly = y - 13; ly <= y - 2; ly += 2) px(ctx, '#e2c26b', x - 2, ly, 2, 1);

    // Cantilevered lookout gallery & crenellated timber parapet
    box(ctx, x - 7, y - 20, 14, 6, PAL.timber.mid, PAL.timber.lit, PAL.timber.shade);
    px(ctx, INK, x - 7, y - 21, 14, 1);
    // Arrow slits / lookout openings
    px(ctx, INK, x - 4, y - 19, 2, 2);
    px(ctx, INK, x + 2, y - 19, 2, 2);
    // Hanging glowing beacon lantern
    const glow = 0.75 + 0.25 * Math.sin(t * 4.5);
    px(ctx, INK, x + 6, y - 19, 2, 1);
    px(ctx, INK, x + 6, y - 18, 3, 3);
    px(ctx, glow > 0.8 ? '#ffe27a' : '#f59e38', x + 7, y - 17, 1, 1);

    // Crimson shingled roof & spire
    pixelRoof(ctx, x, y - 29, 8, 8, PAL.shingle, true);
    px(ctx, INK, x, y - 32, 1, 3);
    px(ctx, '#ffcd75', x, y - 32, 1, 1);
  },

  forge(ctx, x, y, t = 0) {
    shadow(ctx, x, y + 1, 10, 3);
    // Tall stone chimney behind furnace
    box(ctx, x + 1, y - 18, 5, 11, PAL.stone.mid, PAL.stone.lit, PAL.stone.shade);
    px(ctx, INK, x, y - 19, 7, 1);
    smoke(ctx, x + 3, y - 20, t, true);

    // Stone furnace body
    box(ctx, x - 7, y - 9, 13, 10, PAL.stone.mid, PAL.stone.lit, PAL.stone.shade);
    px(ctx, PAL.stone.dark, x - 7, y - 5, 13, 1);
    // Sloped slate/stone hood
    pixelRoof(ctx, x - 1, y - 14, 7, 5, PAL.slate, false);

    // Glowing arched firebox
    px(ctx, INK, x - 4, y - 5, 6, 6);
    px(ctx, '#6e1d15', x - 3, y - 4, 4, 4);
    flame(ctx, x - 1, y - 1, t, 2);

    // Horned iron anvil on oak stump (left) + quench barrel (right)
    box(ctx, x - 10, y - 2, 3, 3, PAL.timber.mid, PAL.timber.lit, PAL.timber.shade);
    px(ctx, INK, x - 12, y - 5, 7, 3);
    px(ctx, '#6b7588', x - 11, y - 4, 5, 1);
    px(ctx, '#a6b1c7', x - 10, y - 4, 3, 1);
    box(ctx, x + 6, y - 4, 4, 5, PAL.timber.mid, PAL.timber.lit, PAL.timber.shade);
    px(ctx, '#41a6f6', x + 7, y - 4, 2, 1);
  },

  shrine(ctx, x, y, t = 0) {
    shadow(ctx, x, y + 1, 8, 3);
    // Stepped mossy altar dais
    box(ctx, x - 7, y - 2, 14, 3, PAL.stone.shade, PAL.stone.mid, PAL.stone.dark);
    box(ctx, x - 5, y - 5, 10, 3, PAL.stone.mid, PAL.stone.lit, PAL.stone.shade);
    px(ctx, '#638a3b', x - 6, y - 2, 2, 1);
    px(ctx, '#8db85a', x + 4, y - 5, 2, 1);

    // Tapered carved runestone monolith
    px(ctx, INK, x - 4, y - 15, 8, 10);
    px(ctx, INK, x - 3, y - 17, 6, 2);
    px(ctx, INK, x - 2, y - 19, 4, 2);
    px(ctx, PAL.stone.mid, x - 3, y - 15, 6, 9);
    px(ctx, PAL.stone.lit, x - 3, y - 15, 2, 9);
    px(ctx, PAL.stone.mid, x - 2, y - 17, 4, 2);
    px(ctx, PAL.stone.lit, x - 2, y - 17, 2, 2);
    px(ctx, '#d2cfe0', x - 1, y - 18, 2, 1);

    // Pulsing etched cyan rune & gold sun-crest
    const glow = 0.55 + 0.45 * Math.sin(t * 3.2);
    px(ctx, `rgba(115, 239, 247, ${glow})`, x - 1, y - 13, 2, 4);
    px(ctx, `rgba(215, 255, 255, ${glow})`, x, y - 12, 1, 2);
    px(ctx, '#ffcd75', x - 1, y - 20, 2, 2);

    // Orbiting spirit motes
    for (let i = 0; i < 2; i++) {
      const ang = t * 2.2 + i * Math.PI;
      const mx = Math.round(x + Math.cos(ang) * 6);
      const my = Math.round(y - 12 + Math.sin(ang * 1.5) * 3);
      px(ctx, '#a8f9ff', mx, my, 1, 1);
    }
  },
};

// ------------------------------------------------------------------ ladders

/**
 * Where each edge's midpoint sits from the centre of a top face, in EDGE_ORDER
 * (N, NE, SE, S, SW, NW). A ladder leans on the edge it climbs, not on the
 * middle of the hex it stands on.
 */
const EDGE_MID = [[0, -12], [10, -5], [10, 5], [0, 12], [-10, 5], [-10, -5]];

/**
 * Draw a handcrafted wooden ladder leaning against a cliff face.
 *
 * Adapts to the 2.5D cliff orientation:
 * - edge 0 (N): cliff faces south (square-on), twin vertical stiles and flat rungs
 * - edge 1 (NE) / edge 5 (NW): angled 2:1 diagonal cliff face, stiles offset along
 *   the cliff tangent and rungs stepped along the face so it lies flush in 2.5D.
 */
export function drawLadder(ctx, foot, edge, rise) {
  const [ex, ey] = EDGE_MID[edge] || EDGE_MID[0];
  const bx = foot.x + Math.round(ex * 0.72);
  const by = foot.y + Math.round(ey * 0.72);
  const tx = foot.x + ex;
  const ty = foot.y + ey - rise - 3;

  // Base stone pad & shadow
  shadow(ctx, bx, by + 1, 5, 1.5);
  px(ctx, INK, bx - 4, by, 8, 2);
  px(ctx, PAL.stone.mid, bx - 3, by, 6, 1);

  // Tangent offset between left & right stiles in 2.5D (exact 2:1 hex diagonal slope)
  const [lx, ly, rx, ry] = edge === 1
    ? [-3, -1, 3, 1]
    : edge === 5
      ? [-3, 1, 3, -1]
      : [-3, 0, 3, 0];

  const steps = Math.max(4, by - ty);

  // Soft cliff-wall shadow behind the ladder
  for (let i = 0; i <= steps; i++) {
    const k = i / steps;
    const cx = Math.round(bx + (tx - bx) * k);
    const cy = Math.round(by - i);
    ctx.fillStyle = 'rgba(20, 16, 30, 0.34)';
    ctx.fillRect(cx + lx + 1, cy + ly + 1, 2, 1);
    ctx.fillRect(cx + rx + 1, cy + ry + 1, 2, 1);
    if (i > 1 && i < steps - 1 && i % 3 === 1) {
      linePx(ctx, 'rgba(20, 16, 30, 0.28)', cx + lx + 1, cy + ly + 1, cx + rx + 1, cy + ry + 1);
    }
  }

  // Rungs (drawn first so stiles frame them cleanly)
  for (let i = 2; i < steps - 1; i += 3) {
    const k = i / steps;
    const cx = Math.round(bx + (tx - bx) * k);
    const cy = Math.round(by - i);
    linePx(ctx, INK, cx + lx, cy + ly + 1, cx + rx, cy + ry + 1);
    linePx(ctx, PAL.timber.lit, cx + lx, cy + ly, cx + rx, cy + ry);
  }

  // Left & right timber stiles: 1px outer ink outline + 1px inner ink edge, 1px lit timber core
  linePx(ctx, INK, bx + lx - 1, by + ly, tx + lx - 1, ty + ly);
  linePx(ctx, PAL.timber.lit, bx + lx, by + ly, tx + lx, ty + ly);
  linePx(ctx, INK, bx + lx + 1, by + ly, tx + lx + 1, ty + ly);

  linePx(ctx, INK, bx + rx - 1, by + ry, tx + rx - 1, ty + ry);
  linePx(ctx, PAL.timber.mid, bx + rx, by + ry, tx + rx, ty + ry);
  linePx(ctx, INK, bx + rx + 1, by + ry, tx + rx + 1, ty + ry);

  // Hemp rope lashings where rungs meet stiles
  for (let i = 2; i < steps - 1; i += 3) {
    const k = i / steps;
    const cx = Math.round(bx + (tx - bx) * k);
    const cy = Math.round(by - i);
    px(ctx, '#e2c26b', cx + lx, cy + ly, 1, 1);
    px(ctx, '#e2c26b', cx + rx, cy + ry, 1, 1);
  }

  // Top anchor hooks gripping the upper hex rim
  px(ctx, INK, tx + lx - 1, ty + ly - 2, 2, 2);
  px(ctx, PAL.stone.lit, tx + lx, ty + ly - 2, 1, 1);
  px(ctx, INK, tx + rx - 1, ty + ry - 2, 2, 2);
  px(ctx, PAL.stone.lit, tx + rx, ty + ry - 2, 1, 1);
}

/**
 * The top of a ladder showing over the far lip of a cliff whose face is turned
 * away (`top` is the centre of the cliff's top face, `edge` is the side of it
 * the ladder comes up on).
 */
export function drawLadderTop(ctx, top, edge) {
  const [ex, ey] = EDGE_MID[edge] || EDGE_MID[3];
  const x = top.x + ex;
  const y = top.y + ey;
  const [lx, ly, rx, ry] = edge === 2 || edge === 5
    ? [-3, 1, 3, -1]
    : edge === 4 || edge === 1
      ? [-3, -1, 3, 1]
      : [-3, 0, 3, 0];

  // Worn stepping stone marker on cliff lip
  px(ctx, 'rgba(20, 16, 30, 0.25)', x - 4, y - 1, 8, 2);
  // Two rungs cresting the edge
  for (const h of [1, 4]) {
    linePx(ctx, INK, x + lx, y + ly - h + 1, x + rx, y + ry - h + 1);
    linePx(ctx, PAL.timber.lit, x + lx, y + ly - h, x + rx, y + ry - h);
  }
  // Hooked stiles
  for (const [sx, sy, col] of [[lx, ly, PAL.timber.lit], [rx, ry, PAL.timber.mid]]) {
    px(ctx, INK, x + sx - 1, y + sy - 6, 3, 7);
    px(ctx, col, x + sx, y + sy - 5, 1, 5);
    px(ctx, '#e2c26b', x + sx, y + sy - 4, 1, 1);
    px(ctx, '#e2c26b', x + sx, y + sy - 1, 1, 1);
  }
}

// ---------------------------------------------------------------- crossings

/**
 * A raiders' crossing: a lashed timber raft moored on the river under a tattered
 * crimson pennant, readable from across the map.
 */
export function drawCrossing(ctx, x, y, q = 0, r = 0, t = 0) {
  const bob = Math.sin(t * 1.6 + q * 1.3 + r * 0.7) > 0.2 ? 0 : 1;
  y += bob;

  // Water ripple & hull shadow
  const rip = Math.floor(t * 2.5 + q) % 2;
  ctx.fillStyle = 'rgba(18, 22, 54, 0.28)';
  ctx.fillRect(x - 9, y + 3, 18, 2);
  px(ctx, 'rgba(225, 240, 255, 0.45)', x - 10 - rip, y + 3, 2, 1);
  px(ctx, 'rgba(225, 240, 255, 0.45)', x + 8 + rip, y + 2, 2, 1);

  // Five lashed river logs
  px(ctx, INK, x - 9, y - 4, 18, 8);
  for (let i = 0; i < 3; i++) {
    const ly = y - 3 + i * 2;
    px(ctx, i === 1 ? PAL.timber.mid : PAL.timber.lit, x - 8, ly, 16, 1);
    px(ctx, PAL.timber.shade, x - 8, ly + 1, 16, 1);
  }
  // Cross spars & hemp bindings
  px(ctx, PAL.timber.dark, x - 5, y - 3, 2, 6);
  px(ctx, PAL.timber.dark, x + 3, y - 3, 2, 6);
  px(ctx, '#e2c26b', x - 5, y - 2, 1, 4);
  px(ctx, '#e2c26b', x + 4, y - 2, 1, 4);

  // Steering sweep oar trailing off the stern
  linePx(ctx, INK, x - 6, y, x - 11, y + 3);
  linePx(ctx, PAL.timber.lit, x - 6, y - 1, x - 10, y + 2);

  // War pennant pole
  banner(ctx, x, y - 2, 13, '#b13e53', '#d46373', t + q * 0.4, false);
}

// ------------------------------------------------------------------ bridges

const WOOD_DARK = '#4d2714';
const WOOD_POST = '#8a4b2e';
const WOOD_LIT = '#b36b43';

/**
 * Trestle pier positions (relative to tile centre) for each bridge deck frame:
 * 0 = N-S vertical span, 1 = NE-SW diagonal, 2 = NW-SE diagonal.
 * Diagonals place front/back piers offset across the span so the timber bent
 * and diagonal cross-bracing read cleanly in 2.5D below the deck.
 */
const TRESTLE = [
  [[-7, 1], [7, 1]],
  [[-4, -2], [4, 2]],
  [[-4, 2], [4, -2]],
];

/**
 * One hex of bridge: water shadow, timber trestle bent with cross-bracing,
 * animated piling ripples, and the plank deck.
 *
 * @param img    the Tiles_Bridge sheet
 * @param frame  which deck, from `bridgeFrame(edge)`
 * @param deck   centre of the deck's face — the tile's centre at deck height
 * @param drop   pixels from the deck down to the water; 0 for a causeway
 * @param t      animation time in seconds
 */
export function drawBridgeDeck(ctx, img, frame, deck, drop = 0, t = 0) {
  const x = Math.round(deck.x), y = Math.round(deck.y);

  if (drop > 0) {
    // Shadow cast on the water directly below, clipped to the hex top face.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x - 10, y + drop - 12); ctx.lineTo(x + 10, y + drop - 12); ctx.lineTo(x + 16, y + drop);
    ctx.lineTo(x + 10, y + drop + 12); ctx.lineTo(x - 10, y + drop + 12); ctx.lineTo(x - 16, y + drop);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = 'rgba(18, 22, 54, 0.28)';
    ctx.beginPath();
    if (frame === 0) {
      ctx.rect(x - 6, y + drop - 12, 12, 24);
    } else {
      const s = frame === 1 ? -1 : 1;
      ctx.moveTo(x - 16, y + drop - s * 7.4 - 5); ctx.lineTo(x + 16, y + drop + s * 7.4 - 5);
      ctx.lineTo(x + 16, y + drop + s * 7.4 + 5); ctx.lineTo(x - 16, y + drop - s * 7.4 + 5);
    }
    ctx.fill();
    ctx.restore();

    const piers = TRESTLE[frame] || TRESTLE[0];
    const [pA, pB] = piers;
    const footA = y + pA[1] + drop;
    const footB = y + pB[1] + drop;

    // Cross-bracing & horizontal ledger tie between the two timber piers
    if (drop >= 8) {
      const capY = y + Math.round((pA[1] + pB[1]) / 2) + 3;
      const midY = y + Math.round((pA[1] + pB[1]) / 2) + Math.round(drop * 0.55);
      linePx(ctx, WOOD_DARK, x + pA[0], capY, x + pB[0], midY);
      linePx(ctx, WOOD_DARK, x + pB[0], capY, x + pA[0], midY);
      linePx(ctx, WOOD_POST, x + pA[0], capY + 1, x + pB[0], midY + 1);
      linePx(ctx, WOOD_DARK, x + pA[0], midY, x + pB[0], midY);
    }

    // Timber pilings + animated water foam around feet
    const rip = Math.floor(t * 2.2) % 2;
    for (const [dx, dy] of piers) {
      const pxl = x + dx;
      const top = y + dy - 1;
      const foot = y + dy + drop;
      const len = foot - top;
      px(ctx, WOOD_DARK, pxl - 1, top, 3, len + 1);
      px(ctx, WOOD_POST, pxl, top, 1, len);
      px(ctx, WOOD_LIT, pxl, top, 1, Math.min(4, len));
      // Wet waterline darkening
      if (len > 3) px(ctx, WOOD_DARK, pxl, foot - 2, 1, 2);
      // Lapping foam ripples
      px(ctx, 'rgba(232, 244, 255, 0.55)', pxl - 2 - rip, foot, 2, 1);
      px(ctx, 'rgba(232, 244, 255, 0.45)', pxl + 1 + rip, foot + 1, 2, 1);
    }
  }

  if (!img) {
    px(ctx, INK, x - 10, y - 8, 20, 16);
    px(ctx, '#a87a45', x - 9, y - 7, 18, 14);
    return;
  }
  ctx.drawImage(img, frame * 32, 0, 32, 48, x - 16, y - 28, 32, 48);
}

/** Draw a structure standing on the top face centred at (x, y). */
export function drawStructure(ctx, x, y, item, t = 0, feature = null) {
  (DRAW[item] || DRAW.hearth)(ctx, x, y, t);
  if (feature && feature.maxHp && feature.hp < feature.maxHp) {
    hpBar(ctx, x, y - 24, feature.hp / feature.maxHp, '#d9b45b');
  }
}

export function hpBar(ctx, x, y, frac, color = '#7ad15a') {
  const w = 12;
  px(ctx, INK, x - w / 2 - 1, y - 1, w + 2, 3);
  px(ctx, '#3a1c22', x - w / 2, y, w, 1);
  px(ctx, color, x - w / 2, y, Math.max(1, Math.round(w * Math.max(0, frac))), 1);
}

const KIND_COLORS = {
  farmers:     { fill: '#e2c26b', lit: '#f5dc8f' },
  woodcutters: { fill: '#38b764', lit: '#64d689' },
  masons:      { fill: '#94b0c2', lit: '#b8d0df' },
  fishers:     { fill: '#41a6f6', lit: '#78c5ff' },
  herbalists:  { fill: '#a7f070', lit: '#ccf99e' },
  smiths:      { fill: '#ef7d57', lit: '#ffa484' },
};

/**
 * Compact 2.5D pixel building block for multi-building village hamlets.
 * Draws walls, optional timber framing, door, glowing window(s), chimney,
 * eaves shadow, and stepped roof.
 */
function miniHouse(ctx, x, y, w, h, roofH, wallPal, roofPal, opts = {}) {
  const {
    t = 0,
    timber = true,
    doorX = -1,
    winX = 2,
    winY = -Math.max(4, h - 2),
    win2 = false,
    chimney = 0, // -1 left, +1 right, 0 none
    darkSmoke = false,
    crenellated = false,
    stilts = false,
    finial = false,
  } = opts;

  const half = Math.floor(w / 2);

  // Optional timber pilings underneath (e.g. boathouse over jetty)
  if (stilts) {
    px(ctx, INK, x - half, y, 2, 3);
    px(ctx, PAL.timber.shade, x - half, y, 1, 2);
    px(ctx, INK, x + half - 2, y, 2, 3);
    px(ctx, PAL.timber.shade, x + half - 1, y, 1, 2);
  }

  // Main wall block
  box(ctx, x - half, y - h, w, h, wallPal.mid, wallPal.lit, wallPal.shade);

  if (timber) {
    px(ctx, PAL.timber.dark, x - half, y - h, 1, h);
    px(ctx, PAL.timber.dark, x + half - 1, y - h, 1, h);
    if (h >= 7) px(ctx, PAL.timber.shade, x - half, y - Math.floor(h / 2) - 1, w, 1);
  }

  // Door
  if (doorX !== null) {
    px(ctx, INK, x + doorX - 1, y - 4, 3, 5);
    px(ctx, PAL.timber.shade, x + doorX, y - 3, 1, 3);
  }

  // Glowing hearth-lit window(s)
  if (winX !== null) {
    const glow = 0.8 + 0.2 * Math.sin(t * 2.7 + x);
    const wc = glow > 0.85 ? '#ffe38a' : '#f5b64c';
    px(ctx, INK, x + winX - 1, y + winY - 1, 3, 3);
    px(ctx, wc, x + winX, y + winY, 1, 1);
    px(ctx, '#fff6c4', x + winX, y + winY, 1, 1);
    if (win2) {
      px(ctx, INK, x + winX - 1, y - h + 2, 3, 3);
      px(ctx, wc, x + winX, y - h + 3, 1, 1);
    }
  }

  // Chimney behind roof
  if (chimney !== 0) {
    const cx = x + (chimney > 0 ? Math.max(1, half - 3) : -half + 1);
    const cy = y - h - roofH + 1;
    box(ctx, cx, cy, 3, 5, PAL.stone.mid, PAL.stone.lit, PAL.stone.shade);
    px(ctx, INK, cx - 1, cy - 1, 5, 1);
    smoke(ctx, cx + 1, cy - 2, t, darkSmoke);
  }

  // Crenellated stone parapet below turret roof (for masons keep)
  if (crenellated) {
    for (let mx = -half; mx <= half - 2; mx += 3) {
      box(ctx, x + mx, y - h - 2, 2, 2, PAL.stone.lit, '#d2cfe0', PAL.stone.mid);
    }
  }

  // Eaves drop shadow
  px(ctx, 'rgba(27, 20, 32, 0.35)', x - half, y - h, w, 1);

  // Stepped pixel roof
  const roofBaseY = crenellated ? y - h - 2 - roofH : y - h - roofH;
  pixelRoof(ctx, x, roofBaseY, half + 1, roofH, roofPal, true);
  if (finial) {
    px(ctx, INK, x - 1, roofBaseY - 2, 2, 2);
    px(ctx, PAL.timber.lit, x, roofBaseY - 1, 1, 1);
  }
}

/**
 * A trade village: rich multi-building 2.5D hamlet of 2–3 overlapping structures
 * on a shared village green, tailored to the village's trade guild
 * (`farmers`, `woodcutters`, `masons`, `fishers`, `herbalists`, `smiths`).
 */
export function drawVillage(ctx, x, y, t = 0, kind = 'farmers', status = {}) {
  // Shared village green / cobbled ground shadow
  shadow(ctx, x, y + 2, 15, 4);
  px(ctx, 'rgba(72, 62, 48, 0.45)', x - 11, y + 1, 22, 2);
  px(ctx, PAL.stone.shade, x - 4, y + 2, 8, 1);

  switch (kind) {
    case 'woodcutters': {
      // Back-Left: Tall two-story Forester's Log Lodge
      miniHouse(ctx, x - 4, y - 2, 10, 9, 7, PAL.timber, PAL.mossRoof, {
        t, timber: false, doorX: -2, winX: 1, winY: -4, win2: true, chimney: 1, finial: true,
      });
      // Front-Right: Sawyer's Log Cabin
      miniHouse(ctx, x + 5, y + 1, 9, 6, 5, PAL.timber, PAL.thatch, {
        t, timber: false, doorX: -2, winX: 1, winY: -4,
      });
      // Front-Left: Stacked log pyramid with pale cut ends
      for (const [lx, ly] of [[-10, 2], [-7, 2], [-9, 0], [-6, 0], [-8, -2]]) {
        px(ctx, INK, x + lx - 1, y + ly - 1, 4, 3);
        px(ctx, PAL.timber.mid, x + lx, y + ly, 2, 1);
        px(ctx, '#e5c690', x + lx, y + ly, 1, 1);
      }
      break;
    }

    case 'masons': {
      // Back-Right: Tall crenellated Stone Keep Tower
      miniHouse(ctx, x + 4, y - 2, 8, 10, 6, PAL.stone, PAL.slate, {
        t, timber: false, doorX: null, winX: 0, winY: -7, win2: true, crenellated: true, finial: true,
      });
      // Front-Left: Dressed-stone Guildhall
      miniHouse(ctx, x - 5, y + 1, 11, 7, 6, PAL.stone, PAL.slate, {
        t, timber: false, doorX: -1, winX: 2, winY: -5, chimney: -1,
      });
      // Front-Right: Cut marble/ashlar stone blocks
      box(ctx, x + 2, y + 1, 5, 3, PAL.stone.lit, '#d2cfe0', PAL.stone.mid);
      box(ctx, x + 5, y - 1, 4, 3, PAL.stone.mid, PAL.stone.lit, PAL.stone.shade);
      break;
    }

    case 'fishers': {
      const blueTimber = { lit: '#6d97c4', mid: '#4b729f', shade: '#314c6e' };
      // Back-Left: Tall Harbour Lantern House
      miniHouse(ctx, x - 4, y - 2, 9, 9, 7, PAL.plaster, PAL.reedRoof, {
        t, timber: true, doorX: -1, winX: 1, winY: -7, win2: true, finial: true,
      });
      // Timber jetty deck under right boathouse
      box(ctx, x + 1, y + 2, 11, 2, PAL.timber.mid, PAL.timber.lit, PAL.timber.shade);
      // Front-Right: Stilted Blue-Clapboard Boathouse Cottage
      miniHouse(ctx, x + 5, y + 1, 10, 6, 5, blueTimber, PAL.reedRoof, {
        t, timber: false, doorX: -2, winX: 1, winY: -4, stilts: true,
      });
      // Front-Left: Wooden fish-drying rack with hanging silver fish
      px(ctx, INK, x - 11, y - 3, 2, 6);
      px(ctx, INK, x - 5, y - 3, 2, 6);
      px(ctx, PAL.timber.mid, x - 11, y - 2, 1, 5);
      px(ctx, PAL.timber.mid, x - 5, y - 2, 1, 5);
      px(ctx, INK, x - 12, y - 4, 9, 2);
      px(ctx, PAL.timber.lit, x - 11, y - 3, 7, 1);
      for (const fx of [-10, -8, -6]) {
        px(ctx, '#b8d0e0', x + fx, y - 1, 1, 2);
        px(ctx, '#e8f4ff', x + fx, y - 1, 1, 1);
      }
      break;
    }

    case 'herbalists': {
      // Back-Centre: Tall Apothecary Spire House with flaring mossy roof
      miniHouse(ctx, x, y - 3, 9, 9, 8, PAL.plaster, PAL.mossRoof, {
        t, timber: true, doorX: null, winX: 0, winY: -7, chimney: 1, finial: true,
      });
      // Front-Left: Cozy Herb-Gatherer's Cottage
      miniHouse(ctx, x - 6, y + 1, 9, 6, 5, PAL.plaster, PAL.mossRoof, {
        t, timber: true, doorX: -1, winX: 1, winY: -4,
      });
      // Front-Right: Timber-framed Glass Conservatory / Greenhouse
      box(ctx, x + 2, y - 3, 8, 5, '#50b4d8', '#8be9fd', '#3a88a8');
      px(ctx, PAL.timber.dark, x + 5, y - 3, 1, 5);
      pixelRoof(ctx, x + 6, y - 7, 5, 4, { lit: '#a6f0ff', mid: '#63c5e6', shade: '#3c8eab', ridge: '#d8f9ff' }, false);
      // Blooming flowerbox in front
      box(ctx, x + 2, y + 1, 7, 2, PAL.timber.mid, PAL.timber.lit, PAL.timber.shade);
      px(ctx, '#b9a4f0', x + 3, y, 2, 1);
      px(ctx, '#ffd166', x + 6, y, 2, 1);
      break;
    }

    case 'smiths': {
      // Twin tall stone blast chimneys behind foundry
      for (const cx of [x - 8, x - 1]) {
        box(ctx, cx, y - 19, 3, 10, PAL.stone.mid, PAL.stone.lit, PAL.stone.shade);
        px(ctx, INK, cx - 1, y - 20, 5, 1);
        smoke(ctx, cx + 1, y - 21, t + cx * 0.1, true);
      }
      // Back-Left: Heavy Stone & Iron Foundry
      miniHouse(ctx, x - 4, y - 2, 11, 8, 6, PAL.stone, PAL.slate, {
        t, timber: false, doorX: null, winX: null,
      });
      // Glowing furnace arch at foundry base
      px(ctx, INK, x - 6, y - 6, 4, 4);
      flame(ctx, x - 4, y - 3, t, 1);

      // Front-Right: Armourer's Guildhouse
      miniHouse(ctx, x + 5, y + 1, 9, 6, 5, PAL.plaster, PAL.shingle, {
        t, timber: true, doorX: -2, winX: 1, winY: -4,
      });
      // Front-Centre: Horned iron anvil & hot bar
      box(ctx, x - 3, y + 2, 3, 2, PAL.timber.shade, PAL.timber.mid, PAL.timber.dark);
      px(ctx, INK, x - 4, y, 6, 2);
      px(ctx, '#8b95a8', x - 3, y, 4, 1);
      px(ctx, '#ef7d57', x - 2, y - 1, 2, 1);
      break;
    }

    case 'farmers':
    default: {
      // Back-Right: Tall timber-strapped Granary Silo Tower
      miniHouse(ctx, x + 5, y - 3, 8, 9, 6, PAL.timber, PAL.thatch, {
        t, timber: false, doorX: null, winX: 0, winY: -7, finial: true,
      });
      // Back-Left: Half-timbered Farmhouse Longhall
      miniHouse(ctx, x - 4, y - 1, 11, 7, 7, PAL.plaster, PAL.thatch, {
        t, timber: true, doorX: -2, winX: 2, winY: -5, chimney: -1,
      });
      // Front-Right: Smaller Thatch Barn / Cottage
      miniHouse(ctx, x + 3, y + 2, 8, 5, 4, PAL.plaster, PAL.thatch, {
        t, timber: true, doorX: -1, winX: 1, winY: -3,
      });
      // Golden hay bale in front-left courtyard
      box(ctx, x - 6, y + 1, 5, 3, '#d9ad48', '#f0cf73', '#a67b26');
      break;
    }
  }

  // Well-proportioned 11px trade guild banner planted on the right edge of the village green
  const kc = KIND_COLORS[kind] || KIND_COLORS.farmers;
  banner(ctx, x + 10, y + 1, 11, kc.fill, kc.lit, t, false);

  if (status.raided) {
    flame(ctx, x - 5, y - 10, t, 2);
    flame(ctx, x + 5, y - 6, t + 0.3, 1);
    smoke(ctx, x - 4, y - 15, t, true);
  }
}

/** A raider camp: stitched hide war tents, skull stakes, central fire, and war banner. */
export function drawCamp(ctx, x, y, t = 0, feature = {}) {
  if (feature.burned) {
    shadow(ctx, x, y + 1, 11, 3);
    // Ash mounds & charred tent ribs
    px(ctx, INK, x - 9, y - 2, 18, 4);
    px(ctx, '#3a3530', x - 8, y - 1, 16, 2);
    px(ctx, '#5a5048', x - 5, y - 2, 4, 1);
    px(ctx, '#5a5048', x + 2, y - 2, 5, 1);
    linePx(ctx, INK, x - 7, y, x - 4, y - 7);
    linePx(ctx, INK, x + 6, y, x + 3, y - 6);
    px(ctx, INK, x, y - 9, 1, 8);
    smoke(ctx, x - 2, y - 3, t, true);
    return;
  }

  shadow(ctx, x, y + 1, 13, 4);

  const tent = (tx, ty, halfW, h, pal) => {
    pixelRoof(ctx, tx, ty - h, halfW, h, pal, false);
    // Crossed ridge poles sticking out the apex
    px(ctx, INK, tx - 2, ty - h - 2, 1, 2);
    px(ctx, INK, tx + 1, ty - h - 2, 1, 2);
    // Dark tent flap opening
    px(ctx, INK, tx - 2, ty - 4, 4, 5);
    px(ctx, '#2b1b18', tx - 1, ty - 3, 2, 4);
  };

  if (feature.boss) {
    // Warlord's grand war pavilion + flank tent
    tent(x - 6, y - 1, 7, 10, PAL.hide);
    tent(x + 6, y, 6, 8, PAL.hideDark);
  } else {
    tent(x - 6, y - 1, 6, 8, PAL.hide);
    tent(x + 6, y, 5, 7, PAL.hideDark);
  }

  // Trophy skull stake on left
  px(ctx, INK, x - 11, y - 6, 1, 7);
  px(ctx, '#f0e6d2', x - 12, y - 7, 3, 2);

  // Central war-fire
  flame(ctx, x, y + 2, t, feature.boss ? 2 : 1);

  // Tattered crimson war banner
  const bh = feature.boss ? 25 : 19;
  banner(ctx, x, y - 2, bh, '#b13e53', '#d46373', t, true);
  if (feature.boss) {
    px(ctx, INK, x - 2, y - bh - 4, 4, 2);
    px(ctx, '#ffcd75', x - 1, y - bh - 4, 2, 1);
  }
}
