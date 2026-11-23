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
    <div><b>Move &amp; Turns</b><span>Click any hex to walk freely (Leather Boots and a Walking Stick speed your travel).
      Every day is 12 turns and every night is 12 turns; 9 hexes walked, 3 actions, or any combination advances a turn quietly in the background. Press <kbd>.</kbd> to wait 1 turn.</span></div>
    <div><b>Sleep &amp; Night</b><span>Sleep (<kbd>Z</kbd>) by midnight (night turn 7). Still awake then and you are tired all the next day, with less energy;
      three turns later, exhausted, with half. Stay up until the turn before dawn and you pass out where you stand.
      Sleep by a hearth or in a village for warmth, and in a hut or village to keep wild dogs away (villages charge 3 gold).</span></div>
    <div><b>Explore</b><span>Stand still on a hex to explore it. Scenic places take longer and raise your <i>Mind</i>.
      Berries, herbs, flint, clay and fish only show on hexes you have explored.</span></div>
    <div><b>Work</b><span>Click resources, campfires, huts, benches, villages, or cliff faces directly to gather, craft, trade, or mine.</span></div>
    <div><b>Food is energy</b><span>Work and walking burn energy; food in your pack refills it automatically (1 bite per turn).
      Cooked food packs more into a slot.</span></div>
    <div><b>Worn Gear</b><span>Open Pack (<kbd>I</kbd>) to equip weapons, armour, boots, walking stick, and packs in the gear bar above your slots.</span></div>
    <div><b>Wild Dogs</b><span>Rare wild dogs lurk in the far-bank woods and sometimes emerge on this side by day. With Mind 2, feed them meat or a meal for a chance to tame one.</span></div>
    <div><b>Make &amp; build</b><span><kbd>C</kbd> Craft, <kbd>B</kbd> Build, <kbd>I</kbd> Pack (click an item to see what it is for).</span></div>
    <div><b>Villages</b><span>Each asks one small favour; do it and they trade, lend their workshop, and show you the land.</span></div>
    <div><b>The moon</b><span>A moon is three days (72 turns). For two days and the third morning nothing comes;
      on the third afternoon the omens show who is coming tonight and the way they will take.</span></div>
    <div><b>Raiders</b><span>They cross the river at their rafts, at dusk, in waves, to burn what you built, and go home at dawn.
      Walls slow them, watchtowers shoot, shrines protect. Stand next to a raider to fight: attack dice hit on 4+, defence dice block on 5+.</span></div>
    <div><b>Space</b><span>The eye: everything you know of the land.</span></div>
    <div><b>The corners</b><span>Top left: health, energy, day/night turn &amp; the moon. Point at it for full details.</span></div>
  </div>`;
