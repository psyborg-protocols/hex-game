// panels/stash.js — the hut's stash: click to move a stack between pack and hut.
// What is in the stash is safe from death, but not from raiders who burn the hut.

import { ITEMS } from '../../game/state.js';
import { addItem, removeItem, countItem, capacity, usedSlots } from '../../game/inventory.js';
import { icon, escapeHtml } from '../ui.js';

function grid(slots, side) {
  return slots.map((s, i) => s
    ? `<button class="slot" data-${side}="${i}" title="${escapeHtml(ITEMS[s.id]?.name || s.id)}">${icon(ITEMS[s.id], 28)}${s.qty > 1 ? `<span class="qty">${s.qty}</span>` : ''}</button>`
    : '<div class="slot empty"></div>').join('');
}

/** Put a stack into the stash, merging with what is already there. */
function stashAdd(state, id, qty) {
  const stack = ITEMS[id]?.stack || 1;
  let left = qty;
  for (const s of state.stash) if (s && s.id === id && left > 0) { const n = Math.min(stack - s.qty, left); s.qty += n; left -= n; }
  for (let i = 0; i < state.stash.length && left > 0; i++) {
    if (state.stash[i]) continue;
    const n = Math.min(stack, left);
    state.stash[i] = { id, qty: n };
    left -= n;
  }
  return qty - left;
}

export const stashPanel = {
  title: () => 'Hut Stash',
  wide: true,

  render(game) {
    const s = game.state;
    return `<p class="dim">Click to move a stack. Anything here survives your death &mdash;
        but if raiders burn the hut, they carry it off.</p>
      <div class="trade-cols">
        <div><h3>Pack <span class="dim">${usedSlots(s)}/${capacity(s)}</span></h3><div class="slots">${grid(s.inventory.slice(0, capacity(s)), 'pack')}</div></div>
        <div><h3>Stash</h3><div class="slots">${grid(s.stash, 'stash')}</div></div>
      </div>`;
  },

  bind(game, body) {
    const s = game.state;
    for (const b of body.querySelectorAll('[data-pack]')) {
      b.addEventListener('click', () => {
        const slot = s.inventory[+b.dataset.pack];
        if (!slot) return;
        const moved = stashAdd(s, slot.id, slot.qty);
        if (moved) removeItem(s, slot.id, Math.min(moved, countItem(s, slot.id)));
        game.ui.refreshPanel();
      });
    }
    for (const b of body.querySelectorAll('[data-stash]')) {
      b.addEventListener('click', () => {
        const i = +b.dataset.stash;
        const slot = s.stash[i];
        if (!slot) return;
        const got = addItem(s, slot.id, slot.qty);
        slot.qty -= got;
        if (slot.qty <= 0) s.stash[i] = null;
        if (!got) game.ui.notify('Your pack is full.');
        game.ui.refreshPanel();
      });
    }
  },
};
