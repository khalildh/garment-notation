import { getRegionDims, combineRegions, BODY } from './body.js';

const SCALE = 4;
const STROKE = '#334155';
const FILL_FRONT = '#dbeafe';
const FILL_BACK = '#fce7f3';
const FILL_SLEEVE = '#dcfce7';
const FILL_COLLAR = '#fef9c3';
const FILL_WAISTBAND = '#ffedd5';
const LABEL_COLOR = '#1e293b';
const DIM_COLOR = '#64748b';
const STITCH_COLOR = '#94a3b8';

export function assemble(ast) {
  if (!ast.blocks || ast.blocks.length === 0) return emptySvg();
  const block = resolveMain(ast);
  const resolved = resolveComponents(block, ast);
  const panels = extractPanelInfo(resolved);
  const garmentType = detectGarmentType(panels, resolved);

  switch (garmentType) {
    case 'top': return drawTop(resolved, panels);
    case 'skirt': return drawSkirt(resolved, panels);
    case 'collar': return drawCollar(resolved, panels);
    default: return drawGeneric(resolved, panels);
  }
}

function extractPanelInfo(block) {
  const panels = {};
  for (const decl of block.declarations) {
    if (decl.value.type === 'call' && decl.value.name === 'P') {
      const args = decl.value.args;
      const region = resolveRegionStr(args[0]);
      const shape = args[1]?.value || args[1]?.name || 'rect';
      const ease = resolveNumber(args[2]) ?? 1.0;
      const dims = resolveRegionDims(args[0]);

      panels[decl.name] = { region, shape, ease, dims, raw: decl.value };
    }
  }
  return panels;
}

function detectGarmentType(panels, block) {
  const names = Object.keys(panels);
  const regions = Object.values(panels).map(p => p.region);

  const hasCollar = names.some(n => n.includes('collar') || n.includes('lapel'));
  const hasSleeve = names.some(n => n.includes('sleeve')) || regions.some(r => r.includes('arm'));
  const hasTorso = names.some(n => n === 'front' || n === 'back') || regions.some(r => r.includes('torso'));
  const hasLeg = regions.some(r => r.includes('leg') && !r.includes('arm'));

  // A collar component alone is 'collar', but collar + body/sleeves is a 'top'
  if (hasCollar && !hasSleeve && !hasTorso) return 'collar';
  if (hasSleeve || hasTorso) return 'top';
  if (hasLeg) return 'skirt';
  return 'generic';
}

// --- Top (t-shirt, blouse, jacket body) ---

