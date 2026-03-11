import { tokenize } from './tokenizer.js';
import { parse as legacyParse } from './parser.js';
import { parse as pegParse } from './gnl-parser.js';
import { pegAstToLegacy } from './peg-adapter.js';
import { render } from './renderer.js';
import { assemble } from './assembler.js';
import { convert } from '../../converter/korosteleva-to-gnl.js';
import { KOROSTELEVA_TEMPLATES } from './korosteleva-examples.js';
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

const DEFAULT_SOURCE = `GARMENT t_shirt [SYM] {

  FABRIC: M(160gsm, fluid, biaxial:15%, 1.0, knit.jersey)

  -- Define panels
  front  = P(%torso.front, contour, 1.15)
  back   = P(%torso.back, contour, 1.15)
  sleeve = P(%arm[0..0.4], contour, 1.2)

  -- Define openings
  neck   = O(@neck, circle, body+8cm)
  hem    = O(@hip, circle, body+10cm)
  cuff   = O(@elbow, circle, body+4cm)

  -- Build order
  BUILD:
    S(front.shoulder, back.shoulder, serged)
    >> S(sleeve.cap, {front.armhole, back.armhole}, serged)
       [G(sleeve.cap, 1.08)]
    >> S(front.side, back.side, serged)
    >> S(sleeve.under, sleeve.under, serged)
    >> F(neck, 1.5cm, in)
    >> F(hem, 2.5cm, in)
    >> F(cuff, 2cm, in)
}`;

editor.value = DEFAULT_SOURCE;

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

// Initial render
update();

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

