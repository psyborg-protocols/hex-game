// items_recipes.js
// Defines items, base prices and crafting recipes for the hex world game.

export const ITEMS = {
  wood:  { id: 'wood',  name: 'Wood',  stack: 99, icon: 'icons/wood.png' },
  stone: { id: 'stone', name: 'Stone', stack: 99, icon: 'icons/stone.png' },
  ore:   { id: 'ore',   name: 'Ore',   stack: 99, icon: 'icons/ore.png' },
  plank: { id: 'plank', name: 'Plank', stack: 99, icon: 'icons/plank.png' },
  brick:{ id: 'brick', name: 'Brick', stack: 99, icon: 'icons/brick.png' },
  ingot:{ id: 'ingot', name: 'Ingot', stack: 99, icon: 'icons/ingot.png' },
  pickaxe: { id: 'pickaxe', name: 'Pickaxe', stack: 1, icon: 'icons/pickaxe.png' },
  branch: { id: 'branch', name: 'Branch', stack: 99, icon: 'icons/branch.png' },
  axe: { id: 'axe', name: 'Axe', stack: 1, icon: 'icons/axe.png' },
  rough_log: { id: 'rough_log', name: 'Rough Log', stack: 99, icon: 'icons/rough_log.png' },
  log: { id: 'log', name: 'Log', stack: 99, icon: 'icons/log.png' },
  beam: { id: 'beam', name: 'Beam', stack: 99, icon: 'icons/beam.png' },
  chest: { id: 'chest', name: 'Chest', stack: 99, icon: 'icons/chest.png' },
  chair: { id: 'chair', name: 'Chair', stack: 99, icon: 'icons/chair.png' },
  table: { id: 'table', name: 'Table', stack: 99, icon: 'icons/table.png' },
  cabin: { id: 'cabin', name: 'Log Cabin', stack: 1, icon: 'icons/cabin.png' },
  saw: { id: 'saw', name: 'Saw', stack: 1, icon: 'icons/saw.png' },
  stone_wall: { id: 'stone_wall', name: 'Stone Wall', stack: 99, icon: 'icons/stone_wall.png' },
  wood_fence: { id: 'wood_fence', name: 'Wood Fence', stack: 99, icon: 'icons/wood_fence.png' },
  ladder: { id: 'ladder', name: 'Ladder', stack: 99, icon: 'icons/ladder.png' },
  bridge: { id: 'bridge', name: 'Bridge', stack: 99, icon: 'icons/bridge.png' },
  // --- NEW ITEMS ---
  knife: { id: 'knife', name: 'Knife', stack: 1, icon: 'icons/knife.png' },
  hammer: { id: 'hammer', name: 'Hammer', stack: 1, icon: 'icons/hammer.png' },
  basket: { id: 'basket', name: 'Basket', stack: 5, icon: 'icons/basket.png' },
  fishing_rod: { id: 'fishing_rod', name: 'Fishing Rod', stack: 1, icon: 'icons/fishing_rod.png' },
  bow: { id: 'bow', name: 'Bow', stack: 1, icon: 'icons/bow.png' },
  sharpening_stone: { id: 'sharpening_stone', name: 'Sharpening Stone', stack: 10, icon: 'icons/sharpening_stone.png' },
};

export const ITEM_BASE_PRICES = {
  wood: 1,
  stone: 1,
  ore: 3,
  plank: 3,
  brick: 4,
  ingot: 5,
  pickaxe: 12,
  branch: 0.5,
  axe: 10,
  rough_log: 1,
  log: 2,
  beam: 3,
  chest: 8,
  chair: 5,
  table: 6,
  cabin: 20,
  saw: 15,
  stone_wall: 8,
  wood_fence: 6,
  ladder: 8,
  bridge: 12,
  // --- NEW PRICES ---
  knife: 8,
  hammer: 12,
  basket: 4,
  fishing_rod: 10,
  bow: 15,
  sharpening_stone: 18,
};

