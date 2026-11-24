// loot.js
// A pile of loot on the ground: a tied sack with coins spilled beside it, and a
// glint that comes and goes so it reads as something to pick up.

const PAL = {
  o: '#2b1a12', // outline
  s: '#8a5a33', // sack
  l: '#b47c48', // sack, lit
  d: '#5e3a22', // sack, shade
  t: '#d9b45b', // tie
  c: '#f2c94c', // coin
  k: '#a87a22', // coin edge
};

// Bottom row sits on the ground at y. Columns centred on x.
const SACK = [
  '...tt...',
  '..otto..',
  '.ollsso.',
  'ollsssdo',
  'olssssdo',
  'olssssdo',
  '.osssddo',
  '..oooo..',
];
const COINS = [
  'kcck.',
  '.kcck',
];

function blit(ctx, rows, x, y) {
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j];
    for (let i = 0; i < row.length; i++) {
      const c = PAL[row[i]];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x + i, y + j, 1, 1);
    }
  }
}

/** Draw a loot pile at tile centre (x, y). `hot` when the pointer is over it. */
export function drawLootPile(ctx, x, y, t = 0, hot = false) {
  x = Math.round(x);
  y = Math.round(y) + 3;
  // Shadow.
  ctx.fillStyle = 'rgba(20, 16, 30, 0.3)';
  ctx.fillRect(x - 5, y, 11, 2);
  if (hot) {
    ctx.save();
    ctx.strokeStyle = '#fff5cf';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y - 3, 9, 6, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
  blit(ctx, SACK, x - 5, y - SACK.length);
  blit(ctx, COINS, x + 2, y - COINS.length + 1);
  // A glint, now and then, on the coins.
  const phase = (t * 0.8 + (x * 0.13 + y * 0.07)) % 3;
  if (phase < 0.35) {
    ctx.fillStyle = '#fffbe6';
    ctx.fillRect(x + 4, y - 3, 1, 1);
    ctx.fillRect(x + 3, y - 2, 3, 1);
    ctx.fillRect(x + 4, y - 1, 1, 1);
  }
}
