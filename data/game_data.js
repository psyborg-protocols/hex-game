// game_data.js
// Full items, prices, recipes, skills and dependency map for the hex world game.
//
// DESIGN LAWS (see research/discovery_paths.md):
//   - Two root skills (stoneworking, woodworking) + one knowledge gate (mind -> ore).
//   - Every frontier (L5+) recipe crosses at least one other skill.
//   - Scarcity: ore only exists where Mind (Lore) has revealed it; some worlds have none.
//   - Redundancy: every frontier node has >=1 alternate route (axe|knife beams,
//     bridge|boat, 3 adze tiers, stone|metal hammers/tongs/anvils).
//   - Cycles: bone_tongs -> tongs -> fine_tongs; hammer -> hammer; whetstone (stone)
//     upgrades metal; metal chisel carves finer whetstones.
//   - Tiers are material tiers (primitive -> ingot -> refined ingot), counts vary
//     per item per research: tongs x3, adze x3, oven x5, hammers/axes/knives x2.
//
// `tools` entries: an entry is either an item id (required) or an array of item ids
// (ANY one of them satisfies the slot).
// `needs` entries: 'skill:<skill>:<level>' or 'built:<item>' (must exist in world).
// `category`: 'build' | 'tool' | 'food' | 'good' | undefined (plain item).

