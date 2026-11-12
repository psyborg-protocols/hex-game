// game_data.js — Hex Quest
// Every item, recipe and skill level in the game.
//
// DESIGN LAWS (see skill_map.md):
//   - Minimal archetypes. 56 items, down from 93. If two items did the same job,
//     one was cut; if an item did no job at all, it was cut. Every item left is
//     either an input, a tool, a station, or has an effect you can feel.
//   - True scarcity. Ore is hidden until Mind 3 (Lore), veins are finite, and some
//     worlds have little or none. Villages are the counterweight: a smith village
//     sells ore and ingots, a fisher village sells boats.
//   - Redundancy. Cord from reeds or from hide. Planks by axe or by saw. The river
//     by boat or by bridge. Ore by hammer or by pickaxe. A missing station can be
//     borrowed from a village that trusts you.
//   - Circularity. It takes tongs to make tongs, and a pickaxe (iron) to mine ore
//     well enough to make a pickaxe.
//   - Food is never "used". Carry it and it feeds your energy as you work.
//
// `tools` entries: an item id, or an array meaning any one of them. A tool that
//   is a structure means "stand next to one" (or at a village that has one and
//   trusts you).
// `needs` entries: 'skill:<skill>:<level>' or 'built:<item>'; nested arrays are any-of.
// `kind`: raw | material | food | tool | gear | structure.

const I = (id, name, kind, extra = {}) => ({
  id, name, kind, stack: kind === 'tool' || kind === 'gear' ? 1 : 30,
  icon: `icons/${extra.iconId || id}.svg`, ...extra,
});

