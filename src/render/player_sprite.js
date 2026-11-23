// player_sprite.js
// The Wanderer: a 4-direction, equipment-aware 1x pixel-art player sprite.
//
// Art direction (see docs/character_art.md):
//  - Silhouette first. Hooded, the figure is one bold A-line shape; bare-headed,
//    it is a linen tunic with swinging arms. Short solid legs underneath either way.
//  - One accent. The scarf is the only colour that isn't the cloak (or tunic), and
//    its tail trails behind, lagging the body: cheap follow-through that feels alive.
//  - Coloured outlines. Each material is wrapped in a dark shade of itself, never
//    pure black, and there are no hard lines inside the figure.
//
// The cloak is not a worn slot: donning one is permanent (`state.cloak`), and its
// colour is the player's chosen colour (`state.playerColor`, see CLOAK_COLORS).
//
// Body parts are authored as pixel grids (one character per pixel, '.' is empty)
// and gear is layered on top. Equipped slots:
//   head    : amulet | null
//   hand    : walking_stick | stone_knife | stone_axe | stone_hammer | iron_axe | pickaxe | bow | sword | null
//   offhand : shield | null
//   body    : hide_armor | iron_mail | null
//   feet    : boots | null
//   pack    : basket | leather_pack | cart | null

// ------------------------------------------------------------------ PALETTES

const SKIN = { F: '#f7d3a6', f: '#d39a70', e: '#2a1626' };
const HAIR = { n: '#2a1a14', H: '#9a6438', J: '#64401f' };

const TEAL = { a: '#8ae8d0', b: '#3fae9f', c: '#25687a' };
const GOLD = { a: '#ffe08a', b: '#e0a640', c: '#a0642a' };
const RED = { a: '#ff9a94', b: '#d8434e', c: '#8a2236' };

/**
 * The colours a player can choose for their cloak. Each comes with the scarf that
 * suits it, so the figure always keeps exactly one accent.
 */
export const CLOAK_COLORS = [
  { id: 'crimson', name: 'Crimson', scarf: TEAL, cloak: { o: '#2a1626', h: '#ec7a5c', l: '#c8443f', m: '#922d3e', s: '#5f1e37' } },
  { id: 'amber', name: 'Amber', scarf: TEAL, cloak: { o: '#33200f', h: '#ffc66a', l: '#e08c32', m: '#ad5f26', s: '#73391b' } },
  { id: 'rose', name: 'Rose', scarf: TEAL, cloak: { o: '#381525', h: '#ffb4c4', l: '#e67c9a', m: '#b65074', s: '#7c3052' } },
  { id: 'forest', name: 'Forest', scarf: GOLD, cloak: { o: '#132219', h: '#9ad67e', l: '#55a052', m: '#33703f', s: '#1f472d' } },
  { id: 'ocean', name: 'Ocean', scarf: GOLD, cloak: { o: '#141a36', h: '#86bdf2', l: '#4479cc', m: '#2c5199', s: '#1d3468' } },
  { id: 'plum', name: 'Plum', scarf: GOLD, cloak: { o: '#1f1430', h: '#cf98e8', l: '#9558bf', m: '#693a91', s: '#442462' } },
  { id: 'slate', name: 'Slate', scarf: RED, cloak: { o: '#15161e', h: '#a4aec2', l: '#6b7690', m: '#4a5268', s: '#30354a' } },
  { id: 'snow', name: 'Snow', scarf: RED, cloak: { o: '#3a3430', h: '#ffffff', l: '#e6e0d4', m: '#c0b6a4', s: '#8e8474' } },
];
export const DEFAULT_COLOR = 'crimson';
export const cloakColor = id => CLOAK_COLORS.find(c => c.id === id) || CLOAK_COLORS[0];

/** Undyed linen, for the Wanderer before they find a cloak. */
const TUNIC = { o: '#3b2a24', h: '#f2e4c4', l: '#d8c49c', m: '#b09670', s: '#806a50', x: '#6a4028' };

// Legs: far leg (Q trousers, Y shin, Z foot) and near leg (q/p, U/u, K/k: dark/lit).
const TROUSERS = { Q: '#1f1a30', q: '#2e2744', p: '#4f4568' };
const BARE_FEET = { Y: TROUSERS.Q, U: TROUSERS.q, u: TROUSERS.p, Z: '#2e2020', K: '#4a3328', k: '#8a6448' };
const BOOT_FEET = { Y: '#4a2a1a', U: '#8a5228', u: '#e0a55c', Z: '#3a2016', K: '#5c3420', k: '#b06c3c' };

/** Everything else: wood, stone, steel, fur, leather, straw, gold. */
const GEAR = {
  O: '#2c1d24', // gear outline
  w: '#d29a62', W: '#9a6238', d: '#5e3a22', // wood
  t: '#e2d0a2', // twine / bowstring
  r: '#e4ded2', R: '#a9a196', X: '#6e675f', // stone
  S: '#f6f8fb', E: '#c2d0de', D: '#7a8ca4', I: '#46526a', // steel
  c: '#73eff7', // steel glint
  g: '#f6cf6e', G: '#b8862f', // gold
  A: '#f2e6cf', B: '#cfba95', C: '#9a835f', N: '#4a3426', // fur
  L: '#a06a3e', l: '#cf9150', J: '#5c361a', // leather
  y: '#f2d27a', Y: '#c98a3e', j: '#8a5630', // straw basket
  V: '#b8cc8e', v: '#7b9158', // bedroll
};

const SHADOW = 'rgba(20, 16, 30, 0.30)';
const SMEAR = 'rgba(255, 246, 222, 0.75)';
const SMEAR_SOFT = 'rgba(255, 246, 222, 0.4)';

// ------------------------------------------------------------------ PEN

/**
 * A facing-aware pixel pen anchored at (ox, oy). With f = -1 every dx is mirrored,
 * so all art is authored facing right.
 */
function makePen(ctx, f, ox, oy) {
  ox = Math.round(ox);
  oy = Math.round(oy);
  const put = (c, dx, dy, w = 1, h = 1) => {
    ctx.fillStyle = c;
    ctx.fillRect(f > 0 ? ox + dx : ox - dx - (w - 1), oy + dy, w, h);
  };
  const grid = (rows, x0, y0, pal) => {
    for (let j = 0; j < rows.length; j++) {
      const row = rows[j];
      for (let i = 0; i < row.length; i++) {
        const c = pal[row[i]];
        if (c) put(c, x0 + i, y0 + j);
      }
    }
  };
  return { put, grid, f, at: (dx, dy) => makePen(ctx, f, ox + f * dx, oy + dy) };
}

