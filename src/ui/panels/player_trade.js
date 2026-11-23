// panels/player_trade.js — trading face to face with another player.
//
// Your side: what from your pack, and how much gold, you put on the table.
// Their side: what they put on it, as they change it. Both press Accept; any
// change takes both acceptances back. See src/net/trade.js.

import { ITEMS, itemName } from '../../game/state.js';
import { countInPack } from '../../game/inventory.js';
import { icon, escapeHtml } from '../ui.js';

function offerList(items, gold) {
  const rows = Object.entries(items).map(([id, n]) => `<div class="trade-row">
      ${icon(ITEMS[id], 22)}<span>${escapeHtml(itemName(id))}</span><b>${n}</b></div>`);
  if (gold) rows.push(`<div class="trade-row"><span class="coin">&#9679;</span><span>Gold</span><b>${gold}</b></div>`);
  return rows.join('') || '<p class="dim">Nothing yet.</p>';
}

export const playerTradePanel = {
  title: (props, game) => {
    const tr = game.mp?.trade;
    const name = tr && game.mp.roster.find(p => p.id === tr.them)?.name;
    return escapeHtml(name ? `Trade with ${name}` : 'Trade');
  },

  render(game) {
    const tr = game.mp?.trade;
    if (!tr) return '<p class="dim">No trade open.</p>';
    const name = escapeHtml(game.mp.roster.find(p => p.id === tr.them)?.name || 'them');
    const { state } = game;
    const open = tr.status === 'open';

    if (tr.status === 'cancelled') {
      return `<p class="lede">The trade is off${tr.note ? `: ${escapeHtml(tr.note)}` : ''}.</p>
        <div class="message-buttons"><button class="big" data-close>Close</button></div>`;
    }
    if (tr.status === 'done') {
      return `<p class="lede">Done. You traded with ${name}.</p>
        <div class="message-buttons"><button class="big primary" data-close>Close</button></div>`;
    }

    // What's in your pack, a row per item, with how many of it you're offering.
    const stock = {};
    for (const s of state.inventory) if (s) stock[s.id] = countInPack(state, s.id);
    const mine = Object.entries(stock).map(([id, have]) => {
      const n = tr.mine.items[id] || 0;
      return `<div class="trade-row${n ? ' offered' : ''}">
        ${icon(ITEMS[id], 22)}<span>${escapeHtml(itemName(id))}</span><span class="dim">have ${have}</span>
        <span class="stepper">
          <button type="button" data-less="${id}" ${!open || !n ? 'disabled' : ''} aria-label="Offer one fewer ${escapeHtml(itemName(id))}">&minus;</button>
          <b>${n}</b>
          <button type="button" data-more="${id}" ${!open || n >= have ? 'disabled' : ''} aria-label="Offer one more ${escapeHtml(itemName(id))}">+</button>
        </span></div>`;
    }).join('') || '<p class="dim">Your pack is empty.</p>';

    const status = tr.status === 'ready'
      ? 'Both accepted. Swapping…'
      : tr.accepted.me && tr.accepted.them ? 'Both accepted.'
        : tr.accepted.me ? `You accepted. Waiting for ${name}.`
          : tr.accepted.them ? `${name} has accepted these offers.`
            : 'Change anything and both acceptances are taken back.';

    return `
      <div class="trade-cols">
        <div><h3>You give</h3>
          <div class="trade">${mine}</div>
          <label class="trade-row gold-row"><span class="coin">&#9679;</span><span>Gold</span><span class="dim">have ${state.gold}</span>
            <input type="number" id="pt-gold" min="0" max="${state.gold}" value="${tr.mine.gold}" ${open ? '' : 'disabled'}></label>
        </div>
        <div><h3>${name} gives</h3><div class="trade">${offerList(tr.theirs.items, tr.theirs.gold)}</div></div>
      </div>
      <p class="trade-status${tr.accepted.them ? ' them' : ''}" role="status">${status}</p>
      <div class="message-buttons">
        <button class="big" data-cancel>Cancel</button>
        <button class="big primary" data-accept ${!open || tr.accepted.me ? 'disabled' : ''}>${tr.accepted.me ? 'Accepted' : 'Accept'}</button>
      </div>`;
  },

  bind(game, body) {
    const mp = game.mp;
    const tr = mp?.trade;
    body.querySelector('[data-close]')?.addEventListener('click', () => { mp.trade = null; game.ui.closePanel(); });
    if (!tr) return;
    const offer = (items, gold) => mp.tradeOffer(items, gold);
    for (const b of body.querySelectorAll('[data-more]')) {
      b.addEventListener('click', () => {
        const id = b.dataset.more;
        offer({ ...tr.mine.items, [id]: (tr.mine.items[id] || 0) + 1 }, tr.mine.gold);
      });
    }
    for (const b of body.querySelectorAll('[data-less]')) {
      b.addEventListener('click', () => {
        const id = b.dataset.less;
        offer({ ...tr.mine.items, [id]: Math.max(0, (tr.mine.items[id] || 0) - 1) }, tr.mine.gold);
      });
    }
    body.querySelector('#pt-gold')?.addEventListener('change', e => {
      const gold = Math.max(0, Math.min(game.state.gold, Math.floor(+e.target.value || 0)));
      offer(tr.mine.items, gold);
    });
    body.querySelector('[data-accept]')?.addEventListener('click', () => mp.tradeAccept());
    body.querySelector('[data-cancel]')?.addEventListener('click', () => {
      mp.cancelTrade('cancelled');
      mp.trade = null;
      game.ui.closePanel();
    });
  },
};
