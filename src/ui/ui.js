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

import {
  SKILLS, MAX_LEVEL, DAY_TURNS, NIGHT_TURNS, TURNS_PER_DAY, OMENS_TURN,
  dayOf, moonOf, MOON_DAYS, isFree, ACTIONS_PER_TURN, fatigueOf, FATIGUE,
} from '../game/state.js';
import { levelOf, progress, skillIcon } from '../game/skills.js';
import { foodValue, maxEnergy, restedMaxEnergy, capacity, usedSlots } from '../game/inventory.js';
import { attackDice, defenseDice, maxHp } from '../game/gear.js';
import { maxMoveDistance, ensureTurnState } from '../game/turns.js';
import { STAGES, currentStage } from '../game/journey.js';
import { bringText, errandShort, dueText } from '../game/jobs.js';
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
    this.hudAlerts = document.getElementById('hud-alerts');
    this.journey = document.getElementById('journey');
    this.worldspace = document.getElementById('worldspace');
    this.murmurs = document.getElementById('murmurs');
    this.card = document.getElementById('card');
    this.modalRoot = document.getElementById('modal-root');
    this.taskbar = document.getElementById('rail');
    this.actions = document.getElementById('actions');
    this.offers = [];

    this.held = [];           // moments that arrived while a panel was open
    this.alert = { text: '', tone: '' };
    this.goal = { id: null, since: performance.now(), done: null, doneAt: 0 };

    this.anchors = [];        // { el, q, r } or { el, pos:()=>{x,y} }; see positionAnchors
    this.openPanelName = null;
    this.busy = null;

    this.buildTaskbar();
    this.wireCarousel();
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
    this.eyeButton.title = 'What you know of the land (E)';
    this.eyeButton.setAttribute('aria-label', 'What you know of the land');
    this.eyeButton.setAttribute('aria-pressed', 'false');
    this.eyeButton.innerHTML = RAIL_ICONS.eye;
    this.eyeButton.addEventListener('click', () => {
      this.eyeButton.blur();
      // On a small screen the eye is all there is: it opens the mind view and
      // the rest of the buttons together, and a tap anywhere else closes both.
      if (this.compact()) this.setRailOpen(!this.taskbar.classList.contains('open'));
      else this.game.toggleEye();
    });
    this.taskbar.appendChild(this.eyeButton);

    for (const [name, label, key] of TASKS) {
      const b = document.createElement('button');
      b.innerHTML = `${RAIL_ICONS[name]}<span class="lbl">${label}</span>`;
      b.title = `${label} (${key})`;
      b.setAttribute('aria-label', label);
      b.dataset.panel = name;
      b.classList.toggle('new', !opened[name]);
      b.addEventListener('click', () => {
        b.blur();
        if (this.compact()) this.setRailOpen(false);
        this.togglePanel(name);
      });
      this.taskbar.appendChild(b);
    }

    // A tap on the world closes the rail on a small screen, and is spent doing it.
    document.getElementById('view').addEventListener('pointerdown', () => {
      if (this.compact() && this.taskbar.classList.contains('open')) {
        this.setRailOpen(false);
        this.swallowTap = true;
      }
    });
  }

  /** A phone, or anything without room for the whole rail. */
  compact() {
    return matchMedia('(max-width: 620px), (pointer: coarse) and (max-width: 1000px)').matches;
  }

  /** Small screens only: the eye opens the mind view and the buttons together. */
  setRailOpen(open) {
    this.taskbar.classList.toggle('open', open);
    this.game.setEye(open);
  }

  /** True once, if the last tap on the world only closed the rail. */
  takeSwallowedTap() {
    const was = !!this.swallowTap;
    this.swallowTap = false;
    return was;
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
        // Goals stay unseen: quiet milestones.
        chime('achievement', 0.03);
        break;
      case 'trade':
        break;
      case 'achievement':
        this.floatText(you, m.title, 'place', 3200);
        chime('achievement', 0.04);
        break;
      case 'level':
        this.murmur(LEVEL_LINES[m.skill] || `You have grown more skilled at ${m.skill}.`, { tone: 'level', ms: 4200 });
        chime('achievement', 0.04);
        break;
      case 'stage':
        this.showCard(m.title, m.sub);
        chime('gold');
        break;
      case 'raid':
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
    ensureTurnState(s);
    const hpMax = maxHp(s);
    const eMax = maxEnergy(s);
    const dInfo = dayOf(s);
    const moon = moonOf(s);
    const night = dInfo.isNight;
    const pct = (v, m) => Math.max(0, Math.min(100, Math.round((v / m) * 100)));
    const food = foodValue(s);
    const hurt = s.hp <= hpMax * 0.4;
    // Up past midnight: a share of max energy is gone until dusk, shown struck off the bar.
    const fatigue = FATIGUE[fatigueOf(s)];
    const tired = !!fatigue;
    const eFull = restedMaxEnergy(s);
    const lostPct = tired ? Math.round(((eFull - eMax) / eFull) * 100) : 0;
    const hungry = !isFree(s) && s.energy <= eMax * 0.4 && food === 0;
    // A raid that runs on into the morning is still a raid.
    const phase = s.raid?.stage === 'night' ? PHASE_NAMES.raid : moon.phase === 'fair' ? '' : PHASE_NAMES[moon.phase];
    const phaseLabel = night ? `Night ${dInfo.phaseTurn}/${NIGHT_TURNS}` : `Day ${dInfo.phaseTurn}/${DAY_TURNS}`;
    const moveMax = maxMoveDistance(s);

    this.hudStats.innerHTML = `
      <div class="hud-top">
        ${dial(dInfo, night, phaseLabel)}
        <div class="hud-bars">
          <div class="bar-row" title="Health">${hudIcon('heart')}<div class="vital hp${hurt ? ' low' : ''}"><i style="width:${pct(s.hp, hpMax)}%"></i></div></div>
          <div class="bar-row" title="Energy">${hudIcon('energy')}<div class="vital en${hungry ? ' low' : ''}${tired ? ' tired' : ''}"><i style="width:${pct(s.energy, eFull)}%"></i>${lostPct ? `<b class="lost" style="width:${lostPct}%"></b>` : ''}</div></div>
          ${moonPips(moon, s)}
        </div>
      </div>`;
    // What is coming, an errand, who is in the room: beside the bars, not under
    // them, so the corner never grows down onto the menus.
    this.hudAlerts.innerHTML = `
      ${this.alert.text ? `<div class="omen ${this.alert.tone}">${escapeHtml(this.alert.text)}</div>` : ''}
      ${errandLine(s)}
      ${this.game.mp?.hudRoster(escapeHtml) || ''}`;

    const stat = (img, value, title) => `<span class="stat" title="${title}">${img}<b>${value}</b></span>`;
    this.hudMore.innerHTML = `
      <div class="stats">
        ${stat(hudIcon('heart'), `${Math.max(0, s.hp)}/${hpMax}`, 'Health')}
        ${stat(hudIcon('energy'), `${Math.floor(s.energy)}/${eMax}`, 'Energy')}
        ${tired ? stat(hudIcon('tired'), `${eMax}/${eFull}`, `${fatigue.name} from staying up: less energy until nightfall`) : ''}
        ${stat(itemIcon('berries'), food, 'Food in your pack')}
        ${stat(itemIcon('gold'), s.gold, 'Gold')}
        ${stat(itemIcon('basket'), `${usedSlots(s)}/${capacity(s)}`, 'Pack slots')}
        ${stat(itemIcon('boots'), moveMax, 'Hexes walked in a turn')}
        ${stat(hudIcon('hand'), ACTIONS_PER_TURN, 'Things done in a turn')}
        ${stat(itemIcon('sword'), attackDice(s), 'Attack dice')}
        ${stat(itemIcon('shield'), defenseDice(s), 'Defence dice')}
        ${stat(hudIcon('moon'), moon.moon, `Moon ${moon.moon}, day ${moon.day} of ${MOON_DAYS}${phase ? `: ${phase}` : ''}`)}
      </div>
      <div class="skills">${SKILLS.map(skill => {
        const level = levelOf(s, skill);
        const p = level >= MAX_LEVEL ? 100 : Math.round(progress(s, skill) * 100);
        return `<div class="skill"><img src="${skillIcon(skill)}" alt=""><span>${skill}</span><b>${level}</b>
          <div class="xp"><i style="width:${p}%"></i></div></div>`;
      }).join('')}</div>
      ${s.free ? '<div class="free">free resources: nothing costs anything</div>' : ''}`;

    this.updateJourney();
  }

  /** Keep the top-right corner clear so the world itself leads the player. */
  updateJourney() {
    if (this.journey) this.journey.innerHTML = '';
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
    this.offers = offers.slice(0, 12);
    this.contextPick = onPick;
    // Keep what you had chosen if it is still on offer; otherwise the first
    // thing that matters, otherwise the first thing.
    const kept = this.offers.findIndex(o => o.id === this.selectedId);
    const important = this.offers.findIndex(o => o.important);
    this.selected = kept >= 0 ? kept : Math.max(0, important);

    const track = document.createElement('div');
    track.className = 'track';
    this.offers.forEach((offer, i) => {
      const b = document.createElement('button');
      b.className = `context-button${offer.important ? ' important' : ''}`;
      b.innerHTML = `${offer.icon ? `<img class="px" src="${offer.icon}" alt="">` : ''}<span>${escapeHtml(offer.label)}</span>`;
      b.addEventListener('click', e => {
        e.stopPropagation();
        b.blur();
        if (this.spun) return;          // the end of a swipe, not a tap
        this.select(i);
        onPick(offer);
      });
      track.appendChild(b);
    });
    this.actions.appendChild(track);
    this.actions.classList.toggle('single', this.offers.length === 1);
    this.select(this.selected, false);
  }

  /** Bring offer `i` to the middle of the bar. */
  select(i, animate = true) {
    const n = this.offers.length;
    if (!n) return;
    this.selected = ((i % n) + n) % n;
    this.selectedId = this.offers[this.selected].id;
    const track = this.actions.querySelector('.track');
    if (!track) return;
    const buttons = [...track.children];
    buttons.forEach((b, k) => {
      const d = Math.abs(k - this.selected);
      b.classList.toggle('sel', d === 0);
      b.style.opacity = d === 0 ? '' : String(Math.max(0.35, 0.9 - d * 0.22));
      b.tabIndex = d === 0 ? 0 : -1;
    });
    const el = buttons[this.selected];
    track.style.transition = animate ? '' : 'none';
    track.style.transform = `translateX(${this.actions.clientWidth / 2 - (el.offsetLeft + el.offsetWidth / 2)}px)`;
  }

  /** Spin the bar by `step` places. False when there is nothing to spin. */
  spin(step) {
    if (this.offers.length < 2) return false;
    this.select(this.selected + step);
    chime('tick', 0.02);
    return true;
  }

  /** Space: do whatever is in the middle. */
  actSelected() {
    const offer = this.offers[this.selected];
    if (!offer || !this.contextPick) return false;
    this.contextPick(offer);
    return true;
  }

  clearContext() {
    this.actions.innerHTML = '';
    this.offers = [];
  }

  /**
   * The bar spins under a mouse wheel and a sideways swipe. Wired once: the
   * bar's buttons come and go, the bar itself stays.
   */
  wireCarousel() {
    let wheel = 0;
    let wheelAt = 0;
    this.spinWheel = e => {
      const now = performance.now();
      if (now - wheelAt > 250) wheel = 0;
      wheelAt = now;
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      // A notch of a mouse wheel is one step, however big its delta; a
      // trackpad's trickle adds up to one.
      const NOTCH = 40;
      wheel = Math.abs(delta) >= NOTCH ? delta : wheel + delta;
      if (Math.abs(wheel) < NOTCH) return false;
      const step = Math.sign(wheel);
      wheel = 0;
      return this.spin(step);
    };
    this.actions.addEventListener('wheel', e => {
      e.preventDefault();
      if (!e.ctrlKey) this.spinWheel(e);
    }, { passive: false });

    let drag = null;
    this.actions.addEventListener('pointerdown', e => {
      drag = { x: e.clientX, step: 0 };
      this.spun = false;
    });
    this.actions.addEventListener('pointermove', e => {
      if (!drag) return;
      const STEP = 44;
      const step = Math.trunc((drag.x - e.clientX) / STEP);
      if (step !== drag.step) {
        this.spin(step - drag.step);
        drag.step = step;
        this.spun = true;
      }
    });
    const end = () => { drag = null; setTimeout(() => { this.spun = false; }, 0); };
    this.actions.addEventListener('pointerup', end);
    this.actions.addEventListener('pointercancel', end);
    this.actions.addEventListener('pointerleave', () => { drag = null; });
    window.addEventListener('resize', () => this.select(this.selected, false));
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

  /** A small menu at the pointer: [{ label, run, bad? }]. Any other click closes it. */
  showMenu(x, y, items) {
    document.querySelector('.ctx-menu')?.remove();
    const el = document.createElement('div');
    el.className = 'ctx-menu';
    el.setAttribute('role', 'menu');
    el.innerHTML = items.map((it, i) => `<button type="button" role="menuitem" class="${it.bad ? 'bad' : ''}" data-i="${i}" ${it.disabled ? 'disabled' : ''}>${escapeHtml(it.label)}</button>`).join('');
    document.body.appendChild(el);
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.left = `${Math.min(x, innerWidth - w - 8)}px`;
    el.style.top = `${Math.min(y, innerHeight - h - 8)}px`;
    const close = () => { el.remove(); removeEventListener('pointerdown', away, true); removeEventListener('keydown', esc, true); };
    const away = e => { if (!el.contains(e.target)) close(); };
    const esc = e => { if (e.key === 'Escape') close(); };
    for (const b of el.querySelectorAll('button')) b.addEventListener('click', () => { close(); items[+b.dataset.i].run?.(); });
    setTimeout(() => { addEventListener('pointerdown', away, true); addEventListener('keydown', esc, true); });
    el.querySelector('button:not([disabled])')?.focus();
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

/** What growing in a skill feels like, said once as it happens. */
const LEVEL_LINES = {
  woodworking: 'You have grown more skilled with wood.',
  stoneworking: 'You have grown more skilled with stone.',
  metalworking: 'You have grown more skilled with metal.',
  homesteading: 'You have grown more skilled at keeping a home.',
  mind: 'Your mind has grown clearer.',
};

const hudIcon = name => `<img class="px" src="icons/hud/${name}.svg" alt="">`;
const itemIcon = name => `<img class="px" src="icons/${name}.svg" alt="">`;

/** The day's colour at turn `i` of 12: pale morning blue to gold; the night, dark to moonlight. */
function turnColour(i, n, night) {
  const t = n > 1 ? i / (n - 1) : 0;
  const [a, b] = night ? [[58, 68, 102], [238, 241, 255]] : [[221, 233, 247], [242, 179, 61]];
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * t));
  return `rgb(${c.join(',')})`;
}