// ------------------------------------------------------------------ BODY GRIDS
// Side views face right. Every grid's rows start at the y it is drawn at; all are
// drawn at x0 = -6 (side) or -5 (front/back) relative to the feet.

const HOOD = {
  side: [
    '..ooo......',
    '..ohhooo...',
    '..ohhhllo..',
    '..ohlllmmo.',
    '..ohlsFeFo.',
    '..olmsfFFo.',
  ],
  down: [
    '...ooooo...',
    '..ohhhllo..',
    '.ohhllllmo.',
    '.ohlmmmmso.',
    '.olseFesmo.',
    '.olsfFfsmo.',
  ],
  up: [
    '...ooooo...',
    '..ohhhllo..',
    '.ohhllllmo.',
    '.ohllllmmo.',
    '.ohlllmmso.',
    '.ollmmmsso.',
  ],
};
const HAIRDO = {
  side: [
    '....nnn....',
    '...nHHHnn..',
    '..nHHHHJJn.',
    '..nHJJFeFn.',
    '..nJJfFFFn.',
    '...nJffFn..',
  ],
  down: [
    '...nnnnn...',
    '..nHHHHJn..',
    '.nHHHHHJJn.',
    '.nJFeFeFJn.',
    '.nJfFFFfJn.',
    '..nnfFfnn..',
  ],
  up: [
    '...nnnnn...',
    '..nHHHHJn..',
    '.nHHHHHJJn.',
    '.nHHHJJJJn.',
    '.nJJJJJJJn.',
    '..nnfffnn..',
  ],
};
const HEAD_Y = -15;
const BODY_Y = -9;

// A slim A-line cloak; mid-stride the back of the hem kicks out a pixel.
const CLOAK_BODY = {
  side: [
    '...obbbaao.',
    '...ohllmmo.',
    '...ohllmmo.',
    '..ohllmmso.',
    '..ohlmmmsso',
    '..ollmmssso',
    '..ooooooooo',
  ],
  billow: [
    '...obbbaao.',
    '...ohllmmo.',
    '...ohllmmo.',
    '..ohllmmso.',
    '.ohllmmmsso',
    '.ollmmmssso',
    '.oooooooooo',
  ],
  down: [
    '..obbabbo..',
    '..ohllmso..',
    '..ohllmso..',
    '.ohllmmmso.',
    '.ohlmmmmso.',
    '.ollmmmsso.',
    '.ooooooooo.',
  ],
  up: [
    '..obbbbbo..',
    '..ohllmso..',
    '..ohllmso..',
    '.ohllmmmso.',
    '.ohlmmmmso.',
    '.ollmmmsso.',
    '.ooooooooo.',
  ],
};
// A belted linen tunic, narrower than the cloak.
const TUNIC_BODY = {
  side: [
    '...obbbaao.',
    '...ohllmo..',
    '...ohllmo..',
    '...ohlmmo..',
    '...oxxxxo..',
    '..ohllmmo..',
    '..ooooooo..',
  ],
  down: [
    '..obbabbo..',
    '..ohllmso..',
    '..ohllmso..',
    '..ohlmmso..',
    '..oxxxxxo..',
    '..ohlmmso..',
    '..ooooooo..',
  ],
  up: [
    '..obbbbbo..',
    '..ohllmso..',
    '..ohllmso..',
    '..ohlmmso..',
    '..oxxxxxo..',
    '..ohlmmso..',
    '..ooooooo..',
  ],
};
TUNIC_BODY.billow = TUNIC_BODY.side;

// Rows y = -3..0; the top row hides under the hem until the body bobs up.
// A short, easy stride: feet travel one pixel either side of standing.
const SIDE_LEGS = {
  idle: ['....QQ.qp..', '....QQ.qp..', '....YY.Uu..', '....ZZ.Kk..'],
  w0: ['....QQ.qp..', '...QQ...qp.', '...YY...Uu.', '...ZZ...Kk.'],
  w1: ['....QQ.qp..', '....QQ.qp..', '...ZZ..Uu..', '.......Kk..'],
  w2: ['....qp.QQ..', '...qp...QQ.', '...Uu...YY.', '...Kk...ZZ.'],
  w3: ['....QQ.qp..', '....QQ.qp..', '....YY..Kk.', '....ZZ.....'],
};
// Front view: a lifted foot shows only its shin.
const DOWN_LEGS = {
  idle: ['...pq.pq...', '...pq.pq...', '...uU.uU...', '...kK.kK...'],
  w0: ['...pq.pq...', '...pq.pq...', '...kK.uU...', '......kK...'],
  w1: ['...pq.pq...', '...qq.pq...', '...UU.uU...', '...kK.kK...'],
  w2: ['...pq.pq...', '...pq.pq...', '...uU.kK...', '...kK......'],
  w3: ['...pq.pq...', '...pq.qq...', '...uU.UU...', '...kK.kK...'],
};
// Back view: heels show.
const UP_LEGS = {
  idle: ['...pq.pq...', '...pq.pq...', '...uU.uU...', '...KK.KK...'],
  w0: ['...pq.pq...', '...pq.pq...', '...KK.uU...', '......KK...'],
  w1: ['...pq.pq...', '...qq.pq...', '...UU.uU...', '...KK.KK...'],
  w2: ['...pq.pq...', '...pq.pq...', '...uU.KK...', '...KK......'],
  w3: ['...pq.pq...', '...pq.qq...', '...uU.UU...', '...KK.KK...'],
};

// Sitting with knees drawn up under the cloak, boots poking out in front.
const SEATED_CLOAK = [
  '...obbbaao...',
  '..ohllmmmo...',
  '..ohllmmmooo.',
  '.ohllmmmohhlo',
  '.ohlmmmmolmmo',
  'ohllmmmmsomso',
  'oooooooooopKk',
];
// In a tunic: sitting with legs out in front.
const SEATED_TUNIC = [
  '...obbbaao....',
  '...ohllmo.....',
  '...ohllmo.....',
  '...oxxxxo.....',
  '..ohllmmo..kK.',
  '..ohlmmmpppuk.',
  '..oooooQQQQZK.',
];

