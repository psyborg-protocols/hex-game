// to_json.js — exports data/game_data.js as pure JSON.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// A Windows absolute path is not a URL the ESM loader accepts, so hand it one.
const mod = await import(pathToFileURL(path.join(__dirname, '..', 'data', 'game_data.js')));
const out = {
  ITEMS: mod.ITEMS,
  ITEM_BASE_PRICES: mod.ITEM_BASE_PRICES,
  RECIPES: mod.RECIPES,
  SKILL_INFO: mod.SKILL_INFO,
  SKILL_DEPS: mod.SKILL_DEPS,
  CIRCULAR_DEPS: mod.CIRCULAR_DEPS,
  CROSS_SKILL_GATES: mod.CROSS_SKILL_GATES,
};
writeFileSync(path.join(__dirname, '..', 'data', 'game_data.json'), JSON.stringify(out, null, 2));
console.log('wrote data/game_data.json');