function drawTop(block, panels) {
  const front = panels.front || panels.front_L || Object.values(panels).find(p => p.region.includes('torso.front'));
  const back = panels.back || Object.values(panels).find(p => p.region.includes('torso.back'));
  const sleeve = panels.sleeve || panels.sleeve_L || Object.values(panels).find(p => p.region.includes('arm'));

  const bodyW = (front?.dims.widthTop ?? 46) * (front?.ease ?? 1.1);
  const bodyH = (front?.dims.height ?? 42) * 1;
  const sleeveW = sleeve ? sleeve.dims.height * (sleeve.ease ?? 1.0) * 0.65 : 0;
  const sleeveH = sleeve ? sleeve.dims.widthTop * (sleeve.ease ?? 1.0) * 0.55 : 0;

  const neckW = bodyW * 0.32;
  const neckH = 6;
  const shoulderSlope = bodyH * 0.06;

  const totalW = (bodyW + sleeveW * 2) * SCALE + 120;
  const totalH = bodyH * SCALE + 140;
  const cx = totalW / 2;
  const topY = 60;

  let svg = svgOpen(totalW, totalH, block.name, block.flags);

  // --- Left sleeve ---
  if (sleeve) {
    const sx = cx - bodyW * SCALE / 2;
    const sy = topY + shoulderSlope * SCALE;
    const sw = sleeveW * SCALE;
    const sh = sleeveH * SCALE;
    const cuffTaper = 0.75;

    svg += `<path d="
      M ${sx},${sy}
      L ${sx - sw},${sy + sh * 0.15}
      L ${sx - sw * cuffTaper},${sy + sh}
      L ${sx},${sy + sh * 0.85}
      Z
    " fill="${FILL_SLEEVE}" stroke="${STROKE}" stroke-width="1.5" stroke-linejoin="round"/>`;

    // Cuff stitch line
    const cuffInset = sw * 0.08;
    svg += `<line x1="${sx - sw + cuffInset}" y1="${sy + sh * 0.18}" x2="${sx - sw * cuffTaper + cuffInset}" y2="${sy + sh * 0.97}"
      stroke="${STITCH_COLOR}" stroke-width="0.8" stroke-dasharray="4,3"/>`;
  }

  // --- Right sleeve ---
  if (sleeve) {
    const sx = cx + bodyW * SCALE / 2;
    const sy = topY + shoulderSlope * SCALE;
    const sw = sleeveW * SCALE;
    const sh = sleeveH * SCALE;
    const cuffTaper = 0.75;

    svg += `<path d="
      M ${sx},${sy}
      L ${sx + sw},${sy + sh * 0.15}
      L ${sx + sw * cuffTaper},${sy + sh}
      L ${sx},${sy + sh * 0.85}
      Z
    " fill="${FILL_SLEEVE}" stroke="${STROKE}" stroke-width="1.5" stroke-linejoin="round"/>`;

    const cuffInset = sw * 0.08;
    svg += `<line x1="${sx + sw - cuffInset}" y1="${sy + sh * 0.18}" x2="${sx + sw * cuffTaper - cuffInset}" y2="${sy + sh * 0.97}"
      stroke="${STITCH_COLOR}" stroke-width="0.8" stroke-dasharray="4,3"/>`;
  }

  // --- Body ---
  const bx = cx - bodyW * SCALE / 2;
  const bw = bodyW * SCALE;
  const bh = bodyH * SCALE;
  const waistIndent = bw * 0.04;

  svg += `<path d="
    M ${cx - neckW * SCALE / 2},${topY}
    Q ${cx - neckW * SCALE / 2 - 4},${topY - neckH * SCALE * 0.5} ${cx},${topY - neckH * SCALE * 0.7}
    Q ${cx + neckW * SCALE / 2 + 4},${topY - neckH * SCALE * 0.5} ${cx + neckW * SCALE / 2},${topY}
    L ${cx + bw / 2},${topY + shoulderSlope * SCALE}
    Q ${cx + bw / 2 - waistIndent},${topY + bh * 0.55} ${cx + bw / 2},${topY + bh}
    L ${cx - bw / 2},${topY + bh}
    Q ${cx - bw / 2 + waistIndent},${topY + bh * 0.55} ${cx - bw / 2},${topY + shoulderSlope * SCALE}
    Z
  " fill="${FILL_FRONT}" stroke="${STROKE}" stroke-width="1.5" stroke-linejoin="round"/>`;

  // Detect features
  const hasCollar = Object.keys(panels).some(n => n.includes('collar') || n.includes('lapel'));
  const hasWelt = Object.keys(panels).some(n => n.includes('welt') || n.includes('pocket'));
  const hasLining = Object.keys(panels).some(n => n.includes('lining'));
  const hasButtons = block.build.some(s => {
    const op = s.operation;
    return op?.type === 'call' && op.name === 'C' && op.args?.some(a => a.type === 'call' && a.name === 'button');
  });
  const buttonCount = (() => {
    for (const s of block.build) {
      const op = s.operation;
      if (op?.type === 'call' && op.name === 'C') {
        const btnArg = op.args?.find(a => a.type === 'call' && a.name === 'button');
        if (btnArg?.args?.[0]?.type === 'number') return btnArg.args[0].value;
      }
    }
    return 0;
  })();

  if (hasCollar) {
    // Lapel lines
    const lapelW = bw * 0.12;
    const lapelH = bh * 0.45;
    const collarH = 14;

    // Collar at neckline
    svg += `<path d="
      M ${cx - neckW * SCALE / 2 - 4},${topY - 2}
      L ${cx - neckW * SCALE / 2 - 10},${topY - collarH}
      Q ${cx},${topY - collarH - 6} ${cx + neckW * SCALE / 2 + 10},${topY - collarH}
      L ${cx + neckW * SCALE / 2 + 4},${topY - 2}
    " fill="${FILL_COLLAR}" stroke="${STROKE}" stroke-width="1.2" stroke-linejoin="round"/>`;

    // Left lapel
    svg += `<path d="
      M ${cx - 3},${topY - neckH * SCALE * 0.3}
      L ${cx - lapelW},${topY - 2}
      L ${cx - lapelW - 6},${topY + lapelH}
      L ${cx - 3},${topY + lapelH * 0.85}
      Z
    " fill="#e8e4df" stroke="${STROKE}" stroke-width="1" stroke-linejoin="round"/>`;

    // Right lapel
    svg += `<path d="
      M ${cx + 3},${topY - neckH * SCALE * 0.3}
      L ${cx + lapelW},${topY - 2}
      L ${cx + lapelW + 6},${topY + lapelH}
      L ${cx + 3},${topY + lapelH * 0.85}
      Z
    " fill="#e8e4df" stroke="${STROKE}" stroke-width="1" stroke-linejoin="round"/>`;

    // Center opening line (instead of center dashed line)
    svg += `<line x1="${cx}" y1="${topY - neckH * SCALE * 0.3}" x2="${cx}" y2="${topY + bh}"
      stroke="${STROKE}" stroke-width="0.8"/>`;
  } else {
    // Center line
    svg += `<line x1="${cx}" y1="${topY - neckH * SCALE * 0.5}" x2="${cx}" y2="${topY + bh}"
      stroke="${STITCH_COLOR}" stroke-width="0.7" stroke-dasharray="6,4"/>`;

    // Neck stitch
    svg += neckStitch(cx, topY, neckW * SCALE, neckH * SCALE);
  }

  // Buttons
  if (hasButtons && buttonCount > 0) {
    const btnStart = topY + bh * 0.35;
    const btnEnd = topY + bh * 0.75;
    const btnSpacing = buttonCount > 1 ? (btnEnd - btnStart) / (buttonCount - 1) : 0;
    for (let i = 0; i < buttonCount; i++) {
      const by = buttonCount > 1 ? btnStart + btnSpacing * i : (btnStart + btnEnd) / 2;
      svg += `<circle cx="${cx}" cy="${by}" r="3.5" fill="none" stroke="${STROKE}" stroke-width="1"/>`;
      svg += `<circle cx="${cx}" cy="${by}" r="1" fill="${STROKE}"/>`;
    }
  }

  // Welt pocket
  if (hasWelt) {
    const pocketW = bw * 0.22;
    const pocketY = topY + bh * 0.52;
    // Left pocket
    svg += `<line x1="${cx - bw * 0.08}" y1="${pocketY}" x2="${cx - bw * 0.08 - pocketW}" y2="${pocketY}" stroke="${STROKE}" stroke-width="1.2"/>`;
    svg += `<line x1="${cx - bw * 0.08}" y1="${pocketY + 3}" x2="${cx - bw * 0.08 - pocketW}" y2="${pocketY + 3}" stroke="${STITCH_COLOR}" stroke-width="0.6" stroke-dasharray="3,2"/>`;
    // Right pocket
    svg += `<line x1="${cx + bw * 0.08}" y1="${pocketY}" x2="${cx + bw * 0.08 + pocketW}" y2="${pocketY}" stroke="${STROKE}" stroke-width="1.2"/>`;
    svg += `<line x1="${cx + bw * 0.08}" y1="${pocketY + 3}" x2="${cx + bw * 0.08 + pocketW}" y2="${pocketY + 3}" stroke="${STITCH_COLOR}" stroke-width="0.6" stroke-dasharray="3,2"/>`;
  }

  // Hem stitch line
  const hemY = topY + bh - 8;
  svg += `<line x1="${bx + 4}" y1="${hemY}" x2="${bx + bw - 4}" y2="${hemY}"
    stroke="${STITCH_COLOR}" stroke-width="0.8" stroke-dasharray="4,3"/>`;

  // Labels
  const labelParts = [];
  if (hasCollar) labelParts.push('notched lapel');
  if (hasLining) labelParts.push('lined');
  if (hasWelt) labelParts.push('welt pockets');
  const detailLabel = labelParts.length ? labelParts.join(' · ') : '';

  svg += `<text x="${cx}" y="${topY + bh / 2 + (hasCollar ? 20 : 0)}" text-anchor="middle" fill="${LABEL_COLOR}" font-size="13" font-weight="500" font-family="system-ui">front</text>`;
  if (detailLabel) {
    svg += `<text x="${cx}" y="${topY + bh / 2 + (hasCollar ? 34 : 14)}" text-anchor="middle" fill="${DIM_COLOR}" font-size="9" font-family="system-ui">${detailLabel}</text>`;
  }

  // Dimensions
  const dimY = topY + bh + 28;
  svg += dimensionLine(cx - bw / 2, dimY, cx + bw / 2, dimY, fmtCm(bodyW));
  if (sleeve) {
    svg += dimensionLine(cx - bw / 2 - sleeveW * SCALE, dimY + 20, cx + bw / 2 + sleeveW * SCALE, dimY + 20, fmtCm(bodyW + sleeveW * 2) + ' total');
  }

  // Side dimension
  svg += dimensionLineV(cx + bw / 2 + 16, topY, cx + bw / 2 + 16, topY + bh, fmtCm(bodyH));

  svg += '</svg>';
  return svg;
}