/**
 * The two looks. Hand positions are where a held item's grip sits per view;
 * `arms` means the arms show (no cloak to hide them).
 */
const LOOKS = {
  cloak: { head: HOOD, body: CLOAK_BODY, seated: SEATED_CLOAK, arms: false, hand: { side: [4, -6], down: [-5, -6], up: [5, -6] } },
  tunic: { head: HAIRDO, body: TUNIC_BODY, seated: SEATED_TUNIC, arms: true, hand: { side: [3, -6], down: [-4, -6], up: [4, -6] } },
};

// ------------------------------------------------------------------ GEAR GRIDS

const SHIELD = [
  '.OOO.',
  'OwwWO',
  'OwSWO',
  'OwEdO',
  'OWddO',
  '.OOO.',
];

const PACK_SIDE = {
  basket: ['.OOO.', 'OyyyO', 'OYjYO', 'OjYjO', 'OYjYO', 'OjYjO', '.OOO.'],
  leather_pack: ['.OOO.', 'OVVvO', 'OOOOO', 'OlLLO', 'OlgJO', 'OLLJO', '.OOO.'],
};
const PACK_BACK = {
  basket: ['.OOOOO.', 'OyyyyyO', 'OYjYjYO', 'OjYjYjO', 'OYjYjYO', 'OjYjYjO', '.OOOOO.'],
  leather_pack: ['.OOOOO.', 'OVVVvvO', 'OOOOOOO', 'OlLLLJO', 'OlLgLJO', 'OLLLJJO', '.OOOOO.'],
};

const CART_SIDE = [
  '...OOOOO......',
  '..OAABCCO.....',
  '.OOOOOOOOO....',
  '.OwwwwwwwO....',
  '.OWdWWWdWOOOOO',
  '.OOOOOOOOOwwwO',
  '...OOO....OOO.',
  '..OEDEO.......',
  '..ODIDO.......',
  '..OEDEO.......',
  '...OOO........',
];
const CART_BACK = [
  '...OOOOOOO...',
  '..OAABBCCCO..',
  '.OOOOOOOOOOO.',
  '.OwwwwwwwwWO.',
  'OOWdWWWWWdWOO',
  'OEOOOOOOOOOEO',
  'ODO.......ODO',
  'OEO.......OEO',
  '.O.........O.',
];

/**
 * Held items, authored upright: head at the top, haft below. `grip` is the
 * [col, row] cell under the hand. Rotations give the swing keyframes.
 */
const ITEMS = {
  // A knobbed staff: lit face, dark edge, twine wrapped above the grip.
  walking_stick: { grip: [0, 6], rows: ['dd', 'wd', 'wd', 'Wd', 'tt', 'Wd', 'Wd', 'Wd', 'Wd', 'Wd', 'Wd', 'dd'] },
  sword: { grip: [1, 8], rows: ['.S.', '.SD', '.ED', '.ED', '.ED', '.ED', '.ED', 'GgG', '.d.', '.g.'] },
  bow: { grip: [2, 5], rows: ['.d.', 't.w', 't.w', 't.W', 't.W', 't.L', 't.W', 't.W', 't.w', 't.w', '.d.'] },
  iron_axe: { grip: [0, 6], rows: ['dES', 'wEc', 'WDE', 'W..', 'W..', 'W..', 'W..', 'd..'] },
  stone_axe: { grip: [0, 4], rows: ['tRr', 'wXr', 'W..', 'W..', 'W..', 'd..'] },
  pickaxe: { grip: [2, 5], rows: ['DEwES', 'D.W.c', '..W..', '..W..', '..W..', '..W..', '..d..'] },
  stone_hammer: { grip: [1, 4], rows: ['XRr', 'XRr', '.t.', '.W.', '.W.', '.d.'] },
  stone_knife: { grip: [0, 2], rows: ['r', 'R', 'd', 'd'] },
};

function rotateItem(item, orient) {
  const { rows } = item;
  const R = rows.length;
  const C = Math.max(...rows.map(r => r.length));
  const cell = (c, r) => rows[r][c] || '.';
  const [gc, gr] = item.grip;
  if (orient === 'up') return { rows, grip: [gc, gr] };
  if (orient === 'down') {
    const out = [];
    for (let r = R - 1; r >= 0; r--) {
      let s = '';
      for (let c = C - 1; c >= 0; c--) s += cell(c, r);
      out.push(s);
    }
    return { rows: out, grip: [C - 1 - gc, R - 1 - gr] };
  }
  const out = [];
  if (orient === 'fwd') {
    // clockwise: the head points forward
    for (let c = 0; c < C; c++) {
      let s = '';
      for (let j = 0; j < R; j++) s += cell(c, R - 1 - j);
      out.push(s);
    }
    return { rows: out, grip: [R - 1 - gr, gc] };
  }
  // 'back' — counter-clockwise: the head points behind
  for (let i = 0; i < C; i++) {
    let s = '';
    for (let j = 0; j < R; j++) s += cell(C - 1 - i, j);
    out.push(s);
  }
  return { rows: out, grip: [gr, C - 1 - gc] };
}

/** Draw `id` so its grip cell lands on (gx, gy). Returns false for unknown items. */
function drawItem(pen, id, gx, gy, orient = 'up') {
  const base = ITEMS[id];
  if (!base) return false;
  const it = rotateItem(base, orient);
  pen.grid(it.rows, gx - it.grip[0], gy - it.grip[1], GEAR);
  return true;
}

/** Stand an item upright on the ground with its grip column at x. */
function leanItem(pen, id, x) {
  const it = ITEMS[id];
  if (!it) return;
  drawItem(pen, id, x, -(it.rows.length - 1 - it.grip[1]), 'up');
}

// ------------------------------------------------------------------ EQUIPMENT

/**
 * Normalize legacy `{ weapon, shield }` or 6-slot equipment snapshots, plus the
 * permanent `cloak` flag and the player's chosen `color`.
 * `walking_stick` belongs in `hand` (mutually exclusive with sword/weapons/tools).
 */
