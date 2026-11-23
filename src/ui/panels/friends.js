// panels/friends.js — playing with friends: open a room and share its link, or
// see who is in the one you are in.

import { CLOAK_COLORS, cloakColor } from '../../render/player_sprite.js';
import { myName, myPlayerId } from '../../net/multiplayer.js';
import { MAX_PLAYERS } from '../../net/session.js';
import { escapeHtml } from '../ui.js';
import { roomSavedAt } from '../../game/save.js';

const swatchStyle = c => `--sw-lit:${c.cloak.h};--sw-mid:${c.cloak.l};--sw-shade:${c.cloak.m};--sw-edge:${c.cloak.o};--sw-accent:${c.scarf.b}`;

function swatches(selected, taken = []) {
  return `<div class="swatches" role="radiogroup" aria-label="Your colour">
    ${CLOAK_COLORS.map(c => {
      const isTaken = taken.includes(c.id);
      const on = c.id === selected;
      return `<button type="button" class="swatch${on ? ' on' : ''}${isTaken ? ' taken' : ''}" role="radio"
        aria-checked="${on}" data-color="${c.id}" ${isTaken ? 'disabled' : ''}
        title="${escapeHtml(c.name)}${isTaken ? ' (taken)' : ''}" aria-label="${escapeHtml(c.name)}${isTaken ? ', taken' : ''}"
        style="${swatchStyle(c)}"></button>`;
    }).join('')}
  </div>`;
}

function roster(mp) {
  const me = myPlayerId();
  return `<ul class="roster">${mp.roster.map(p => `<li>
      <i class="pip" style="--pip:${cloakColor(p.color).cloak.l};--pip-edge:${cloakColor(p.color).cloak.o}"></i>
      <b>${escapeHtml(p.name)}</b>
      <span class="dim">${p.id === me ? 'you' : ''}${p.host ? `${p.id === me ? ', ' : ''}host` : ''}</span>
    </li>`).join('')}</ul>
    <p class="dim">${mp.roster.length} of ${MAX_PLAYERS} players.</p>`;
}

const MODES = {
  coop: ['Co-op', 'One world, one fight. No hurting each other; anyone’s buildings help everyone, and burning the last camp wins it for all.'],
  competitive: ['Competitive', 'A race to the end of the journey, in one world. You can trade, and you can fight: each other, and each other’s buildings.'],
};

export const friendsPanel = {
  title: () => 'Play with friends',

  render(game, props = {}) {
    const mp = game.mp;
    if (!mp.active) {
      const mode = props.mode || 'coop';
      const color = props.color || game.state.playerColor;
      return `
        <p class="lede">Open this world to up to ${MAX_PLAYERS - 1} friends. They join with a link, in their own browser.</p>
        <label class="join-field">Your name
          <input id="mp-name" maxlength="20" autocomplete="nickname" value="${escapeHtml(props.name ?? myName())}" placeholder="Wanderer">
        </label>
        <h3>How to play</h3>
        <div class="mode-pick" role="radiogroup" aria-label="Mode">
          ${Object.entries(MODES).map(([id, [name, blurb]]) => `<button type="button" class="line${mode === id ? ' on' : ''}" role="radio"
            aria-checked="${mode === id}" data-mode="${id}"><span></span><span><b>${name}</b><br><span class="dim">${blurb}</span></span></button>`).join('')}
        </div>
        <h3>Your colour</h3>
        ${swatches(color)}
        <p class="dim">Each player has their own colour: first come, first served.</p>
        ${props.error ? `<p class="join-error">${escapeHtml(props.error)}</p>` : ''}
        <button type="button" class="big primary" id="mp-host" ${props.busy ? 'disabled' : ''}>${props.busy ? 'Opening…' : 'Open the room'}</button>
        ${roomSavedAt() ? `<h3>Your hosted game</h3>
          <button type="button" class="line" id="mp-resume"><span></span><span>Pick up the game you hosted</span>
            <span class="dim">${escapeHtml(new Date(roomSavedAt()).toLocaleString())}</span></button>
          <p class="dim">Your friends rejoin with the same link, and get back everything they had.</p>` : ''}`;
    }

    const host = mp.isHost;
    return `
      <p class="lede">${host ? 'Your world is open.' : 'You are in a friend’s world.'}
        <span class="dim">${escapeHtml(MODES[mp.mode]?.[0] || '')}</span></p>
      ${host ? `<div class="share">
          <input id="mp-link" readonly value="${escapeHtml(mp.link)}" aria-label="Share link">
          <button type="button" id="mp-copy">Copy</button>
        </div>
        <p class="dim">Send this link to a friend. They open it, pick a colour, and appear beside you.</p>` : ''}
      <h3>Playing</h3>
      ${roster(mp)}
      <button type="button" class="line" id="mp-leave"><span></span><span>${host ? 'Close the room' : 'Leave the game'}</span></button>`;
  },

  bind(game, body, props = {}) {
    const mp = game.mp;
    const panel = game.ui.currentPanel;
    const update = patch => { panel.props = { ...props, name: body.querySelector('#mp-name')?.value, ...patch }; game.ui.refreshPanel(); };

    if (!mp.active) {
      body.querySelector('#mp-resume')?.addEventListener('click', () => { location.search = '?resume=1'; });
      for (const b of body.querySelectorAll('[data-mode]')) b.addEventListener('click', () => update({ mode: b.dataset.mode }));
      for (const b of body.querySelectorAll('[data-color]')) b.addEventListener('click', () => update({ color: b.dataset.color }));
      body.querySelector('#mp-host').addEventListener('click', async () => {
        const name = body.querySelector('#mp-name').value.trim() || 'Wanderer';
        update({ busy: true, error: null, name });
        try {
          await game.doHostRoom({ mode: props.mode || 'coop', name, color: props.color || game.state.playerColor });
          panel.props = {};
          game.ui.refreshPanel();
        } catch (e) {
          update({ busy: false, error: e.message || String(e), name });
        }
      });
      return;
    }

    body.querySelector('#mp-copy')?.addEventListener('click', async () => {
      const input = body.querySelector('#mp-link');
      try { await navigator.clipboard.writeText(input.value); } catch { input.select(); document.execCommand?.('copy'); }
      game.ui.notify('Link copied. Send it to a friend.');
    });
    body.querySelector('#mp-leave').addEventListener('click', () => {
      game.doLeaveRoom();
      game.ui.refreshPanel();
    });
  },
};
