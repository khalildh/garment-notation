// @ts-check
import { BODY } from './body.js';

const SCALE = 4;

// Silhouette colors
const SILO_FILL = '#d1d5db';
const SILO_STROKE = '#9ca3af';

// Region colors
const REGION_COLORS = {
  neck:         '#fbcfe8',
  shoulder:     '#fde68a',
  'torso.front':'#fecaca',
  arm:          '#bbf7d0',
  waist:        '#bfdbfe',
  hip:          '#c7d2fe',
  leg:          '#ddd6fe',
};

const REGION_LABELS = {
  neck:         '%neck',
  shoulder:     '%shoulder',
  'torso.front':'%torso.front',
  'arm.L':      '%arm.L',
  'arm.R':      '%arm.R',
  waist:        '%waist',
  hip:          '%hip',
  leg:          '%leg',
};

/**
 * Compute body coordinates aligned to garment drawing coordinates.
 * Uses raw BODY measurements (no ease) so the body is narrower than garment.
 */
function computeBodyCoords(garmentType, cx, topY, garmentW, garmentH, opts = {}) {
  const halfBust = (BODY.bust_circ / 2) * SCALE / 2;
  const halfWaist = (BODY.waist_circ / 2) * SCALE / 2;
  const halfHip = (BODY.hip_circ / 2) * SCALE / 2;
  const halfNeck = (BODY.neck_circ / 2) * SCALE / 2 * 0.32;
  const halfShoulder = (BODY.shoulder_width / 2) * SCALE / 2;

  const torsoH = BODY.torso_length * SCALE;
  const armLen = opts.sleeveLen || BODY.arm_length * 0.4 * SCALE;
  const upperArmW = (BODY.upper_arm_circ / 2) * SCALE / 2 * 0.65;

  // Vertical positions relative to topY
  const neckH = 8 * SCALE * 0.7;
  const shoulderY = topY;
  const bustY = topY + torsoH * 0.28;
  const waistY = topY + torsoH * 0.55;
  const hipY = topY + torsoH * 0.78;
  const hemY = topY + garmentH;

  return {
    cx, topY,
    halfBust, halfWaist, halfHip, halfNeck, halfShoulder,
    torsoH, armLen, upperArmW,
    neckH, shoulderY, bustY, waistY, hipY, hemY,
    garmentW, garmentH,
  };
}

/**
 * Render silhouette mode — semi-transparent mannequin outline behind garment.
 */
function renderSilhouette(garmentType, cx, topY, garmentW, garmentH, opts = {}) {
  const bc = computeBodyCoords(garmentType, cx, topY, garmentW, garmentH, opts);
  let svg = '<g class="body-overlay-silhouette" opacity="0.25">';

  if (garmentType === 'top' || garmentType === 'dress') {
    svg += renderTorsoSilhouette(bc, garmentType);
    if (opts.hasSleeves) {
      svg += renderArmSilhouette(bc, 'left');
      svg += renderArmSilhouette(bc, 'right');
    }
  } else if (garmentType === 'skirt') {
    svg += renderLowerBodySilhouette(bc);
  }

  svg += '</g>';
  return svg;
}

function renderTorsoSilhouette(bc, garmentType) {
  const { cx, topY, halfBust, halfWaist, halfHip, halfNeck, halfShoulder,
          neckH, bustY, waistY, hipY, hemY } = bc;

  // Neck stub
  let svg = `<path d="
    M ${cx - halfNeck},${topY - neckH * 0.3}
    Q ${cx},${topY - neckH * 1.1} ${cx + halfNeck},${topY - neckH * 0.3}
    L ${cx + halfNeck * 0.8},${topY - neckH * 1.6}
    Q ${cx},${topY - neckH * 2.0} ${cx - halfNeck * 0.8},${topY - neckH * 1.6}
    Z
  " fill="${SILO_FILL}" stroke="${SILO_STROKE}" stroke-width="0.8"/>`;

  // Torso body
  const bottomY = garmentType === 'dress' ? hemY : hipY;
  svg += `<path d="
    M ${cx - halfShoulder},${topY}
    L ${cx + halfShoulder},${topY}
    Q ${cx + halfBust},${bustY - (bustY - topY) * 0.3} ${cx + halfBust},${bustY}
    Q ${cx + halfWaist},${waistY - (waistY - bustY) * 0.2} ${cx + halfWaist},${waistY}
    Q ${cx + halfHip},${hipY - (hipY - waistY) * 0.3} ${cx + halfHip},${hipY}
    ${garmentType === 'dress' ? `L ${cx + halfHip * 0.9},${bottomY}` : ''}
    ${garmentType === 'dress' ? `L ${cx - halfHip * 0.9},${bottomY}` : ''}
    ${garmentType !== 'dress' ? `L ${cx - halfHip},${hipY}` : ''}
    Q ${cx - halfHip},${hipY - (hipY - waistY) * 0.3} ${cx - halfWaist},${waistY}
    Q ${cx - halfWaist},${waistY - (waistY - bustY) * 0.2} ${cx - halfBust},${bustY}
    Q ${cx - halfBust},${bustY - (bustY - topY) * 0.3} ${cx - halfShoulder},${topY}
    Z
  " fill="${SILO_FILL}" stroke="${SILO_STROKE}" stroke-width="0.8"/>`;

  return svg;
}

