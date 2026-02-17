// @ts-check
/**
 * Parametric mannequin mesh from BODY measurements.
 * Uses parametric surfaces with cosine-based contouring and joint spheres.
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
const armLen = BODY.arm_length * 0.4;

const DEPTH_RATIO = 0.75;
const NECK_HEIGHT = 6;
const HEAD_RX = neckR * 1.3;
const HEAD_RY = HEAD_RX * 1.15;
const HEAD_RZ = HEAD_RX * 0.9;
const LEG_LENGTH = 25;
const THIGH_R = BODY.thigh_circ / (2 * Math.PI);
const KNEE_R = BODY.knee_circ / (2 * Math.PI);
const SHOULDER_PROP = 0.07;
const ARM_ANGLE_RAD = 15 * Math.PI / 180;
const SHOULDER_ATTACH_Y = torsoLen * (1 - SHOULDER_PROP);

const MANNEQUIN_COLOR = 0xe8c4a0;

// ---- Helpers ----

/** @param {number} a @param {number} b @param {number} t */
function lerp(a, b, t) { return a + (b - a) * t; }

function smoothstep(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

/**
 * Cosine-based bumps for organic surface contouring.
 * Each param: [uMin, uMax, vMin, vMax, 1/height]
 */
function cossers(u, v, params) {
  function cosser(t, min, max) {
    if (t < min) t++;
    if (t > max) t--;
    if (min <= t && t <= max)
      return 0.5 + 0.5 * Math.cos((t - min) / (max - min) * 2 * Math.PI - Math.PI);
    return 0;
  }
  let r = 1;
  for (const p of params) {
    r += cosser(u, p[0], p[1]) * cosser(v, p[2], p[3]) / p[4];
  }
  return r;
}

/**
 * Side-to-side radius at a given proportion from top.
 * @param {number} prop - 0 = top (neck), 1 = bottom
 */
function profileRadius(prop) {
  if (prop <= SHOULDER_PROP) {
    return lerp(neckR, shoulderHW, smoothstep(prop / SHOULDER_PROP));
  } else if (prop <= BUST_Y) {
    return lerp(shoulderHW, bustR, smoothstep((prop - SHOULDER_PROP) / (BUST_Y - SHOULDER_PROP)));
  } else if (prop <= WAIST_Y) {
    return lerp(bustR, waistR, smoothstep((prop - BUST_Y) / (WAIST_Y - BUST_Y)));
  } else if (prop <= HIP_Y) {
    return lerp(waistR, hipR, smoothstep((prop - WAIST_Y) / (HIP_Y - WAIST_Y)));
  } else {
    return lerp(hipR, hipR * 0.95, smoothstep((prop - HIP_Y) / (1 - HIP_Y)));
  }
}

// ---- Torso geometry ----

/**
 * Torso parametric surface with cossers bust contouring.
 * u: 0=bottom (hips), 1=top (neck). v: 0..1 around circumference.
 */
function torsoVertex(u, v) {
  const prop = 1 - u;
  const baseRx = profileRadius(prop);
  const baseRz = baseRx * DEPTH_RATIO;

  const mod = cossers(u, v, [
    [0.65, 0.80, 0.05, 0.20, 4],
    [0.65, 0.80, 0.30, 0.45, 4],
  ]);

  const rx = baseRx * mod;
  const rz = baseRz * mod;
  const theta = v * Math.PI * 2;

  return [rx * Math.cos(theta), u * torsoLen, rz * Math.sin(theta)];
}

function buildTorsoMesh(THREE) {
  const numU = 20, numV = 24;
  const positions = [];
  const indices = [];

  for (let i = 0; i <= numU; i++) {
    for (let j = 0; j < numV; j++) {
      const [x, y, z] = torsoVertex(i / numU, j / numV);
      positions.push(x, y, z);
    }
  }

  for (let i = 0; i < numU; i++) {
    for (let j = 0; j < numV; j++) {
      const jn = (j + 1) % numV;
      const a = i * numV + j, b = i * numV + jn;
      const c = (i + 1) * numV + j, d = (i + 1) * numV + jn;
      indices.push(a, c, b, b, c, d);
    }
  }

  // Top cap
  const topIdx = positions.length / 3;
  positions.push(0, torsoLen, 0);
  for (let j = 0; j < numV; j++)
    indices.push(topIdx, numU * numV + (j + 1) % numV, numU * numV + j);

  // Bottom cap
  const botIdx = positions.length / 3;
  positions.push(0, 0, 0);
  for (let j = 0; j < numV; j++)
    indices.push(botIdx, j, (j + 1) % numV);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

// ---- Main ----

/**
 * @param {typeof import('three')} THREE
 * @returns {{ group: import('three').Group, collisionSpheres: { x: number, y: number, z: number, r: number }[], attachments: Record<string, { x: number, y: number, z: number }> }}
 */
export function createMannequin(THREE) {
  const group = new THREE.Group();

  // Single material — avoids transparency stacking artifacts
  const mat = new THREE.MeshPhongMaterial({
    color: MANNEQUIN_COLOR,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  // Joint sphere material — slightly more opaque for visibility
  const jointMat = new THREE.MeshPhongMaterial({
    color: 0xdeb887,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });

  // --- Torso (parametric with cossers bust) ---
  group.add(new THREE.Mesh(buildTorsoMesh(THREE), mat));

  // --- Neck ---
  const neckJoint = new THREE.Mesh(new THREE.IcosahedronGeometry(neckR * 1.05, 2), jointMat);
  neckJoint.position.y = torsoLen;
  group.add(neckJoint);

  const neckGeo = new THREE.CylinderGeometry(neckR * 0.9, neckR, NECK_HEIGHT, 12, 1);
  const neck = new THREE.Mesh(neckGeo, mat);
  neck.position.y = torsoLen + NECK_HEIGHT / 2;
  group.add(neck);

  // --- Head ---
  const headJoint = new THREE.Mesh(new THREE.IcosahedronGeometry(neckR * 0.95, 2), jointMat);
  headJoint.position.y = torsoLen + NECK_HEIGHT;
  group.add(headJoint);

  const headGeo = new THREE.SphereGeometry(HEAD_RX, 16, 12);
  const head = new THREE.Mesh(headGeo, mat);
  head.scale.set(1, HEAD_RY / HEAD_RX, HEAD_RZ / HEAD_RX);
  head.position.y = torsoLen + NECK_HEIGHT + HEAD_RY * 0.85;
  group.add(head);

  // --- Arms (clean CylinderGeometry) ---
  const armGeo = new THREE.CylinderGeometry(wristR, upperArmR, armLen, 12, 4);
  for (const side of [-1, 1]) {
    const sj = new THREE.Mesh(new THREE.IcosahedronGeometry(upperArmR * 1.2, 2), jointMat);
    sj.position.set(side * shoulderHW, SHOULDER_ATTACH_Y, 0);
    group.add(sj);

    const arm = new THREE.Mesh(armGeo, mat);
    arm.position.set(side * shoulderHW, SHOULDER_ATTACH_Y - armLen / 2 - 1, 0);
    arm.rotation.z = side * ARM_ANGLE_RAD;
    group.add(arm);
  }

  // --- Legs (clean CylinderGeometry) ---
  const legGeo = new THREE.CylinderGeometry(KNEE_R, THIGH_R, LEG_LENGTH, 12, 4);
  for (const side of [-1, 1]) {
    const hj = new THREE.Mesh(new THREE.IcosahedronGeometry(THIGH_R * 1.05, 2), jointMat);
    hj.position.set(side * hipR * 0.35, 0, 0);
    group.add(hj);

    const leg = new THREE.Mesh(legGeo, mat);
    leg.position.set(side * hipR * 0.35, -LEG_LENGTH / 2, 0);
    leg.rotation.z = side * (2 * Math.PI / 180);
    group.add(leg);
  }

  const collisionSpheres = buildCollisionSpheres();

  const attachments = {
    'shoulder.L': { x: -shoulderHW, y: SHOULDER_ATTACH_Y, z: 0 },
    'shoulder.R': { x: shoulderHW, y: SHOULDER_ATTACH_Y, z: 0 },
    'neckline': { x: 0, y: torsoLen, z: 0 },
    'waist': { x: 0, y: torsoLen * (1 - WAIST_Y), z: 0 },
    'armhole.L': { x: -shoulderHW, y: SHOULDER_ATTACH_Y - 2, z: 0 },
    'armhole.R': { x: shoulderHW, y: SHOULDER_ATTACH_Y - 2, z: 0 },
  };

  return { group, collisionSpheres, attachments };
}

// ---- Collision spheres ----
// Elliptical coverage: center sphere + 4 cardinal perimeter spheres per height slice

function buildCollisionSpheres() {
  const spheres = [];
  const steps = 12;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = t * torsoLen;
    const prop = 1 - t;
    const rx = profileRadius(prop);
    const rz = rx * DEPTH_RATIO;

    // Center sphere — covers inner volume
    spheres.push({ x: 0, y, z: 0, r: rz * 0.75 });

    // 4 cardinal perimeter spheres — cover the elliptical outline
    // Right / Left
    spheres.push({ x: rx * 0.55, y, z: 0, r: rx * 0.45 });
    spheres.push({ x: -rx * 0.55, y, z: 0, r: rx * 0.45 });
    // Front / Back
    spheres.push({ x: 0, y, z: rz * 0.5, r: rz * 0.5 });
    spheres.push({ x: 0, y, z: -rz * 0.5, r: rz * 0.5 });
  }

  // Arms
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      const armY = SHOULDER_ATTACH_Y - 1 - t * armLen;
      const armX = side * shoulderHW + Math.sin(side * ARM_ANGLE_RAD) * t * armLen;
      const r = lerp(upperArmR, wristR, t) * 0.85;
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

// ---- Exports ----

export function getBodyDims() {
  return {
    torsoLen, shoulderHW, neckR, bustR, waistR, hipR,
    upperArmR, wristR, armLen,
    bustY: BUST_Y, waistY: WAIST_Y, hipY: HIP_Y,
    depthRatio: DEPTH_RATIO,
    shoulderAttachY: SHOULDER_ATTACH_Y,
  };
}
