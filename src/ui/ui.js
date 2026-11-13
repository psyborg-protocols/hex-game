// ui.js
// The DOM chrome around the canvas, and the rule it is built to: it whispers.
//
// Nothing here announces itself. There are no banners, no boxes round the
// numbers, no list of instructions in the corner. What the game has to tell you
// it tells you once, quietly, as near to the thing it is about as it can get:
//
//   on the world    a place's name rises from the hex you found it on; what you
//                   gathered rises from your own head
//   as a murmur     one plain line, bottom left, that fades: what you learned,
//                   what you cannot do and why
//   in the corners  two thin bars and the moon; the one thing you are reaching
//                   for next. Each opens up when you point at it, and says more
//                   by itself only when it matters — a bar pulses when it is
//                   low, a hint surfaces when you have been stuck a while
//   as a card       the name of a new chapter, once, across the top
//
// Everything that can be asked is still answerable: point at a corner, open a
// panel. It just does not speak first.

import { SKILLS, MAX_LEVEL, moonOf, isNight, MOON_DAYS, DUSK, OMENS_AT, isFree } from '../game/state.js';
import { levelOf, progress, skillIcon } from '../game/skills.js';
import { foodValue, maxEnergy, capacity, usedSlots } from '../game/inventory.js';
import { attackDice, defenseDice, maxHp } from '../game/gear.js';
import { STAGES, currentStage } from '../game/journey.js';
import { chime } from './chime.js';

/** How long a goal goes unmet before its hint surfaces by itself, in seconds. */
const HINT_AFTER = 75;
/** ...and for the very first goal, when you have not yet done anything at all. */
const FIRST_HINT_AFTER = 8;