const EXAMPLES = {
  tshirt: DEFAULT_SOURCE,
  button_shirt: `GARMENT button_shirt [SYM] {

  FABRIC: M(120gsm, crisp, none, 1.0, woven.poplin)

  -- Body panels
  front = P(%torso.front + %leg[0..0.05], contour, 1.15)
  back  = P(%torso.back + %leg[0..0.05], contour, 1.12)
  yoke  = P(%torso.back[0..0.15], rect, 1.0)

  -- Sleeve with placket
  sleeve = P(%arm[0..0.65], contour, 1.2)
  cuff   = P(%wrist, rect, 1.0)

  -- Collar
  collar_stand = P(%neck, rect, 1.0)
  collar_fall  = P(%neck, contour, 1.05)

  -- Openings
  front_opening = O(%torso.front, slit, @neck)
  neck_opening  = O(@neck, circle, body+2cm)
  hem           = O(@hip, circle, body+12cm)
  sleeve_vent   = O(%arm[0.55..0.65], slit)

  -- Placket (button stand)
  placket = P(%torso.front[0..1], rect, 1.0)

  BUILD:
    -- Back yoke
    D(back, @shoulder.L, 4, 8cm)
    >> S(yoke.bottom, back.top, plain)

    -- Shoulders and sides
    >> S(front.shoulder, yoke.shoulder, plain)
    >> S(front.side, back.side, plain)

    -- Sleeve
    >> S(sleeve.cap, {front.armhole, back.armhole}, plain)
       [G(sleeve.cap, 1.1)]
    >> S(sleeve.under, sleeve.under, plain)

    -- Cuff
    >> F(sleeve_vent, 2cm, in)
    >> G(sleeve.cuff_edge, 1.5)
    >> S(cuff.top, sleeve.cuff_edge, plain)
    >> C(cuff, button(1), inner)

    -- Collar
    >> S(collar_stand.top, collar_fall.bottom, plain)
    >> S(collar_stand.bottom, neck_opening, plain)

    -- Button placket (7 buttons, center front)
    >> S(placket.inner, front_opening, plain)
    >> C(front_opening, button(7), center)

    -- Hem
    >> F(hem, 2cm, in)
}`,
  wrap_skirt: `GARMENT wrap_skirt {

  FABRIC: M(200gsm, crisp, none, 1.0, woven.plain)

  front_L = P(%torso.front.L + %leg.L[0..0.2], trapezoid, 1.1)
  front_R = P(%torso.front.R + %leg.R[0..0.2], trapezoid, 1.1)
  back    = P(%torso.back + %leg[0..0.2], trapezoid, 1.1)

  waist     = O(@waist, circle, body+2cm)
  hem_line  = O(@knee, open)

  waistband = P(%waist, rect, 1.0)

  BUILD:
    S(front_L.side, back.side.L, plain)
    >> S(front_R.side, back.side.R, plain)
    >> F(waistband, 2cm, in)
    >> S(waistband.inner, {back.top, front_L.top, front_R.top}, plain)
       [G({front_L.top, front_R.top}, 1.0)]
    >> C(waist, tie, L_wrap_over_R)
    >> F(hem_line, 1cm, in)
}`,
  jacket_collar: `COMPONENT notched_lapel {

  FABRIC: M(280gsm, crisp, none, 1.0, woven.twill)
  INTERLINING: M(80gsm, stiff, none, 1.0, nonwoven)

  collar_stand = P(%neck, rect, 1.0)
  collar_fall  = P(%neck, contour, 1.0)
  lapel        = P(%torso.front[0..0.15], contour, 1.0)

  BUILD:
    FUSE(collar_stand, INTERLINING)
    >> FUSE(collar_fall, INTERLINING)
    >> FUSE(lapel, INTERLINING)
    >> S(collar_stand.top, collar_fall.bottom, plain)
    >> F(collar_fall, gorge_line, out)
    >> S(collar_stand.ends, lapel.notch, plain)
    >> F(lapel, break_point, out)
}`,
  blazer: `GARMENT blazer [SYM] {

  FABRIC: M(280gsm, crisp, none, 1.0, woven.twill)
  INTERLINING: M(80gsm, stiff, none, 1.0, nonwoven)

  -- Body panels
  front        = P(%torso.front + %leg[0..0.1], contour, 1.1)
  back         = P(%torso.back + %leg[0..0.1], contour, 1.08)
  side         = P(%torso.R[0..1], contour, 1.05)

  -- Two-piece sleeve
  sleeve_top   = P(%arm[0..0.7], contour, 1.1)
  sleeve_under = P(%arm[0..0.7], contour, 1.05)

  -- Collar (notched lapel)
  collar_stand = P(%neck, rect, 1.0)
  collar_fall  = P(%neck, contour, 1.0)
  lapel        = P(%torso.front[0..0.15], contour, 1.0)

  -- Welt pocket
  welt         = P(%torso.front[0.5..0.55], rect, 1.0)

  -- Lining
  lining_front  = P(%torso.front + %leg[0..0.08], contour, 1.12)
  lining_back   = P(%torso.back + %leg[0..0.08], contour, 1.1)
  lining_sleeve = P(%arm[0..0.65], contour, 1.12)

  -- Openings
  front_opening = O(%torso.front, slit, @neck)
  neck_opening  = O(@neck, circle, body+2cm)

  BUILD:
    -- Fuse interlinings
    FUSE(front, INTERLINING)
    >> FUSE(collar_stand, INTERLINING)
    >> FUSE(collar_fall, INTERLINING)
    >> FUSE(lapel, INTERLINING)

    -- Darts
    >> D(front, @bust.L, 10, 8cm)
    >> D(back, @shoulder.L, 6, 10cm)

    -- Body assembly
    >> S(front.shoulder, back.shoulder, plain)
    >> S(front.side, side.front, plain)
    >> S(back.side, side.back, plain)

    -- Two-piece sleeve
    >> S(sleeve_top.back, sleeve_under.back, plain)
    >> S(sleeve_top.front, sleeve_under.front, plain)
    >> S(sleeve_top.cap, {front.armhole, back.armhole}, plain)
       [G(sleeve_top.cap, 1.12)]

    -- Collar
    >> S(collar_stand.top, collar_fall.bottom, plain)
    >> S(collar_stand.ends, lapel.notch, plain)
    >> S(collar_stand.bottom, neck_opening, plain)
    >> F(collar_fall, gorge_line, out)
    >> F(lapel, break_point, out)

    -- Welt pocket
    >> S(welt.top, front.pocket_mark, plain)
    >> F(welt, 1cm, in)

    -- Lining assembly
    >> S(lining_front.shoulder, lining_back.shoulder, plain)
    >> S(lining_front.side, lining_back.side, plain)
    >> S(lining_sleeve.cap, {lining_front.armhole, lining_back.armhole}, plain)
    >> S(lining_front.facing, front.facing, plain)

    -- Finish
    >> C(front_opening, button(2), center)
    >> F(front.bottom, 3cm, in)
}`,
  composed_blazer: `-- Reusable components

COMPONENT two_piece_sleeve {
  FABRIC: M(280gsm, crisp, none, 1.0, woven.twill)

  top   = P(%arm[0..0.7], contour, 1.1)
  under = P(%arm[0..0.7], contour, 1.05)
  cuff  = O(@wrist, circle, body+4cm)

  BUILD:
    S(top.back, under.back, plain)
    >> S(top.front, under.front, plain)
    >> F(cuff, 3cm, in)
}

COMPONENT notched_lapel {
  FABRIC: M(280gsm, crisp, none, 1.0, woven.twill)
  INTERLINING: M(80gsm, stiff, none, 1.0, nonwoven)

  collar_stand = P(%neck, rect, 1.0)
  collar_fall  = P(%neck, contour, 1.0)
  lapel        = P(%torso.front[0..0.15], contour, 1.0)

  BUILD:
    FUSE(collar_stand, INTERLINING)
    >> FUSE(collar_fall, INTERLINING)
    >> FUSE(lapel, INTERLINING)
    >> S(collar_stand.top, collar_fall.bottom, plain)
    >> F(collar_fall, gorge_line, out)
    >> S(collar_stand.ends, lapel.notch, plain)
    >> F(lapel, break_point, out)
}

COMPONENT welt_pocket {
  welt = P(%torso.front[0.5..0.55], rect, 1.0)
  bag  = P(%torso.front[0.5..0.7], rect, 1.0)

  BUILD:
    S(welt.top, bag.top, plain)
    >> F(welt, 1cm, in)
}

-- Compose into a full garment

GARMENT blazer [SYM] {
  FABRIC: M(280gsm, crisp, none, 1.0, woven.twill)
  INTERLINING: M(80gsm, stiff, none, 1.0, nonwoven)

  -- Body panels
  front = P(%torso.front + %leg[0..0.1], contour, 1.1)
  back  = P(%torso.back + %leg[0..0.1], contour, 1.08)
  side  = P(%torso.R[0..1], contour, 1.05)

  -- Openings
  front_opening = O(%torso.front, slit, @neck)
  neck_opening  = O(@neck, circle, body+2cm)

  -- Attach components
  sleeve   = USE(two_piece_sleeve)
  collar   = USE(notched_lapel)
  pocket_L = USE(welt_pocket)

  BUILD:
    FUSE(front, INTERLINING)
    >> D(front, @bust.L, 10, 8cm)
    >> D(back, @shoulder.L, 6, 10cm)
    >> S(front.shoulder, back.shoulder, plain)
    >> S(front.side, side.front, plain)
    >> S(back.side, side.back, plain)
    >> ATTACH(sleeve, {front.armhole, back.armhole})
       [G(sleeve.top.cap, 1.12)]
    >> ATTACH(collar, neck_opening)
    >> ATTACH(pocket_L, front.pocket_mark.L)
    >> C(front_opening, button(2), center)
    >> F(front.bottom, 3cm, in)
}`,
  fitted_dress: `GARMENT fitted_dress [SYM] {

  FABRIC: M(200gsm, crisp, none, 1.0, woven.plain)

  -- Princess seam panels (split front and back at bust/shoulder)
  front_center = P(%torso.front.L[0..0.5] + %leg.L[0..0.3], contour, 1.0)
  front_side   = P(%torso.front.L[0.5..1] + %leg.L[0..0.3], contour, 1.0)
  back_center  = P(%torso.back.L[0..0.5] + %leg.L[0..0.3], contour, 1.0)
  back_side    = P(%torso.back.L[0.5..1] + %leg.L[0..0.3], contour, 1.0)

  -- Shape the princess seam edges
  EDGE(front_center.side, curve(@bust.L, -3cm))
  EDGE(front_side.center, curve(@bust.L, 3cm))
  EDGE(back_center.side, curve(@shoulder.L, -2cm))
  EDGE(back_side.center, curve(@shoulder.L, 2cm))

  -- Openings
  neck   = O(@neck, circle, body+2cm)
  hem    = O(@knee, circle, body+4cm)
  zipper = O(%torso.back, slit, @neck)

  -- Lining
  LAYER lining {
    FABRIC: M(80gsm, liquid, none, 0.9, woven.satin)

    front = P(%torso.front + %leg[0..0.1], contour, 1.1)
    back  = P(%torso.back + %leg[0..0.1], contour, 1.1)

    SHARE: [front.armhole, back.armhole, front.neck, back.neck]
    FREE: [front.side, back.side, front.bottom, back.bottom]

    BUILD:
      S(front.shoulder, back.shoulder, plain)
      >> S(front.side, back.side, plain)
  }

  BUILD:
    S(front_center.side, front_side.center, plain)
    >> S(back_center.side, back_side.center, plain)
    >> S(front_center.shoulder, back_center.shoulder, plain)
    >> S(front_side.shoulder, back_side.shoulder, plain)
    >> S(front_side.side, back_side.side, plain)
    >> F(neck, 1cm, in)
    >> F(hem, 3cm, in)
    >> C(zipper, zip(invisible), center_back)
    >> ATTACH_LAYER(lining)
}`,
};

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
    editor.value = EXAMPLES[key];
    examples && (examples.value = key);
    if (push) setExampleInUrl(key);
    update();
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

// Initial load from ?example=...
(() => {
  const params = new URLSearchParams(window.location.search);
  const initial = params.get('example');
  if (initial && (EXAMPLES[initial] || KOROSTELEVA_TEMPLATES[initial])) {
    loadExample(initial, { push: false });
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
