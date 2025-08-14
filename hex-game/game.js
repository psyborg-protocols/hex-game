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
        
        this.state = {
            inventory: new Array(20).fill(null),
            gold: 50,
            skills: {
                woodworking: { level: 1, xp: 0 },
                stoneworking: { level: 1, xp: 0 },
                metalworking: { level: 1, xp: 0 }
            },
            prices: {}
        };

        this.keyStates = { left: false, right: false, up: false, down: false };
        this.path = [];
        this.movingAlongPath = false;
        this.lastMoveTime = 0;
        this.moveInterval = 350;

        // ADDED: State for new placement mode
        this.placementMode = null; // e.g., { recipeId: 'ladder' }
        this.placementHighlights = new THREE.Group();
    }

    async init() {
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

        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

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

        this.worldGroup = this.world.buildMesh(BLOCK_TEXTURES);
        this.scene.add(this.worldGroup);
        if (this.world.pickGroup) {
            this.pickGroup = this.world.pickGroup;
            this.pickGroup.visible = false;
            this.scene.add(this.pickGroup);
        }
        
        // ADDED: Add highlight group to scene
        this.scene.add(this.placementHighlights);

        this.player = new Player(this.world, this.scene);
        this.setupCameraFollow();

        const models = await this.loadPropModels();
        this.propsGroup = this.world.buildProps(models);
        this.scene.add(this.propsGroup);

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
        // ADDED: Escape to cancel placement mode
        if (event.key === 'Escape' && this.placementMode) {
            this.exitPlacementMode();
            event.preventDefault();
            return;
        }

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
        const rect = this.renderer.domElement.getBoundingClientRect();
        const mouse = new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);
        
        // MODIFIED: Handle placement mode click first
        if (this.placementMode) {
            const intersects = raycaster.intersectObjects(this.placementHighlights.children);
            if (intersects.length > 0) {
                const highlight = intersects[0].object;
                if (highlight.userData.isHighlight) {
                    this.confirmPlacement(highlight.userData.placementData);
                }
            }
            return; // Prevent pathfinding while in placement mode
        }

        if (this.ui.uiEl.contains(event.target)) return;

        const intersects = this.pickGroup ? raycaster.intersectObjects(this.pickGroup.children, true) : [];
        if (intersects.length === 0) return;
        
        const hit = intersects[0].object;
        if (hit && hit.userData) {
            const { qIndex, rIndex } = hit.userData;
            const path = this.findPath(this.player.q, this.player.r, qIndex, rIndex);
            if (path && path.length > 0) {
                path.shift();
                this.path = path;
                this.movingAlongPath = true;
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
    
    updateContextualUIs() {
        const contextualModes = ['mine', 'harvest', 'trade'];
        const isContextualUIActive = contextualModes.includes(this.ui.activeUIMode);
        const isOverlayUIActive = this.ui.activeUIMode && !isContextualUIActive;

        if (isOverlayUIActive || this.placementMode) {
            return;
        }

        const { mode: newMode, params } = this.determineContextualMode();
        if (newMode === this.ui.activeUIMode) return;

        if (isContextualUIActive) this.ui.hide();

        switch (newMode) {
            case 'mine':
                this.ui.showMining(params.q, params.r);
                break;
            case 'harvest':
                this.ui.showHarvest(params.q, params.r, params.treeMesh);
                break;
            case 'trade':
                const cityKey = `${params.cityQ},${params.cityR}`;
                this.initializeCityPrices(cityKey);
                this.ui.showTrade(cityKey, this.state.prices[cityKey]);
                break;
        }
    }
    
    determineContextualMode() {
        const q = this.player.q;
        const r = this.player.r;
        const currentHeight = this.world.getHeight(q, r);
        const dirs = [ { dq: 1, dr: 0 }, { dq: -1, dr: 0 }, { dq: 0, dr: 1 }, { dq: 0, dr: -1 }, { dq: 1, dr: -1 }, { dq: -1, dr: 1 } ];

        for (const dir of dirs) {
            const nq = q + dir.dq;
            const nr = r + dir.dr;
            const h = this.world.getHeight(nq, nr);
            if (h !== -Infinity && h - currentHeight >= 3) {
                return { mode: 'mine', params: { q: nq, r: nr } };
            }
        }

        const feat = (this.world.featureMap[r] && this.world.featureMap[r][q]) || 'none';
        if (feat === 'forest' && this.propsGroup) {
            const treeMesh = this.propsGroup.children.find(child =>
                child.userData?.type === 'forest' && child.userData.q === q && child.userData.r === r
            );
            if (treeMesh) return { mode: 'harvest', params: { q, r, treeMesh } };
        }

        for (const dir of [{dq:0, dr:0}, ...dirs]) {
            const nq = q + dir.dq;
            const nr = r + dir.dr;
            if (this.world.isInside(nq, nr)) {
                const featAt = (this.world.featureMap[nr] && this.world.featureMap[nr][nq]) || 'none';
                if (featAt === 'city') return { mode: 'trade', params: { cityQ: nq, cityR: nr } };
            }
        }
        
        return { mode: null, params: {} };
    }

    initializeCityPrices(cityKey) {
        if (this.state.prices[cityKey]) return;
        const allIds = Object.keys(ITEM_BASE_PRICES);
        const untradeable = ['cabin', 'stone_wall', 'wood_fence', 'ladder', 'bridge'];
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
        if (this.ui.activeUIMode === 'craft') this.ui.showCrafting();
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

    addItem(id, qty = 1) {
        const item = ITEMS[id];
        if (!item) return;
        let remaining = qty;
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
        for (let i = 0; i < this.state.inventory.length && remaining > 0; i++) {
            if (!this.state.inventory[i]) {
                const add = Math.min(item.stack, remaining);
                this.state.inventory[i] = { id, qty: add };
                remaining -= add;
            }
        }
    }

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

    hasItem(id, qty = 1) {
        let count = 0;
        this.state.inventory.forEach((slot) => {
            if (slot && slot.id === id) count += slot.qty;
        });
        return count >= qty;
    }

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
                this.ui.showNotification(`Your ${skillName} skill is capped at level ${skill.level}.`);
            }
        }
    }

    // --- NEW PLACEMENT LOGIC ---

    enterPlacementMode(recipeId) {
        if (!this.canCraft(recipeId)) {
            this.ui.showNotification("You don't have the resources or skill.");
            return;
        }
        this.placementMode = { recipeId };
        this.ui.hide();
        this.ui.showNotification(`Placing ${RECIPES[recipeId].name}. Click a valid spot. (ESC to cancel)`);
        this.updatePlacementHighlights();
    }

    exitPlacementMode() {
        this.placementMode = null;
        this.placementHighlights.clear();
        this.ui.showNotification("Placement cancelled.");
    }

    updatePlacementHighlights() {
        this.placementHighlights.clear();
        if (!this.placementMode) return;

        const { recipeId } = this.placementMode;
        const potentialSpots = this.findValidPlacementSpots(recipeId);

        potentialSpots.forEach(spot => {
            const highlightGeo = new THREE.CircleGeometry(this.world.radius * 0.8, 6);
            highlightGeo.rotateX(-Math.PI / 2);
            const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
            const mesh = new THREE.Mesh(highlightGeo, mat);

            const targetCoords = recipeId === 'bridge' ? spot.across : spot.to;
            const { x, z } = axialToWorld(targetCoords.q - this.world.boardRadius, targetCoords.r - this.world.boardRadius, this.world.radius);
            
            const h = this.world.getHeight(this.player.q, this.player.r);
            mesh.position.set(x, (h + 1) * this.world.hScale + 0.1, z);
            
            mesh.userData = { isHighlight: true, placementData: spot };
            this.placementHighlights.add(mesh);
        });
    }

    findValidPlacementSpots(recipeId) {
        const spots = [];
        const q = this.player.q;
        const r = this.player.r;
        const currentHeight = this.world.getHeight(q, r);
        const dirs = [ {dq:1,dr:0},{dq:-1,dr:0},{dq:0,dr:1},{dq:0,dr:-1},{dq:1,dr:-1},{dq:-1,dr:1} ];

        for (const dir of dirs) {
            const nq = q + dir.dq;
            const nr = r + dir.dr;
            if (!this.world.isInside(nq, nr)) continue;

            const rawTargetHeight = this.world.heightMap[nr][nq];

            if (recipeId === 'ladder') {
                const heightDiff = Math.abs(currentHeight - rawTargetHeight);
                if (heightDiff > 1 && heightDiff <= 4) {
                    const [from, to] = currentHeight < rawTargetHeight ? [{q,r}, {q:nq,r:nr}] : [{q:nq,r:nr}, {q,r}];
                    spots.push({ type: 'ladder', from, to });
                }
            }

            if (recipeId === 'bridge') {
                // MODIFIED: Allow building from land or another bridge
                const isStandingOnTraversable = this.world.blockMap[r]?.[q] !== 'water' || this.world.getStructure(q,r)?.type === 'bridge';

                if (isStandingOnTraversable) {
                    const isTargetWater = this.world.blockMap[nr]?.[nq] === 'water';
                    if (isTargetWater) {
                        // This spot is valid for starting a bridge.
                        // We don't require a far bank to show the highlight.
                        // The bridge will be one tile long for now, but this can be extended.
                         spots.push({ type: 'bridge', from: {q,r}, across: {q:nq, r:nr} });
                    }
                }
            }
        }
        return spots;
    }
    
    confirmPlacement(placementData) {
        const { recipeId } = this.placementMode;
        const rec = RECIPES[recipeId];

        Object.entries(rec.inputs).forEach(([id, qty]) => this.removeItem(id, qty));
        this.addXP(rec.skill, rec.xp);

        if (placementData.type === 'ladder') {
            this.world.addStructure(placementData.to.q, placementData.to.r, placementData);
            this.world.addStructure(placementData.from.q, placementData.from.r, placementData);
        } else if (placementData.type === 'bridge') {
            // Find the far bank to complete the bridge data
            const dir = { dq: placementData.across.q - placementData.from.q, dr: placementData.across.r - placementData.from.r };
            let landing = null;
            let current_q = placementData.across.q;
            let current_r = placementData.across.r;
            // Look ahead to find the next land tile
            for(let i=0; i<5; i++) { // Max bridge length of 5
                current_q += dir.dq;
                current_r += dir.dr;
                if(this.world.isInside(current_q, current_r) && this.world.blockMap[current_r]?.[current_q] !== 'water') {
                    landing = { q: current_q, r: current_r };
                    break;
                }
            }
            
            // If we found a landing spot, build the full bridge
            if(landing) {
                placementData.to = landing;
                // Add structure data for every water tile spanned
                let q = placementData.from.q;
                let r = placementData.from.r;
                while(q !== landing.q || r !== landing.r) {
                    q += dir.dq;
                    r += dir.dr;
                    if(this.world.blockMap[r]?.[q] === 'water') {
                        this.world.addStructure(q, r, placementData);
                         this.buildStructure(recipeId, { ...placementData, currentTile: {q, r} });
                    }
                }
            } else {
                // If no landing, just build one segment
                placementData.to = placementData.across; // Bridge leads nowhere for now
                this.world.addStructure(placementData.across.q, placementData.across.r, placementData);
                this.buildStructure(recipeId, { ...placementData, currentTile: placementData.across });
            }
        }
        
        this.ui.showNotification(`Built ${rec.name}!`);
        this.exitPlacementMode();
    }
    
    handleBuild(recId) {
        const rec = RECIPES[recId];
        if (!rec || rec.category !== 'build') return;
        
        if (recId === 'cabin' || recId === 'wood_fence' || recId === 'stone_wall') {
            if (!this.canCraft(recId)) {
                this.ui.showNotification("Cannot build this.");
                return;
            }
            Object.entries(rec.inputs).forEach(([id, qty]) => this.removeItem(id, qty));
            this.addXP(rec.skill, rec.xp);
            this.buildStructure(recId, { at: { q: this.player.q, r: this.player.r } });
            this.ui.showNotification(`Built ${rec.name}!`);
        } else {
            this.enterPlacementMode(recId);
        }
    }

    buildStructure(recId, placementData) {
        let mesh;
        if (recId === 'ladder') {
            mesh = new THREE.Group();
            const mat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
            const beamGeo = new THREE.BoxGeometry(0.1, 1, 0.1);
            
            const leftBeam = new THREE.Mesh(beamGeo, mat);
            leftBeam.position.x = -0.3;
            const rightBeam = new THREE.Mesh(beamGeo, mat);
            rightBeam.position.x = 0.3;
            mesh.add(leftBeam, rightBeam);

            const h_diff = Math.abs(this.world.heightMap[placementData.from.r][placementData.from.q] - this.world.heightMap[placementData.to.r][placementData.to.q]);
            const ladderHeight = h_diff * this.world.hScale + this.world.hScale * 0.5;
            leftBeam.scale.y = rightBeam.scale.y = ladderHeight;

            const rungCount = Math.floor(h_diff * 2);
            const rungGeo = new THREE.BoxGeometry(0.7, 0.08, 0.08);
            for(let i = 0; i <= rungCount; i++) {
                const rung = new THREE.Mesh(rungGeo, mat);
                rung.position.y = (i / (rungCount + 1) - 0.5) * ladderHeight;
                mesh.add(rung);
            }

            const fromWorld = axialToWorld(placementData.from.q - this.world.boardRadius, placementData.from.r - this.world.boardRadius, this.world.radius);
            const toWorld = axialToWorld(placementData.to.q - this.world.boardRadius, placementData.to.r - this.world.boardRadius, this.world.radius);
            
            const fromVec = new THREE.Vector3(fromWorld.x, (this.world.getHeight(placementData.from.q, placementData.from.r) + 0.5) * this.world.hScale, fromWorld.z);
            const toVec = new THREE.Vector3(toWorld.x, (this.world.getHeight(placementData.to.q, placementData.to.r) + 0.5) * this.world.hScale, toWorld.z);

            mesh.position.copy(fromVec).lerp(toVec, 0.5);
            
            // MODIFIED: Correctly lean the ladder towards the cliff
            const target = this.world.getHeight(placementData.from.q, placementData.from.r) < this.world.getHeight(placementData.to.q, placementData.to.r) ? toVec : fromVec;
            mesh.lookAt(target);
            mesh.rotation.x = Math.PI / 2 + 0.1; // Stand straighter

        } else if (recId === 'bridge') {
            // MODIFIED: New bridge model
            mesh = new THREE.Group();
            const plankMat = new THREE.MeshLambertMaterial({ color: 0x966F33 }); // Plank color
            const postMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b }); // Darker post color

            // Hexagonal plank top
            const topGeo = new THREE.CylinderGeometry(this.world.radius * 0.95, this.world.radius * 0.95, 0.15, 6);
            const topMesh = new THREE.Mesh(topGeo, plankMat);
            topMesh.rotation.y = Math.PI / 6;
            mesh.add(topMesh);

            const bridgeCoords = placementData.currentTile || placementData.across;
            const { x, z } = axialToWorld(bridgeCoords.q - this.world.boardRadius, bridgeCoords.r - this.world.boardRadius, this.world.radius);
            const h = this.world.getHeight(placementData.from.q, placementData.from.r);
            const bridgeY = (h + 1) * this.world.hScale - (this.world.hScale - 0.1);
            mesh.position.set(x, bridgeY, z);
            
            // Four support posts
            const postHeight = bridgeY; // From bridge deck to y=0 (water)
            const postGeo = new THREE.BoxGeometry(0.15, postHeight, 0.15);
            const postPositions = [
                new THREE.Vector3(0.5, -postHeight/2, 0.5),
                new THREE.Vector3(-0.5, -postHeight/2, 0.5),
                new THREE.Vector3(0.5, -postHeight/2, -0.5),
                new THREE.Vector3(-0.5, -postHeight/2, -0.5),
            ];
            postPositions.forEach(pos => {
                const post = new THREE.Mesh(postGeo, postMat);
                post.position.copy(pos);
                mesh.add(post);
            });


        } else if (recId === 'cabin') {
            mesh = new THREE.Group();
            const wallMat = new THREE.MeshLambertMaterial({ color: 0xb0b0b5 });
            [{ pos: [0.0, 0.0], scale: 1.2 }, { pos: [0.6, 0.4], scale: 0.8 }].forEach(({ pos, scale }) => {
                const [hx, hz] = pos;
                const baseGeo = new THREE.BoxGeometry(1.0 * scale, 0.6 * scale, 1.0 * scale);
                const baseMesh = new THREE.Mesh(baseGeo, wallMat);
                baseMesh.position.set(hx, 0.3 * scale, hz);
                mesh.add(baseMesh);
            });
        }
        
        if (mesh) {
            if (placementData.at) { // Place-at-feet
                const { q, r } = placementData.at;
                const { x, z } = axialToWorld(q - this.world.boardRadius, r - this.world.boardRadius, this.world.radius);
                const h = this.world.getHeight(q, r);
                mesh.position.set(x, (h + 1) * this.world.hScale, z);
                mesh.userData = { type: 'building', recId: recId, q: q, r: r };
            } else { // Interactive placement
                 const targetCoords = placementData.currentTile || placementData.across || placementData.from;
                 mesh.userData = { type: 'building', recId: recId, q: targetCoords.q, r: targetCoords.r };
            }
            this.propsGroup.add(mesh);
        }
    }


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
        this.ui.showTrade(cityKey, this.state.prices[cityKey]);
        if (this.ui.activeUIMode === 'inventory') this.ui.showInventory();
    }

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
        this.ui.showTrade(cityKey, this.state.prices[cityKey]);
        if (this.ui.activeUIMode === 'inventory') this.ui.showInventory();
    }

    startHarvest(action, q, r, treeMesh) {
        if (action === 'chop' && !this.hasItem('axe', 1)) {
            this.ui.showNotification('You need an axe to chop down a tree.');
            this.ui.showHarvest(q, r, treeMesh);
            return;
        }
        this.ui.hide();
        this.ui.showProgress('Harvesting', 2000, () => this.finishHarvest(action, q, r, treeMesh));
    }

    finishHarvest(action, q, r, treeMesh) {
        let id = (action === 'chop') ? 'rough_log' : 'branch';
        let qty = (action === 'chop') ? 1 : 2;
        this.addItem(id, qty);
        this.ui.showNotification(`You obtained ${qty} x ${ITEMS[id].name}!`);
    }

    startMining(q, r) {
        this.ui.hide();
        this.ui.showProgress('Mining', 2000, () => this.finishMining(q, r));
    }

    finishMining(q, r) {
        this.addItem('stone', 3);
        if (Math.random() < 0.2) {
            this.addItem('ore', 1);
            this.ui.showNotification('You mined 3 Stone and found an Ore!');
        } else {
            this.ui.showNotification('You mined 3 Stone.');
        }
    }
    
    findPath(q0, r0, q1, r1) {
      if (q0 === q1 && r0 === r1) return [];
      const heuristic = (q, r) => {
        const dq = Math.abs(q - q1), dr = Math.abs(r - r1), dSum = Math.abs(dq + dr);
        return Math.max(dq, dr, dSum);
      };
      const directions = [ { dq: 1, dr: 0 }, { dq: -1, dr: 0 }, { dq: 0, dr: 1 }, { dq: 0, dr: -1 }, { dq: 1, dr: -1 }, { dq: -1, dr: 1 } ];
      const open = [], openMap = {}, closed = {};
      const startNode = { q: q0, r: r0, g: 0, f: heuristic(q0, r0), parent: null };
      const hash = (q, r) => `${q},${r}`;
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
          const nq = current.q + dir.dq, nr = current.r + dir.dr;
          if (!this.world.isInside(nq, nr)) continue;

          let canTraverse = false;
          const h0 = this.world.getHeight(current.q, current.r);
          const h1 = this.world.getHeight(nq, nr);
          const raw_h1 = this.world.heightMap[nr][nq];

          const structure = this.world.getStructure(nq, nr) || this.world.getStructure(current.q, current.r);
          if (structure) {
              if (structure.type === 'ladder') {
                  const { from, to } = structure;
                  if ((from.q === current.q && from.r === current.r && to.q === nq && to.r === nr) ||
                      (to.q === current.q && to.r === current.r && from.q === nq && from.r === nr)) {
                      canTraverse = true;
                  }
              }
              if (structure.type === 'bridge') {
                  const { from, to } = structure;
                  const across = structure.across || {q: nq, r: nr}; // fallback for single bridges
                  if ((from.q === current.q && from.r === current.r && across.q === nq && across.r === nr) ||
                      (to && to.q === current.q && to.r === current.r && across.q === nq && across.r === nr) ||
                      ((across.q === current.q && across.r === current.r) && ((from.q === nq && from.r === nr) || (to && to.q === nq && to.r === nr)))) {
                      canTraverse = true;
                  }
              }
          }

          if (!canTraverse && raw_h1 !== -Infinity) {
              if (h1 - h0 <= 1 && h0 - h1 <= 2) {
                canTraverse = true;
              }
          }
          
          if (!canTraverse) continue;

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
        const hutConfigs = [ { pos: [0.0, 0.0], scale: 0.8 }, { pos: [0.5, 0.35], scale: 0.6 } ];
        hutConfigs.forEach(({ pos, scale }) => {
          const [hx, hz] = pos;
          const baseGeo = new THREE.BoxGeometry(1.0 * scale, 0.6 * scale, 1.0 * scale);
          const baseMesh = new THREE.Mesh(baseGeo, wallMat); baseMesh.position.set(hx, 0.3 * scale, hz);
          buildingFallback.add(baseMesh);
        });
      }
      return { forest: treeFallback, city: buildingFallback };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.init();
});
