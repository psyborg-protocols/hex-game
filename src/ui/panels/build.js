// panels/build.js
// The structures you can put up. Choosing one arms placement mode; the map then
// highlights the columns that will take it and the next click sites it.

import { ITEMS, RECIPES } from '../../game/state.js';
import { checkRecipe } from '../../game/crafting.js';
import { icon, escapeHtml } from '../ui.js';

export const buildPanel = {
  title: () => 'Build',

  render(game) {
    const ctx = game.craftingContext();
    const buildable = Object.values(RECIPES).filter(r => r.category === 'build');

    const rows = buildable
      .map(r => ({ r, check: checkRecipe(game.state, r.id, ctx) }))
      .sort((a, b) => (b.check.ok - a.check.ok)
        || (a.r.level - b.r.level)
        || (a.check.reasons.length - b.check.reasons.length))
      .map(({ r, check }) => {
        const item = ITEMS[Object.keys(r.output)[0]];
        const inputs = Object.entries(r.inputs).map(([id, qty]) =>
          `<span class="ingredient">${icon(ITEMS[id], 16)} ${qty}</span>`).join('');
        const why = check.ok ? ''
          : `<ul class="why">${check.reasons.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`;
        return `<div class="recipe${check.ok ? '' : ' locked'}">
          <div class="recipe-head">
            ${icon(item, 28)}
            <div><b>${escapeHtml(r.name)}</b>
              <span class="dim">${r.skill} ${r.level}</span></div>
            <button data-site="${r.id}" ${check.ok ? '' : 'disabled'}>Site it</button>
          </div>
          <div class="ingredients">${inputs}</div>
          ${why}
        </div>`;
      }).join('');

    return `<p class="dim">Sited on the hex you are on or one beside it, on level ground.</p>
      <div class="recipes">${rows}</div>`;
  },

  bind(game, body) {
    for (const btn of body.querySelectorAll('[data-site]')) {
      btn.addEventListener('click', () => game.beginPlacement(btn.dataset.site));
    }
  },
};
