import * as THREE from 'three';
import { ITEMS, RECIPES, SKILL_INFO, ITEM_BASE_PRICES } from './items_recipes_skills.js';

const UI_ICONS = {
    inventory: ITEMS['chest'].icon,
    craft: ITEMS['saw'].icon,
    build: ITEMS['cabin'].icon,
    trade: ITEMS['brick'].icon,
    harvest: ITEMS['axe'].icon,
    mine: ITEMS['pickaxe'].icon,
    skills: ITEMS['ingot'].icon,
};

export class UIController {
    constructor(game) {
        this.game = game;
        this.uiEl = document.getElementById('ui');
        this.worldspaceUIContainer = document.getElementById('worldspace-ui');
        this.activeUIMode = null;
        this.activeWorldspaceUIs = [];
    }

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

    showWorldspaceUI(targetObject, title, actions = [], key) {
        const element = document.createElement('div');
        element.className = 'world-popup';

        const titleEl = document.createElement('b');
        titleEl.textContent = title;
        element.appendChild(titleEl);

        actions.forEach(action => {
            const button = document.createElement('button');
            button.textContent = action.label;
            button.onclick = (event) => {
                event.stopPropagation();
                action.callback();
            };
            element.appendChild(button);
        });

        this.worldspaceUIContainer.appendChild(element);

        const popup = {
            element,
            target: targetObject,
            id: `ws-${Date.now()}-${Math.random()}`,
            key: key,
        };
        this.activeWorldspaceUIs.push(popup);
        
        setTimeout(() => element.classList.add('visible'), 10);
        
        return popup.id;
    }

    hideWorldspaceUI(id) {
        const index = this.activeWorldspaceUIs.findIndex(p => p.id === id);
        if (index !== -1) {
            const popup = this.activeWorldspaceUIs[index];
            popup.element.classList.remove('visible');
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

    update(camera) {
        const halfWidth = window.innerWidth / 2;
        const halfHeight = window.innerHeight / 2;
        
        const targetScreenPositions = new Map();

        this.activeWorldspaceUIs.forEach(popup => {
            if (!targetScreenPositions.has(popup.target)) {
                const position = new THREE.Vector3();
                const targetPosition = popup.target.getWorldPosition(new THREE.Vector3());
                targetPosition.y += 1.5;
                
                position.copy(targetPosition).project(camera);
                
                const x = (position.x * halfWidth) + halfWidth;
                const y = -(position.y * halfHeight) + halfHeight;
                
                targetScreenPositions.set(popup.target, { x, y, stackCount: 0, isBehind: position.z > 1 });
            }
        });

        this.activeWorldspaceUIs.forEach(popup => {
            const posData = targetScreenPositions.get(popup.target);
            if (!posData) return;

            const yOffset = posData.stackCount * -40;
            
            popup.element.style.left = `${posData.x}px`;
            popup.element.style.top = `${posData.y + yOffset}px`;
            popup.element.style.display = posData.isBehind ? 'none' : '';
            
            posData.stackCount++;
        });
    }

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
        this.hide();
        this.hideAllWorldspaceUIs();
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
        
        const playerCity = this.game.getPlayerCurrentCity();

        Object.values(RECIPES).forEach((rec) => {
            if (rec.category === 'build') return;
            html += this.getRecipeHTML(rec, 'craft', playerCity);
        });
        html += `<br/><button id="close-btn">Close</button>`;
        this.show('craft', html);
        this.addRecipeListeners('craft');
    }
    
    showBuilding() {
        const headerIcon = UI_ICONS.build ? `<img src="${UI_ICONS.build}" class="icon"/>` : '';
        let html = `${headerIcon}<b>Building</b><br/>`;

        const playerCity = this.game.getPlayerCurrentCity();

        Object.values(RECIPES).forEach((rec) => {
            if (rec.category !== 'build') return;
            html += this.getRecipeHTML(rec, 'build', playerCity);
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
            for (let lvl = 1; lvl <= 10; lvl++) { // Check up to a higher level
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

    showTrade(cityKey) {
        this.hideAllWorldspaceUIs();
        this.game.initializeCityData(cityKey);
        const cityData = this.game.state.cities[cityKey];
        if (!cityData) return;

        const headerIcon = UI_ICONS.trade ? `<img src="${UI_ICONS.trade}" class="icon"/>` : '';
        let html = `${headerIcon}<b>Village Market</b><br/>Gold: ${Math.floor(this.game.state.gold)}<br/><br/>`;
        
        html += `<b>For Sale:</b><br/>`;
        Object.entries(cityData.prices).forEach(([id, price]) => {
            const item = ITEMS[id];
            const icon = item.icon ? `<img src="${item.icon}" class="icon"/>` : '';
            html += `${icon}${item.name} — ${price} gold`;
            html += ` <button data-action="buy" data-id="${id}">Buy</button>`;
            html += ` <button data-action="sell" data-id="${id}">Sell</button><br/>`;
        });

        const infrastructure = ['oven', 'forge', 'whetstone'];
        if (cityData.rentableTools && cityData.rentableTools.length > 0) {
            html += `<br/><b>Workshops for Rent:</b><br/>`;
            cityData.rentableTools.forEach(toolId => {
                const item = ITEMS[toolId];
                const icon = item.icon ? `<img src="${item.icon}" class="icon"/>` : '';
                const rentalFee = infrastructure.includes(toolId) ? 0 : Math.max(5, Math.floor(ITEM_BASE_PRICES[toolId] * 0.2)); 
                const feeText = rentalFee > 0 ? `(Fee: ${rentalFee} gold)` : `(Free to use)`;
                html += `${icon}${item.name} ${feeText}<br/>`;
            });
        }

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

    getRecipeHTML(rec, type, playerCity = null) {
        const { canCraft, rentalTool } = this.game.actions.canCraft(rec.id, playerCity);
        const disabledAttr = canCraft ? '' : 'disabled';

        const outId = Object.keys(rec.output)[0];
        const recIcon = outId && ITEMS[outId].icon ? `<img src="${ITEMS[outId].icon}" class="icon"/>` : '';

        let html = `<div style="margin-bottom:4px;">${recIcon}<b>${rec.name}</b><br/>`;
        
        const inputStr = Object.entries(rec.inputs).map(([id, qty]) => `${ITEMS[id].name} x${qty}`).join(', ');
        html += `<i>Inputs:</i> ${inputStr}<br/>`;

        if (rec.tools) {
            const toolStr = Object.keys(rec.tools).map(tid => {
                const toolName = ITEMS[tid].name;
                if (rentalTool && rentalTool.id === tid) {
                    const feeText = rentalTool.fee > 0 ? `Rent: ${rentalTool.fee}g` : `Use Village Tool`;
                    return `${toolName} (${feeText})`;
                }
                return toolName;
            }).join(', ');
            html += `<i>Requires:</i> ${toolStr}<br/>`;
        }

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
