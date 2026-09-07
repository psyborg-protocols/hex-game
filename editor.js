// Default hardcoded list in case auto-discovery fails
let imageNames = [
    "Tiles_DecorNoTrees", "Tiles_DecorOak", "Tiles_DecorPine",
    "Tiles_FarmingBase", "Tiles_FarmingCabbage", "Tiles_FarmingPumpkins", "Tiles_FarmingTomatos",
    "Tiles_GrassBase1", "Tiles_GrassBase2", "Tiles_GrassBase3",
    "Tiles_LakeBase", "Tiles_LakeSidesFour", "Tiles_LakeSidesOne", "Tiles_LakeSidesThree", "Tiles_LakeSidesTwo",
    "Tiles_PathBranchCrossLeft", "Tiles_PathBranchCrossRight", "Tiles_PathCrosses", "Tiles_PathEnd", 
    "Tiles_PathSmallCorner", "Tiles_PathWideCorner", "Tiles_PathsStraight"
];

let paletteTypes = [
    { id: "Path", name: "Path", type: "autotile_path" },
    { id: "Lake", name: "Lake", type: "autotile_lake" }
];

let selectedPaletteId = null;
let config = null;
const images = {};
let mapData = new Map(); // key: "q,r,h", value: { id: paletteId, sprite: string, frame: number }

let camX = 0;
let camY = 0;
let isPanning = false;
let panStartX = 0, panStartY = 0;

let isDrawing = false;
let isErasing = false;
let lastPaintedHex = null; 

const canvas = document.getElementById("view");
const ctx = canvas.getContext("2d");

let mouseX = 0;
let mouseY = 0;
let hoveredHex = null; 

let SCALE = 4; // Zoom scale

async function autoDiscoverTiles() {
    try {
        const res = await fetch('new_tiles/');
        if (res.ok) {
            const html = await res.text();
            const matches = [...html.matchAll(/href="([^"]+\.png)"/g)];
            if (matches.length > 0) {
                const foundNames = matches.map(m => m[1].replace('.png', '').split('/').pop());
                const set = new Set([...imageNames, ...foundNames]);
                imageNames = Array.from(set);
                console.log("Auto-discovered tiles:", imageNames);
            }
        }
    } catch (e) {
        console.warn("Could not auto-discover tiles (this is normal if your server doesn't provide directory listings). Using hardcoded list.");
    }
}

async function init() {
    const res = await fetch('new_tiles/index.json');
    config = await res.json();

    await autoDiscoverTiles();

    const loadPromises = imageNames.map(name => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = `new_tiles/${name}.png`;
            img.onload = () => {
                images[name] = img;
                resolve();
            };
            img.onerror = () => {
                console.warn(`Failed to load ${name}.png`);
                resolve(); 
            };
        });
    });
    await Promise.all(loadPromises);

    buildPalette();
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    setupInput();

    requestAnimationFrame(render);
}

function buildPalette() {
    const paletteContainer = document.getElementById("palette");
    paletteContainer.innerHTML = "";

    // Group non-autotile images by prefix
    const sets = {};
    imageNames.forEach(name => {
        if (name.includes("Path") || name.includes("Lake")) return;
        
        const match = name.match(/^Tiles_([A-Z][a-z]+)/);
        const prefix = match ? match[1] : name;
        
        if (!sets[prefix]) sets[prefix] = [];
        sets[prefix].push(name);
    });

    Object.keys(sets).forEach(setName => {
        paletteTypes.push({
            id: setName, 
            name: setName, 
            type: "random", 
            bases: sets[setName]
        });
    });

    if (!selectedPaletteId && paletteTypes.length > 0) {
        // Default to the first generated set (e.g. Grass) or the first palette item
        const defaultSet = paletteTypes.find(p => p.id === "Grass") || paletteTypes[0];
        selectedPaletteId = defaultSet.id;
    }

    paletteTypes.forEach(p => {
        const item = document.createElement("div");
        item.className = "palette-item" + (p.id === selectedPaletteId ? " selected" : "");
        item.dataset.id = p.id;

        const icon = document.createElement("div");
        icon.className = "palette-icon";
        let iconImg = "";
        if (p.type === "static") iconImg = p.base;
        else if (p.type === "random") iconImg = p.bases[0];
        else if (p.id === "Path") iconImg = "Tiles_PathCrosses";
        else if (p.id === "Lake") iconImg = "Tiles_LakeBase";

        if (iconImg && images[iconImg]) {
            icon.style.backgroundImage = `url(new_tiles/${iconImg}.png)`;
        }

        const text = document.createElement("span");
        text.innerText = p.name;

        item.appendChild(icon);
        item.appendChild(text);

        item.addEventListener('click', () => {
            document.querySelectorAll(".palette-item").forEach(el => el.classList.remove("selected"));
            item.classList.add("selected");
            selectedPaletteId = p.id;
        });

        paletteContainer.appendChild(item);
    });
}

