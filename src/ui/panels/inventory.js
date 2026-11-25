// panels/inventory.js — what you wear, what you carry, and what each thing is for.
//
// "Every item should feel significant" only works if the game tells you the
// significance. Click any slot and it says what the item does, what it makes,
// and what it lets you do.

import { ITEMS, RECIPES, WORN_SLOTS, isBuilding } from '../../game/state.js';
import {
  foodValue, capacity, usedSlots, maxEnergy, ensureWorn, isWorn,
  equipFromPack, unequipSlot, donFromPack, FOOD_SLOTS, lentBy,
} from '../../game/inventory.js';
import { attackDice, defenseDice, reach, bestWeapon, maxHp } from '../../game/gear.js';
import { maxMoveDistance, ensureTurnState } from '../../game/turns.js';
import { HARVESTS } from '../../game/harvests.js';
import { icon, escapeHtml } from '../ui.js';

const SLOT_LABELS = Object.fromEntries(WORN_SLOTS.map(s => [s.id, s.label]));

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

export function itemDetail(id, { worn = false, packIndex = -1 } = {}) {
  const item = ITEMS[id];
  if (!item) return '';
  const stats = [];
  if (item.food) stats.push(`${item.food} energy`);
  if (item.heal) stats.push(`heals ${item.heal}`);
  if (item.attack) stats.push(`&#9876; ${item.attack} attack${item.range ? `, reach ${item.range}` : ''}`);
  if (item.defense) stats.push(`&#128737; +${item.defense} defence`);
  if (item.moveBonus) stats.push(`+${item.moveBonus} hex/turn`);
  if (item.slots) stats.push(`+${item.slots} slots`);
  if (item.slot) stats.push(`worn: ${SLOT_LABELS[item.slot] || item.slot}`);
  const u = usesOf(id);
  const list = (label, xs) => xs.length ? `<p><span class="dim">${label}</span> ${xs.map(escapeHtml).join(', ')}</p>` : '';
  const actionBtn = item.slot
    ? (worn
      ? `<button type="button" class="link-btn" data-detail-unequip="${item.slot}">Unequip</button>`
      : (packIndex >= 0 ? `<button type="button" class="link-btn" data-detail-equip="${packIndex}">Equip</button>` : ''))
    : item.don && packIndex >= 0
      ? `<button type="button" class="link-btn" data-detail-don="${packIndex}">Put on</button>`
      : '';
  return `<div class="detail">
    <div class="detail-head">${icon(item, 36)}<div><b>${escapeHtml(item.name)}</b>
      <span class="dim kind">${item.kind}${stats.length ? ' &middot; ' + stats.join(' &middot; ') : ''}</span></div>${actionBtn}</div>
    <p>${escapeHtml(item.desc || '')}</p>
    ${list('Goes into:', u.makes)}${list('Tool for:', u.toolFor)}${list('Work here to make:', u.atFor)}
  </div>`;
}

/** Put the cloak on for good, then show it gone from the pack. */
function donCloak(game, idx) {
  const res = donFromPack(game.state, idx);
  if (!res.ok) {
    game.ui.notify(res.reason, 3200, 'bad');
    return;
  }
  game.syncPlayerGear?.();
  game.ui.notify("You pull on the hooded cloak. It is yours now, and the night chill can't reach you.");
  game.ui.currentPanel.props = {};
  game.ui.refreshPanel();
}

/** The menu for a pack slot: drop on the ground, or toss for good. */
function packMenu(game, idx, x, y) {
  const slot = game.state.inventory[idx];
  if (!slot) return;
  const item = ITEMS[slot.id];
  const name = item?.name || slot.id;
  const lender = lentBy(game.state, slot.id);
  if (lender) {
    game.ui.showMenu(x, y, [{ label: `Lent by ${lender}: return it`, disabled: true }]);
    return;
  }
  const many = slot.qty > 1;
  const precious = ['tool', 'gear'].includes(item?.kind);
  const toss = qty => (precious
    ? () => game.ui.showMenu(x, y, [
      { label: `Toss the ${name} for good`, bad: true, run: () => game.doTossFromPack(idx, qty) },
      { label: 'Keep it' },
    ])
    : () => game.doTossFromPack(idx, qty));
  game.ui.showMenu(x, y, [
    { label: many ? `Drop one ${name}` : `Drop ${name}`, run: () => game.doDropFromPack(idx, 1) },
    ...(many ? [{ label: `Drop all ${slot.qty}`, run: () => game.doDropFromPack(idx, slot.qty) }] : []),
    { label: many ? 'Toss one' : `Toss ${name}`, bad: true, run: toss(1) },
    ...(many ? [{ label: `Toss all ${slot.qty}`, bad: true, run: toss(slot.qty) }] : []),
  ]);
}

