// journey.js
// The spine of the game: five stages, each a handful of goals, always shown in
// the corner so you know what to reach for next. These are not quests — nobody
// asks you for anything — they are the milestones the gates naturally fall into,
// named, so the game never leaves you wondering what it is for.

import { hasBuilt, isNight } from './state.js';
import { countItem } from './inventory.js';
import { levelOf } from './skills.js';
import { campsLeft, allCamps } from './raiders.js';

const has = (s, id) => countItem(s, id) > 0;
const trusted = s => Object.values(s.trust || {}).filter(t => t.done).length;
const anyOf = (s, ids) => ids.some(id => has(s, id));

export const STAGES = [
  {
    id: 'stranded', name: 'Stranded',
    blurb: 'You have a handful of berries and the clothes you stand in.',
    goals: [
      { id: 'explore5', text: 'Explore 5 places', hint: 'Stand still on a hex for a moment to explore it.', test: s => Object.keys(s.mind?.explored || {}).length >= 5 },
      { id: 'cord', text: 'Twist some cord', hint: 'Cut reeds at the water’s edge, then Craft → Woodworking.', test: s => has(s, 'cord') || has(s, 'stone_axe') || has(s, 'stone_hammer') },
      { id: 'axe', text: 'Make a stone axe', hint: 'Stone + branch + cord. Stone lies under any rise.', test: s => anyOf(s, ['stone_axe', 'iron_axe']) },
      { id: 'hearth', text: 'Build a hearth', hint: 'Fell trees for logs, then Build → Hearth.', test: s => hasBuilt(s, 'hearth') },
    ],
  },
  {
    id: 'homestead', name: 'Homestead',
    blurb: 'A fire of your own. Now make it a home.',
    goals: [
      { id: 'meal', text: 'Cook a meal', hint: 'Hunt (with a cord snare) or fish, then cook at your hearth.', test: s => (s.stats?.cooked || 0) > 0 || has(s, 'meal') || has(s, 'stew') },
      { id: 'trust', text: 'Earn a village’s trust', hint: 'Visit a village and do the small favour they ask. Then they will trade.', test: s => trusted(s) >= 1 },
      { id: 'field', text: 'Sow a field', hint: 'Wild grain turns up when you forage meadows. Homesteading 2.', test: s => hasBuilt(s, 'field') || (s.stats?.reaped || 0) > 0 },
      { id: 'hut', text: 'Raise a hut', hint: 'Logs, planks and reed thatch. Homesteading 3.', test: s => hasBuilt(s, 'hut') },
    ],
  },
  {
    id: 'defender', name: 'Hold the Line',
    blurb: 'Smoke across the river. They have seen your fire.',
    goals: [
      { id: 'repel', text: 'Fight off a raid', hint: 'Raiders come every day or two. Walls slow them; towers shoot them.', test: s => (s.stats?.kills || 0) >= 2 },
      { id: 'defence', text: 'Build a watchtower or wall', hint: 'A palisade is logs only. A watchtower doubles your warning.', test: s => ['watchtower', 'palisade', 'stone_wall'].some(i => hasBuilt(s, i)) },
      { id: 'armour', text: 'Arm yourself', hint: 'Hide armour, a shield, or a bow from a workbench.', test: s => anyOf(s, ['hide_armor', 'shield', 'bow', 'iron_mail', 'sword']) },
      { id: 'cross', text: 'Cross the river', hint: 'Build a boat (Woodworking 4) or a bridge (5) — or buy a boat from fishers.', test: (s, w) => !!s.stats?.crossed },
    ],
  },
  {
    id: 'iron', name: 'The Iron Age',
    blurb: 'Stone will not break their camps. Iron will.',
    goals: [
      { id: 'lore', text: 'Learn Lore (Mind 3)', hint: 'Mind grows from exploring: scenic spots, villages, the wild.', test: s => levelOf(s, 'mind') >= 3 },
      { id: 'ore', text: 'Find ore', hint: 'With Lore, Read the Rock on stony ground — or buy it from smiths.', test: s => has(s, 'ore') || has(s, 'ingot') || (s.stats?.smelted || 0) > 0 },
      { id: 'ingot', text: 'Smelt an ingot', hint: 'A forge, tongs, ore and a log. Or a smith village’s forge.', test: s => (s.stats?.smelted || 0) > 0 },
      { id: 'weapon', text: 'Forge iron for war', hint: 'Sword, iron mail, iron axe or pickaxe.', test: s => anyOf(s, ['sword', 'iron_mail', 'iron_axe', 'pickaxe']) },
    ],
  },
  {
    id: 'reckoning', name: 'The Reckoning',
    blurb: 'End the raids. Burn every camp.',
    goals: [
      { id: 'camp1', text: 'Burn a raider camp', hint: 'Kill its guards, then burn it. A rally banner brings help.', test: s => (s.stats?.campsBurned || 0) >= 1 },
      { id: 'warlord', text: 'Defeat the Warlord', hint: 'The Warlord’s Hold is the farthest camp.', test: s => !!s.stats?.warlord },
      { id: 'allcamps', text: 'Burn every camp', hint: 'When the last one burns, the vale is free.', test: (s, w) => w && campsLeft(w.map).length === 0 && allCamps(w.map).length > 0 },
    ],
  },
];

/**
 * Mark any goals newly met.
 * @returns {{goals:Array, stages:Array}} what was completed just now
 */
export function checkJourney(state, world) {
  state.goals ||= {};
  const goals = [];
  const stages = [];
  for (const stage of STAGES) {
    const before = stage.goals.every(g => state.goals[g.id]);
    for (const g of stage.goals) {
      if (state.goals[g.id]) continue;
      try { if (g.test(state, world)) { state.goals[g.id] = 1; goals.push(g); } } catch { /* a goal never breaks the game */ }
    }
    if (!before && stage.goals.every(g => state.goals[g.id])) stages.push(stage);
  }
  return { goals, stages };
}

/** The stage you are on: the first with anything left to do. */
export function currentStage(state) {
  const i = STAGES.findIndex(st => st.goals.some(g => !state.goals?.[g.id]));
  return i < 0 ? { stage: STAGES[STAGES.length - 1], index: STAGES.length - 1, done: true } : { stage: STAGES[i], index: i, done: false };
}

export { isNight };