// --- Skirt ---

function drawSkirt(block, panels) {
  const panelList = Object.entries(panels);
  const mainPanels = panelList.filter(([n, p]) => !n.includes('waistband') && !n.includes('band'));
  const waistband = panelList.find(([n]) => n.includes('waistband') || n.includes('band'));

  let waistW = 0, hemW = 0, skirtH = 0;
  for (const [, p] of mainPanels) {
    waistW += p.dims.widthTop * p.ease;
    hemW += p.dims.widthBottom * p.ease;
    skirtH = Math.max(skirtH, p.dims.height);
  }
  // Use half for the flat view (front)
  waistW /= 2;
  hemW /= 2;

  const wbH = waistband ? 4 : 0;
  const totalW = Math.max(hemW, waistW) * SCALE + 100;
  const totalH = (skirtH + wbH) * SCALE + 120;
  const cx = totalW / 2;
  const topY = 50;

  let svg = svgOpen(totalW, totalH, block.name, block.flags);

  const waistPx = waistW * SCALE;
  const hemPx = hemW * SCALE;

  // Waistband
  if (waistband) {
    const wbPx = wbH * SCALE;
    svg += `<rect x="${cx - waistPx / 2}" y="${topY}" width="${waistPx}" height="${wbPx}" rx="2"
      fill="${FILL_WAISTBAND}" stroke="${STROKE}" stroke-width="1.5"/>`;
    svg += `<text x="${cx}" y="${topY + wbPx / 2 + 4}" text-anchor="middle" fill="${DIM_COLOR}" font-size="9" font-family="system-ui">waistband</text>`;
  }

  const skirtTop = topY + wbH * SCALE;

  // Skirt body
  svg += `<path d="
    M ${cx - waistPx / 2},${skirtTop}
    L ${cx + waistPx / 2},${skirtTop}
    L ${cx + hemPx / 2},${skirtTop + skirtH * SCALE}
    L ${cx - hemPx / 2},${skirtTop + skirtH * SCALE}
    Z
  " fill="${FILL_FRONT}" stroke="${STROKE}" stroke-width="1.5" stroke-linejoin="round"/>`;

  // Center line
  svg += `<line x1="${cx}" y1="${skirtTop}" x2="${cx}" y2="${skirtTop + skirtH * SCALE}"
    stroke="${STITCH_COLOR}" stroke-width="0.7" stroke-dasharray="6,4"/>`;

  // Hem stitch
  const hemStY = skirtTop + skirtH * SCALE - 6;
  const hemHalfW = hemPx / 2 - 4;
  svg += `<line x1="${cx - hemHalfW}" y1="${hemStY}" x2="${cx + hemHalfW}" y2="${hemStY}"
    stroke="${STITCH_COLOR}" stroke-width="0.8" stroke-dasharray="4,3"/>`;

  svg += `<text x="${cx}" y="${skirtTop + skirtH * SCALE / 2}" text-anchor="middle" fill="${LABEL_COLOR}" font-size="13" font-weight="500" font-family="system-ui">front</text>`;

  // Dimensions
  const dimY = skirtTop + skirtH * SCALE + 24;
  svg += dimensionLine(cx - hemPx / 2, dimY, cx + hemPx / 2, dimY, fmtCm(hemW) + ' hem');
  svg += dimensionLine(cx - waistPx / 2, topY - 14, cx + waistPx / 2, topY - 14, fmtCm(waistW) + ' waist');
  svg += dimensionLineV(cx + hemPx / 2 + 16, skirtTop, cx + hemPx / 2 + 16, skirtTop + skirtH * SCALE, fmtCm(skirtH));

  svg += '</svg>';
  return svg;
}

