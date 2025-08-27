// items_recipes.js
// Defines items, base prices and crafting recipes for the hex world game.

export const ITEMS = {
  berries: { id: 'berries', name: 'Berries', stack: 20, icon: 'icons/berries.png', food: 1 },
  seeds: { id: 'seeds', name: 'Seeds', stack: 50, icon: 'icons/seeds.png', food: 1 },
  rabbit: { id: 'rabbit', name: 'Rabbit', stack: 10, icon: 'icons/rabbit.png', food: 0 },
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
  chisel: { id: 'chisel', name: 'Chisel', stack: 1, icon: 'icons/chisel.png' },
  stone_block: { id: 'stone_block', name: 'Stone Block', stack: 99, icon: 'icons/stone_block.png' },
  oven: { id: 'oven', name: 'Oven', stack: 1, icon: 'icons/oven.png' },
  whetstone: { id: 'whetstone', name: 'Whetstone', stack: 1, icon: 'icons/whetstone.png' },
  forge: { id: 'forge', name: 'Forge', stack: 1, icon: 'icons/forge.png' },
  tongs: { id: 'tongs', name: 'Tongs', stack: 1, icon: 'icons/tongs.png' },
  sword: { id: 'sword', name: 'Sword', stack: 1, icon: 'icons/sword.png' },
};

export const ITEM_BASE_PRICES = {
  berries: 1,
  seeds: 0.5,
  rabbit: 2,
  wood: 1, stone: 1, ore: 3, plank: 3, brick: 4, ingot: 5, pickaxe: 25,
  branch: 0.5, axe: 18, rough_log: 1, log: 2, beam: 3, chest: 8, chair: 5,
  table: 6, cabin: 20, saw: 15, stone_wall: 8, wood_fence: 6, ladder: 8,
  bridge: 12, knife: 8, hammer: 20, basket: 4, fishing_rod: 10, bow: 15,
  chisel: 12, stone_block: 3, oven: 15, whetstone: 30, forge: 50, tongs: 22, sword: 45,
};

