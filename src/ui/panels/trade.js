// panels/trade.js — a village: its favour first, then its market.

import { ITEMS, itemName, isNight } from '../../game/state.js';
import { stockOf, trustOf, isRaided, kindOf, sellPrice, ensureVillage, villageKey } from '../../game/economy.js';
import { VILLAGE_SLEEP_COST } from '../../game/sleep.js';
import { countItem, lentCount } from '../../game/inventory.js';
import {
  jobOf, canWork, rankAt, payFor, teaches, staffPrice, errandShort, freeBedTonight,
  RANK_NAMES, ensureJobs, dueText, spokenGoods,
} from '../../game/jobs.js';
import { JOB_RANKS, JOB_XP_PER_SHIFT } from '../../../data/game_data.js';
import { icon, escapeHtml } from '../ui.js';

const VILLAGE_HINTS = [
  'An axe will bring a tree down. Bare hands will only shake a twig loose.',
  'Two good stones, a stout branch and a length of cord. That is all an axe asks of you.',
  'Reeds grow where the shore is low and wet. Twist them into cord, and half the work of the valley is open to you.',
  'Stand still a while on ground you do not know. Berries and herbs show themselves to those who look.',
  'Raw meat will fill a belly, but meat cooked over a fire goes much further.',
  'A cliff too steep to climb can be quarried with a hammer, or beaten with a ladder.',
  'Do not chase a rabbit. Set a snare of cord where it runs, or learn the bow.',
  'Those who look closely at the world learn to read the rock, and the rock tells them where the ore lies.',
  'No one lifts hot iron from a forge by hand. Green wood and cord make tongs enough to begin with.',
  'Wild grain grows among the meadow grass. Sow it in turned earth and it will repay you many times over.',
  'When smoke rises over the far bank, trouble is coming. A wall or a watchtower, raised before nightfall, buys you time.',
  'Be a friend to a village, and its hearth, its workbench or its forge is yours to use while you stay.',
  'You will want a flint knife before you can split logs into planks. Flint is scarce in the low valley, but every village keeps knives to sell.',
  'When a place takes your breath away, sit a while and take it in. Nothing clears the mind like it.',
  'Climb a high ridge and look about you. The higher you stand, the further you will see.',
  'Most villages will take on a willing pair of hands for half a day, stranger or not.',
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
  // In words, as the village would put it. The exact figures are there on hover.
  const words = [
    rank === 'hand' ? 'a few coins' : 'a fair wage',
    ...(job.goods?.bread ? ['fresh bread'] : []),
    ...(teaches(state, job) ? [`something of ${job.skill}`] : []),
    ...(job.bed ? ['a bed for the night'] : []),
  ];
  const pays = words.length > 1 ? `${words.slice(0, -1).join(', ')} and ${words.at(-1)}` : words[0];
  const exact = [
    `${payFor(job, rank)} gold`,
    ...Object.entries(job.goods || {}).map(([id, n]) => `${n} ${itemName(id)}`),
    ...(teaches(state, job) ? [`${JOB_XP_PER_SHIFT} ${job.skill} xp`] : []),
    ...(job.bed ? ['a free bed'] : []),
  ].join(' \u00b7 ');
  const errandDone = (p?.errandsDone || 0) >= JOB_RANKS.journeyman.errands;
  const next = rank === 'hand'
    ? `Keep coming back, and the ${job.master} may take you on as an apprentice.`
    : rank === 'apprentice'
      ? `${errandDone ? 'Keep at it' : 'Prove yourself on an errand and keep at it'}, and in time you will be a journeyman.${job.gift ? ` The ${job.master}'s journeymen work with tools of their own.` : ''}`
      : 'As a journeyman, you pay at the stalls what their own people pay.';
  const about = job.shift === 'evening'
    ? `The ${job.master} needs hands for the supper trade, from late afternoon into the night.`
    : `The ${job.master} will take on a helper for half a day's work.`;
  return `<div class="job">
      <h3>${escapeHtml(job.name)} <span class="dim">&middot; ${RANK_NAMES[rank]}</span></h3>
      <p class="dim">${escapeHtml(about)}</p>
      <div class="trade-row"><span title="${escapeHtml(exact)}">The work pays ${escapeHtml(pays)}.</span>
        <button data-work ${check.ok ? '' : 'disabled'}>${job.shift === 'evening' ? 'Work the evening' : 'Work half a day'}</button></div>
      ${check.ok ? '' : `<p class="dim hint">${escapeHtml(check.reason)}</p>`}
      ${shifts ? `<p class="dim">${escapeHtml(next)}</p>` : ''}
    </div>`;
}

/** The errand you are on, if it is for this village. */
function errandBlock(game, col) {
  const { state } = game;
  const e = ensureJobs(state).errand;
  if (!e || e.village !== villageKey(col.q, col.r)) return '';
  const short = errandShort(state);
  const rows = Object.entries(e.bring).map(([id, n]) => {
    const have = Math.max(0, countItem(state, id) - lentCount(state, id));
    return `<div class="trade-row">${icon(ITEMS[id], 24)}<span>${n} &times; ${escapeHtml(itemName(id))}</span><span class="dim">you have ${have}</span></div>`;
  }).join('');
  return `<div class="errand">
      <h3>Errand <span class="dim">&middot; due ${escapeHtml(dueText(state, e.due))}</span></h3>
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
          <p class="elder">&ldquo;We do not trade with strangers. Bring us
            <b>${escapeHtml(spokenGoods({ [item]: qty }))}</b>, and we will know you mean well.&rdquo;</p>
          <div class="trade-row">${icon(ITEMS[item], 28)}<span>${qty} &times; ${escapeHtml(itemName(item))}</span>
            <span class="dim">you have ${have}</span>
            <button data-favour ${have >= qty || state.free ? '' : 'disabled'}>Hand them over</button></div>
          <p class="dim">Their trust opens a market, the use of their ${escapeHtml(station)},
            and what they know of the land around them.${jobOf(col.feature) ? ' Half a day of honest work for them earns it too.' : ''}</p>
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
