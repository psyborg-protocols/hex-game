// items_recipes_skills.js (TESTING VERSION)
// All crafting recipes are free and require no skill levels or tools.

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
  knife: { id: 'knife', name: 'Knife', stack: 1, icon: 'icons/knife.png' },
  hammer: { id: 'hammer', name: 'Hammer', stack: 1, icon: 'icons/hammer.png' },
  basket: { id: 'basket', name: 'Basket', stack: 5, icon: 'icons/basket.png' },
  fishing_rod: { id: 'fishing_rod', name: 'Fishing Rod', stack: 1, icon: 'icons/fishing_rod.png' },
  bow: { id: 'bow', name: 'Bow', stack: 1, icon: 'icons/bow.png' },
  sharpening_stone: { id: 'sharpening_stone', name: 'Sharpening Stone', stack: 10, icon: 'icons/sharpening_stone.png' },
  chisel: { id: 'chisel', name: 'Chisel', stack: 1, icon: 'icons/chisel.png' },
  stone_block: { id: 'stone_block', name: 'Stone Block', stack: 99, icon: 'icons/stone_block.png' },
  oven: { id: 'oven', name: 'Oven', stack: 1, icon: 'icons/oven.png' },
  whetstone: { id: 'whetstone', name: 'Whetstone', stack: 1, icon: 'icons/whetstone.png' },
  forge: { id: 'forge', name: 'Forge', stack: 1, icon: 'icons/forge.png' },
  tongs: { id: 'tongs', name: 'Tongs', stack: 1, icon: 'icons/tongs.png' },
  sword: { id: 'sword', name: 'Sword', stack: 1, icon: 'icons/sword.png' },
};

export const ITEM_BASE_PRICES = {
  wood: 1, stone: 1, ore: 3, plank: 3, brick: 4, ingot: 5, pickaxe: 25,
  branch: 0.5, axe: 18, rough_log: 1, log: 2, beam: 3, chest: 8, chair: 5,
  table: 6, cabin: 20, saw: 15, stone_wall: 8, wood_fence: 6, ladder: 8,
  bridge: 12, knife: 8, hammer: 20, basket: 4, fishing_rod: 10, bow: 15,
  sharpening_stone: 18,
  chisel: 12, stone_block: 3, oven: 15, whetstone: 30, forge: 50, tongs: 22, sword: 45,
};

