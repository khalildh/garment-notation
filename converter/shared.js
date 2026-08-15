// Shared utilities for Korosteleva/GarmentCodeData → GNL converters

import { inferPanelSide } from './edge-namer.js';

// ---------------------------------------------------------------------------
// Panel orientation
// ---------------------------------------------------------------------------
//
// Pattern pieces are drafted in their own 2D frame and then placed in 3D by a
// rotation and a translation. A back panel is usually drafted mirrored, so its
// local +x ends up on the opposite side of the body from a front panel's. Edge
// naming has to happen in anatomical terms, not drafting terms, or "left" and
// "right" mean different things on different pieces of the same garment.
//
// Both datasets store the placement as XYZ Euler angles in degrees, so the
// sign of the world x/y components of the rotated local axes tells us whether
// the piece is mirrored. Anatomical +x is the wearer's left; +y is up.

/**
 * @param {number[]} rotation - [rx, ry, rz] in degrees
 * @returns {{ xFlip: number, yFlip: number }}
 */
export function panelOrientation(rotation) {
  if (!rotation || rotation.length < 3) return { xFlip: 1, yFlip: 1 };
  const [rx, ry, rz] = rotation.map(d => (d * Math.PI) / 180);
  const [cx, sx] = [Math.cos(rx), Math.sin(rx)];
  const [cy, sy] = [Math.cos(ry), Math.sin(ry)];
  const [cz, sz] = [Math.cos(rz), Math.sin(rz)];

  // R = Rz · Ry · Rx — we only need where local x̂ and ŷ end up.
  const xAxisWorldX = cz * cy;
  const yAxisWorldY = sz * sx * sy + cz * cx;

  return {
    xFlip: xAxisWorldX < -1e-9 ? -1 : 1,
    yFlip: yAxisWorldY < -1e-9 ? -1 : 1,
  };
}

/**
 * Re-express a panel's vertices in anatomical coordinates for naming purposes:
 * x = 0 is the body midline, +x is the wearer's left, +y is up. The emitted
 * geometry keeps the panel's own coordinates — this is only so that "left"
 * means the wearer's left on every piece of the garment.
 *
 * @param {{ vertices: number[][], rotation?: number[], translation?: number[] }} panel
 * @returns {number[][]}
 */
export function anatomicalVertices(panel) {
  const orient = panelOrientation(panel.rotation);
  const offsetX = panel.translation?.[0] ?? 0;
  return panel.vertices.map(([x, y]) => [x * orient.xFlip + offsetX, y * orient.yFlip]);
}

// ---------------------------------------------------------------------------
// Outline emission
// ---------------------------------------------------------------------------

/**
 * Walk a panel's edge list into a single closed ring.
 *
 * Datasets store edges as endpoint pairs into a vertex array, in an order that
 * chains but does not follow the vertex indices. GNL's `poly` is a ring, so
 * the edges have to be walked — and any edge traversed backwards has its
 * curve mirrored to match.
 *
 * @param {{ vertices: number[][], edges: any[] }} panel
 * @returns {{ ring: { x: number, y: number, curve: any, edgeIndex: number }[] } | null}
 */
export function buildRing(panel) {
  const edges = panel.edges;
  if (!edges || edges.length === 0) return null;

  const remaining = new Set(edges.map((_, i) => i));
  const ring = [];

  let cursor = edges[0].endpoints[0];
  const start = cursor;

  while (remaining.size > 0) {
    let picked = -1;
    let reversed = false;
    for (const i of remaining) {
      const [a, b] = edges[i].endpoints;
      if (a === cursor) { picked = i; reversed = false; break; }
      if (b === cursor) { picked = i; reversed = true; break; }
    }
    if (picked === -1) return null; // not a single closed ring

    remaining.delete(picked);
    const [a, b] = edges[picked].endpoints;
    const from = reversed ? b : a;
    const to = reversed ? a : b;
    const v = panel.vertices[from];
    ring.push({
      x: v[0],
      y: v[1],
      curve: normalizeCurve(edges[picked].curvature, reversed),
      edgeIndex: picked,
    });
    cursor = to;
  }

  return cursor === start ? { ring } : null;
}

