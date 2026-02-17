// @ts-check
/**
 * Parametric mannequin mesh from BODY measurements.
 * Generates Three.js geometry + collision spheres for cloth sim.
 *
 * The torso is built from stacked elliptical rings (wider side-to-side,
 * narrower front-to-back) rather than rotationally symmetric LatheGeometry.
 */

import { BODY } from './body.js';

// Body proportions — measured from top of torso (match overlay.js)
const BUST_Y = 0.28;
const WAIST_Y = 0.55;
const HIP_Y = 0.78;

// Convert circumferences to radii (circ / 2π)
const neckR = BODY.neck_circ / (2 * Math.PI);
const bustR = BODY.bust_circ / (2 * Math.PI);
const waistR = BODY.waist_circ / (2 * Math.PI);
const hipR = BODY.hip_circ / (2 * Math.PI);
const shoulderHW = BODY.shoulder_width / 2;
const upperArmR = BODY.upper_arm_circ / (2 * Math.PI);
const wristR = BODY.wrist_circ / (2 * Math.PI);
const torsoLen = BODY.torso_length;
const armLen = BODY.arm_length * 0.4; // visible sleeve portion

// Elliptical depth ratio: front-to-back is 75% of side-to-side
const DEPTH_RATIO = 0.75;

// Neck + head
const NECK_HEIGHT = 6;
const HEAD_RX = neckR * 1.3;
const HEAD_RY = HEAD_RX * 1.15;
const HEAD_RZ = HEAD_RX * 0.9;

// Legs
const LEG_LENGTH = 25;
const THIGH_R = BODY.thigh_circ / (2 * Math.PI);
const KNEE_R = BODY.knee_circ / (2 * Math.PI);

// Shoulder shelf zone (proportion from top)
const SHOULDER_Y = 0.07;

// Arm angle outward (degrees)
const ARM_ANGLE_DEG = 15;
const ARM_ANGLE_RAD = ARM_ANGLE_DEG * Math.PI / 180;

/**
 * Smooth interpolation (hermite).
 * @param {number} t - 0..1
 */
function smoothstep(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

/** @param {number} a @param {number} b @param {number} t */
function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Get the side-to-side radius at a given proportion from top.
 * Includes shoulder shelf that widens above the bust.
 * @param {number} prop - 0 = top (neck), 1 = bottom
 */
function profileRadius(prop) {
  if (prop <= SHOULDER_Y) {
    // Neck → shoulder shelf (quick widening)
    return lerp(neckR, shoulderHW, smoothstep(prop / SHOULDER_Y));
  } else if (prop <= BUST_Y) {
    // Shoulder shelf → bust
    return lerp(shoulderHW, bustR, smoothstep((prop - SHOULDER_Y) / (BUST_Y - SHOULDER_Y)));
  } else if (prop <= WAIST_Y) {
    return lerp(bustR, waistR, smoothstep((prop - BUST_Y) / (WAIST_Y - BUST_Y)));
  } else if (prop <= HIP_Y) {
    return lerp(waistR, hipR, smoothstep((prop - WAIST_Y) / (HIP_Y - WAIST_Y)));
  } else {
    return lerp(hipR, hipR * 0.95, smoothstep((prop - HIP_Y) / (1 - HIP_Y)));
  }
}

/**
 * Build torso as BufferGeometry from stacked elliptical rings.
 * @param {typeof import('three')} THREE
 */
function buildTorsoMesh(THREE) {
  const numRings = 24;
  const numSegs = 24;

  const positions = [];
  const indices = [];

  // Generate ring vertices
  for (let i = 0; i <= numRings; i++) {
    const t = i / numRings; // 0 = bottom, 1 = top
    const y = t * torsoLen;
    const prop = 1 - t; // proportion from top

    const rx = profileRadius(prop);
    const rz = rx * DEPTH_RATIO;

    // Slight forward push near bust for shaping
    let zOff = 0;
    const bustDist = Math.abs(prop - BUST_Y);
    if (bustDist < 0.12) {
      zOff = (1 - bustDist / 0.12) * rx * 0.04;
    }

    for (let j = 0; j < numSegs; j++) {
      const theta = (j / numSegs) * Math.PI * 2;
      positions.push(rx * Math.cos(theta), y, rz * Math.sin(theta) + zOff);
    }
  }

  // Generate indices — two triangles per quad between adjacent rings
  for (let i = 0; i < numRings; i++) {
    for (let j = 0; j < numSegs; j++) {
      const cur = i * numSegs + j;
      const nxt = i * numSegs + (j + 1) % numSegs;
      const abv = (i + 1) * numSegs + j;
      const abvNxt = (i + 1) * numSegs + (j + 1) % numSegs;
      indices.push(cur, abv, nxt);
      indices.push(nxt, abv, abvNxt);
    }
  }

  // Top cap (fan from center)
  const topIdx = positions.length / 3;
  positions.push(0, torsoLen, 0);
  const topRing = numRings * numSegs;
  for (let j = 0; j < numSegs; j++) {
    indices.push(topIdx, topRing + (j + 1) % numSegs, topRing + j);
  }

  // Bottom cap
  const botIdx = positions.length / 3;
  positions.push(0, 0, 0);
  for (let j = 0; j < numSegs; j++) {
    indices.push(botIdx, j, (j + 1) % numSegs);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Create mannequin mesh group.
 * @param {typeof import('three')} THREE
 * @returns {{ group: import('three').Group, collisionSpheres: { x: number, y: number, z: number, r: number }[], attachments: Record<string, { x: number, y: number, z: number }> }}
 */
export function createMannequin(THREE) {
  const group = new THREE.Group();

  const material = new THREE.MeshPhongMaterial({
    color: 0xccc5bc,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  });

  // --- Torso ---
  const torsoGeo = buildTorsoMesh(THREE);
  group.add(new THREE.Mesh(torsoGeo, material));

  // --- Neck ---
  const neckGeo = new THREE.CylinderGeometry(neckR * 0.95, neckR, NECK_HEIGHT, 12, 1);
  const neck = new THREE.Mesh(neckGeo, material);
  neck.position.y = torsoLen + NECK_HEIGHT / 2;
  group.add(neck);

  // --- Head (ellipsoid) ---
  const headGeo = new THREE.SphereGeometry(HEAD_RX, 16, 12);
  const head = new THREE.Mesh(headGeo, material);
  head.scale.set(1, HEAD_RY / HEAD_RX, HEAD_RZ / HEAD_RX);
  head.position.y = torsoLen + NECK_HEIGHT + HEAD_RY * 0.85;
  group.add(head);

  // --- Arms (higher segment count) ---
  const armGeo = new THREE.CylinderGeometry(wristR, upperArmR, armLen, 12, 4);
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(armGeo, material);
    arm.position.x = side * shoulderHW;
    arm.position.y = torsoLen - armLen / 2 - 2;
    arm.rotation.z = side * ARM_ANGLE_RAD;
    group.add(arm);
  }

  // --- Upper legs ---
  const legGeo = new THREE.CylinderGeometry(KNEE_R, THIGH_R, LEG_LENGTH, 12, 4);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, material);
    leg.position.x = side * hipR * 0.35;
    leg.position.y = -LEG_LENGTH / 2;
    leg.rotation.z = side * (2 * Math.PI / 180);
    group.add(leg);
  }

  // --- Collision spheres ---
  const collisionSpheres = buildCollisionSpheres();

  // --- Attachment points ---
  const shoulderY = torsoLen;
  const attachments = {
    'shoulder.L': { x: -shoulderHW, y: shoulderY, z: 0 },
    'shoulder.R': { x: shoulderHW, y: shoulderY, z: 0 },
    'neckline': { x: 0, y: torsoLen, z: 0 },
    'waist': { x: 0, y: torsoLen * (1 - WAIST_Y), z: 0 },
    'armhole.L': { x: -shoulderHW, y: shoulderY - 2, z: 0 },
    'armhole.R': { x: shoulderHW, y: shoulderY - 2, z: 0 },
  };

  return { group, collisionSpheres, attachments };
}

