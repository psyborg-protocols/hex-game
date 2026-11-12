// panels/trade.js — a village: its favour first, then its market.

import { ITEMS, itemName } from '../../game/state.js';
import { stockOf, trustOf, isRaided, kindOf, sellPrice, FAVOUR_REWARD, ensureVillage } from '../../game/economy.js';
import { countItem } from '../../game/inventory.js';
import { icon, escapeHtml } from '../ui.js';

export const tradePanel = {
  title: (props) => props.village?.feature?.name || 'Village',
  wide: true,

  render(game, props) {
    const { state } = game;
    const col = props.village;
    const kind = kindOf(col.feature);
    ensureVillage(state, col.feature, col.q, col.r, game.world.seed);
    const trust = trustOf(state, col.q, col.r);
    const station = ITEMS[kind.station]?.name || kind.station;

    const head = `<p class="village-kind"><b>${escapeHtml(kind.name)}</b>
      <span class="dim">&middot; sell ${kind.sells.map(itemName).map(escapeHtml).join(', ')} &middot; keep a ${escapeHtml(station)}</span></p>`;

    if (!trust?.done) {
      const { item, qty } = trust.favour;
      const have = countItem(state, item);
      return `${head}
        <div class="favour">
          <p class="elder">&ldquo;We don't trade with strangers. Do us a turn first &mdash;
            bring us <b>${qty} ${escapeHtml(itemName(item))}</b>, and you'll find us friendly.&rdquo;</p>
          <div class="trade-row">${icon(ITEMS[item], 28)}<span>${qty} &times; ${escapeHtml(itemName(item))}</span>
            <span class="dim">you have ${have}</span>
            <button data-favour ${have >= qty || state.free ? '' : 'disabled'}>Hand them over</button></div>
          <p class="dim">Their reward: ${FAVOUR_REWARD} gold, a market, the use of their ${escapeHtml(station)},
            and what they know of the land around them.</p>
          <p class="dim hint">${escapeHtml(ITEMS[item]?.desc || '')}</p>
        </div>`;
    }

    if (isRaided(state, col.q, col.r)) {
      return `${head}<p class="raided">Raiders have been through. The stalls are smashed &mdash; come back tomorrow.</p>`;
    }

    const prices = stockOf(state, col.q, col.r);
    const buyRows = Object.entries(prices).map(([id, price]) => `<div class="trade-row">
        ${icon(ITEMS[id], 24)}<span>${escapeHtml(itemName(id))}</span>
        <span class="dim">have ${countItem(state, id)}</span>
        <button data-buy="${id}" ${state.gold < price && !state.free ? 'disabled' : ''}>Buy ${price}g</button></div>`).join('');

    const seen = new Set();
    const sellRows = state.inventory.filter(s => s && !seen.has(s.id) && seen.add(s.id)).map(s => `<div class="trade-row">
        ${icon(ITEMS[s.id], 24)}<span>${escapeHtml(itemName(s.id))}</span>
        <span class="dim">have ${countItem(state, s.id)}</span>
        <button data-sell="${s.id}">Sell ${sellPrice(col.feature, s.id)}g</button></div>`).join('');

    return `${head}
      <p class="dim">You have <b>${state.gold}</b> gold. You may use their ${escapeHtml(station)} while you stand here.</p>
      <div class="trade-cols">
        <div><h3>They sell</h3><div class="trade">${buyRows}</div></div>
        <div><h3>They buy</h3><div class="trade">${sellRows || '<p class="dim">Your pack is empty.</p>'}</div></div>
      </div>`;
  },

  bind(game, body, props) {
    const col = props.village;
    body.querySelector('[data-favour]')?.addEventListener('click', () => game.doFavour(col));
    for (const btn of body.querySelectorAll('[data-buy]')) btn.addEventListener('click', () => game.doBuy(col, btn.dataset.buy));
    for (const btn of body.querySelectorAll('[data-sell]')) btn.addEventListener('click', () => game.doSell(col, btn.dataset.sell));
  },
};
