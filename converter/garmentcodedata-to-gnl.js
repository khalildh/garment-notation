// GarmentCodeData (ECCV 2024) JSON → GNL converter
// Handles GarmentCodeData-specific features: edge labels, panel_order,
// modular panel naming, and right_wrong stitch annotations.

import { mapGCDPanelToRegion, detectGCDGarmentType } from './garmentcodedata-region-map.js';
import { nameEdges, panelKindFromRegion } from './edge-namer.js';
import { assembleGNL } from './korosteleva-to-gnl.js';
import {
  anatomicalVertices, buildRing, formatPoly, checkSymmetry,
  findOpenEdges, collectOpenings, sanitizeName, provenanceHeader,
} from './shared.js';

// Map GarmentCodeData edge labels to semantic edge names
const EDGE_LABEL_MAP = {
  'armhole':    'armhole',
  'shoulder':   'shoulder',
  'neckline':   'neckline',
  'collar':     'neckline',
  'hem':        'hem',
  'waist':      'waist',
  'side':       'side',
  'cuff':       'cuff',
  'sleeve_cap': 'cap',
  'inseam':     'inseam',
  'outseam':    'outseam',
  'crotch':     'crotch',
  'placket':    'placket',
  'dart':       'dart',
  'fold':       'fold',
};

/**
 * Map an edge's label property to a semantic name.
 *
 * GarmentCodeData labels carry a side prefix (`left_collar`), which is the
 * side as drafted. Anatomical sides are worked out from the geometry instead,
 * so the prefix is dropped here rather than trusted.
 *
 * Returns null if there is no label or it is not recognised.
 */
function mapEdgeLabel(edge) {
  if (!edge.label) return null;
  const label = edge.label.toLowerCase().replace(/\s+/g, '_');
  if (EDGE_LABEL_MAP[label]) return EDGE_LABEL_MAP[label];

  const stripped = label.replace(/^(left|right)_/, '');
  if (EDGE_LABEL_MAP[stripped]) return EDGE_LABEL_MAP[stripped];

  return stripped.replace(/[^a-z0-9_]/g, '') || null;
}

/**
 * Name edges geometrically, then let the dataset's own labels correct the
 * classification where it has them. The side suffix from the geometric pass is
 * carried over, since the labels do not name anatomical sides reliably.
 */
function nameEdgesWithLabels(edges, vertices, panelName, garmentType, kind) {
  const geometric = nameEdges(edges, vertices, panelName, garmentType, { kind });
  if (!edges.some(e => e.label)) return geometric;

  const used = new Set();
  const names = [];

  for (let i = 0; i < edges.length; i++) {
    const labelled = mapEdgeLabel(edges[i]);
    let name = geometric[i];

    if (labelled) {
      // Keep the geometric side suffix — `left_collar` on a mirrored panel is
      // not necessarily the wearer's left.
      const suffix = (geometric[i].match(/_(l|r)$/) || [])[0] || '';
      name = labelled.endsWith(suffix) ? labelled : labelled + suffix;
    }

    if (used.has(name)) {
      let n = 2;
      while (used.has(`${name}_${n}`)) n++;
      name = `${name}_${n}`;
    }
    used.add(name);
    names.push(name);
  }

  return names;
}

/**
 * Convert a GarmentCodeData JSON template to GNL text.
 *
 * @param {object} json - parsed GarmentCodeData JSON
 * @param {string} templateName - name for the GARMENT block
 * @returns {string} - valid GNL text
 */