export function normalizeEquipped(eq) {
  if (!eq) {
    return {
      head: null,
      hand: null,
      offhand: null,
      body: null,
      feet: null,
      pack: null,
      chopTool: null,
      mineTool: null,
      cloak: false,
      color: DEFAULT_COLOR,
    };
  }
  let hand = eq.hand ?? eq.weapon ?? null;
  let offhand = eq.offhand ?? eq.shield ?? null;
  if (offhand === 'walking_stick') {
    if (!hand) hand = 'walking_stick';
    offhand = null;
  }
  const chopTool = eq.chopTool ?? (hand === 'iron_axe' || hand === 'stone_axe' ? hand : null);
  const mineTool = eq.mineTool ?? (hand === 'pickaxe' || hand === 'stone_hammer' ? hand : null);
  return {
    head: eq.head || null,
    hand,
    offhand,
    body: eq.body || null,
    feet: eq.feet || null,
    pack: eq.pack || null,
    chopTool,
    mineTool,
    cloak: !!eq.cloak,
    color: eq.color || DEFAULT_COLOR,
  };
}

function bodyPalette(eq) {
  const feet = eq.feet === 'boots' ? BOOT_FEET : BARE_FEET;
  if (!eq.cloak) return { ...TUNIC, ...SKIN, ...HAIR, ...TEAL, ...TROUSERS, ...feet };
  const col = cloakColor(eq.color);
  return { ...col.cloak, ...SKIN, ...HAIR, ...col.scarf, ...TROUSERS, ...feet };
}

/** Armour and amulet layered over the body, per view. `pen` sits at the body origin. */
function drawWornSide(pen, eq, gem) {
  if (eq.body === 'hide_armor') {
    pen.grid(['NAAABBCN', 'NBNBCNCN'], -4, -8, GEAR);
    pen.put(GEAR.L, -3, -5, 6, 1);
    pen.put(GEAR.g, 1, -5);
  } else if (eq.body === 'iron_mail') {
    pen.grid(['ISEDI', 'IEDDI', '.III.'], -2, -8, GEAR);
    pen.put(GEAR.c, -1, -8);
  }
  if (eq.head === 'amulet') {
    pen.put(GEAR.g, 0, -8);
    pen.put(gem, 1, -7);
  }
}

function drawMailSkirt(pen, x0, w, y) {
  for (let i = 0; i < w; i++) pen.put(i % 2 ? GEAR.D : GEAR.E, x0 + i, y);
  pen.put(GEAR.I, x0 - 1, y);
  pen.put(GEAR.I, x0 + w, y);
}

function drawWornFront(pen, eq, gem, back = false) {
  if (eq.body === 'hide_armor') {
    pen.grid(['NAAABBBCN', 'NBNBNCNCN'], -4, -8, GEAR);
    pen.put(GEAR.L, -3, -5, 7, 1);
    if (!back) pen.put(GEAR.g, 0, -5);
  } else if (eq.body === 'iron_mail') {
    pen.grid(['ISEI', 'IEDI'], -5, -8, GEAR);
    pen.grid(['IEDI', 'IDDI'], 2, -8, GEAR);
    pen.put(GEAR.c, -4, -8);
  }
  if (eq.head === 'amulet') {
    if (back) {
      pen.put(GEAR.g, -3, -9);
      pen.put(GEAR.g, 3, -9);
    } else {
      pen.put(GEAR.g, 0, -8);
      pen.put(gem, 0, -7);
    }
  }
}

// ------------------------------------------------------------------ ENTRY

/**
 * Draw the explorer with their feet at `(x, y)` on the 1x canvas grid.
 */
export function drawPawn(ctx, x, y, facing = 1, ghost = false, anim = {}) {
  const {
    t = 0,
    dir = 'side',
    moving = false,
    legT = 0,
    walkPhase = null,
    climbing = false,
    boat = false,
    seated = false,
    action = null,
    equipped = null,
  } = anim;

  const f = facing >= 0 ? 1 : -1;
  const view = dir === 'up' || dir === 'down' ? dir : 'side';
  const eq = normalizeEquipped(equipped);
  const pal = bodyPalette(eq);
  const look = eq.cloak ? LOOKS.cloak : LOOKS.tunic;
  const gem = Math.floor(t * 4) % 3 === 0 ? GEAR.S : GEAR.c;
  x = Math.round(x);
  y = Math.round(y);

  if (boat) return drawBoatPose(ctx, x, y, f, t, moving, legT, ghost, eq, pal, look, gem);
  if (seated) return drawSeatedPose(ctx, x, y, f, t, ghost, eq, pal, look, gem);
  if (climbing) return drawClimbingPose(ctx, x, y, t, legT, ghost, eq, pal, look, gem);

  const cycle = walkPhase != null ? (((walkPhase % 1) + 1) % 1) : (((legT % 1) + 1) % 1);
  const frame = moving ? Math.floor(cycle * 4) % 4 : -1;
  // Triangle bob: up on the passing frames, down on contact.
  const bob = frame === 1 || frame === 3 ? -1 : 0;
  // Idle breath: an uneven rhythm (long hold, short dip) reads as alive, not mechanical.
  const breathe = !moving && !action && (t % 2.6) > 1.9 ? 1 : 0;

  let lunge = 0;
  let crouch = 0;
  if (action?.kind === 'attack') lunge = action.p > 0.3 && action.p < 0.75 ? 1 : 0;
  if (action?.kind === 'forage') crouch = action.p > 0.2 && action.p < 0.85 ? 2 : 1;

  if (!ghost) {
    ctx.fillStyle = SHADOW;
    ctx.fillRect(x - 4, y, 9, 1);
    ctx.fillRect(x - 3, y + 1, 7, 1);
    ctx.fillRect(x - 3, y - 1, 7, 1);
  }

  const s = {
    ctx, x, y, f, t, frame, moving, bob, breathe, crouch, lunge, action, eq, pal, look, gem,
    lift: bob + breathe + crouch,
  };
  if (view === 'down') drawDownView(s);
  else if (view === 'up') drawUpView(s);
  else drawSideView(s);
}

const legKey = frame => (frame < 0 ? 'idle' : 'w' + frame);

// ------------------------------------------------------------------ SIDE VIEW

/** The near arm in a tunic: relaxed forward at rest, swinging when walking empty-handed. */
const SIDE_ARM = {
  rest: [[1, -8], [2, -7], [3, -6]],
  swing: [
    [[1, -8], [2, -7], [3, -6]],
    [[1, -8], [1, -7], [1, -6]],
    [[0, -8], [0, -7], [-1, -6]],
    [[1, -8], [1, -7], [1, -6]],
  ],
};