/**
 * Bring the datasets' several curvature encodings into one shape, reversing
 * the parameterisation when the edge is walked backwards.
 */
function normalizeCurve(curvature, reversed) {
  if (!curvature) return null;

  // Korosteleva: a bare [t, d] pair — one quadratic control point.
  if (Array.isArray(curvature)) {
    return { type: 'quadratic', control: [flipRel(curvature, reversed)] };
  }

  const { type, params } = curvature;
  if (type === 'quadratic') {
    return { type: 'quadratic', control: [flipRel(params[0], reversed)] };
  }
  if (type === 'cubic') {
    const control = params.map(p => flipRel(p, reversed));
    return { type: 'cubic', control: reversed ? control.reverse() : control };
  }
  if (type === 'circle') {
    const [radius, large, sweep] = params;
    return {
      type: 'arc',
      radius,
      large_arc: large ? 1 : 0,
      sweep: reversed ? (sweep ? 0 : 1) : (sweep ? 1 : 0),
    };
  }
  return null;
}

/** Mirror an edge-relative control point when the edge is traversed backwards. */
function flipRel(p, reversed) {
  const [t, d] = Array.isArray(p) ? p : [p.x, p.y];
  return reversed ? { x: 1 - t, y: -d } : { x: t, y: d };
}

/**
 * Render a panel outline as GNL `poly[...]` source.
 *
 * @param {{ x: number, y: number, curve: any, edgeIndex: number }[]} ring
 * @param {string[]} edgeNames - indexed by source edge index
 * @param {number} scale - multiplier to normalise coordinates to centimetres
 * @param {string} indent
 * @returns {string}
 */
export function formatPoly(ring, edgeNames, scale, indent = '    ') {
  const lines = ring.map(v => {
    let s = `${indent}(${fmt(v.x * scale)}, ${fmt(v.y * scale)})`;
    if (v.curve) s += ` ~ ${formatCurve(v.curve, scale)}`;
    const name = edgeNames[v.edgeIndex];
    if (name) s += ` : ${name}`;
    return s;
  });
  return `poly[\n${lines.join(',\n')}\n${indent.slice(2)}]`;
}

function formatCurve(curve, scale) {
  if (curve.type === 'arc') {
    return `arc(${fmt(curve.radius * scale)}, ${curve.large_arc}, ${curve.sweep})`;
  }
  // Control points are edge-relative fractions, so they are scale-invariant.
  return `(${curve.control.map(c => `${fmt(c.x)}, ${fmt(c.y)}`).join('; ')})`;
}

function fmt(n) {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? '0' : String(r);
}

/**
 * Total length of a set of edges, in centimetres.
 * @param {{ vertices: number[][], edges: any[] }} panel
 * @param {number[]} edgeIndices
 * @param {number} scale
 */