export const ITEMS = {
  // ------------------------------------------------------------------ raw
  berries: I('berries', 'Berries', 'raw', { food: 1, stack: 30, desc: 'A handful of food. Found by foraging explored meadows and woods.' }),
  grain:   I('grain', 'Grain', 'raw', { food: 1, stack: 40, desc: 'Food, seed for a field, and the makings of bread and stew.' }),
  meat:    I('meat', 'Raw Meat', 'raw', { food: 2, stack: 20, desc: 'From hunting. Cook it at a hearth for far more energy.' }),
  fish:    I('fish', 'Fish', 'raw', { food: 2, stack: 20, desc: 'Caught with a rod by the water. Cook it at a hearth.' }),
  herb:    I('herb', 'Herb', 'raw', { stack: 20, desc: 'Medicine. Goes into salve, stew and shrines.' }),
  branch:  I('branch', 'Branch', 'raw', { desc: 'Hafts every early tool. Gathered from woods and meadows.' }),
  log:     I('log', 'Log', 'raw', { desc: 'Felled with an axe. Fuel, framing, and planks.' }),
  reed:    I('reed', 'Reed', 'raw', { desc: 'Cut by low water. Twisted into cord, woven into baskets and thatch.' }),
  stone:   I('stone', 'Stone', 'raw', { desc: 'Picked up below any rise, or mined out of a cliff face.' }),
  flint:   I('flint', 'Flint', 'raw', { desc: 'A sharp edge. Knives, amulets and whetstones.' }),
  clay:    I('clay', 'Clay', 'raw', { desc: 'Dug at low banks. Pots, salve, and the forge lining.' }),
  hide:    I('hide', 'Hide', 'raw', { desc: 'Skinned from game with a knife. Cord, armour and packs.' }),
  ore:     I('ore', 'Ore', 'raw', { desc: 'Only visible to someone who knows Lore (Mind 3). Smelted into ingots.' }),

  // ------------------------------------------------------------ materials
  cord:    I('cord', 'Cord', 'material', { desc: 'Binds heads to hafts. Also sets a snare (used up when hunting without a bow).' }),
  plank:   I('plank', 'Plank', 'material', { desc: 'Split from a log. Every proper wooden build needs them.' }),
  block:   I('block', 'Stone Block', 'material', { iconId: 'stone_block', desc: 'Dressed stone for walls, the forge and shrines.' }),
  ingot:   I('ingot', 'Ingot', 'material', { desc: 'Smelted metal. The great unlock.' }),

  // ----------------------------------------------------------------- food
  meal:    I('meal', 'Cooked Meal', 'food', { food: 4, stack: 20, iconId: 'cooked_meat', desc: 'Twice the energy of the raw meat it came from.' }),
  bread:   I('bread', 'Bread', 'food', { food: 4, stack: 20, desc: 'Baked from grain at a hearth. Keeps a farm fed.' }),
  stew:    I('stew', 'Stew', 'food', { food: 7, stack: 20, desc: 'Meat, grain and herb in a pot. The best food per slot.' }),
  rations: I('rations', 'Trail Rations', 'food', { food: 5, stack: 40, desc: 'Packed tight for long expeditions: stacks to 40.' }),
  salve:   I('salve', 'Salve', 'food', { heal: 5, stack: 10, desc: 'Heals 5 health. Used automatically when you are badly hurt.' }),

  // ---------------------------------------------------------------- tools
  stone_knife:  I('stone_knife', 'Flint Knife', 'tool', { attack: 1, desc: 'Skins game for hide when you hunt, cuts hide into cord.' }),
  stone_axe:    I('stone_axe', 'Stone Axe', 'tool', { attack: 2, desc: 'Fells trees for logs and splits logs into planks.' }),
  stone_hammer: I('stone_hammer', 'Stone Hammer', 'tool', { attack: 1, desc: 'Dresses stone into blocks, mines cliff faces and (slowly) ore.' }),
  fishing_rod:  I('fishing_rod', 'Fishing Rod', 'tool', { desc: 'Fish from any bank where fish are known to be.' }),
  pot:          I('pot', 'Clay Pot', 'tool', { desc: 'Needed to cook stew and mix salve.' }),
  wood_tongs:   I('wood_tongs', 'Green-wood Tongs', 'tool', { iconId: 'bone_tongs', desc: 'Hold hot metal. Enough to smelt, and to forge iron tongs.' }),
  iron_tongs:   I('iron_tongs', 'Iron Tongs', 'tool', { iconId: 'tongs', desc: 'Smelt 3 ore into 2 ingots instead of 2 into 1.' }),
  iron_axe:     I('iron_axe', 'Iron Axe', 'tool', { attack: 3, iconId: 'axe', desc: 'Fells two logs at a time. A fine weapon too.' }),
  pickaxe:      I('pickaxe', 'Pickaxe', 'tool', { attack: 2, desc: 'Mines ore three times faster than a hammer; rips cliffs down.' }),
  saw:          I('saw', 'Iron Saw', 'tool', { desc: 'Saws a log into four planks instead of two.' }),
  boat:         I('boat', 'Boat', 'tool', { desc: 'Carry it and you can row across rivers and lakes.' }),

  // ----------------------------------------------------------------- gear
  basket:       I('basket', 'Basket', 'gear', { slots: 4, desc: '+4 pack slots.' }),
  leather_pack: I('leather_pack', 'Leather Pack', 'gear', { slots: 6, desc: '+6 pack slots.' }),
  cart:         I('cart', 'Cart', 'gear', { slots: 8, desc: '+8 pack slots, and you travel roads faster.' }),
  bow:          I('bow', 'Bow', 'gear', { attack: 3, range: 2, desc: 'Hunt without spending cord, for more meat. Shoots raiders 2 hexes away.' }),
  sword:        I('sword', 'Sword', 'gear', { attack: 4, desc: 'The best weapon there is.' }),
  hide_armor:   I('hide_armor', 'Hide Armour', 'gear', { defense: 1, desc: '+1 defence die.' }),
  shield:       I('shield', 'Wooden Shield', 'gear', { defense: 1, desc: '+1 defence die.' }),
  iron_mail:    I('iron_mail', 'Iron Mail', 'gear', { defense: 2, desc: '+2 defence dice.' }),
  amulet:       I('amulet', 'Flint Amulet', 'gear', { defense: 1, desc: '+1 defence die. Also the heart of a shrine.' }),
  whetstone:    I('whetstone', 'Whetstone', 'gear', { attackBonus: 1, desc: '+1 attack die with any blade or axe.' }),
  rally_banner: I('rally_banner', 'Rally Banner', 'gear', { desc: 'Near a raider camp, every village that trusts you sends a fighter to your side.' }),
  dog:          I('dog', 'Dog', 'gear', { stack: 1, desc: 'Follows you. +1 attack die, and an extra catch when you hunt or forage.' }),

  // ----------------------------------------------------------- structures
  hearth:     I('hearth', 'Hearth', 'structure', { hp: 8, desc: 'Cook, bake and fire pots here. Rest beside it to heal. Your respawn point.' }),
  hut:        I('hut', 'Hut', 'structure', { hp: 14, iconId: 'cabin', desc: 'Home. +6 max energy, a 16-slot stash, full heal when you rest, respawn point.' }),
  workbench:  I('workbench', 'Workbench', 'structure', { hp: 8, desc: 'Bows, boats, shields and carts are made here.' }),
  field:      I('field', 'Field', 'structure', { hp: 4, desc: 'Sow grain; reap three to five times as much a day later.' }),
  palisade:   I('palisade', 'Palisade', 'structure', { hp: 10, iconId: 'wood_fence', wall: true, desc: 'A wall raiders cannot pass; they must hack through it.' }),
  stone_wall: I('stone_wall', 'Stone Wall', 'structure', { hp: 22, wall: true, desc: 'A wall twice as tough as a palisade.' }),
  watchtower: I('watchtower', 'Watchtower', 'structure', { hp: 12, desc: 'Shoots any raider within 3 hexes, and warns you of raids early.' }),
  forge:      I('forge', 'Forge', 'structure', { hp: 16, desc: 'Smelt ore into ingots and forge iron.' }),
  shrine:     I('shrine', 'Shrine', 'structure', { hp: 16, desc: 'Heals you nearby, and raiders will not ransack anything within 2 hexes.' }),
  ladder:     I('ladder', 'Ladder', 'structure', { desc: 'Climb a cliff face you could not otherwise.' }),
  bridge:     I('bridge', 'Bridge', 'structure', { desc: 'Spans water for good. Costs 3 planks for every hex it crosses.' }),
};

