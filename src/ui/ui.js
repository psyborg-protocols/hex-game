// ui.js
// The DOM chrome around the canvas: status, notifications, panels, and the
// world-anchored context buttons.
//
// The buttons floating over the hex you are standing on are carried over from
// the old game deliberately — they were the best thing about its interface. The
// game never opens a menu of every verb; it offers the two or three this hex
// actually affords, where the hex is.

import { SKILLS, MAX_LEVEL } from '../game/state.js';
import { levelOf, progress, skillIcon } from '../game/skills.js';
import { chime } from './chime.js';

export class UI {
  constructor(game) {
    this.game = game;
    this.hudStats = document.getElementById('hud-stats');
    this.hudSkills = document.getElementById('hud-skills');
    this.worldspace = document.getElementById('worldspace');
    this.notifications = document.getElementById('notifications');
    this.modalRoot = document.getElementById('modal-root');
    this.taskbar = document.getElementById('taskbar');

    this.pings = document.getElementById('pings');
    this.pingQueue = [];
    this.pingShowing = false;

    this.anchors = [];        // { el, q, r } — repositioned every frame
    this.openPanelName = null;
    this.busy = null;         // an action in progress

    this.buildTaskbar();
    this.modalRoot.addEventListener('pointerdown', e => {
      if (e.target === this.modalRoot) this.closePanel();
    });
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.openPanelName) this.closePanel();
    });
  }

  // ------------------------------------------------------------- chrome

  buildTaskbar() {
    const buttons = [
      ['inventory', 'Pack'],
      ['crafting', 'Craft'],
      ['build', 'Build'],
      ['skills', 'Skills'],
      ['menu', 'Game'],
    ];
    this.taskbar.innerHTML = '';

    // The eye: dims the map down to what you have explored and what is on it.
    this.eyeButton = document.createElement('button');
    this.eyeButton.className = 'eye';
    this.eyeButton.title = 'What you know of the land (Space)';
    this.eyeButton.setAttribute('aria-label', 'Toggle the explored-land view');
    this.eyeButton.setAttribute('aria-pressed', 'false');
    this.eyeButton.innerHTML = EYE_SVG;
    this.eyeButton.addEventListener('click', () => {
      this.eyeButton.blur();     // so Space does not click it again
      this.game.toggleEye();
    });
    this.taskbar.appendChild(this.eyeButton);

    for (const [name, label] of buttons) {
      const b = document.createElement('button');
      b.textContent = label;
      b.addEventListener('click', () => { b.blur(); this.togglePanel(name); });
      this.taskbar.appendChild(b);
    }
  }

  setEye(on) {
    this.eyeButton.classList.toggle('on', on);
    this.eyeButton.setAttribute('aria-pressed', String(on));
  }

  // ---------------------------------------------------------------- pings

  /**
   * Announce a moment: a scenic find, an achievement, a first arrival. Shown
   * one at a time as a banner in the tier's colour, with a chime.
   * @param {{kind, title, xp, tier?, tierName?}} m
   */
  ping(m) {
    this.pingQueue.push(m);
    if (!this.pingShowing) this.nextPing();
  }

  nextPing() {
    const m = this.pingQueue.shift();
    if (!m) { this.pingShowing = false; return; }
    this.pingShowing = true;

    const kicker = {
      scenic: `${m.tierName} find`,
      achievement: 'Achievement',
      village: 'Arrived',
      trade: 'Trade',
    }[m.kind] || '';
    const tierClass = m.kind === 'scenic' ? `tier-${m.tier}` : `kind-${m.kind}`;
    const el = document.createElement('div');
    el.className = `ping ${tierClass}`;
    el.innerHTML = `<div class="ping-kicker">${escapeHtml(kicker)}</div>
      <div class="ping-title">${escapeHtml(m.title)}</div>
      ${m.xp ? `<div class="ping-xp">+${m.xp} Mind</div>` : ''}`;
    this.pings.appendChild(el);

    chime(m.kind === 'scenic' ? ['tick', 'copper', 'silver', 'gold'][m.tier]
      : m.kind === 'achievement' ? 'achievement' : 'village');

    // Hurry through a backlog rather than making the last one wait.
    const hold = this.pingQueue.length ? 1500 : 2600;
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => { el.remove(); this.nextPing(); }, 260);
    }, hold);
  }

  updateHud() {
    const s = this.game.state;
    this.hudStats.innerHTML = [
      `<b>${s.gold}</b> gold`,
      `<b>${s.energy}</b> / ${s.maxEnergy} energy`,
      `<span class="dim">${s.inventory.filter(Boolean).length} / ${s.inventory.length} slots</span>`,
      // Say so loudly. Nothing is more confusing than wondering why a recipe you
      // have no materials for is green.
      ...(s.free ? ['<span class="free-badge">FREE RESOURCES</span>'] : []),
    ].join('<br>');

    this.hudSkills.innerHTML = SKILLS.map(skill => {
      const level = levelOf(s, skill);
      const pct = Math.round(progress(s, skill) * 100);
      return `<div class="skill" title="${skill} — ${pct}% to next">
        <img src="${skillIcon(skill)}" alt="">
        <span class="dim">${skill.slice(0, 5)}</span>
        <b>${level}</b>
      </div>`;
    }).join('');
  }

  notify(message, ms = 2600) {
    const el = document.createElement('div');
    el.className = 'notification';
    el.textContent = message;
    this.notifications.appendChild(el);
    setTimeout(() => el.remove(), ms);
  }

  /**
   * A timed action with a bar, anchored to the player. Returns a promise so
   * callers can await the work rather than thread callbacks through.
   */
  showProgress(label, ms, at) {
    if (this.busy) return Promise.resolve(false);
    const el = document.createElement('div');
    el.className = 'progress';
    el.innerHTML = `<span>${label}</span><div class="bar"><i></i></div>`;
    this.worldspace.appendChild(el);
    const anchor = { el, q: at.q, r: at.r, dy: -30 };
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

  // ------------------------------------------------------- context buttons

  /** Replace the floating buttons with the ones this context offers. */
  setContext(offers, at, onPick) {
    for (const a of this.anchors.filter(a => a.context)) a.el.remove();
    this.anchors = this.anchors.filter(a => !a.context);
    if (this.busy || this.openPanelName) return;

    offers.forEach((offer, i) => {
      const b = document.createElement('button');
      b.className = 'context-button';
      b.textContent = offer.label;
      b.addEventListener('click', e => { e.stopPropagation(); onPick(offer); });
      this.worldspace.appendChild(b);
      this.anchors.push({ el: b, q: at.q, r: at.r, dy: -34 - i * 22, context: true });
    });
  }

  clearContext() {
    for (const a of this.anchors.filter(a => a.context)) a.el.remove();
    this.anchors = this.anchors.filter(a => !a.context);
  }

  /** Keep anchored elements over their hex. Called every frame. */
  positionAnchors(camera, map, dpr) {
    for (const a of this.anchors) {
      const h = Math.max(0, map.heightAt(a.q, a.r));
      const { cx, cy } = this.game.tileCenter(a.q, a.r, h);
      const p = camera.worldToScreen(cx, cy);
      a.el.style.left = `${p.x / dpr}px`;
      a.el.style.top = `${p.y / dpr + (a.dy || 0)}px`;
    }
  }

  // -------------------------------------------------------------- panels

  togglePanel(name) {
    if (this.openPanelName === name) this.closePanel();
    else this.openPanel(name);
  }

  openPanel(name, props = {}) {
    this.closePanel();
    const panel = this.game.panels[name];
    if (!panel) return;
    this.openPanelName = name;
    this.clearContext();

    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `<header><h2>${panel.title(props)}</h2>
      <button class="close" aria-label="Close">&times;</button></header>
      <div class="modal-body"></div>`;
    modal.querySelector('.close').addEventListener('click', () => this.closePanel());
    this.modalRoot.appendChild(modal);

    this.currentPanel = { name, panel, props, body: modal.querySelector('.modal-body') };
    this.refreshPanel();
  }

  /** Re-render the open panel in place — after a craft, a trade, a level. */
  refreshPanel() {
    if (!this.currentPanel) return;
    const { panel, props, body } = this.currentPanel;
    body.innerHTML = panel.render(this.game, props);
    panel.bind?.(this.game, body, props);
    this.updateHud();
  }

  closePanel() {
    this.modalRoot.innerHTML = '';
    this.openPanelName = null;
    this.currentPanel = null;
  }
}

const EYE_SVG = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
  <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z" fill="none" stroke="currentColor" stroke-width="1.8"/>
  <circle cx="12" cy="12" r="3.2" fill="currentColor"/></svg>`;

/** Small helpers the panels share. */
export const icon = (item, size = 24) =>
  `<img class="icon" src="${item.icon}" alt="" width="${size}" height="${size}">`;

export const escapeHtml = s => String(s).replace(/[&<>"']/g,
  c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const skillDots = (state, skill) => {
  const level = levelOf(state, skill);
  return Array.from({ length: MAX_LEVEL }, (_, i) =>
    `<i class="pip${i < level ? ' on' : ''}"></i>`).join('');
};