function renderArmSilhouette(bc, side) {
  const { cx, topY, halfShoulder, armLen, upperArmW } = bc;
  const dir = side === 'left' ? -1 : 1;
  const sx = cx + dir * halfShoulder;
  const shoulderSlope = bc.garmentH * 0.06;
  const sy = topY + shoulderSlope;
  const wristW = upperArmW * 0.6;

  return `<path d="
    M ${sx},${sy}
    L ${sx + dir * armLen},${sy + armLen * 0.15}
    L ${sx + dir * armLen * 0.85},${sy + armLen * 0.9}
    L ${sx},${sy + armLen * 0.75}
    Z
  " fill="${SILO_FILL}" stroke="${SILO_STROKE}" stroke-width="0.6"/>`;
}

function renderLowerBodySilhouette(bc) {
  const { cx, topY, halfWaist, halfHip, waistY, hipY, hemY, garmentH } = bc;

  // For skirt: waist to hem
  const skirtTopY = topY;
  const legSep = halfHip * 0.15;
  const midThighY = skirtTopY + garmentH * 0.45;

  return `<path d="
    M ${cx - halfWaist},${skirtTopY}
    L ${cx + halfWaist},${skirtTopY}
    Q ${cx + halfHip},${skirtTopY + garmentH * 0.25} ${cx + halfHip},${skirtTopY + garmentH * 0.4}
    L ${cx + halfHip * 0.75},${hemY}
    L ${cx + legSep},${hemY}
    Q ${cx + legSep * 0.5},${midThighY} ${cx},${skirtTopY + garmentH * 0.35}
    Q ${cx - legSep * 0.5},${midThighY} ${cx - legSep},${hemY}
    L ${cx - halfHip * 0.75},${hemY}
    L ${cx - halfHip},${skirtTopY + garmentH * 0.4}
    Q ${cx - halfHip},${skirtTopY + garmentH * 0.25} ${cx - halfWaist},${skirtTopY}
    Z
  " fill="${SILO_FILL}" stroke="${SILO_STROKE}" stroke-width="0.8"/>`;
}

/**
 * Render regions mode — labeled colored zones.
 */
function renderRegions(garmentType, cx, topY, garmentW, garmentH, opts = {}) {
  const bc = computeBodyCoords(garmentType, cx, topY, garmentW, garmentH, opts);
  let svg = '<g class="body-overlay-regions" opacity="0.30">';

  const regionsToDraw = getRegionsForType(garmentType, opts.hasSleeves);

  for (const regionKey of regionsToDraw) {
    svg += renderRegionZone(regionKey, bc, garmentType);
  }

  svg += '</g>';
  return svg;
}

function getRegionsForType(garmentType, hasSleeves) {
  switch (garmentType) {
    case 'top':
      return ['neck', 'shoulder', 'torso.front', ...(hasSleeves ? ['arm'] : [])];
    case 'dress':
      return ['neck', 'torso.front', 'waist', 'hip', 'leg'];
    case 'skirt':
      return ['waist', 'hip', 'leg'];
    default:
      return [];
  }
}

