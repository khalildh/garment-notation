// Korosteleva JSON → GNL converter
// Converts garment templates from the NeurIPS 2021 dataset into GNL notation

import { mapPanelToRegion, detectGarmentType } from './region-map.js';
import { nameEdges, edgeLength } from './edge-namer.js';
import {
  inferShape, inferEase, checkSymmetry,
  findOpenEdges, inferOpeningType, sanitizeName,
} from './shared.js';

/**
 * Convert a Korosteleva JSON template to GNL text.
 *
 * @param {object} json - parsed Korosteleva JSON
 * @param {string} templateName - name for the GARMENT block
 * @returns {string} - valid GNL text
 */
export function convert(json, templateName) {
  const pattern = json.pattern;
  const panels = pattern.panels;
  const stitches = pattern.stitches || [];
  const panelNames = Object.keys(panels);
  const garmentType = detectGarmentType(panelNames);
  const unitsPerMeter = json.properties?.units_in_meter || 100;
  const scale = 100 / unitsPerMeter; // normalize to cm

  // Check for bilateral symmetry
  const isSym = checkSymmetry(panelNames);
  const flags = isSym ? ' [SYM]' : '';

  // Build edge name lookup: { panelName: string[] }
  const edgeNames = {};
  for (const [name, panel] of Object.entries(panels)) {
    edgeNames[name] = nameEdges(panel.edges, panel.vertices, name, garmentType);
  }

  // Build panel declarations
  const declarations = [];
  for (const [name, panel] of Object.entries(panels)) {
    const { region } = mapPanelToRegion(name, garmentType);
    const shape = inferShape(panel.vertices, panel.edges);
    const ease = inferEase(panel.vertices, region, scale);
    const gnlName = sanitizeName(name);
    declarations.push(`  ${gnlName} = P(${region}, ${shape}, ${ease})`);
  }

  // Build seam declarations
  const seams = [];
  for (const stitch of stitches) {
    const [a, b] = stitch;
    const aName = sanitizeName(a.panel);
    const bName = sanitizeName(b.panel);
    const aEdge = edgeNames[a.panel]?.[a.edge] || `e${a.edge}`;
    const bEdge = edgeNames[b.panel]?.[b.edge] || `e${b.edge}`;
    seams.push(`    S(${aName}.${aEdge}, ${bName}.${bEdge}, plain)`);
  }

  // Find open edges (not in any stitch)
  const openEdges = findOpenEdges(panels, stitches, edgeNames);
  const openings = [];
  for (const { panel, edgeIdx, edgeName } of openEdges) {
    const gnlName = sanitizeName(panel);
    // Infer opening type from edge name
    const openingType = inferOpeningType(edgeName, panel, garmentType);
    if (openingType) {
      openings.push(`  ${openingType.name} = O(${openingType.location}, ${openingType.shape}, ${openingType.size})`);
    }
  }

  // Deduplicate openings (multiple open edges may map to same opening)
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

  // Build order
  if (seams.length > 0) {
    gnl += `  -- Build order\n`;
    gnl += `  BUILD:\n`;
    gnl += seams.join('\n    >> ') + '\n';
  }

  gnl += '}\n';
  return gnl;
}