/** The menu for worn gear: take it off, or drop it. */
function wornMenu(game, slotKey, x, y) {
  const id = ensureWorn(game.state)[slotKey];
  if (!id) return;
  const lender = lentBy(game.state, id);
  game.ui.showMenu(x, y, [
    { label: 'Unequip', run: () => {
      const res = unequipSlot(game.state, slotKey);
      if (!res.ok) return game.ui.notify(res.reason, 3200, 'bad');
      game.syncPlayerGear?.();
      game.ui.refreshPanel();
    } },
    lender
      ? { label: `Lent by ${lender}: return it`, disabled: true }
      : { label: `Drop ${ITEMS[id]?.name || id}`, run: () => game.doDropWorn(slotKey) },
  ]);
}

export const inventoryPanel = {
  title: () => 'Pack',

  render(game, props = {}) {
    const { state } = game;
    ensureTurnState(state);
    const worn = ensureWorn(state);
    const cap = capacity(state);
    const moveMax = maxMoveDistance(state);

    const wornBar = WORN_SLOTS.map(s => {
      const id = worn[s.id];
      const item = id && ITEMS[id];
      const sel = id && props.selected === id ? ' selected' : '';
      if (!item) {
        return `<button type="button" class="slot worn-slot empty" data-worn-slot="${s.id}" aria-label="${escapeHtml(s.label)} slot (empty)" title="${escapeHtml(s.label)} slot (empty)"><span class="worn-label">${escapeHtml(s.label)}</span></button>`;
      }
      return `<button type="button" class="slot worn-slot filled${sel}" data-worn-slot="${s.id}" data-item="${id}" aria-label="${escapeHtml(item.name)} (${escapeHtml(s.label)}) — unequip" title="${escapeHtml(item.name)} (${escapeHtml(s.label)}) — click to unequip">
        ${icon(item, 26)}
      </button>`;
    }).join('');

    const slotHtml = (slot, i) => {
      if (!slot) return `<div class="slot empty${i < FOOD_SLOTS ? ' food' : ''}"></div>`;
      const item = ITEMS[slot.id];
      const sel = props.selected === slot.id ? ' selected' : '';
      const lender = lentBy(state, slot.id);
      const tip = (item?.slot
        ? `${item.name} — click to equip (${SLOT_LABELS[item.slot] || item.slot})`
        : item?.don ? `${item.name} — click to put on for good`
          : (item?.name || slot.id)) + (lender ? ` · lent by ${lender}` : '') + ' · right-click to drop or toss';
      return `<button type="button" class="slot${sel}${lender ? ' lent' : ''}${i >= cap ? ' over' : ''}" data-pack-index="${i}" data-item="${slot.id}" title="${escapeHtml(tip)}">
        ${icon(item, 28)}${slot.qty > 1 ? `<span class="qty">${slot.qty}</span>` : ''}${lender ? '<span class="lent-tag">lent</span>' : ''}
      </button>`;
    };
    // Four slots for food on the left; everything else on the right.
    const lastUsed = state.inventory.reduce((n, s, i) => (s ? i + 1 : n), 0);
    const foodSlots = state.inventory.slice(0, FOOD_SLOTS).map((s, i) => slotHtml(s, i)).join('');
    const mainSlots = state.inventory.slice(FOOD_SLOTS, Math.max(cap, lastUsed)).map((s, i) => slotHtml(s, i + FOOD_SLOTS)).join('');
    const mainUsed = state.inventory.slice(FOOD_SLOTS).filter(Boolean).length;
    const foodUsed = state.inventory.slice(0, FOOD_SLOTS).filter(Boolean).length;
    const slots = `<div class="pack-split">
        <div class="food-slots"><h4>Food <span class="dim">${foodUsed}/${FOOD_SLOTS}</span></h4><div class="slots">${foodSlots}</div></div>
        <div class="main-slots"><h4>Pack <span class="dim">${mainUsed}/${cap - FOOD_SLOTS}</span></h4><div class="slots">${mainSlots}</div></div>
      </div>`;

    const w = bestWeapon(state);
    const inPackIdx = props.selected ? state.inventory.findIndex(s => s?.id === props.selected) : -1;
    const isSelWorn = props.selected ? isWorn(state, props.selected) : false;
    const selected = props.selected && (inPackIdx >= 0 || isSelWorn) ? props.selected : null;

    return `
      <div class="pack-stats">
        <span>&#9829; ${state.hp}/${maxHp(state)}</span>
        <span>&#9889; ${Math.floor(state.energy)}/${maxEnergy(state)} <span class="dim">+${foodValue(state)} in food</span></span>
        <span>&#9876; ${attackDice(state)} dice <span class="dim">${w ? escapeHtml(w.name) : 'fists'}${reach(state) > 1 ? ', reach 2' : ''}</span></span>
        <span>&#128737; ${defenseDice(state)} dice</span>
        <span>&#128099; ${moveMax} hex/turn</span>
        <span class="dim">${usedSlots(state)}/${cap} slots</span>
      </div>
      <div class="worn-bar" role="toolbar" focusgroup="toolbar wrap" aria-label="Worn gear">${wornBar}</div>
      ${state.cloak ? '<p class="dim">You wear your hooded cloak: the night chill can&rsquo;t reach you. Change its colour under Game.</p>' : ''}
      ${slots}
      ${selected
        ? itemDetail(selected, { worn: isSelWorn, packIndex: inPackIdx })
        : '<p class="dim">Click worn gear above to equip or remove it; click pack items to inspect or equip; right-click (or hold) to drop or toss. Food goes in the four food slots and is eaten on its own as you work.</p>'}`;
  },

  bind(game, body) {
    const bar = body.querySelector('.worn-bar');
    if (bar && !('focusGroup' in HTMLElement.prototype)) {
      const items = [...bar.querySelectorAll('button')];
      items.forEach((b, i) => { b.tabIndex = i ? -1 : 0; });
      bar.addEventListener('focusin', ({ target }) => {
        if (items.includes(target)) items.forEach(b => { b.tabIndex = b === target ? 0 : -1; });
      });
      bar.addEventListener('keydown', e => {
        const rtl = getComputedStyle(bar).direction === 'rtl';
        const step = e.key === 'ArrowRight' ? (rtl ? -1 : 1)
          : e.key === 'ArrowLeft' ? (rtl ? 1 : -1)
            : e.key === 'Home' ? -items.length
              : e.key === 'End' ? items.length
                : 0;
        if (!step) return;
        const cur = items.indexOf(document.activeElement);
        if (cur < 0) return;
        e.preventDefault();
        const nextIdx = e.key === 'Home' ? 0
          : e.key === 'End' ? items.length - 1
            : (cur + step + items.length) % items.length;
        items[nextIdx].focus();
      });
    }

    for (const btn of body.querySelectorAll('[data-worn-slot]')) {
      btn.addEventListener('click', () => {
        const slotKey = btn.dataset.wornSlot;
        const wornId = ensureWorn(game.state)[slotKey];
        if (!wornId) {
          game.ui.notify(`${SLOT_LABELS[slotKey] || slotKey} slot is empty — click wearable gear below to equip.`);
          return;
        }
        const res = unequipSlot(game.state, slotKey);
        if (!res.ok) {
          game.ui.notify(res.reason, 3200, 'bad');
          return;
        }
        game.syncPlayerGear?.();
        game.ui.currentPanel.props = { selected: res.unequipped };
        game.ui.refreshPanel();
      });
    }

    // Right-click (or hold, on touch) a slot: drop it on the ground, or toss it.
    const onMenu = (el, open) => {
      el.addEventListener('contextmenu', e => { e.preventDefault(); open(e.clientX, e.clientY); });
      let hold = null;
      el.addEventListener('pointerdown', e => {
        if (e.pointerType !== 'touch') return;
        hold = setTimeout(() => { hold = 'fired'; open(e.clientX, e.clientY); }, 520);
      });
      const cancel = () => { if (hold && hold !== 'fired') clearTimeout(hold); };
      el.addEventListener('pointerup', cancel);
      el.addEventListener('pointerleave', cancel);
      el.addEventListener('click', e => { if (hold === 'fired') { e.stopImmediatePropagation(); e.preventDefault(); } hold = null; }, true);
    };
    for (const btn of body.querySelectorAll('[data-pack-index]')) {
      onMenu(btn, (x, y) => packMenu(game, Number(btn.dataset.packIndex), x, y));
    }
    for (const btn of body.querySelectorAll('[data-worn-slot][data-item]')) {
      onMenu(btn, (x, y) => wornMenu(game, btn.dataset.wornSlot, x, y));
    }

    for (const btn of body.querySelectorAll('[data-pack-index]')) {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.packIndex);
        const slot = game.state.inventory[idx];
        if (!slot) return;
        const item = ITEMS[slot.id];
        if (item?.don) {
          donCloak(game, idx);
          return;
        }
        if (item?.slot) {
          const res = equipFromPack(game.state, idx);
          if (!res.ok) {
            game.ui.notify(res.reason, 3200, 'bad');
            return;
          }
          game.syncPlayerGear?.();
          game.ui.currentPanel.props = { selected: res.equipped };
        } else {
          game.ui.currentPanel.props = { selected: slot.id };
        }
        game.ui.refreshPanel();
      });
    }

    body.querySelector('[data-detail-equip]')?.addEventListener('click', e => {
      const idx = Number(e.currentTarget.dataset.detailEquip);
      const res = equipFromPack(game.state, idx);
      if (!res.ok) return game.ui.notify(res.reason, 3200, 'bad');
      game.syncPlayerGear?.();
      game.ui.currentPanel.props = { selected: res.equipped };
      game.ui.refreshPanel();
    });

    body.querySelector('[data-detail-don]')?.addEventListener('click', e => {
      donCloak(game, Number(e.currentTarget.dataset.detailDon));
    });

    body.querySelector('[data-detail-unequip]')?.addEventListener('click', e => {
      const slotKey = e.currentTarget.dataset.detailUnequip;
      const res = unequipSlot(game.state, slotKey);
      if (!res.ok) return game.ui.notify(res.reason, 3200, 'bad');
      game.syncPlayerGear?.();
      game.ui.currentPanel.props = { selected: res.unequipped };
      game.ui.refreshPanel();
    });
  },
};