function resizeCanvas() {
    const container = document.getElementById("canvas-container");
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    ctx.imageSmoothingEnabled = false;
}

// Flat-top, odd-q neighbors mapping
// edgeOrder: ["N", "NE", "SE", "S", "SW", "NW"]
const oddQDirs = [
    [ [0, -1], [1, -1], [1, 0], [0, 1], [-1, 0], [-1, -1] ], // even q
    [ [0, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0] ]  // odd q
];

function getNeighbors(q, r) {
    const parity = Math.abs(q) % 2;
    return oddQDirs[parity].map(d => ({ q: q + d[0], r: r + d[1] }));
}

function getMask(q, r, h, paletteId, isLakeByLand) {
    const neighbors = getNeighbors(q, r);
    let mask = 0;
    neighbors.forEach((n, i) => {
        const key = `${n.q},${n.r},${h}`;
        const neighbor = mapData.get(key);
        let condition = false;

        if (isLakeByLand) {
            condition = !neighbor || neighbor.id !== "Lake";
        } else {
            condition = neighbor && neighbor.id === paletteId;
        }

        if (condition) {
            mask |= (1 << i);
        }
    });
    return mask;
}

function updateAutoTiling(changedQ, changedR, h) {
    const coordsToCheck = [{q: changedQ, r: changedR}, ...getNeighbors(changedQ, changedR)];
    
    coordsToCheck.forEach(c => {
        const key = `${c.q},${c.r},${h}`;
        const tile = mapData.get(key);
        if (!tile) return;

        const pType = paletteTypes.find(p => p.id === tile.id);
        if (!pType) return;
        
        if (pType.type === "autotile_path") {
            const mask = getMask(c.q, c.r, h, tile.id, false);
            const mapping = config.pathByMask[mask] || ["Tiles_PathEnd", 0];
            tile.sprite = mapping[0];
            tile.frame = mapping[1];
        } else if (pType.type === "autotile_lake") {
            const mask = getMask(c.q, c.r, h, tile.id, true);
            const mapping = config.lakeByLandMask[mask];
            if (mapping) {
                tile.sprite = mapping[0];
                tile.frame = mapping[1];
            } else {
                tile.sprite = "Tiles_LakeBase";
                const img = images["Tiles_LakeBase"];
                if (img && img.width > 32) {
                    const numFrames = Math.floor(img.width / 32);
                    // Only randomize if it's currently on a non-LakeBase sprite or out of bounds
                    if (tile.sprite !== "Tiles_LakeBase" || tile.frame >= numFrames) {
                        tile.frame = Math.floor(Math.random() * numFrames);
                    }
                } else {
                    tile.frame = 0;
                }
            }
        }
    });
}

function getTileCenter(q, r, h) {
    const stepX = config.layout.stepX; // 26
    const stepY = config.layout.stepY; // 24
    const oddY = config.layout.oddColumnOffsetY; // 12
    const hw = config.frame.width / 2; // 16
    const topFaceY = config.topFace.top; // 16
    const hh = config.topFace.height / 2; // 12
    const wallH = config.wallHeight; // 8

    let cx = q * stepX + hw;
    let cy = r * stepY + (Math.abs(q) % 2 === 1 ? oddY : 0) + topFaceY + hh - (h * wallH);
    return { cx, cy };
}

function findHoveredHex(mx, my) {
    const candidates = [];
    
    const stepX = config.layout.stepX;
    const stepY = config.layout.stepY;
    const approxQ = Math.round((mx - camX) / stepX);
    const approxR = Math.round((my - camY) / stepY);

    for (let q = approxQ - 2; q <= approxQ + 2; q++) {
        for (let r = approxR - 2; r <= approxR + 2; r++) {
            let maxH = -1;
            for (let h = 0; h < 20; h++) {
                if (mapData.has(`${q},${r},${h}`)) maxH = h;
            }
            const hitH = Math.max(0, maxH);
            const center = getTileCenter(q, r, hitH);
            candidates.push({ q, r, h: maxH, cx: center.cx + camX, cy: center.cy + camY });
        }
    }

    candidates.sort((a, b) => {
        if (a.r !== b.r) return b.r - a.r;
        return b.h - a.h;
    });

    for (let c of candidates) {
        if (pointInHex(mx, my, c.cx, c.cy)) {
            return { q: c.q, r: c.r, topH: c.h };
        }
    }
    return null;
}

