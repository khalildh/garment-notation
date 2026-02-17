// @ts-check
/**
 * Parametric mannequin mesh from BODY measurements.
 * Uses parametric surfaces with cosine-based contouring, joint spheres,
 * and rounded limb caps for organic shapes.
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

// Warm skin-tone colors (inspired by mannequin.js)
const COLOR_BODY = 0xffe4c4;   // bisque
const COLOR_LIMBS = 0xfaebd7;  // antiquewhite
const COLOR_JOINTS = 0xdeb887; // burlywood

// ---- Helpers ----

/** @param {number} a @param {number} b @param {number} t */
function lerp(a, b, t) { return a + (b - a) * t; }

function smoothstep(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

/**
 * Cosine-based bumps for organic surface contouring.
 * Creates localized lumps on parametric surfaces.
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

// ---- Geometry builders ----

/**
 * Build a wrapped parametric surface (v wraps around 0..1).
 * @param {typeof import('three')} THREE
 * @param {(u: number, v: number) => {x: number, y: number, z: number}} func
 * @param {number} numU - divisions along u
 * @param {number} numV - divisions around v (wrapping)
 */
function buildSurface(THREE, func, numU, numV) {
  const positions = [];
  const indices = [];

  for (let i = 0; i <= numU; i++) {
    for (let j = 0; j < numV; j++) {
      const p = func(i / numU, j / numV);
      positions.push(p.x, p.y, p.z);
    }
  }

  for (let i = 0; i < numU; i++) {
    for (let j = 0; j < numV; j++) {
      const jn = (j + 1) % numV;
      const a = i * numV + j;
      const b = i * numV + jn;
      const c = (i + 1) * numV + j;
      const d = (i + 1) * numV + jn;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Torso parametric surface with cossers bust contouring.
 * u: 0=bottom (hips), 1=top (neck). v: 0..1 around circumference.
 * v=0 → +x (right), v=0.25 → +z (front), v=0.5 → -x (left), v=0.75 → -z (back)
 */
function torsoFunc(u, v) {
  const prop = 1 - u;
  const baseRx = profileRadius(prop);
  const baseRz = baseRx * DEPTH_RATIO;

  // Bust protrusion — two separate bumps (right and left breast)
  const mod = cossers(u, v, [
    [0.65, 0.80, 0.05, 0.20, 4],  // right breast
    [0.65, 0.80, 0.30, 0.45, 4],  // left breast
  ]);

  const rx = baseRx * mod;
  const rz = baseRz * mod;
  const theta = v * Math.PI * 2;

  return {
    x: rx * Math.cos(theta),
    y: u * torsoLen,
    z: rz * Math.sin(theta),
  };
}

/** Build torso mesh with top/bottom caps. */
function buildTorsoMesh(THREE) {
  const numU = 20;
  const numV = 24;
  const positions = [];
  const indices = [];

  // Main surface
  for (let i = 0; i <= numU; i++) {
    for (let j = 0; j < numV; j++) {
      const p = torsoFunc(i / numU, j / numV);
      positions.push(p.x, p.y, p.z);
    }
  }

  for (let i = 0; i < numU; i++) {
    for (let j = 0; j < numV; j++) {
      const jn = (j + 1) % numV;
      const a = i * numV + j;
      const b = i * numV + jn;
      const c = (i + 1) * numV + j;
      const d = (i + 1) * numV + jn;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  // Top cap
  const topIdx = positions.length / 3;
  positions.push(0, torsoLen, 0);
  const topRing = numU * numV;
  for (let j = 0; j < numV; j++) {
    indices.push(topIdx, topRing + (j + 1) % numV, topRing + j);
  }

  // Bottom cap
  const botIdx = positions.length / 3;
  positions.push(0, 0, 0);
  for (let j = 0; j < numV; j++) {
    indices.push(botIdx, j, (j + 1) % numV);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/**
 * Create a parametric limb function with rounded end caps.
 * Limb extends from (0,0,0) downward to (0,-length,0).
 * Both ends converge to a point; joint spheres cover the attachment end.
 */
function makeLimbFunc(length, rTop, rBot) {
  return function (u, v) {
    const su = smoothstep(u);
    const r = lerp(rTop, rBot, su);
    const theta = v * Math.PI * 2;
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);

    // Cylindrical shape
    const x1 = r * cosT;
    const y1 = -su * length;
    const z1 = r * 0.9 * sinT;

    // Spherical cap (converges to point at both ends)
    const capCos = Math.cos(Math.PI * su - Math.PI / 2);
    const capSin = Math.sin(Math.PI * su - Math.PI / 2);
    const x2 = r * cosT * capCos;
    const y2 = -length * (0.5 + capSin / 2);
    const z2 = r * 0.9 * sinT * capCos;

    // Blend: cylindrical in middle, spherical at ends
    const k = Math.pow(Math.abs(2 * su - 1), 16);

    return {
      x: lerp(x1, x2, k),
      y: lerp(y1, y2, k),
      z: lerp(z1, z2, k),
    };
  };
}

// ---- Main export ----

/**
 * @param {typeof import('three')} THREE
 * @returns {{ group: import('three').Group, collisionSpheres: { x: number, y: number, z: number, r: number }[], attachments: Record<string, { x: number, y: number, z: number }> }}
 */
export function createMannequin(THREE) {
  const group = new THREE.Group();

  const bodyMat = new THREE.MeshStandardMaterial({
    color: COLOR_BODY, transparent: true, opacity: 0.45,
    side: THREE.DoubleSide, roughness: 1, metalness: 0,
  });
  const limbMat = new THREE.MeshStandardMaterial({
    color: COLOR_LIMBS, transparent: true, opacity: 0.45,
    side: THREE.DoubleSide, roughness: 1, metalness: 0,
  });
  const jointMat = new THREE.MeshStandardMaterial({
    color: COLOR_JOINTS, transparent: true, opacity: 0.5,
    roughness: 1, metalness: 0,
  });

  // --- Torso (parametric surface with bust contouring) ---
  group.add(new THREE.Mesh(buildTorsoMesh(THREE), bodyMat));

  // --- Neck joint sphere ---
  const neckJoint = new THREE.Mesh(
    new THREE.IcosahedronGeometry(neckR * 1.1, 2), jointMat);
  neckJoint.position.y = torsoLen;
  group.add(neckJoint);

  // --- Neck ---
  const neckGeo = new THREE.CylinderGeometry(neckR * 0.9, neckR, NECK_HEIGHT, 12, 1);
  const neck = new THREE.Mesh(neckGeo, limbMat);
  neck.position.y = torsoLen + NECK_HEIGHT / 2;
  group.add(neck);

  // --- Head joint sphere ---
  const headJoint = new THREE.Mesh(
    new THREE.IcosahedronGeometry(neckR, 2), jointMat);
  headJoint.position.y = torsoLen + NECK_HEIGHT;
  group.add(headJoint);

  // --- Head (ellipsoid) ---
  const headGeo = new THREE.SphereGeometry(HEAD_RX, 16, 12);
  const head = new THREE.Mesh(headGeo, limbMat);
  head.scale.set(1, HEAD_RY / HEAD_RX, HEAD_RZ / HEAD_RX);
  head.position.y = torsoLen + NECK_HEIGHT + HEAD_RY * 0.85;
  group.add(head);

  // --- Arms (parametric limbs with rounded caps) ---
  const armGeo = buildSurface(THREE, makeLimbFunc(armLen, upperArmR, wristR), 12, 16);
  const shoulderAttachY = torsoLen * (1 - SHOULDER_PROP);
  for (const side of [-1, 1]) {
    // Shoulder joint
    const sj = new THREE.Mesh(
      new THREE.IcosahedronGeometry(upperArmR * 1.3, 2), jointMat);
    sj.position.set(side * shoulderHW, shoulderAttachY, 0);
    group.add(sj);

    // Arm
    const arm = new THREE.Mesh(armGeo, limbMat);
    arm.position.set(side * shoulderHW, shoulderAttachY, 0);
    arm.rotation.z = side * ARM_ANGLE_RAD;
    group.add(arm);
  }

  // --- Legs (parametric limbs with rounded caps) ---
  const legGeo = buildSurface(THREE, makeLimbFunc(LEG_LENGTH, THIGH_R, KNEE_R), 12, 16);
  for (const side of [-1, 1]) {
    // Hip joint
    const hj = new THREE.Mesh(
      new THREE.IcosahedronGeometry(THIGH_R * 1.1, 2), jointMat);
    hj.position.set(side * hipR * 0.35, 0, 0);
    group.add(hj);

    // Leg
    const leg = new THREE.Mesh(legGeo, limbMat);
    leg.position.set(side * hipR * 0.35, 0, 0);
    leg.rotation.z = side * (2 * Math.PI / 180);
    group.add(leg);
  }

  // --- Collision spheres ---
  const collisionSpheres = buildCollisionSpheres();

  // --- Attachment points ---
  const attachments = {
    'shoulder.L': { x: -shoulderHW, y: shoulderAttachY, z: 0 },
    'shoulder.R': { x: shoulderHW, y: shoulderAttachY, z: 0 },
    'neckline': { x: 0, y: torsoLen, z: 0 },
    'waist': { x: 0, y: torsoLen * (1 - WAIST_Y), z: 0 },
    'armhole.L': { x: -shoulderHW, y: shoulderAttachY - 2, z: 0 },
    'armhole.R': { x: shoulderHW, y: shoulderAttachY - 2, z: 0 },
  };

  return { group, collisionSpheres, attachments };
}

// ---- Collision ----

function buildCollisionSpheres() {
  const spheres = [];
  const steps = 10;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = t * torsoLen;
    const prop = 1 - t;
    const rx = profileRadius(prop);
    const rz = rx * DEPTH_RATIO;
    const safeR = Math.min(rx, rz) * 0.85;

    spheres.push({ x: 0, y, z: 0, r: safeR });

    if (Math.abs(prop - BUST_Y) < 0.1) {
      spheres.push({ x: 0, y, z: rz * 0.5, r: safeR * 0.6 });
      spheres.push({ x: 0, y, z: -rz * 0.5, r: safeR * 0.6 });
    }
    if (Math.abs(prop - HIP_Y) < 0.1) {
      spheres.push({ x: rx * 0.4, y, z: 0, r: safeR * 0.5 });
      spheres.push({ x: -rx * 0.4, y, z: 0, r: safeR * 0.5 });
    }
  }

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

  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const t = i / 2;
      const r = lerp(THIGH_R, KNEE_R, t) * 0.85;
      spheres.push({ x: side * hipR * 0.35, y: -t * LEG_LENGTH, z: 0, r });
    }
  }

  return spheres;
}

// ---- Public dimensions ----

export function getBodyDims() {
  return {
    torsoLen, shoulderHW, neckR, bustR, waistR, hipR,
    upperArmR, wristR, armLen,
    bustY: BUST_Y, waistY: WAIST_Y, hipY: HIP_Y,
  };
}
