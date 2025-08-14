// actions.js
import { ITEMS, RECIPES } from './items_recipes.js';
export class Actions {
  constructor(game) { this.game = game; }
  addItem(id, qty=1) {
    const item = ITEMS[id]; if (!item) return;
    let remaining = qty;
    for (let i=0; i<this.game.state.inventory.length && remaining>0; i++) {
      const slot = this.game.state.inventory[i];
      if (slot && slot.id === id) {
        const space = item.stack - slot.qty;
        if (space > 0) { const add = Math.min(space, remaining); slot.qty += add; remaining -= add; }
      }
    }
    for (let i=0; i<this.game.state.inventory.length && remaining>0; i++) {
      if (!this.game.state.inventory[i]) {
        const add = Math.min(item.stack, remaining);
        this.game.state.inventory[i] = { id, qty: add };
        remaining -= add;
      }
    }
  }
  removeItem(id, qty=1) {
    let remaining = qty;
    for (let i=0; i<this.game.state.inventory.length && remaining>0; i++) {
      const slot = this.game.state.inventory[i];
      if (slot && slot.id === id) {
        const take = Math.min(slot.qty, remaining);
        slot.qty -= take; remaining -= take;
        if (slot.qty <= 0) this.game.state.inventory[i] = null;
      }
    }
    return remaining === 0;
  }
  hasItem(id, qty=1) {
    let count = 0;
    this.game.state.inventory.forEach(s => { if (s && s.id === id) count += s.qty; });
    return count >= qty;
  }
  addXP(skillName, xp) {
    const skill = this.game.state.skills[skillName]; if (!skill) return;
    skill.xp += xp;
    const threshold = skill.level * skill.level * 10;
    const cap = 3;
    if (skill.xp >= threshold) {
      if (skill.level < cap) {
        skill.xp -= threshold; skill.level += 1;
        this.game.ui.showNotification(`Your ${skillName} skill increased to level ${skill.level}!`);
      } else {
        skill.xp = threshold;
        this.game.ui.showNotification(`Your ${skillName} skill is capped at level ${skill.level}. Find a mentor/quest to progress.`);
      }
    }
  }
  canCraft(recId) {
    const rec = RECIPES[recId]; if (!rec) return false;
    const skill = this.game.state.skills[rec.skill];
    const hasSkill = skill && skill.level >= rec.level;
    const hasTools = !rec.tools || Object.keys(rec.tools).every(tid => this.hasItem(tid, 1));
    const hasMats = Object.entries(rec.inputs).every(([id, qty]) => this.hasItem(id, qty));
    return hasSkill && hasTools && hasMats;
  }
  handleCraft(recId) {
    const rec = RECIPES[recId]; if (!rec) return;
    if (!this.canCraft(recId)) { this.game.ui.showNotification(`You can't craft this yet.`); return; }
    Object.entries(rec.inputs).forEach(([id, qty]) => this.removeItem(id, qty));
    Object.entries(rec.output).forEach(([id, qty]) => this.addItem(id, qty));
    this.addXP(rec.skill, rec.xp);
    this.game.ui.showNotification(`Crafted ${rec.name}!`);
    if (this.game.ui.activeUIMode === 'craft') this.game.ui.showCrafting();
  }
  handleBuild(recId) {
    const rec = RECIPES[recId];
    if (!rec || rec.category !== 'build') return;
    const skill = this.game.state.skills[rec.skill];
    if (!skill || skill.level < rec.level) { this.game.ui.showNotification(`Need ${rec.skill} lvl ${rec.level}.`); return; }
    if (rec.tools) {
      const missing = Object.entries(rec.tools).find(([tid, qty]) => !this.hasItem(tid, qty));
      if (missing) { this.game.ui.showNotification(`Missing ${ITEMS[missing[0]].name}.`); return; }
    }
    const enough = Object.entries(rec.inputs).every(([id, qty]) => this.hasItem(id, qty));
    if (!enough) { this.game.ui.showNotification('Not enough materials.'); return; }
    Object.entries(rec.inputs).forEach(([id, qty]) => this.removeItem(id, qty));
    this.addXP(rec.skill, rec.xp);
    this.game.buildStructure(recId);
    this.game.ui.showNotification(`Built ${rec.name}!`);
    if (this.game.ui.activeUIMode === 'build') this.game.ui.showBuilding();
  }
  startHarvest(action, q, r, treeMesh) {
    if (action === 'chop' && !this.hasItem('axe', 1)) {
      this.game.ui.showNotification('You need an axe to chop. You can still gather branches.');
      this.game.ui.showHarvest(q, r, treeMesh);
      return;
    }
    this.game.ui.hide();
    this.game.ui.showProgress('Harvesting', 2000, () => this.finishHarvest(action));
  }
  finishHarvest(action) {
    const id = (action === 'chop') ? 'rough_log' : 'branch';
    const qty = (action === 'chop') ? 1 : 2;
    this.addItem(id, qty);
    this.game.ui.showNotification(`You obtained ${qty} x ${ITEMS[id].name}!`);
  }
  startMining(q, r) {
    this.game.ui.hide();
    this.game.ui.showProgress('Mining', 2000, () => this.finishMining());
  }
  finishMining() {
    this.addItem('stone', 3);
    if (Math.random() < 0.2) { this.addItem('ore', 1); this.game.ui.showNotification('You mined 3 Stone and found an Ore!'); }
    else { this.game.ui.showNotification('You mined 3 Stone.'); }
  }
}
