// panels/trade.js — a village's stock, and what it will take off your hands.

import { ITEMS } from '../../game/state.js';
import { stockOf } from '../../game/economy.js';
import { countItem } from '../../game/inventory.js';
import { icon, escapeHtml } from '../ui.js';

export const tradePanel = {
  title: (props) => `Trade at ${props.village?.feature?.name || 'the village'}`,

  render(game, props) {
    const { state } = game;
    const col = props.village;
    const prices = stockOf(state, col.q, col.r);

    const rows = Object.entries(prices).map(([id, price]) => {
      const item = ITEMS[id];
      const have = countItem(state, id);
      const sellFor = Math.max(1, Math.floor(price / 2));
      return `<div class="trade-row">
        ${icon(item, 24)}
        <span>${escapeHtml(item.name)}</span>
        <span class="dim">you have ${have}</span>
        <button data-buy="${id}" ${state.gold < price ? 'disabled' : ''}>Buy ${price}g</button>
        <button data-sell="${id}" ${have ? '' : 'disabled'}>Sell ${sellFor}g</button>
      </div>`;
    }).join('');

    const tools = (col.feature.rentableTools || [])
      .map(t => escapeHtml(ITEMS[t]?.name || t)).join(', ');

    return `
      <p class="dim">You have <b>${state.gold}</b> gold.
        They buy back at half what they ask.</p>
      <div class="trade">${rows || '<p class="dim">The stalls are bare.</p>'}</div>
      <h3>Workshop</h3>
      <p class="dim">${tools
        ? `While you are here you may work with their ${tools} for a fee.`
        : 'They have no tools to lend.'}</p>`;
  },

  bind(game, body, props) {
    const col = props.village;
    for (const btn of body.querySelectorAll('[data-buy]')) {
      btn.addEventListener('click', () => game.doBuy(col, btn.dataset.buy));
    }
    for (const btn of body.querySelectorAll('[data-sell]')) {
      btn.addEventListener('click', () => game.doSell(col, btn.dataset.sell));
    }
  },
};
