import * as THREE from 'three';
import { CameraController } from './modules/camera_controller.js';
import { findPath } from './modules/pathfinding.js';
import { Actions } from './modules/actions.js';
import { Economy } from './modules/economy.js';
import { ContextSystem } from './modules/context_system.js';
import { HexWorld, axialToWorld } from './modules/world_gen.js';
import { Player } from './modules/player.js';
import { UIController } from './modules/ui_controller.js';
import { ITEMS, ITEM_BASE_PRICES, RECIPES } from './modules/items_recipes.js';

// Texture paths are now defined in one place.
const BLOCK_TEXTURES = {
    grass: 'tiles/grass.png',
    dirt: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAA4UlEQVR4nG1SMQrDMAxURcdksIeYQihky5y5b+pTO3cLlECJh2hwyNKlwxVV2NYkn6XTnezT/XbtB0dFdK59Pt8+NBnO/eC2dccBSedaIoqSsmrgvMyiFyWfrY6SOtdyqSdKKhsARklc5VtmqQ4hovMyC2wcx0f9lGOV4ow7HxpvbECxrQaXDw2jdVt33RURPR6vrFq5WFvH8YKKbd3trjN5rK2qAUe74s61cExErFk1MCdKUjpGZg3YqHwNTPChsbvXvHwQjpKA9oNTedN0rTr+mVZUhVZ/x7/BRqbB7gfxBdbGem2n0UtmAAAAAElFTkSuQmCC',
    stone: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAA60lEQVR4nH1SIQ7DMBC7RiMFAZFutFJBQWkf0a8MDOynpQEBkUpbKSAgdMCTVyXTDjmJz+ez0j1eTxERkejDsiypZB7HeZKmTPQBaJwnsnGsqPlIImKqB9dbPhOj7N2JiKl4HHKeJzCESfg07PvuepuPdHVI4egDhQxvU8n27sCDXvQBQFXrCdVm0FNVChPcoEQb2IxjXW8xmZe3yjEzgOQ16K+lNvKW922gH7hvcd0wzhMCpVFgRvTD0nUt19thGPCRUskYRRfSxppK3rZNVUGF0DhP0Qe0deu6wlUqmeH8KUNhuYTz0z0mvAG9zpGjSheQXwAAAABJRU5ErkJggg==',
    marble: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAA20lEQVR4nH1SOxaDIBAceXai1soFvP9J0iTPIo3F2qRRwT7FmA0BXrZQFmeZj1SP+w1/6/C+a1ttTY4YnVMogBhdHtj3nYsEyqpj6lzMMAwAzhB+GGJqPXV0rmvbM4QYfQ0QRHM00Fi7iuScAKpleZ4hNNYqddHr1wNBfF75iIzOrSLFAUMBbFYRxXE4V2UA9H2f7K4i8zzH9njE4X2lf7qxNgmkuG+KUcSlaIo00zTpB70UdKUtPkEDMHxRnzrmqWwp4QyBi1pd5sFrehebyOF9tW2vPPLkSsf1BvCUjjq0MPN9AAAAAElFTkSuQmCC',
    ore: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAA90lEQVR4nHVSMWrDQBAcH8EBwS0n0Bv8iFSpDan8Ej8jVb7kP6RLebVAxx4IrCrF2OvNJtlCSOzM7Oysdse3EwDVLpLxs/b75227+ieAxB7Rql21G4GIbbuWMpID4MnafkgpI4DWFr63tqh2EQBIJunRrS0ElTKu6+q7aZqmYJ3CBLW2zPPMgTcCjXJF37Ai7UEgFMAwDNb4eP3yy/jaMdZQFuLvSuGbkv+h/yB4u7hfhp7jDmwHvkhmjLZM8nZFshdjvb98+jxSsOs/qXq+HGqtuEf3sGTaNr3WymPzzOfLQbUnuJ/McOSI5HA1kRxTgjstMwiTvwFhM42vBmjMyQAAAABJRU5ErkJggg==',
    water: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAzUlEQVR4nH1SQQrEIAxMdUGseBDsa/rgvqiv8JBDKNJDYQ+zZK1bd05JcJKZmGnd9sqScz6uk4gqi0+RxjBElHOe5xn5n9eV5UNAby0RUbDul4BeBkkRRmmJCS0QKLSF6fqBiaDlqIqbpJGYFqbLWzKmYc4S09f0I1QPaEXYp1hZjCrpXKqZB0m6TY1VQItgnU9xWrd9aHA0YYTK0i5taFrN+BSxtGAdbmyJ6UZAj85usO64TtxFEX6hhOMrT8LanyH96SJchFVxt7d2428xx3BZ0Y//OwAAAABJRU5ErkJggg=='
};