export const ITEMS = {
  // ---------- GATHERED ----------
  berries:   { id: 'berries',   name: 'Berries',   stack: 20, icon: 'icons/berries.svg',   food: 1 },
  seeds:     { id: 'seeds',     name: 'Seeds',     stack: 50, icon: 'icons/seeds.svg',     food: 1 },
  grain:     { id: 'grain',     name: 'Grain',     stack: 50, icon: 'icons/grain.svg',     food: 1 },
  rabbit:    { id: 'rabbit',    name: 'Rabbit',    stack: 10, icon: 'icons/rabbit.svg',    food: 2 },
  fish:      { id: 'fish',      name: 'Fish',      stack: 10, icon: 'icons/fish.svg',      food: 2 },
  herb:      { id: 'herb',      name: 'Herb',      stack: 20, icon: 'icons/herb.svg' },
  branch:    { id: 'branch',    name: 'Branch',    stack: 99, icon: 'icons/branch.svg' },
  reed:      { id: 'reed',      name: 'Reed',      stack: 99, icon: 'icons/reed.svg' },
  rough_log: { id: 'rough_log', name: 'Rough Log', stack: 99, icon: 'icons/rough_log.svg' },
  log:       { id: 'log',       name: 'Log',       stack: 99, icon: 'icons/log.svg' },
  beam:      { id: 'beam',      name: 'Beam',      stack: 99, icon: 'icons/beam.svg' },
  plank:     { id: 'plank',     name: 'Plank',     stack: 99, icon: 'icons/plank.svg' },
  cord:      { id: 'cord',      name: 'Cord',      stack: 99, icon: 'icons/cord.svg' },
  flint:     { id: 'flint',     name: 'Flint',     stack: 99, icon: 'icons/flint.svg' },
  stone:     { id: 'stone',     name: 'Stone',     stack: 99, icon: 'icons/stone.svg' },
  stone_block: { id: 'stone_block', name: 'Stone Block', stack: 99, icon: 'icons/stone_block.svg' },
  clay:      { id: 'clay',      name: 'Clay',      stack: 99, icon: 'icons/clay.svg' },
  bone:      { id: 'bone',      name: 'Bone',      stack: 99, icon: 'icons/bone.svg' },
  hide:      { id: 'hide',      name: 'Hide',      stack: 99, icon: 'icons/hide.svg' },
  sinew:     { id: 'sinew',     name: 'Sinew',     stack: 99, icon: 'icons/sinew.svg' },
  ore:       { id: 'ore',       name: 'Ore',       stack: 99, icon: 'icons/ore.svg' },
  ingot:     { id: 'ingot',     name: 'Ingot',     stack: 99, icon: 'icons/ingot.svg' },
  brick:     { id: 'brick',     name: 'Brick',     stack: 99, icon: 'icons/brick.svg' },

  // ---------- FOOD (crafted) ----------
  cooked_meat: { id: 'cooked_meat', name: 'Cooked Meat', stack: 20, icon: 'icons/cooked_meat.svg', food: 4 },
  stew:        { id: 'stew',        name: 'Stew',        stack: 20, icon: 'icons/stew.svg',        food: 5 },
  bread:       { id: 'bread',       name: 'Bread',       stack: 20, icon: 'icons/bread.svg',       food: 3 },
  smoked_meat: { id: 'smoked_meat', name: 'Smoked Meat', stack: 40, icon: 'icons/smoked_meat.svg', food: 3 },

  // ---------- WOODWORKING GOODS ----------
  basket:       { id: 'basket',       name: 'Basket',       stack: 5,  icon: 'icons/basket.svg' },
  chair:        { id: 'chair',        name: 'Chair',        stack: 99, icon: 'icons/chair.svg' },
  table:        { id: 'table',        name: 'Table',        stack: 99, icon: 'icons/table.svg' },
  chest:        { id: 'chest',        name: 'Chest',        stack: 99, icon: 'icons/chest.svg' },
  cabin:        { id: 'cabin',        name: 'Log Cabin',    stack: 1,  icon: 'icons/cabin.svg' },
  stone_house:  { id: 'stone_house',  name: 'Stone House',  stack: 1,  icon: 'icons/stone_house.svg' },
  wood_fence:   { id: 'wood_fence',   name: 'Wood Fence',   stack: 99, icon: 'icons/wood_fence.svg' },
  ladder:       { id: 'ladder',       name: 'Ladder',       stack: 99, icon: 'icons/ladder.svg' },
  bridge:       { id: 'bridge',       name: 'Bridge',       stack: 1,  icon: 'icons/bridge.svg' },
  boat:         { id: 'boat',         name: 'Boat',         stack: 1,  icon: 'icons/boat.svg' },
  cart:         { id: 'cart',         name: 'Cart',         stack: 1,  icon: 'icons/cart.svg' },
  fishing_rod:  { id: 'fishing_rod',  name: 'Fishing Rod',  stack: 1,  icon: 'icons/fishing_rod.svg' },
  bow:          { id: 'bow',          name: 'Bow',          stack: 1,  icon: 'icons/bow.svg' },
  arrow:        { id: 'arrow',        name: 'Arrow',        stack: 20, icon: 'icons/arrow.svg' },
  fine_arrow:   { id: 'fine_arrow',   name: 'Ingot Arrow',  stack: 20, icon: 'icons/fine_arrow.svg' },
  bone_saw:     { id: 'bone_saw',     name: 'Bone Saw',     stack: 1,  icon: 'icons/bone_saw.svg' },

  // ---------- STONE GOODS ----------
  stone_hammer:  { id: 'stone_hammer',  name: 'Stone Hammer',  stack: 1, icon: 'icons/stone_hammer.svg' },
  stone_axe:     { id: 'stone_axe',     name: 'Stone Axe',     stack: 1, icon: 'icons/stone_axe.svg' },
  stone_chisel:  { id: 'stone_chisel',  name: 'Stone Chisel',  stack: 1, icon: 'icons/stone_chisel.svg' },
  stone_adze:    { id: 'stone_adze',    name: 'Stone Adze',    stack: 1, icon: 'icons/stone_adze.svg' },
  quern:         { id: 'quern',         name: 'Quern',         stack: 1, icon: 'icons/quern.svg' },
  grindstone:    { id: 'grindstone',    name: 'Grindstone',    stack: 1, icon: 'icons/grindstone.svg' },
  whetstone:     { id: 'whetstone',     name: 'Whetstone',     stack: 1, icon: 'icons/whetstone.svg' },
  stone_anvil:   { id: 'stone_anvil',   name: 'Stone Anvil',   stack: 1, icon: 'icons/stone_anvil.svg' },
  rock_wall:     { id: 'rock_wall',     name: 'Rock Wall',     stack: 99, icon: 'icons/rock_wall.svg' },
  stone_wall:    { id: 'stone_wall',    name: 'Stone Wall',    stack: 99, icon: 'icons/stone_wall.svg' },
  forge:         { id: 'forge',         name: 'Forge',         stack: 1, icon: 'icons/forge.svg' },
  quarry:        { id: 'quarry',        name: 'Quarry',        stack: 1, icon: 'icons/quarry.svg' },

  // ---------- OVEN TIERS (5) + POTTERY ----------
  hearth:      { id: 'hearth',      name: 'Hearth',      stack: 1, icon: 'icons/hearth.svg' },
  stone_oven:  { id: 'stone_oven',  name: 'Stone Oven',  stack: 1, icon: 'icons/stone_oven.svg' },
  clay_oven:   { id: 'clay_oven',   name: 'Clay Oven',   stack: 1, icon: 'icons/clay_oven.svg' },
  kiln:        { id: 'kiln',        name: 'Kiln',        stack: 1, icon: 'icons/kiln.svg' },
  bakehouse:   { id: 'bakehouse',   name: 'Bakehouse',   stack: 1, icon: 'icons/bakehouse.svg' },
  pot:         { id: 'pot',         name: 'Clay Pot',    stack: 1, icon: 'icons/pot.svg' },
  fine_pot:    { id: 'fine_pot',    name: 'Kiln Pot',    stack: 1, icon: 'icons/fine_pot.svg' },

  // ---------- HOMESTEADING ----------
  field:         { id: 'field',         name: 'Field',         stack: 9, icon: 'icons/field.svg' },
  wood_hoe:      { id: 'wood_hoe',      name: 'Wood Hoe',      stack: 1, icon: 'icons/wood_hoe.svg' },
  wood_plough:   { id: 'wood_plough',   name: 'Wood Plough',   stack: 1, icon: 'icons/wood_plough.svg' },
  plough:        { id: 'plough',        name: 'Ingot Plough',  stack: 1, icon: 'icons/plough.svg' },
  smokehouse:    { id: 'smokehouse',    name: 'Smokehouse',    stack: 1, icon: 'icons/smokehouse.svg' },
  granary:       { id: 'granary',       name: 'Granary',       stack: 1, icon: 'icons/granary.svg' },
  well:          { id: 'well',          name: 'Well',          stack: 1, icon: 'icons/well.svg' },
  market_stall:  { id: 'market_stall',  name: 'Market Stall',  stack: 1, icon: 'icons/market_stall.svg' },
  dog:           { id: 'dog',           name: 'Dog',           stack: 1, icon: 'icons/dog.svg' },

  // ---------- METAL GOODS ----------
  knife:      { id: 'knife',      name: 'Ingot Knife',  stack: 1, icon: 'icons/knife.svg' },
  saw:        { id: 'saw',        name: 'Ingot Saw',    stack: 1, icon: 'icons/saw.svg' },
  axe:        { id: 'axe',        name: 'Ingot Axe',    stack: 1, icon: 'icons/axe.svg' },
  pickaxe:    { id: 'pickaxe',    name: 'Pickaxe',      stack: 1, icon: 'icons/pickaxe.svg' },
  hoe:        { id: 'hoe',        name: 'Ingot Hoe',    stack: 1, icon: 'icons/hoe.svg' },
  hammer:     { id: 'hammer',     name: 'Ingot Hammer', stack: 1, icon: 'icons/hammer.svg' },
  chisel:     { id: 'chisel',     name: 'Ingot Chisel', stack: 1, icon: 'icons/chisel.svg' },
  bone_adze:  { id: 'bone_adze',  name: 'Bone Adze',    stack: 1, icon: 'icons/bone_adze.svg' },
  adze:       { id: 'adze',       name: 'Ingot Adze',   stack: 1, icon: 'icons/adze.svg' },
  bone_tongs: { id: 'bone_tongs', name: 'Bone Tongs',   stack: 1, icon: 'icons/bone_tongs.svg' },
  tongs:      { id: 'tongs',      name: 'Ingot Tongs',  stack: 1, icon: 'icons/tongs.svg' },
  fine_tongs: { id: 'fine_tongs', name: 'Refined Tongs',stack: 1, icon: 'icons/fine_tongs.svg' },
  anvil:      { id: 'anvil',      name: 'Ingot Anvil',  stack: 1, icon: 'icons/anvil.svg' },
  bellows:    { id: 'bellows',    name: 'Bellows',      stack: 1, icon: 'icons/bellows.svg' },
  sword:      { id: 'sword',      name: 'Sword',        stack: 1, icon: 'icons/sword.svg' },

  // ---------- MIND ----------
  amulet:   { id: 'amulet',   name: 'Amulet',   stack: 1, icon: 'icons/amulet.svg' },
  drum:     { id: 'drum',     name: 'Drum',     stack: 1, icon: 'icons/drum.svg' },
  journal:  { id: 'journal',  name: 'Journal',  stack: 1, icon: 'icons/journal.svg' },
  salve:    { id: 'salve',    name: 'Salve',    stack: 10, icon: 'icons/salve.svg' },
  totem:    { id: 'totem',    name: 'Totem',    stack: 1, icon: 'icons/totem.svg' },
  shrine:   { id: 'shrine',   name: 'Shrine',   stack: 1, icon: 'icons/shrine.svg' },
  oracle:   { id: 'oracle',   name: 'Oracle',   stack: 1, icon: 'icons/oracle.svg' },
};