function drawSideView(s) {
  const { ctx, x, y, f, t, frame, eq, pal, look, gem, action } = s;
  const feet = makePen(ctx, f, x + f * s.lunge, y);
  const body = makePen(ctx, f, x + f * s.lunge, y + s.lift);

  if (eq.pack === 'cart') drawCartSide(feet, frame);
  if (eq.pack === 'basket' || eq.pack === 'leather_pack') body.grid(PACK_SIDE[eq.pack], -8, -11, GEAR);
  if (eq.offhand === 'shield') body.grid(SHIELD, -7, -9, GEAR);

  // The scarf trails one frame behind the body's bob.
  const lagBob = frame < 0 ? s.breathe : (frame === 0 || frame === 2 ? -1 : 0);
  drawScarfTail(makePen(ctx, f, x + f * s.lunge, y + lagBob + s.crouch), pal, frame, t);

  feet.grid(SIDE_LEGS[legKey(frame)], -6, -3, pal);
  body.grid(frame === 0 || frame === 2 ? look.body.billow : look.body.side, -6, BODY_Y, pal);
  if (eq.body === 'iron_mail') drawMailSkirt(feet, -3, 6, -2 + s.crouch);
  body.grid(look.head.side, -6, HEAD_Y + (s.crouch ? 1 : 0), pal);
  drawWornSide(body, eq, gem);

  if (action) {
    drawAction(body, s, 'side');
    return;
  }
  const [hx, hy] = look.hand.side;
  const lag = frame === 1 || frame === 3 ? 1 : 0;
  if (look.arms) {
    const arm = eq.hand || frame < 0 ? SIDE_ARM.rest : SIDE_ARM.swing[frame];
    for (const [ax, ay] of arm.slice(0, -1)) body.put(pal.h, ax, ay);
    if (!eq.hand) body.put(SKIN.F, ...arm[arm.length - 1]);
  }
  if (eq.hand) holdItem(body, eq.hand, hx, hy + lag, frame);
}

/** Scarf tail from the nape: a hanging sway at rest, a streaming ribbon on the move. */
function drawScarfTail(pen, pal, frame, t) {
  const sway = Math.sin(t * 1.7) > 0.2;
  const pts = frame < 0
    ? [[-4, -9, 'b'], [-4, -8, 'c'], [-5, -8, 'b'], [sway ? -5 : -6, -7, 'c']]
    : [
      [[-4, -9, 'a'], [-4, -8, 'b'], [-5, -9, 'b'], [-5, -8, 'c'], [-6, -8, 'b'], [-7, -8, 'c']],
      [[-4, -9, 'a'], [-4, -8, 'b'], [-5, -9, 'b'], [-6, -9, 'b'], [-6, -10, 'a'], [-7, -10, 'c']],
      [[-4, -9, 'a'], [-4, -8, 'b'], [-5, -9, 'b'], [-5, -8, 'c'], [-6, -9, 'b'], [-7, -10, 'c']],
      [[-4, -9, 'a'], [-4, -8, 'b'], [-5, -8, 'b'], [-6, -8, 'b'], [-6, -9, 'a'], [-7, -9, 'c']],
    ][frame];
  for (const [dx, dy, c] of pts) pen.put(pal[c], dx, dy);
}

/** Hand at (hx, hy), the item's grip under it. The walking stick plants its foot. */
function holdItem(pen, id, hx, hy, frame = -1) {
  if (id === 'walking_stick') {
    const { rows, grip } = ITEMS.walking_stick;
    const plant = frame === 0 ? 1 : frame === 2 ? -1 : 0;
    // Above the hand, the authored staff; below it, shaft down to the ground,
    // the lower half leaning toward where the foot is planted.
    pen.grid(rows.slice(0, grip[1] + 1), hx, hy - grip[1], GEAR);
    const below = -hy - 1;
    const split = Math.ceil(below / 2);
    for (let i = 1; i <= below; i++) {
      const lean = i > split ? plant : 0;
      pen.grid([i === below ? 'dd' : 'Wd'], hx + lean, hy + i, GEAR);
    }
  } else {
    drawItem(pen, id, hx, hy, 'up');
  }
  pen.put(SKIN.F, hx, hy);
}

// ------------------------------------------------------------------ FRONT / BACK

/** Tunic arms in front and back views: sleeves at the sides, swinging out of step. */
function drawSideArms(pen, pal, frame, skip) {
  const swing = frame < 0 ? 0 : [1, 0, -1, 0][frame];
  for (const side of [-1, 1]) {
    if (side === skip) continue;
    const dy = side < 0 ? swing : -swing;
    const ax = side * 4;
    pen.put(pal.o, ax, -9 + dy);
    pen.put(pal.o, ax + side, -8 + dy, 1, 3);
    pen.put(side < 0 ? pal.l : pal.m, ax, -8 + dy, 1, 2);
    pen.put(SKIN.F, ax, -6 + dy);
  }
}

function drawDownView(s) {
  const { ctx, x, y, t, frame, eq, pal, look, gem, action } = s;
  const feet = makePen(ctx, 1, x, y + (s.lunge ? 1 : 0));
  const body = makePen(ctx, 1, x, y + s.lift + (s.lunge ? 1 : 0));

  if (eq.pack === 'cart') feet.grid(CART_SIDE.slice(1, 10).map(r => r.slice(0, 5)), -10, -9, GEAR);
  if (eq.pack === 'basket') {
    body.grid(['OyO', 'OYO', 'OjO'], -6, -10, GEAR);
    body.grid(['OyO', 'OYO', 'OjO'], 4, -10, GEAR);
  } else if (eq.pack === 'leather_pack') {
    body.grid(['OVO', 'OlO', 'OLO', 'OJO'], -6, -11, GEAR);
    body.grid(['OvO', 'OLO', 'OJO', 'OJO'], 4, -11, GEAR);
  }

  feet.grid(DOWN_LEGS[legKey(frame)], -5, -3, pal);
  body.grid(look.body.down, -5, BODY_Y, pal);
  if (eq.body === 'iron_mail') drawMailSkirt(feet, -3, 7, -2 + s.crouch);
  body.grid(look.head.down, -5, HEAD_Y + (s.crouch ? 1 : 0), pal);
  // Scarf end hangs down the chest, swinging with the stride.
  const swing = frame < 0 ? (Math.sin(t * 1.7) > 0.2 ? 0 : 1) : frame % 2;
  body.put(pal.b, -2, -8);
  body.put(pal.c, -2 - swing, -7);
  if (eq.pack === 'basket' || eq.pack === 'leather_pack') {
    const strap = eq.pack === 'basket' ? GEAR.Y : GEAR.J;
    body.put(strap, -3, -8);
    body.put(strap, 3, -8);
  }
  drawWornFront(body, eq, gem);

  // The left of the picture is the right hand: it holds the tool.
  if (look.arms) drawSideArms(body, pal, eq.hand ? -1 : frame, action ? -1 : 0);
  if (eq.offhand === 'shield') {
    const brace = action?.kind === 'attack' ? -1 : 0;
    body.grid(SHIELD, 4, -9 + brace, GEAR);
  }
  if (action) {
    drawAction(body, s, 'down');
  } else if (eq.hand) {
    const [hx, hy] = look.hand.down;
    const lag = !look.arms && (frame === 1 || frame === 3) ? 1 : 0;
    holdItem(body, eq.hand, hx, hy + lag, frame);
  }
}

