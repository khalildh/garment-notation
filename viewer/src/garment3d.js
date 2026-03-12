// @ts-check
/**
 * GNL AST → 3D cloth panels + seam constraints.
 * Follows the same AST traversal pattern as assembler.js.
 */

import { getRegionDims, combineRegions } from './body.js';
import { createCloth, pinParticle, createSeamConstraints } from './cloth.js';
import { getBodyDims } from './body3d.js';

/**
 * @typedef {{
 *   name: string,
 *   cloth: import('./cloth.js').Cloth,
 *   region: string,
 *   role: 'front' | 'back' | 'sleeve' | 'other',
 *   color: string,
 * }} ClothPanel
 */

const PANEL_COLORS = {
  front: 0xdbeafe,
  back: 0xfce7f3,
  sleeve: 0xdcfce7,
  other: 0xe5e7eb,
};

const MAX_GRID = 25;
const GRID_SPACING = 2; // cm per grid cell

/**
 * Parse AST and create 3D cloth panels + seam constraints.
 * @param {{ type: string, blocks: any[] }} ast
 * @returns {{ panels: ClothPanel[], seams: ReturnType<typeof createSeamConstraints>[] }}
 */
export function createGarment3D(ast) {
  if (!ast.blocks || ast.blocks.length === 0) return { panels: [], seams: [] };

  const block = resolveMain(ast);
  const resolved = resolveComponents(block, ast);
  const panelInfos = extractPanelInfo(resolved);
  const body = getBodyDims();

  const panels = [];
  const panelMap = {};

  // Create cloth for each panel
  for (const [name, info] of Object.entries(panelInfos)) {
    const widthCm = info.dims.widthTop * info.ease;
    const heightCm = info.dims.height;
    const cols = Math.min(Math.ceil(widthCm / GRID_SPACING), MAX_GRID);
    const rows = Math.min(Math.ceil(heightCm / GRID_SPACING), MAX_GRID);
    if (cols < 2 || rows < 2) continue;

    const spacingX = widthCm / (cols - 1);
    const spacingY = heightCm / (rows - 1);
    const cloth = createCloth(cols, rows, spacingX, spacingY);
    const role = classifyPanel(name, info.region);

    // Position cloth around body
    positionCloth(cloth, role, body, widthCm, heightCm);

    // Pin top row at shoulders/attachment points
    pinTopRow(cloth, role);

    const panel = {
      name,
      cloth,
      region: info.region,
      role,
      color: PANEL_COLORS[role] || PANEL_COLORS.other,
    };
    panels.push(panel);
    panelMap[name] = panel;
  }

  // Extract seam constraints from BUILD steps
  const seams = extractSeams(resolved, panelMap);

  return { panels, seams };
}

/**
 * Classify panel role based on name and region.
 */
function classifyPanel(name, region) {
  if (name.includes('sleeve') || region.includes('arm')) return 'sleeve';
  if (name.includes('back') || region.includes('back')) return 'back';
  if (name.includes('front') || region.includes('front')) return 'front';
  return 'other';
}

/**
 * Position cloth particles around the mannequin body.
 * Uses elliptical wrapping to match the body's side-to-side vs front-to-back shape.
 */