export const ITEM_BASE_PRICES = {
  berries: 1, grain: 1, meat: 2, fish: 2, herb: 3, branch: 1, log: 2, reed: 1,
  stone: 1, flint: 2, clay: 2, hide: 4, ore: 8,
  cord: 2, plank: 3, block: 4, ingot: 16,
  meal: 5, bread: 4, stew: 8, rations: 6, salve: 10,
  stone_knife: 6, stone_axe: 8, stone_hammer: 8, fishing_rod: 8, pot: 8,
  wood_tongs: 5, iron_tongs: 24, iron_axe: 30, pickaxe: 40, saw: 28, boat: 45,
  basket: 10, leather_pack: 25, cart: 60, bow: 22, sword: 70, hide_armor: 20,
  shield: 18, iron_mail: 80, amulet: 12, whetstone: 25, rally_banner: 30, dog: 40,
};

/** How much damage a structure takes before raiders tear it down. */
export const STRUCTURE_HP = Object.fromEntries(
  Object.values(ITEMS).filter(i => i.kind === 'structure' && i.hp).map(i => [i.id, i.hp]));

const R = (id, name, skill, level, inputs, output, extra = {}) =>
  ({ id, name, skill, level, inputs, output, xp: extra.xp ?? level * 3, ...extra });

export const RECIPES = {
  // ======================================================== STONEWORKING
  stone_knife:  R('stone_knife', 'Flint Knife', 'stoneworking', 1, { flint: 1, branch: 1 }, { stone_knife: 1 }, { xp: 4 }),
  stone_axe:    R('stone_axe', 'Stone Axe', 'stoneworking', 1, { stone: 2, branch: 1, cord: 1 }, { stone_axe: 1 }, { xp: 5 }),
  stone_hammer: R('stone_hammer', 'Stone Hammer', 'stoneworking', 1, { stone: 2, branch: 1, cord: 1 }, { stone_hammer: 1 }, { xp: 5 }),
  cut_block:    R('cut_block', 'Dress Stone Blocks', 'stoneworking', 2, { stone: 2 }, { block: 1 }, { xp: 3, tools: [['stone_hammer', 'pickaxe']] }),
  stone_wall:   R('stone_wall', 'Stone Wall', 'stoneworking', 3, { block: 3 }, { stone_wall: 1 }, { xp: 8, category: 'build', tools: [['stone_hammer', 'pickaxe']] }),
  forge:        R('forge', 'Forge', 'stoneworking', 3, { block: 6, clay: 4, log: 2 }, { forge: 1 }, { xp: 25, category: 'build', tools: [['stone_hammer', 'pickaxe']] }),
  whetstone:    R('whetstone', 'Whetstone', 'stoneworking', 4, { block: 1, flint: 2 }, { whetstone: 1 }, { xp: 12, tools: [['stone_hammer', 'pickaxe']] }),
  shrine:       R('shrine', 'Shrine', 'stoneworking', 4, { block: 4, herb: 3, amulet: 1 }, { shrine: 1 }, { xp: 20, category: 'build', tools: [['stone_hammer', 'pickaxe']], needs: ['skill:mind:3'] }),
  mason_block:  R('mason_block', 'Master Masonry', 'stoneworking', 5, { stone: 1 }, { block: 1 }, { xp: 2, tools: [['stone_hammer', 'pickaxe']] }),

  // ========================================================= WOODWORKING
  cord_reed:    R('cord_reed', 'Twist Reed Cord', 'woodworking', 1, { reed: 2 }, { cord: 2 }, { xp: 3 }),
  cord_hide:    R('cord_hide', 'Cut Hide Cord', 'woodworking', 1, { hide: 1 }, { cord: 3 }, { xp: 3, tools: ['stone_knife'] }),
  basket:       R('basket', 'Basket', 'woodworking', 1, { reed: 4, branch: 2 }, { basket: 1 }, { xp: 6 }),
  fishing_rod:  R('fishing_rod', 'Fishing Rod', 'woodworking', 1, { branch: 2, cord: 1 }, { fishing_rod: 1 }, { xp: 5 }),
  split_planks: R('split_planks', 'Split Planks', 'woodworking', 2, { log: 1 }, { plank: 2 }, { xp: 4, tools: [['stone_axe', 'iron_axe']] }),
  saw_planks:   R('saw_planks', 'Saw Planks', 'woodworking', 2, { log: 1 }, { plank: 4 }, { xp: 5, tools: ['saw'] }),
  palisade:     R('palisade', 'Palisade', 'woodworking', 2, { log: 3 }, { palisade: 1 }, { xp: 6, category: 'build' }),
  workbench:    R('workbench', 'Workbench', 'woodworking', 2, { log: 2, plank: 4 }, { workbench: 1 }, { xp: 10, category: 'build', tools: [['stone_axe', 'iron_axe']] }),
  ladder:       R('ladder', 'Ladder', 'woodworking', 3, { plank: 3, cord: 2 }, { ladder: 1 }, { xp: 8, category: 'build' }),
  bow:          R('bow', 'Bow', 'woodworking', 3, { plank: 2, cord: 2 }, { bow: 1 }, { xp: 10, tools: ['workbench'] }),
  shield:       R('shield', 'Wooden Shield', 'woodworking', 3, { plank: 4, hide: 1 }, { shield: 1 }, { xp: 10, tools: ['workbench'] }),
  boat:         R('boat', 'Boat', 'woodworking', 4, { plank: 6, log: 2, cord: 2 }, { boat: 1 }, { xp: 20, tools: ['workbench'] }),
  watchtower:   R('watchtower', 'Watchtower', 'woodworking', 4, { log: 4, plank: 4, cord: 2 }, { watchtower: 1 }, { xp: 16, category: 'build' }),
  bridge:       R('bridge', 'Bridge', 'woodworking', 5, { log: 2 }, { bridge: 1 }, { xp: 25, category: 'build', perSpan: { plank: 3 } }),
  cart:         R('cart', 'Cart', 'woodworking', 5, { plank: 8, log: 2, ingot: 1 }, { cart: 1 }, { xp: 20, tools: ['workbench'] }),

  // ======================================================== HOMESTEADING
  hearth:       R('hearth', 'Hearth', 'homesteading', 1, { stone: 4, log: 2 }, { hearth: 1 }, { xp: 10, category: 'build' }),
  cook_meat:    R('cook_meat', 'Cook Meat', 'homesteading', 1, { meat: 1 }, { meal: 1 }, { xp: 2, tools: ['hearth'] }),
  cook_fish:    R('cook_fish', 'Cook Fish', 'homesteading', 1, { fish: 1 }, { meal: 1 }, { xp: 2, tools: ['hearth'] }),
  field:        R('field', 'Sow a Field', 'homesteading', 2, { grain: 2 }, { field: 1 }, { xp: 6, category: 'build' }),
  bread:        R('bread', 'Bake Bread', 'homesteading', 2, { grain: 3 }, { bread: 2 }, { xp: 4, tools: ['hearth'] }),
  pot:          R('pot', 'Fire a Clay Pot', 'homesteading', 2, { clay: 3 }, { pot: 1 }, { xp: 6, tools: ['hearth'] }),
  hut:          R('hut', 'Hut', 'homesteading', 3, { log: 6, plank: 4, reed: 4 }, { hut: 1 }, { xp: 20, category: 'build' }),
  stew:         R('stew', 'Stew', 'homesteading', 3, { meat: 1, grain: 1, herb: 1 }, { stew: 2 }, { xp: 6, tools: ['pot', 'hearth'] }),
  fish_stew:    R('fish_stew', 'Fish Stew', 'homesteading', 3, { fish: 1, grain: 1, herb: 1 }, { stew: 2 }, { xp: 6, tools: ['pot', 'hearth'] }),
  hide_armor:   R('hide_armor', 'Hide Armour', 'homesteading', 3, { hide: 3, cord: 2 }, { hide_armor: 1 }, { xp: 10, tools: ['stone_knife'] }),
  leather_pack: R('leather_pack', 'Leather Pack', 'homesteading', 4, { hide: 4, cord: 2 }, { leather_pack: 1 }, { xp: 12, tools: ['stone_knife'] }),
  tame_dog:     R('tame_dog', 'Tame a Dog', 'homesteading', 4, { meal: 3 }, { dog: 1 }, { xp: 15, tools: ['hut'], needs: ['skill:mind:2'] }),
  rations:      R('rations', 'Pack Trail Rations', 'homesteading', 5, { bread: 1, meal: 1 }, { rations: 3 }, { xp: 5, tools: ['hearth'] }),

  // ======================================================== METALWORKING
  wood_tongs:   R('wood_tongs', 'Green-wood Tongs', 'metalworking', 1, { branch: 3, cord: 1 }, { wood_tongs: 1 }, { xp: 4 }),
  smelt:        R('smelt', 'Smelt Ingot', 'metalworking', 1, { ore: 2, log: 1 }, { ingot: 1 }, { xp: 8, tools: ['forge', ['wood_tongs', 'iron_tongs']] }),
  smelt_fine:   R('smelt_fine', 'Smelt Ingots (iron tongs)', 'metalworking', 3, { ore: 3, log: 1 }, { ingot: 2 }, { xp: 10, tools: ['forge', 'iron_tongs'] }),
  iron_axe:     R('iron_axe', 'Iron Axe', 'metalworking', 2, { ingot: 1, plank: 1 }, { iron_axe: 1 }, { xp: 10, tools: ['forge', ['wood_tongs', 'iron_tongs']] }),
  pickaxe:      R('pickaxe', 'Pickaxe', 'metalworking', 2, { ingot: 2, plank: 1 }, { pickaxe: 1 }, { xp: 12, tools: ['forge', ['wood_tongs', 'iron_tongs']] }),
  iron_tongs:   R('iron_tongs', 'Iron Tongs', 'metalworking', 3, { ingot: 1 }, { iron_tongs: 1 }, { xp: 10, tools: ['forge', ['wood_tongs', 'iron_tongs']] }),
  saw:          R('saw', 'Iron Saw', 'metalworking', 3, { ingot: 1, plank: 1 }, { saw: 1 }, { xp: 10, tools: ['forge', ['wood_tongs', 'iron_tongs']] }),
  sword:        R('sword', 'Sword', 'metalworking', 4, { ingot: 3, plank: 1 }, { sword: 1 }, { xp: 18, tools: ['forge', 'iron_tongs'] }),
  iron_mail:    R('iron_mail', 'Iron Mail', 'metalworking', 4, { ingot: 4, hide: 2 }, { iron_mail: 1 }, { xp: 20, tools: ['forge', 'iron_tongs'] }),

  // ================================================================ MIND
  amulet:       R('amulet', 'Flint Amulet', 'mind', 1, { flint: 1, cord: 1 }, { amulet: 1 }, { xp: 0 }),
  salve:        R('salve', 'Mix Salve', 'mind', 2, { herb: 2, clay: 1 }, { salve: 2 }, { xp: 0, tools: ['pot'] }),
  rally_banner: R('rally_banner', 'Rally Banner', 'mind', 5, { hide: 2, plank: 2, cord: 2 }, { rally_banner: 1 }, { xp: 0, tools: ['workbench'] }),
};