export class UI {
  constructor(game) {
    this.game = game;
    this.stage = document.getElementById('stage');
    this.hud = document.getElementById('hud');
    this.hudStats = document.getElementById('hud-stats');
    this.hudMore = document.getElementById('hud-more');
    this.journey = document.getElementById('journey');
    this.worldspace = document.getElementById('worldspace');
    this.murmurs = document.getElementById('murmurs');
    this.card = document.getElementById('card');
    this.modalRoot = document.getElementById('modal-root');
    this.taskbar = document.getElementById('taskbar');
    this.actions = document.getElementById('actions');
    this.offers = [];

    this.held = [];           // moments that arrived while a panel was open
    this.alert = { text: '', tone: '' };
    this.goal = { id: null, since: performance.now(), done: null, doneAt: 0 };

    this.anchors = [];        // { el, q, r } or { el, pos:()=>{x,y} }; see positionAnchors
    this.openPanelName = null;
    this.busy = null;

    this.buildTaskbar();
    // The corners open on a pointer; on a touch screen there is no pointer to
    // rest on them, so a tap holds them open and a tap elsewhere lets go.
    for (const el of [this.hud, this.journey]) {
      el.addEventListener('click', () => el.classList.toggle('open'));
    }
    document.getElementById('view').addEventListener('pointerdown', () => {
      this.hud.classList.remove('open');
      this.journey.classList.remove('open');
    });

    this.modalRoot.addEventListener('pointerdown', e => {
      if (e.target === this.modalRoot && !this.sticky) this.closePanel();
    });
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.openPanelName) {
        e.handledByPanel = true;      // so the game does not read it as "open the menu"
        if (!this.sticky) this.closePanel();
      }
    });
  }

  get paused() { return !!this.openPanelName; }

  // ------------------------------------------------------------- taskbar

  /**
   * The menu buttons: a glyph each. A button keeps its name beside it until you
   * have opened it once — after that you know what it is, and it stops saying.
   */
  buildTaskbar() {
    this.taskbar.innerHTML = '';
    const opened = this.seen();

    this.eyeButton = document.createElement('button');
    this.eyeButton.className = 'eye';
    this.eyeButton.title = 'What you know of the land (Space)';
    this.eyeButton.setAttribute('aria-label', 'What you know of the land');
    this.eyeButton.setAttribute('aria-pressed', 'false');
    this.eyeButton.innerHTML = GLYPHS.eye;
    this.eyeButton.addEventListener('click', () => { this.eyeButton.blur(); this.game.toggleEye(); });
    this.taskbar.appendChild(this.eyeButton);

    for (const [name, label, key] of TASKS) {
      const b = document.createElement('button');
      b.innerHTML = `${GLYPHS[name]}<span class="lbl">${label}</span>`;
      b.title = `${label} (${key})`;
      b.setAttribute('aria-label', label);
      b.dataset.panel = name;
      b.classList.toggle('new', !opened[name]);
      b.addEventListener('click', () => { b.blur(); this.togglePanel(name); });
      this.taskbar.appendChild(b);
    }
  }

  /** Which panels you have opened, kept with the game so a reload remembers. */
  seen() {
    const s = this.game.state;
    s.ui ||= {};
    s.ui.opened ||= {};
    return s.ui.opened;
  }

  setEye(on) {
    this.eyeButton.classList.toggle('on', on);
    this.eyeButton.setAttribute('aria-pressed', String(on));
  }

  /** Let a taskbar button glow, so the player notices something new is possible. */
  nudge(panel, on = true) {
    this.taskbar.querySelector(`[data-panel="${panel}"]`)?.classList.toggle('nudge', on);
  }

  // -------------------------------------------------------------- moments

  /**
   * Something happened that is worth knowing: a find, a deed, a level, a goal,
   * a raid. Each kind is said in the quietest form that still says it.
   */
  ping(m) {
    if (this.openPanelName) { this.held.push(m); return; }
    const you = () => this.game.player.pos;

    switch (m.kind) {
      case 'scenic':
        // The place names itself, over the place.
        this.floatText(you, m.title, `place tier-${m.tier}`, 3200);
        chime(['tick', 'copper', 'silver', 'gold'][m.tier]);
        break;
      case 'village':
        this.floatText(you, m.title.replace(/^Arrived at /, ''), 'place', 2800);
        chime('village');
        break;
      case 'goal':
        // The corner strikes the line through; that is the announcement.
        chime('achievement', 0.03);
        break;
      case 'trade':
        // Said already, by whoever handed the favour over.
        break;
      case 'achievement':
        this.murmur(m.title, { tone: 'deed', ms: 5200 });
        chime('achievement', 0.04);
        break;
      case 'level':
        this.murmur(m.title.toLowerCase(), { tone: 'level', ms: 5200 });
        chime('achievement', 0.04);
        break;
      case 'stage':
        this.showCard(m.title, m.sub);
        chime('gold');
        break;
      case 'raid':
        this.murmur([m.title, m.sub].filter(Boolean).join('. ').replace(/\.\./g, '.'), { tone: 'bad', ms: 9000 });
        chime('raid');
        break;
      case 'victory':
        this.murmur([m.title, m.sub].filter(Boolean).join('. ').replace(/\.\./g, '.'), { tone: 'good', ms: 8000 });
        chime('gold');
        break;
      default:
        this.murmur(m.title, { ms: 5200 });
        chime('village');
    }
  }

  /**
   * A line, bottom left, that comes and goes. The whole of the game's running
   * commentary is these: at most four, plain text, no box.
   */
  murmur(text, { tone = '', ms = 3600 } = {}) {
    if (!text) return;
    // Said again while it is still up: let it linger rather than repeat.
    const same = [...this.murmurs.children].find(el => el.textContent === text && !el.classList.contains('gone'));
    if (same) { same.remove(); }
    const el = document.createElement('div');
    el.className = `murmur ${tone}`;
    el.style.setProperty('--life', `${ms}ms`);
    el.textContent = text;
    this.murmurs.appendChild(el);
    while (this.murmurs.children.length > 4) this.murmurs.firstChild.remove();
    setTimeout(() => el.remove(), ms);
  }

  /** A chapter's name, once, across the top: the only thing here that is large. */
  showCard(title, sub = '') {
    this.card.innerHTML = `<div class="card"><b>${escapeHtml(title)}</b>${sub ? `<span>${escapeHtml(sub)}</span>` : ''}</div>`;
    clearTimeout(this.cardTimer);
    this.cardTimer = setTimeout(() => { this.card.innerHTML = ''; }, 5200);
  }

  /**
   * What is coming, or here: a line under the moon. `tone` is 'omens' or 'raid';
   * a raid also darkens the edges of the screen, which says "night, and not a
   * safe one" without a word.
   */
  setAlert(text, tone = '') {
    if (this.alert.text === text && this.alert.tone === tone) return;
    this.alert = { text: text || '', tone };
    this.stage.classList.toggle('raid-night', tone === 'raid');
    this.updateHud();
  }

  notify(message, ms = 3600, tone = '') {
    // With a panel open the murmurs are behind it, so the panel says it itself.
    const status = this.currentPanel?.status;
    if (status) {
      status.textContent = message;
      status.className = `modal-status on ${tone}`;
      clearTimeout(this.statusTimer);
      this.statusTimer = setTimeout(() => { status.className = 'modal-status'; }, Math.max(ms, 3200));
      return;
    }
    this.murmur(message, { tone, ms: Math.max(ms, 3600) });
  }

  // ------------------------------------------------------------------ HUD

  /**
   * The top-left corner: health, energy, the moon. Bars, not numbers. A bar
   * says more only when it has to — it pulses when it runs low — and the
   * numbers, gold, dice and skills are all there the moment you point at it.
   */
  updateHud() {
    const s = this.game.state;
    const hpMax = maxHp(s);
    const eMax = maxEnergy(s);
    const moon = moonOf(s);
    const night = isNight(s);
    const pct = (v, m) => Math.max(0, Math.min(100, Math.round((v / m) * 100)));
    const food = foodValue(s);
    const hurt = s.hp <= hpMax * 0.4;
    const hungry = !isFree(s) && s.energy <= eMax * 0.4 && food === 0;
    const phase = moon.phase === 'fair' ? '' : PHASE_NAMES[moon.phase];

    this.hudStats.innerHTML = `
      <div class="vital hp${hurt ? ' low' : ''}"><i style="width:${pct(s.hp, hpMax)}%"></i></div>
      <div class="vital en${hungry ? ' low' : ''}"><i style="width:${pct(s.energy, eMax)}%"></i></div>
      <div class="sky ${night ? 'night' : ''}">
        <span class="orb">${night ? '&#9790;' : '&#9728;'}</span>
        <div class="moon" style="--omens:${MOON_MARKS.omens}%; --dusk:${MOON_MARKS.dusk}%"><i style="left:${(moon.progress * 100).toFixed(1)}%"></i></div>
      </div>
      ${this.alert.text ? `<div class="omen ${this.alert.tone}">${escapeHtml(this.alert.text)}</div>` : ''}`;

    this.hudMore.innerHTML = `
      <div><b>${Math.max(0, s.hp)}</b>/${hpMax} health &middot; <b>${Math.floor(s.energy)}</b>/${eMax} energy</div>
      <div>${food ? `food for <b>${food}</b> more` : 'no food in your pack'}</div>
      <div><b>${s.gold}</b> gold &middot; ${usedSlots(s)}/${capacity(s)} slots &middot; ${attackDice(s)} attack, ${defenseDice(s)} defence</div>
      <div>moon <b>${moon.moon}</b>, day <b>${moon.day}</b> of ${MOON_DAYS}${phase ? ` &middot; ${phase}` : ' &middot; fair days'}</div>
      <div class="skills">${SKILLS.map(skill => {
        const level = levelOf(s, skill);
        const p = level >= MAX_LEVEL ? 100 : Math.round(progress(s, skill) * 100);
        return `<div class="skill"><img src="${skillIcon(skill)}" alt=""><span>${skill}</span><b>${level}</b>
          <div class="xp"><i style="width:${p}%"></i></div></div>`;
      }).join('')}</div>
      ${s.free ? '<div class="free">free resources: nothing costs anything</div>' : ''}`;

    this.updateJourney();
  }

  /**
   * The top-right corner: the one thing you are reaching for. One line. Point
   * at it for the chapter and the rest of its goals, each with how. Left alone
   * it gives the how by itself only if you have been on the same goal a while.
   */
  updateJourney() {
    if (!this.journey) return;
    const s = this.game.state;
    const { stage, index, done } = currentStage(s);
    const next = stage.goals.find(g => !s.goals?.[g.id]) || null;
    const now = performance.now();

    if ((next?.id ?? null) !== this.goal.id) {
      // The old line is struck through and let go before the new one settles.
      if (this.goal.id && this.goal.text) { this.goal.done = this.goal.text; this.goal.doneAt = now; }
      this.goal.id = next?.id ?? null;
      this.goal.text = next?.text ?? '';
      this.goal.since = now;
    }
    const struck = this.goal.done && now - this.goal.doneAt < 2400 ? this.goal.done : null;
    const first = index === 0 && next === stage.goals[0];
    const waited = (now - this.goal.since) / 1000;
    const stuck = !!next && waited > (first ? FIRST_HINT_AFTER : HINT_AFTER);
    const fresh = waited < 14;

    const rest = stage.goals.map(g => {
      const met = !!s.goals?.[g.id];
      return `<li class="${met ? 'met' : g === next ? 'now' : ''}"><span>${escapeHtml(g.text)}</span>${met ? '' : `<small>${escapeHtml(g.hint)}</small>`}</li>`;
    }).join('');

    const html = `
      ${struck ? `<div class="goal-done">${escapeHtml(struck)}</div>` : ''}
      <div class="goal-now">${done ? 'The vale is free.' : escapeHtml(next?.text || '')}</div>
      ${next ? `<div class="goal-hint">${escapeHtml(next.hint)}</div>` : ''}
      <div class="goal-more"><div class="chapter">${escapeHtml(stage.name)} <span>&middot; ${index + 1} of ${STAGES.length}</span></div><ul>${rest}</ul></div>`;
    // Only touched when it changes: this runs four times a second, and
    // rewriting it would restart the fade on a line that is trying to fade.
    const sig = `${html}|${stuck}|${fresh}`;
    if (sig === this.journeySig) return;
    this.journeySig = sig;
    this.journey.innerHTML = html;
    this.journey.classList.toggle('stuck', stuck);
    this.journey.classList.toggle('fresh', fresh);
  }

  // ---------------------------------------------------------- on the world

  /** A timed action: a thin bar over your head. Resolves when it is done. */
  showProgress(label, ms, at) {
    if (this.busy) return Promise.resolve(false);
    const el = document.createElement('div');
    el.className = 'progress';
    el.setAttribute('aria-label', label);
    el.innerHTML = '<i></i>';
    this.worldspace.appendChild(el);
    const anchor = { el, q: at.q, r: at.r };
    this.anchors.push(anchor);
    this.busy = anchor;

    el.firstChild.style.transition = `width ${ms}ms linear`;
    requestAnimationFrame(() => { el.firstChild.style.width = '100%'; });

    return new Promise(resolve => {
      setTimeout(() => {
        el.remove();
        this.anchors = this.anchors.filter(a => a !== anchor);
        this.busy = null;
        resolve(true);
      }, ms);
    });
  }

  /**
   * Dice over a combatant: red attack dice against white defence dice, hits
   * and blocks lit, and the damage that got through.
   */
  showDice(pos, roll, { friendly = false } = {}) {
    const el = document.createElement('div');
    el.className = `dice ${friendly ? 'friendly' : 'hostile'}`;
    const face = (v, cls, on) => `<i class="die ${cls}${on ? ' on' : ''}">${v}</i>`;
    el.innerHTML = `${roll.attack.map(v => face(v, 'atk', v >= 4)).join('')}
      <span class="vs">/</span>${roll.defense.map(v => face(v, 'def', v >= 5)).join('') || '<span class="dim">-</span>'}
      <b class="dmg ${roll.damage ? '' : 'miss'}">${roll.damage ? `-${roll.damage}` : '&middot;'}</b>`;
    this.worldspace.appendChild(el);
    const anchor = { el, pos, born: performance.now() };
    this.anchors.push(anchor);
    setTimeout(() => { el.classList.add('out'); }, 900);
    setTimeout(() => { el.remove(); this.anchors = this.anchors.filter(a => a !== anchor); }, 1200);
  }

  /** A word or number rising off something: "+2 log", the name of a place. */
  floatText(pos, text, cls = '', ms = 1500) {
    const el = document.createElement('div');
    el.className = `float ${cls}`;
    el.style.setProperty('--life', `${ms}ms`);
    el.textContent = text;
    this.worldspace.appendChild(el);
    const anchor = { el, pos };
    this.anchors.push(anchor);
    setTimeout(() => { el.remove(); this.anchors = this.anchors.filter(a => a !== anchor); }, ms);
  }

  // ------------------------------------------------------- context buttons

  /**
   * What this hex offers, as a row of words over the taskbar. Docked rather
   * than floated over the pawn: a column of six above your head covered the
   * ground you were looking at and anything else that had to appear there.
   */
  setContext(offers, at, onPick) {
    this.clearContext();
    if (this.busy || this.openPanelName) return;
    this.offers = offers.slice(0, 9);
    this.contextPick = onPick;
    this.offers.forEach((offer, i) => {
      const b = document.createElement('button');
      b.className = `context-button${offer.important ? ' important' : ''}`;
      b.innerHTML = `<kbd>${i + 1}</kbd>${escapeHtml(offer.label)}`;
      b.addEventListener('click', e => { e.stopPropagation(); b.blur(); onPick(offer); });
      this.actions.appendChild(b);
    });
  }

  /** Number keys pick the action buttons. */
  pickContext(n) {
    const offer = this.offers[n];
    if (offer && this.contextPick) this.contextPick(offer);
  }

  clearContext() {
    this.actions.innerHTML = '';
    this.offers = [];
  }

  /**
   * Put everything anchored to the world where its hex or figure is on screen.
   *
   * Two rules keep them readable. They sit a fixed distance above the figure in
   * *world* pixels, so they clear its head at any zoom rather than only at the
   * default one. And no two may overlap: a later one that would land on an
   * earlier one is moved up to sit above it, so the dice from a fight, the
   * "+2 log" from the tree you were felling and the bar for the next swing
   * stack instead of piling into one unreadable smear.
   */
  positionAnchors(camera, map, dpr) {
    const head = (26 * camera.scale) / dpr;
    const placed = [];
    for (const a of this.anchors) {
      let wx, wy;
      if (a.pos) { const p = a.pos(); wx = p.x; wy = p.y; }
      else {
        const h = Math.max(0, map.surfaceAt(a.q, a.r));
        const c = this.game.tileCenter(a.q, a.r, h);
        wx = c.cx; wy = c.cy;
      }
      const p = camera.worldToScreen(wx, wy);
      const rise = a.born ? Math.min(14, (performance.now() - a.born) / 60) : 0;
      const x = p.x / dpr;
      let y = p.y / dpr - head - rise;
      const w = (a.w ||= a.el.offsetWidth || 60);
      const h = (a.h ||= a.el.offsetHeight || 20);
      for (let pass = 0; pass < 4; pass++) {
        const hit = placed.find(b => Math.abs(b.x - x) < (b.w + w) / 2 && y - h < b.y && y > b.y - b.h);
        if (!hit) break;
        y = hit.y - hit.h - 3;
      }
      placed.push({ x, y, w, h });
      a.el.style.left = `${x}px`;
      a.el.style.top = `${y}px`;
    }
  }

  // -------------------------------------------------------------- panels

  togglePanel(name) {
    if (this.openPanelName === name) this.closePanel();
    else this.openPanel(name);
  }

  openPanel(name, props = {}) {
    if (this.sticky) return;
    const panel = this.game.panels[name];
    if (!panel) return;
    this.openPanelName = name;
    this.modalRoot.innerHTML = '';
    this.clearContext();
    this.nudge(name, false);

    // Opened once, a button no longer needs its name beside it.
    const opened = this.seen();
    if (!opened[name]) {
      opened[name] = 1;
      this.taskbar.querySelector(`[data-panel="${name}"]`)?.classList.remove('new');
    }

    const modal = document.createElement('div');
    modal.className = `modal ${panel.wide ? 'wide' : ''}`;
    modal.innerHTML = `<header><h2>${panel.title(props, this.game)}</h2>
      ${props.sticky ? '' : '<button class="close" aria-label="Close">&times;</button>'}</header>
      <div class="modal-body"></div>
      <footer class="modal-status" role="status"></footer>`;
    modal.querySelector('.close')?.addEventListener('click', () => this.closePanel());
    this.modalRoot.appendChild(modal);
    this.sticky = !!props.sticky;

    this.currentPanel = { name, panel, props, body: modal.querySelector('.modal-body'), status: modal.querySelector('.modal-status') };
    this.refreshPanel();
  }

  refreshPanel() {
    if (!this.currentPanel) return;
    const { panel, props, body } = this.currentPanel;
    const scroll = body.scrollTop;
    body.innerHTML = panel.render(this.game, props);
    panel.bind?.(this.game, body, props);
    body.scrollTop = scroll;
    this.updateHud();
  }

  closePanel() {
    this.modalRoot.innerHTML = '';
    this.openPanelName = null;
    this.currentPanel = null;
    this.sticky = false;
    this.game.onPanelClosed?.();
    // What happened while the panel was up, said now that it can be seen.
    const held = this.held;
    this.held = [];
    for (const m of held) this.ping(m);
  }
}

