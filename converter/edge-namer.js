// Edge index → semantic name inference
// Analyzes vertex positions to assign meaningful edge names

/**
 * @typedef {{ endpoints: number[], curvature?: number[] }} Edge
 * @typedef {number[][]} Vertices  - array of [x, y] pairs
 */

/**
 * Assign semantic names to panel edges based on geometry.
 *
 * Strategy: compute each edge's midpoint, then classify by position
 * relative to the panel's bounding box.
 *
 * @param {Edge[]} edges
 * @param {Vertices} vertices
 * @param {string} panelName
 * @param {string} garmentType
 * @returns {string[]} - semantic name for each edge index
 */
export function nameEdges(edges, vertices, panelName, garmentType) {
  const bbox = getBBox(vertices);
  const names = [];
  const usedNames = new Set();
  const name = panelName.toLowerCase();
  const isSleeve = name.includes('sleeve');
  const isBody = ['front', 'back', 'ftorso', 'btorso'].includes(name) ||
                 name.includes('top_') || name.includes('up_');

  for (let i = 0; i < edges.length; i++) {
    const edge = edges[i];
    const v0 = vertices[edge.endpoints[0]];
    const v1 = vertices[edge.endpoints[1]];
    const midX = (v0[0] + v1[0]) / 2;
    const midY = (v0[1] + v1[1]) / 2;
    const hasCurve = !!edge.curvature;

    let edgeName = classifyEdge(midX, midY, v0, v1, bbox, hasCurve, isSleeve, isBody, name, garmentType);

    // Deduplicate
    if (usedNames.has(edgeName)) {
      let suffix = 2;
      while (usedNames.has(edgeName + suffix)) suffix++;
      edgeName = edgeName + suffix;
    }
    usedNames.add(edgeName);
    names.push(edgeName);
  }

  return names;
}

/**
 * Classify a single edge based on its position in the panel.
 */
function classifyEdge(midX, midY, v0, v1, bbox, hasCurve, isSleeve, isBody, panelName, garmentType) {
  const { minX, maxX, minY, maxY } = bbox;
  const w = maxX - minX;
  const h = maxY - minY;
  const relX = w > 0 ? (midX - minX) / w : 0.5;
  const relY = h > 0 ? (midY - minY) / h : 0.5;

  // Edge direction
  const dx = Math.abs(v1[0] - v0[0]);
  const dy = Math.abs(v1[1] - v0[1]);
  const isHorizontal = dx > dy * 1.5;
  const isVertical = dy > dx * 1.5;

  // Sleeve edges
  if (isSleeve) {
    if (hasCurve) return 'cap';
    if (isHorizontal && relY < 0.3) return 'top';
    if (isHorizontal && relY > 0.7) return 'cuff';
    if (relX < 0.3) return 'front';
    if (relX > 0.7) return 'back';
    return 'under';
  }

  // Body panel edges (tee front/back, dress bodice, etc.)
  if (isBody) {
    if (hasCurve && relX < 0.5) return 'armhole_l';
    if (hasCurve && relX >= 0.5) return 'armhole_r';
    if (isHorizontal && relY > 0.7) return 'hem';
    if (isHorizontal && relY < 0.3) {
      if (relX < 0.5) return 'shoulder_l';
      return 'shoulder_r';
    }
    if (isVertical && relX < 0.3) return 'side_l';
    if (isVertical && relX > 0.7) return 'side_r';
    // Diagonal or middle edges — use position for discrimination
    if (relX < 0.3) return 'left';
    if (relX > 0.7) return 'right';
    if (relY < 0.3) return 'neckline';
    return 'side';
  }

  // Pants legs
  if (panelName.includes('front') || panelName.includes('back')) {
    if (hasCurve && relY > 0.5) return 'crotch';
    if (hasCurve) return 'waist_curve';
    if (isHorizontal && relY > 0.7) return 'hem';
    if (isHorizontal && relY < 0.3) return 'waist';
    if (isVertical && relX < 0.3) return 'inseam';
    if (isVertical && relX > 0.7) return 'outseam';
    return 'side';
  }

  // Skirt / generic
  if (isHorizontal && relY < 0.3) return 'top';
  if (isHorizontal && relY > 0.7) return 'hem';
  if (isVertical && relX < 0.3) return 'left';
  if (isVertical && relX > 0.7) return 'right';
  if (hasCurve) return 'curved';

  return 'edge';
}

/**
 * Get bounding box of vertices.
 */
function getBBox(vertices) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of vertices) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY };
}

/**
 * Compute the length of an edge (straight-line distance between endpoints).
 * @param {number[]} v0
 * @param {number[]} v1
 * @returns {number}
 */
export function edgeLength(v0, v1) {
  const dx = v1[0] - v0[0];
  const dy = v1[1] - v0[1];
  return Math.sqrt(dx * dx + dy * dy);
}