/** One line per level: what reaching it opens up. */
export const SKILL_INFO = {
  stoneworking: {
    1: ['Flint Knife, Stone Axe, Stone Hammer.', 'Gather stone and flint; mine cliff faces with a hammer.'],
    2: ['Dress stone into blocks.'],
    3: ['Stone Walls.', 'The Forge (needs clay and logs too).'],
    4: ['Whetstone: +1 attack die.', 'Shrine (with Mind 3): a sanctuary raiders will not touch.'],
    5: ['Master Masonry: one stone makes one block.'],
  },
  woodworking: {
    1: ['Twist cord from reeds, or cut it from hide.', 'Basket (+4 slots), Fishing Rod.'],
    2: ['Split planks.', 'Palisade walls, and the Workbench.'],
    3: ['Ladders to climb cliffs.', 'Bow and Wooden Shield (at a workbench).'],
    4: ['Boat: row across water.', 'Watchtower: shoots raiders, warns of raids.'],
    5: ['Bridge across the river.', 'Cart: +8 slots and fast roads.'],
  },
  homesteading: {
    1: ['Hearth: cook, rest, respawn.', 'Cook meat and fish into meals.'],
    2: ['Sow fields, bake bread, fire clay pots.'],
    3: ['Hut: home, stash, more energy.', 'Stew, and Hide Armour.'],
    4: ['Leather Pack (+6 slots).', 'Tame a Dog (with Mind 2).'],
    5: ['Trail Rations: dense food for long trips.'],
  },
  metalworking: {
    1: ['Green-wood tongs. Smelt ore into ingots at a forge.'],
    2: ['Iron Axe and Pickaxe.'],
    3: ['Iron Tongs (it takes tongs to make tongs): richer smelting.', 'Iron Saw: four planks a log.'],
    4: ['Sword and Iron Mail.'],
    5: ['Master Smith: every smelt gives one ingot more.'],
  },
  mind: {
    1: ['Mind grows by going places: scenic finds, villages, the wild.', 'Find herbs. Flint Amulet (+1 defence).'],
    2: ['Salve heals 5 (needs a pot).', 'Dogs will trust you.'],
    3: ['LORE: read the rock. Ore shows itself, and you can prospect.', 'Shrines (with Stoneworking 4).'],
    4: ['Wayfinding: every village you trust reveals twice as much land.'],
    5: ['Rally Banner: villages that trust you fight beside you at raider camps.'],
  },
};

