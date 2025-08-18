import * as THREE from 'three';
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
        this.worldspaceUIContainer = document.getElementById('worldspace-ui');
        this.activeUIMode = null;
        this.activeWorldspaceUIs = []; // To track pop-ups
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

    // --- World-space UI Methods ---

    /**
     * Displays a UI element in world space, attached to a 3D object.
     * @param {THREE.Object3D} targetObject The object to follow.
     * @param {string} title The title text for the popup.
     * @param {Array<{label: string, callback: function}>} actions Array of button actions.
     * @returns {string} The ID of the created UI element.
     */
    showWorldspaceUI(targetObject, title, actions = []) {
        const element = document.createElement('div');
        element.className = 'world-popup';

        const titleEl = document.createElement('b');
        titleEl.textContent = title;
        element.appendChild(titleEl);

        actions.forEach(action => {
            const button = document.createElement('button');
            button.textContent = action.label;
            button.onclick = (event) => {
                // Prevent clicks on UI from triggering game world actions like movement
                event.stopPropagation();
                action.callback();
            };
            element.appendChild(button);
        });

        this.worldspaceUIContainer.appendChild(element);

        const popup = {
            element,
            target: targetObject,
            id: `ws-${Date.now()}-${Math.random()}`
        };
        this.activeWorldspaceUIs.push(popup);
        
        // Make it visible after a short delay to trigger the CSS transition
        setTimeout(() => element.classList.add('visible'), 10);
        
        return popup.id;
    }

    hideWorldspaceUI(id) {
        const index = this.activeWorldspaceUIs.findIndex(p => p.id === id);
        if (index !== -1) {
            const popup = this.activeWorldspaceUIs[index];
            popup.element.classList.remove('visible');
            // Remove from DOM after transition finishes
            setTimeout(() => {
                if (this.worldspaceUIContainer.contains(popup.element)) {
                    this.worldspaceUIContainer.removeChild(popup.element);
                }
            }, 200);
            this.activeWorldspaceUIs.splice(index, 1);
        }
    }

    hideAllWorldspaceUIs() {
        while(this.activeWorldspaceUIs.length > 0) {
            this.hideWorldspaceUI(this.activeWorldspaceUIs[0].id);
        }
    }

    /**
     * Updates the screen position of all active world-space UI elements.
     * @param {THREE.Camera} camera The main game camera.
     */
    update(camera) {
        const halfWidth = window.innerWidth / 2;
        const halfHeight = window.innerHeight / 2;
        
        this.activeWorldspaceUIs.forEach(popup => {
            const position = new THREE.Vector3();
            popup.target.getWorldPosition(position);
            position.project(camera);
            
            // Convert normalized device coordinates to screen coordinates
            const x = (position.x * halfWidth) + halfWidth;
            const y = -(position.y * halfHeight) + halfHeight;
            
            popup.element.style.left = `${x}px`;
            popup.element.style.top = `${y}px`;

            // Hide if it's behind the camera
            const isBehind = position.z > 1;
            popup.element.style.display = isBehind ? 'none' : '';
        });
    }

    // --- General Purpose UI Components ---

    showNotification(message, duration = 3000) {
        const notification = document.createElement('div');
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
        this.hideAllWorldspaceUIs(); // Hide popups when opening a full-screen UI
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

    // --- UI Helpers and Listeners ---

    getRecipeHTML(rec, type) {
        const inputStr = Object.entries(rec.inputs).map(([id, qty]) => `${ITEMS[id].name} x${qty}`).join(', ');
        const outputStr = Object.entries(rec.output).map(([id, qty]) => `${ITEMS[id].name} x${qty}`).join(', ');
        const toolStr = rec.tools ? ' (requires ' + Object.keys(rec.tools).map(tid => ITEMS[tid].name).join(', ') + ')' : '';
        
        const canCraft = this.game.actions.canCraft(rec.id);
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
                if (type === 'craft') this.game.actions.handleCraft(btn.dataset.id);
                if (type === 'build') this.game.actions.handleBuild(btn.dataset.id);
            };
        });
        this.addCloseListener();
    }

    addTradeListeners(cityKey) {
        this.uiEl.querySelectorAll('button[data-action]').forEach(btn => {
            btn.onclick = () => {
                if (btn.dataset.action === 'buy') this.game.actions.handleBuy(cityKey, btn.dataset.id);
                if (btn.dataset.action === 'sell') this.game.actions.handleSell(cityKey, btn.dataset.id);
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