function pointInHex(px, py, cx, cy) {
    const dx = Math.abs(px - cx);
    const dy = Math.abs(py - cy);
    if (dx > 16 || dy > 12) return false;
    if (dx > 10) {
        if (dy > -2 * (dx - 16)) return false;
    }
    return true;
}

function applyPaint(q, r, topH) {
    const targetH = Math.max(0, topH + (mapData.has(`${q},${r},${topH}`) ? 1 : 0));
    
    // Check if we already painted this level in this stroke
    const strokeKey = `${q},${r},${targetH}`;
    if (lastPaintedHex === strokeKey) return;
    
    const key = `${q},${r},${targetH}`;
    const pType = paletteTypes.find(p => p.id === selectedPaletteId);
    if (!pType) return;
    
    let sprite = "";
    let frame = 0;

    if (pType.type === "static") {
        sprite = pType.base;
    } else if (pType.type === "random") {
        sprite = pType.bases[Math.floor(Math.random() * pType.bases.length)];
    } else if (pType.type === "autotile_path") {
        sprite = "Tiles_PathEnd"; 
    } else if (pType.type === "autotile_lake") {
        sprite = "Tiles_LakeBase"; 
    }

    if (pType.type === "static" || pType.type === "random") {
        const img = images[sprite];
        if (img && img.width > 32) {
            const numFrames = Math.floor(img.width / 32);
            frame = Math.floor(Math.random() * numFrames);
        }
    }

    mapData.set(key, { id: pType.id, sprite, frame });
    updateAutoTiling(q, r, targetH);
    lastPaintedHex = strokeKey;
    isMapDirty = true;
}

function applyErase(q, r, topH) {
    if (topH >= 0) {
        const strokeKey = `${q},${r},${topH}`;
        if (lastPaintedHex === strokeKey) return;

        const key = `${q},${r},${topH}`;
        mapData.delete(key);
        updateAutoTiling(q, r, topH);
        lastPaintedHex = strokeKey;
        isMapDirty = true;
    }
}

function setupInput() {
    canvas.addEventListener('wheel', e => {
        e.preventDefault();
        const zoomFactor = e.deltaY > 0 ? 0.8 : 1.25;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;

        // Calculate world coordinates before zoom
        const worldX = mx / SCALE - camX;
        const worldY = my / SCALE - camY;

        let newScale = SCALE * zoomFactor;
        newScale = Math.max(0.5, Math.min(20, newScale));

        // Adjust camera so mouse stays at the same world coordinates
        camX = mx / newScale - worldX;
        camY = my / newScale - worldY;

        SCALE = newScale;
        
        hoveredHex = findHoveredHex(mouseX, mouseY);
    });

    canvas.addEventListener('mousedown', e => {
        if (e.button === 1 || (e.button === 2 && e.shiftKey)) { 
            isPanning = true;
            panStartX = (e.clientX - canvas.getBoundingClientRect().left) / SCALE - camX;
            panStartY = (e.clientY - canvas.getBoundingClientRect().top) / SCALE - camY;
            e.preventDefault();
            return;
        }

        if (!hoveredHex) return;

        lastPaintedHex = null; // reset stroke

        if (e.button === 0) {
            isDrawing = true;
            applyPaint(hoveredHex.q, hoveredHex.r, hoveredHex.topH);
        } else if (e.button === 2) {
            isErasing = true;
            applyErase(hoveredHex.q, hoveredHex.r, hoveredHex.topH);
        }
        
        // Update hovered hex after change
        hoveredHex = findHoveredHex(mouseX, mouseY);
    });

    window.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        mouseX = (e.clientX - rect.left) / SCALE;
        mouseY = (e.clientY - rect.top) / SCALE;

        if (isPanning) {
            camX = mouseX - panStartX;
            camY = mouseY - panStartY;
        }
        
        const oldHovered = hoveredHex ? `${hoveredHex.q},${hoveredHex.r}` : null;
        hoveredHex = findHoveredHex(mouseX, mouseY);
        
        const newHovered = hoveredHex ? `${hoveredHex.q},${hoveredHex.r}` : null;

        // If we are drawing/erasing and we moved to a new hex, apply
        if (hoveredHex && oldHovered !== newHovered) {
            if (isDrawing) {
                applyPaint(hoveredHex.q, hoveredHex.r, hoveredHex.topH);
                hoveredHex = findHoveredHex(mouseX, mouseY); // Re-calculate after height change
            } else if (isErasing) {
                applyErase(hoveredHex.q, hoveredHex.r, hoveredHex.topH);
                hoveredHex = findHoveredHex(mouseX, mouseY); // Re-calculate after height change
            }
        }
    });

    window.addEventListener('mouseup', e => {
        if (e.button === 1 || (e.button === 2 && e.shiftKey)) isPanning = false;
        if (e.button === 0) isDrawing = false;
        if (e.button === 2) isErasing = false;
        lastPaintedHex = null;
    });

    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // Save / Load
    document.getElementById('btn-save').addEventListener('click', () => {
        const exportData = Array.from(mapData.entries());
        const blob = new Blob([JSON.stringify(exportData)], {type: "application/json"});
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "map.json";
        a.click();
    });

    document.getElementById('btn-load').addEventListener('click', () => {
        document.getElementById('file-load').click();
    });

    document.getElementById('file-load').addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            const data = JSON.parse(ev.target.result);
            mapData = new Map(data);
            isMapDirty = true;
            
            // Re-trigger auto-tiling for everything just in case
            const coords = new Set();
            mapData.forEach((val, key) => {
                const [q, r] = key.split(',');
                coords.add(`${q},${r}`);
            });
            coords.forEach(coord => {
                const [q, r] = coord.split(',').map(Number);
                for(let h=0; h<20; h++) {
                    if (mapData.has(`${q},${r},${h}`)) {
                        updateAutoTiling(q, r, h);
                    }
                }
            });
        };
        reader.readAsText(file);
    });
}

