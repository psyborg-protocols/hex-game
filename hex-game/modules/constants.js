// constants.js
import * as THREE from 'three';
export const DIRECTIONS = [
  { dq: 1, dr: 0 }, { dq: -1, dr: 0 }, { dq: 0, dr: 1 },
  { dq: 0, dr: -1 }, { dq: 1, dr: -1 }, { dq: -1, dr: 1 },
];
export const Y_AXIS = new THREE.Vector3(0, 1, 0);
