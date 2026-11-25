// panels/trade.js — a village: its favour first, then its market.

import { ITEMS, itemName, isNight } from '../../game/state.js';
import { stockOf, trustOf, isRaided, kindOf, sellPrice, ensureVillage, villageKey } from '../../game/economy.js';
import { VILLAGE_SLEEP_COST } from '../../game/sleep.js';
import { countItem, lentCount } from '../../game/inventory.js';
import {
  jobOf, canWork, rankAt, payFor, teaches, staffPrice, errandShort, bringText, freeBedTonight,
  RANK_NAMES, JOB_SHIFT_TURNS, ensureJobs,
} from '../../game/jobs.js';
import { JOB_RANKS, JOB_XP_PER_SHIFT } from '../../../data/game_data.js';
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

/** The village's job: what it pays, your rank, and whether you can start now. */
function workBlock(game, col) {
  const { state } = game;
  const job = jobOf(col.feature);
  if (!job) return '';
  const key = villageKey(col.q, col.r);
  const rank = rankAt(state, key);
  const p = ensureJobs(state).places[key];
  const shifts = p?.shifts || 0;
  const check = canWork(state, col);
  const perks = [
    `${payFor(job, rank)}g`,
    ...Object.entries(job.goods || {}).map(([id, n]) => `${n} ${itemName(id)}`),
    ...(teaches(state, job) ? [`${JOB_XP_PER_SHIFT} ${job.skill} xp`] : []),
    ...(job.bed ? ['a free bed tonight'] : []),
  ];
  const next = rank === 'hand'
    ? `Apprentice after ${JOB_RANKS.apprentice.shifts - shifts} more shift${JOB_RANKS.apprentice.shifts - shifts === 1 ? '' : 's'}: errands, and better pay.`
    : rank === 'apprentice'
      ? `Journeyman after ${Math.max(0, JOB_RANKS.journeyman.shifts - shifts)} more shift${JOB_RANKS.journeyman.shifts - shifts === 1 ? '' : 's'}${(p?.errandsDone || 0) < JOB_RANKS.journeyman.errands ? ' and an errand done' : ''}: ${job.gift ? `a ${itemName(job.gift).toLowerCase()} of your own, and ` : ''}staff prices at the market.`
      : 'Journeyman: you pay staff prices at the market here.';
  const when = job.shift === 'evening' ? 'the supper rush, late afternoon into the night' : `half a day, ${JOB_SHIFT_TURNS} turns`;
  return `<div class="job">
      <h3>${escapeHtml(job.name)} <span class="dim">&middot; ${RANK_NAMES[rank]}${shifts ? `, ${shifts} shift${shifts === 1 ? '' : 's'} worked` : ''}</span></h3>
      <p class="dim">The ${escapeHtml(job.master)} takes on help for ${when}. One shift a day.</p>
      <div class="trade-row"><span>A shift pays <b>${escapeHtml(perks.join(' + '))}</b></span>
        <button data-work ${check.ok ? '' : 'disabled'}>Work a shift</button></div>
      ${check.ok ? '' : `<p class="dim hint">${escapeHtml(check.reason)}</p>`}
      <p class="dim">${escapeHtml(next)}</p>
    </div>`;
}

/** The errand you are on, if it is for this village. */
function errandBlock(game, col) {
  const { state } = game;
  const e = ensureJobs(state).errand;
  if (!e || e.village !== villageKey(col.q, col.r)) return '';
  const short = errandShort(state);
  const left = Math.max(0, e.due - Math.floor(state.turn || 0));
  const rows = Object.entries(e.bring).map(([id, n]) => {
    const have = Math.max(0, countItem(state, id) - lentCount(state, id));
    return `<div class="trade-row">${icon(ITEMS[id], 24)}<span>${n} &times; ${escapeHtml(itemName(id))}</span><span class="dim">you have ${have}</span></div>`;
  }).join('');
  return `<div class="errand">
      <h3>Errand <span class="dim">&middot; ${left} turn${left === 1 ? '' : 's'} left</span></h3>
      ${rows}
      <div class="trade-row"><span class="dim">${e.lent.length
        ? `Lent to you: ${e.lent.map(id => escapeHtml(itemName(id))).join(', ')}. ${e.lent.length > 1 ? 'They go' : 'It goes'} back when you hand in.`
        : 'Bring it all, then hand it over here.'}</span>
        <button data-hand-in ${short.length ? 'disabled' : ''}>Hand over</button></div>
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

    const freeBed = freeBedTonight(state, villageKey(col.q, col.r));
    const bedCost = state.free || freeBed ? 0 : VILLAGE_SLEEP_COST;
    const sleepInn = (isNight(state) && !isRaided(state, col.q, col.r))
      ? `<p><button type="button" class="link-btn" data-sleep-village ${state.gold >= bedCost ? '' : 'disabled'}>Sleep in the village until dawn (${freeBed ? 'on the house: you worked tonight' : bedCost ? `${bedCost}g` : 'free'})</button></p>`
      : '';
    const work = workBlock(game, col) + errandBlock(game, col);

    if (!trust?.done) {
      const { item, qty } = trust.favour;
      const have = countItem(state, item);
      return `${head}${sleepInn}${work}
        <div class="favour">
          <p class="elder">&ldquo;We don't trade with strangers. Do us a turn first &mdash;
            bring us <b>${qty} ${escapeHtml(itemName(item))}</b>, and you'll find us friendly.&rdquo;</p>
          <div class="trade-row">${icon(ITEMS[item], 28)}<span>${qty} &times; ${escapeHtml(itemName(item))}</span>
            <span class="dim">you have ${have}</span>
            <button data-favour ${have >= qty || state.free ? '' : 'disabled'}>Hand them over</button></div>
          <p class="dim">Their trust opens a market, the use of their ${escapeHtml(station)},
            and what they know of the land around them.${jobOf(col.feature) ? ' A finished shift earns it too.' : ''}</p>
          <p class="dim hint">${escapeHtml(ITEMS[item]?.desc || '')}</p>
        </div>
        ${hintBox(props.hintIndex)}`;
    }

    if (isRaided(state, col.q, col.r)) {
      return `${head}${errandBlock(game, col)}<p class="raided">Raiders have been through. The stalls are smashed &mdash; come back tomorrow.</p>${hintBox(props.hintIndex)}`;
    }

    const prices = stockOf(state, col.q, col.r);
    const buyRows = Object.entries(prices).map(([id, listed]) => {
      const price = staffPrice(state, col, id, listed);
      return `<div class="trade-row">
        ${icon(ITEMS[id], 24)}<span>${escapeHtml(itemName(id))}</span>
        <span class="dim">have ${countItem(state, id)}</span>
        <button data-buy="${id}" ${state.gold < price && !state.free ? 'disabled' : ''}>Buy ${price < listed ? `<s>${listed}</s> ` : ''}${price}g</button></div>`;
    }).join('');

    const seen = new Set();
    const sellRows = state.inventory.filter(s => s && countItem(state, s.id) > lentCount(state, s.id) && !seen.has(s.id) && seen.add(s.id)).map(s => `<div class="trade-row">
        ${icon(ITEMS[s.id], 24)}<span>${escapeHtml(itemName(s.id))}</span>
        <span class="dim">have ${countItem(state, s.id)}</span>
        <button data-sell="${s.id}">Sell ${sellPrice(col.feature, s.id)}g</button></div>`).join('');

    return `${head}${sleepInn}${work}
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
    body.querySelector('[data-work]')?.addEventListener('click', () => game.doWork(col));
    body.querySelector('[data-hand-in]')?.addEventListener('click', () => game.doHandIn(col));
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
