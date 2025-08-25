// modules/actions.js
import { ITEMS, RECIPES, ITEM_BASE_PRICES } from './items_recipes_skills.js';

export class Actions {
    constructor(game) {
        this.game = game;
    }

    addItem(id, qty = 1) {
        const item = ITEMS[id];
        if (!item) return;
        let remaining = qty;
        for (let i = 0; i < this.game.state.inventory.length && remaining > 0; i++) {
            const slot = this.game.state.inventory[i];
            if (slot && slot.id === id) {
                const space = item.stack - slot.qty;
                if (space > 0) {
                    const add = Math.min(space, remaining);
                    slot.qty += add;
                    remaining -= add;
                }
            }
        }
        for (let i = 0; i < this.game.state.inventory.length && remaining > 0; i++) {
            if (!this.game.state.inventory[i]) {
                const add = Math.min(item.stack, remaining);
                this.game.state.inventory[i] = { id, qty: add };
                remaining -= add;
            }
        }
    }

    removeItem(id, qty = 1) {
        let remaining = qty;
        for (let i = 0; i < this.game.state.inventory.length && remaining > 0; i++) {
            const slot = this.game.state.inventory[i];
            if (slot && slot.id === id) {
                const take = Math.min(slot.qty, remaining);
                slot.qty -= take;
                remaining -= take;
                if (slot.qty <= 0) this.game.state.inventory[i] = null;
            }
        }
        return remaining === 0;
    }

    hasItem(id, qty = 1) {
        let count = 0;
        this.game.state.inventory.forEach(s => {
            if (s && s.id === id) count += s.qty;
        });
        return count >= qty;
    }

    addXP(skillName, xp) {
        const skill = this.game.state.skills[skillName];
        if (!skill) return;
        skill.xp += xp;
        const threshold = skill.level * skill.level * 10;
        if (skill.xp >= threshold) {
            skill.xp -= threshold;
            skill.level += 1;
            this.game.ui.showNotification(`Your ${skillName} skill increased to level ${skill.level}!`);
        }
    }

    canCraft(recId, playerCity = null) {
        const rec = RECIPES[recId];
        if (!rec) return { canCraft: false };

        const skill = this.game.state.skills[rec.skill];
        const hasSkill = skill && skill.level >= rec.level;
        const hasMats = Object.entries(rec.inputs).every(([id, qty]) => this.hasItem(id, qty));
        
        let hasTools = true;
        let rentalTool = null;
        const infrastructure = ['oven', 'forge', 'whetstone'];

        if (rec.tools) {
            for (const toolId of Object.keys(rec.tools)) {
                if (!this.hasItem(toolId)) {
                    // Tool not in inventory, check for rental
                    if (playerCity && playerCity.data.rentableTools.includes(toolId)) {
                        const rentalFee = infrastructure.includes(toolId) ? 0 : Math.max(5, Math.floor(ITEM_BASE_PRICES[toolId] * 0.2));
                        if (this.game.state.gold >= rentalFee) {
                            rentalTool = { id: toolId, fee: rentalFee };
                        } else {
                            hasTools = false; // Can't afford rental
                            break;
                        }
                    } else {
                        hasTools = false; // Tool not in inventory and not for rent
                        break;
                    }
                }
            }
        }
        
        return {
            canCraft: hasSkill && hasMats && hasTools,
            rentalTool: rentalTool
        };
    }

    handleCraft(recId) {
        const playerCity = this.game.getPlayerCurrentCity();
        const { canCraft, rentalTool } = this.canCraft(recId, playerCity);

        if (!canCraft) {
            this.game.ui.showNotification("You can't craft this yet.");
            return;
        }

        if (rentalTool) {
            if (rentalTool.fee > 0) {
                this.game.state.gold -= rentalTool.fee;
                this.game.ui.showNotification(`Paid ${rentalTool.fee}g to rent the ${ITEMS[rentalTool.id].name}.`);
            } else {
                 this.game.ui.showNotification(`Used the village ${ITEMS[rentalTool.id].name}.`);
            }
        }

        const rec = RECIPES[recId];
        Object.entries(rec.inputs).forEach(([id, qty]) => this.removeItem(id, qty));
        Object.entries(rec.output).forEach(([id, qty]) => this.addItem(id, qty));
        this.addXP(rec.skill, rec.xp);
        this.game.ui.showNotification(`Crafted ${rec.name}!`);

        if (this.game.ui.activeUIMode === 'craft') this.game.ui.showCrafting();
    }