/**
 * Village specialties. Each village is one of these: what it sells cheap, the
 * station it lends once it trusts you, and the favour it asks first.
 */
export const VILLAGE_KINDS = {
  farmers:    { name: 'Farmers',    sells: ['grain', 'bread', 'meal', 'pot'], station: 'hearth',
                favours: [{ item: 'berries', qty: 5 }, { item: 'meal', qty: 2 }] },
  woodcutters:{ name: 'Woodcutters', sells: ['log', 'plank', 'cord', 'bow'], station: 'workbench',
                favours: [{ item: 'branch', qty: 6 }, { item: 'log', qty: 3 }] },
  masons:     { name: 'Masons',     sells: ['stone', 'block', 'stone_hammer', 'clay'], station: 'workbench',
                favours: [{ item: 'stone', qty: 6 }, { item: 'block', qty: 2 }] },
  fishers:    { name: 'Fishers',    sells: ['fish', 'reed', 'fishing_rod', 'boat'], station: 'hearth',
                favours: [{ item: 'reed', qty: 6 }, { item: 'fish', qty: 3 }] },
  herbalists: { name: 'Herbalists', sells: ['herb', 'salve', 'amulet', 'clay'], station: 'hearth',
                favours: [{ item: 'herb', qty: 2 }, { item: 'hide', qty: 2 }] },
  smiths:     { name: 'Smiths',     sells: ['ore', 'ingot', 'wood_tongs', 'pickaxe'], station: 'forge',
                favours: [{ item: 'log', qty: 4 }, { item: 'stone', qty: 8 }] },
};
