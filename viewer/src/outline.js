// @ts-check
// Literal panel outlines — the `poly` shape.
//
// A poly is a closed ring of vertices in panel-local centimetres, y-up. Each
// vertex carries the curve and name of the edge *leaving* it, so vertex i
// describes the edge from vertex i to vertex i+1 (the last wrapping to the
// first). Curve control points use the edge-local frame shared by the
// Korosteleva and GarmentCode datasets: the origin is the edge start, x runs
// along the edge to its end, and y runs perpendicular (-dy, dx).

/** @typedef {import('./types.js').PolyVertex} PolyVertex */
/** @typedef {import('./types.js').EdgeCurve} EdgeCurve */
/** @typedef {import('./types.js').Expr} Expr */

/**
 * Pull the outline out of a panel's shape argument, if it has one.
 * @param {Expr | undefined} expr
 * @returns {PolyVertex[] | null}
 */
export function outlineFromShape(expr) {
  if (expr && /** @type {any} */ (expr).type === 'poly') {
    return /** @type {any} */ (expr).vertices;
  }
  return null;
}

/**
 * @param {PolyVertex[]} vertices
 * @returns {{ minX: number, maxX: number, minY: number, maxY: number, width: number, height: number }}
 */
export function outlineBBox(vertices) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const v of vertices) {
    if (v.x < minX) minX = v.x;
    if (v.x > maxX) maxX = v.x;
    if (v.y < minY) minY = v.y;
    if (v.y > maxY) maxY = v.y;
  }
  return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * The edges of the ring, in order. Edge i runs from vertex i to vertex i+1.
 * @param {PolyVertex[]} vertices
 * @returns {{ index: number, name: string | null, from: PolyVertex, to: PolyVertex, curve: EdgeCurve | null }[]}
 */
export function outlineEdges(vertices) {
  return vertices.map((v, i) => ({
    index: i,
    name: v.edge ?? null,
    from: v,
    to: vertices[(i + 1) % vertices.length],
    curve: v.curve ?? null,
  }));
}

/**
 * Straight-line length of each edge, in centimetres.
 * @param {PolyVertex[]} vertices
 * @returns {number[]}
 */
export function outlineEdgeLengths(vertices) {
  return outlineEdges(vertices).map(e =>
    Math.hypot(e.to.x - e.from.x, e.to.y - e.from.y));
}

/**
 * Convert an edge-relative control point to panel coordinates.
 * @param {{x: number, y: number}} start
 * @param {{x: number, y: number}} end
 * @param {{x: number, y: number}} rel
 * @returns {{x: number, y: number}}
 */
export function relToAbs(start, end, rel) {
  const ex = end.x - start.x;
  const ey = end.y - start.y;
  return {
    x: start.x + rel.x * ex + rel.y * -ey,
    y: start.y + rel.x * ey + rel.y * ex,
  };
}

/**
 * Build an SVG path for an outline, mapped into a top-left-origin screen box.
 *
 * Pattern space is y-up and screen space is y-down, so the mapping mirrors the
 * outline vertically — which also flips the handedness of any circular arc.
 *
 * @param {PolyVertex[]} vertices
 * @param {number} scale - screen units per centimetre
 * @returns {string}
 */
export function outlinePath(vertices, scale) {
  if (!vertices || vertices.length < 2) return '';
  const bbox = outlineBBox(vertices);

  /** @param {{x: number, y: number}} p */
  const toScreen = (p) => ({
    x: (p.x - bbox.minX) * scale,
    y: (bbox.maxY - p.y) * scale,
  });

  const fmt = (/** @type {{x: number, y: number}} */ p) =>
    `${p.x.toFixed(2)},${p.y.toFixed(2)}`;

  const first = toScreen(vertices[0]);
  let d = `M ${fmt(first)}`;

  for (const edge of outlineEdges(vertices)) {
    const to = toScreen(edge.to);
    const curve = edge.curve;

    if (!curve) {
      d += ` L ${fmt(to)}`;
      continue;
    }

    if (curve.type === 'arc') {
      const r = curve.radius * scale;
      // Mirroring the y axis reverses the sweep direction.
      const sweep = curve.sweep ? 0 : 1;
      d += ` A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${curve.large_arc ? 1 : 0} ${sweep} ${fmt(to)}`;
      continue;
    }

    const ctrl = curve.control.map(c => toScreen(relToAbs(edge.from, edge.to, c)));
    if (ctrl.length === 1) {
      d += ` Q ${fmt(ctrl[0])} ${fmt(to)}`;
    } else {
      d += ` C ${fmt(ctrl[0])} ${fmt(ctrl[1])} ${fmt(to)}`;
    }
  }

  return d + ' Z';
}
