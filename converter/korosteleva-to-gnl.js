// Korosteleva JSON → GNL converter
// Converts garment templates from the NeurIPS 2021 dataset into GNL notation.

import { mapPanelToRegion, detectGarmentType } from './region-map.js';
import { nameEdges, panelKindFromRegion } from './edge-namer.js';
import {
  anatomicalVertices, buildRing, formatPoly, checkSymmetry,
  findOpenEdges, collectOpenings, sanitizeName, provenanceHeader,
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

  const regions = {};
  for (const name of panelNames) {
    regions[name] = mapPanelToRegion(name, garmentType).region;
  }

  const edgeNames = {};
  for (const [name, panel] of Object.entries(panels)) {
    // Named in anatomical coordinates so that "left" means the wearer's left
    // on every piece, however the piece itself was drafted.
    edgeNames[name] = nameEdges(
      panel.edges, anatomicalVertices(panel), name, garmentType,
      { kind: panelKindFromRegion(regions[name], garmentType) || undefined });
  }

  const declarations = [];
  const unresolved = [];
  for (const [name, panel] of Object.entries(panels)) {
    const region = regions[name];
    const gnlName = sanitizeName(name);
    const ring = buildRing(panel);

    if (!ring) {
      unresolved.push(name);
      declarations.push(`  ${gnlName} = P(${region}, contour, 1.0)   -- outline not a single closed ring`);
      continue;
    }

    // With a literal outline the ease parameter carries no information — the
    // outline is the measurement — so it is emitted as 1.0 rather than as a
    // ratio against a reference body the source pattern never mentioned.
    const poly = formatPoly(ring.ring, edgeNames[name], scale);
    declarations.push(`  ${gnlName} = P(${region}, ${poly}, 1.0)`);
  }

  const seams = [];
  for (const stitch of stitches) {
    const [a, b] = stitch;
    const aEdge = edgeNames[a.panel]?.[a.edge] || `edge${a.edge}`;
    const bEdge = edgeNames[b.panel]?.[b.edge] || `edge${b.edge}`;
    seams.push(`S(${sanitizeName(a.panel)}.${aEdge}, ${sanitizeName(b.panel)}.${bEdge}, plain)`);
  }

  const openEdges = findOpenEdges(panels, stitches, edgeNames);
  const openings = collectOpenings(panels, openEdges, garmentType, scale);

  return assembleGNL({
    name: sanitizeName(templateName),
    header: provenanceHeader({
      name: sanitizeName(templateName),
      source: 'the Korosteleva NeurIPS 2021 dataset',
      tool: 'converter/convert.js',
      bilateral: checkSymmetry(panelNames),
      extra: unresolved.length
        ? [`Panels whose edges do not form one closed ring, emitted without geometry: ${unresolved.join(', ')}.`]
        : [],
    }),
    declarations,
    openings,
    seams,
  });
}

/**
 * Lay out the GNL document.
 * @param {{ name: string, header: string, declarations: string[],
 *           openings: {name: string, location: string, shape: string, circumference: number}[],
 *           seams: string[] }} parts
 */
export function assembleGNL(parts) {
  let gnl = parts.header + '\n\n';
  gnl += `GARMENT ${parts.name} {\n\n`;

  gnl += `  -- Panels\n`;
  gnl += parts.declarations.join('\n') + '\n';

  if (parts.openings.length > 0) {
    gnl += `\n  -- Openings (circumference measured from the unstitched edges)\n`;
    for (const o of parts.openings) {
      gnl += `  ${o.name} = O(${o.location}, ${o.shape}, ${o.circumference}cm)\n`;
    }
  }

  if (parts.seams.length > 0) {
    gnl += `\n  -- Stitches, in dataset order\n`;
    gnl += `  BUILD:\n`;
    gnl += '    ' + parts.seams.join('\n    >> ') + '\n';
  }

  return gnl + '}\n';
}