    handleBuild(recId) {
        const rec = RECIPES[recId];
        if (!rec || rec.category !== 'build') return;

        const infrastructure = ['oven', 'forge', 'whetstone'];
        if (infrastructure.includes(recId)) {
            const q = this.game.player.q;
            const r = this.game.player.r;
            const feature = this.game.world.featureMap[r]?.[q];
            const structure = this.game.world.getStructure(q, r);

            const isVillage = feature?.type === 'city';
            const isHomestead = structure?.type === 'building' && (structure.recId === 'cabin' || structure.recId === 'stone_house');

            if (!isVillage && !isHomestead) {
                this.game.ui.showNotification(`A ${rec.name} must be built in a village or at your home.`);
                return;
            }
        }

        if (['cabin', 'wood_fence', 'stone_wall', ...infrastructure].includes(recId)) {
            const playerCity = this.game.getPlayerCurrentCity();
            if (!this.canCraft(recId, playerCity).canCraft) {
                this.game.ui.showNotification("Cannot build this.");
                return;
            }
            Object.entries(rec.inputs).forEach(([id, qty]) => this.removeItem(id, qty));
            this.addXP(rec.skill, rec.xp);
            this.game.buildStructure(recId, { at: { q: this.game.player.q, r: this.game.player.r } });
            this.game.ui.showNotification(`Built ${rec.name}!`);
        } else {
            this.game.enterPlacementMode(recId);
        }
    }

    handleBuy(cityKey, itemId) {
        const cityData = this.game.state.cities[cityKey];
        if (!cityData) return;
        const price = cityData.prices[itemId];
        if (price == null) return;
        if (this.game.state.gold < price) {
            this.game.ui.showNotification('Not enough gold.');
            return;
        }
        this.game.state.gold -= price;
        this.addItem(itemId, 1);
        this.game.ui.showTrade(cityKey);
        if (this.game.ui.activeUIMode === 'inventory') this.game.ui.showInventory();
    }

    handleSell(cityKey, itemId) {
        const cityData = this.game.state.cities[cityKey];
        if (!cityData) return;
        const fullPrice = cityData.prices[itemId];
        if (fullPrice == null) return;
        if (!this.hasItem(itemId, 1)) {
            this.game.ui.showNotification('You do not have any to sell.');
            return;
        }
        const price = Math.max(1, Math.floor(fullPrice / 2));
        this.removeItem(itemId, 1);
        this.game.state.gold += price;
        this.game.ui.showTrade(cityKey);
        if (this.game.ui.activeUIMode === 'inventory') this.game.ui.showInventory();
    }

    startHarvest(action, q, r, treeMesh) {
        if (action === 'chop' && !this.hasItem('axe', 1)) {
            this.game.ui.showNotification('You need an axe to chop down a tree.');
            return;
        }
        this.game.ui.hideAllWorldspaceUIs();
        this.game.ui.showProgress('Harvesting', 2000, () => this.finishHarvest(action, q, r, treeMesh));
    }

    finishHarvest(action, q, r, treeMesh) {
        if (action === 'chop') {
            const feat = this.game.world.featureMap[r]?.[q];
            if (feat && feat.trees > 0) {
                feat.trees--;
                if (treeMesh && treeMesh.parent) {
                    treeMesh.parent.remove(treeMesh);
                }
                if (feat.trees === 0) {
                    feat.type = 'none';
                }
                this.addItem('rough_log', 1);
                this.game.ui.showNotification(`You obtained 1 x ${ITEMS['rough_log'].name}!`);
            }
        } else {
            this.addItem('branch', 2);
            this.game.ui.showNotification(`You obtained 2 x ${ITEMS['branch'].name}!`);
        }
    }

    startMining(q, r, tool) {
        const actionLabel = tool === 'pickaxe' ? 'Mining' : 'Quarrying';
        this.game.ui.hideAllWorldspaceUIs();
        this.game.ui.showProgress(actionLabel, 3000, () => this.finishMining(q, r, tool));
    }

    finishMining(q, r, tool) {
        if (tool === 'pickaxe') {
            this.addItem('stone', 2);
            this.addXP('metalworking', 2);
            if (Math.random() < 0.3) {
                this.addItem('ore', 1);
                this.game.ui.showNotification('You mined 2 Stone and found an Ore!');
            } else {
                this.game.ui.showNotification('You mined 2 Stone.');
            }
        } else {
            this.addItem('stone', 1);
            this.addXP('stoneworking', 1);
            this.game.ui.showNotification('You quarried 1 Stone.');
        }
    }
}