// --- Collar component ---

function drawCollar(block, panels) {
  const stand = panels.collar_stand;
  const fall = panels.collar_fall;
  const lapel = panels.lapel;

  const neckW = (stand?.dims.widthTop ?? 37) * SCALE;
  const standH = (stand?.dims.height ?? 3) * SCALE;
  const fallH = (fall?.dims.height ?? 6) * SCALE;
  const lapelH = (lapel?.dims.height ?? 6) * SCALE;

  const totalW = neckW + 120;
  const totalH = standH + fallH + lapelH + 160;
  const cx = totalW / 2;
  let y = 60;

  let svg = svgOpen(totalW, totalH, block.name, block.flags);

  // Collar stand
  svg += `<rect x="${cx - neckW / 2}" y="${y}" width="${neckW}" height="${standH}" rx="2"
    fill="${FILL_COLLAR}" stroke="${STROKE}" stroke-width="1.5"/>`;
  svg += `<text x="${cx}" y="${y + standH / 2 + 4}" text-anchor="middle" fill="${LABEL_COLOR}" font-size="10" font-family="system-ui">collar stand</text>`;
  y += standH;

  // Collar fall
  svg += `<path d="
    M ${cx - neckW / 2},${y}
    L ${cx + neckW / 2},${y}
    L ${cx + neckW / 2 + 10},${y + fallH}
    L ${cx - neckW / 2 - 10},${y + fallH}
    Z
  " fill="${FILL_COLLAR}" stroke="${STROKE}" stroke-width="1.5" stroke-linejoin="round" opacity="0.8"/>`;
  svg += `<text x="${cx}" y="${y + fallH / 2 + 4}" text-anchor="middle" fill="${LABEL_COLOR}" font-size="10" font-family="system-ui">collar fall</text>`;

  // Roll line
  svg += `<line x1="${cx - neckW / 2 - 5}" y1="${y}" x2="${cx + neckW / 2 + 5}" y2="${y}"
    stroke="${STITCH_COLOR}" stroke-width="1" stroke-dasharray="6,3"/>`;
  svg += `<text x="${cx + neckW / 2 + 16}" y="${y + 4}" fill="${DIM_COLOR}" font-size="8" font-family="system-ui">roll line</text>`;

  y += fallH + 20;

  // Lapels (left and right)
  if (lapel) {
    const lapelW = lapel.dims.widthTop * SCALE * 0.35;
    const lh = lapelH * 1.5;

    // Left lapel
    svg += `<path d="
      M ${cx - 10},${y}
      L ${cx - lapelW},${y}
      L ${cx - lapelW - 15},${y + lh}
      L ${cx - 10},${y + lh * 0.7}
      Z
    " fill="${FILL_FRONT}" stroke="${STROKE}" stroke-width="1.5" stroke-linejoin="round"/>`;

    // Right lapel
    svg += `<path d="
      M ${cx + 10},${y}
      L ${cx + lapelW},${y}
      L ${cx + lapelW + 15},${y + lh}
      L ${cx + 10},${y + lh * 0.7}
      Z
    " fill="${FILL_FRONT}" stroke="${STROKE}" stroke-width="1.5" stroke-linejoin="round"/>`;

    // Gorge line
    svg += `<line x1="${cx - 10}" y1="${y}" x2="${cx - lapelW - 5}" y2="${y + lh * 0.4}"
      stroke="${STROKE}" stroke-width="1"/>`;
    svg += `<line x1="${cx + 10}" y1="${y}" x2="${cx + lapelW + 5}" y2="${y + lh * 0.4}"
      stroke="${STROKE}" stroke-width="1"/>`;

    svg += `<text x="${cx}" y="${y + lh + 16}" text-anchor="middle" fill="${LABEL_COLOR}" font-size="10" font-family="system-ui">lapels</text>`;
  }

  svg += '</svg>';
  return svg;
}