let isMapDirty = true;
let sortedRenderList = [];

function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.imageSmoothingEnabled = false;

    ctx.save();
    ctx.scale(SCALE, SCALE);
    ctx.translate(camX, camY);

    if (isMapDirty) {
        sortedRenderList = [];
        mapData.forEach((data, key) => {
            const [q, r, h] = key.split(',').map(Number);
            sortedRenderList.push({ q, r, h, data });
        });

        sortedRenderList.sort((a, b) => {
            if (a.r !== b.r) return a.r - b.r;
            const pA = Math.abs(a.q) % 2;
            const pB = Math.abs(b.q) % 2;
            if (pA !== pB) return pA - pB;
            if (a.q !== b.q) return a.q - b.q;
            return a.h - b.h;
        });
        isMapDirty = false;
    }

    // Frustum culling bounds
    const viewLeft = -camX;
    const viewTop = -camY;
    const viewRight = -camX + canvas.width / SCALE;
    const viewBottom = -camY + canvas.height / SCALE;

    sortedRenderList.forEach(item => {
        const { q, r, h, data } = item;
        const center = getTileCenter(q, r, h);
        
        const drawX = center.cx - 16;
        const drawY = center.cy - 28;

        // Skip drawing if tile is completely offscreen
        if (drawX + 32 < viewLeft || drawX > viewRight || drawY + 48 < viewTop || drawY > viewBottom) {
            return;
        }

        const img = images[data.sprite];
        if (img) {
            const brightness = 100 + (h * 10);
            ctx.filter = `brightness(${brightness}%)`;
            ctx.drawImage(img, data.frame * 32, 0, 32, 48, drawX, drawY, 32, 48);
            ctx.filter = "none";
        }
    });

    if (hoveredHex) {
        const hH = Math.max(0, hoveredHex.topH);
        const center = getTileCenter(hoveredHex.q, hoveredHex.r, hH);
        
        ctx.beginPath();
        ctx.moveTo(center.cx - 10, center.cy - 12);
        ctx.lineTo(center.cx + 10, center.cy - 12);
        ctx.lineTo(center.cx + 16, center.cy);
        ctx.lineTo(center.cx + 10, center.cy + 12);
        ctx.lineTo(center.cx - 10, center.cy + 12);
        ctx.lineTo(center.cx - 16, center.cy);
        ctx.closePath();
        
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
        ctx.fill();
    }

    ctx.restore();
    requestAnimationFrame(render);
}

window.onload = init;
