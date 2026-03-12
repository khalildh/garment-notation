import { tokenize } from './tokenizer.js';
import { parse as legacyParse } from './parser.js';
import { parse as pegParse } from './gnl-parser.js';
import { pegAstToLegacy } from './peg-adapter.js';
import { render } from './renderer.js';
import { assemble } from './assembler.js';
import { convert } from '../../converter/korosteleva-to-gnl.js';
import { KOROSTELEVA_TEMPLATES } from './korosteleva-examples.js';
import { EXAMPLES, DEFAULT_KEY } from './examples.js';
import { create3DView, dispose3DView } from './viewer3d.js';

/**
 * Parse GNL source: try PEG parser first, fall back to legacy.
 * @param {string} source
 * @returns {{ type: 'program', blocks: any[] }}
 */
function parse(source) {
  try {
    const pegAst = pegParse(source);
    return pegAstToLegacy(pegAst);
  } catch {
    const tokens = tokenize(source);
    return legacyParse(tokens);
  }
}

const editor = document.getElementById('editor');
const sourceToggle = document.getElementById('source-toggle');
const srcBtns = document.querySelectorAll('.src-btn');
const viewer = document.getElementById('viewer');
const viewer3d = document.getElementById('viewer-3d');
const status = document.getElementById('status');
const viewBtns = document.querySelectorAll('.view-btn[data-view]');
const seamsToggleBtn = document.getElementById('seams-toggle');

let currentView = 'assembled';
let bodyOverlayOn = false;
let bodyOverlayMode = 'silhouette'; // 'silhouette' | 'regions'
let activeJsonSource = null; // raw JSON string when a Korosteleva template is active
let activeGnlSource = null;  // converted GNL string (saved when switching to JSON view)
let currentSrcMode = 'gnl';  // 'gnl' or 'json'
let showSeams = false;       // pieces view seam overlays

// Body overlay controls
const bodyToggleBtn = document.getElementById('body-toggle');
const bodyModeToggle = document.getElementById('body-mode-toggle');
const bodyModeBtns = document.querySelectorAll('.body-mode-btn');

bodyToggleBtn?.addEventListener('click', () => {
  bodyOverlayOn = !bodyOverlayOn;
  bodyToggleBtn.classList.toggle('active', bodyOverlayOn);
  bodyModeToggle.style.display = bodyOverlayOn ? '' : 'none';
  update();
});

bodyModeBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    bodyModeBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    bodyOverlayMode = btn.dataset.bodyMode;
    update();
  });
});

// Editor starts empty; default example is fetched at init

let debounceTimer;
editor.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(update, 250);
});

viewBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    viewBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentView = btn.dataset.view;
    updateOverlayVisibility();
    updateViewContainers();
    update();
  });
});

function updateOverlayVisibility() {
  const show = currentView === 'assembled';
  if (bodyToggleBtn) bodyToggleBtn.style.display = show ? '' : 'none';
  if (bodyModeToggle) bodyModeToggle.style.display = (show && bodyOverlayOn) ? '' : 'none';
  if (seamsToggleBtn) seamsToggleBtn.style.display = currentView === 'pieces' ? '' : 'none';
}

function updateViewContainers() {
  const is3d = currentView === '3d';
  viewer.style.display = is3d ? 'none' : '';
  viewer3d.style.display = is3d ? 'flex' : 'none';
  if (!is3d) dispose3DView();
}

function update() {
  const source = (currentSrcMode === 'json' && activeGnlSource) ? activeGnlSource : editor.value;
  if (!source.trim()) {
    viewer.innerHTML = '';
    status.textContent = 'Empty';
    status.className = 'status';
    return;
  }

  try {
    const ast = parse(source);

    if (currentView === '3d') {
      create3DView(viewer3d, ast).catch(err => {
        status.textContent = '3D: ' + err.message;
        status.className = 'status error';
      });
    } else {
      const overlayOpts = { overlay: { on: bodyOverlayOn, mode: bodyOverlayMode } };
      const svg = currentView === 'assembled' ? assemble(ast, overlayOpts) : render(ast, { showSeams });
      viewer.innerHTML = svg;
    }

    const mainBlock = ast.blocks.find(b => b.type === 'garment') || ast.blocks[0];
    const panels = mainBlock?.declarations.filter(d => d.value.type === 'call' && d.value.name === 'P').length ?? 0;
    const steps = mainBlock?.build.length ?? 0;
    const edgeCount = mainBlock?.edges?.length ?? 0;
    const layerCount = mainBlock?.layers?.length ?? 0;
    let statusText = `Parsed: ${panels} panel${panels !== 1 ? 's' : ''}, ${steps} build step${steps !== 1 ? 's' : ''}`;
    if (edgeCount > 0) statusText += `, ${edgeCount} edge${edgeCount !== 1 ? 's' : ''}`;
    if (layerCount > 0) statusText += `, ${layerCount} layer${layerCount !== 1 ? 's' : ''}`;
    if (currentView === '3d') statusText += ' (3D view)';
    status.textContent = statusText;
    status.className = 'status ok';
  } catch (err) {
    status.textContent = err.message;
    status.className = 'status error';
  }
}

