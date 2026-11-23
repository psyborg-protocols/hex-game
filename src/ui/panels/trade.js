// panels/trade.js — a village: its favour first, then its market.

import { ITEMS, itemName, isNight } from '../../game/state.js';
import { stockOf, trustOf, isRaided, kindOf, sellPrice, FAVOUR_REWARD, ensureVillage } from '../../game/economy.js';
import { VILLAGE_SLEEP_COST } from '../../game/sleep.js';
import { countItem } from '../../game/inventory.js';
import { icon, escapeHtml } from '../ui.js';

const VILLAGE_HINTS = [
  "An axe'll drop a whole oak tree, dearie — bare hands'll only shake a lonely twig loose!",
  "Two smooth stones, a stout branch, and twisted reed cord: that's the recipe for a proper stone axe, plain as porridge.",
  "Cattails wiggle where the shore's low and wet. Cut 'em, twist 'em into cord, and half the valley opens up!",
  "Stand still a spell on fresh turf and let your eyes settle — that's when the berries and herbs wink back at ya.",
  "Raw meat keeps a belly from grumbling, sure, but toss it on a crackling hearth and it'll double its goodness!",
  "A cliff too steep for your boots? A good stone hammer'll chip it down to size — or lean a ladder if you've planks and cord.",
  "Want to catch a quick brown rabbit? Don't chase it in circles — twist a bit of reed cord for a snare, or fetch a bow!",
  "Shine a bright eye on the world and get wise in Mind — once you've got Lore, rocky hillsides start whispering where the ore hides.",
  "You can't pull glowing iron from a forge bare-handed, sweetheart! Whittle green-wood tongs out of branches and cord first.",
  "Notice wild grain clinging to the meadow grass? Tuck a handful into plowed earth for a field that pays you back fourfold.",
  "Red blood moons bring trouble up the road — nail up a palisade or a watchtower along the lane before dusk!",
  "Make friends with folks like us and you can borrow our hearth, workbench, or forge right while you're in town!",
  "You'll want a sharp flint knife before you can whittle logs into ladder planks — flint is scarce down in the valley, though every village keeps knives for sale.",
  "Ever stumble on a spot that takes your breath away? Click right on yourself to sit down and meditate — nothing sharpens the Mind faster.",
  "Climb a high ridge or mountain peak and pause to take it in — the higher you stand, the farther across the valley you'll see.",
];

function hintBox(hintIndex) {
  const text = VILLAGE_HINTS[hintIndex % VILLAGE_HINTS.length];
  return `<div class="rumour-box">
    <p class="elder rumour">&ldquo;${escapeHtml(text)}&rdquo;</p>
    <button class="link-btn" data-rumour>Hear another</button>
  </div>`;
}

export const tradePanel = {
  title: (props) => props.village?.feature?.name || 'Village',
  wide: true,

  render(game, props) {
    const { state } = game;
    const col = props.village;
    const kind = kindOf(col.feature);
    ensureVillage(state, col.feature, col.q, col.r, game.world.seed);
    if (props.hintIndex == null) props.hintIndex = Math.floor(Math.random() * VILLAGE_HINTS.length);
    const trust = trustOf(state, col.q, col.r);
    const station = ITEMS[kind.station]?.name || kind.station;

    const head = `<p class="village-kind"><b>${escapeHtml(kind.name)}</b>
      <span class="dim">&middot; sell ${kind.sells.map(itemName).map(escapeHtml).join(', ')} &middot; keep a ${escapeHtml(station)}</span></p>`;

    const sleepInn = (isNight(state) && !isRaided(state, col.q, col.r))
      ? `<p><button type="button" class="link-btn" data-sleep-village ${state.gold >= VILLAGE_SLEEP_COST || state.free ? '' : 'disabled'}>Sleep in the village until dawn (${state.free ? 'free' : `${VILLAGE_SLEEP_COST}g`})</button></p>`
      : '';

    if (!trust?.done) {
      const { item, qty } = trust.favour;
      const have = countItem(state, item);
      return `${head}${sleepInn}
        <div class="favour">
          <p class="elder">&ldquo;We don't trade with strangers. Do us a turn first &mdash;
            bring us <b>${qty} ${escapeHtml(itemName(item))}</b>, and you'll find us friendly.&rdquo;</p>
          <div class="trade-row">${icon(ITEMS[item], 28)}<span>${qty} &times; ${escapeHtml(itemName(item))}</span>
            <span class="dim">you have ${have}</span>
            <button data-favour ${have >= qty || state.free ? '' : 'disabled'}>Hand them over</button></div>
          <p class="dim">Their reward: ${FAVOUR_REWARD} gold, a market, the use of their ${escapeHtml(station)},
            and what they know of the land around them.</p>
          <p class="dim hint">${escapeHtml(ITEMS[item]?.desc || '')}</p>
        </div>
        ${hintBox(props.hintIndex)}`;
    }

    if (isRaided(state, col.q, col.r)) {
      return `${head}<p class="raided">Raiders have been through. The stalls are smashed &mdash; come back tomorrow.</p>${hintBox(props.hintIndex)}`;
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

    return `${head}${sleepInn}
      <p class="dim">You have <b>${state.gold}</b> gold. You may use their ${escapeHtml(station)} while you stand here.</p>
      <div class="trade-cols">
        <div><h3>They sell</h3><div class="trade">${buyRows}</div></div>
        <div><h3>They buy</h3><div class="trade">${sellRows || '<p class="dim">Your pack is empty.</p>'}</div></div>
      </div>
      ${hintBox(props.hintIndex)}`;
  },

  bind(game, body, props) {
    const col = props.village;
    body.querySelector('[data-favour]')?.addEventListener('click', () => game.doFavour(col));
    body.querySelector('[data-sleep-village]')?.addEventListener('click', () => {
      game.ui.closePanel();
      game.doSleep();
    });
    body.querySelector('[data-rumour]')?.addEventListener('click', () => {
      props.hintIndex = ((props.hintIndex ?? 0) + 1 + Math.floor(Math.random() * (VILLAGE_HINTS.length - 1))) % VILLAGE_HINTS.length;
      game.ui.refreshPanel();
    });
    for (const btn of body.querySelectorAll('[data-buy]')) btn.addEventListener('click', () => game.doBuy(col, btn.dataset.buy));
    for (const btn of body.querySelectorAll('[data-sell]')) btn.addEventListener('click', () => game.doSell(col, btn.dataset.sell));
  },
};