export const RECIPES = {
  // --- WOODWORKING ---
  basket: { id: 'basket', name: 'Basket', inputs: {}, output: { basket: 1 }, skill: 'woodworking', level: 1, xp: 5 },
  logs: { id: 'logs', name: 'Work Logs', inputs: {}, output: { log: 1 }, skill: 'woodworking', level: 1, xp: 3 },
  beams_from_branch: { id: 'beams_from_branch', name: 'Whittle Beam', inputs: {}, output: { beam: 1 }, skill: 'woodworking', level: 1, xp: 2 },
  beams_from_log: { id: 'beams_from_log', name: 'Saw Beams', inputs: {}, output: { beam: 4 }, skill: 'woodworking', level: 1, xp: 5 },
  planks: { id: 'planks', name: 'Planks', inputs: {}, output: { plank: 2 }, skill: 'woodworking', level: 1, xp: 6 },
  wood_fence: { id: 'wood_fence', name: 'Wood Fence', inputs: {}, output: { wood_fence: 1 }, skill: 'woodworking', level: 1, xp: 6, category: 'build' },
  ladder: { id: 'ladder', name: 'Ladder', inputs: {}, output: { ladder: 1 }, skill: 'woodworking', level: 1, xp: 10, category: 'build' },
  fishing_rod: { id: 'fishing_rod', name: 'Fishing Rod', inputs: {}, output: { fishing_rod: 1 }, skill: 'woodworking', level: 1, xp: 8 },
  cabin: { id: 'cabin', name: 'Log Cabin', inputs: {}, output: { cabin: 1 }, skill: 'woodworking', level: 1, xp: 25, category: 'build' },
  bridge: { id: 'bridge', name: 'Bridge', inputs: {}, output: { bridge: 1 }, skill: 'woodworking', level: 1, xp: 20, category: 'build' },
  bow: { id: 'bow', name: 'Bow', inputs: {}, output: { bow: 1 }, skill: 'woodworking', level: 1, xp: 12 },
  
  // --- STONEWORKING ---
  rock_wall: { id: 'rock_wall', name: 'Rock Wall', inputs: {}, output: { stone_wall: 1 }, skill: 'stoneworking', level: 1, xp: 8, category: 'build' },
  oven: { id: 'oven', name: 'Oven', inputs: {}, output: { oven: 1 }, skill: 'stoneworking', level: 1, xp: 15, category: 'build' },
  stone_blocks: { id: 'stone_blocks', name: 'Stone Blocks', inputs: {}, output: { stone_block: 1 }, skill: 'stoneworking', level: 1, xp: 4 },
  stone_wall_strong: { id: 'stone_wall_strong', name: 'Reinforced Stone Wall', inputs: {}, output: { stone_wall: 1 }, skill: 'stoneworking', level: 1, xp: 12, category: 'build' },
  whetstone: { id: 'whetstone', name: 'Whetstone', inputs: {}, output: { whetstone: 1 }, skill: 'stoneworking', level: 1, xp: 20 },
  stone_house: { id: 'stone_house', name: 'Stone House', inputs: {}, output: { cabin: 1 }, skill: 'stoneworking', level: 1, xp: 50, category: 'build' },
  forge: { id: 'forge', name: 'Forge', inputs: {}, output: { forge: 1 }, skill: 'stoneworking', level: 1, xp: 40, category: 'build' },

  // --- METALWORKING ---
  knife: { id: 'knife', name: 'Knife', inputs: {}, output: { knife: 1 }, skill: 'metalworking', level: 1, xp: 10 },
  chisel: { id: 'chisel', name: 'Chisel', inputs: {}, output: { chisel: 1 }, skill: 'metalworking', level: 1, xp: 10 },
  axe: { id: 'axe', name: 'Axe', inputs: {}, output: { axe: 1 }, skill: 'metalworking', level: 1, xp: 15 },
  pickaxe: { id: 'pickaxe', name: 'Pickaxe', inputs: {}, output: { pickaxe: 1 }, skill: 'metalworking', level: 1, xp: 20 },
  smelt_ingot: { id: 'smelt_ingot', name: 'Smelt Ingot', inputs: {}, output: { ingot: 1 }, skill: 'metalworking', level: 1, xp: 8 },
  hammer: { id: 'hammer', name: 'Hammer', inputs: {}, output: { hammer: 1 }, skill: 'metalworking', level: 1, xp: 25 },
  tongs: { id: 'tongs', name: 'Tongs', inputs: {}, output: { tongs: 1 }, skill: 'metalworking', level: 1, xp: 18 },
  sword: { id: 'sword', name: 'Sword', inputs: {}, output: { sword: 1 }, skill: 'metalworking', level: 1, xp: 35 },
};

export const SKILL_INFO = {
  woodworking: {
    1: ['Harvest Branches from trees.', 'Craft Baskets from Branches.'],
    2: ['Chop trees for Rough Logs (requires Axe).', 'Work Rough Logs into Logs (requires Axe).', 'Whittle Beams from Branches (requires Knife).'],
    3: ['Saw Beams from Logs ( requires Saw).', 'Saw Planks from Logs (requires Saw).', 'Build Wood Fences from Beams.'],
    4: ['Craft a Fishing Rod (requires Knife).', 'Build Ladders to climb cliffs (requires Axe).'],
    5: ['Build a Log Cabin (requires Axe and Hammer).'],
    6: ['Build Bridges over water (requires Hammer).'],
    7: ['Craft a Bow (requires Knife).']
  },
  stoneworking: {
    1: ['Quarry cliffs for Stone (requires Hammer).'],
    2: ['Build basic Rock Walls from loose stone.'],
    3: ['Build a stone Oven.', 'Carve Stone Blocks from stone (requires Hammer and Chisel).'],
    4: ['Build reinforced Stone Walls from blocks.'],
    5: ['Craft a Whetstone for sharpening tools.'],
    6: ['Build a durable Stone House.'],
    7: ['Construct a Forge for metalworking.'],
  },
  metalworking: {
    1: ['Mine cliffs for Stone and Ore (requires Pickaxe).'],
    2: ['No new recipes at this level.'],
    3: ['Forge Knives and Chisels from Ingots (requires Hammer and Whetstone).'],
    4: ['Forge Axes and Pickaxes (requires Hammer and Whetstone).'],
    5: ['Smelt Ore into Ingots (requires a Forge).'],
    6: ['Forge a new Hammer (requires a Forge, Tongs, and an existing Hammer).'],
    7: ['Forge Tongs and Swords (requires a Forge, Tongs, and Hammer).'],
  },
};
