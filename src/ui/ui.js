// ui.js
// The DOM chrome around the canvas: the HUD, the journey tracker, notices and
// banners, panels, dice, and the buttons that float over the hex you stand on.

import { SKILLS, MAX_LEVEL, dayOf, isNight } from '../game/state.js';
import { levelOf, progress, skillIcon } from '../game/skills.js';
import { foodValue, maxEnergy, capacity, usedSlots } from '../game/inventory.js';
import { attackDice, defenseDice, maxHp } from '../game/gear.js';
import { STAGES, currentStage } from '../game/journey.js';
import { chime } from './chime.js';

export class UI {
  constructor(game) {
    this.game = game;
    this.hudStats = document.getElementById('hud-stats');
    this.hudSkills = document.getElementById('hud-skills');
    this.journey = document.getElementById('journey');
    this.worldspace = document.getElementById('worldspace');
    this.notifications = document.getElementById('notifications');
    this.modalRoot = document.getElementById('modal-root');
    this.taskbar = document.getElementById('taskbar');
    this.alert = document.getElementById('alert');

    this.pings = document.getElementById('pings');
    this.pingQueue = [];
    this.pingShowing = false;

    this.anchors = [];        // { el, q, r, dy } or { el, pos:()=>{x,y}, dy }
    this.openPanelName = null;
    this.busy = null;

    this.buildTaskbar();
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

  // ------------------------------------------------------------- chrome

  buildTaskbar() {
    const buttons = [
      ['inventory', 'Pack', 'I'],
      ['crafting', 'Craft', 'C'],
      ['build', 'Build', 'B'],
      ['skills', 'Skills', 'K'],
      ['menu', 'Game', 'Esc'],
    ];
    this.taskbar.innerHTML = '';

    this.eyeButton = document.createElement('button');
    this.eyeButton.className = 'eye';
    this.eyeButton.title = 'What you know of the land (Space)';
    this.eyeButton.setAttribute('aria-label', 'Toggle the explored-land view');
    this.eyeButton.setAttribute('aria-pressed', 'false');
    this.eyeButton.innerHTML = EYE_SVG;
    this.eyeButton.addEventListener('click', () => { this.eyeButton.blur(); this.game.toggleEye(); });
    this.taskbar.appendChild(this.eyeButton);

    for (const [name, label, key] of buttons) {
      const b = document.createElement('button');
      b.innerHTML = `${label}<kbd>${key}</kbd>`;
      b.dataset.panel = name;
      b.addEventListener('click', () => { b.blur(); this.togglePanel(name); });
      this.taskbar.appendChild(b);
    }
  }

  setEye(on) {
    this.eyeButton.classList.toggle('on', on);
    this.eyeButton.setAttribute('aria-pressed', String(on));
  }

  /** Light a taskbar button, so the player notices something new is possible. */
  nudge(panel, on = true) {
    this.taskbar.querySelector(`[data-panel="${panel}"]`)?.classList.toggle('nudge', on);
  }

  // ---------------------------------------------------------------- pings

  /** Announce a moment: a find, an achievement, a goal, a level, a raid. */
  ping(m) {
    this.pingQueue.push(m);
    if (!this.pingShowing) this.nextPing();
  }

  nextPing() {
    const m = this.pingQueue.shift();
    if (!m) { this.pingShowing = false; return; }
    this.pingShowing = true;

    const kicker = m.kicker || {
      scenic: `${m.tierName} find`, achievement: 'Achievement', village: 'Arrived',
      trade: 'Trusted', goal: 'Goal complete', stage: 'New chapter', level: 'Level up',
      raid: 'Raid', victory: 'Victory',
    }[m.kind] || '';
    const tierClass = m.kind === 'scenic' ? `tier-${m.tier}` : `kind-${m.kind}`;
    const el = document.createElement('div');
    el.className = `ping ${tierClass}`;
    el.innerHTML = `<div class="ping-kicker">${escapeHtml(kicker)}</div>
      <div class="ping-title">${escapeHtml(m.title)}</div>
      ${m.sub ? `<div class="ping-xp">${escapeHtml(m.sub)}</div>` : m.xp ? `<div class="ping-xp">+${m.xp} Mind</div>` : ''}`;
    this.pings.appendChild(el);

    chime(m.kind === 'scenic' ? ['tick', 'copper', 'silver', 'gold'][m.tier]
      : m.kind === 'raid' ? 'raid'
        : m.kind === 'achievement' || m.kind === 'goal' || m.kind === 'level' ? 'achievement'
          : m.kind === 'stage' || m.kind === 'victory' ? 'gold' : 'village');

    const hold = this.pingQueue.length ? 1500 : (m.kind === 'stage' ? 3400 : 2600);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => { el.remove(); this.nextPing(); }, 260);
    }, hold);
  }

  /** A persistent red line under the HUD while a raid is coming or on. */
  setAlert(text) {
    if (!this.alert) return;
    this.alert.textContent = text || '';
    this.alert.classList.toggle('on', !!text);
  }

  updateHud() {
    const s = this.game.state;
    const hpMax = maxHp(s);
    const eMax = maxEnergy(s);
    const { day, frac } = dayOf(s);
    const night = isNight(s);
    const pct = (v, m) => Math.max(0, Math.min(100, Math.round((v / m) * 100)));
    const food = foodValue(s);

    this.hudStats.innerHTML = `
      <div class="bar-row" title="Health"><span class="glyph hp">&#9829;</span>
        <div class="meter hp"><i style="width:${pct(s.hp, hpMax)}%"></i></div><b>${Math.max(0, s.hp)}</b><span class="dim">/${hpMax}</span></div>
      <div class="bar-row" title="Energy — food you carry tops it up as you work"><span class="glyph en">&#9889;</span>
        <div class="meter en"><i style="width:${pct(s.energy, eMax)}%"></i></div><b>${Math.floor(s.energy)}</b><span class="dim">/${eMax}${food ? ` +${food} food` : ' no food'}</span></div>
      <div class="hud-line"><span><b>${s.gold}</b> gold</span>
        <span class="dim">&#9876; ${attackDice(s)} &middot; &#128737; ${defenseDice(s)}</span>
        <span class="dim">${usedSlots(s)}/${capacity(s)} slots</span></div>
      <div class="hud-line day ${night ? 'night' : ''}"><span>${night ? '&#9790;' : '&#9728;'} Day <b>${day}</b></span>
        <div class="meter day"><i style="width:${Math.round(frac * 100)}%"></i></div></div>
      ${s.free ? '<span class="free-badge">FREE RESOURCES</span>' : ''}`;

    this.hudSkills.innerHTML = SKILLS.map(skill => {
      const level = levelOf(s, skill);
      const p = Math.round(progress(s, skill) * 100);
      return `<div class="skill" title="${skill} ${level}/${MAX_LEVEL} — ${p}% to next">
        <img src="${skillIcon(skill)}" alt=""><span class="dim">${skill.slice(0, 5)}</span>
        <b>${level}</b><div class="meter xp"><i style="width:${level >= MAX_LEVEL ? 100 : p}%"></i></div>
      </div>`;
    }).join('');

    this.updateJourney();
  }

  updateJourney() {
    if (!this.journey) return;
    const s = this.game.state;
    const { stage, index } = currentStage(s);
    let firstOpen = true;
    const goals = stage.goals.map(g => {
      const done = !!s.goals?.[g.id];
      const showHint = !done && firstOpen;
      if (!done) firstOpen = false;
      return `<li class="${done ? 'done' : ''}"><span class="box">${done ? '&#10003;' : ''}</span>
        <div><span>${escapeHtml(g.text)}</span>${showHint ? `<small>${escapeHtml(g.hint)}</small>` : ''}</div></li>`;
    }).join('');
    this.journey.innerHTML = `<div class="stage-kicker">Chapter ${index + 1} of ${STAGES.length}</div>
      <div class="stage-name">${escapeHtml(stage.name)}</div><ul>${goals}</ul>`;
  }

  notify(message, ms = 2600, cls = '') {
    const el = document.createElement('div');
    el.className = `notification ${cls}`;
    el.textContent = message;
    this.notifications.appendChild(el);
    while (this.notifications.children.length > 5) this.notifications.firstChild.remove();
    setTimeout(() => el.remove(), ms);
  }

  /** A timed action with a bar over the player. Resolves when it is done. */
  showProgress(label, ms, at) {
    if (this.busy) return Promise.resolve(false);
    const el = document.createElement('div');
    el.className = 'progress';
    el.innerHTML = `<span>${label}</span><div class="bar"><i></i></div>`;
    this.worldspace.appendChild(el);
    const anchor = { el, q: at.q, r: at.r, dy: -36 };
    this.anchors.push(anchor);
    this.busy = anchor;

    requestAnimationFrame(() => { el.querySelector('i').style.width = '100%'; });
    el.querySelector('i').style.transition = `width ${ms}ms linear`;

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
      <span class="vs">vs</span>${roll.defense.map(v => face(v, 'def', v >= 5)).join('') || '<span class="dim">-</span>'}
      <b class="dmg ${roll.damage ? '' : 'miss'}">${roll.damage ? `-${roll.damage}` : 'miss'}</b>`;
    this.worldspace.appendChild(el);
    const anchor = { el, pos, dy: -44, born: performance.now() };
    this.anchors.push(anchor);
    setTimeout(() => { el.classList.add('out'); }, 900);
    setTimeout(() => { el.remove(); this.anchors = this.anchors.filter(a => a !== anchor); }, 1200);
  }

  /** A word or number floating up off something: "+2 log", "-3". */
  floatText(pos, text, cls = '') {
    const el = document.createElement('div');
    el.className = `float ${cls}`;
    el.textContent = text;
    this.worldspace.appendChild(el);
    const anchor = { el, pos, dy: -30 };
    this.anchors.push(anchor);
    setTimeout(() => { el.remove(); this.anchors = this.anchors.filter(a => a !== anchor); }, 1300);
  }

  // ------------------------------------------------------- context buttons

  setContext(offers, at, onPick) {
    for (const a of this.anchors.filter(a => a.context)) a.el.remove();
    this.anchors = this.anchors.filter(a => !a.context);
    if (this.busy || this.openPanelName) return;

    offers.slice(0, 6).forEach((offer, i) => {
      const b = document.createElement('button');
      b.className = `context-button${offer.important ? ' important' : ''}`;
      b.innerHTML = `${i < 9 ? `<kbd>${i + 1}</kbd>` : ''}${escapeHtml(offer.label)}`;
      b.addEventListener('click', e => { e.stopPropagation(); onPick(offer); });
      this.worldspace.appendChild(b);
      this.anchors.push({ el: b, q: at.q, r: at.r, dy: -40 - i * 24, context: true, offer });
    });
    this.contextPick = onPick;
  }

  /** Number keys pick the floating buttons. */
  pickContext(n) {
    const a = this.anchors.filter(x => x.context)[n];
    if (a && this.contextPick) this.contextPick(a.offer);
  }

  clearContext() {
    for (const a of this.anchors.filter(a => a.context)) a.el.remove();
    this.anchors = this.anchors.filter(a => !a.context);
  }

  positionAnchors(camera, map, dpr) {
    for (const a of this.anchors) {
      let wx, wy;
      if (a.pos) { const p = a.pos(); wx = p.x; wy = p.y; }
      else {
        const h = Math.max(0, map.heightAt(a.q, a.r));
        const c = this.game.tileCenter(a.q, a.r, h);
        wx = c.cx; wy = c.cy;
      }
      const p = camera.worldToScreen(wx, wy);
      const rise = a.born ? Math.min(14, (performance.now() - a.born) / 60) : 0;
      a.el.style.left = `${p.x / dpr}px`;
      a.el.style.top = `${p.y / dpr + (a.dy || 0) - rise}px`;
    }
  }

  // -------------------------------------------------------------- panels

  togglePanel(name) {
    if (this.openPanelName === name) this.closePanel();
    else this.openPanel(name);
  }

  openPanel(name, props = {}) {
    if (this.sticky) return;
    this.closePanel();
    const panel = this.game.panels[name];
    if (!panel) return;
    this.openPanelName = name;
    this.clearContext();
    this.nudge(name, false);

    const modal = document.createElement('div');
    modal.className = `modal ${panel.wide ? 'wide' : ''}`;
    modal.innerHTML = `<header><h2>${panel.title(props, this.game)}</h2>
      ${props.sticky ? '' : '<button class="close" aria-label="Close">&times;</button>'}</header>
      <div class="modal-body"></div>`;
    modal.querySelector('.close')?.addEventListener('click', () => this.closePanel());
    this.modalRoot.appendChild(modal);
    this.sticky = !!props.sticky;

    this.currentPanel = { name, panel, props, body: modal.querySelector('.modal-body') };
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
  }
}

const EYE_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
  <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.8"/>
  <circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>`;

export const icon = (item, size = 24) =>
  `<img class="icon" src="${item?.icon || 'icons/stone.svg'}" alt="" width="${size}" height="${size}">`;

export const escapeHtml = s => String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const skillDots = (state, skill) => {
  const level = levelOf(state, skill);
  return Array.from({ length: MAX_LEVEL }, (_, i) =>
    `<i class="pip${i < level ? ' on' : ''}"></i>`).join('');
};
