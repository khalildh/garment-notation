// @ts-check
/** @typedef {import('./types.js').Expr} Expr */
/** @typedef {import('./types.js').Block} Block */
/** @typedef {import('./types.js').Program} Program */
/** @typedef {import('./types.js').Declaration} Declaration */
/** @typedef {import('./types.js').Panel} Panel */
/** @typedef {import('./types.js').DartInfo} DartInfo */
/** @typedef {import('./types.js').EdgeInfo} EdgeInfo */
/** @typedef {import('./types.js').RegionDims} RegionDims */

import { getRegionDims, combineRegions, resolveVar } from './body.js';

const SCALE = 4; // px per cm
const PAD = 40;   // padding between pieces
const MARGIN = 30; // margin around all pieces

const COLORS = {
  front: '#dbeafe', back: '#fce7f3', sleeve: '#dcfce7',
  collar: '#fef9c3', waistband: '#ffedd5', skirt: '#e0e7ff',
  cuff: '#f3e8ff', lapel: '#fdf2f8',
  collar_stand: '#fef9c3', collar_fall: '#fef9c3',
  front_L: '#dbeafe', front_R: '#bfdbfe',
};
const DEFAULT_COLOR = '#f1f5f9';
const STROKE = '#334155';
const GRAIN_COLOR = '#94a3b8';
const LABEL_COLOR = '#1e293b';
const DIM_COLOR = '#64748b';
const SEAM_COLORS = ['#ef4444', '#06b6d4', '#84cc16', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];

/**
 * Render flat pattern pieces as SVG.
 * @param {Program} ast
 * @returns {string}
 */