// Source toggle (JSON / GNL) — single textarea, swap content
srcBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.src;
    if (mode === currentSrcMode) return;
    srcBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSrcMode = mode;
    if (mode === 'json') {
      activeGnlSource = editor.value;
      editor.value = activeJsonSource;
      editor.readOnly = true;
      editor.style.color = '#94a3b8';
    } else {
      editor.value = activeGnlSource;
      editor.readOnly = false;
      editor.style.color = '';
    }
  });
});

function showSourceToggle(jsonStr) {
  activeJsonSource = jsonStr;
  activeGnlSource = editor.value;
  currentSrcMode = 'gnl';
  sourceToggle.style.display = '';
  srcBtns.forEach(b => b.classList.toggle('active', b.dataset.src === 'gnl'));
  editor.readOnly = false;
  editor.style.color = '';
}

function hideSourceToggle() {
  activeJsonSource = null;
  activeGnlSource = null;
  currentSrcMode = 'gnl';
  sourceToggle.style.display = 'none';
  editor.readOnly = false;
  editor.style.color = '';
}

async function loadKorostelevaTemplate(tpl) {
  status.textContent = 'Loading...';
  status.className = 'status';
  try {
    const res = await fetch(tpl.path);
    if (!res.ok) throw new Error(`Failed to fetch ${tpl.path}`);
    const jsonText = await res.text();
    const json = JSON.parse(jsonText);
    editor.value = convert(json, tpl.name);
    showSourceToggle(jsonText);
    update();
  } catch (err) {
    status.textContent = err.message;
    status.className = 'status error';
  }
}

// Examples dropdown
const examples = document.getElementById('examples');
if (examples) {
  examples.addEventListener('change', () => {
    const val = examples.value;
    if (!val) return;
    loadExample(val, { push: true });
  });
}

// --- Routing: query param ?example=key ---

function setExampleInUrl(key, { replace = false } = {}) {
  const url = new URL(window.location.href);
  url.searchParams.set('example', key);
  if (replace) {
    history.replaceState(null, '', url);
  } else {
    history.pushState(null, '', url);
  }
}

async function loadExample(key, { push = false } = {}) {
  if (EXAMPLES[key]) {
    hideSourceToggle();
    status.textContent = 'Loading...';
    status.className = 'status';
    try {
      const res = await fetch(EXAMPLES[key].path);
      if (!res.ok) throw new Error(`Failed to fetch ${EXAMPLES[key].path}`);
      editor.value = await res.text();
      examples && (examples.value = key);
      if (push) setExampleInUrl(key);
      update();
    } catch (err) {
      status.textContent = err.message;
      status.className = 'status error';
    }
    return;
  }
  if (KOROSTELEVA_TEMPLATES[key]) {
    const tpl = KOROSTELEVA_TEMPLATES[key];
    await loadKorostelevaTemplate(tpl);
    examples && (examples.value = key);
    if (push) setExampleInUrl(key);
    return;
  }
}

// Initial load from ?example=... or default
(() => {
  const params = new URLSearchParams(window.location.search);
  const initial = params.get('example');
  if (initial && (EXAMPLES[initial] || KOROSTELEVA_TEMPLATES[initial])) {
    loadExample(initial, { push: false });
  } else {
    loadExample(DEFAULT_KEY, { push: false });
  }
})();

// Back/forward
window.addEventListener('popstate', () => {
  const params = new URLSearchParams(window.location.search);
  const key = params.get('example');
  if (key) {
    loadExample(key, { push: false });
  }
});
// Seams toggle (pieces view)
seamsToggleBtn?.addEventListener('click', () => {
  showSeams = !showSeams;
  seamsToggleBtn.classList.toggle('active', showSeams);
  if (currentView === 'pieces') update();
});
