// economy.js
import { ITEM_BASE_PRICES } from './items_recipes_skills.js';
const UNTRADEABLE = new Set(['cabin', 'stone_wall', 'wood_fence']);
export class Economy {
  constructor(game) { this.game = game; }
  ensureCityPrices(cityKey) {
    if (this.game.state.prices[cityKey]) return;
    const all = Object.keys(ITEM_BASE_PRICES).filter(id => !UNTRADEABLE.has(id));
    const count = 5 + Math.floor(Math.random() * 3);
    const chosen = all.slice().sort(() => Math.random() - 0.5).slice(0, count);
    const prices = {};
    chosen.forEach(id => {
      const base = ITEM_BASE_PRICES[id];
      const factor = 0.8 + Math.random() * 0.4;
      prices[id] = Math.max(1, Math.round(base * factor));
    });
    this.game.state.prices[cityKey] = prices;
  }
  buy(cityKey, itemId) {
    const list = this.game.state.prices[cityKey]; if (!list) return;
    const price = list[itemId]; if (price == null) return;
    if (this.game.state.gold < price) { this.game.ui.showNotification('Not enough gold.'); return; }
    this.game.state.gold -= price;
    this.game.actions.addItem(itemId, 1);
    this.game.ui.showTrade(cityKey, this.game.state.prices[cityKey]);
    if (this.game.ui.activeUIMode === 'inventory') this.game.ui.showInventory();
  }
  sell(cityKey, itemId) {
    const list = this.game.state.prices[cityKey]; if (!list) return;
    const full = list[itemId]; if (full == null) return;
    if (!this.game.actions.hasItem(itemId, 1)) { this.game.ui.showNotification('You do not have any to sell.'); return; }
    const price = Math.max(1, Math.floor(full / 2));
    this.game.actions.removeItem(itemId, 1);
    this.game.state.gold += price;
    this.game.ui.showTrade(cityKey, this.game.state.prices[cityKey]);
    if (this.game.ui.activeUIMode === 'inventory') this.game.ui.showInventory();
  }
}