export const RECIPES = {
  // --- WOODWORKING ---
  basket: { id: 'basket', name: 'Basket', inputs: { branch: 3 }, output: { basket: 1 }, skill: 'woodworking', level: 1, xp: 5 },
  logs: { id: 'logs', name: 'Work Logs', inputs: { rough_log: 1 }, output: { log: 1 }, skill: 'woodworking', level: 2, xp: 3, tools: { axe: 1 } },
  beams_from_branch: { id: 'beams_from_branch', name: 'Whittle Beam', inputs: { branch: 2 }, output: { beam: 1 }, skill: 'woodworking', level: 2, xp: 2, tools: { knife: 1 } },
  beams_from_log: { id: 'beams_from_log', name: 'Saw Beams', inputs: { log: 1 }, output: { beam: 4 }, skill: 'woodworking', level: 3, xp: 5, tools: { saw: 1 } },
  planks: { id: 'planks', name: 'Planks', inputs: { log: 1 }, output: { plank: 2 }, skill: 'woodworking', level: 3, xp: 6, tools: { saw: 1 } },
  wood_fence: { id: 'wood_fence', name: 'Wood Fence', inputs: { beam: 4 }, output: { wood_fence: 1 }, skill: 'woodworking', level: 3, xp: 6, category: 'build' },
  ladder: { id: 'ladder', name: 'Ladder', inputs: { beam: 5 }, output: { ladder: 1 }, skill: 'woodworking', level: 4, xp: 10, category: 'build', tools: { axe: 1 } },
  fishing_rod: { id: 'fishing_rod', name: 'Fishing Rod', inputs: { branch: 1 }, output: { fishing_rod: 1 }, skill: 'woodworking', level: 4, xp: 8, tools: { knife: 1 } },
  cabin: { id: 'cabin', name: 'Log Cabin', inputs: { log: 10, beam: 4, plank: 6 }, output: { cabin: 1 }, skill: 'woodworking', level: 5, xp: 25, tools: { hammer: 1, axe: 1 }, category: 'build' },
  bridge: { id: 'bridge', name: 'Bridge', inputs: { log: 4, plank: 6, beam: 2 }, output: { bridge: 1 }, skill: 'woodworking', level: 6, xp: 20, category: 'build', tools: { hammer: 1 } },
  bow: { id: 'bow', name: 'Bow', inputs: { branch: 1 }, output: { bow: 1 }, skill: 'woodworking', level: 7, xp: 12, tools: { knife: 1 } },
  
  // --- STONEWORKING ---
  rock_wall: { id: 'rock_wall', name: 'Rock Wall', inputs: { stone: 4 }, output: { stone_wall: 1 }, skill: 'stoneworking', level: 2, xp: 8, category: 'build' },
  oven: { id: 'oven', name: 'Oven', inputs: { stone: 8 }, output: { oven: 1 }, skill: 'stoneworking', level: 3, xp: 15, category: 'build' },
  stone_blocks: { id: 'stone_blocks', name: 'Stone Blocks', inputs: { stone: 2 }, output: { stone_block: 1 }, skill: 'stoneworking', level: 3, xp: 4, tools: { hammer: 1, chisel: 1 } },
  stone_wall_strong: { id: 'stone_wall_strong', name: 'Reinforced Stone Wall', inputs: { stone_block: 6 }, output: { stone_wall: 1 }, skill: 'stoneworking', level: 4, xp: 12, category: 'build', tools: { hammer: 1, chisel: 1 } },
  whetstone: { id: 'whetstone', name: 'Whetstone', inputs: { stone_block: 1 }, output: { whetstone: 1 }, skill: 'stoneworking', level: 5, xp: 20, tools: { hammer: 1, chisel: 1 } },
  stone_house: { id: 'stone_house', name: 'Stone House', inputs: { stone_block: 20 }, output: { cabin: 1 }, skill: 'stoneworking', level: 6, xp: 50, category: 'build' },
  forge: { id: 'forge', name: 'Forge', inputs: { stone_block: 8 }, output: { forge: 1 }, skill: 'stoneworking', level: 7, xp: 40, category: 'build' },

  // --- METALWORKING ---
  knife: { id: 'knife', name: 'Knife', inputs: { ingot: 1 }, output: { knife: 1 }, skill: 'metalworking', level: 3, xp: 10, tools: { hammer: 1, whetstone: 1 } },
  chisel: { id: 'chisel', name: 'Chisel', inputs: { ingot: 1 }, output: { chisel: 1 }, skill: 'metalworking', level: 3, xp: 10, tools: { hammer: 1, whetstone: 1 } },
  axe: { id: 'axe', name: 'Axe', inputs: { ingot: 1, branch: 1 }, output: { axe: 1 }, skill: 'metalworking', level: 4, xp: 15, tools: { hammer: 1, whetstone: 1 } },
  pickaxe: { id: 'pickaxe', name: 'Pickaxe', inputs: { ingot: 2, branch: 1 }, output: { pickaxe: 1 }, skill: 'metalworking', level: 4, xp: 20, tools: { hammer: 1, whetstone: 1 } },
  smelt_ingot: { id: 'smelt_ingot', name: 'Smelt Ingot', inputs: { ore: 2 }, output: { ingot: 1 }, skill: 'metalworking', level: 5, xp: 8, tools: { forge: 1 } },
  hammer: { id: 'hammer', name: 'Hammer', inputs: { ingot: 2, branch: 1 }, output: { hammer: 1 }, skill: 'metalworking', level: 6, xp: 25, tools: { forge: 1, tongs: 1, hammer: 1 } },
  tongs: { id: 'tongs', name: 'Tongs', inputs: { ingot: 1 }, output: { tongs: 1 }, skill: 'metalworking', level: 7, xp: 18, tools: { forge: 1, tongs: 1, hammer: 1 } },
  sword: { id: 'sword', name: 'Sword', inputs: { ingot: 3 }, output: { sword: 1 }, skill: 'metalworking', level: 7, xp: 35, tools: { forge: 1, tongs: 1, hammer: 1, whetstone: 1 } },
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
