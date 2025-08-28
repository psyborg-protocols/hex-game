// modules/context_system.js
import * as THREE from 'three';

/**
 * Determines the player's current contextual action based on their position and surroundings.
 */
export class ContextSystem {
  constructor(game) {
    this.game = game;
  }

  /**
   * Analyzes the game state to determine all relevant actions.
   * @returns {Array<{mode: string, params: object}>} An array of all possible contexts.
   */
  determine() {
    const contexts = [];
    const q = this.game.player.q;
    const r = this.game.player.r;
    const currentHeight = this.game.world.getHeight(q, r);
    const playerAndNeighbors = [ {dq:0, dr:0}, {dq:1,dr:0},{dq:-1,dr:0},{dq:0,dr:1},{dq:0,dr:-1},{dq:1,dr:-1},{dq:-1,dr:1} ];

    // --- 1. Mining Context (Terrain-based) ---
    const hasPickaxe = this.game.actions.hasItem('pickaxe');
    const hasHammer = this.game.actions.hasItem('hammer');
    if (hasPickaxe || hasHammer) {
      for (const {dq, dr} of playerAndNeighbors) {
        if (dq === 0 && dr === 0) continue; // Don't check player's own tile
        const nq = q + dq;
        const nr = r + dr;
        const h = this.game.world.getHeight(nq, nr);
        if (h !== -Infinity && h - currentHeight >= 3) {
          const tool = hasPickaxe ? 'pickaxe' : 'hammer';
          contexts.push({ mode: 'mine', params: { q: nq, r: nr, tool: tool } });
        }
      }
    }

    // --- 2. Prop-based Contexts on Player's Tile (Harvest, Forage) ---
    if (this.game.propsGroup) {
      this.game.propsGroup.children.forEach(instancedMesh => {
        if (instancedMesh.isInstancedMesh && instancedMesh.userData.spawns) {
          instancedMesh.userData.spawns.forEach((spawn, instanceId) => {
            // Only check props on the player's current tile
            if (spawn.q === q && spawn.r === r) {
              // Create a temporary object to be the UI target
              const targetObject = new THREE.Object3D();
              targetObject.position.set(spawn.x, spawn.y, spawn.z);
              targetObject.userData.q = spawn.q;
              targetObject.userData.r = spawn.r;
              targetObject.userData.instancedMesh = instancedMesh;
              targetObject.userData.instanceId = instanceId;

              if (spawn.type === 'forest' || spawn.type === 'dark_forest') {
                contexts.push({ mode: 'harvest', params: { q, r, treeMesh: targetObject } });
              } else if (spawn.type === 'tall_grass') {
                contexts.push({ mode: 'forage', params: { q, r, grassMesh: targetObject } });
              }
            }
          });
        }
      });
    }

    // --- 3. Trade Context (Player or Adjacent Tile Check) ---
    const checkedCities = new Set();
    for (const {dq, dr} of playerAndNeighbors) {
      const nq = q + dq;
      const nr = r + dr;
      const cityKey = `${nq},${nr}`;
      if (checkedCities.has(cityKey) || !this.game.world.isInside(nq, nr)) continue;

      const feature = this.game.world.featureMap[nr]?.[nq];
      if (feature?.type === 'city') {
        if (this.game.propsGroup) {
          const cityMesh = this.game.propsGroup.children.find(mesh => mesh.userData.type === 'city');
          if (cityMesh && cityMesh.userData.spawns) {
            const citySpawn = cityMesh.userData.spawns.find(s => s.q === nq && s.r === nr);
            if (citySpawn) {
              const targetObject = new THREE.Object3D();
              targetObject.position.set(citySpawn.x, citySpawn.y, citySpawn.z);
              contexts.push({ mode: 'trade', params: { cityQ: nq, cityR: nr, target: targetObject } });
              checkedCities.add(cityKey);
            }
          }
        }
      }
    }

    return contexts;
  }
}
