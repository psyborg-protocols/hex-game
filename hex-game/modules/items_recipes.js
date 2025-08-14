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
  // ADDED: New buildable items
  ladder: { id: 'ladder', name: 'Ladder', stack: 99, icon: 'icons/ladder.png' },
  bridge: { id: 'bridge', name: 'Bridge', stack: 99, icon: 'icons/bridge.png' }
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
  // ADDED: Prices for new items
  ladder: 8,
  bridge: 12
};

export const RECIPES = {
  logs: {
    id: 'logs', name: 'Logs', inputs: { rough_log: 1 }, output: { log: 1 },
    skill: 'woodworking', level: 1, xp: 3, tools: { axe: 1 }
  },
  beams: {
    id: 'beams', name: 'Beams', inputs: { branch: 3 }, output: { beam: 1 },
    skill: 'woodworking', level: 2, xp: 4
  },
  planks: {
    id: 'planks', name: 'Planks', inputs: { log: 1 }, output: { plank: 2 },
    skill: 'woodworking', level: 3, xp: 6, tools: { saw: 1 }
  },
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
  cabin: {
    id: 'cabin', name: 'Log Cabin', inputs: { log: 8, beam: 4 }, output: { cabin: 1 },
    skill: 'woodworking', level: 4, xp: 20, tools: { saw: 1 }, category: 'build'
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
  wood_fence: {
    id: 'wood_fence', name: 'Wood Fence', inputs: { beam: 2 }, output: { wood_fence: 1 },
    skill: 'woodworking', level: 2, xp: 6, category: 'build'
  },
  // ADDED: New buildable recipes
  ladder: {
    id: 'ladder', name: 'Ladder', inputs: { beam: 3, branch: 4 }, output: { ladder: 1 },
    skill: 'woodworking', level: 2, xp: 10, category: 'build'
  },
  bridge: {
    id: 'bridge', name: 'Bridge', inputs: { log: 2, plank: 4 }, output: { bridge: 1 },
    skill: 'woodworking', level: 3, xp: 15, category: 'build'
  }
};