export const ITEM_BASE_PRICES = {
  // gathered
  berries: 1, seeds: 0.5, grain: 1, rabbit: 2, fish: 2, herb: 3,
  branch: 0.5, reed: 0.5, rough_log: 1, log: 2, beam: 3, plank: 3, cord: 1,
  flint: 2, stone: 1, stone_block: 3, clay: 1, bone: 2, hide: 3, sinew: 1,
  ore: 6, ingot: 12, brick: 4,
  // food
  cooked_meat: 4, stew: 6, bread: 2, smoked_meat: 4,
  // wood
  basket: 4, chair: 5, table: 6, chest: 8, cabin: 25, stone_house: 45,
  wood_fence: 6, ladder: 8, bridge: 14, boat: 22, cart: 30,
  fishing_rod: 10, bow: 18, arrow: 2, fine_arrow: 4,
  // stone
  stone_hammer: 6, stone_axe: 10, stone_chisel: 8, stone_adze: 12,
  quern: 15, grindstone: 25, whetstone: 30, stone_anvil: 20,
  rock_wall: 5, stone_wall: 10, forge: 60, quarry: 80,
  // ovens
  hearth: 6, stone_oven: 18, clay_oven: 30, kiln: 60, bakehouse: 90,
  pot: 8, fine_pot: 16,
  // homesteading
  field: 8, wood_hoe: 6, wood_plough: 15, plough: 35, smokehouse: 20,
  granary: 30, well: 25, market_stall: 40, dog: 50,
  // metal
  knife: 12, saw: 15, axe: 20, pickaxe: 25, hoe: 12, hammer: 24, chisel: 12, adze: 24,
  bone_adze: 10, bone_saw: 8, bone_tongs: 6, tongs: 22, fine_tongs: 40,
  anvil: 55, bellows: 18, sword: 50,
  // mind
  amulet: 8, drum: 14, journal: 10, salve: 12, totem: 70, shrine: 40, oracle: 120,
};

