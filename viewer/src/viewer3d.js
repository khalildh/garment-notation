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

// Interaction (drag) state
let raycaster = null;
let pointer = null;
let dragState = {
  active: false,
  mesh: null,
  cloth: null,
  particle: -1,
  plane: null,
  target: null,
  handlersAttached: false,
};

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

  // Interaction helpers
  raycaster = new THREE.Raycaster();
  pointer = new THREE.Vector2();
  dragState.plane = new THREE.Plane();
  dragState.target = new THREE.Vector3();

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

  // Input handlers (once per renderer lifecycle)
  attachInputHandlers(renderer.domElement);

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

function attachInputHandlers(domEl) {
  if (dragState.handlersAttached) return;

  const getPointerNDC = (event) => {
    const rect = domEl.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    pointer.set(x, y);
  };

  const pickCloth = (event) => {
    getPointerNDC(event);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(panelMeshes, false);
    return hits && hits[0];
  };

  const onMouseDown = (e) => {
    if (!scene || !camera) return;
    const hit = pickCloth(e);
    if (!hit) return;

    const mesh = hit.object;
    const panel = mesh._clothPanel;
    if (!panel || !panel.cloth) return;

    // Find nearest vertex among the face's three vertices
    const face = hit.face; // { a, b, c }
    const posAttr = mesh.geometry.attributes.position;
    const candidates = face ? [face.a, face.b, face.c] : [hit.faceIndex];
    let best = -1, bestD2 = Infinity;
    for (const vi of candidates) {
      const vx = posAttr.getX(vi), vy = posAttr.getY(vi), vz = posAttr.getZ(vi);
      const dx = vx - hit.point.x, dy = vy - hit.point.y, dz = vz - hit.point.z;
      const d2 = dx*dx + dy*dy + dz*dz;
      if (d2 < bestD2) { bestD2 = d2; best = vi; }
    }
    if (best < 0) return;

    dragState.active = true;
    dragState.mesh = mesh;
    dragState.cloth = panel.cloth;
    dragState.particle = best; // geometry index equals cloth particle index

    // Plane for dragging: camera-facing plane through the hit point
    const normal = new THREE.Vector3();
    camera.getWorldDirection(normal);
    dragState.plane.setFromNormalAndCoplanarPoint(normal, hit.point.clone());

    // Seed target at the hit point
    dragState.target.copy(hit.point);

    // Temporarily pin the particle so solver treats it as fixed
    pinDragParticle(true);

    // Disable orbit controls while dragging
    controls && (controls.enabled = false);
  };

  const onMouseMove = (e) => {
    if (!dragState.active) return;
    getPointerNDC(e);
    raycaster.setFromCamera(pointer, camera);
    const p = new THREE.Vector3();
    raycaster.ray.intersectPlane(dragState.plane, p);
    if (p) dragState.target.copy(p);
  };

  const endDrag = () => {
    if (!dragState.active) return;
    pinDragParticle(false);
    dragState.active = false;
    dragState.mesh = null;
    dragState.cloth = null;
    dragState.particle = -1;
    controls && (controls.enabled = true);
  };

  domEl.addEventListener('mousedown', onMouseDown);
  domEl.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', endDrag);
  domEl.addEventListener('mouseleave', endDrag);

  dragState.handlersAttached = true;
}

function pinDragParticle(flag) {
  const cloth = dragState.cloth;
  if (!cloth || dragState.particle < 0) return;
  cloth.pinned[dragState.particle] = flag ? 1 : 0;
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
      // If dragging this panel, drive the selected particle to the target
      if (dragState.active && dragState.cloth === panel.cloth && dragState.particle >= 0) {
        const i3 = dragState.particle * 3;
        const pos = panel.cloth.positions;
        const prev = panel.cloth.prevPositions;
        pos[i3] = dragState.target.x;
        pos[i3 + 1] = dragState.target.y;
        pos[i3 + 2] = dragState.target.z;
        // Match prev to avoid artificial velocity bursts
        prev[i3] = pos[i3];
        prev[i3 + 1] = pos[i3 + 1];
        prev[i3 + 2] = pos[i3 + 2];
      }
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