export function measureEdges(panel, edgeIndices, scale) {
  let total = 0;
  for (const i of edgeIndices) {
    const [a, b] = panel.edges[i].endpoints;
    const v0 = panel.vertices[a];
    const v1 = panel.vertices[b];
    total += Math.hypot(v1[0] - v0[0], v1[1] - v0[1]) * scale;
  }
  return total;
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

/** Openings that exist once per limb rather than once around the body. */
const PAIRED_OPENINGS = new Set(['cuff', 'leg_hem']);

/**
 * Strip the disambiguating suffixes off an edge name to get its class.
 */
export function baseEdgeName(edgeName) {
  let name = edgeName;
  let previous;
  do {
    previous = name;
    name = name
      .replace(/_(l|r)$/, '')
      .replace(/_(upper|lower)$/, '')
      .replace(/_\d+$/, '');
  } while (name !== previous);
  return name;
}

/**
 * Classify an unstitched edge as part of a garment opening.
 *
 * Returns the opening it belongs to, or null if the edge is simply a finished
 * edge with no opening to speak of. The circumference is measured from the
 * geometry by the caller rather than guessed here.
 */
export function inferOpeningType(edgeName, panelName, garmentType) {
  const name = baseEdgeName(edgeName.toLowerCase());
  const panel = panelName.toLowerCase();
  const isSleeve = panel.includes('sleeve');

  if (name === 'neckline' && !isSleeve) {
    return { name: 'neck', location: '@neck', shape: 'circle' };
  }

  if (isSleeve && name === 'cuff') {
    return { name: 'cuff', location: '@wrist', shape: 'circle' };
  }

  if (name === 'waist') {
    return { name: 'waist', location: '@waist', shape: 'circle' };
  }

  if (name === 'hem') {
    if (isSleeve) return { name: 'cuff', location: '@wrist', shape: 'circle' };
    if (garmentType === 'pants' || garmentType === 'jumpsuit') {
      return { name: 'leg_hem', location: '@ankle', shape: 'circle' };
    }
    if (garmentType === 'dress' || garmentType === 'skirt') {
      return { name: 'hem', location: '@knee', shape: 'circle' };
    }
    return { name: 'hem', location: '@hip', shape: 'circle' };
  }

  return null;
}

/**
 * Collect unstitched edges into openings, measuring each one's circumference
 * from the outline rather than inventing a body-relative ease.
 *
 * @param {Record<string, any>} panels
 * @param {{ panel: string, edgeIdx: number, edgeName: string }[]} openEdges
 * @param {string} garmentType
 * @param {number} scale
 * @returns {{ name: string, location: string, shape: string, circumference: number }[]}
 */
export function collectOpenings(panels, openEdges, garmentType, scale) {
  const groups = new Map();

  for (const { panel, edgeIdx, edgeName } of openEdges) {
    const opening = inferOpeningType(edgeName, panel, garmentType);
    if (!opening) continue;

    // Openings that come one per limb are counted per limb; openings that go
    // around the body sum across all the panels that bound them.
    const side = PAIRED_OPENINGS.has(opening.name) ? inferPanelSide(panel) : null;
    const name = side ? `${opening.name}_${side.toLowerCase()}` : opening.name;

    const existing = groups.get(name);
    const length = measureEdges(panels[panel], [edgeIdx], scale);
    if (existing) {
      existing.circumference += length;
    } else {
      groups.set(name, { ...opening, name, circumference: length });
    }
  }

  return [...groups.values()].map(o => ({
    ...o,
    circumference: Math.round(o.circumference * 10) / 10,
  }));
}

/**
 * The header every converted file carries, so that machine-converted GNL is
 * never mistaken for authored GNL. Converted files look exactly like hand
 * written ones once they are in the viewer, and the difference matters: some
 * of what is below is measured and some of it is a guess.
 *
 * @param {{ name: string, source: string, tool: string, bilateral: boolean, extra?: string[] }} info
 */
export function provenanceHeader(info) {
  const lines = [
    `-- ${info.name} — converted from ${info.source}`,
    `-- Generated by ${info.tool}. Regenerate rather than hand-editing.`,
    `--`,
    `-- Measured from the source pattern: panel outlines (poly, in cm), edge`,
    `--   curvature, panel placement, opening circumferences, and the stitch list.`,
    `-- Inferred by the converter: body regions, edge names, and which unstitched`,
    `--   edges form which opening. Run converter/evaluate.js for how far those`,
    `--   inferences hold up against the dataset's own stitching.`,
    `-- Not in the source, so not here: fabric, grain, seam types (every seam is`,
    `--   emitted as plain), and construction order — BUILD lists the stitches in`,
    `--   dataset order, which is not a sewing sequence.`,
  ];
  if (info.bilateral) {
    lines.push(
      `-- Bilateral pairs are present but both sides are declared explicitly, so`,
      `--   the garment is not marked [SYM].`);
  }
  for (const e of info.extra || []) lines.push(`-- ${e}`);
  return lines.join('\n');
}

/**
 * Sanitize a panel name for use as a GNL identifier.
 */
export function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1');
}
