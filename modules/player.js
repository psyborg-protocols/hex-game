import * as THREE from 'three';
import { axialToWorld } from './world_gen.js';

/**
 * Manages the player's state, 3D mesh, and movement on the hex grid.
 */
export class Player {
    /**
     * @param {HexWorld} world The world instance the player exists in.
     * @param {THREE.Scene} scene The main scene to add the player's mesh to.
     */
    constructor(world, scene) {
        this.world = world;
        this.q = world.boardRadius; // Starting axial coordinate q
        this.r = world.boardRadius; // Starting axial coordinate r
        this.mesh = this.buildMesh();
        scene.add(this.mesh);
        this.updatePosition();
    }

    /**
     * Creates the 3D mesh for the player.
     * @returns {THREE.Mesh} The player's mesh.
     */
    buildMesh() {
        const rad = this.world.radius * 0.6;
        const h = this.world.hScale * 2;
        const geo = new THREE.CylinderGeometry(rad, rad, h, 6);
        geo.translate(0, h / 2, 0); // Sit on top of the ground
        geo.rotateY(Math.PI / 6); // Align with hex grid
        const mat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
        return new THREE.Mesh(geo, mat);
    }

    /**
     * Updates the player's mesh position based on their current axial coordinates.
     */
    updatePosition() {
        const { x, z } = axialToWorld(this.q - this.world.boardRadius, this.r - this.world.boardRadius, this.world.radius);
        const h = this.world.getHeight(this.q, this.r);
        this.mesh.position.set(x, (h + 1) * this.world.hScale, z);
    }

}