/**
 * The clock: the sun (or the moon) with a ring of twelve beads round it, one
 * for each turn of the day (or night), lit as the turns go by.
 */
function dial(dInfo, night, label) {
  const n = night ? NIGHT_TURNS : DAY_TURNS;
  const now = Math.max(1, Math.min(n, dInfo.phaseTurn));
  const beads = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const x = 50 + Math.cos(a) * 42;
    const y = 50 + Math.sin(a) * 42;
    const state = i + 1 < now ? 'past' : i + 1 === now ? 'now' : 'ahead';
    return `<i class="bead ${state}" style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;--c:${turnColour(i, n, night)}"></i>`;
  }).join('');
  return `<div class="dial${night ? ' night' : ''}" title="${label}" role="img" aria-label="${label}">${beads}${hudIcon(night ? 'moon' : 'sun')}</div>`;
}

/** The moon's three days as three beads; the last one red when the raid is coming. */
function moonPips(moon, s) {
  const raid = s.raid?.stage === 'night' || moon.phase === 'raid';
  return `<div class="moon-pips" title="Day ${moon.day} of ${MOON_DAYS} of the moon">${Array.from({ length: MOON_DAYS }, (_, i) => {
    const d = i + 1;
    const last = d === MOON_DAYS;
    const cls = [d < moon.day ? 'past' : d === moon.day ? 'now' : 'ahead', last ? 'last' : '',
      last && moon.phase === 'omens' ? 'omens' : '', last && raid ? 'raid' : ''].filter(Boolean).join(' ');
    return `<i class="${cls}"></i>`;
  }).join('')}</div>`;
}

/** The errand a master sent you on, and how long you have left. */
function errandLine(s) {
  const e = s.jobs?.errand;
  if (!e) return '';
  const left = Math.max(0, e.due - Math.floor(s.turn || 0));
  const ready = !errandShort(s).length;
  return `<div class="omen errand${left <= 6 ? ' late' : ''}">Errand for ${escapeHtml(e.name)}: ${escapeHtml(bringText(e.bring))}${ready ? ' &check;' : ''} &middot; due ${escapeHtml(dueText(s, e.due))}</div>`;
}


/** The rail's buttons, in the game's own pixel art: the pack, the hammer, the cabin. */
const railIcon = src => `<img class="px" src="${src}" alt="">`;
const RAIL_ICONS = {
  eye: railIcon('icons/hud/eye.svg'),
  inventory: railIcon('icons/leather_pack.svg'),
  crafting: railIcon('icons/hammer.svg'),
  build: railIcon('icons/cabin.svg'),
  skills: railIcon('icons/journal.svg'),
  menu: railIcon('icons/hud/cog.svg'),
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