function drawUpView(s) {
  const { ctx, x, y, t, frame, eq, pal, look, gem, action } = s;
  const feet = makePen(ctx, 1, x, y - (s.lunge ? 1 : 0));
  const body = makePen(ctx, 1, x, y + s.lift - (s.lunge ? 1 : 0));

  if (eq.pack === 'cart') {
    const wobble = frame === 1 || frame === 3 ? 1 : 0;
    feet.grid(CART_BACK, -6, -10 + wobble, GEAR);
  }
  if (eq.offhand === 'shield') body.grid(SHIELD, -8, -9, GEAR);
  if (eq.hand && !action) {
    const [hx, hy] = look.hand.up;
    const lag = !look.arms && (frame === 1 || frame === 3) ? 1 : 0;
    holdItem(body, eq.hand, hx, hy + lag, frame);
  }

  feet.grid(UP_LEGS[legKey(frame)], -5, -3, pal);
  body.grid(look.body.up, -5, BODY_Y, pal);
  if (eq.body === 'iron_mail') drawMailSkirt(feet, -3, 7, -2 + s.crouch);
  body.grid(look.head.up, -5, HEAD_Y + (s.crouch ? 1 : 0), pal);

  // Two scarf tails down the back, swaying out of step.
  const sw = frame < 0 ? (Math.sin(t * 1.7) > 0.2 ? 1 : 0) : frame % 2;
  body.put(pal.b, -1, -8);
  body.put(pal.a, 0, -8);
  body.put(pal.b, -1, -7);
  body.put(pal.c, -1 - sw, -6);
  body.put(pal.b, 0, -7);
  body.put(pal.c, 1, -6 + sw);

  drawWornFront(body, eq, gem, true);
  if (look.arms) drawSideArms(body, pal, eq.hand ? -1 : frame, action ? 1 : 0);
  if (eq.pack === 'basket' || eq.pack === 'leather_pack') body.grid(PACK_BACK[eq.pack], -3, -10, GEAR);

  if (action) drawAction(body, s, 'up');
}

// ------------------------------------------------------------------ ACTIONS

/**
 * Where the hand and tool sit for each swing keyframe, per view.
 * wind: raised behind; strike: smearing through; follow: settled at the bottom.
 */
const SWING = {
  side: {
    wind: { hand: [0, -15], orient: 'back' },
    strike: { hand: [5, -7], orient: 'fwd' },
    follow: { hand: [5, -5], orient: 'down' },
    arm: [[4, -7]],
    smear: [[-2, -16], [-1, -17], [0, -17], [1, -18], [2, -18], [3, -18], [4, -17], [5, -17], [6, -16], [7, -15], [7, -14], [8, -13], [8, -12], [8, -11], [8, -10], [7, -9]],
    impact: [10, -7],
  },
  down: {
    wind: { hand: [-5, -13], orient: 'up' },
    strike: { hand: [-5, -8], orient: 'down' },
    follow: { hand: [-4, -6], orient: 'down' },
    arm: [[-5, -7]],
    smear: [[-5, -18], [-6, -17], [-7, -16], [-7, -15], [-8, -14], [-8, -13], [-8, -12], [-8, -11], [-8, -10], [-7, -9], [-7, -8], [-6, -7]],
    impact: [-5, 1],
  },
  up: {
    wind: { hand: [5, -13], orient: 'up' },
    strike: { hand: [3, -11], orient: 'up' },
    follow: { hand: [3, -10], orient: 'up' },
    arm: [[5, -7]],
    smear: [[6, -17], [5, -18], [4, -19], [3, -19], [2, -19], [1, -19], [0, -18], [-1, -17]],
    impact: [1, -19],
  },
};

const CHIPS = [GEAR.w, GEAR.g];
const SPARKS = [GEAR.S, GEAR.g];
const LEAVES = ['#a7f070', '#38b764'];

function swingKey(p) {
  return p < 0.35 ? 'wind' : p < 0.62 ? 'strike' : 'follow';
}

function burst(pen, [ix, iy], cols, p) {
  if (p < 0.4 || p > 0.95) return;
  const k = Math.round((p - 0.4) * 8);
  pen.put(cols[0], ix + 1 + k, iy - 1 - (k >> 1));
  pen.put(cols[1], ix + 2 + (k >> 1), iy + 1 - k);
  if (k > 1) pen.put(cols[0], ix + k, iy - 2 - k);
}

function drawSwing(pen, s, view, id, p, particles, smear = SMEAR) {
  const S = SWING[view];
  const key = swingKey(p);
  const kf = S[key];
  if (key === 'strike') for (const [dx, dy] of S.smear) pen.put(smear, dx, dy);
  if (key !== 'wind' && view === 'side') pen.put(s.pal.l, S.arm[0][0], S.arm[0][1]);
  drawItem(pen, id, kf.hand[0], kf.hand[1], kf.orient);
  pen.put(SKIN.F, kf.hand[0], kf.hand[1]);
  if (particles) burst(pen, S.impact, particles, p);
}

