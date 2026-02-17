// @ts-check
/**
 * Three.js 3D garment viewer.
 * Lazy-loads Three.js from CDN on first activation.
 */

import { simulate, applyGravity, collideWithSpheres, solveSeams } from './cloth.js';
import { createMannequin } from './body3d.js';
import { createGarment3D } from './garment3d.js';

/** @type {typeof import('three') | null} */
let THREE = null;
/** @type {any} */
let OrbitControlsClass = null;

let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let animationId = null;
let currentPanels = [];
let currentSeams = [];
let collisionSpheres = [];
let panelMeshes = [];
let isDisposed = false;

const GRAVITY = 980; // cm/s^2
const DT = 1 / 60;
const CONSTRAINT_ITERATIONS = 16;
const SEAM_ITERATIONS = 8;

/**
 * Load Three.js from CDN (once).
 */
async function loadThreeJS() {
  if (THREE) return;
  const [threeModule, controlsModule] = await Promise.all([
    import('https://esm.sh/three@0.170.0'),
    import('https://esm.sh/three@0.170.0/examples/jsm/controls/OrbitControls.js'),
  ]);
  THREE = threeModule;
  OrbitControlsClass = controlsModule.OrbitControls;
}

/**
 * Create or update the 3D view.
 * @param {HTMLElement} container - DOM element to mount into
 * @param {{ type: string, blocks: any[] }} ast - parsed GNL AST
 */
export async function create3DView(container, ast) {
  isDisposed = false;

  await loadThreeJS();
  if (isDisposed) return; // user switched away during load

  // If scene already exists, just rebuild garment
  if (renderer && scene) {
    rebuildGarment(ast);
    return;
  }

  // Create renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0xfaf9f7, 1);
  updateRendererSize(container);
  container.appendChild(renderer.domElement);

  // Scene
  scene = new THREE.Scene();

  // Camera
  const aspect = container.clientWidth / container.clientHeight;
  camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
  camera.position.set(0, 25, 80);
  camera.lookAt(0, 20, 0);

  // Controls
  controls = new OrbitControlsClass(camera, renderer.domElement);
  controls.target.set(0, 20, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.update();

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(30, 50, 40);
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
  fillLight.position.set(-20, 30, -30);
  scene.add(fillLight);

  // Mannequin (async — loads GLB model)
  const mannequin = await createMannequin(THREE);
  if (isDisposed) return;
  scene.add(mannequin.group);
  collisionSpheres = mannequin.collisionSpheres;

  // Ground grid — positioned at foot level
  const gridHelper = new THREE.GridHelper(100, 20, 0xd1d5db, 0xe5e7eb);
  gridHelper.position.y = mannequin.footY || -1;
  scene.add(gridHelper);

  // Build garment
  rebuildGarment(ast);

  // Resize handler
  const onResize = () => {
    if (!renderer || !camera || isDisposed) return;
    updateRendererSize(container);
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', onResize);
  renderer._resizeHandler = onResize;

  // Start animation loop
  startAnimation();
}

function updateRendererSize(container) {
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (w > 0 && h > 0) {
    renderer.setSize(w, h);
  }
}

/**
 * Rebuild garment meshes from new AST (reuses existing scene).
 */
function rebuildGarment(ast) {
  // Remove old panel meshes
  for (const mesh of panelMeshes) {
    scene.remove(mesh);
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
  panelMeshes = [];
  currentPanels = [];
  currentSeams = [];

  // Create new panels
  const garment = createGarment3D(ast);
  currentPanels = garment.panels;
  currentSeams = garment.seams;

  // Create Three.js meshes for each panel
  for (const panel of currentPanels) {
    const { cols, rows } = panel.cloth;
    const geo = new THREE.PlaneGeometry(1, 1, cols - 1, rows - 1);
    geo.dynamic = true;

    const mat = new THREE.MeshStandardMaterial({
      color: panel.color,
      side: THREE.DoubleSide,
      flatShading: true,
      transparent: true,
      opacity: 0.85,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh._clothPanel = panel;
    scene.add(mesh);
    panelMeshes.push(mesh);

    // Sync initial positions
    syncMeshPositions(mesh, panel.cloth);
  }
}

/**
 * Copy cloth particle positions into Three.js geometry vertices.
 */
function syncMeshPositions(mesh, cloth) {
  const posAttr = mesh.geometry.attributes.position;
  const { cols, rows, positions } = cloth;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const pi = (r * cols + c) * 3;
      const vi = r * cols + c;
      posAttr.setXYZ(vi, positions[pi], positions[pi + 1], positions[pi + 2]);
    }
  }

  posAttr.needsUpdate = true;
  mesh.geometry.computeVertexNormals();
}

/**
 * Main animation loop.
 */
function startAnimation() {
  if (isDisposed) return;

  function animate() {
    if (isDisposed) return;
    animationId = requestAnimationFrame(animate);

    // Physics step
    for (const panel of currentPanels) {
      applyGravity(panel.cloth, GRAVITY, DT);
      simulate(panel.cloth, DT, CONSTRAINT_ITERATIONS);
      collideWithSpheres(panel.cloth, collisionSpheres);
    }

    // Solve seam constraints
    if (currentSeams.length > 0) {
      solveSeams(currentSeams, SEAM_ITERATIONS);
    }

    // Sync mesh positions
    for (const mesh of panelMeshes) {
      if (mesh._clothPanel) {
        syncMeshPositions(mesh, mesh._clothPanel.cloth);
      }
    }

    // Render
    controls.update();
    renderer.render(scene, camera);
  }

  animate();
}

/**
 * Dispose 3D view and free resources.
 */
export function dispose3DView() {
  isDisposed = true;

  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  if (renderer) {
    if (renderer._resizeHandler) {
      window.removeEventListener('resize', renderer._resizeHandler);
    }

    // Remove canvas from DOM
    if (renderer.domElement && renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement);
    }

    // Dispose panel meshes
    for (const mesh of panelMeshes) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    panelMeshes = [];

    // Dispose scene objects
    if (scene) {
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    }

    renderer.dispose();
    renderer = null;
    scene = null;
    camera = null;
    controls = null;
  }

  currentPanels = [];
  currentSeams = [];
  collisionSpheres = [];
}