export const RECIPES = {
  // ============================================================ WOODWORKING
  // L1
  gather_branch: { id: 'gather_branch', name: 'Gather Branches', inputs: {}, output: { branch: 2 }, skill: 'woodworking', level: 1, xp: 1, gather: true },
  craft_cord:    { id: 'craft_cord',    name: 'Twine Cord',      inputs: { reed: 2 }, output: { cord: 2 }, skill: 'woodworking', level: 1, xp: 3 },
  basket:        { id: 'basket',        name: 'Basket',          inputs: { branch: 3, reed: 2 }, output: { basket: 1 }, skill: 'woodworking', level: 1, xp: 5 },
  // L2
  chop_rough_log: { id: 'chop_rough_log', name: 'Chop Rough Log', inputs: {}, output: { rough_log: 1 }, skill: 'woodworking', level: 2, xp: 3, tools: [ ['stone_axe', 'axe', 'bone_adze'] ], gather: true },
  work_log:       { id: 'work_log',       name: 'Work Logs',      inputs: { rough_log: 1 }, output: { log: 1 }, skill: 'woodworking', level: 2, xp: 3, tools: [ ['stone_axe', 'axe'] ] },
  beams_whittle:  { id: 'beams_whittle',  name: 'Whittle Beams',  inputs: { branch: 2 }, output: { beam: 1 }, skill: 'woodworking', level: 2, xp: 2, tools: [ ['stone_chisel', 'chisel', 'knife'] ] },
  // L3  (the container/cordage ladder unlocks craft)
  bone_adze:  { id: 'bone_adze',  name: 'Bone Adze',   inputs: { bone: 2, branch: 1, sinew: 2 }, output: { bone_adze: 1 }, skill: 'woodworking', level: 3, xp: 10, tools: [ ['stone_axe', 'axe'] ] },
  bone_saw:   { id: 'bone_saw',   name: 'Bone Saw',    inputs: { bone: 2, cord: 2, branch: 1 }, output: { bone_saw: 1 }, skill: 'woodworking', level: 3, xp: 10, tools: [ ['stone_chisel', 'chisel'] ] },
  planks:     { id: 'planks',     name: 'Saw Planks',  inputs: { log: 1 }, output: { plank: 2 }, skill: 'woodworking', level: 3, xp: 6, tools: [ [ 'bone_saw', 'saw' ] ] }, // either saw; as two slots this needed metalworking 3 and locked planks out of a stone-age world
  arrow:      { id: 'arrow',      name: 'Arrow',       inputs: { branch: 1, flint: 1, sinew: 1 }, output: { arrow: 2 }, skill: 'woodworking', level: 3, xp: 5, tools: [ ['stone_chisel', 'chisel'] ] },
  // L4
  wood_fence:  { id: 'wood_fence',  name: 'Wood Fence',   inputs: { beam: 4 }, output: { wood_fence: 1 }, skill: 'woodworking', level: 4, xp: 6, category: 'build' },
  ladder:      { id: 'ladder',      name: 'Ladder',       inputs: { beam: 5, cord: 2 }, output: { ladder: 1 }, skill: 'woodworking', level: 4, xp: 10, category: 'build', tools: [ ['stone_axe', 'axe'] ] },
  fishing_rod: { id: 'fishing_rod', name: 'Fishing Rod',  inputs: { branch: 2, cord: 1, sinew: 1 }, output: { fishing_rod: 1 }, skill: 'woodworking', level: 4, xp: 8, tools: [ ['stone_chisel', 'chisel'] ] },
  chair:       { id: 'chair',       name: 'Chair',        inputs: { plank: 3, beam: 1, cord: 1 }, output: { chair: 1 }, skill: 'woodworking', level: 4, xp: 6, category: 'build', tools: [ ['stone_axe', 'axe'] ] },
  // L5
  cabin: { id: 'cabin', name: 'Log Cabin', inputs: { log: 10, beam: 4, plank: 6 }, output: { cabin: 1 }, skill: 'woodworking', level: 5, xp: 25, category: 'build', tools: [ ['stone_hammer', 'hammer'], ['stone_axe', 'axe'] ] },
  table: { id: 'table', name: 'Table', inputs: { plank: 4, beam: 2, cord: 1 }, output: { table: 1 }, skill: 'woodworking', level: 5, xp: 8, category: 'build', tools: [ ['stone_hammer', 'hammer'] ] },
  boat:  { id: 'boat',  name: 'Boat', inputs: { log: 4, plank: 6 }, output: { boat: 1 }, skill: 'woodworking', level: 5, xp: 30, category: 'build', tools: [ ['bone_adze', 'stone_adze', 'adze'], ['stone_axe', 'axe'] ], needs: ['built:hearth'] }, // hollowing is long work; needs a home base
  // L6
  bridge: { id: 'bridge', name: 'Bridge', inputs: { log: 4, plank: 6, beam: 2 }, output: { bridge: 1 }, skill: 'woodworking', level: 6, xp: 20, category: 'build', tools: [ ['stone_hammer', 'hammer'] ] },
  chest:  { id: 'chest',  name: 'Chest',  inputs: { plank: 6, cord: 2 }, output: { chest: 1 }, skill: 'woodworking', level: 6, xp: 12, category: 'build', tools: [ ['stone_axe', 'axe'] ] },
  cart:   { id: 'cart',   name: 'Cart',   inputs: { plank: 8, beam: 4, cord: 3 }, output: { cart: 1 }, skill: 'woodworking', level: 6, xp: 25, category: 'build', tools: [ ['bone_adze', 'stone_adze', 'adze'], ['stone_hammer', 'hammer'] ] },
  // L7
  bow: { id: 'bow', name: 'Bow', inputs: { beam: 1, sinew: 3 }, output: { bow: 1 }, skill: 'woodworking', level: 7, xp: 15, tools: [ ['stone_chisel', 'chisel', 'knife'] ], needs: ['skill:woodworking:6'] },

  // ============================================================ STONEWORKING
  // L1
  gather_stone:   { id: 'gather_stone',   name: 'Quarry Stone',   inputs: {}, output: { stone: 2 }, skill: 'stoneworking', level: 1, xp: 1, gather: true },
  gather_flint:   { id: 'gather_flint',   name: 'Pick Flint',     inputs: {}, output: { flint: 1 }, skill: 'stoneworking', level: 1, xp: 2, gather: true },
  stone_hammer:   { id: 'stone_hammer',   name: 'Stone Hammer',   inputs: { stone: 2, branch: 1, sinew: 1 }, output: { stone_hammer: 1 }, skill: 'stoneworking', level: 1, xp: 6, category: 'tool' },
  stone_chisel:   { id: 'stone_chisel',   name: 'Stone Chisel',   inputs: { stone: 2, branch: 1, sinew: 1 }, output: { stone_chisel: 1 }, skill: 'stoneworking', level: 1, xp: 6, category: 'tool' },
  // L2
  stone_axe:   { id: 'stone_axe',   name: 'Stone Axe',   inputs: { stone: 2, branch: 1, sinew: 2 }, output: { stone_axe: 1 }, skill: 'stoneworking', level: 2, xp: 10, category: 'tool', tools: [ 'stone_hammer' ] },
  rock_wall:   { id: 'rock_wall',   name: 'Rock Wall',   inputs: { stone: 4 }, output: { rock_wall: 1 }, skill: 'stoneworking', level: 2, xp: 8, category: 'build' },
  // L3
  stone_block:   { id: 'stone_block',   name: 'Stone Blocks',  inputs: { stone: 2 }, output: { stone_block: 1 }, skill: 'stoneworking', level: 3, xp: 4, tools: [ 'stone_hammer', 'stone_chisel' ] },
  quern:         { id: 'quern',         name: 'Quern',         inputs: { stone: 4 }, output: { quern: 1 }, skill: 'stoneworking', level: 3, xp: 15, category: 'tool', tools: [ 'stone_hammer' ] },
  stone_oven:    { id: 'stone_oven',    name: 'Stone Oven',    inputs: { stone: 8, log: 2 }, output: { stone_oven: 1 }, skill: 'stoneworking', level: 3, xp: 18, category: 'build', tools: [ 'stone_hammer' ], needs: ['built:hearth'] },
  // L4
  stone_wall:   { id: 'stone_wall',   name: 'Stone Wall',   inputs: { stone_block: 6 }, output: { stone_wall: 1 }, skill: 'stoneworking', level: 4, xp: 12, category: 'build', tools: [ 'stone_hammer', 'stone_chisel' ] },
  stone_adze:   { id: 'stone_adze',   name: 'Stone Adze',   inputs: { stone: 3, branch: 1, sinew: 2 }, output: { stone_adze: 1 }, skill: 'stoneworking', level: 4, xp: 14, category: 'tool', tools: [ 'stone_hammer' ] },
  grindstone:   { id: 'grindstone',   name: 'Grindstone',   inputs: { stone_block: 2 }, output: { grindstone: 1 }, skill: 'stoneworking', level: 4, xp: 12, category: 'tool', tools: [ 'stone_hammer', 'stone_chisel' ] },
  stone_anvil:  { id: 'stone_anvil',  name: 'Stone Anvil',  inputs: { stone_block: 4 }, output: { stone_anvil: 1 }, skill: 'stoneworking', level: 4, xp: 20, category: 'tool', tools: [ 'stone_hammer', 'stone_chisel' ] },
  // L5
  whetstone:   { id: 'whetstone',   name: 'Whetstone',   inputs: { stone_block: 1, flint: 1 }, output: { whetstone: 1 }, skill: 'stoneworking', level: 5, xp: 20, category: 'tool', tools: [ 'stone_hammer', 'stone_chisel' ] },
  stone_house: { id: 'stone_house', name: 'Stone House', inputs: { stone_block: 20, beam: 4, plank: 8 }, output: { stone_house: 1 }, skill: 'stoneworking', level: 5, xp: 50, category: 'build', tools: [ ['stone_hammer', 'hammer'], ['stone_chisel', 'chisel'] ], needs: ['built:hearth'] },
  // L6
  forge: { id: 'forge', name: 'Forge', inputs: { stone_block: 8, stone: 8 }, output: { forge: 1 }, skill: 'stoneworking', level: 6, xp: 40, category: 'build', tools: [ ['stone_hammer', 'hammer'], ['stone_chisel', 'chisel'] ], needs: ['skill:stoneworking:5'] },
  // L7
  quarry: { id: 'quarry', name: 'Quarry', inputs: { stone_block: 12, beam: 6, plank: 8 }, output: { quarry: 1 }, skill: 'stoneworking', level: 7, xp: 60, category: 'build', tools: [ ['stone_hammer', 'hammer'], ['stone_chisel', 'chisel'], ['stone_adze', 'adze'] ], needs: ['skill:stoneworking:6'] }, // 2x stone, flint, and (if any exist) exposed ore

  // ============================================================ HOMESTEADING
  // L1
  hearth:       { id: 'hearth',       name: 'Hearth',        inputs: { stone: 4, log: 2, branch: 2 }, output: { hearth: 1 }, skill: 'homesteading', level: 1, xp: 10, category: 'build', needs: ['skill:stoneworking:1', 'skill:woodworking:2'] },
  cook_meat:    { id: 'cook_meat',    name: 'Cook Meat',     inputs: { rabbit: 1 }, output: { cooked_meat: 1 }, skill: 'homesteading', level: 1, xp: 2, tools: [ 'hearth' ], food: true },
  cook_fish:    { id: 'cook_fish',    name: 'Cook Fish',     inputs: { fish: 1 }, output: { cooked_meat: 1 }, skill: 'homesteading', level: 1, xp: 2, tools: [ 'hearth' ], food: true },
  // L2
  wood_hoe: { id: 'wood_hoe', name: 'Wood Hoe', inputs: { branch: 2, stone: 2, sinew: 2 }, output: { wood_hoe: 1 }, skill: 'homesteading', level: 2, xp: 8, category: 'tool', tools: [ ['stone_hammer', 'hammer'] ] },
  pot:      { id: 'pot',      name: 'Clay Pot', inputs: { clay: 3, branch: 2 }, output: { pot: 1 }, skill: 'homesteading', level: 2, xp: 12, category: 'tool', tools: [ 'hearth' ], needs: ['built:hearth'] },
  field:    { id: 'field',    name: 'Plant Field', inputs: { seeds: 2, branch: 2 }, output: { field: 1 }, skill: 'homesteading', level: 2, xp: 10, category: 'build', tools: [ 'wood_hoe' ] },
  // L3
  stew:        { id: 'stew',        name: 'Stew',        inputs: { grain: 2, rabbit: 1 }, output: { stew: 1 }, skill: 'homesteading', level: 3, xp: 6, tools: [ 'pot', 'hearth' ], food: true, needs: ['built:hearth'] },
  bread:       { id: 'bread',       name: 'Bread',       inputs: { grain: 2 }, output: { bread: 1 }, skill: 'homesteading', level: 3, xp: 6, tools: [ 'quern', ['hearth', 'stone_oven'] ], food: true, needs: ['built:hearth'] },
  smokehouse:  { id: 'smokehouse',  name: 'Smokehouse',  inputs: { log: 4, plank: 4 }, output: { smokehouse: 1 }, skill: 'homesteading', level: 3, xp: 15, category: 'build', tools: [ ['stone_hammer', 'hammer'] ] },
  smoke_meat:  { id: 'smoke_meat',  name: 'Smoke Meat',  inputs: { rabbit: 2 }, output: { smoked_meat: 1 }, skill: 'homesteading', level: 3, xp: 4, tools: [ 'smokehouse' ], food: true, needs: ['built:smokehouse'] },
  // L4
  clay_oven:  { id: 'clay_oven',  name: 'Clay Oven',  inputs: { clay: 6, stone_block: 4 }, output: { clay_oven: 1 }, skill: 'homesteading', level: 4, xp: 25, category: 'build', tools: [ ['stone_hammer', 'hammer'], ['stone_chisel', 'chisel'], 'stone_oven'], needs: ['built:stone_oven'] },
  granary:    { id: 'granary',    name: 'Granary',    inputs: { log: 6, plank: 8, beam: 4 }, output: { granary: 1 }, skill: 'homesteading', level: 4, xp: 20, category: 'build', tools: [ ['stone_hammer', 'hammer'] ], needs: [ ['built:cabin', 'built:stone_house'] ] }, // surplus rots without a house
  dog:        { id: 'dog',        name: 'Tame a Dog', inputs: { smoked_meat: 5, hide: 1 }, output: { dog: 1 }, skill: 'homesteading', level: 4, xp: 30, category: 'good', tools: [ 'smokehouse' ], needs: ['skill:mind:3', 'built:smokehouse'] }, // bonding is a Mind discipline
  // L5
  brick:        { id: 'brick',        name: 'Fire Bricks',  inputs: { clay: 4 }, output: { brick: 2 }, skill: 'homesteading', level: 5, xp: 8, tools: [ 'stone_oven' ], needs: ['built:stone_oven'] },
  market_stall: { id: 'market_stall', name: 'Market Stall', inputs: { plank: 4, beam: 2 }, output: { market_stall: 1 }, skill: 'homesteading', level: 5, xp: 18, category: 'build', tools: [ ['stone_hammer', 'hammer'], 'table' ], needs: [ ['skill:mind:3'] ] }, // trade runs on trust (Mind)
  well:         { id: 'well',         name: 'Well',         inputs: { stone_block: 6, log: 4, cord: 2 }, output: { well: 1 }, skill: 'homesteading', level: 5, xp: 25, category: 'build', tools: [ ['stone_axe', 'axe'], ['stone_hammer', 'hammer'] ] },
  // L6
  wood_plough: { id: 'wood_plough', name: 'Wood Plough', inputs: { log: 3, beam: 2, branch: 2 }, output: { wood_plough: 1 }, skill: 'homesteading', level: 6, xp: 20, category: 'tool', tools: [ ['bone_adze', 'stone_adze', 'adze'], ['stone_axe', 'axe'] ], needs: [ ['built:granary'] ] },
  fine_pot:    { id: 'fine_pot',    name: 'Kiln Pot',    inputs: { clay: 3 }, output: { fine_pot: 1 }, skill: 'homesteading', level: 6, xp: 12, category: 'tool', tools: [ 'kiln' ], needs: ['built:kiln'] },
  kiln:        { id: 'kiln',        name: 'Kiln',        inputs: { brick: 8, stone_block: 6 }, output: { kiln: 1 }, skill: 'homesteading', level: 6, xp: 35, category: 'build', tools: [ ['stone_hammer', 'hammer'], ['stone_chisel', 'chisel'] ], needs: ['built:clay_oven'] },
  // L7
  plough:    { id: 'plough',    name: 'Ingot Plough', inputs: { ingot: 3, beam: 4, plank: 4 }, output: { plough: 1 }, skill: 'homesteading', level: 7, xp: 40, category: 'tool', tools: [ ['bone_adze', 'stone_adze', 'adze'], ['stone_hammer', 'hammer'] ], needs: ['skill:metalworking:4'] },
  bakehouse: { id: 'bakehouse', name: 'Bakehouse',    inputs: { brick: 12, beam: 4, plank: 8 }, output: { bakehouse: 1 }, skill: 'homesteading', level: 7, xp: 50, category: 'build', tools: [ ['stone_hammer', 'hammer'], ['bone_adze', 'stone_adze', 'adze'] ], needs: ['built:kiln'] },

  // ============================================================ METALWORKING
  // L1 (knowledge-gated: ore only where Mind/Lore has looked)
  prospect: { id: 'prospect', name: 'Prospect for Ore', inputs: {}, output: { ore: 1 }, skill: 'metalworking', level: 1, xp: 4, gather: true, needs: ['skill:mind:4'] }, // Mind L4 reveals veins; each vein is finite
  mine_ore: { id: 'mine_ore', name: 'Mine Ore', inputs: {}, output: { ore: 3 }, skill: 'metalworking', level: 1, xp: 6, gather: true, tools: [ ['stone_chisel', 'chisel'] ], needs: ['skill:mind:4'] },
  // L2
  bone_tongs: { id: 'bone_tongs', name: 'Bone Tongs', inputs: { bone: 2, sinew: 2 }, output: { bone_tongs: 1 }, skill: 'metalworking', level: 2, xp: 8, category: 'tool', tools: [ ['stone_chisel', 'chisel'] ] },
  bellows:    { id: 'bellows',    name: 'Bellows',    inputs: { branch: 4, hide: 1, cord: 2 }, output: { bellows: 1 }, skill: 'metalworking', level: 2, xp: 12, category: 'tool', tools: [ ['stone_axe', 'axe'] ] },
  smelt_ingot:{ id: 'smelt_ingot', name: 'Smelt Ingot', inputs: { ore: 2, log: 2 }, output: { ingot: 1 }, skill: 'metalworking', level: 2, xp: 10, tools: [ 'forge', 'bellows', ['bone_tongs', 'tongs'] ], needs: ['built:forge'] },
  // L3
  knife: { id: 'knife', name: 'Ingot Knife', inputs: { ingot: 1 }, output: { knife: 1 }, skill: 'metalworking', level: 3, xp: 12, category: 'tool', tools: [ ['stone_hammer', 'hammer'], 'stone_anvil', 'bone_tongs'] },
  saw:   { id: 'saw',   name: 'Ingot Saw',   inputs: { ingot: 1, cord: 2 }, output: { saw: 1 }, skill: 'metalworking', level: 3, xp: 12, category: 'tool', tools: [ ['stone_hammer', 'hammer'], 'stone_anvil', ['bone_tongs', 'tongs']] },
  // L4
  axe:     { id: 'axe',     name: 'Ingot Axe',     inputs: { ingot: 1, branch: 1 }, output: { axe: 1 }, skill: 'metalworking', level: 4, xp: 15, category: 'tool', tools: [ ['stone_hammer', 'hammer'], 'stone_anvil', 'bone_tongs'] },
  pickaxe: { id: 'pickaxe', name: 'Pickaxe',       inputs: { ingot: 2, branch: 1 }, output: { pickaxe: 1 }, skill: 'metalworking', level: 4, xp: 20, category: 'tool', tools: [ ['stone_hammer', 'hammer'], 'stone_anvil', 'bone_tongs'] },
  hoe:     { id: 'hoe',     name: 'Ingot Hoe',     inputs: { ingot: 1, branch: 1 }, output: { hoe: 1 }, skill: 'metalworking', level: 4, xp: 12, category: 'tool', tools: [ ['stone_hammer', 'hammer'], 'stone_anvil', 'bone_tongs'] },
  // L5
  anvil:  { id: 'anvil',  name: 'Ingot Anvil',  inputs: { ingot: 4, stone_block: 2 }, output: { anvil: 1 }, skill: 'metalworking', level: 5, xp: 30, category: 'tool', tools: [ ['stone_hammer', 'hammer'], ['bone_tongs', 'tongs'], 'forge'], needs: ['built:forge'] },
  tongs:  { id: 'tongs',  name: 'Ingot Tongs',  inputs: { ingot: 1 }, output: { tongs: 1 }, skill: 'metalworking', level: 5, xp: 18, category: 'tool', tools: [ ['stone_hammer', 'hammer'], ['bone_tongs', 'tongs'], 'forge'], needs: ['built:forge'] }, // tongs to make tongs
  hammer: { id: 'hammer', name: 'Ingot Hammer', inputs: { ingot: 2, branch: 1 }, output: { hammer: 1 }, skill: 'metalworking', level: 5, xp: 25, category: 'tool', tools: [ ['stone_hammer', 'hammer'], ['bone_tongs', 'tongs'], 'forge'], needs: ['built:forge'] }, // hammer to make hammer
  // L6
  fine_tongs: { id: 'fine_tongs', name: 'Refined Tongs', inputs: { ingot: 2 }, output: { fine_tongs: 1 }, skill: 'metalworking', level: 6, xp: 22, category: 'tool', tools: [ 'hammer', 'tongs', 'anvil', 'forge', 'whetstone'], needs: ['built:forge'] },
  chisel:     { id: 'chisel',     name: 'Ingot Chisel',  inputs: { ingot: 1 }, output: { chisel: 1 }, skill: 'metalworking', level: 6, xp: 15, category: 'tool', tools: [ 'hammer', 'tongs', 'anvil', 'forge' ], needs: ['built:forge'] },
  sword:      { id: 'sword',      name: 'Sword',         inputs: { ingot: 3 }, output: { sword: 1 }, skill: 'metalworking', level: 6, xp: 35, category: 'tool', tools: [ 'hammer', 'tongs', 'anvil', 'forge', 'whetstone'], needs: ['built:forge'] },
  // L7
  adze:       { id: 'adze',       name: 'Ingot Adze',    inputs: { ingot: 1, branch: 1 }, output: { adze: 1 }, skill: 'metalworking', level: 7, xp: 25, category: 'tool', tools: [ 'hammer', 'fine_tongs', 'anvil', 'forge' ], needs: ['built:forge'] },
  fine_arrow: { id: 'fine_arrow', name: 'Ingot Arrows',  inputs: { ingot: 1, branch: 2, sinew: 2 }, output: { fine_arrow: 2 }, skill: 'metalworking', level: 7, xp: 10, tools: [ 'chisel', 'whetstone'] },

  // ============================================================ MIND
  // L1 (attention to nature)
  find_herb: { id: 'find_herb', name: 'Seek Herbs', inputs: {}, output: { herb: 1 }, skill: 'mind', level: 1, xp: 2, gather: true }, // Mind makes herbs visible at all
  amulet:    { id: 'amulet',    name: 'Bone Amulet', inputs: { bone: 1, sinew: 1, flint: 1 }, output: { amulet: 1 }, skill: 'mind', level: 1, xp: 8, category: 'good', tools: [ ['stone_chisel', 'chisel'] ] },
  // L2 (prayer / ritual)
  drum: { id: 'drum', name: 'Ritual Drum', inputs: { branch: 4, hide: 2, cord: 2 }, output: { drum: 1 }, skill: 'mind', level: 2, xp: 15, category: 'good', tools: [ ['stone_axe', 'axe'], ['stone_chisel', 'chisel'] ] },
  // L3 (story / social)
  journal: { id: 'journal', name: 'Journal', inputs: { branch: 2, hide: 1, sinew: 2 }, output: { journal: 1 }, skill: 'mind', level: 3, xp: 15, category: 'good', tools: [ ['stone_chisel', 'chisel'] ] },
  // L5 (medicine)
  salve: { id: 'salve', name: 'Salve', inputs: { herb: 3, clay: 1 }, output: { salve: 2 }, skill: 'mind', level: 5, xp: 12, category: 'good', tools: [ ['pot', 'fine_pot'] ], needs: [ ['built:hearth', 'built:stone_oven'] ] },
  // L6 (village ritual)
  totem:  { id: 'totem',  name: 'Totem',  inputs: { beam: 6, flint: 2, hide: 2 }, output: { totem: 1 }, skill: 'mind', level: 6, xp: 40, category: 'build', tools: [ ['bone_adze', 'stone_adze', 'adze'], ['stone_chisel', 'chisel', 'knife'] ] },
  shrine: { id: 'shrine', name: 'Shrine', inputs: { stone_block: 4, amulet: 1 }, output: { shrine: 1 }, skill: 'mind', level: 6, xp: 30, category: 'build', tools: [ ['stone_chisel', 'chisel'] ] },
  // L7 (sage)
  oracle: { id: 'oracle', name: 'Oracle', inputs: { journal: 1, amulet: 1, herb: 4, stone_block: 2 }, output: { oracle: 1 }, skill: 'mind', level: 7, xp: 80, category: 'build', tools: [ ['shrine'] ], needs: ['built:shrine', 'skill:mind:6'] },

  // ============================================================ PROCESSING (tool-use, not craft)

};

