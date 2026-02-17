// @ts-check
/**
 * Parametric mannequin mesh from BODY measurements.
 * Generates Three.js geometry + collision spheres for cloth sim.
 */

import { BODY } from './body.js';

// Body proportions (match overlay.js)
const BUST_Y = 0.28;
const WAIST_Y = 0.55;
const HIP_Y = 0.78;

// Convert circumferences to radii (circ / 2pi)
const neckR = BODY.neck_circ / (2 * Math.PI);
const bustR = BODY.bust_circ / (2 * Math.PI);
const waistR = BODY.waist_circ / (2 * Math.PI);
const hipR = BODY.hip_circ / (2 * Math.PI);
const shoulderHW = BODY.shoulder_width / 2;
const upperArmR = BODY.upper_arm_circ / (2 * Math.PI);
const wristR = BODY.wrist_circ / (2 * Math.PI);
const torsoLen = BODY.torso_length;
const armLen = BODY.arm_length * 0.4; // visible sleeve portion

/**
 * Create mannequin mesh group.
 * @param {typeof import('three')} THREE
 * @returns {{ group: import('three').Group, collisionSpheres: { x: number, y: number, z: number, r: number }[], attachments: Record<string, { x: number, y: number, z: number }> }}
 */
export function createMannequin(THREE) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: 0xd1d5db,
    transparent: true,
    opacity: 0.4,
    wireframe: true,
    side: THREE.DoubleSide,
  });
  const solidMaterial = new THREE.MeshStandardMaterial({
    color: 0xd1d5db,
    transparent: true,
    opacity: 0.15,
    side: THREE.DoubleSide,
  });

  // Torso — LatheGeometry from profile curve
  const profile = buildTorsoProfile(THREE);
  const torsoGeo = new THREE.LatheGeometry(profile, 24, 0, Math.PI * 2);
  const torso = new THREE.Mesh(torsoGeo, solidMaterial);
  group.add(torso);

  // Wireframe overlay
  const torsoWire = new THREE.Mesh(torsoGeo, material);
  group.add(torsoWire);

  // Head (sphere at neck top)
  const headR = neckR * 1.3;
  const headGeo = new THREE.SphereGeometry(headR, 16, 12);
  const head = new THREE.Mesh(headGeo, solidMaterial.clone());
  head.material.opacity = 0.1;
  head.position.y = torsoLen + headR * 0.7;
  group.add(head);

  // Arms
  const armGeoL = createArmGeometry(THREE);
  const armL = new THREE.Mesh(armGeoL, solidMaterial);
  positionArm(armL, -1);
  group.add(armL);

  const armWireL = new THREE.Mesh(armGeoL, material);
  positionArm(armWireL, -1);
  group.add(armWireL);

  const armGeoR = createArmGeometry(THREE);
  const armR = new THREE.Mesh(armGeoR, solidMaterial);
  positionArm(armR, 1);
  group.add(armR);

  const armWireR = new THREE.Mesh(armGeoR, material);
  positionArm(armWireR, 1);
  group.add(armWireR);

  // Collision spheres
  const collisionSpheres = buildCollisionSpheres();

  // Attachment points
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
 * Build torso profile curve for LatheGeometry.
 * Points go from bottom (hip) to top (neck), as Vector2(radius, y).
 */
function buildTorsoProfile(THREE) {
  const points = [];
  const steps = 20;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 = bottom, 1 = top
    const y = t * torsoLen;
    let r;

    if (t <= HIP_Y) {
      // Bottom to hip
      const lt = t / HIP_Y;
      r = lerp(hipR * 0.95, hipR, lt);
    } else if (t <= WAIST_Y) {
      // Hip to waist (this is reversed since we go bottom-up in body coords but top-down in proportions)
      // Actually the proportions are from top: bust@28%, waist@55%, hip@78%
      // So from bottom up: hip is at (1 - 0.78) = 22%, waist at (1 - 0.55) = 45%, bust at (1 - 0.28) = 72%
      const lt = (t - HIP_Y) / (WAIST_Y - HIP_Y);
      r = lerp(hipR, waistR, lt);
    } else if (t <= BUST_Y) {
      const lt = (t - WAIST_Y) / (BUST_Y - WAIST_Y);
      r = lerp(waistR, bustR, lt);
    } else {
      // Bust to neck/shoulder
      const lt = (t - BUST_Y) / (1 - BUST_Y);
      r = lerp(bustR, neckR, lt);
    }

    // Smooth the profile
    points.push(new THREE.Vector2(r, y));
  }

  // Reorder: LatheGeometry expects bottom-to-top but our proportions are top-down
  // Fix: proportions from top of body (0% = neck, 100% = bottom)
  // We need to map: y=0 bottom, y=torsoLen top
  // t=0 bottom → proportion = 1.0 (hip area)
  // t=1 top → proportion = 0.0 (neck)
  const corrected = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps; // 0 = bottom, 1 = top
    const y = t * torsoLen;
    const prop = 1 - t; // proportion from top

    let r;
    if (prop <= BUST_Y) {
      // Above bust → neck
      const lt = prop / BUST_Y;
      r = lerp(neckR, bustR, lt);
    } else if (prop <= WAIST_Y) {
      // Bust to waist
      const lt = (prop - BUST_Y) / (WAIST_Y - BUST_Y);
      r = lerp(bustR, waistR, lt);
    } else if (prop <= HIP_Y) {
      // Waist to hip
      const lt = (prop - WAIST_Y) / (HIP_Y - WAIST_Y);
      r = lerp(waistR, hipR, lt);
    } else {
      // Below hip
      const lt = (prop - HIP_Y) / (1 - HIP_Y);
      r = lerp(hipR, hipR * 0.95, lt);
    }

    corrected.push(new THREE.Vector2(r, y));
  }

  return corrected;
}

function createArmGeometry(THREE) {
  return new THREE.CylinderGeometry(wristR, upperArmR, armLen, 8, 1);
}

function positionArm(mesh, side) {
  const shoulderY = torsoLen;
  mesh.position.x = side * (shoulderHW + 1);
  mesh.position.y = shoulderY - armLen / 2 - 2;
  mesh.rotation.z = side * 0.15; // slight angle outward
}

/**
 * Build collision spheres stacked along torso + arms.
 */
function buildCollisionSpheres() {
  const spheres = [];
  const steps = 10;

  // Torso spheres
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = t * torsoLen;
    const prop = 1 - t;

    let r;
    if (prop <= BUST_Y) {
      const lt = prop / BUST_Y;
      r = lerp(neckR, bustR, lt);
    } else if (prop <= WAIST_Y) {
      const lt = (prop - BUST_Y) / (WAIST_Y - BUST_Y);
      r = lerp(bustR, waistR, lt);
    } else if (prop <= HIP_Y) {
      const lt = (prop - WAIST_Y) / (HIP_Y - WAIST_Y);
      r = lerp(waistR, hipR, lt);
    } else {
      r = hipR;
    }

    spheres.push({ x: 0, y, z: 0, r: r * 0.85 });
  }

  // Arm spheres (3-4 per arm)
  const shoulderY = torsoLen;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      const armY = shoulderY - 2 - t * armLen;
      const armR = lerp(upperArmR, wristR, t) * 0.8;
      spheres.push({
        x: side * (shoulderHW + 1),
        y: armY,
        z: 0,
        r: armR,
      });
    }
  }

  return spheres;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
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
