// panels/build.js
// The structures you can put up. Choosing one arms placement mode; the map then
// highlights the hexes that will take it and the next click sites it.

import { RECIPES } from '../../game/state.js';
import { checkRecipe, recipeKnown } from '../../game/crafting.js';
import { recipeRow } from './crafting.js';

export const buildPanel = {
  title: () => 'Build',
  wide: true,

  render(game) {
    const ctx = game.craftingContext();
    const rows = Object.values(RECIPES).filter(r => r.category === 'build' && recipeKnown(game.state, r))
      .map(r => ({ r, check: checkRecipe(game.state, r.id, ctx) }))
      .sort((a, b) => (b.check.ok - a.check.ok) || (a.r.level - b.r.level))
      .map(({ r, check }) => recipeRow(game, r, check, { action: 'site' })).join('');

    const empty = '<p class="dim">Gather stone, wood, or grain to discover what you can build.</p>';
    return `<div class="recipes">${rows || empty}</div>`;
  },

  bind(game, body) {
    for (const btn of body.querySelectorAll('[data-site]')) {
      btn.addEventListener('click', () => game.beginPlacement(btn.dataset.site));
    }
  },
};
