import { ITEMS, RECIPES, SKILL_INFO } from './items_recipes_skills.js';

// A mapping of UI modes to their icons for consistent headers
const UI_ICONS = {
    inventory: ITEMS['chest'].icon,
    craft: ITEMS['saw'].icon,
    build: ITEMS['cabin'].icon,
    trade: ITEMS['brick'].icon,
    harvest: ITEMS['axe'].icon,
    mine: ITEMS['pickaxe'].icon,
    skills: ITEMS['ingot'].icon,
};

/**
 * Manages all DOM interactions, including UI panels, notifications, and progress bars.
 */
export class UIController {
    /**
     * @param {Game} game A reference to the main game instance.
     */
    constructor(game) {
        this.game = game; // Reference to the main game object to access state and methods
        this.uiEl = document.getElementById('ui');
        this.activeUIMode = null;
    }

    // --- Core UI Management ---

    show(mode, html) {
        this.activeUIMode = mode;
        this.uiEl.innerHTML = html;
        this.uiEl.style.display = 'block';
    }

    hide() {
        this.activeUIMode = null;
        this.uiEl.style.display = 'none';
        this.uiEl.innerHTML = '';
    }

    toggle(mode, displayFunction) {
        if (this.activeUIMode === mode) {
            this.hide();
        } else {
            displayFunction();
        }
    }

    // --- General Purpose UI Components ---

