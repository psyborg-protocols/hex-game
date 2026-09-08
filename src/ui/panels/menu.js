// panels/menu.js — saving, loading, and starting somewhere else.

import { hasLocal, localSavedAt } from '../../game/save.js';
import { escapeHtml } from '../ui.js';

export const menuPanel = {
  title: () => 'Game',

  render(game) {
    const when = localSavedAt();
    const skills = Object.entries(game.state.skills)
      .map(([k, v]) => `${k} ${v.level}`).join(' &middot; ');

    return `
      <p>World <b>${escapeHtml(game.world.seed)}</b>
        <span class="dim">&middot; ${game.map.size} columns</span></p>
      <p class="dim">${skills}</p>

      <h3>Save</h3>
      <button class="line" data-act="save"><span></span><span>Save to this browser</span></button>
      <button class="line" data-act="load" ${hasLocal() ? '' : 'disabled'}>
        <span></span><span>Load saved game</span>
        <span class="dim">${when ? escapeHtml(new Date(when).toLocaleString()) : 'none yet'}</span>
      </button>
      <button class="line" data-act="export"><span></span><span>Download a save file</span></button>
      <button class="line" data-act="import"><span></span><span>Open a save file</span></button>

      <h3>Testing</h3>
      <button class="line" data-act="free">
        <span></span><span>Free resources</span>
        <span class="dim">${game.state.free ? 'on' : 'off'}</span>
      </button>
      <p class="dim">Crafting, harvesting, building and trade stop costing
        anything. Terrain, cliffs and the river still work normally. Saved with
        the game; <code>?free=1</code> also turns it on.</p>

      <h3>New world</h3>
      <p class="dim">Starting a new world does not touch your saved game.</p>
      <div class="trade-row">
        <span>Seed</span>
        <input id="seed-input" value="${escapeHtml(game.world.seed)}">
        <button data-act="new">Generate</button>
      </div>

      <input type="file" id="save-file" accept=".json" hidden>`;
  },

  bind(game, body) {
    const file = body.querySelector('#save-file');
    const actions = {
      save: () => game.doSave(),
      load: () => game.doLoad(),
      export: () => game.doExport(),
      import: () => file.click(),
      new: () => game.doNewWorld(body.querySelector('#seed-input').value.trim()),
      free: () => game.doToggleFree(),
    };
    for (const btn of body.querySelectorAll('[data-act]')) {
      btn.addEventListener('click', () => actions[btn.dataset.act]());
    }
    file.addEventListener('change', e => {
      if (e.target.files[0]) game.doImport(e.target.files[0]);
    });
  },
};