export const SKILL_INFO = {
  stoneworking: {
    1: ['Quarry Stone and Flint from cliffs.', 'Craft a Stone Hammer (the first real tool).', 'Craft a Stone Chisel.'],
    2: ['Craft a Stone Axe (stone + branch + sinew).', 'Build Rock Walls from loose stone.'],
    3: ['Carve Stone Blocks (hammer + chisel).', 'Build a Quern to grind grain.', 'Build a Stone Oven (requires a Hearth).'],
    4: ['Build masonry Stone Walls from blocks.', 'Craft a Stone Adze.', 'Grind a Grindstone.', 'Carve a Stone Anvil for early forging.'],
    5: ['Craft a Whetstone (sharpens ALL metal tools).', 'Build a Stone House (requires hearth + wood).'],
    6: ['Construct a Forge — the gateway to all metal.'],
    7: ['Dig a Quarry: 2x stone, flint, and exposed ore.'],
  },
  woodworking: {
    1: ['Gather Branches.', 'Twine Reed into Cord.', 'Plait a Basket (the first container).'],
    2: ['Chop Rough Logs (requires a Stone Axe or Adze).', 'Work Rough Logs into Logs.', 'Whittle Beams from Branches with any sharp edge.'],
    3: ['Craft a Bone Adze (hollowing, shaping).', 'Craft a Bone Saw.', 'Saw Planks from Logs.', 'Make Flint Arrows.'],
    4: ['Build Wood Fences.', 'Build Ladders (climb cliffs).', 'Craft a Fishing Rod.', 'Build a Chair (rest, +energy).'],
    5: ['Build a Log Cabin (hammer + axe).', 'Build a Table (trade bonus).', 'Hollow a Boat (adze + long work).'],
    6: ['Build Bridges over water (redundant with boats).', 'Build a Chest (storage).', 'Build a Cart (the wheel; fast transport).'],
    7: ['Carve a Bow from a seasoned beam and sinew.'],
  },
  homesteading: {
    1: ['Build a Hearth (stone + wood) — the first build in the game.', 'Cook Meat or Fish over the hearth.'],
    2: ['Craft a Wood Hoe.', 'Shape a Clay Pot (fired in the hearth).', 'Plant a Field from Seeds.'],
    3: ['Make Stew (pot + grain + meat).', 'Bake Bread (quern + hearth).', 'Build a Smokehouse.', 'Smoke Meat (preserved food).'],
    4: ['Build a Clay Oven (fired clay + masonry).', 'Build a Granary (requires a house — surplus rots otherwise).', 'Tame a Dog (requires Mind 3 + a smokehouse).'],
    5: ['Fire Bricks in the Stone Oven.', 'Build a Market Stall (requires table + Mind 3).', 'Dig a Well (water for farm and quenching).'],
    6: ['Build a Wood Plough (requires granary).', 'Build a Kiln (requires clay oven).', 'Fire Kiln Pots.'],
    7: ['Forge an Ingot Plough (requires Metalworking 4).', 'Build a Bakehouse (requires kiln).'],
  },
  metalworking: {
    1: ['Prospect for Ore (requires Mind 4 — Lore reveals veins).', 'Mine exposed Ore (chisel).'],
    2: ['Craft Bone Tongs.', 'Build Bellows (hide + wood).', 'Smelt Ingots (requires a built Forge, bellows and tongs).'],
    3: ['Forge an Ingot Knife (stone anvil).', 'Forge an Ingot Saw.'],
    4: ['Forge an Ingot Axe.', 'Forge a Pickaxe (real mining).', 'Forge an Ingot Hoe.'],
    5: ['Forge an Ingot Anvil.', 'Forge Ingot Tongs (requires tongs).', 'Forge an Ingot Hammer (requires a hammer).'],
    6: ['Forge Refined Tongs (requires whetstone).', 'Forge an Ingot Chisel.', 'Forge a Sword (the apex; requires whetstone).'],
    7: ['Forge the Ingot Adze (final adze tier; requires refined tongs).', 'Draw Ingot Arrowheads.'],
  },
  mind: {
    1: ['Attention to Nature: herbs become findable.', 'Craft a Bone Amulet (small protection).'],
    2: ['Carve a Ritual Drum (group ritual: foraging and trade +).'],
    3: ['Keep a Journal (records seasons and stories).', 'Stories earned: strangers are safe to trade with; dogs can be tamed.'],
    4: ['LORE: prospecting unlocked (reveals ore veins).', 'Read the Seasons: field yield +.', 'Read the Weather: storms no longer ruin work.'],
    5: ['Prepare Salve (heals wounds and illness).'],
    6: ['Carve a Totem (village monument: strangers become traders).', 'Build a Shrine (protection, +trade).'],
    7: ['Raise an Oracle (requires shrine): prospect 2x, reveals the map.', 'Sage: all skill gains +25%; pilgrims visit.'],
  },
};

