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
        this.uiEl.style.display = 'flex';
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
        let content = `<div id="inventory-grid">`;
        this.game.state.inventory.forEach(slot => {
            if (slot) {
                const item = ITEMS[slot.id];
                content += `
                    <div class="inventory-slot">
                        <img src="${item.icon}" alt="${item.name}">
                        <div class="item-name">${item.name} x${slot.qty}</div>
                    </div>
                `;
            } else {
                content += `<div class="inventory-slot"></div>`;
            }
        });
        content += `</div>`;
        this.createModal('inventory', 'Inventory', content);
    }

    showCrafting() {
        const skills = ['woodworking', 'stoneworking', 'metalworking'];
        this.createTabbedModal('craft', 'Crafting', skills, (skill) => {
            let content = '';
            const recipes = Object.values(RECIPES).filter(rec => rec.skill === skill && rec.category !== 'build');
            if (recipes.length === 0) return 'No recipes available for this skill.';
            recipes.forEach(rec => {
                content += this.getRecipeHTML(rec, 'craft');
            });
            return content;
        });
    }

    showBuilding() {
        let content = '';
        const recipes = Object.values(RECIPES).filter(rec => rec.category === 'build');
        if (recipes.length === 0) return 'No building plans available.';
        recipes.forEach(rec => {
            content += this.getRecipeHTML(rec, 'build');
        });
        this.createModal('build', 'Building', content);
    }

    showSkills() {
        const skills = Object.keys(this.game.state.skills);
        this.createTabbedModal('skills', 'Skills', skills, (skillName) => {
            const skillState = this.game.state.skills[skillName];
            let content = `
                <div style="text-align:center; margin-bottom: 15px;">
                    <strong>Level: ${skillState.level} | XP: ${skillState.xp.toFixed(0)}</strong>
                </div>
            `;
            const info = SKILL_INFO[skillName] || {};
            for (let lvl = 1; lvl <= 7; lvl++) {
                const entries = info[lvl] || [];
                if (entries.length > 0) {
                    content += `<h4>Level ${lvl} Unlocks</h4><ul>`;
                    entries.forEach(line => content += `<li>${line}</li>`);
                    content += `</ul>`;
                }
            }
            return content;
        });
    }

    showTrade(cityKey) {
        this.hideAllWorldspaceUIs();
        this.game.initializeCityData(cityKey);
        const cityData = this.game.state.cities[cityKey];
        if (!cityData) return;

        let content = `<div class="trade-container">`;
        content += `<strong>Gold: ${Math.floor(this.game.state.gold)}</strong><hr>`;
        content += `<h4>Market Goods</h4>`;
        
        Object.entries(cityData.prices).forEach(([id, price]) => {
            const item = ITEMS[id];
            const icon = item.icon ? `<img src="${item.icon}" class="icon"/>` : '';
            content += `<div class="recipe">${icon}<div>${item.name} — ${price} gold</div><div>`;
            content += ` <button data-action="buy" data-id="${id}">Buy</button>`;
            content += ` <button data-action="sell" data-id="${id}">Sell</button></div></div>`;
        });

        const infrastructure = ['oven', 'forge', 'whetstone'];
        if (cityData.rentableTools && cityData.rentableTools.length > 0) {
            content += `<br/><b>Workshops for Rent:</b><br/>`;
            cityData.rentableTools.forEach(toolId => {
                const item = ITEMS[toolId];
                const icon = item.icon ? `<img src="${item.icon}" class="icon"/>` : '';
                const rentalFee = infrastructure.includes(toolId) ? 0 : Math.max(5, Math.floor(ITEM_BASE_PRICES[toolId] * 0.2)); 
                const feeText = rentalFee > 0 ? `(Fee: ${rentalFee} gold)` : `(Free to use)`;
                content += `${icon}${item.name} ${feeText}<br/>`;
            });
        }

        content += `<hr><h4>Your Wares</h4>`;
        this.game.state.inventory.forEach((slot) => {
            if (slot) {
                const invItem = ITEMS[slot.id];
                const invIcon = invItem.icon ? `<img src="${invItem.icon}" class="icon"/>` : '';
                content += `<div>${invIcon}${invItem.name} x${slot.qty}</div>`;
            }
        });
        content += `</div>`;
        this.createModal('trade', 'Village Market', content);
        this.addTradeListeners(cityKey);
    }
    
    createModal(mode, title, content) {
        const icon = UI_ICONS[mode] ? `<img src="${UI_ICONS[mode]}" class="icon modal-title-icon"/>` : '';
        const html = `
            <div class="modal">
                <div class="modal-header">
                    <h2 class="modal-title">${icon} ${title}</h2>
                </div>
                <div class="modal-close" title="Close">&times;</div>
                <div class="modal-content">
                    ${content}
                </div>
            </div>
        `;
        this.show(mode, html);
        this.uiEl.querySelector('.modal-close').onclick = () => this.hide();
        this.addRecipeListeners('build');
    }

    createTabbedModal(mode, title, tabsData, contentGenerator) {
        const icon = UI_ICONS[mode] ? `<img src="${UI_ICONS[mode]}" class="icon modal-title-icon"/>` : '';
        let tabs = '';
        let tabContents = '';

        tabsData.forEach((tabName, index) => {
            const active = index === 0 ? 'active' : '';
            tabs += `<div class="tab ${active}" data-tab="${tabName}">${tabName.charAt(0).toUpperCase() + tabName.slice(1)}</div>`;
            tabContents += `<div class="tab-content ${active}" data-tab-content="${tabName}">${contentGenerator(tabName)}</div>`;
        });

        const html = `
            <div class="modal">
                <div class="modal-header">
                    <h2 class="modal-title">${icon} ${title}</h2>
                </div>
                <div class="modal-close" title="Close">&times;</div>
                <div class="tabs">${tabs}</div>
                <div class="modal-content">
                    ${tabContents}
                </div>
            </div>
        `;
        this.show(mode, html);

        this.uiEl.querySelector('.modal-close').onclick = () => this.hide();
        this.uiEl.querySelectorAll('.tab').forEach(tab => {
            tab.onclick = () => {
                this.uiEl.querySelectorAll('.tab, .tab-content').forEach(el => el.classList.remove('active'));
                tab.classList.add('active');
                this.uiEl.querySelector(`.tab-content[data-tab-content="${tab.dataset.tab}"]`).classList.add('active');
            };
        });

        if (mode === 'craft') {
            this.addRecipeListeners('craft');
        }
    }

    getRecipeHTML(rec, type) {
        const playerCity = this.game.getPlayerCurrentCity();
        const { canCraft, rentalTool } = this.game.actions.canCraft(rec.id, playerCity);
        const disabledAttr = canCraft ? '' : 'disabled';

        const outId = Object.keys(rec.output)[0];
        const recIcon = outId && ITEMS[outId].icon ? `<img src="${ITEMS[outId].icon}" class="icon"/>` : '';
        
        const inputStr = Object.entries(rec.inputs).map(([id, qty]) => `${ITEMS[id].name} x${qty}`).join(', ');
        
        let toolStr = '';
        if (rec.tools) {
            toolStr = ' (req: ' + Object.keys(rec.tools).map(tid => {
                const toolName = ITEMS[tid].name;
                if (rentalTool && rentalTool.id === tid) {
                    const feeText = rentalTool.fee > 0 ? `Rent: ${rentalTool.fee}g` : `Use Village Tool`;
                    return `${toolName} (${feeText})`;
                }
                return toolName;
            }).join(', ') + ')';
        }

        return `
            <div class="recipe">
                <div>
                    ${recIcon}<strong>${rec.name}</strong> (Lvl ${rec.level} ${rec.skill}${toolStr})<br/>
                    <em>Requires:</em> ${inputStr}
                </div>
                <button data-id="${rec.id}" ${disabledAttr}>${type.charAt(0).toUpperCase() + type.slice(1)}</button>
            </div>
        `;
    }

    addRecipeListeners(type) {
        this.uiEl.querySelectorAll(`.recipe button[data-id]`).forEach(btn => {
            btn.onclick = () => {
                if (type === 'craft') this.game.actions.handleCraft(btn.dataset.id);
                if (type === 'build') this.game.actions.handleBuild(btn.dataset.id);
            };
        });
    }

    addTradeListeners(cityKey) {
        this.uiEl.querySelectorAll('button[data-action]').forEach(btn => {
            btn.onclick = () => {
                if (btn.dataset.action === 'buy') this.game.actions.handleBuy(cityKey, btn.dataset.id);
                if (btn.dataset.action === 'sell') this.game.actions.handleSell(cityKey, btn.dataset.id);
            };
        });
    }
}