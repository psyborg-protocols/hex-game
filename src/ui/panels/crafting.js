// panels/crafting.js
// Recipes grouped by skill, each showing exactly what is standing in its way.
//
// With five skills, seven levels, any-of tool slots and world gates, a list that
// only distinguishes "can" from "cannot" tells the player nothing about where to
// go next. So every locked recipe carries its reasons, and the list is sorted so
// the things you are closest to making sit at the top.

import { ITEMS, RECIPES, SKILLS, isBuilding } from '../../game/state.js';
import { checkRecipe, recipesBySkill } from '../../game/crafting.js';
import { skillIcon } from '../../game/skills.js';
import { icon, escapeHtml } from '../ui.js';

function recipeRow(game, recipe, check) {
  const out = Object.entries(recipe.output)[0];
  const item = ITEMS[out[0]];
  const inputs = Object.entries(recipe.inputs || {}).map(([id, qty]) => {
    const have = game.state.inventory.reduce((n, s) => n + (s && s.id === id ? s.qty : 0), 0);
    const short = have < qty;
    return `<span class="ingredient${short ? ' short' : ''}">
      ${icon(ITEMS[id], 16)} ${qty}<span class="dim">/${have}</span>
    </span>`;
  }).join('') || '<span class="dim">nothing but effort</span>';

  const why = check.ok ? '' :
    `<ul class="why">${check.reasons.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>`;

  return `<div class="recipe${check.ok ? '' : ' locked'}">
    <div class="recipe-head">
      ${icon(item, 28)}
      <div>
        <b>${escapeHtml(recipe.name)}</b>
        <span class="dim">lvl ${recipe.level}${out[1] > 1 ? ` &middot; makes ${out[1]}` : ''}</span>
      </div>
      <button data-craft="${recipe.id}" ${check.ok ? '' : 'disabled'}>
        ${isBuilding(out[0]) ? 'Build' : 'Make'}
      </button>
    </div>
    <div class="ingredients">${inputs}</div>
    ${why}
  </div>`;
}

export const craftingPanel = {
  title: () => 'Craft',

  render(game, props = {}) {
    const skill = props.skill || SKILLS[0];
    const ctx = game.craftingContext();
    const groups = recipesBySkill();

    const tabs = SKILLS.map(s => `<button class="tab${s === skill ? ' on' : ''}" data-skill="${s}">
        <img src="${skillIcon(s)}" alt="" width="18" height="18"> ${s}
      </button>`).join('');

    const rows = (groups[skill] || [])
      .map(r => ({ r, check: checkRecipe(game.state, r.id, ctx) }))
      // Craftable first, then up the ladder. Level before blocker-count: the
      // skill tree is a progression, and a level 2 recipe with three obstacles
      // sitting above a level 1 recipe with four reads as noise.
      .sort((a, b) => (b.check.ok - a.check.ok)
        || (a.r.level - b.r.level)
        || (a.check.reasons.length - b.check.reasons.length))
      .map(({ r, check }) => recipeRow(game, r, check))
      .join('');

    const where = ctx.village
      ? `<p class="dim">At ${escapeHtml(ctx.village.name)}. You may borrow:
         ${(ctx.village.rentableTools || []).map(t => escapeHtml(ITEMS[t]?.name || t)).join(', ') || 'nothing'}.</p>`
      : '';

    return `<div class="tabs">${tabs}</div>${where}<div class="recipes">${rows}</div>`;
  },

  bind(game, body, props = {}) {
    for (const tab of body.querySelectorAll('[data-skill]')) {
      tab.addEventListener('click', () => {
        game.ui.currentPanel.props = { ...props, skill: tab.dataset.skill };
        game.ui.refreshPanel();
      });
    }
    for (const btn of body.querySelectorAll('[data-craft]')) {
      btn.addEventListener('click', () => game.doCraft(btn.dataset.craft));
    }
  },
};