/**
 * The main Game class, responsible for orchestrating the entire application.
 */
class Game {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.world = null;
        this.player = null;
        this.ui = new UIController(this);

        this.worldGroup = null;
        this.pickGroup = null;
        this.propsGroup = null;

        this.cameraOffset = new THREE.Vector3();
        this.targetOffset = new THREE.Vector3();
        
        // Centralized game state
        this.state = {
            inventory: new Array(20).fill(null),
            gold: 50,
            skills: {
                woodworking: { level: 1, xp: 0 },
                stoneworking: { level: 1, xp: 0 },
                metalworking: { level: 1, xp: 0 }
            },
            prices: {} // Per-village prices, keyed by 'q,r'
        };

        this.keyStates = { left: false, right: false, up: false, down: false };
        this.path = [];
        this.movingAlongPath = false;
        this.lastMoveTime = 0;
        this.moveInterval = 350; // ms
    }

    async init() {
        // --- 1. Core Three.js Setup ---
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87ceeb);

        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 4000);
        this.camera.position.set(0, 35, 55);

        const ambient = new THREE.AmbientLight(0xffffff, 0.7);
        this.scene.add(ambient);
        const directional = new THREE.DirectionalLight(0xffffff, 0.7);
        directional.position.set(60, 100, 40);
        this.scene.add(directional);

        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        document.body.appendChild(this.renderer.domElement);

        // three r152+: color management defaults; be explicit
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        // --- 2. World Generation ---
        const params = new URLSearchParams(location.search);
        const seed = params.get('seed') || Math.floor(Math.random() * 1e9).toString();
        document.getElementById('seed-display').textContent = `Seed: ${seed}`;

        this.world = new HexWorld({
            boardRadius: 25, radius: 0.85, hScale: 0.5,
            maxHeight: 20, noiseScale: 0.08, seed: seed,
        });

        this.world.generateBase();
        this.world.addMountains(3);
        this.world.carveRiver();
        this.world.carveCliffWithRamp();
        this.world.assignBlocks();
        this.world.assignFeatures();

        // --- 3. Build Scene Objects ---
        this.worldGroup = this.world.buildMesh(BLOCK_TEXTURES);
        this.scene.add(this.worldGroup);
        if (this.world.pickGroup) {
            this.pickGroup = this.world.pickGroup;
            this.pickGroup.visible = false;
            this.scene.add(this.pickGroup);
        }

        this.player = new Player(this.world, this.scene);
        this.setupCameraFollow();

        const models = await this.loadPropModels();
        this.propsGroup = this.world.buildProps(models);
        this.scene.add(this.propsGroup);

        // --- 4. Start Game ---
        this.addEventListeners();
        this.animate();
    }
    
    setupCameraFollow() {
        this.cameraOffset.copy(this.camera.position).sub(this.player.mesh.position);
        this.targetOffset.copy(this.cameraOffset);
        this.followPlayer();
    }
    
    followPlayer() {
        const playerPos = this.player.mesh.position;
        const desiredPos = new THREE.Vector3().copy(playerPos).add(this.cameraOffset);
        this.camera.position.copy(desiredPos);
        this.camera.lookAt(playerPos);
    }

    addEventListeners() {
        window.addEventListener('resize', () => this.onResize());
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
        this.renderer.domElement.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.renderer.domElement.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    }
    
    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    onKeyDown(event) {
        const key = event.key.toLowerCase();
        const keyMap = {
            'i': () => this.ui.toggle('inventory', () => this.ui.showInventory()),
            'c': () => this.ui.toggle('craft', () => this.ui.showCrafting()),
            'k': () => this.ui.toggle('skills', () => this.ui.showSkills()),
            'b': () => this.ui.toggle('build', () => this.ui.showBuilding()),
            'arrowleft': () => this.keyStates.left = true,
            'arrowright': () => this.keyStates.right = true,
            'arrowup': () => this.keyStates.up = true,
            'arrowdown': () => this.keyStates.down = true,
        };
        if (keyMap[key]) {
            keyMap[key]();
            event.preventDefault();
        }
    }

    onKeyUp(event) {
        const key = event.key.toLowerCase();
        const keyMap = {
            'arrowleft': () => this.keyStates.left = false,
            'arrowright': () => this.keyStates.right = false,
            'arrowup': () => this.keyStates.up = false,
            'arrowdown': () => this.keyStates.down = false,
        };
        if (keyMap[key]) {
            keyMap[key]();
            event.preventDefault();
        }
    }
    
    onMouseDown(event) {
        if (this.ui.uiEl.contains(event.target)) return; // Ignore clicks on the UI

        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);
        const intersects = this.pickGroup ? raycaster.intersectObjects(this.pickGroup.children, true) : [];
        if (intersects.length === 0) return;
        
        const hit = intersects[0].object;
        if (hit && hit.userData) {
            const { qIndex, rIndex } = hit.userData;
            if (this.world.getHeight(qIndex, rIndex) !== -Infinity) {
                const path = this.findPath(this.player.q, this.player.r, qIndex, rIndex);
                if (path && path.length > 0) {
                    path.shift();
                    this.path = path;
                    this.movingAlongPath = true;
                }
            }
        }
    }

    onWheel(event) {
        event.preventDefault();
        const zoomFactor = event.deltaY > 0 ? 1.1 : 0.9;
        this.targetOffset.multiplyScalar(zoomFactor);
        const distance = this.targetOffset.length();
        const clamped = Math.min(Math.max(distance, 10), 150);
        this.targetOffset.setLength(clamped);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        this.updateCamera();
        this.updateMovement();
        this.updateContextualUIs();

        this.followPlayer();
        this.renderer.render(this.scene, this.camera);
    }

    updateCamera() {
        const rotateSpeed = 0.06;
        if (this.keyStates.left || this.keyStates.right) {
            const angle = (this.keyStates.left ? -rotateSpeed : 0) + (this.keyStates.right ? rotateSpeed : 0);
            this.targetOffset.applyAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        }
        const tiltSpeed = 0.4;
        if (this.keyStates.up || this.keyStates.down) {
            const delta = (this.keyStates.up ? 1 : 0) + (this.keyStates.down ? -1 : 0);
            this.targetOffset.y = Math.min(Math.max(this.targetOffset.y + delta * tiltSpeed, 5), 100);
        }
        this.cameraOffset.lerp(this.targetOffset, 0.2);
    }

    updateMovement() {
        if (!this.movingAlongPath || !this.path || this.path.length === 0) return;
        const now = performance.now();
        if (now - this.lastMoveTime < this.moveInterval) return;

        const next = this.path[0];
        const dq = next.q - this.player.q;
        const dr = next.r - this.player.r;
        
        if (this.player.move(dq, dr)) {
            this.lastMoveTime = now;
            this.path.shift();
            if (this.path.length === 0) {
                this.movingAlongPath = false;
            }
        } else {
            this.movingAlongPath = false;
            this.path = [];
        }
    }
    
    /**
     * Checks the player's surroundings and updates the contextual UI (mining,
     * harvesting, trading) to match the current highest-priority action.
     * This prevents flickering by only changing the UI when the contextual state
     * itself changes. Non-contextual UIs (inventory, craft, etc.) are not affected.
     */
    updateContextualUIs() {
        const contextualModes = ['mine', 'harvest', 'trade'];
        const isContextualUIActive = contextualModes.includes(this.ui.activeUIMode);
        const isOverlayUIActive = this.ui.activeUIMode && !isContextualUIActive;

        // If a non-contextual UI like Inventory or Crafting is open, do nothing.
        if (isOverlayUIActive) {
            return;
        }

        const { mode: newMode, params } = this.determineContextualMode();

        // If the mode is the same as what's already displayed, do nothing.
        if (newMode === this.ui.activeUIMode) {
            return;
        }

        // The mode has changed. Hide whatever contextual UI was open.
        if (isContextualUIActive) {
            this.ui.hide();
        }

        // Show the new UI if there is one.
        switch (newMode) {
            case 'mine':
                this.ui.showMining(params.q, params.r);
                break;
            case 'harvest':
                this.ui.showHarvest(params.q, params.r, params.treeMesh);
                break;
            case 'trade':
                const cityKey = `${params.cityQ},${params.cityR}`;
                this.initializeCityPrices(cityKey); // Ensure prices are generated
                this.ui.showTrade(cityKey, this.state.prices[cityKey]);
                break;
        }
    }
    
    /**
     * Determines the highest-priority contextual UI mode based on the player's
     * current position and surroundings.
     * @returns {{mode: string|null, params: object}} An object with the mode and its parameters.
     */
    determineContextualMode() {
        const q = this.player.q;
        const r = this.player.r;
        const currentHeight = this.world.getHeight(q, r);

        // Define search directions for neighbors
        const dirs = [ { dq: 1, dr: 0 }, { dq: -1, dr: 0 }, { dq: 0, dr: 1 }, { dq: 0, dr: -1 }, { dq: 1, dr: -1 }, { dq: -1, dr: 1 } ];

        // 1. Check for Mining (Highest Priority)
        for (const dir of dirs) {
            const nq = q + dir.dq;
            const nr = r + dir.dr;
            const h = this.world.getHeight(nq, nr);
            // A cliff is a neighbor at least 3 levels higher.
            if (h !== -Infinity && h - currentHeight >= 3) {
                return { mode: 'mine', params: { q: nq, r: nr } };
            }
        }

        // 2. Check for Harvesting
        const feat = (this.world.featureMap[r] && this.world.featureMap[r][q]) || 'none';
        if (feat === 'forest') {
            if (this.propsGroup) {
                const treeMesh = this.propsGroup.children.find(child =>
                    child.userData && child.userData.type === 'forest' && child.userData.q === q && child.userData.r === r
                );
                if (treeMesh) {
                    return { mode: 'harvest', params: { q, r, treeMesh } };
                }
            }
        }

        // 3. Check for Trading
        let cityQ = null;
        let cityR = null;
        for (const dir of [{dq:0, dr:0}, ...dirs]) { // Check current tile and neighbors
            const nq = q + dir.dq;
            const nr = r + dir.dr;
            if (this.world.isInside(nq, nr)) {
                const featAt = (this.world.featureMap[nr] && this.world.featureMap[nr][nq]) || 'none';
                if (featAt === 'city') {
                    cityQ = nq;
                    cityR = nr;
                    break;
                }
            }
        }
        if (cityQ !== null) {
            return { mode: 'trade', params: { cityQ, cityR } };
        }
        
        // 4. No context found
        return { mode: null, params: {} };
    }

    /**
     * Generates and caches a list of items and prices for a given city if not
     * already present.
     * @param {string} cityKey The unique key for the city (e.g., '15,20').
     */
    initializeCityPrices(cityKey) {
        if (this.state.prices[cityKey]) return; // Already initialized

        const allIds = Object.keys(ITEM_BASE_PRICES);
        const untradeable = ['cabin', 'stone_wall', 'wood_fence'];
        const tradeable = allIds.filter((id) => !untradeable.includes(id));
        const count = 5 + Math.floor(Math.random() * 3);
        const shuffled = tradeable.slice().sort(() => Math.random() - 0.5);
        const chosen = shuffled.slice(0, count);
        const prices = {};
        chosen.forEach((id) => {
            const base = ITEM_BASE_PRICES[id];
            const factor = 0.8 + Math.random() * 0.4;
            prices[id] = Math.max(1, Math.round(base * factor));
        });
        this.state.prices[cityKey] = prices;
    }

    // --- All game logic methods follow ---
    // (Crafting, building, trading, harvesting, inventory, etc.)
    // These are now cleaner as they delegate all UI work to this.ui

    // Example of a fully refactored logic chain
    handleCraft(recId) {
        const rec = RECIPES[recId];
        if (!rec) return;

        if (!this.canCraft(recId)) {
            this.ui.showNotification("You can't craft this yet.");
            return;
        }
        
        Object.entries(rec.inputs).forEach(([id, qty]) => this.removeItem(id, qty));
        Object.entries(rec.output).forEach(([id, qty]) => this.addItem(id, qty));
        this.addXP(rec.skill, rec.xp);
        
        this.ui.showNotification(`Crafted ${rec.name}!`);
        
        // Refresh the UI if it's still open
        if (this.ui.activeUIMode === 'craft') {
            this.ui.showCrafting();
        }
    }

    canCraft(recId) {
        const rec = RECIPES[recId];
        if (!rec) return false;
        const skill = this.state.skills[rec.skill];
        const hasSkill = skill && skill.level >= rec.level;
        const hasTools = !rec.tools || Object.keys(rec.tools).every(tid => this.hasItem(tid, 1));
        const hasMats = Object.entries(rec.inputs).every(([id, qty]) => this.hasItem(id, qty));
        return hasSkill && hasTools && hasMats;
    }
    /**
     * Add an item to the player's inventory.  Attempts to stack items up to
     * their maximum stack size and then uses empty slots as needed.  Any
     * remainder that cannot fit is silently discarded.
     * @param {string} id The item identifier
     * @param {number} qty Quantity to add
     */
    addItem(id, qty = 1) {
        const item = ITEMS[id];
        if (!item) return;
        let remaining = qty;
        // Fill existing stacks first
        for (let i = 0; i < this.state.inventory.length && remaining > 0; i++) {
            const slot = this.state.inventory[i];
            if (slot && slot.id === id) {
                const space = item.stack - slot.qty;
                if (space > 0) {
                    const add = Math.min(space, remaining);
                    slot.qty += add;
                    remaining -= add;
                }
            }
        }
        // Place into empty slots
        for (let i = 0; i < this.state.inventory.length && remaining > 0; i++) {
            if (!this.state.inventory[i]) {
                const add = Math.min(item.stack, remaining);
                this.state.inventory[i] = { id, qty: add };
                remaining -= add;
            }
        }
    }

    /**
     * Remove items from the inventory.  Removes from stacks in order until the
     * desired quantity is taken.  Returns true if all items were removed.
     * @param {string} id The item identifier
     * @param {number} qty Quantity to remove
     */
    removeItem(id, qty = 1) {
        let remaining = qty;
        for (let i = 0; i < this.state.inventory.length && remaining > 0; i++) {
            const slot = this.state.inventory[i];
            if (slot && slot.id === id) {
                const take = Math.min(slot.qty, remaining);
                slot.qty -= take;
                remaining -= take;
                if (slot.qty <= 0) this.state.inventory[i] = null;
            }
        }
        return remaining === 0;
    }

    /**
     * Check whether the player has at least a certain quantity of an item.
     * @param {string} id The item identifier
     * @param {number} qty Required quantity
     */
    hasItem(id, qty = 1) {
        let count = 0;
        this.state.inventory.forEach((slot) => {
            if (slot && slot.id === id) count += slot.qty;
        });
        return count >= qty;
    }

    /**
     * Award XP to a skill.  Levels up when a threshold is reached.  Caps
     * progress beyond a certain level until a mentor/quest is completed.
     * @param {string} skillName Name of the skill
     * @param {number} xp Amount of XP to add
     */
    addXP(skillName, xp) {
        const skill = this.state.skills[skillName];
        if (!skill) return;
        skill.xp += xp;
        const threshold = skill.level * skill.level * 10;
        const maxWithoutQuest = 3;
        if (skill.xp >= threshold) {
            if (skill.level < maxWithoutQuest) {
                skill.xp -= threshold;
                skill.level += 1;
                this.ui.showNotification(`Your ${skillName} skill increased to level ${skill.level}!`);
            } else {
                skill.xp = threshold;
                this.ui.showNotification(`Your ${skillName} skill is capped at level ${skill.level}. You need to find a mentor or complete a quest to progress further.`);
            }
        }
    }

    /**
     * Perform a building action using a recipe that produces a structure on the map.
     * Consumes materials, checks skill and tools, grants XP and spawns the model.
     * @param {string} recId The recipe identifier
     */
    handleBuild(recId) {
        const rec = RECIPES[recId];
        if (!rec || rec.category !== 'build') return;
        const skill = this.state.skills[rec.skill];
        if (!skill || skill.level < rec.level) {
            this.ui.showNotification(`You need ${rec.skill} lvl ${rec.level} to build ${rec.name}.`);
            return;
        }
        // Check required tools
        if (rec.tools) {
            const missing = Object.entries(rec.tools).find(([tid, qty]) => !this.hasItem(tid, qty));
            if (missing) {
                const [tid] = missing;
                this.ui.showNotification(`You need a ${ITEMS[tid].name} to build ${rec.name}.`);
                return;
            }
        }
        // Check materials
        const enough = Object.entries(rec.inputs).every(([id, qty]) => this.hasItem(id, qty));
        if (!enough) {
            this.ui.showNotification('Not enough materials.');
            return;
        }
        // Consume materials
        Object.entries(rec.inputs).forEach(([id, qty]) => this.removeItem(id, qty));
        // Grant XP
        this.addXP(rec.skill, rec.xp);
        // Spawn structure
        this.buildStructure(recId);
        this.ui.showNotification(`Built ${rec.name}!`);
        // Refresh building UI if still open
        if (this.ui.activeUIMode === 'build') {
            this.ui.showBuilding();
        }
    }

    /**
     * Instantiate a building model at the player's current tile.  Models are
     * simple procedural shapes that roughly represent the intended structure.
     * @param {string} recId The recipe identifier for the structure
     */
    buildStructure(recId) {
        const q = this.player.q;
        const r = this.player.r;
        const h = this.world.getHeight(q, r);
        const { x, z } = axialToWorld(q - this.world.boardRadius, r - this.world.boardRadius, this.world.radius);
        let mesh;
        if (recId === 'cabin') {
            // A log cabin constructed from several huts
            mesh = new THREE.Group();
            const wallMat = new THREE.MeshLambertMaterial({ color: 0xb0b0b5 });
            const roofMat = new THREE.MeshLambertMaterial({ color: 0x8b6b48 });
            const configs = [
                { pos: [0.0, 0.0], scale: 1.2 },
                { pos: [0.6, 0.4], scale: 0.8 },
                { pos: [-0.6, -0.4], scale: 0.8 },
                { pos: [0.4, -0.5], scale: 0.7 },
            ];
            configs.forEach(({ pos, scale }) => {
                const [hx, hz] = pos;
                const baseGeo = new THREE.BoxGeometry(1.0 * scale, 0.6 * scale, 1.0 * scale);
                const baseMesh = new THREE.Mesh(baseGeo, wallMat);
                baseMesh.position.set(hx, 0.3 * scale, hz);
                mesh.add(baseMesh);
                const roofGeo = new THREE.ConeGeometry(0.6 * scale, 0.6 * scale, 4);
                const roofMesh = new THREE.Mesh(roofGeo, roofMat);
                roofMesh.position.set(hx, 0.6 * scale + 0.3 * scale, hz);
                mesh.add(roofMesh);
            });
        } else if (recId === 'wood_fence') {
            mesh = new THREE.Group();
            const postMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
            const railMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
            const postGeo = new THREE.BoxGeometry(0.1, 1.0, 0.1);
            const railGeo = new THREE.BoxGeometry(1.0, 0.05, 0.1);
            const positions = [ [-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6] ];
            positions.forEach(([dx, dz]) => {
                const post = new THREE.Mesh(postGeo, postMat);
                post.position.set(dx, 0.5, dz);
                mesh.add(post);
            });
            const rail1 = new THREE.Mesh(railGeo, railMat);
            rail1.position.set(0, 0.3, -0.6);
            mesh.add(rail1);
            const rail2 = rail1.clone();
            rail2.position.set(0, 0.3, 0.6);
            mesh.add(rail2);
            const rail3 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 1.2), railMat);
            rail3.position.set(0.6, 0.3, 0);
            mesh.add(rail3);
            const rail4 = rail3.clone();
            rail4.position.set(-0.6, 0.3, 0);
            mesh.add(rail4);
        } else if (recId === 'stone_wall') {
            const wallMat = new THREE.MeshLambertMaterial({ color: 0x888888 });
            const baseGeo = new THREE.BoxGeometry(1.8, 1.2, 0.4);
            mesh = new THREE.Mesh(baseGeo, wallMat);
        } else {
            // Fallback: a simple cube for unknown building types
            const mat = new THREE.MeshLambertMaterial({ color: 0xffffff * Math.random() });
            const geo = new THREE.BoxGeometry(1, 1, 1);
            mesh = new THREE.Mesh(geo, mat);
        }
        mesh.position.set(x, (h + 1) * this.world.hScale, z);
        mesh.userData = { type: 'building', recId: recId, q: q, r: r };
        if (!this.propsGroup) {
            this.propsGroup = new THREE.Group();
            this.scene.add(this.propsGroup);
        }
        this.propsGroup.add(mesh);
    }

    /**
     * Buy an item from a village.  Deducts gold, grants the item and refreshes the trade UI.
     * @param {string} cityKey Key of the village price list
     * @param {string} itemId Item identifier to purchase
     */
    handleBuy(cityKey, itemId) {
        const priceList = this.state.prices[cityKey];
        if (!priceList) return;
        const price = priceList[itemId];
        if (price == null) return;
        if (this.state.gold < price) {
            this.ui.showNotification('Not enough gold.');
            return;
        }
        this.state.gold -= price;
        this.addItem(itemId, 1);
        // Refresh trade UI
        this.ui.showTrade(cityKey, this.state.prices[cityKey]);
        // Also refresh inventory UI if open
        if (this.ui.activeUIMode === 'inventory') {
            this.ui.showInventory();
        }
    }

    /**
     * Sell an item to a village.  Removes the item, awards half its buy price and refreshes UI.
     * @param {string} cityKey Key of the village price list
     * @param {string} itemId Item identifier to sell
     */
    handleSell(cityKey, itemId) {
        const priceList = this.state.prices[cityKey];
        if (!priceList) return;
        const fullPrice = priceList[itemId];
        if (fullPrice == null) return;
        if (!this.hasItem(itemId, 1)) {
            this.ui.showNotification('You do not have any to sell.');
            return;
        }
        const price = Math.max(1, Math.floor(fullPrice / 2));
        this.removeItem(itemId, 1);
        this.state.gold += price;
        // Refresh trade UI
        this.ui.showTrade(cityKey, this.state.prices[cityKey]);
        if (this.ui.activeUIMode === 'inventory') {
            this.ui.showInventory();
        }
    }

    /**
     * Begin a harvest action on a forest tile.  Shows a progress bar and then
     * awards items when complete.  If chopping, requires an axe in inventory.
     * @param {string} action 'chop' or 'branch'
     * @param {number} q Axial q coordinate
     * @param {number} r Axial r coordinate
     * @param {THREE.Object3D} treeMesh The mesh representing the tree (unused here but passed for potential future use)
     */
    startHarvest(action, q, r, treeMesh) {
        if (action === 'chop' && !this.hasItem('axe', 1)) {
            this.ui.showNotification('You need an axe to chop down a tree. You can gather branches without an axe.');
            // Re-show harvest UI so the player can choose another action
            this.ui.showHarvest(q, r, treeMesh);
            return;
        }
        // Hide current UI and show a progress bar
        this.ui.hide();
        this.ui.showProgress('Harvesting', 2000, () => {
            this.finishHarvest(action, q, r, treeMesh);
        });
    }

    /**
     * Complete a harvest action and award items.  Branches leave the tree intact; chopping produces logs.
     */
    finishHarvest(action, q, r, treeMesh) {
        let id;
        let qty;
        if (action === 'chop') {
            id = 'rough_log';
            qty = 1;
        } else {
            id = 'branch';
            qty = 2;
        }
        this.addItem(id, qty);
        this.ui.showNotification(`You obtained ${qty} x ${ITEMS[id].name}!`);
    }

    /**
     * Begin a mining action when adjacent to a steep cliff.  Shows a progress bar and awards stone/ore.
     * @param {number} q Target q coordinate for mining
     * @param {number} r Target r coordinate for mining
     */
    startMining(q, r) {
        // Hide any open UI and show progress
        this.ui.hide();
        this.ui.showProgress('Mining', 2000, () => {
            this.finishMining(q, r);
        });
    }

    /**
     * Complete a mining action.  Awards stone and occasionally ore.
     */
    finishMining(q, r) {
        this.addItem('stone', 3);
        if (Math.random() < 0.2) {
            this.addItem('ore', 1);
            this.ui.showNotification('You mined 3 Stone and found an Ore!');
        } else {
            this.ui.showNotification('You mined 3 Stone.');
        }
    }

    
    // A* Pathfinding (unchanged from original)
    findPath(q0, r0, q1, r1) {
      if (q0 === q1 && r0 === r1) return [];
      function heuristic(q, r) {
        const dq = Math.abs(q - q1);
        const dr = Math.abs(r - r1);
        const dSum = Math.abs(dq + dr);
        return Math.max(dq, dr, dSum);
      }
      const directions = [
        { dq: 1, dr: 0 }, { dq: -1, dr: 0 }, { dq: 0, dr: 1 }, { dq: 0, dr: -1 },
        { dq: 1, dr: -1 }, { dq: -1, dr: 1 },
      ];
      const open = []; const openMap = {}; const closed = {};
      const startNode = { q: q0, r: r0, g: 0, f: heuristic(q0, r0), parent: null };
      const hash = (q, r) => q + ',' + r;
      open.push(startNode);
      openMap[hash(q0, r0)] = startNode;
      while (open.length > 0) {
        open.sort((a, b) => a.f - b.f);
        const current = open.shift();
        delete openMap[hash(current.q, current.r)];
        if (current.q === q1 && current.r === r1) {
          const path = []; let n = current;
          while (n) { path.unshift({ q: n.q, r: n.r }); n = n.parent; }
          return path;
        }
        closed[hash(current.q, current.r)] = true;
        for (const dir of directions) {
          const nq = current.q + dir.dq; const nr = current.r + dir.dr;
          const h0 = this.world.getHeight(current.q, current.r);
          const h1 = this.world.getHeight(nq, nr);
          if (h1 === -Infinity || h1 - h0 > 1) continue;
          const key = hash(nq, nr);
          if (closed[key]) continue;
          const tentativeG = current.g + 1;
          let neighbor = openMap[key];
          if (!neighbor) {
            neighbor = { q: nq, r: nr, g: tentativeG, f: tentativeG + heuristic(nq, nr), parent: current };
            open.push(neighbor); openMap[key] = neighbor;
          } else if (tentativeG < neighbor.g) {
            neighbor.g = tentativeG; neighbor.f = tentativeG + heuristic(nq, nr); neighbor.parent = current;
          }
        }
      }
      return null;
    }

    // Model Loading (unchanged from original)
    async loadPropModels() {
      const treeFallback = new THREE.Group();
      {
        const trunk = new THREE.CylinderGeometry(0.12, 0.12, 0.6, 8);
        const leaves = new THREE.ConeGeometry(0.5, 1.0, 8);
        const mTrunk = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
        const mLeaves = new THREE.MeshLambertMaterial({ color: 0x2a9d3e });
        const trunkMesh = new THREE.Mesh(trunk, mTrunk); trunkMesh.position.y = 0.3;
        const leavesMesh = new THREE.Mesh(leaves, mLeaves); leavesMesh.position.y = 0.9;
        treeFallback.add(trunkMesh, leavesMesh);
      }
      const buildingFallback = new THREE.Group();
      {
        const wallMat = new THREE.MeshLambertMaterial({ color: 0xb0b0b5 });
        const roofMat = new THREE.MeshLambertMaterial({ color: 0x8b6b48 });
        const hutConfigs = [
          { pos: [0.0, 0.0], scale: 0.8 }, { pos: [0.5, 0.35], scale: 0.6 },
          { pos: [-0.5, -0.35], scale: 0.6 }, { pos: [0.3, -0.45], scale: 0.5 }
        ];
        hutConfigs.forEach(({ pos, scale }) => {
          const [hx, hz] = pos;
          const baseGeo = new THREE.BoxGeometry(1.0 * scale, 0.6 * scale, 1.0 * scale);
          const baseMesh = new THREE.Mesh(baseGeo, wallMat); baseMesh.position.set(hx, 0.3 * scale, hz);
          buildingFallback.add(baseMesh);
          const roofGeo = new THREE.ConeGeometry(0.6 * scale, 0.6 * scale, 4);
          const roofMesh = new THREE.Mesh(roofGeo, roofMat); roofMesh.position.set(hx, 0.6 * scale + 0.3 * scale, hz);
          buildingFallback.add(roofMesh);
        });
      }
      return { forest: treeFallback, city: buildingFallback };
    }
}

// --- Main Execution ---
document.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.init();
});