export function render(ast, opts = {}) {
  if (!ast.blocks || ast.blocks.length === 0) return emptySvg();
  const block = resolveMain(ast);
  const resolved = resolveComponents(block, ast);
  const panels = extractPanels(resolved);
  if (panels.length === 0) return emptySvg('No panels found');

  const darts = extractDarts(resolved);
  const openings = extractOpenings(resolved);
  const edges = extractEdges(resolved);
  const liningPanels = extractLiningPanels(resolved);
  const allPanels = [...panels, ...liningPanels];

  // Seam annotations (for visualization in pieces view)
  const seamPairs = extractSeams(resolved);
  const seamIndex = buildSeamIndex(seamPairs);
  annotatePanelSeams(allPanels, seamIndex);

  // Apply darts to panels
  for (const d of darts) {
    const panel = panels.find(p => p.name === d.panel || p.name === d.panel.replace('P_', ''));
    if (panel) panel.darts.push(d);
  }

  // Apply edge definitions to panels
  for (const e of edges) {
    const panel = allPanels.find(p => p.name === e.panel);
    if (panel) panel.edges.push(e);
  }

  // Layout panels in rows
  const positioned = layoutPanels(allPanels);
  const totalW = positioned.totalWidth + MARGIN * 2;
  const totalH = positioned.totalHeight + MARGIN * 2 + 50; // extra for info

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="100%" height="100%">`;
  svg += `<rect width="${totalW}" height="${totalH}" fill="#faf9f7"/>`;

  // Title
  svg += `<text x="${totalW / 2}" y="22" text-anchor="middle" fill="${LABEL_COLOR}" font-size="14" font-weight="600" font-family="system-ui">${block.name}${block.flags.length ? ' [' + block.flags.join(', ') + ']' : ''}</text>`;

  svg += `<g transform="translate(${MARGIN}, ${MARGIN + 24})">`;
  for (const p of positioned.panels) {
    svg += renderPanel(p, { showSeams: !!opts.showSeams });
  }
  // Cross-panel seam connectors
  if (opts.showSeams && seamPairs.length > 0) {
    svg += seamConnectors(positioned.panels, seamPairs);
  }
  svg += '</g>';

  // Info line
  const infoY = totalH - 16;
  const fabricStr = block.fabric ? summarizeFabric(block.fabric) : '';
  const edgeInfo = edges.length ? ` · ${edges.length} edge${edges.length !== 1 ? 's' : ''}` : '';
  const layerInfo = liningPanels.length ? ` · lining (${liningPanels.length} panels)` : '';
  const seamCount = seamPairs.length;
  const seamInfo = opts.showSeams && seamCount > 0 ? ` · ${seamCount} seam${seamCount !== 1 ? 's' : ''}` : '';
  const info = `${panels.length} panel${panels.length !== 1 ? 's' : ''}${openings.length ? ` · ${openings.length} opening${openings.length !== 1 ? 's' : ''}` : ''}${block.build.length ? ` · ${block.build.length} build step${block.build.length !== 1 ? 's' : ''}` : ''}${edgeInfo}${layerInfo}${seamInfo}${fabricStr ? ` · ${fabricStr}` : ''}`;
  svg += `<text x="${totalW / 2}" y="${infoY}" text-anchor="middle" fill="${DIM_COLOR}" font-size="11" font-family="system-ui">${info}</text>`;

  svg += '</svg>';
  return svg;
}

/**
 * @param {{ name: string, value: Expr }} decl
 * @returns {Panel}
 */
function extractPanelFromDecl(decl) {
  const args = decl.value.args;
  const regionExpr = args[0];
  const shapeExpr = args[1];
  const easeExpr = args[2];
  const grainExpr = args[3];

  const dims = resolveRegionDims(regionExpr);
  const shape = resolveShape(shapeExpr);
  const regionName = resolveRegionName(regionExpr);

  // Handle ease(top, bottom) or single scalar
  let easeTop, easeBottom;
  if (easeExpr?.type === 'call' && easeExpr.name === 'ease') {
    easeTop = resolveNumber(easeExpr.args[0]) ?? 1.0;
    easeBottom = resolveNumber(easeExpr.args[1]) ?? easeTop;
  } else {
    const e = resolveNumber(easeExpr) ?? 1.0;
    easeTop = e;
    easeBottom = e;
  }

  // Handle grain parameter (positional or named)
  let grain = 'warp';
  const grainArg = grainExpr || args.find(a => a.type === 'named_arg' && a.name === 'grain');
  if (grainArg) {
    if (grainArg.type === 'named_arg') {
      grain = resolveRef(grainArg.value) || 'warp';
    } else if (grainArg.type === 'reference') {
      grain = grainArg.value;
    } else if (grainArg.type === 'number' && grainArg.unit === 'deg') {
      grain = grainArg.value + '°';
    }
  }

  return {
    name: decl.name,
    region: regionName,
    shape,
    ease: easeTop,
    easeTop,
    easeBottom,
    grain,
    widthTop: dims.widthTop * easeTop,
    widthBottom: dims.widthBottom * easeBottom,
    height: dims.height,
    darts: [],
    edges: [],
    isLining: false,
    shapeParams: shapeExpr?.type === 'call' ? shapeExpr : null,
  };
}

/** @param {Block} block @returns {Panel[]} */
function extractPanels(block) {
  const panels = [];
  for (const decl of block.declarations) {
    if (decl.value.type === 'call' && decl.value.name === 'P') {
      panels.push(extractPanelFromDecl(decl));
    }
  }
  return panels;
}

/** @param {Block} block @returns {Panel[]} */
function extractLiningPanels(block) {
  const panels = [];
  if (!block.layers) return panels;
  for (const layer of block.layers) {
    for (const decl of layer.declarations) {
      if (decl.value.type === 'call' && decl.value.name === 'P') {
        const panel = extractPanelFromDecl({
          ...decl,
          name: 'lining.' + decl.name,
        });
        panel.isLining = true;
        panel.layerName = layer.name;
        panels.push(panel);
      }
    }
  }
  return panels;
}

/** @param {Block} block @returns {EdgeInfo[]} */
function extractEdges(block) {
  const edges = [];
  if (!block.edges) return edges;
  for (const edge of block.edges) {
    if (edge.type === 'call' && edge.name === 'EDGE') {
      const targetRef = resolveRef(edge.args[0]);
      const curveExpr = edge.args[1];
      const parts = targetRef.split('.');
      const panel = parts[0];
      const edgeName = parts.slice(1).join('.');

      let curvature = 0;
      let landmark = '';
      if (curveExpr?.type === 'call' && curveExpr.name === 'curve') {
        landmark = curveExpr.args[0]?.value?.replace(/^@/, '') || '';
        curvature = resolveNumber(curveExpr.args[1]) ?? 0;
      }

      edges.push({ panel, edge: edgeName, landmark, curvature });
    }
  }
  return edges;
}

/** @param {Block} block @returns {DartInfo[]} */
function extractDarts(block) {
  const darts = [];
  for (const step of block.build) {
    const op = step.operation;
    if (op.type === 'call' && op.name === 'D') {
      darts.push({
        panel: resolveRef(op.args[0]),
        location: op.args[1],
        angle: resolveNumber(op.args[2]) ?? 10,
        length: resolveNumber(op.args[3]) ?? 8,
      });
    }
    if (step.modifier?.type === 'call' && step.modifier.name === 'D') {
      const m = step.modifier;
      darts.push({
        panel: resolveRef(m.args[0]),
        location: m.args[1],
        angle: resolveNumber(m.args[2]) ?? 10,
        length: resolveNumber(m.args[3]) ?? 8,
      });
    }
  }
  return darts;
}

function extractOpenings(block) {
  const openings = [];
  for (const decl of block.declarations) {
    if (decl.value.type === 'call' && decl.value.name === 'O') {
      openings.push({ name: decl.name, args: decl.value.args });
    }
  }
  return openings;
}

// --- Seams (from BUILD S(...)) ---

function extractSeams(block) {
  /** @type {{id:number, a:string, b:string, type:string}[]} */
  const pairs = [];
  let sid = 1;
  for (const step of block.build) {
    const op = step.operation;
    if (!op || op.type !== 'call' || op.name !== 'S') continue;
    const args = op.args || [];
    if (args.length < 2) continue;
    const type = (args[2]?.type === 'reference') ? args[2].value : 'plain';
    const listA = expandEdgeRefList(args[0]);
    const listB = expandEdgeRefList(args[1]);
    if (listA.length === 0 || listB.length === 0) continue;
    if (listA.length > 1 && listB.length > 1 && listA.length === listB.length) {
      for (let i = 0; i < listA.length; i++) pairs.push({ id: sid, a: listA[i], b: listB[i], type });
    } else if (listA.length > 1 && listB.length === 1) {
      for (const a of listA) pairs.push({ id: sid, a, b: listB[0], type });
    } else if (listB.length > 1 && listA.length === 1) {
      for (const b of listB) pairs.push({ id: sid, a: listA[0], b, type });
    } else {
      pairs.push({ id: sid, a: listA[0], b: listB[0], type });
    }
    sid++;
  }
  return pairs;
}

function expandEdgeRefList(expr) {
  if (!expr) return [];
  if (expr.type === 'set' && Array.isArray(expr.elements)) {
    return expr.elements.map(e => resolveRef(e)).filter(Boolean);
  }
  const s = resolveRef(expr);
  return s ? [s] : [];
}

function buildSeamIndex(pairs) {
  /** @type {Record<string, { id:number, type:string, edge:string, partner:string, color:string }[]>} */
  const index = {};
  for (const p of pairs) {
    const color = SEAM_COLORS[(p.id - 1) % SEAM_COLORS.length];
    const [pa, ea] = splitPanelEdge(p.a);
    const [pb, eb] = splitPanelEdge(p.b);
    if (pa) {
      index[pa] ||= [];
      index[pa].push({ id: p.id, type: p.type, edge: ea, partner: pb + '.' + eb, color });
    }
    if (pb) {
      index[pb] ||= [];
      index[pb].push({ id: p.id, type: p.type, edge: eb, partner: pa + '.' + ea, color });
    }
  }
  return index;
}

function annotatePanelSeams(panels, seamIndex) {
  for (const panel of panels) {
    const list = seamIndex[panel.name];
    if (list && list.length) panel.seams = list;
  }
}

function splitPanelEdge(ref) {
  if (!ref) return ['', ''];
  const i = ref.indexOf('.');
  if (i === -1) return [ref, ''];
  return [ref.slice(0, i), ref.slice(i + 1)];
}

/** @param {Expr | undefined} expr @returns {RegionDims} */
function resolveRegionDims(expr) {
  if (!expr) return { widthTop: 30, widthBottom: 30, height: 30 };
  if (expr.type === 'region') return getRegionDims(expr.value, expr.range);
  if (expr.type === 'binary' && expr.op === '+') {
    return combineRegions(resolveRegionDims(expr.left), resolveRegionDims(expr.right));
  }
  return { widthTop: 30, widthBottom: 30, height: 30 };
}

function resolveRegionName(expr) {
  if (!expr) return '';
  if (expr.type === 'region') return expr.value.replace(/^%/, '');
  if (expr.type === 'binary' && expr.op === '+') {
    return resolveRegionName(expr.left) + '+' + resolveRegionName(expr.right);
  }
  return '';
}

function resolveShape(expr) {
  if (!expr) return 'rect';
  if (expr.type === 'reference') return expr.value;
  if (expr.type === 'call') return expr.name;
  return 'rect';
}

/** @param {Expr | undefined} expr @returns {number | null} */
function resolveNumber(expr) {
  if (!expr) return null;
  if (expr.type === 'number') return expr.value;
  if (expr.type === 'binary' && expr.op === '*') {
    const l = resolveNumber(expr.left);
    const r = resolveNumber(expr.right) ?? resolveVar(resolveRef(expr.right));
    if (l != null && r != null) return l * r;
  }
  return null;
}

function resolveRef(expr) {
  if (!expr) return '';
  if (expr.type === 'reference') return expr.value;
  if (expr.type === 'landmark') return expr.value.replace(/^@/, '');
  return '';
}

function summarizeFabric(expr) {
  if (expr.type !== 'call') return '';
  return expr.args.map(a => {
    if (a.type === 'number') return a.value + (a.unit || '');
    if (a.type === 'reference') return a.value;
    if (a.type === 'modifier') {
      const base = a.base?.value ?? '';
      const val = a.value?.type === 'number' ? a.value.value + (a.value.unit || '') : '';
      return base + ':' + val;
    }
    return '';
  }).filter(Boolean).join(', ');
}

// --- Layout ---

function layoutPanels(panels) {
  const items = panels.map(p => ({
    ...p,
    w: Math.max(p.widthTop, p.widthBottom) * SCALE,
    h: p.height * SCALE,
  }));

  // Simple row-based layout
  const maxRowW = 700;
  let x = 0, y = 0, rowH = 0;
  let totalW = 0;

  for (const item of items) {
    if (x > 0 && x + item.w > maxRowW) {
      x = 0;
      y += rowH + PAD;
      rowH = 0;
    }
    item.x = x;
    item.y = y;
    x += item.w + PAD;
    rowH = Math.max(rowH, item.h);
    totalW = Math.max(totalW, x);
  }

  return {
    panels: items,
    totalWidth: totalW,
    totalHeight: y + rowH,
  };
}

// --- Drawing ---

const LINING_COLOR = '#e8e0f0';
const LINING_STROKE = '#8b7fa8';
const EDGE_CURVE_COLOR = '#e11d48';

function renderPanel(p, opts = {}) {
  const w = p.w, h = p.h;
  const isLining = p.isLining;
  const fill = isLining ? LINING_COLOR : (COLORS[p.name] || DEFAULT_COLOR);
  const stroke = isLining ? LINING_STROKE : STROKE;
  const path = panelPath(p);

  let g = `<g transform="translate(${p.x}, ${p.y})">`;

  // Shadow
  g += `<g transform="translate(2, 2)" opacity="0.08">${pathEl(path, '#000', '#000')}</g>`;

  // Panel shape
  g += pathEl(path, fill, stroke);

  // Lining cross-hatch pattern
  if (isLining) {
    const clipId = 'clip-' + p.name.replace(/\./g, '-');
    g += `<defs><clipPath id="${clipId}"><path d="${path}"/></clipPath></defs>`;
    g += `<g clip-path="url(#${clipId})" opacity="0.15">`;
    for (let i = -h; i < w + h; i += 8) {
      g += `<line x1="${i}" y1="0" x2="${i + h}" y2="${h}" stroke="${LINING_STROKE}" stroke-width="0.5"/>`;
    }
    g += '</g>';
  }

  // Edge curves (princess seam indicators)
  if (p.edges && p.edges.length > 0) {
    for (const e of p.edges) {
      g += edgeCurveMark(w, h, e);
    }
  }

  // Grain line
  g += grainLine(w, h, p.grain);

  // Seams (optional overlay)
  if (opts.showSeams && p.seams && p.seams.length > 0) {
    for (const s of p.seams) {
      g += seamOverlay(w, h, s);
    }
  }

  // Darts
  for (const d of p.darts) {
    g += dartMark(w, h, d);
  }

  // Label
  const displayName = p.name.length > 16 ? p.name.split('.').pop() : p.name;
  g += `<text x="${w / 2}" y="${h / 2 - 6}" text-anchor="middle" fill="${LABEL_COLOR}" font-size="${isLining ? 10 : 12}" font-weight="600" font-family="system-ui">${displayName}</text>`;

  // Dimensions
  const widthCm = Math.max(p.widthTop, p.widthBottom) * p.ease;
  g += `<text x="${w / 2}" y="${h / 2 + 10}" text-anchor="middle" fill="${DIM_COLOR}" font-size="9" font-family="system-ui">${fmtCm(widthCm)} × ${fmtCm(p.height)}</text>`;

  // Shape + ease + grain label
  const easeLabel = p.easeTop === p.easeBottom ? `ease ${p.easeTop}` : `ease ${p.easeTop}→${p.easeBottom}`;
  const grainLabel = p.grain !== 'warp' ? ` · ${p.grain}` : '';
  const liningLabel = isLining ? ' · lining' : '';
  const edgeLabel = (p.edges?.length > 0) ? ' · shaped' : '';
  g += `<text x="${w / 2}" y="${h / 2 + 22}" text-anchor="middle" fill="${DIM_COLOR}" font-size="8" font-family="system-ui">${p.shape} · ${easeLabel}${grainLabel}${liningLabel}${edgeLabel}</text>`;

  g += '</g>';
  return g;
}

function edgeCurveMark(w, h, edge) {
  // Draw a curved line on the panel edge to indicate princess seam shaping
  const curvature = Math.abs(edge.curvature) * SCALE;
  const isInward = edge.curvature < 0;
  const edgeName = edge.edge;

  // Determine which side of the panel the edge is on
  let x, y1, y2, cx;
  if (edgeName.includes('side') || edgeName.includes('outer') || edgeName.includes('right')) {
    x = w;
    y1 = h * 0.1;
    y2 = h * 0.9;
    cx = isInward ? x - curvature : x + curvature;
  } else if (edgeName.includes('center') || edgeName.includes('inner') || edgeName.includes('left')) {
    x = 0;
    y1 = h * 0.1;
    y2 = h * 0.9;
    cx = isInward ? x + curvature : x - curvature;
  } else {
    // Default: right side
    x = w;
    y1 = h * 0.1;
    y2 = h * 0.9;
    cx = isInward ? x - curvature : x + curvature;
  }

  const cy = (y1 + y2) / 2;

  return `<path d="M ${x},${y1} Q ${cx},${cy} ${x},${y2}" fill="none" stroke="${EDGE_CURVE_COLOR}" stroke-width="1.5" stroke-dasharray="4,2"/>`;
}

function panelPath(p) {
  const w = p.w, h = p.h;
  const region = p.region;

  if (p.shape === 'contour') {
    if (region.includes('arm')) return sleevePath(w, h);
    if (region.includes('torso') || region.includes('front') || region.includes('back')) return torsoPath(w, h);
    if (region.includes('leg')) return legPath(w, h);
  }

  if (p.shape === 'trapezoid') {
    const ratio = p.widthTop / p.widthBottom;
    const topW = w * Math.min(ratio, 1);
    const botW = w;
    if (ratio < 1) {
      const inset = (botW - topW) / 2;
      return `M ${inset},0 L ${inset + topW},0 L ${botW},${h} L 0,${h} Z`;
    } else {
      const inset = (topW - botW) / 2;
      return `M 0,0 L ${topW},0 L ${topW - inset},${h} L ${inset},${h} Z`;
    }
  }

  // rect / default
  return `M 0,0 L ${w},0 L ${w},${h} L 0,${h} Z`;
}

function torsoPath(w, h) {
  const waistY = h * 0.6;
  const indent = w * 0.045;
  return `M 0,0 L ${w},0 Q ${w - indent},${waistY} ${w},${h} L 0,${h} Q ${indent},${waistY} 0,0 Z`;
}

function sleevePath(w, h) {
  const capH = h * 0.22;
  return `M 0,${capH} Q ${w * 0.25},0 ${w / 2},0 Q ${w * 0.75},0 ${w},${capH} L ${w},${h} L 0,${h} Z`;
}

function legPath(w, h) {
  const taper = w * 0.1;
  return `M ${taper},0 L ${w - taper},0 L ${w},${h} L 0,${h} Z`;
}

function pathEl(d, fill, stroke) {
  return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round"/>`;
}

