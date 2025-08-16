// modules/camera_controller.js
import * as THREE from 'three';
import { Y_AXIS } from './constants.js';

export class CameraController {
  constructor(camera, playerMesh) {
    this.camera = camera;
    this.playerMesh = playerMesh;
    this.keyStates = { left:false, right:false, up:false, down:false };
    
    // Calculate initial offset based on camera and player positions
    this.cameraOffset = new THREE.Vector3();
    this.cameraOffset.copy(this.camera.position).sub(this.playerMesh.position);
    
    this.targetOffset = this.cameraOffset.clone();
  }

  // --- Keyboard & Mouse Input Handlers ---

  handleKeyDown(key) {
    const map = { arrowleft:'left', arrowright:'right', arrowup:'up', arrowdown:'down' };
    if (map[key]) this.keyStates[map[key]] = true;
  }

  handleKeyUp(key) {
    const map = { arrowleft:'left', arrowright:'right', arrowup:'up', arrowdown:'down' };
    if (map[key]) this.keyStates[map[key]] = false;
  }

  handleWheel(deltaY) {
    const zoomFactor = deltaY > 0 ? 1.1 : 0.9;
    this.targetOffset.multiplyScalar(zoomFactor);
    this.clampZoom();
  }

  // --- Touch Input Handlers ---

  handlePan(deltaX) {
    const angle = -deltaX * 0.005; // Adjust sensitivity
    this.targetOffset.applyAxisAngle(Y_AXIS, angle);
  }

  handlePinch(zoomFactor) {
    this.targetOffset.multiplyScalar(zoomFactor);
    this.clampZoom();
  }

  // --- Private Utility ---

  clampZoom() {
    const distance = this.targetOffset.length();
    const clamped = Math.min(Math.max(distance, 10), 150);
    this.targetOffset.setLength(clamped);
  }

  // --- Main Update Loop ---

  update() {
    // Keyboard rotation
    const rotateSpeed = 0.06;
    if (this.keyStates.left || this.keyStates.right) {
      const angle = (this.keyStates.left ? -rotateSpeed : 0) + (this.keyStates.right ? rotateSpeed : 0);
      this.targetOffset.applyAxisAngle(Y_AXIS, angle);
    }
    
    // Keyboard tilt
    const tiltSpeed = 0.4;
    if (this.keyStates.up || this.keyStates.down) {
      const delta = (this.keyStates.up ? 1 : 0) + (this.keyStates.down ? -1 : 0);
      this.targetOffset.y = Math.min(Math.max(this.targetOffset.y + delta * tiltSpeed, 5), 100);
    }
    
    // Smoothly interpolate to the target offset
    this.cameraOffset.lerp(this.targetOffset, 0.2);
    
    // Follow the player
    const playerPos = this.playerMesh.position;
    const desiredPos = new THREE.Vector3().copy(playerPos).add(this.cameraOffset);
    this.camera.position.copy(desiredPos);
    this.camera.lookAt(playerPos);
  }
}