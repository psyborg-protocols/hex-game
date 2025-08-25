import * as THREE from 'three';
import { CameraController } from './modules/camera_controller.js';
import { findPath } from './modules/pathfinding.js';
import { Actions } from './modules/actions.js';
import { ContextSystem } from './modules/context_system.js';
import { HexWorld, axialToWorld } from './modules/world_gen.js';
import { Player } from './modules/player.js';
import { UIController } from './modules/ui_controller.js';
import { ITEMS, ITEM_BASE_PRICES, RECIPES } from './modules/items_recipes_skills.js';
import { Y_AXIS } from './modules/constants.js';

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
        this.actions = new Actions(this);
        this.contextSystem = new ContextSystem(this);

        this.worldGroup = null;
        this.pickGroup = null;
        this.propsGroup = null;
        this.cameraController = null;
        this.clock = new THREE.Clock();

        this.state = {
            inventory: new Array(20).fill(null),
            gold: 50,
            skills: {
                woodworking: { level: 1, xp: 0 },
                stoneworking: { level: 1, xp: 0 },
                metalworking: { level: 1, xp: 0 }
            },
            cities: {}
        };

        this.path = [];
        this.movingAlongPath = false;
        this.currentSegment = null;
        this.speedTilesPerSec = 2.8;

        this.placementMode = null;
        this.placementHighlights = new THREE.Group();
        
        this.miningTarget = new THREE.Object3D();

        this.touchState = {
            isDragging: false,
            isPinching: false,
            lastPan: { x: 0, y: 0 },
            lastPinchDist: 0,
            tapTimeout: null,
            tapMaxDelay: 200,
            tapMaxDistance: 10,
            startTapPos: { x: 0, y: 0 },
        };
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
        const seedEl = document.getElementById('seed-display');
        if (seedEl) seedEl.textContent = `Seed: ${seed}`;

        this.world = new HexWorld({
            boardRadius: 40, radius: 0.85, hScale: 0.5,
            maxHeight: 20, noiseScale: 0.08, seed: seed,
        });

        this.world.generateBase();
        this.world.addMountains(3);
        this.world.carveRiver();
        this.world.carveCliffWithRamp();
        this.world.assignBlocks();
        this.world.assignFeatures();

        const spawnPoint = this.world.findPlayerSpawn();

        this.worldGroup = this.world.buildMesh(BLOCK_TEXTURES);
        this.scene.add(this.worldGroup);
        if (this.world.pickGroup) {
            this.pickGroup = this.world.pickGroup;
            this.pickGroup.visible = false;
            this.scene.add(this.pickGroup);
        }

        this.scene.add(this.placementHighlights);
        this.scene.add(this.miningTarget);

        this.player = new Player(this.world, this.scene);
        
        this.player.q = spawnPoint.q;
        this.player.r = spawnPoint.r;
        this.player.updatePosition();
        
        this.cameraController = new CameraController(this.camera, this.player.mesh);

        const models = await this.loadPropModels();
        this.propsGroup = this.world.buildProps(models);
        this.scene.add(this.propsGroup);

        this.addEventListeners();
        this.animate();
    }

    addEventListeners() {
        window.addEventListener('resize', () => this.onResize());
        window.addEventListener('keydown', (e) => this.onKeyDown(e));
        window.addEventListener('keyup', (e) => this.onKeyUp(e));
        this.renderer.domElement.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.renderer.domElement.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });

        this.renderer.domElement.addEventListener('touchstart', (e) => this.onTouchStart(e), { passive: false });
        this.renderer.domElement.addEventListener('touchmove', (e) => this.onTouchMove(e), { passive: false });
        this.renderer.domElement.addEventListener('touchend', (e) => this.onTouchEnd(e), { passive: false });

        const byId = (id) => document.getElementById(id);
        byId('inventory-btn')?.addEventListener('click', () => this.ui.toggle('inventory', () => this.ui.showInventory()));
        byId('craft-btn')?.addEventListener('click', () => this.ui.toggle('craft', () => this.ui.showCrafting()));
        byId('skills-btn')?.addEventListener('click', () => this.ui.toggle('skills', () => this.ui.showSkills()));
        byId('build-btn')?.addEventListener('click', () => this.ui.toggle('build', () => this.ui.showBuilding()));
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    onKeyDown(event) {
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
            'arrowleft': () => this.cameraController?.handleKeyDown('arrowleft'),
            'arrowright': () => this.cameraController?.handleKeyDown('arrowright'),
            'arrowup': () => this.cameraController?.handleKeyDown('arrowup'),
            'arrowdown': () => this.cameraController?.handleKeyDown('arrowdown'),
        };
        if (keyMap[key]) {
            keyMap[key]();
            event.preventDefault();
        }
    }

    onKeyUp(event) {
        const key = event.key.toLowerCase();
        const keyMap = {
            'arrowleft': () => this.cameraController?.handleKeyUp('arrowleft'),
            'arrowright': () => this.cameraController?.handleKeyUp('arrowright'),
            'arrowup': () => this.cameraController?.handleKeyUp('arrowup'),
            'arrowdown': () => this.cameraController?.handleKeyUp('arrowdown'),
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
        this.handleTileClick(mouse);
    }

    handleTileClick(coords) {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(coords, this.camera);

        if (this.placementMode) {
            const intersects = raycaster.intersectObjects(this.placementHighlights.children);
            if (intersects.length > 0) {
                const highlight = intersects[0].object;
                if (highlight.userData.isHighlight) {
                    this.confirmPlacement(highlight.userData.placementData);
                }
            }
            return;
        }

        const intersects = this.pickGroup ? raycaster.intersectObjects(this.pickGroup.children, true) : [];
        if (intersects.length === 0) return;

        const hit = intersects[0].object;
        if (hit?.userData) {
            const { qIndex, rIndex } = hit.userData;
            const path = findPath(this.world, this.player, qIndex, rIndex);
            if (path && path.length > 0) {
                path.shift();
                this.startPath(path);
            }
        }
    }

    onWheel(event) {
        event.preventDefault();
        this.cameraController?.handleWheel(event.deltaY);
    }

    onTouchStart(event) {
        event.preventDefault();
        clearTimeout(this.touchState.tapTimeout);

        if (event.touches.length === 1) {
            this.touchState.isDragging = true;
            this.touchState.lastPan = { x: event.touches[0].clientX, y: event.touches[0].clientY };
            this.touchState.startTapPos = { x: event.touches[0].clientX, y: event.touches[0].clientY };
            this.touchState.tapTimeout = setTimeout(() => {
                clearTimeout(this.touchState.tapTimeout);
                this.touchState.tapTimeout = null;
            }, this.touchState.tapMaxDelay);
        } else if (event.touches.length === 2) {
            this.touchState.isDragging = false;
            this.touchState.isPinching = true;
            const dx = event.touches[0].clientX - event.touches[1].clientX;
            const dy = event.touches[0].clientY - event.touches[1].clientY;
            this.touchState.lastPinchDist = Math.sqrt(dx * dx + dy * dy);
        }
    }

    onTouchMove(event) {
        event.preventDefault();
        if (this.touchState.isDragging && event.touches.length === 1) {
            const deltaX = event.touches[0].clientX - this.touchState.lastPan.x;
            this.cameraController?.handlePan(deltaX);
            this.touchState.lastPan = { x: event.touches[0].clientX, y: event.touches[0].clientY };
        } else if (this.touchState.isPinching && event.touches.length === 2) {
            const dx = event.touches[0].clientX - event.touches[1].clientX;
            const dy = event.touches[0].clientY - event.touches[1].clientY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const zoomFactor = this.touchState.lastPinchDist / dist;
            this.cameraController?.handlePinch(zoomFactor);
            this.touchState.lastPinchDist = dist;
        }
    }

    onTouchEnd(event) {
        event.preventDefault();
        if (this.touchState.tapTimeout) {
            clearTimeout(this.touchState.tapTimeout);
            this.touchState.tapTimeout = null;
            const endPos = this.touchState.lastPan;
            const dist = Math.sqrt(
                Math.pow(endPos.x - this.touchState.startTapPos.x, 2) +
                Math.pow(endPos.y - this.touchState.startTapPos.y, 2)
            );
            if (dist < this.touchState.tapMaxDistance) {
                if (this.ui.uiEl?.contains(event.target)) return;
                const rect = this.renderer.domElement.getBoundingClientRect();
                const touchCoords = new THREE.Vector2(
                    ((endPos.x - rect.left) / rect.width) * 2 - 1,
                    -((endPos.y - rect.top) / rect.height) * 2 + 1
                );
                this.handleTileClick(touchCoords);
            }
        }
        this.touchState.isDragging = false;
        this.touchState.isPinching = false;
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const delta = this.clock.getDelta();
        this.cameraController?.update();
        this.ui?.update(this.camera);
        this.updateMovement(delta);
        this.updateContextualUIs();
        this.renderer.render(this.scene, this.camera);
    }

    startPath(path) {
        this.path = path.slice();
        this.movingAlongPath = this.path.length > 0;
        this.currentSegment = null;
        if (this.movingAlongPath) this.beginNextSegment();
    }

    beginNextSegment() {
        if (!this.path.length) {
            this.movingAlongPath = false;
            this.currentSegment = null;
            return;
        }
        const next = this.path.shift();
        const from = { q: this.player.q, r: this.player.r };
        const to = { q: next.q, r: next.r };

        const start = this.axialToWorldWithHeight(from.q, from.r);
        const end = this.axialToWorldWithHeight(to.q, to.r);

        const horizontal = new THREE.Vector3(start.x, 0, start.z).distanceTo(new THREE.Vector3(end.x, 0, end.z));
        const vertical = Math.abs(end.y - start.y) / this.world.hScale;
        const distanceTiles = Math.sqrt(horizontal * horizontal + vertical * vertical) / (this.world.radius * 1.0);
        const tiles = Math.max(0.75, Math.min(1.5, distanceTiles));
        const duration = tiles / this.speedTilesPerSec;

        const dir = new THREE.Vector3(end.x - start.x, 0, end.z - start.z);
        if (dir.lengthSq() > 1e-6) {
            this.player.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        }

        this.currentSegment = { from, to, start, end, t: 0, duration };
    }

    axialToWorldWithHeight(q, r) {
        const { x, z } = axialToWorld(q - this.world.boardRadius, r - this.world.boardRadius, this.world.radius);
        const h = this.world.getHeight(q, r);
        const y = (h + 1) * this.world.hScale;
        return { x, y, z };
    }

    easeInOut(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    updateMovement(delta) {
        if (!this.movingAlongPath || !this.currentSegment) return;
        const seg = this.currentSegment;
        seg.t += (delta / seg.duration);
        const t = Math.min(1, this.easeInOut(seg.t));
        const x = THREE.MathUtils.lerp(seg.start.x, seg.end.x, t);
        const y = THREE.MathUtils.lerp(seg.start.y, seg.end.y, t);
        const z = THREE.MathUtils.lerp(seg.start.z, seg.end.z, t);
        this.player.mesh.position.set(x, y, z);
        if (seg.t >= 1) {
            this.player.q = seg.to.q;
            this.player.r = seg.to.r;
            if (this.path.length > 0) {
                this.beginNextSegment();
            } else {
                this.movingAlongPath = false;
                this.currentSegment = null;
            }
        }
    }
    
    updateContextualUIs() {
        const isOverlayUIActive = this.ui.activeUIMode && !['mine', 'harvest', 'trade'].includes(this.ui.activeUIMode);
        if (isOverlayUIActive || this.placementMode) {
            this.ui.hideAllWorldspaceUIs();
            return;
        }

        const availableContexts = this.contextSystem.determine();

        const getTargetKey = (ctx) => {
            if (!ctx) return null;
            if (ctx.mode === 'mine') return `mine-${ctx.params.q},${ctx.params.r}`;
            if (ctx.mode === 'harvest') return `harvest-${ctx.params.treeMesh.uuid}`;
            if (ctx.mode === 'trade') return `trade-${ctx.params.cityQ},${ctx.params.cityR}`;
            return null;
        };

        const newKeys = new Set(availableContexts.map(getTargetKey));
        const currentKeys = new Set(this.ui.activeWorldspaceUIs.map(ui => ui.key));

        this.ui.activeWorldspaceUIs.forEach(ui => {
            if (!newKeys.has(ui.key)) {
                this.ui.hideWorldspaceUI(ui.id);
            }
        });

        availableContexts.forEach(ctx => {
            const key = getTargetKey(ctx);
            if (!currentKeys.has(key)) {
                let title = '';
                let actions = [];
                let targetObject = null;

                switch (ctx.mode) {
                    case 'mine': {
                        const { x, z } = axialToWorld(ctx.params.q - this.world.boardRadius, ctx.params.r - this.world.boardRadius, this.world.radius);
                        const y = (this.world.getHeight(ctx.params.q, ctx.params.r)) * this.world.hScale;
                        this.miningTarget.position.set(x, y + this.world.hScale, z);
                        targetObject = this.miningTarget;
                        const actionLabel = ctx.params.tool === 'pickaxe' ? 'Mine' : 'Quarry';
                        title = `${actionLabel} Cliff`;
                        actions = [{ label: actionLabel, callback: () => this.actions.startMining(ctx.params.q, ctx.params.r, ctx.params.tool) }];
                        break;
                    }
                    case 'harvest': {
                        targetObject = ctx.params.treeMesh;
                        title = 'Harvest Tree';
                        actions = [
                            { label: 'Chop', callback: () => this.actions.startHarvest('chop', ctx.params.q, ctx.params.r, ctx.params.treeMesh) },
                            { label: 'Gather', callback: () => this.actions.startHarvest('branch', ctx.params.q, ctx.params.r, ctx.params.treeMesh) }
                        ];
                        break;
                    }
                    case 'trade': {
                        const cityKey = `${ctx.params.cityQ},${ctx.params.cityR}`;
                        this.initializeCityData(cityKey);
                        targetObject = this.propsGroup.children.find(c => c.userData.type === 'city' && c.userData.q === ctx.params.cityQ && c.userData.r === ctx.params.cityR);
                        if (targetObject) {
                            title = 'Village Market';
                            actions = [{ label: 'Trade', callback: () => this.ui.showTrade(cityKey) }];
                        }
                        break;
                    }
                }

                if (targetObject && title) {
                    this.ui.showWorldspaceUI(targetObject, title, actions, key);
                }
            }
        });
    }

    initializeCityData(cityKey) {
        if (this.state.cities[cityKey]) return;

        const allIds = Object.keys(ITEM_BASE_PRICES);
        const untradeable = ['cabin', 'stone_wall', 'wood_fence', 'ladder', 'bridge', 'oven', 'forge', 'whetstone'];
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

        const potentialTools = ['saw', 'whetstone', 'forge', 'tongs', 'axe', 'chisel'];
        const numTools = 2 + Math.floor(Math.random() * 2);
        const rentableTools = potentialTools.slice().sort(() => 0.5 - Math.random()).slice(0, numTools);

        this.state.cities[cityKey] = {
            prices: prices,
            rentableTools: rentableTools
        };
    }
    
    getPlayerCurrentCity() {
        const q = this.player.q;
        const r = this.player.r;
        const feature = this.world.featureMap[r]?.[q];
        if (feature?.type === 'city') {
            const cityKey = `${q},${r}`;
            this.initializeCityData(cityKey);
            return { key: cityKey, data: this.state.cities[cityKey] };
        }
        return null;
    }

    enterPlacementMode(recipeId) {
        if (!this.actions.canCraft(recipeId).canCraft) {
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
            let mesh;
            const mat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5, side: THREE.DoubleSide });

            if (recipeId === 'ladder') {
                const fromH = this.world.getHeight(spot.from.q, spot.from.r);
                const toH = this.world.getHeight(spot.to.q, spot.to.r);
                const h_diff = Math.abs(fromH - toH);

                const highlightGeo = new THREE.PlaneGeometry(this.world.radius * 0.8, h_diff * this.world.hScale);
                mesh = new THREE.Mesh(highlightGeo, mat);

                const fromWorld = axialToWorld(spot.from.q - this.world.boardRadius, spot.from.r - this.world.boardRadius, this.world.radius);
                const toWorld = axialToWorld(spot.to.q - this.world.boardRadius, spot.to.r - this.world.boardRadius, this.world.radius);

                const fromVec = new THREE.Vector3(fromWorld.x, (fromH + 1) * this.world.hScale, fromWorld.z);
                const toVec = new THREE.Vector3(toWorld.x, (toH + 1) * this.world.hScale, toWorld.z);

                mesh.position.copy(fromVec).lerp(toVec, 0.5);

                const playerPos = axialToWorld(this.player.q - this.world.boardRadius, this.player.r - this.world.boardRadius, this.world.radius);
                mesh.lookAt(new THREE.Vector3(playerPos.x, mesh.position.y, playerPos.z));

            } else {
                const highlightGeo = new THREE.CircleGeometry(this.world.radius * 0.8, 6);
                highlightGeo.rotateX(-Math.PI / 2);
                mesh = new THREE.Mesh(highlightGeo, mat);

                const targetCoords = recipeId === 'bridge' ? spot.across : spot.to;
                const { x, z } = axialToWorld(targetCoords.q - this.world.boardRadius, targetCoords.r - this.world.boardRadius, this.world.radius);
                const h = this.world.getHeight(this.player.q, this.player.r);
                mesh.position.set(x, (h + 1) * this.world.hScale + 0.1, z);
            }

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
                const isStandingOnTraversable = this.world.blockMap[r]?.[q] !== 'water' || this.world.getStructure(q,r)?.type === 'bridge';
                if (isStandingOnTraversable) {
                    const isTargetWater = this.world.blockMap[nr]?.[nq] === 'water';
                    if (isTargetWater) {
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

        Object.entries(rec.inputs).forEach(([id, qty]) => this.actions.removeItem(id, qty));
        this.actions.addXP(rec.skill, rec.xp);

        if (placementData.type === 'ladder') {
            this.world.addStructure(placementData.to.q, placementData.to.r, placementData);
            this.world.addStructure(placementData.from.q, placementData.from.r, placementData);
            this.buildStructure('ladder', placementData);
        } else if (placementData.type === 'bridge') {
            const dir = { dq: placementData.across.q - placementData.from.q, dr: placementData.across.r - placementData.from.r };
            let landing = null;
            let current_q = placementData.across.q;
            let current_r = placementData.across.r;
            for(let i=0; i<5; i++) {
                current_q += dir.dq;
                current_r += dir.dr;
                if(this.world.isInside(current_q, current_r) && this.world.blockMap[current_r]?.[current_q] !== 'water') {
                    landing = { q: current_q, r: current_r };
                    break;
                }
            }

            if(landing) {
                placementData.to = landing;
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
                placementData.to = placementData.across;
                this.world.addStructure(placementData.across.q, placementData.across.r, placementData);
                this.buildStructure(recipeId, { ...placementData, currentTile: placementData.across });
            }
        }

        this.ui.showNotification(`Built ${rec.name}!`);
        this.exitPlacementMode();
    }

    buildStructure(recId, placementData) {
        let mesh;
        const infrastructure = ['oven', 'forge', 'whetstone'];

        if (recId === 'ladder') {
            mesh = new THREE.Group();
            const mat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });

            const fromH = this.world.getHeight(placementData.from.q, placementData.from.r);
            const toH   = this.world.getHeight(placementData.to.q,   placementData.to.r);

            const fromWorld = axialToWorld(placementData.from.q - this.world.boardRadius, placementData.from.r - this.world.boardRadius, this.world.radius);
            const toWorld   = axialToWorld(placementData.to.q   - this.world.boardRadius, placementData.to.r   - this.world.boardRadius, this.world.radius);

            const fromCenter = new THREE.Vector3(fromWorld.x, (fromH + 1) * this.world.hScale, fromWorld.z);
            const toCenter = new THREE.Vector3(toWorld.x, (toH + 1) * this.world.hScale, toWorld.z);

            const centerDirection = new THREE.Vector3().subVectors(toCenter, fromCenter);
            centerDirection.y = 0;
            centerDirection.normalize();

            const edgeOffset = this.world.radius * 0.7;
            const startPoint = fromCenter.clone().add(centerDirection.clone().multiplyScalar(edgeOffset));
            const endPoint = toCenter.clone().sub(centerDirection.clone().multiplyScalar(edgeOffset));

            startPoint.y = (fromH + 1) * this.world.hScale;
            endPoint.y = (toH + 1) * this.world.hScale;

            const direction = new THREE.Vector3().subVectors(endPoint, startPoint);
            const length = direction.length();
            if (length < 0.5) return;

            const beamGeo = new THREE.BoxGeometry(0.15, length, 0.15);
            const leftBeam = new THREE.Mesh(beamGeo, mat);
            const rightBeam = new THREE.Mesh(beamGeo, mat);

            leftBeam.position.set(-0.25, 0, 0);
            rightBeam.position.set(0.25, 0, 0);

            mesh.add(leftBeam, rightBeam);

            const rungCount = Math.max(3, Math.floor(length * 1.5));
            const rungMat = new THREE.MeshLambertMaterial({ color: 0x9b6b3a });

            for (let i = 0; i < rungCount; i++) {
                const rung = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.1, 0.1), rungMat);
                const t = (i + 1) / (rungCount + 1);
                rung.position.set(0, (t - 0.5) * length, 0);
                mesh.add(rung);
            }

            const midPoint = new THREE.Vector3().addVectors(startPoint, endPoint).multiplyScalar(0.5);
            mesh.position.copy(midPoint);
            mesh.up.copy(direction.clone().normalize());
            const lookTarget = new THREE.Vector3().subVectors(midPoint, centerDirection);
            mesh.lookAt(lookTarget);

        } else if (recId === 'bridge') {
            mesh = new THREE.Group();
            const plankMat = new THREE.MeshLambertMaterial({ color: 0x966F33 });
            const postMat = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });

            const topGeo = new THREE.CylinderGeometry(this.world.radius * 0.95, this.world.radius * 0.95, 0.15, 6);
            const topMesh = new THREE.Mesh(topGeo, plankMat);
            topMesh.rotation.y = Math.PI / 6;
            mesh.add(topMesh);

            const bridgeCoords = placementData.currentTile || placementData.across;
            const { x, z } = axialToWorld(bridgeCoords.q - this.world.boardRadius, bridgeCoords.r - this.world.boardRadius, this.world.radius);
            const h = this.world.getHeight(placementData.from.q, placementData.from.r);
            const bridgeY = (h + 1) * this.world.hScale - (this.world.hScale - 0.1);
            mesh.position.set(x, bridgeY, z);

            const postHeight = bridgeY;
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

        } else if (recId === 'cabin' || recId === 'stone_house') {
            mesh = new THREE.Group();
            const wallMat = new THREE.MeshLambertMaterial({ color: 0xb0b0b5 });
            [{ pos: [0.0, 0.0], scale: 1.2 }, { pos: [0.6, 0.4], scale: 0.8 }].forEach(({ pos, scale }) => {
                const [hx, hz] = pos;
                const baseGeo = new THREE.BoxGeometry(1.0 * scale, 0.6 * scale, 1.0 * scale);
                const baseMesh = new THREE.Mesh(baseGeo, wallMat);
                baseMesh.position.set(hx, 0.3 * scale, hz);
                mesh.add(baseMesh);
            });
        } else if (infrastructure.includes(recId)) {
            mesh = new THREE.Group();
            const color = recId === 'oven' ? 0x666666 : recId === 'forge' ? 0x444444 : 0xAAAAAA;
            const mat = new THREE.MeshLambertMaterial({ color: color });
            const baseGeo = new THREE.BoxGeometry(0.8, 0.6, 0.8);
            const base = new THREE.Mesh(baseGeo, mat);
            base.position.y = 0.3;
            mesh.add(base);
        }

        if (mesh) {
            if (placementData.at) {
                const { q, r } = placementData.at;
                const { x, z } = axialToWorld(q - this.world.boardRadius, r - this.world.boardRadius, this.world.radius);
                const h = this.world.getHeight(q, r);
                mesh.position.set(x, (h + 1) * this.hScale, z);
                
                const structureData = { type: 'building', recId: recId, q: q, r: r };
                mesh.userData = structureData;
                this.world.addStructure(q, r, structureData);

                const feature = this.world.featureMap[r]?.[q];
                if (infrastructure.includes(recId) && feature?.type === 'city') {
                    const cityKey = `${q},${r}`;
                    this.initializeCityData(cityKey);
                    const city = this.state.cities[cityKey];
                    if (!city.rentableTools.includes(recId)) {
                        city.rentableTools.push(recId);
                    }
                }
            } else {
                const targetCoords = placementData.currentTile || placementData.across || placementData.from;
                mesh.userData = { type: 'building', recId: recId, q: targetCoords.q, r: targetCoords.r };
            }
            this.propsGroup.add(mesh);
        }
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
        
        const darkTreeFallback = new THREE.Group();
        {
            const trunk = new THREE.CylinderGeometry(0.15, 0.15, 1.0, 8);
            const leaves = new THREE.ConeGeometry(0.6, 1.5, 8);
            const mTrunk = new THREE.MeshLambertMaterial({ color: 0x5D4037 });
            const mLeaves = new THREE.MeshLambertMaterial({ color: 0x1B5E20 });
            const trunkMesh = new THREE.Mesh(trunk, mTrunk); trunkMesh.position.y = 0.5;
            const leavesMesh = new THREE.Mesh(leaves, mLeaves); leavesMesh.position.y = 1.4;
            darkTreeFallback.add(trunkMesh, leavesMesh);
        }


        const buildingFallback = new THREE.Group();
        {
            const wallMat = new THREE.MeshLambertMaterial({ color: 0xd2b48c });
            const roofMat = new THREE.MeshLambertMaterial({ color: 0x8b4513 });
            const hutConfigs = [
                { pos: [-0.3, 0.3], scale: 0.5, rot: 0.3 },
                { pos: [0.4, 0.4], scale: 0.6, rot: -0.2 },
                { pos: [0.1, -0.35], scale: 0.55, rot: 0.8 },
            ];
            hutConfigs.forEach(({ pos, scale, rot }) => {
                const hut = new THREE.Group();
                const [hx, hz] = pos;
                const baseHeight = 0.5 * scale;
                const baseGeo = new THREE.BoxGeometry(0.8 * scale, baseHeight, 0.9 * scale);
                const baseMesh = new THREE.Mesh(baseGeo, wallMat);
                baseMesh.position.y = baseHeight / 2;
                const roofHeight = 0.6 * scale;
                const roofGeo = new THREE.CylinderGeometry(0, 0.7 * scale, roofHeight, 4);
                const roofMesh = new THREE.Mesh(roofGeo, roofMat);
                roofMesh.position.y = baseHeight + roofHeight / 2;
                roofMesh.rotation.y = Math.PI / 4;
                hut.add(baseMesh, roofMesh);
                hut.position.set(hx, 0, hz);
                hut.rotation.y = rot;
                buildingFallback.add(hut);
            });
        }
        return { forest: treeFallback, city: buildingFallback, dark_forest: darkTreeFallback };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const game = new Game();
    game.init();
});