export function convertGCD(json, templateName) {
  const pattern = json.pattern;
  const panels = pattern.panels;
  const stitches = pattern.stitches || [];
  const panelNames = Object.keys(panels);
  const garmentType = detectGCDGarmentType(panelNames);
  const unitsPerMeter = json.properties?.units_in_meter || 100;
  const scale = 100 / unitsPerMeter;

  // Respect panel_order if present
  const panelOrder = pattern.panel_order || panelNames;
  const orderedPanelNames = panelOrder.filter(n => panels[n]);
  for (const n of panelNames) {
    if (!orderedPanelNames.includes(n)) orderedPanelNames.push(n);
  }

  const regions = {};
  for (const name of panelNames) {
    regions[name] = mapGCDPanelToRegion(name, garmentType).region;
  }

  const edgeNames = {};
  for (const [name, panel] of Object.entries(panels)) {
    edgeNames[name] = nameEdgesWithLabels(
      panel.edges, anatomicalVertices(panel), name, garmentType,
      panelKindFromRegion(regions[name], garmentType) || undefined);
  }

  const declarations = [];
  const unresolved = [];
  for (const name of orderedPanelNames) {
    const panel = panels[name];
    const region = regions[name];
    const gnlName = sanitizeName(name);
    const ring = buildRing(panel);

    if (!ring) {
      unresolved.push(name);
      declarations.push(`  ${gnlName} = P(${region}, contour, 1.0)   -- outline not a single closed ring`);
      continue;
    }

    const poly = formatPoly(ring.ring, edgeNames[name], scale);
    declarations.push(`  ${gnlName} = P(${region}, ${poly}, 1.0)`);
  }

  const seams = [];
  const orientationNotes = [];
  for (const stitch of stitches) {
    const [a, b] = stitch;
    const aEdge = edgeNames[a.panel]?.[a.edge] || `edge${a.edge}`;
    const bEdge = edgeNames[b.panel]?.[b.edge] || `edge${b.edge}`;
    const ref = `${sanitizeName(a.panel)}.${aEdge}, ${sanitizeName(b.panel)}.${bEdge}`;
    seams.push(`S(${ref}, plain)`);

    const rightWrong = a.right_wrong ?? b.right_wrong;
    if (rightWrong !== undefined && rightWrong !== null) {
      orientationNotes.push(`${sanitizeName(a.panel)}.${aEdge} ↔ ${sanitizeName(b.panel)}.${bEdge}: right_wrong=${rightWrong}`);
    }
  }

  const openEdges = findOpenEdges(panels, stitches, edgeNames);
  const openings = collectOpenings(panels, openEdges, garmentType, scale);

  const extra = [];
  if (unresolved.length) {
    extra.push(`Panels whose edges do not form one closed ring, emitted without geometry: ${unresolved.join(', ')}.`);
  }
  if (orientationNotes.length) {
    extra.push('GarmentCodeData right_wrong annotations, which GNL has no seam-facing');
    extra.push('  parameter for, so they survive only as this note:');
    for (const n of orientationNotes) extra.push(`  ${n}`);
  }

  return assembleGNL({
    name: sanitizeName(templateName),
    header: provenanceHeader({
      name: sanitizeName(templateName),
      source: 'GarmentCodeData (ECCV 2024)',
      tool: 'converter/convert-gcd.js',
      bilateral: checkSymmetry(panelNames) || checkGCDSymmetry(panelNames),
      extra,
    }),
    declarations,
    openings,
    seams,
  });
}

/**
 * Check for GCD-style bilateral symmetry using _left/_right token pairs.
 */
function checkGCDSymmetry(panelNames) {
  const names = panelNames.map(n => n.toLowerCase());

  // Check suffix patterns: _left/_right, _l/_r, _l_/_r_
  const leftSuffix = names.filter(n => n.includes('_left') || n.includes('_l_') || n.endsWith('_l'));
  const rightSuffix = names.filter(n => n.includes('_right') || n.includes('_r_') || n.endsWith('_r'));

  if (leftSuffix.length > 0 && rightSuffix.length > 0) {
    const matches = leftSuffix.filter(l => {
      const rName = l.replace(/_left/g, '_right').replace(/_l_/g, '_r_').replace(/_l$/, '_r');
      return rightSuffix.includes(rName);
    });
    if (matches.length === leftSuffix.length && matches.length > 0) return true;
  }

  // Check prefix patterns: left_/right_
  const leftPrefix = names.filter(n => n.startsWith('left_'));
  const rightPrefix = names.filter(n => n.startsWith('right_'));

  if (leftPrefix.length > 0 && rightPrefix.length > 0) {
    const matches = leftPrefix.filter(l => {
      const rName = 'right_' + l.slice(5);
      return rightPrefix.includes(rName);
    });
    if (matches.length === leftPrefix.length && matches.length > 0) return true;
  }

  return false;
}