function positionCloth(cloth, role, body, widthCm, heightCm) {
  const { cols, rows, positions } = cloth;
  const { torsoLen, shoulderHW, upperArmR, armLen, shoulderAttachY } = body;
  const depthRatio = body.depthRatio || 0.75;
  const easeOffset = 1.5;

  if (role === 'front') {
    const angleSpan = Math.PI;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = (r * cols + c) * 3;
        const u = cols > 1 ? c / (cols - 1) : 0.5;
        const v = rows > 1 ? r / (rows - 1) : 0;
        const angle = -angleSpan / 2 + u * angleSpan;
        const rx = getBodyRadiusAtHeight(1 - v, body) + easeOffset;
        const rz = rx * depthRatio + easeOffset;
        const y = torsoLen * (1 - v);

        positions[idx] = Math.sin(angle) * rx;
        positions[idx + 1] = y;
        positions[idx + 2] = Math.cos(angle) * rz;
      }
    }
  } else if (role === 'back') {
    const angleSpan = Math.PI;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = (r * cols + c) * 3;
        const u = cols > 1 ? c / (cols - 1) : 0.5;
        const v = rows > 1 ? r / (rows - 1) : 0;
        const angle = angleSpan / 2 + u * angleSpan;
        const rx = getBodyRadiusAtHeight(1 - v, body) + easeOffset;
        const rz = rx * depthRatio + easeOffset;
        const y = torsoLen * (1 - v);

        positions[idx] = Math.sin(angle) * rx;
        positions[idx + 1] = y;
        positions[idx + 2] = Math.cos(angle) * rz;
      }
    }
  } else if (role === 'sleeve') {
    const attachY = shoulderAttachY || torsoLen;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = (r * cols + c) * 3;
        const u = cols > 1 ? c / (cols - 1) : 0.5;
        const v = rows > 1 ? r / (rows - 1) : 0;
        const angle = u * Math.PI * 2;
        const armY = attachY - 1 - v * armLen;
        const currentR = lerp(upperArmR + 1, upperArmR * 0.7 + 1, v);

        positions[idx] = -shoulderHW + Math.cos(angle) * currentR;
        positions[idx + 1] = armY;
        positions[idx + 2] = Math.sin(angle) * currentR;
      }
    }
  } else {
    const rx = getBodyRadiusAtHeight(0.3, body);
    const rz = rx * depthRatio;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = (r * cols + c) * 3;
        const u = cols > 1 ? c / (cols - 1) : 0.5;
        const v = rows > 1 ? r / (rows - 1) : 0;

        positions[idx] = (u - 0.5) * widthCm;
        positions[idx + 1] = torsoLen * (1 - v);
        positions[idx + 2] = rz + 3;
      }
    }
  }

  // Copy to prevPositions
  cloth.prevPositions.set(positions);
}

function smoothstep(t) {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
}

/**
 * Get body radius at a proportional height (0=neck/top, 1=bottom).
 * Matches the smoothstep profile in body3d.js.
 */
function getBodyRadiusAtHeight(prop, body) {
  const { neckR, bustR, waistR, hipR, shoulderHW, bustY, waistY, hipY } = body;
  const shoulderProp = 0.07;

  if (prop <= shoulderProp) {
    return lerp(neckR, shoulderHW || bustR, smoothstep(prop / shoulderProp));
  } else if (prop <= bustY) {
    return lerp(shoulderHW || bustR, bustR, smoothstep((prop - shoulderProp) / (bustY - shoulderProp)));
  } else if (prop <= waistY) {
    return lerp(bustR, waistR, smoothstep((prop - bustY) / (waistY - bustY)));
  } else if (prop <= hipY) {
    return lerp(waistR, hipR, smoothstep((prop - waistY) / (hipY - waistY)));
  }
  return hipR;
}

/**
 * Pin the top row of particles to keep cloth attached.
 */
function pinTopRow(cloth, role) {
  const { cols } = cloth;
  // Pin top row
  for (let c = 0; c < cols; c++) {
    pinParticle(cloth, c);
  }
  // For front/back, also pin the second row for stability
  if (role === 'front' || role === 'back') {
    for (let c = 0; c < cols; c++) {
      pinParticle(cloth, cols + c);
    }
  }
}

/**
 * Extract seam constraints from BUILD steps.
 */
function extractSeams(block, panelMap) {
  const seams = [];

  for (const step of block.build) {
    const op = step.operation;
    if (!op || op.type !== 'call' || op.name !== 'S') continue;

    const args = op.args;
    if (!args || args.length < 2) continue;

    const refA = resolveRef(args[0]);
    const refB = resolveRef(args[1]);
    if (!refA || !refB) continue;

    // Parse "panel.edge" format
    const [panelA, edgeA] = splitRef(refA);
    const [panelB, edgeB] = splitRef(refB);

    const pA = panelMap[panelA];
    const pB = panelMap[panelB];
    if (!pA || !pB) continue;

    const indicesA = getEdgeIndices(pA.cloth, edgeA);
    const indicesB = getEdgeIndices(pB.cloth, edgeB);
    if (indicesA.length === 0 || indicesB.length === 0) continue;

    seams.push(...createSeamConstraints(pA.cloth, indicesA, pB.cloth, indicesB));
  }

  return seams;
}

/**
 * Split "panel.edge" → [panel, edge].
 */
function splitRef(ref) {
  const dot = ref.indexOf('.');
  if (dot === -1) return [ref, ''];
  return [ref.substring(0, dot), ref.substring(dot + 1)];
}

/**
 * Get particle indices for a named edge of a cloth grid.
 */