export const RECIPES = {
  // --- LEVEL 1 ---
  basket: {
    id: 'basket', name: 'Basket', inputs: { branch: 3 }, output: { basket: 1 },
    skill: 'woodworking', level: 1, xp: 5
  },
  // --- LEVEL 2 ---
  logs: {
    id: 'logs', name: 'Work Logs', inputs: { rough_log: 1 }, output: { log: 1 },
    skill: 'woodworking', level: 2, xp: 3, tools: { axe: 1 }
  },
  beams_from_branch: {
    id: 'beams_from_branch', name: 'Whittle Beam', inputs: { branch: 2 }, output: { beam: 1 },
    skill: 'woodworking', level: 2, xp: 2, tools: { knife: 1 }
  },
  // --- LEVEL 3 ---
  beams_from_log: {
    id: 'beams_from_log', name: 'Saw Beams', inputs: { log: 1 }, output: { beam: 4 },
    skill: 'woodworking', level: 3, xp: 5, tools: { saw: 1 }
  },
  planks: {
    id: 'planks', name: 'Planks', inputs: { log: 1 }, output: { plank: 2 },
    skill: 'woodworking', level: 3, xp: 6, tools: { saw: 1 }
  },
  wood_fence: {
    id: 'wood_fence', name: 'Wood Fence', inputs: { beam: 4 }, output: { wood_fence: 1 },
    skill: 'woodworking', level: 3, xp: 6, category: 'build'
  },
  // --- LEVEL 4 ---
  ladder: {
    id: 'ladder', name: 'Ladder', inputs: { beam: 5 }, output: { ladder: 1 },
    skill: 'woodworking', level: 4, xp: 10, category: 'build', tools: { axe: 1 }
  },
  fishing_rod: {
    id: 'fishing_rod', name: 'Fishing Rod', inputs: { branch: 1 }, output: { fishing_rod: 1 },
    skill: 'woodworking', level: 4, xp: 8, tools: { knife: 1 }
  },
  // --- LEVEL 5 ---
  cabin: {
    id: 'cabin', name: 'Log Cabin', inputs: { log: 10, beam: 4, plank: 6 }, output: { cabin: 1 },
    skill: 'woodworking', level: 5, xp: 25, tools: { hammer: 1, axe: 1 }, category: 'build'
  },
  // --- LEVEL 6 ---
  bridge: {
    id: 'bridge', name: 'Bridge', inputs: { log: 4, plank: 6, beam: 2 }, output: { bridge: 1 },
    skill: 'woodworking', level: 6, xp: 20, category: 'build', tools: { hammer: 1 }
  },
  // --- LEVEL 7 ---
  bow: {
    id: 'bow', name: 'Bow', inputs: { branch: 1 }, output: { bow: 1 },
    skill: 'woodworking', level: 7, xp: 12, tools: { knife: 1 }
  },
  // --- OTHER SKILLS (for context) ---
  chest: {
    id: 'chest', name: 'Chest', inputs: { plank: 4 }, output: { chest: 1 },
    skill: 'woodworking', level: 3, xp: 8, tools: { saw: 1 }
  },
  chair: {
    id: 'chair', name: 'Chair', inputs: { plank: 2, beam: 1 }, output: { chair: 1 },
    skill: 'woodworking', level: 3, xp: 8, tools: { saw: 1 }
  },
  table: {
    id: 'table', name: 'Table', inputs: { plank: 3, beam: 2 }, output: { table: 1 },
    skill: 'woodworking', level: 3, xp: 10, tools: { saw: 1 }
  },
  bricks: {
    id: 'bricks', name: 'Bricks', inputs: { stone: 3 }, output: { brick: 1 },
    skill: 'stoneworking', level: 1, xp: 5
  },
  ingot: {
    id: 'ingot', name: 'Ingot', inputs: { ore: 4 }, output: { ingot: 1 },
    skill: 'metalworking', level: 1, xp: 5
  },
  pickaxe: {
    id: 'pickaxe', name: 'Pickaxe', inputs: { plank: 2, ore: 3 }, output: { pickaxe: 1 },
    skill: 'metalworking', level: 2, xp: 15
  },
  stone_wall: {
    id: 'stone_wall', name: 'Stone Wall', inputs: { stone: 4 }, output: { stone_wall: 1 },
    skill: 'stoneworking', level: 3, xp: 8, category: 'build'
  },
};

export const SKILL_INFO = {
  woodworking: {
    1: [
      'Harvest Branches from trees.',
      'Craft Baskets from Branches.',
    ],
    2: [
      'Chop trees for Rough Logs (requires Axe).',
      'Work Rough Logs into Logs (requires Axe).',
      'Whittle Beams from Branches (less efficient, requires Knife).',
    ],
    3: [
      'Saw high-yield Beams from Logs (more efficient, requires Saw).',
      'Saw Planks from Logs (requires Saw).',
      'Build Wood Fences from Beams.',
    ],
    4: [
      'Craft a Fishing Rod (requires Knife).',
      'Build Ladders to climb cliffs (requires Axe).',
    ],
    5: [
      'Build a Log Cabin (requires Axe and Hammer).',
    ],
    6: [
      'Build Bridges over water (requires Hammer).',
    ],
    7: [
      'Craft a Bow (requires Knife).',
    ]
  },
  stoneworking: {
    1: [
      'Craft Bricks from Stone',
    ],
    2: [
      'No additional recipes at this level',
    ],
    3: [
      'Build Stone Walls from Stone',
    ],
    4: [
      'No additional recipes at this level',
    ],
  },
  metalworking: {
    1: [
      'Smelt Ingots from Ore',
    ],
    2: [
      'Craft Pickaxes from Planks and Ore',
    ],
    3: [
      'No additional recipes at this level',
    ],
    4: [
      'No additional recipes at this level',
    ],
  },
};
