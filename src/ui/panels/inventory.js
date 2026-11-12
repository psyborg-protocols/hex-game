// panels/inventory.js — what you carry, and exactly what each thing is for.
//
// "Every item should feel significant" only works if the game tells you the
// significance. Click any slot and it says what the item does, what it makes,
// and what it lets you do.

import { ITEMS, RECIPES, isBuilding } from '../../game/state.js';
import { foodValue, capacity, usedSlots, maxEnergy } from '../../game/inventory.js';
import { attackDice, defenseDice, reach, bestWeapon, maxHp } from '../../game/gear.js';
import { HARVESTS } from '../../game/harvests.js';
import { icon, escapeHtml } from '../ui.js';

/** Plain-English uses of an item, worked out from the recipes and harvests. */
export function usesOf(id) {
  const makes = [], toolFor = [], atFor = [];
  for (const r of Object.values(RECIPES)) {
    if (r.inputs?.[id]) makes.push(r.name);
    for (const slot of r.tools || []) {
      const ids = Array.isArray(slot) ? slot : [slot];
      if (ids.includes(id)) (isBuilding(id) ? atFor : toolFor).push(r.name);
    }
  }
  for (const h of Object.values(HARVESTS)) {
    if (h.tool?.includes(id)) toolFor.push(h.name);
    if (h.bonus?.[id]) toolFor.push(`${h.name} (bonus)`);
  }
  return { makes: [...new Set(makes)], toolFor: [...new Set(toolFor)], atFor: [...new Set(atFor)] };
}

export function itemDetail(id) {
  const item = ITEMS[id];
  if (!item) return '';
  const stats = [];
  if (item.food) stats.push(`${item.food} energy`);
  if (item.heal) stats.push(`heals ${item.heal}`);
  if (item.attack) stats.push(`&#9876; ${item.attack} attack${item.range ? `, reach ${item.range}` : ''}`);
  if (item.defense) stats.push(`&#128737; +${item.defense} defence`);
  if (item.slots) stats.push(`+${item.slots} slots`);
  const u = usesOf(id);
  const list = (label, xs) => xs.length ? `<p><span class="dim">${label}</span> ${xs.map(escapeHtml).join(', ')}</p>` : '';
  return `<div class="detail">
    <div class="detail-head">${icon(item, 36)}<div><b>${escapeHtml(item.name)}</b>
      <span class="dim kind">${item.kind}${stats.length ? ' &middot; ' + stats.join(' &middot; ') : ''}</span></div></div>
    <p>${escapeHtml(item.desc || '')}</p>
    ${list('Goes into:', u.makes)}${list('Tool for:', u.toolFor)}${list('Work here to make:', u.atFor)}
  </div>`;
}

export const inventoryPanel = {
  title: () => 'Pack',

  render(game, props = {}) {
    const { state } = game;
    const cap = capacity(state);
    const slots = state.inventory.slice(0, Math.max(cap, usedSlots(state))).map((slot, i) => {
      if (!slot) return `<div class="slot empty"></div>`;
      const item = ITEMS[slot.id];
      const sel = props.selected === slot.id ? ' selected' : '';
      return `<button class="slot${sel}" data-item="${slot.id}" title="${escapeHtml(item?.name || slot.id)}">
        ${icon(item, 28)}${slot.qty > 1 ? `<span class="qty">${slot.qty}</span>` : ''}
      </button>`;
    }).join('');

    const w = bestWeapon(state);
    const selected = props.selected && state.inventory.some(s => s?.id === props.selected) ? props.selected : null;

    return `
      <div class="pack-stats">
        <span>&#9829; ${state.hp}/${maxHp(state)}</span>
        <span>&#9889; ${Math.floor(state.energy)}/${maxEnergy(state)} <span class="dim">+${foodValue(state)} in food</span></span>
        <span>&#9876; ${attackDice(state)} dice <span class="dim">${w ? escapeHtml(w.name) : 'fists'}${reach(state) > 1 ? ', reach 2' : ''}</span></span>
        <span>&#128737; ${defenseDice(state)} dice</span>
        <span class="dim">${usedSlots(state)}/${cap} slots</span>
      </div>
      <div class="slots">${slots}</div>
      ${selected ? itemDetail(selected) : '<p class="dim">Click anything to see what it is for. Food is eaten on its own as you work: you never need to eat by hand.</p>'}`;
  },

  bind(game, body) {
    for (const btn of body.querySelectorAll('[data-item]')) {
      btn.addEventListener('click', () => {
        game.ui.currentPanel.props = { selected: btn.dataset.item };
        game.ui.refreshPanel();
      });
    }
  },
};