function drawAction(pen, s, view) {
  const { action, eq, pal } = s;
  const p = action.p;
  const kind = action.kind;
  const S = SWING[view];

  if (kind === 'chop') {
    if (eq.chopTool) return drawSwing(pen, s, view, eq.chopTool, p, CHIPS);
    // Bare hands: shake the tree and let the leaves fall.
    const push = Math.floor(p * 6) % 2;
    const [hx, hy] = view === 'side' ? [5 + push, -8] : view === 'down' ? [-5, -9 - push] : [5, -10 - push];
    pen.put(pal.l, hx - (view === 'side' ? 1 : 0), hy + (view === 'side' ? 0 : 1));
    pen.put(SKIN.F, hx, hy);
    if (view !== 'side') pen.put(SKIN.F, -hx, hy + (push ? 1 : -1));
    const drop = Math.round(p * 5);
    const lx = view === 'side' ? 7 : view === 'down' ? -7 : 6;
    pen.put(LEAVES[0], lx, -14 + drop);
    pen.put(LEAVES[1], lx + 2, -12 + drop);
    pen.put(LEAVES[0], lx - 1, -10 + drop);
    return;
  }

  if (kind === 'mine') return drawSwing(pen, s, view, eq.mineTool || 'stone_hammer', p, SPARKS);

  if (kind === 'build') {
    // Two quick hammer taps.
    const tap = (p * 2) % 1;
    const down = tap > 0.5;
    const [hx, hy] = view === 'side' ? [5, -7] : view === 'down' ? [-5, -7] : [5, -9];
    drawItem(pen, 'stone_hammer', hx, hy, down ? (view === 'up' ? 'up' : 'fwd') : 'up');
    pen.put(SKIN.F, hx, hy);
    if (down) {
      const sx = view === 'side' ? hx + 5 : hx;
      const sy = view === 'side' ? hy + 1 : view === 'down' ? hy + 3 : hy - 5;
      pen.put(GEAR.g, sx, sy);
      pen.put(GEAR.S, sx + 1, sy - 1);
    }
    return;
  }

  if (kind === 'forage') {
    // Kneel and reach for the ground; a glint where the find comes up.
    const [hx, hy] = view === 'side' ? [5, -2] : view === 'down' ? [-5, -2] : [5, -4];
    pen.put(pal.l, hx - (view === 'side' ? 1 : 0), hy - 1);
    pen.put(SKIN.F, hx, hy);
    if (p > 0.35 && p < 0.85) {
      pen.put(GEAR.g, hx + 1, hy - 2);
      pen.put(GEAR.S, hx + 2, hy - 3);
    }
    if (eq.hand === 'walking_stick') leanItem(pen, 'walking_stick', view === 'side' ? -6 : 6);
    return;
  }

  // attack
  const hand = eq.hand;
  if (hand === 'bow') return drawBowShot(pen, s, view, p);
  if (!hand || hand === 'walking_stick') {
    // A jab: fist, or the stick thrust forward, with an impact star at full reach.
    const reach = p > 0.3 && p < 0.75 ? 2 : 0;
    const [hx, hy] = view === 'side' ? [4 + reach, -7] : view === 'down' ? [-5, -7 + reach] : [5, -9 - reach];
    if (view === 'side') pen.put(pal.l, hx - 1, hy);
    if (hand === 'walking_stick') {
      drawItem(pen, 'walking_stick', hx, hy, view === 'side' ? 'fwd' : view === 'down' ? 'down' : 'up');
    }
    pen.put(SKIN.F, hx, hy);
    if (reach) {
      const [ix, iy] = view === 'side' ? [hx + (hand ? 8 : 2), hy] : view === 'down' ? [hx, hy + (hand ? 8 : 2)] : [hx, hy - (hand ? 8 : 2)];
      pen.put(GEAR.S, ix, iy);
      pen.put(SMEAR, ix + 1, iy);
      pen.put(SMEAR, ix - 1, iy);
      pen.put(SMEAR, ix, iy - 1);
      pen.put(SMEAR, ix, iy + 1);
      pen.put(GEAR.g, ix + 1, iy - 1);
    }
    return;
  }
  // Blades and tools all swing; the sword gets a wider crescent.
  drawSwing(pen, s, view, hand, p, hand === 'sword' ? null : CHIPS, hand === 'sword' ? SMEAR : SMEAR_SOFT);
  if (hand === 'sword' && swingKey(p) === 'strike') {
    for (const [dx, dy] of S.smear) pen.put(SMEAR_SOFT, dx + (view === 'side' ? -1 : view === 'down' ? 1 : 0), dy + 1);
  }
}

function drawBowShot(pen, s, view, p) {
  const drawn = p < 0.55;
  if (view === 'side') {
    // Bow held out front, string pulled to the cheek, then the arrow flies.
    drawItem(pen, 'bow', 6, -8, 'up');
    pen.put(SKIN.F, 6, -8);
    pen.put(s.pal.l, 5, -8);
    if (drawn) {
      pen.put(SKIN.F, 3, -8);
      pen.put(GEAR.W, 3, -9, 5, 1);
      pen.put(GEAR.S, 8, -9);
    } else {
      const fly = Math.round((p - 0.55) * 22);
      pen.put(GEAR.W, 8 + fly, -9, 4, 1);
      pen.put(GEAR.S, 12 + fly, -9);
      pen.put(SMEAR_SOFT, 6 + fly, -9, 2, 1);
    }
    return;
  }
  const dirY = view === 'down' ? 1 : -1;
  const hx = view === 'down' ? -5 : 5;
  drawItem(pen, 'bow', hx, -8, 'up');
  pen.put(SKIN.F, hx, -8);
  if (drawn) {
    pen.put(GEAR.W, hx - 1, -9, 1, 4);
    pen.put(GEAR.S, hx - 1, view === 'down' ? -5 : -10);
  } else {
    const fly = Math.round((p - 0.55) * 18);
    const ay = (view === 'down' ? -4 : -12) + dirY * fly;
    pen.put(GEAR.W, hx - 1, ay, 1, 3);
    pen.put(GEAR.S, hx - 1, view === 'down' ? ay + 3 : ay - 1);
  }
}

// ------------------------------------------------------------------ CART

function drawCartSide(pen, frame) {
  pen.grid(CART_SIDE, -17, -10, GEAR);
  // Spokes turn as the cart rolls.
  const turn = frame === 1 || frame === 3;
  pen.put(turn ? GEAR.E : GEAR.D, -14, -3);
  pen.put(turn ? GEAR.D : GEAR.E, -13, -2);
  pen.put(turn ? GEAR.E : GEAR.D, -14, -1);
}

// ------------------------------------------------------------------ SEATED / CLIMBING / BOAT

