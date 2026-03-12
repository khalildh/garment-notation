// GarmentCodeData (ECCV 2024) JSON → GNL converter
// Handles GarmentCodeData-specific features: edge labels, panel_order,
// modular panel naming, and right_wrong stitch annotations.

import { mapGCDPanelToRegion, detectGCDGarmentType } from './garmentcodedata-region-map.js';
import { nameEdges } from './edge-namer.js';
import {
  inferShape, inferEase, checkSymmetry,
  findOpenEdges, inferOpeningType, sanitizeName,
} from './shared.js';

// Map GarmentCodeData edge labels to semantic edge names
const EDGE_LABEL_MAP = {
  // Common GarmentCodeData edge labels
  'armhole':    'armhole',
  'shoulder':   'shoulder',
  'neckline':   'neckline',
  'hem':        'hem',
  'waist':      'waist',
  'side':       'side',
  'cuff':       'cuff',
  'sleeve_cap': 'cap',
  'inseam':     'inseam',
  'outseam':    'outseam',
  'crotch':     'crotch',
  'collar':     'collar',
  'placket':    'placket',
  'dart':       'dart',
  'fold':       'fold',
};

/**
 * Map an edge's label property to a semantic name.
 * Returns null if no label or unrecognized label.
 */
function mapEdgeLabel(edge) {
  if (!edge.label) return null;
  const label = edge.label.toLowerCase().replace(/\s+/g, '_');
  return EDGE_LABEL_MAP[label] || label.replace(/[^a-z0-9_]/g, '');
}

/**
 * Name edges using labels first, then fall back to geometric heuristics.
 */
function nameEdgesWithLabels(edges, vertices, panelName, garmentType) {
  // Check if any edges have labels
  const hasLabels = edges.some(e => e.label);

  if (!hasLabels) {
    // Fall back entirely to geometric naming
    return nameEdges(edges, vertices, panelName, garmentType);
  }

  // Use labels where available, geometric fallback otherwise
  const geometricNames = nameEdges(edges, vertices, panelName, garmentType);
  const names = [];
  const usedNames = new Set();

  for (let i = 0; i < edges.length; i++) {
    let name = mapEdgeLabel(edges[i]) || geometricNames[i];

    // Deduplicate
    if (usedNames.has(name)) {
      let suffix = 2;
      while (usedNames.has(name + suffix)) suffix++;
      name = name + suffix;
    }
    usedNames.add(name);
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
  // GarmentCodeData defaults to cm (100 units/meter)
  const unitsPerMeter = json.properties?.units_in_meter || 100;
  const scale = 100 / unitsPerMeter;

  // Respect panel_order if present
  const panelOrder = pattern.panel_order || panelNames;
  const orderedPanelNames = panelOrder.filter(n => panels[n]);
  // Add any panels not in panel_order
  for (const n of panelNames) {
    if (!orderedPanelNames.includes(n)) orderedPanelNames.push(n);
  }

  // Check for bilateral symmetry (also check GCD-style _left/_right pairs)
  const isSym = checkSymmetry(panelNames) || checkGCDSymmetry(panelNames);
  const flags = isSym ? ' [SYM]' : '';

  // Build edge name lookup using label-aware naming
  const edgeNames = {};
  for (const [name, panel] of Object.entries(panels)) {
    edgeNames[name] = nameEdgesWithLabels(panel.edges, panel.vertices, name, garmentType);
  }

  // Build panel declarations (in panel_order)
  const declarations = [];
  for (const name of orderedPanelNames) {
    const panel = panels[name];
    const { region } = mapGCDPanelToRegion(name, garmentType);
    const shape = inferShape(panel.vertices, panel.edges);
    const ease = inferEase(panel.vertices, region, scale);
    const gnlName = sanitizeName(name);
    declarations.push(`  ${gnlName} = P(${region}, ${shape}, ${ease})`);
  }

  // Build seam declarations
  const seams = [];
  const comments = [];
  for (const stitch of stitches) {
    const [a, b] = stitch;
    const aName = sanitizeName(a.panel);
    const bName = sanitizeName(b.panel);
    const aEdge = edgeNames[a.panel]?.[a.edge] || `e${a.edge}`;
    const bEdge = edgeNames[b.panel]?.[b.edge] || `e${b.edge}`;

    // Check for right_wrong annotation
    const rightWrong = a.right_wrong || b.right_wrong;
    let comment = '';
    if (rightWrong) {
      comment = `  -- fabric orientation: ${rightWrong}`;
      comments.push(comment);
    }

    seams.push(`    S(${aName}.${aEdge}, ${bName}.${bEdge}, plain)`);
  }

  // Find open edges
  const openEdges = findOpenEdges(panels, stitches, edgeNames);
  const openings = [];
  for (const { panel, edgeIdx, edgeName } of openEdges) {
    const openingType = inferOpeningType(edgeName, panel, garmentType);
    if (openingType) {
      openings.push(`  ${openingType.name} = O(${openingType.location}, ${openingType.shape}, ${openingType.size})`);
    }
  }

  const uniqueOpenings = [...new Set(openings)];

  // Assemble GNL
  let gnl = `GARMENT ${sanitizeName(templateName)}${flags} {\n\n`;

  // Panels
  gnl += `  -- Panels\n`;
  gnl += declarations.join('\n') + '\n\n';

  // Openings
  if (uniqueOpenings.length > 0) {
    gnl += `  -- Openings\n`;
    gnl += uniqueOpenings.join('\n') + '\n\n';
  }

  // right_wrong annotations as comments
  if (comments.length > 0) {
    gnl += `  -- Fabric orientation notes (GarmentCodeData right_wrong annotations)\n`;
    gnl += comments.join('\n') + '\n\n';
  }

  // Build order
  if (seams.length > 0) {
    gnl += `  -- Build order\n`;
    gnl += `  BUILD:\n`;
    gnl += seams.join('\n    >> ') + '\n';
  }

  gnl += '}\n';
  return gnl;
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
