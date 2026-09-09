// structures.js
// Placeholder art for the things you build.
//
// There are no building sprites in the asset set — the sheets cover terrain,
// paths, shorelines and crops, and nothing else — so these are drawn, the same
// way the player pawn is. They are shapes with the right silhouette and the tile
// palette's habits (a dark outline, light from the top left), grouped so that a
// forge and a kiln read as the same kind of thing at a glance. Swapping in real
// sprites means replacing one function.

const INK = '#1b1420';

/** Which shape stands in for which structure. */
const SHAPES = {
  hut: ['cabin', 'stone_house', 'smokehouse', 'granary', 'bakehouse', 'market_stall'],
  dome: ['hearth', 'stone_oven', 'clay_oven', 'kiln', 'forge', 'quarry'],
  post: ['wood_fence', 'rock_wall', 'stone_wall', 'ladder', 'bridge'],
  totem: ['shrine', 'totem', 'oracle', 'well'],
};

const SHAPE_OF = (() => {
  const m = {};
  for (const [shape, items] of Object.entries(SHAPES)) for (const id of items) m[id] = shape;
  return m;
})();

const PALETTE = {
  hut: { body: '#8a6236', lit: '#a87a45', roof: '#6d4b2a' },
  dome: { body: '#7d7469', lit: '#9a9086', roof: '#4e3b2c' },
  post: { body: '#7a5c34', lit: '#96723f', roof: '#5c4426' },
  totem: { body: '#6f6a7a', lit: '#8b8598', roof: '#4a4553' },
};

/**
 * Draw a structure standing on the top face centred at (x, y). Whole pixels, so
 * it stays crisp through the integer upscale.
 */
export function drawStructure(ctx, x, y, item) {
  const shape = SHAPE_OF[item] || 'totem';
  const c = PALETTE[shape];

  ctx.fillStyle = 'rgba(20, 16, 30, 0.30)';
  ctx.beginPath();
  ctx.ellipse(x, y + 1, 7, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  if (shape === 'hut') {
    outlined(ctx, () => {
      ctx.fillStyle = c.body;
      ctx.fillRect(x - 6, y - 8, 12, 8);
      ctx.fillStyle = c.lit;
      ctx.fillRect(x - 6, y - 8, 3, 8);
    }, x - 7, y - 9, 14, 9);
    // Roof.
    ctx.fillStyle = INK;
    tri(ctx, x, y - 15, 9);
    ctx.fillStyle = c.roof;
    tri(ctx, x, y - 14, 7);
  } else if (shape === 'dome') {
    ctx.fillStyle = INK;
    half(ctx, x, y, 8);
    ctx.fillStyle = c.body;
    half(ctx, x, y - 1, 6);
    ctx.fillStyle = c.lit;
    half(ctx, x - 1, y - 1, 3);
    // The mouth, where the fire is.
    ctx.fillStyle = '#d97b3c';
    ctx.fillRect(x - 1, y - 3, 3, 3);
  } else if (shape === 'post') {
    ctx.fillStyle = INK;
    ctx.fillRect(x - 6, y - 7, 12, 8);
    ctx.fillStyle = c.body;
    ctx.fillRect(x - 5, y - 6, 10, 6);
    ctx.fillStyle = c.lit;
    ctx.fillRect(x - 5, y - 6, 10, 2);
    ctx.fillStyle = INK;
    ctx.fillRect(x - 3, y - 6, 1, 6);
    ctx.fillRect(x + 2, y - 6, 1, 6);
  } else {
    ctx.fillStyle = INK;
    ctx.fillRect(x - 4, y - 14, 8, 15);
    ctx.fillStyle = c.body;
    ctx.fillRect(x - 3, y - 13, 6, 13);
    ctx.fillStyle = c.lit;
    ctx.fillRect(x - 3, y - 13, 2, 13);
    ctx.fillStyle = c.roof;
    ctx.fillRect(x - 5, y - 15, 10, 2);
    ctx.fillStyle = INK;
    ctx.fillRect(x - 6, y - 16, 12, 1);
  }
}

/** A village is bigger than one hut: three of them and a fence line. */
export function drawVillage(ctx, x, y) {
  ctx.fillStyle = 'rgba(20, 16, 30, 0.30)';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  drawStructure(ctx, x - 6, y - 1, 'cabin');
  drawStructure(ctx, x + 6, y, 'cabin');
  drawStructure(ctx, x, y + 3, 'stone_house');
}

function outlined(ctx, paint, ox, oy, w, h) {
  ctx.fillStyle = INK;
  ctx.fillRect(ox, oy, w, h);
  paint();
}

function tri(ctx, cx, apexY, halfWidth) {
  ctx.beginPath();
  ctx.moveTo(cx, apexY);
  ctx.lineTo(cx + halfWidth, apexY + halfWidth);
  ctx.lineTo(cx - halfWidth, apexY + halfWidth);
  ctx.closePath();
  ctx.fill();
}

function half(ctx, cx, baseY, r) {
  ctx.beginPath();
  ctx.arc(cx, baseY, r, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
}