// --- Generic fallback ---

function drawGeneric(block, panels) {
  return drawTop(block, panels);
}

// --- Helpers ---

function resolveRegionDims(expr) {
  if (!expr) return { widthTop: 30, widthBottom: 30, height: 30 };
  if (expr.type === 'region') return getRegionDims(expr.value, expr.range);
  if (expr.type === 'binary' && expr.op === '+') {
    return combineRegions(resolveRegionDims(expr.left), resolveRegionDims(expr.right));
  }
  return { widthTop: 30, widthBottom: 30, height: 30 };
}

function resolveRegionStr(expr) {
  if (!expr) return '';
  if (expr.type === 'region') return expr.value.replace(/^%/, '');
  if (expr.type === 'binary' && expr.op === '+') return resolveRegionStr(expr.left) + '+' + resolveRegionStr(expr.right);
  return '';
}

function resolveNumber(expr) {
  if (!expr) return null;
  if (expr.type === 'number') return expr.value;
  return null;
}

function svgOpen(w, h, name, flags) {
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%">`;
  svg += `<rect width="${w}" height="${h}" fill="#faf9f7"/>`;
  const label = name + (flags?.length ? ' [' + flags.join(', ') + ']' : '');
  svg += `<text x="${w / 2}" y="24" text-anchor="middle" fill="${LABEL_COLOR}" font-size="14" font-weight="600" font-family="system-ui">${label}</text>`;
  svg += `<text x="${w / 2}" y="40" text-anchor="middle" fill="${DIM_COLOR}" font-size="10" font-family="system-ui">assembled view</text>`;
  return svg;
}

