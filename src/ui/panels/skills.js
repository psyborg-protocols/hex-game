// panels/skills.js — five tracks, seven levels, and what each one opened up.

import { SKILLS, MAX_LEVEL } from '../../game/state.js';
import { levelOf, progress, abilitiesAt, skillIcon, abilityIcon, xpToNext } from '../../game/skills.js';
import { escapeHtml } from '../ui.js';

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
        <div class="abilities">${levels}</div>
      </section>`;
    }).join('');
  },
};
