// join_screen.js
// What a friend sees when they open a share link, before there is a world:
// their name, then a colour nobody else has, then in.
//
// Resolves with { session, welcome, code }, or with null to play alone instead.

import { CLOAK_COLORS } from '../render/player_sprite.js';
import { connectAsGuest, myName, rememberName } from '../net/multiplayer.js';
import { escapeHtml } from './ui.js';

const swatchStyle = c => `--sw-lit:${c.cloak.h};--sw-mid:${c.cloak.l};--sw-shade:${c.cloak.m};--sw-edge:${c.cloak.o};--sw-accent:${c.scarf.b}`;

export function joinScreen(code) {
  return new Promise(resolve => {
    const root = document.createElement('div');
    root.className = 'join-screen';
    document.body.appendChild(root);
    let session = null;
    let hello = null;

    const done = value => { root.remove(); resolve(value); };
    const alone = () => {
      session?.close();
      history.replaceState(null, '', location.pathname);
      done(null);
    };

    const frame = (body) => {
      root.innerHTML = `<div class="join-card">
        <h1>Across the River</h1>
        ${body}
        <button type="button" class="link-btn join-alone">Play on my own instead</button>
      </div>`;
      root.querySelector('.join-alone').addEventListener('click', alone);
    };

    // 1. Who are you?
    const askName = (error = '') => {
      frame(`<p class="lede">A friend has asked you into their world.</p>
        <label class="join-field">Your name
          <input id="join-name" maxlength="20" autocomplete="nickname" value="${escapeHtml(myName())}" placeholder="Wanderer">
        </label>
        ${error ? `<p class="join-error">${escapeHtml(error)}</p>` : ''}
        <button type="button" class="big primary" id="join-go">Join</button>`);
      const input = root.querySelector('#join-name');
      const go = async () => {
        const name = input.value.trim() || 'Wanderer';
        rememberName(name);
        frame('<p class="lede">Finding your friend’s game…</p>');
        try {
          ({ session, hello } = await connectAsGuest(code, name));
          askColor(hello.previous);
        } catch (e) {
          askName(e.message || String(e));
        }
      };
      root.querySelector('#join-go').addEventListener('click', go);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      input.focus();
    };

    // 2. A colour nobody else has. First come, first served.
    const askColor = (preferred = null, note = '') => {
      const taken = new Set(hello.taken);
      const mode = hello.mode === 'competitive' ? 'Competitive: race to the end of the journey, and fight if you must.' : 'Co-op: one world, one fight against the raiders.';
      frame(`<p class="lede">Pick your colour.</p>
        <p class="dim">${escapeHtml(mode)} Playing: ${hello.roster.map(p => escapeHtml(p.name)).join(', ')}.</p>
        <div class="swatches" role="radiogroup" aria-label="Your colour">
          ${CLOAK_COLORS.map(c => {
            const isTaken = taken.has(c.id);
            return `<button type="button" class="swatch${isTaken ? ' taken' : ''}${c.id === preferred && !isTaken ? ' on' : ''}" role="radio"
              aria-checked="false" data-color="${c.id}" ${isTaken ? 'disabled' : ''}
              title="${escapeHtml(c.name)}${isTaken ? ' (taken)' : ''}" aria-label="${escapeHtml(c.name)}${isTaken ? ', taken' : ''}"
              style="${swatchStyle(c)}"></button>`;
          }).join('')}
        </div>
        ${note ? `<p class="join-error">${escapeHtml(note)}</p>` : '<p class="dim">Greyed colours are already someone’s.</p>'}`);
      for (const b of root.querySelectorAll('[data-color]:not([disabled])')) {
        b.addEventListener('click', async () => {
          frame('<p class="lede">Stepping into their world…</p>');
          try {
            const welcome = await session.claim(b.dataset.color);
            done({ session, welcome, code });
          } catch (e) {
            if (e?.refused) {
              hello.taken = e.taken;
              askColor(null, 'Someone took that colour a moment before you. Pick another.');
            } else {
              askName(e.message || String(e));
            }
          }
        });
      }
    };

    askName();
  });
}