function neckStitch(cx, topY, neckPx, neckHPx) {
  const r = neckPx / 2;
  const inset = 3;
  return `<path d="
    M ${cx - r + inset},${topY + inset}
    Q ${cx},${topY - neckHPx * 0.5}
    ${cx + r - inset},${topY + inset}
  " fill="none" stroke="${STITCH_COLOR}" stroke-width="0.8" stroke-dasharray="3,3"/>`;
}

function dimensionLine(x1, y, x2, y2, label) {
  const midX = (x1 + x2) / 2;
  return `
    <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y2}" stroke="${DIM_COLOR}" stroke-width="0.8"/>
    <line x1="${x1}" y1="${y - 4}" x2="${x1}" y2="${y + 4}" stroke="${DIM_COLOR}" stroke-width="0.8"/>
    <line x1="${x2}" y1="${y2 - 4}" x2="${x2}" y2="${y2 + 4}" stroke="${DIM_COLOR}" stroke-width="0.8"/>
    <text x="${midX}" y="${y - 6}" text-anchor="middle" fill="${DIM_COLOR}" font-size="9" font-family="system-ui">${label}</text>
  `;
}

function dimensionLineV(x, y1, x2, y2, label) {
  const midY = (y1 + y2) / 2;
  return `
    <line x1="${x}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${DIM_COLOR}" stroke-width="0.8"/>
    <line x1="${x - 4}" y1="${y1}" x2="${x + 4}" y2="${y1}" stroke="${DIM_COLOR}" stroke-width="0.8"/>
    <line x1="${x2 - 4}" y1="${y2}" x2="${x2 + 4}" y2="${y2}" stroke="${DIM_COLOR}" stroke-width="0.8"/>
    <text x="${x + 10}" y="${midY + 3}" fill="${DIM_COLOR}" font-size="9" font-family="system-ui">${label}</text>
  `;
}

// --- Component resolution ---

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

function resolveRef(expr) {
  if (!expr) return '';
  if (expr.type === 'reference') return expr.value;
  if (expr.type === 'landmark') return expr.value.replace(/^@/, '');
  return '';
}

function fmtCm(v) { return v.toFixed(1) + 'cm'; }

function emptySvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 200" width="100%" height="100%">
    <rect width="400" height="200" fill="#faf9f7"/>
    <text x="200" y="100" text-anchor="middle" fill="#94a3b8" font-size="14" font-family="system-ui">Write GNL to see assembled view</text>
  </svg>`;
}