function getEdgeIndices(cloth, edge) {
  const { cols, rows } = cloth;
  const indices = [];

  const name = String(edge || '');

  // --- Top / Bottom rows ---
  if (name === 'shoulder' || name === 'top' || name === 'cap' || name.includes('neck')) {
    for (let c = 0; c < cols; c++) indices.push(c);
    return indices;
  }
  if (name === 'bottom' || name === 'hem' || name === 'cuff' || name === 'cuff_edge') {
    for (let c = 0; c < cols; c++) indices.push((rows - 1) * cols + c);
    return indices;
  }

  // --- Left column variants ---
  if (
    name === 'side' ||
    name === 'side.L' ||
    name === 'front' ||
    name === 'under' ||
    /^side[_.-]?l(\d+)?$/i.test(name) ||
    /(^|[_.-])left(\d+)?$/i.test(name)
  ) {
    for (let r = 0; r < rows; r++) indices.push(r * cols);
    return indices;
  }

  // --- Right column variants ---
  if (
    name === 'side.R' ||
    name === 'back' ||
    name === 'armhole' ||
    /^side[_.-]?r(\d+)?$/i.test(name) ||
    /(^|[_.-])right(\d+)?$/i.test(name)
  ) {
    for (let r = 0; r < rows; r++) indices.push(r * cols + cols - 1);
    return indices;
  }

  // armhole (partial) — keep behavior for smaller span on right
  if (name === 'armhole_right' || name === 'armhole.R') {
    for (let r = 0; r < Math.min(rows, Math.ceil(rows * 0.4)); r++) {
      indices.push(r * cols + cols - 1);
    }
    return indices;
  }

  // Fallback: top row
  for (let c = 0; c < cols; c++) indices.push(c);
  
  return indices;
}

// --- AST helpers (mirror assembler.js) ---

function resolveMain(ast) {
  return ast.blocks.find(b => b.type === 'garment') || ast.blocks[ast.blocks.length - 1];
}

function resolveComponents(block, ast) {
  const components = {};
  for (const b of ast.blocks) {
    if (b.type === 'component') components[b.name] = b;
  }

  const expanded = [];
  for (const decl of block.declarations) {
    if (decl.value.type === 'call' && decl.value.name === 'USE') {
      const compName = resolveRef(decl.value.args[0]);
      const comp = components[compName];
      if (comp) {
        for (const cdecl of comp.declarations) {
          if (cdecl.value.type === 'call' && cdecl.value.name === 'P') {
            expanded.push({
              ...cdecl,
              name: decl.name + '.' + cdecl.name,
              _component: compName,
              _instance: decl.name,
            });
          }
        }
      }
    } else {
      expanded.push(decl);
    }
  }

  const expandedBuild = [...block.build];
  for (const decl of block.declarations) {
    if (decl.value.type === 'call' && decl.value.name === 'USE') {
      const compName = resolveRef(decl.value.args[0]);
      const comp = components[compName];
      if (comp) expandedBuild.push(...comp.build);
    }
  }

  return { ...block, declarations: expanded, build: expandedBuild };
}

function extractPanelInfo(block) {
  const panels = {};
  for (const decl of block.declarations) {
    if (decl.value.type === 'call' && decl.value.name === 'P') {
      const args = decl.value.args;
      const region = resolveRegionStr(args[0]);
      const ease = resolveNumber(args[2]) ?? 1.0;
      const dims = resolveRegionDimsExpr(args[0]);
      panels[decl.name] = { region, ease, dims };
    }
  }
  return panels;
}

function resolveRegionStr(expr) {
  if (!expr) return '';
  if (expr.type === 'region') return expr.value.replace(/^%/, '');
  if (expr.type === 'binary' && expr.op === '+') {
    return resolveRegionStr(expr.left) + '+' + resolveRegionStr(expr.right);
  }
  return '';
}

function resolveRegionDimsExpr(expr) {
  if (!expr) return { widthTop: 30, widthBottom: 30, height: 30 };
  if (expr.type === 'region') return getRegionDims(expr.value, expr.range);
  if (expr.type === 'binary' && expr.op === '+') {
    return combineRegions(resolveRegionDimsExpr(expr.left), resolveRegionDimsExpr(expr.right));
  }
  return { widthTop: 30, widthBottom: 30, height: 30 };
}

function resolveNumber(expr) {
  if (!expr) return null;
  if (expr.type === 'number') return expr.value;
  return null;
}

function resolveRef(expr) {
  if (!expr) return '';
  if (expr.type === 'reference') return expr.value;
  // Handle compound refs like {front.armhole, back.armhole}
  if (expr.type === 'set' && expr.elements?.length > 0) {
    return resolveRef(expr.elements[0]);
  }
  return '';
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
