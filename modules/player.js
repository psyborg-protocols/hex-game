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

    /**
     * Checks if a move to an adjacent tile is valid.
     * @param {number} dq The change in the q coordinate.
     * @param {number} dr The change in the r coordinate.
     * @returns {boolean} True if the move is valid, false otherwise.
     */
    canMove(dq, dr) {
        const nq = this.q + dq;
        const nr = this.r + dr;

        if (!this.world.isInside(nq, nr)) return false;

        const currentHeight = this.world.getHeight(this.q, this.r);
        const targetHeight = this.world.getHeight(nq, nr);
        const rawTargetHeight = this.world.heightMap[nr][nq]; // Height ignoring structures

        if (rawTargetHeight === -Infinity) return false;

        // MODIFIED: Check for structures that enable movement
        
        // Check for a ladder connecting current and target tiles
        const structureAtTarget = this.world.getStructure(nq, nr);
        if (structureAtTarget && structureAtTarget.type === 'ladder') {
            const { from, to } = structureAtTarget;
            const connects = (from.q === this.q && from.r === this.r && to.q === nq && to.r === nr) ||
                           (to.q === this.q && to.r === this.r && from.q === nq && from.r === nr);
            if (connects) return true;
        }
        
        // Check for a bridge at the target tile
        if (structureAtTarget && structureAtTarget.type === 'bridge') {
             const { from, to } = structureAtTarget;
             // Can move onto a bridge from either end
             const isAtFrom = from.q === this.q && from.r === this.r;
             const isAtTo = to.q === this.q && to.r === this.r;
             if (isAtFrom || isAtTo) return true;
        }
        
        // Check if moving OFF a bridge
        const structureAtCurrent = this.world.getStructure(this.q, this.r);
        if(structureAtCurrent && structureAtCurrent.type === 'bridge') {
            const { from, to } = structureAtCurrent;
            // Can move from a bridge to either of its ends
            const isTargetFrom = from.q === nq && from.r === nr;
            const isTargetTo = to.q === nq && to.r === nr;
            if(isTargetFrom || isTargetTo) return true;
        }


        // Original height-based movement rules
        if (targetHeight - currentHeight > 1) return false; // Too high to climb
        if (currentHeight - targetHeight > 2) return false; // Too far to drop

        return true;
    }

    /**
     * Moves the player by the given delta if the move is valid.
     * @param {number} dq The change in the q coordinate.
     * @param {number} dr The change in the r coordinate.
     * @returns {boolean} True if the player moved, false otherwise.
     */
    move(dq, dr) {
        if (this.canMove(dq, dr)) {
            this.q += dq;
            this.r += dr;
            this.updatePosition();
            return true;
        }
        return false;
    }
}