function renderRegionZone(regionKey, bc, garmentType) {
  const { cx, topY, halfBust, halfWaist, halfHip, halfShoulder, halfNeck,
          bustY, waistY, hipY, hemY, armLen, upperArmW, garmentH } = bc;

  const color = REGION_COLORS[regionKey] || '#e5e7eb';
  const strokeColor = adjustAlpha(color, 0.6);
  let svg = '';

  switch (regionKey) {
    case 'neck': {
      const neckH = 8 * SCALE * 0.7;
      const w = halfNeck * 2;
      const h = neckH * 0.8;
      const y = topY - neckH * 1.6;
      svg += regionRect(cx - halfNeck * 0.8, y, w * 0.8, h, color);
      svg += regionLabel(cx, y + h / 2 + 3, '%neck');
      break;
    }
    case 'shoulder': {
      const shW = halfShoulder - halfNeck;
      const y = topY - 4;
      const h = 16;
      // Left shoulder
      svg += regionRect(cx - halfShoulder, y, shW, h, color);
      svg += regionLabel(cx - halfShoulder + shW / 2, y + h / 2 + 3, '%shoulder');
      // Right shoulder
      svg += regionRect(cx + halfNeck, y, shW, h, color);
      break;
    }
    case 'torso.front': {
      const y = topY;
      const h = garmentType === 'dress' ? (waistY - topY) : (garmentH);
      const w = halfBust * 2;
      svg += regionRect(cx - halfBust, y, w, h, color);
      svg += regionLabel(cx, y + h / 2 + 3, '%torso.front');
      break;
    }
    case 'arm': {
      const sy = topY + garmentH * 0.06;
      const h = armLen * 0.8;
      const w = upperArmW * 1.2;
      // Left arm
      svg += regionRect(cx - halfShoulder - w, sy, w, h, color);
      svg += regionLabel(cx - halfShoulder - w / 2, sy + h / 2 + 3, '%arm.L');
      // Right arm
      svg += regionRect(cx + halfShoulder, sy, w, h, color);
      svg += regionLabel(cx + halfShoulder + w / 2, sy + h / 2 + 3, '%arm.R');
      break;
    }
    case 'waist': {
      let y, w;
      if (garmentType === 'skirt') {
        y = topY;
        w = halfWaist * 2;
      } else {
        y = waistY - 10;
        w = halfWaist * 2;
      }
      const h = 20;
      svg += regionRect(cx - w / 2, y, w, h, color);
      svg += regionLabel(cx, y + h / 2 + 3, '%waist');
      break;
    }
    case 'hip': {
      let y;
      if (garmentType === 'skirt') {
        y = topY + 20;
      } else {
        y = hipY - 10;
      }
      const h = 30;
      const w = halfHip * 2;
      svg += regionRect(cx - w / 2, y, w, h, color);
      svg += regionLabel(cx, y + h / 2 + 3, '%hip');
      break;
    }
    case 'leg': {
      let y;
      if (garmentType === 'skirt') {
        y = topY + 50;
      } else {
        y = hipY + 20;
      }
      const h = hemY - y;
      const w = halfHip * 1.6;
      if (h > 10) {
        svg += regionRect(cx - w / 2, y, w, h, color);
        svg += regionLabel(cx, y + h / 2 + 3, '%leg');
      }
      break;
    }
  }

  return svg;
}

function regionRect(x, y, w, h, color) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"
    fill="${color}" stroke="${color}" stroke-width="1" stroke-dasharray="4,3" opacity="0.6"/>`;
}

function regionLabel(x, y, label) {
  return `<text x="${x}" y="${y}" text-anchor="middle" fill="#374151" font-size="8"
    font-weight="500" font-family="system-ui" opacity="0.8">${label}</text>`;
}

function adjustAlpha(hex, factor) {
  return hex; // colors are applied via opacity on the group
}

/**
 * Main entry point — render body overlay for a garment type.
 * @param {'silhouette'|'regions'} mode
 * @param {'top'|'dress'|'skirt'|'collar'} garmentType
 * @param {number} cx - center X of garment
 * @param {number} topY - top Y of garment body
 * @param {number} garmentW - garment body width in pixels
 * @param {number} garmentH - garment body height in pixels
 * @param {{ hasSleeves?: boolean, sleeveLen?: number }} [opts]
 * @returns {string} SVG markup
 */
export function renderBodyOverlay(mode, garmentType, cx, topY, garmentW, garmentH, opts = {}) {
  if (garmentType === 'collar') return '';

  if (mode === 'silhouette') {
    return renderSilhouette(garmentType, cx, topY, garmentW, garmentH, opts);
  } else {
    return renderRegions(garmentType, cx, topY, garmentW, garmentH, opts);
  }
}