/**
 * Build collision spheres for the body — torso, arms, and legs.
 * Uses min(radiusX, radiusZ) so cloth can't pass through the narrow dimension.
 */
function buildCollisionSpheres() {
  const spheres = [];
  const steps = 10;

  // Torso
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = t * torsoLen;
    const prop = 1 - t;

    const rx = profileRadius(prop);
    const rz = rx * DEPTH_RATIO;
    const safeR = Math.min(rx, rz) * 0.85;

    // Center sphere at each height
    spheres.push({ x: 0, y, z: 0, r: safeR });

    // Offset spheres at bust and hip for better coverage
    if (Math.abs(prop - BUST_Y) < 0.1) {
      spheres.push({ x: 0, y, z: rz * 0.5, r: safeR * 0.6 });
      spheres.push({ x: 0, y, z: -rz * 0.5, r: safeR * 0.6 });
    }
    if (Math.abs(prop - HIP_Y) < 0.1) {
      spheres.push({ x: rx * 0.4, y, z: 0, r: safeR * 0.5 });
      spheres.push({ x: -rx * 0.4, y, z: 0, r: safeR * 0.5 });
    }
  }

  // Arms — follow the angled arm position
  const shoulderY = torsoLen;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      const armY = shoulderY - 2 - t * armLen;
      const armX = side * shoulderHW + Math.sin(side * ARM_ANGLE_RAD) * t * armLen;
      const r = lerp(upperArmR, wristR, t) * 0.8;
      spheres.push({ x: armX, y: armY, z: 0, r });
    }
  }

  // Legs
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const t = i / 2;
      const r = lerp(THIGH_R, KNEE_R, t) * 0.85;
      spheres.push({ x: side * hipR * 0.35, y: -t * LEG_LENGTH, z: 0, r });
    }
  }

  return spheres;
}

/**
 * Get body dimensions for 3D positioning.
 */
export function getBodyDims() {
  return {
    torsoLen,
    shoulderHW,
    neckR,
    bustR,
    waistR,
    hipR,
    upperArmR,
    wristR,
    armLen,
    bustY: BUST_Y,
    waistY: WAIST_Y,
    hipY: HIP_Y,
  };
}
