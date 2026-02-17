// @ts-check
/**
 * Mannequin from GLB model + measurement-based collision spheres.
 * Loads Xbot.glb and scales/positions it to match body measurements.
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
const LEG_LENGTH = 25;
const THIGH_R = BODY.thigh_circ / (2 * Math.PI);
const KNEE_R = BODY.knee_circ / (2 * Math.PI);
const SHOULDER_PROP = 0.07;
const ARM_ANGLE_RAD = 15 * Math.PI / 180;
const SHOULDER_ATTACH_Y = torsoLen * (1 - SHOULDER_PROP);

const MANNEQUIN_COLOR = 0xe8c4a0;

// Positioning constants — tweak these to align model with collision spheres
const TORSO_FRACTION = 0.30; // torso is ~30% of total height for humanoid
const HIP_FRACTION = 0.52;   // hip is ~52% up from feet

/** @param {number} a @param {number} b @param {number} t */
function lerp(a, b, t) { return a + (b - a) * t; }

function smoothstep(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

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

// ---- GLB Model Loading ----

const modelUrl = new URL('../models/Xbot.glb', import.meta.url).href;

/**
 * @param {typeof import('three')} THREE
 * @returns {Promise<{ group: import('three').Group, collisionSpheres: { x: number, y: number, z: number, r: number }[], attachments: Record<string, { x: number, y: number, z: number }>, footY: number }>}
 */
export async function createMannequin(THREE) {
  const { GLTFLoader } = await import(
    'https://esm.sh/three@0.170.0/examples/jsm/loaders/GLTFLoader.js'
  );

  const group = new THREE.Group();
  let footY = -LEG_LENGTH;

  try {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync(modelUrl);
    const model = gltf.scene;

    // Compute bounding box in model's native coordinates
    const bbox = new THREE.Box3().setFromObject(model);
    const nativeHeight = bbox.max.y - bbox.min.y;

    // Scale: torso (hip→shoulder) is ~TORSO_FRACTION of total height.
    // We want that span to equal our torsoLen.
    const targetHeight = torsoLen / TORSO_FRACTION;
    const scale = targetHeight / nativeHeight;
    model.scale.setScalar(scale);

    // Recompute bbox after scaling
    bbox.setFromObject(model);
    const scaledHeight = bbox.max.y - bbox.min.y;

    // Position so hip/waist is at y=0
    const hipWorldY = bbox.min.y + scaledHeight * HIP_FRACTION;
    model.position.y = -hipWorldY;

    // Record where feet end up (for grid positioning)
    footY = bbox.min.y - hipWorldY;

    // Apply translucent mannequin material to all meshes
    const mat = new THREE.MeshPhongMaterial({
      color: MANNEQUIN_COLOR,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    model.traverse(child => {
      if (child.isMesh) {
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
        child.material = mat;
      }
    });

    group.add(model);
  } catch (err) {
    console.warn('Failed to load mannequin model, using empty group:', err);
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

  return { group, collisionSpheres, attachments, footY };
}

// ---- Collision spheres ----

function buildCollisionSpheres() {
  const spheres = [];
  const steps = 12;

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = t * torsoLen;
    const prop = 1 - t;
    const rx = profileRadius(prop);
    const rz = rx * DEPTH_RATIO;

    spheres.push({ x: 0, y, z: 0, r: rz * 0.75 });
    spheres.push({ x: rx * 0.55, y, z: 0, r: rx * 0.45 });
    spheres.push({ x: -rx * 0.55, y, z: 0, r: rx * 0.45 });
    spheres.push({ x: 0, y, z: rz * 0.5, r: rz * 0.5 });
    spheres.push({ x: 0, y, z: -rz * 0.5, r: rz * 0.5 });
  }

  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const t = i / 3;
      const armY = SHOULDER_ATTACH_Y - 1 - t * armLen;
      const armX = side * shoulderHW + Math.sin(side * ARM_ANGLE_RAD) * t * armLen;
      const r = lerp(upperArmR, wristR, t) * 0.85;
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