// ---- Seams overlay utilities ----

function seamOverlay(w, h, seam) {
  const side = edgeNameToSide(seam.edge);
  const inset = 3;
  let x1, y1, x2, y2, lx, ly;
  switch (side) {
    case 'top':
      x1 = inset; y1 = inset; x2 = w - inset; y2 = inset; lx = w / 2; ly = inset - 6; break;
    case 'bottom':
      x1 = inset; y1 = h - inset; x2 = w - inset; y2 = h - inset; lx = w / 2; ly = h - inset + 10; break;
    case 'left':
      x1 = inset; y1 = inset; x2 = inset; y2 = h - inset; lx = inset - 8; ly = h / 2; break;
    case 'right':
      x1 = w - inset; y1 = inset; x2 = w - inset; y2 = h - inset; lx = w - inset + 8; ly = h / 2; break;
    default:
      x1 = inset; y1 = inset; x2 = w - inset; y2 = inset; lx = w / 2; ly = inset - 6; break;
  }
  const stroke = seam.color || '#ef4444';
  const style = seamStrokeStyle(seam.type);
  let o = '';
  o += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="1.3" ${style}/>`;
  o += `<circle cx="${lx}" cy="${ly}" r="6" fill="#ffffff" stroke="${stroke}" stroke-width="1"/>`;
  o += `<text x="${lx}" y="${ly + 2}" text-anchor="middle" fill="${stroke}" font-size="8" font-family="system-ui" font-weight="700">${seam.id}</text>`;
  return o;
}

function seamStrokeStyle(t) {
  switch (t) {
    case 'plain': return 'stroke-dasharray="5,3"';
    case 'french': return 'stroke-dasharray="2,2"';
    case 'felled': return 'stroke-dasharray="8,3"';
    case 'lapped': return 'stroke-dasharray="6,2,2,2"';
    case 'bound': return '';
    case 'serged': return 'stroke-dasharray="1,2"';
    default: return 'stroke-dasharray="5,3"';
  }
}

function edgeNameToSide(name) {
  const n = String(name || '');
  if (n.includes('shoulder') || n === 'top' || n === 'cap') return 'top';
  if (n.includes('bottom') || n.includes('hem') || n === 'cuff_edge') return 'bottom';
  if (n === 'side' || n === 'side.L' || n === 'front' || n === 'under') return 'left';
  if (n === 'side.R' || n === 'back' || n === 'armhole') return 'right';
  return 'top';
}

// Draw curved connectors between panels for each seam pair
function seamConnectors(items, seamPairs) {
  /** @type {Record<string, any>} */
  const byName = {};
  for (const it of items) byName[it.name] = it;
  const drawn = new Set();
  let s = '';
  for (const pair of seamPairs) {
    const key = pair.a < pair.b ? pair.a + '|' + pair.b : pair.b + '|' + pair.a;
    if (drawn.has(key)) continue;
    drawn.add(key);
    const color = SEAM_COLORS[(pair.id - 1) % SEAM_COLORS.length];
    const [pa, ea] = splitPanelEdge(pair.a);
    const [pb, eb] = splitPanelEdge(pair.b);
    const A = byName[pa];
    const B = byName[pb];
    if (!A || !B) continue;
    const sideA = edgeNameToSide(ea);
    const sideB = edgeNameToSide(eb);
    const p1 = anchorForSide(A, sideA);
    const p2 = anchorForSide(B, sideB);
    const c1 = controlForSide(p1, sideA);
    const c2 = controlForSide(p2, sideB);
    const style = seamStrokeStyle(pair.type);
    s += `<path d="M ${p1.x},${p1.y} C ${c1.x},${c1.y} ${c2.x},${c2.y} ${p2.x},${p2.y}" fill="none" stroke="${color}" stroke-width="1.2" ${style} opacity="0.7"/>`;
  }
  return s;
}

function anchorForSide(item, side) {
  const inset = 6;
  switch (side) {
    case 'top': return { x: item.x + item.w / 2, y: item.y + inset };
    case 'bottom': return { x: item.x + item.w / 2, y: item.y + item.h - inset };
    case 'left': return { x: item.x + inset, y: item.y + item.h / 2 };
    case 'right': return { x: item.x + item.w - inset, y: item.y + item.h / 2 };
    default: return { x: item.x + item.w / 2, y: item.y + inset };
  }
}

function controlForSide(p, side) {
  const k = 40;
  switch (side) {
    case 'top': return { x: p.x, y: p.y - k };
    case 'bottom': return { x: p.x, y: p.y + k };
    case 'left': return { x: p.x - k, y: p.y };
    case 'right': return { x: p.x + k, y: p.y };
    default: return { x: p.x, y: p.y - k };
  }
}

function grainLine(w, h, grain) {
  const cx = w / 2;
  const cy = h / 2;
  const len = h * 0.35;
  const arrowSize = 5;

  // Determine angle from grain type
  let angle = 0; // warp = vertical = 0°
  if (grain === 'weft') angle = 90;
  else if (grain === 'bias') angle = 45;
  else if (typeof grain === 'string' && grain.endsWith('°')) angle = parseFloat(grain);

  const rad = angle * Math.PI / 180;
  const dx = Math.sin(rad) * len;
  const dy = Math.cos(rad) * len;

  const x1 = cx - dx, y1 = cy - dy;
  const x2 = cx + dx, y2 = cy + dy;

  // Arrow at top end
  const aRad = rad;
  const ax1 = x1 + Math.sin(aRad - 0.4) * arrowSize;
  const ay1 = y1 + Math.cos(aRad - 0.4) * arrowSize;
  const ax2 = x1 + Math.sin(aRad + 0.4) * arrowSize;
  const ay2 = y1 + Math.cos(aRad + 0.4) * arrowSize;

  return `
    <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${GRAIN_COLOR}" stroke-width="0.8" stroke-dasharray="4,3"/>
    <polygon points="${x1},${y1} ${ax1},${ay1} ${ax2},${ay2}" fill="${GRAIN_COLOR}"/>
  `;
}

function dartMark(w, h, dart) {
  const cx = w * 0.7;
  const cy = h * 0.35;
  const len = dart.length * SCALE * 0.5;
  const halfAngle = (dart.angle / 2) * (Math.PI / 180);
  const dx = Math.sin(halfAngle) * len;
  const dy = Math.cos(halfAngle) * len;
  return `
    <line x1="${cx}" y1="${cy}" x2="${cx - dx}" y2="${cy + dy}" stroke="${STROKE}" stroke-width="1" stroke-dasharray="3,2"/>
    <line x1="${cx}" y1="${cy}" x2="${cx + dx}" y2="${cy + dy}" stroke="${STROKE}" stroke-width="1" stroke-dasharray="3,2"/>
  `;
}

// --- Component resolution ---

/** @param {Program} ast @returns {Block} */
function resolveMain(ast) {
  // Prefer the GARMENT block; fall back to first block
  return ast.blocks.find(b => b.type === 'garment') || ast.blocks[ast.blocks.length - 1];
}

/**
 * Expand USE() declarations by pulling panels from referenced components.
 * @param {Block} block
 * @param {Program} ast
 * @returns {Block}
 */
function resolveComponents(block, ast) {
  // Find USE() declarations and expand them by pulling in panels from the referenced component
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
        // Prefix component panels with the instance name
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

  // Merge component build steps
  const expandedBuild = [...block.build];
  for (const decl of block.declarations) {
    if (decl.value.type === 'call' && decl.value.name === 'USE') {
      const compName = resolveRef(decl.value.args[0]);
      const comp = components[compName];
      if (comp) expandedBuild.push(...comp.build);
    }
  }

  return { ...block, declarations: expanded, build: expandedBuild, edges: block.edges || [], layers: block.layers || [] };
}

function fmtCm(v) { return v.toFixed(1) + 'cm'; }

function emptySvg(msg) {
  const text = msg || 'Write GNL to see pattern pieces';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" width="100%" height="100%">
    <rect width="400" height="200" fill="#faf9f7"/>
    <text x="200" y="100" text-anchor="middle" fill="#94a3b8" font-size="14" font-family="system-ui">${text}</text>
  </svg>`;
}
