// panels/skills.js — five tracks, seven levels, and what each one opened up.

import { SKILLS, MAX_LEVEL } from '../../game/state.js';
import { levelOf, progress, abilitiesAt, skillIcon, abilityIcon, xpToNext } from '../../game/skills.js';
import { escapeHtml } from '../ui.js';
import { completedAchievements } from '../../game/mind.js';

/**
 * What Mind has found so far. Only what is done is listed: the achievements are
 * meant to be stumbled on, so the panel never shows what is left.
 */
function discoveries(state) {
  const mind = state.mind || {};
  const tiers = [0, 0, 0, 0];
  for (const t of Object.values(mind.explored || {})) tiers[t]++;
  const explored = tiers.reduce((a, b) => a + b, 0);
  const done = completedAchievements(state);
  const finds = [['copper', tiers[1]], ['silver', tiers[2]], ['gold', tiers[3]]]
    .filter(([, n]) => n).map(([t, n]) => `<span class="find ${t}">${n} ${t}</span>`).join(' ');
  return `<div class="discoveries">
    <p class="dim">${explored} ${explored === 1 ? 'place' : 'places'} explored${finds ? ` &middot; ${finds}` : ''}</p>
    ${done.length ? `<ul class="achievements">${done.map(a => `<li>${escapeHtml(a.name)}</li>`).join('')}</ul>` : ''}
  </div>`;
}

export const skillsPanel = {
  title: () => 'Skills',

  render(game) {
    const { state } = game;
    return SKILLS.map(skill => {
      const level = levelOf(state, skill);
      const pct = Math.round(progress(state, skill) * 100);
      const xp = state.skills[skill].xp;

      const levels = Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map(l => {
        const known = l <= level;
        const lines = abilitiesAt(skill, l)
          .map(t => `<li>${escapeHtml(t)}</li>`).join('');
        return `<div class="ability${known ? '' : ' locked'}">
          <img src="${abilityIcon(skill, l)}" alt="" width="24" height="24">
          <div><b>Level ${l}</b><ul>${lines}</ul></div>
        </div>`;
      }).join('');

      return `<section class="skill-block">
        <header>
          <img src="${skillIcon(skill)}" alt="" width="28" height="28">
          <h3>${skill}</h3>
          <b>${level}</b>
          <span class="dim">${level >= MAX_LEVEL ? 'mastered' : `${xp} / ${xpToNext(level)} xp`}</span>
        </header>
        <div class="xp-bar"><i style="width:${pct}%"></i></div>
        ${skill === 'mind' ? discoveries(state) : ''}
        <div class="abilities">${levels}</div>
      </section>`;
    }).join('');
  },
};