    showNotification(message, duration = 3000) {
        const notification = document.createElement('div');
        // Simple styling; could be moved to a CSS class
        Object.assign(notification.style, {
            position: 'absolute', bottom: '80px', left: '50%',
            transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.8)',
            color: 'white', padding: '10px 20px', borderRadius: '8px',
            zIndex: '10', fontFamily: 'monospace', textAlign: 'center',
            pointerEvents: 'none'
        });
        notification.innerHTML = message;
        document.body.appendChild(notification);
        setTimeout(() => {
            if (document.body.contains(notification)) {
                 document.body.removeChild(notification);
            }
        }, duration);
    }

    showProgress(label, duration, onComplete) {
        this.hide(); // Hide main UI during progress
        const progressContainer = document.createElement('div');
        Object.assign(progressContainer.style, {
            position: 'absolute', bottom: '10px', left: '10px',
            padding: '8px 12px', background: 'rgba(0,0,0,0.7)',
            color: 'white', borderRadius: '6px', fontSize: '14px', zIndex: '4',
            fontFamily: 'monospace'
        });
        document.body.appendChild(progressContainer);

        const start = performance.now();
        const update = () => {
            const elapsed = performance.now() - start;
            const pct = Math.min(elapsed / duration, 1);
            progressContainer.innerHTML = `${label}... ${Math.round(pct * 100)}%`;
            if (pct < 1) {
                requestAnimationFrame(update);
            } else {
                document.body.removeChild(progressContainer);
                onComplete();
            }
        };
        requestAnimationFrame(update);
    }

    // --- Specific UI Panels ---

    showInventory() {
        const headerIcon = UI_ICONS.inventory ? `<img src="${UI_ICONS.inventory}" class="icon"/>` : '';
        let html = `${headerIcon}<b>Inventory</b> (Gold: ${Math.floor(this.game.state.gold)})<br/>`;
        this.game.state.inventory.forEach((slot, idx) => {
            if (slot) {
                const item = ITEMS[slot.id];
                const icon = item.icon ? `<img src="${item.icon}" class="icon"/>` : '';
                html += `${idx + 1}: ${icon}${item.name} x${slot.qty}<br/>`;
            } else {
                html += `${idx + 1}: (empty)<br/>`;
            }
        });
        html += `<br/>Press I to close.`;
        this.show('inventory', html);
    }

    showCrafting() {
        const headerIcon = UI_ICONS.craft ? `<img src="${UI_ICONS.craft}" class="icon"/>` : '';
        let html = `${headerIcon}<b>Crafting</b><br/>`;
        Object.values(RECIPES).forEach((rec) => {
            if (rec.category === 'build') return;
            html += this.getRecipeHTML(rec, 'craft');
        });
        html += `<br/><button id="close-btn">Close</button>`;
        this.show('craft', html);
        this.addRecipeListeners('craft');
    }
    
    showBuilding() {
        const headerIcon = UI_ICONS.build ? `<img src="${UI_ICONS.build}" class="icon"/>` : '';
        let html = `${headerIcon}<b>Building</b><br/>`;
        Object.values(RECIPES).forEach((rec) => {
            if (rec.category !== 'build') return;
            html += this.getRecipeHTML(rec, 'build');
        });
        html += `<br/><button id="close-btn">Close</button>`;
        this.show('build', html);
        this.addRecipeListeners('build');
    }

    showSkills() {
        const headerIcon = UI_ICONS.skills ? `<img src="${UI_ICONS.skills}" class="icon"/>` : '';
        let html = `${headerIcon}<b>Skills Overview</b><br/>`;
        Object.keys(this.game.state.skills).forEach((skillName) => {
            const skillState = this.game.state.skills[skillName];
            html += `<br/><u>${skillName.charAt(0).toUpperCase() + skillName.slice(1)}</u> (Level ${skillState.level}, XP: ${skillState.xp.toFixed(0)})<br/>`;
            const info = SKILL_INFO[skillName] || {};
            for (let lvl = 1; lvl <= Math.min(skillState.level + 1, 4); lvl++) {
                const entries = info[lvl] || [];
                if (entries.length > 0) {
                    html += `Level ${lvl}:<br/>`;
                    entries.forEach((line) => html += `&nbsp;&nbsp;- ${line}<br/>`);
                }
            }
        });
        html += `<br/><button id="close-btn">Close</button>`;
        this.show('skills', html);
        this.addCloseListener();
    }

    showTrade(cityKey, prices) {
        const headerIcon = UI_ICONS.trade ? `<img src="${UI_ICONS.trade}" class="icon"/>` : '';
        let html = `${headerIcon}<b>Village Market</b><br/>Gold: ${Math.floor(this.game.state.gold)}<br/><br/>`;
        Object.entries(prices).forEach(([id, price]) => {
            const item = ITEMS[id];
            const icon = item.icon ? `<img src="${item.icon}" class="icon"/>` : '';
            html += `${icon}${item.name} — ${price} gold`;
            html += ` <button data-action="buy" data-id="${id}">Buy</button>`;
            html += ` <button data-action="sell" data-id="${id}">Sell</button><br/>`;
        });
        html += `<br/><b>Your Inventory</b><br/>`;
        this.game.state.inventory.forEach((slot) => {
            if (slot) {
                const invItem = ITEMS[slot.id];
                const invIcon = invItem.icon ? `<img src="${invItem.icon}" class="icon"/>` : '';
                html += `${invIcon}${invItem.name} x${slot.qty}<br/>`;
            }
        });
        html += `<br/><button id="close-btn">Close</button>`;
        this.show('trade', html);
        this.addTradeListeners(cityKey);
    }
    
    showHarvest(q, r, treeMesh) {
        const headerIcon = UI_ICONS.harvest ? `<img src="${UI_ICONS.harvest}" class="icon"/>` : '';
        let html = `${headerIcon}<b>Harvest Tree</b><br/>Choose an action:<br/>`;
        const chopIcon = ITEMS['rough_log'].icon ? `<img src="${ITEMS['rough_log'].icon}" class="icon"/>` : '';
        html += `<button data-action="chop">Chop Tree (${chopIcon}${ITEMS['rough_log'].name} x1)</button> `;
        const branchIcon = ITEMS['branch'].icon ? `<img src="${ITEMS['branch'].icon}" class="icon"/>` : '';
        html += `<button data-action="branch">Gather Branches (${branchIcon}${ITEMS['branch'].name} x2)</button><br/>`;
        html += `<br/><button id="close-btn">Cancel</button>`;
        this.show('harvest', html);
        
        this.uiEl.querySelectorAll('button[data-action]').forEach(btn => {
            btn.onclick = () => this.game.startHarvest(btn.dataset.action, q, r, treeMesh);
        });
        this.addCloseListener();
    }
    
    showMining(q, r) {
        const headerIcon = UI_ICONS.mine ? `<img src="${UI_ICONS.mine}" class="icon"/>` : '';
        let html = `${headerIcon}<b>Mine Cliff</b><br/>`;
        const stoneIcon = ITEMS['stone'].icon ? `<img src="${ITEMS['stone'].icon}" class="icon"/>` : '';
        const oreIcon = ITEMS['ore'].icon ? `<img src="${ITEMS['ore'].icon}" class="icon"/>` : '';
        html += `Harvest ${stoneIcon}Stone x3 with a 20% chance of ${oreIcon}Ore.<br/>`;
        html += `<button id="start-mine">Mine</button><br/>`;
        html += `<br/><button id="close-btn">Cancel</button>`;
        this.show('mine', html);
        
        this.uiEl.querySelector('#start-mine').onclick = () => this.game.startMining(q, r);
        this.addCloseListener();
    }

    // --- UI Helpers and Listeners ---

    getRecipeHTML(rec, type) {
        const inputStr = Object.entries(rec.inputs).map(([id, qty]) => `${ITEMS[id].name} x${qty}`).join(', ');
        const outputStr = Object.entries(rec.output).map(([id, qty]) => `${ITEMS[id].name} x${qty}`).join(', ');
        const toolStr = rec.tools ? ' (requires ' + Object.keys(rec.tools).map(tid => ITEMS[tid].name).join(', ') + ')' : '';
        
        const canCraft = this.game.canCraft(rec.id);
        const disabledAttr = canCraft ? '' : 'disabled';

        const outId = Object.keys(rec.output)[0];
        const recIcon = outId && ITEMS[outId].icon ? `<img src="${ITEMS[outId].icon}" class="icon"/>` : '';

        let html = `<div style="margin-bottom:4px;">${recIcon}${rec.name} (requires ${rec.skill} lvl ${rec.level}${toolStr})<br/>`;
        html += `Inputs: ${inputStr} → Outputs: ${outputStr}<br/>`;
        html += `<button data-id="${rec.id}" ${disabledAttr}>${type.charAt(0).toUpperCase() + type.slice(1)}</button></div>`;
        return html;
    }

    addRecipeListeners(type) {
        this.uiEl.querySelectorAll(`button[data-id]`).forEach(btn => {
            btn.onclick = () => {
                if (type === 'craft') this.game.handleCraft(btn.dataset.id);
                if (type === 'build') this.game.handleBuild(btn.dataset.id);
            };
        });
        this.addCloseListener();
    }

    addTradeListeners(cityKey) {
        this.uiEl.querySelectorAll('button[data-action]').forEach(btn => {
            btn.onclick = () => {
                if (btn.dataset.action === 'buy') this.game.handleBuy(cityKey, btn.dataset.id);
                if (btn.dataset.action === 'sell') this.game.handleSell(cityKey, btn.dataset.id);
            };
        });
        this.addCloseListener();
    }

    addCloseListener() {
        const closeBtn = this.uiEl.querySelector('#close-btn');
        if (closeBtn) {
            closeBtn.onclick = () => this.hide();
        }
    }
}