function drawSeatedPose(ctx, x, y, f, t, ghost, eq, pal, look, gem) {
  const breathe = (t % 2.6) > 1.9 ? 1 : 0;
  const pen = makePen(ctx, f, x, y);
  const up = makePen(ctx, f, x, y + breathe);
  const rows = look.seated;
  const top = -rows.length + 1;

  if (!ghost) {
    ctx.fillStyle = SHADOW;
    ctx.fillRect(x - 6, y, 13, 1);
    ctx.fillRect(x - 5, y + 1, 11, 1);
  }
  if (eq.pack === 'cart') pen.at(4, 0).grid(CART_SIDE, -17, -10, GEAR);
  else if (eq.pack === 'basket' || eq.pack === 'leather_pack') pen.grid(PACK_SIDE[eq.pack], -9, -7, GEAR);
  if (eq.offhand === 'shield') pen.grid(SHIELD, -9, -6, GEAR);

  // Scarf tail pools on the ground behind.
  pen.put(pal.b, -4, top + breathe);
  pen.put(pal.c, -5, top + 1 + breathe);
  pen.put(pal.b, -5, top + 2);

  pen.grid(rows, -6, top, pal);
  up.grid(look.head.side, -6, top - 6, pal);
  drawWornSide(up.at(0, top + 9), eq, gem);
  if (eq.body === 'iron_mail') drawMailSkirt(pen, -3, 5, 0);
  if (eq.feet === 'boots') pen.put(BOOT_FEET.u, 4, look.arms ? -2 : 0);
  if (look.arms) {
    // Forearm resting on the knee.
    pen.put(pal.h, 1, top + 2);
    pen.put(pal.h, 2, top + 3);
    pen.put(SKIN.F, 3, top + 4);
  }

  if (eq.hand) {
    leanItem(pen, eq.hand, 7);
    pen.put(SKIN.F, 6, -4);
  }
}

function drawClimbingPose(ctx, x, y, t, legT, ghost, eq, pal, look, gem) {
  const step = Math.floor(legT * 6) % 2;
  const pen = makePen(ctx, 1, x, y - 1);

  // Feet on alternating rungs.
  const foot = (dx, lift) => pen.grid(['pq', 'uU', 'KK'], dx, -1 - lift, pal);
  foot(-2, step ? 2 : 0);
  foot(1, step ? 0 : 2);

  pen.grid(look.body.up, -5, BODY_Y, pal);
  if (eq.body === 'iron_mail') drawMailSkirt(pen, -3, 7, -2);
  pen.grid(look.head.up, -5, HEAD_Y, pal);
  drawWornFront(pen, eq, gem, true);

  // Item slung across the back, head over the shoulder.
  if (eq.hand) drawItem(pen, eq.hand, 3, -5, 'up');
  if (eq.offhand === 'shield') pen.grid(SHIELD, -6, -9, GEAR);
  if (eq.pack === 'basket' || eq.pack === 'leather_pack') pen.grid(PACK_BACK[eq.pack], -3, -10, GEAR);
  else if (eq.pack === 'cart') pen.grid(CART_BACK.slice(0, 5), -6, -11, GEAR);

  // Arms reaching up for the next rung.
  const arm = (dx, hy, side) => {
    const len = -9 - hy;
    pen.put(pal.o, dx, hy - 1);
    pen.put(pal.o, dx + side, hy - 1, 1, len + 2);
    pen.put(SKIN.F, dx, hy);
    pen.put(side < 0 ? pal.h : pal.m, dx, hy + 1, 1, len);
  };
  const reach = look.arms ? 4 : 5;
  arm(-reach, -13 - (step ? 0 : 2), -1);
  arm(reach, -13 - (step ? 2 : 0), 1);

  // Scarf tails flutter.
  pen.put(pal.b, -1, -8);
  pen.put(pal.c, -1 - step, -7);
}

const HULL = [
  'OOOOOOOOOOOOOOOOOO',
  'OwwwwwwwwwwwwwwwgO',
  'OWWWWWWWWWWWWWWWWO',
  '.OddddddddddddddO.',
  '..OOOOOOOOOOOOOO..',
];

function drawBoatPose(ctx, x, y, f, t, moving, legT, ghost, eq, pal, look, gem) {
  const bob = Math.sin(t * 2.4) > 0.3 ? 1 : 0;
  const by = y + bob;
  const pen = makePen(ctx, f, x, by);

  if (!ghost) {
    ctx.fillStyle = 'rgba(18, 24, 58, 0.34)';
    ctx.fillRect(x - 8, by + 2, 16, 2);
    const rip = Math.floor(t * 3) % 2;
    ctx.fillStyle = 'rgba(232, 244, 255, 0.55)';
    ctx.fillRect(x - 10 - rip, by + 2, 2, 1);
    ctx.fillRect(x + 8 + rip, by + 1, 2, 1);
  }

  if (eq.hand) leanItem(pen.at(0, -3), eq.hand, -7);
  if (eq.pack === 'basket' || eq.pack === 'leather_pack') pen.grid(PACK_SIDE[eq.pack], -8, -10, GEAR);
  else if (eq.pack === 'cart') pen.grid(['OOOO', 'OAAO', 'OwWO', 'OOOO'], -8, -8, GEAR);
  if (eq.offhand === 'shield') pen.grid(SHIELD, -7, -9, GEAR);

  // Scarf streams behind on the breeze.
  const flap = Math.floor(t * 3) % 2;
  pen.put(pal.b, -4, -6);
  pen.put(pal.b, -5, -6 - flap);
  pen.put(pal.c, -6, -6);

  pen.grid(look.body.side.slice(0, 4), -6, BODY_Y + 3, pal);
  pen.grid(look.head.side, -6, HEAD_Y + 3, pal);
  drawWornSide(pen.at(0, 3), eq, gem);

  pen.grid(HULL, -9, -3, GEAR);

  // Oar sweeping through the stroke.
  const stroke = moving ? Math.round(Math.sin(legT * Math.PI * 2) * 2) : Math.round(Math.sin(t * 1.8));
  pen.put(GEAR.W, 3 + stroke, -6, 1, 4);
  pen.put(SKIN.F, 3 + stroke, -5);
  pen.put(GEAR.w, 4 + stroke, -2, 1, 3);
  pen.put(GEAR.l, 4 + stroke, 1, 2, 1);
}