// ============================================================
// SKILL DEPENDENCY MAP
// 'skill:<skill>:<level>' means the recipe/ability is gated on that level.
// 'built:<item>' means the structure must exist in the world.
// ============================================================
export const SKILL_DEPS = {
  // What each skill LEVEL requires before it can be used:
  stoneworking: {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: ['skill:stoneworking:5'],
    7: ['skill:stoneworking:6'],
  },
  woodworking: {
    1: [],
    2: ['skill:stoneworking:2'],          // stone axe/adze to chop
    3: ['skill:woodworking:2'],
    4: ['skill:woodworking:3'],
    5: ['skill:stoneworking:1'],          // hammer for cabin framing
    6: ['skill:woodworking:5'],
    7: ['skill:woodworking:6'],
  },
  homesteading: {
    1: ['skill:stoneworking:1', 'skill:woodworking:2'], // hearth needs stone + logs
    2: ['skill:homesteading:1'],
    3: ['skill:stoneworking:3'],          // bread needs quern
    4: ['skill:homesteading:3'],
    5: ['skill:homesteading:4', 'skill:mind:3'], // market needs trust
    6: ['skill:homesteading:5'],
    7: ['skill:metalworking:4'],          // ingot plough
  },
  metalworking: {
    1: ['skill:mind:4'],                  // the knowledge gate: ore
    2: ['skill:stoneworking:6'],          // smelting needs a built forge
    3: ['skill:stoneworking:4'],          // stone anvil
    4: ['skill:metalworking:3'],
    5: ['skill:stoneworking:5'],          // whetstone lineage for fine work
    6: ['skill:stoneworking:5'],          // whetstone
    7: ['skill:metalworking:6'],
  },
  mind: {
    1: [],
    2: ['skill:woodworking:1'],           // drum needs wood + hide craft
    3: ['skill:mind:2'],
    4: ['skill:mind:3'],
    5: ['skill:homesteading:2'],          // salve needs pot
    6: ['skill:mind:5', 'skill:woodworking:5'], // totem needs beams + adze
    7: ['skill:mind:6', 'built:shrine'],
  },
};

