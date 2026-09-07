// panels/inventory.js — what you are carrying, and what it is doing for you.

import { ITEMS } from '../../game/state.js';
import { foodValue } from '../../game/inventory.js';
import { icon, escapeHtml } from '../ui.js';

export const inventoryPanel = {
  title: () => 'Pack',

  render(game) {
    const { state } = game;
    const slots = state.inventory.map((slot, i) => {
      if (!slot) return `<div class="slot empty"></div>`;
      const item = ITEMS[slot.id];
      return `<div class="slot" data-slot="${i}" title="${escapeHtml(item.name)}">
        ${icon(item, 28)}
        <span class="qty">${slot.qty}</span>
      </div>`;
    }).join('');

    const larder = state.inventory
      .filter(s => s && ITEMS[s.id]?.food)
      .map(s => {
        const item = ITEMS[s.id];
        return `<button class="line eat" data-eat="${s.id}">
          ${icon(item, 20)} <span>${escapeHtml(item.name)}</span>
          <span class="dim">${s.qty} &times; ${item.food} energy</span>
        </button>`;
      }).join('') || '<p class="dim">Nothing to eat. Energy is the food you carry.</p>';

    return `
      <p class="dim">Energy is your provisions: <b>${foodValue(state)}</b> carried,
         capped at ${state.maxEnergy}.</p>
      <div class="slots">${slots}</div>
      <h3>Larder</h3>
      ${larder}`;
  },

  bind(game, body) {
    for (const btn of body.querySelectorAll('[data-eat]')) {
      btn.addEventListener('click', () => game.doEat(btn.dataset.eat));
    }
  },
};
