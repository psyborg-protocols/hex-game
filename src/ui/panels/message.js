// panels/message.js — the big moments: the opening, a death, a victory, help.

import { escapeHtml } from '../ui.js';

export const messagePanel = {
  title: props => escapeHtml(props.title || ''),

  render(game, props) {
    const buttons = (props.buttons || [{ label: 'Continue', act: 'close' }])
      .map((b, i) => `<button class="big${i === 0 ? ' primary' : ''}" data-act="${i}">${escapeHtml(b.label)}</button>`).join('');
    return `<div class="message">${props.html || ''}</div><div class="message-buttons">${buttons}</div>`;
  },

  bind(game, body, props) {
    const buttons = props.buttons || [{ label: 'Continue', act: 'close' }];
    for (const el of body.querySelectorAll('[data-act]')) {
      el.addEventListener('click', () => {
        const b = buttons[+el.dataset.act];
        game.ui.sticky = false;
        game.ui.closePanel();
        b.run?.();
      });
    }
  },
};

export const HOW_TO_PLAY = `
  <p class="lede">Raiders hold the far bank of the river. You hold a handful of berries.
    Build a life on this side, then cross over and burn their camps.</p>
  <div class="howto">
    <div><b>Move</b><span>Click a hex. Drag to pan, wheel to zoom, <kbd>F</kbd> recentres.</span></div>
    <div><b>Explore</b><span>Stand still on a hex to explore it. Scenic places take longer and raise your <i>Mind</i>.
      Berries, herbs, flint, clay and fish only show on hexes you have explored.</span></div>
    <div><b>Work</b><span>Buttons float over your hex: what this ground gives. Press <kbd>1</kbd>&ndash;<kbd>6</kbd> for them.</span></div>
    <div><b>Food is energy</b><span>Work and walking burn energy; food in your pack refills it on its own.
      Cooked food packs more into a slot.</span></div>
    <div><b>Make &amp; build</b><span><kbd>C</kbd> Craft, <kbd>B</kbd> Build, <kbd>I</kbd> Pack (click an item to see what it is for).</span></div>
    <div><b>Villages</b><span>Each asks one small favour; do it and they trade, lend their workshop, and show you the land.</span></div>
    <div><b>Raiders</b><span>Every day or two a war band crosses to burn what you built. Walls slow them, watchtowers shoot,
      shrines protect. Stand next to a raider to fight: attack dice hit on 4+, defence dice block on 5+.</span></div>
    <div><b>Space</b><span>The eye: everything you know of the land.</span></div>
  </div>
  <p class="dim">The corner shows your chapter and what to reach for next.</p>`;