const TASKS = [
  ['inventory', 'Pack', 'I'],
  ['crafting', 'Craft', 'C'],
  ['build', 'Build', 'B'],
  ['skills', 'Skills', 'K'],
  ['menu', 'Game', 'Esc'],
];

const PHASE_NAMES = { fair: 'fair days', omens: 'omens', raid: 'raid night' };

/** Where on the moon dial the omens and the last dusk fall, as percentages. */
const MOON_MARKS = {
  omens: ((MOON_DAYS - 1 + OMENS_AT) / MOON_DAYS) * 100,
  dusk: ((MOON_DAYS - 1 + DUSK) / MOON_DAYS) * 100,
};

const svg = body => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

/** One glyph a button: an eye, a pack, a hammer, a roof, a star, a cog. */
const GLYPHS = {
  eye: svg('<path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none"/>'),
  inventory: svg('<path d="M6 9h12l1.2 10.5H4.8z"/><path d="M9 9V7a3 3 0 0 1 6 0v2"/><path d="M9.5 13h5"/>'),
  crafting: svg('<path d="M14 4l6 6-3 3-6-6z"/><path d="M12.5 8.5L4 17l3 3 8.5-8.5"/>'),
  build: svg('<path d="M3 11.5L12 4l9 7.5"/><path d="M5.5 10v10h13V10"/><path d="M10 20v-5.5h4V20"/>'),
  skills: svg('<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>'),
  menu: svg('<circle cx="12" cy="12" r="3"/><path d="M12 2.8v3M12 18.2v3M2.8 12h3M18.2 12h3M5.5 5.5l2.1 2.1M16.4 16.4l2.1 2.1M18.5 5.5l-2.1 2.1M7.6 16.4l-2.1 2.1"/>'),
};

export const icon = (item, size = 24) =>
  `<img class="icon" src="${item?.icon || 'icons/stone.svg'}" alt="" width="${size}" height="${size}">`;

export const escapeHtml = s => String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const skillDots = (state, skill) => {
  const level = levelOf(state, skill);
  return Array.from({ length: MAX_LEVEL }, (_, i) =>
    `<i class="pip${i < level ? ' on' : ''}"></i>`).join('');
};
