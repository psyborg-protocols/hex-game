// panels/crafting.js
// Recipes, each showing exactly what stands in its way. The first tab is what
// you can make right now; the rest are the five skills.

import { ITEMS, SKILLS, isBuilding, RECIPES } from '../../game/state.js';
import { checkRecipe, recipesBySkill } from '../../game/crafting.js';
import { skillIcon, levelOf } from '../../game/skills.js';
import { countItem } from '../../game/inventory.js';
import { icon, escapeHtml } from '../ui.js';

export function recipeRow(game, recipe, check, { action = 'craft' } = {}) {
  const out = Object.entries(recipe.output)[0];
  const item = ITEMS[out[0]];
  const inputs = Object.entries(recipe.inputs || {}).map(([id, qty]) => {
    const have = countItem(game.state, id);
    return `<span class="ingredient${have < qty ? ' short' : ''}" title="${escapeHtml(ITEMS[id]?.name || id)}">
      ${icon(ITEMS[id], 16)} ${qty}<span class="dim">/${have}</span></span>`;
  }).join('') || '<span class="dim">nothing but effort</span>';
  const span = recipe.perSpan ? Object.entries(recipe.perSpan).map(([id, n]) =>
    `<span class="ingredient">${icon(ITEMS[id], 16)} ${n} per hex of water</span>`).join('') : '';
  const tools = (recipe.tools || []).map(slot => {
    const ids = Array.isArray(slot) ? slot : [slot];
    return `<span class="tool">${ids.map(t => escapeHtml(ITEMS[t]?.name || t)).join(' / ')}</span>`;
  }).join('');

  const why = check.ok ? '' : `<ul class="why">${check.reasons.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>`;
  const build = isBuilding(out[0]);

  return `<div class="recipe${check.ok ? ' ready' : ' locked'}">
    <div class="recipe-head">
      ${icon(item, 30)}
      <div>
        <b>${escapeHtml(recipe.name)}${out[1] > 1 ? ` <span class="dim">&times;${out[1]}</span>` : ''}</b>
        <span class="desc">${escapeHtml(item?.desc || '')}</span>
      </div>
      <button data-${action}="${recipe.id}" ${check.ok ? '' : 'disabled'}>${build ? 'Build' : 'Make'}</button>
    </div>
    <div class="ingredients">${inputs}${span}${tools ? `<span class="tools dim">with ${tools}</span>` : ''}
      <span class="dim lvl">${recipe.skill} ${recipe.level}</span></div>
    ${why}
  </div>`;
}

const sortRows = rows => rows.sort((a, b) => (b.check.ok - a.check.ok)
  || (a.r.level - b.r.level) || (a.check.reasons.length - b.check.reasons.length));

export const craftingPanel = {
  title: () => 'Craft',
  wide: true,

  render(game, props = {}) {
    const tab = props.skill || 'ready';
    const ctx = game.craftingContext();
    const groups = recipesBySkill();

    const tabs = [`<button class="tab${tab === 'ready' ? ' on' : ''}" data-skill="ready">&#10022; Ready</button>`,
      ...SKILLS.map(s => `<button class="tab${s === tab ? ' on' : ''}" data-skill="${s}">
        <img src="${skillIcon(s)}" alt="" width="18" height="18"> ${s} <b>${levelOf(game.state, s)}</b></button>`)].join('');

    let list;
    if (tab === 'ready') {
      list = Object.values(RECIPES).map(r => ({ r, check: checkRecipe(game.state, r.id, ctx) }))
        .filter(x => x.check.ok);
    } else {
      list = (groups[tab] || []).map(r => ({ r, check: checkRecipe(game.state, r.id, ctx) }));
    }
    const rows = sortRows(list).map(({ r, check }) => recipeRow(game, r, check)).join('');

    const where = ctx.village
      ? `<p class="where">At ${escapeHtml(ctx.village.name)}. ${ctx.village.trusted
        ? `You may work at their ${escapeHtml(ITEMS[ctx.village.station]?.name || ctx.village.station)}.`
        : 'Earn their trust and you may use their workshop.'}</p>` : '';

    const empty = tab === 'ready'
      ? '<p class="dim">Nothing you can make right now. Look under a skill to see what each recipe is waiting on.</p>'
      : '';
    return `<div class="tabs">${tabs}</div>${where}<div class="recipes">${rows || empty}</div>`;
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