// The designed cycles (tongs->tongs, hammer->hammer, stone<->metal upgrades):
export const CIRCULAR_DEPS = [
  { a: 'tongs', b: 'fine_tongs', note: 'Ingot tongs are forged with tongs; refined tongs require ingot tongs.' },
  { a: 'hammer', b: 'hammer', note: 'The ingot hammer is made with an existing hammer (stone or ingot).' },
  { a: 'whetstone', b: 'chisel', note: 'Whetstone (stone) sharpens metal; ingot chisel carves finer whetstones.' },
  { a: 'kiln', b: 'brick', note: 'Kilns are built of bricks; bricks are fired in ovens the kiln supersedes.' },
  { a: 'adze', b: 'boat', note: 'The adze shapes the boat; the boat carries the ore and stone that made the adze.' },
  { a: 'anvil', b: 'hammer', note: 'Anvil tiers (stone->ingot) gate every hammer/tongs upgrade.' },
];

// Cross-skill gates (the "maximum interdependence" nodes):
export const CROSS_SKILL_GATES = [
  { gate: 'prospecting (ore)', requires: ['mind:4'], unlocks: 'metalworking' },
  { gate: 'smelting', requires: ['stoneworking:6 (forge)', 'woodworking:2 (fuel)', 'metalworking:2 (bellows+tongs)'], unlocks: 'all metal' },
  { gate: 'bread', requires: ['homesteading:3', 'stoneworking:3 (quern)', 'hearth/oven'], unlocks: 'food security' },
  { gate: 'granary', requires: ['homesteading:4', 'woodworking:5 (cabin)'], unlocks: 'surplus, plough' },
  { gate: 'dog', requires: ['homesteading:4', 'mind:3'], unlocks: 'guard + hunting' },
  { gate: 'market', requires: ['homesteading:5', 'mind:3', 'table'], unlocks: 'trade with strangers' },
  { gate: 'plough (ingot)', requires: ['homesteading:7', 'metalworking:4'], unlocks: 'large fields' },
  { gate: 'oracle', requires: ['mind:7', 'shrine', 'journal', 'amulet'], unlocks: 'prospect 2x, map' },
];
