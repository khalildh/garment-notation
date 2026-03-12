// Shared utilities for Korosteleva/GarmentCodeData → GNL converters

/**
 * Infer shape from vertices and edges.
 */
export function inferShape(vertices, edges) {
  const hasCurves = edges.some(e => e.curvature);
  if (hasCurves) return 'contour';

  const n = vertices.length;
  if (n === 4) {
    // Check if trapezoid: compare top and bottom widths
    const sorted = [...vertices].sort((a, b) => a[1] - b[1]);
    const topVerts = sorted.slice(0, 2);
    const botVerts = sorted.slice(-2);
    const topW = Math.abs(topVerts[1][0] - topVerts[0][0]);
    const botW = Math.abs(botVerts[1][0] - botVerts[0][0]);
    if (Math.abs(topW - botW) / Math.max(topW, botW) > 0.1) {
      return 'trapezoid';
    }
    return 'rect';
  }

  // 5+ vertices or any curves → contour
  return 'contour';
}

/**
 * Infer ease from panel dimensions vs body region.
 * Returns a reasonable default since we can't precisely measure body fit.
 */
export function inferEase(vertices, region, scale) {
  // Compute panel width (horizontal span)
  const xs = vertices.map(v => v[0]);
  const panelWidth = (Math.max(...xs) - Math.min(...xs)) * scale;

  // Rough body widths for comparison (half-circumference for front/back panels)
  const bodyWidths = {
    '%torso.front': 46,
    '%torso.back': 44,
    '%arm.L': 32,
    '%arm.R': 32,
    '%leg.L': 28,
    '%leg.R': 28,
    '%waist': 37,
    '%neck': 18,
  };

  const baseRegion = region.split('[')[0].split(' +')[0].trim();
  const bodyWidth = bodyWidths[baseRegion];

  if (bodyWidth && panelWidth > 0) {
    const ratio = panelWidth / bodyWidth;
    if (ratio > 0.8 && ratio < 3.0) {
      return ratio.toFixed(2);
    }
  }

  // Default moderate ease
  return '1.1';
}

/**
 * Check if the garment has bilateral symmetry.
 */
export function checkSymmetry(panelNames) {
  const names = panelNames.map(n => n.toLowerCase());
  // Look for L/R pairs
  const lPanels = names.filter(n => n.startsWith('l') && !n.startsWith('lo'));
  const rPanels = names.filter(n => n.startsWith('r'));

  if (lPanels.length > 0 && rPanels.length > 0) {
    // Check if each L panel has an R counterpart
    const matches = lPanels.filter(l => {
      const rName = 'r' + l.slice(1);
      return rPanels.includes(rName);
    });
    return matches.length === lPanels.length && matches.length > 0;
  }
  return false;
}

/**
 * Find edges not involved in any stitch (open edges).
 */
export function findOpenEdges(panels, stitches, edgeNames) {
  const stitchedEdges = new Set();
  for (const stitch of stitches) {
    for (const side of stitch) {
      stitchedEdges.add(`${side.panel}:${side.edge}`);
    }
  }

  const openEdges = [];
  for (const [panelName, panel] of Object.entries(panels)) {
    for (let i = 0; i < panel.edges.length; i++) {
      const key = `${panelName}:${i}`;
      if (!stitchedEdges.has(key)) {
        openEdges.push({
          panel: panelName,
          edgeIdx: i,
          edgeName: edgeNames[panelName]?.[i] || `e${i}`,
        });
      }
    }
  }
  return openEdges;
}

/**
 * Infer opening type from an open edge's semantic name.
 */
export function inferOpeningType(edgeName, panelName, garmentType) {
  const name = edgeName.toLowerCase();
  const panel = panelName.toLowerCase();
  const hasBody = ['tee', 'jacket', 'dress', 'jumpsuit'].includes(garmentType);
  const isSleeve = panel.includes('sleeve');

  // Neck/collar openings — only for garments with a torso body
  if ((name === 'neckline' || name.startsWith('shoulder')) && hasBody && !isSleeve) {
    return { name: 'neck', location: '@neck', shape: 'circle', size: 'body+2cm' };
  }

  // Hem openings
  if (name === 'hem' || (name === 'top' && !isSleeve && !hasBody)) {
    if (garmentType === 'tee' || garmentType === 'jacket') {
      return { name: 'hem', location: '@hip', shape: 'circle', size: 'body+10cm' };
    }
    if (garmentType === 'dress') {
      return { name: 'hem', location: '@knee', shape: 'circle', size: 'body+10cm' };
    }
    if (garmentType === 'pants') {
      return { name: 'leg_hem', location: '@ankle', shape: 'circle', size: 'body+4cm' };
    }
    if (garmentType === 'skirt') {
      return { name: 'hem', location: '@knee', shape: 'circle', size: 'body+10cm' };
    }
  }

  // Sleeve cuff openings
  if (isSleeve && (name === 'cuff' || name === 'top')) {
    return { name: 'cuff', location: '@wrist', shape: 'circle', size: 'body+4cm' };
  }

  // Waist openings for bottom garments
  if (name === 'waist' || (name === 'top' && (garmentType === 'skirt' || garmentType === 'pants'))) {
    return { name: 'waist', location: '@waist', shape: 'circle', size: 'body+2cm' };
  }

  return null;
}

/**
 * Sanitize a panel name for use as a GNL identifier.
 */
export function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
}
