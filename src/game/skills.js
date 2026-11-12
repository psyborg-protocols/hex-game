// skills.js
// Five skills, five levels each. Every level opens something you can make or do;
// there are no empty levels.

import { SKILL_INFO, SKILLS, MAX_LEVEL } from './state.js';

export { SKILLS, MAX_LEVEL };

const CURVE = [0, 10, 25, 50, 80];
export const xpToNext = level => CURVE[level] ?? 999;

export const levelOf = (state, skill) => state.skills[skill]?.level ?? 0;

export function meetsLevel(state, skill, level) {
  return levelOf(state, skill) >= level;
}

/**
 * Award xp, rolling over as many levels as it earns.
 * @returns {number[]} the levels reached, for the UI to announce.
 */
export function addXp(state, skill, xp) {
  const s = state.skills[skill];
  if (!s || !xp) return [];
  const gained = [];
  s.xp += xp;
  while (s.level < MAX_LEVEL && s.xp >= xpToNext(s.level)) {
    s.xp -= xpToNext(s.level);
    s.level++;
    gained.push(s.level);
  }
  if (s.level >= MAX_LEVEL) s.xp = 0;
  return gained;
}

/** Progress towards the next level, 0..1. */
export function progress(state, skill) {
  const s = state.skills[skill];
  if (!s || s.level >= MAX_LEVEL) return 1;
  return Math.min(1, s.xp / xpToNext(s.level));
}

/** What this level of a skill lets you do, from SKILL_INFO. */
export const abilitiesAt = (skill, level) => SKILL_INFO[skill]?.[level] || [];

export function unlockedAbilities(state, skill) {
  const out = [];
  for (let l = 1; l <= levelOf(state, skill); l++) {
    for (const line of abilitiesAt(skill, l)) out.push({ level: l, text: line });
  }
  return out;
}

export const skillIcon = skill => `icons/skills/${skill}.svg`;
export const abilityIcon = (skill, level) => `icons/abilities/${skill}_lvl${level}.svg`;
