// Edge index → semantic name inference.
//
// Coordinate conventions (verified against both source datasets):
//   * Panel-local y is UP — the hem of a torso panel sits at the *lowest* y,
//     the shoulders at the highest.
//   * Panel-local x runs from the wearer's right (negative) to the wearer's
//     left (positive). Confirmed by the stitch graph: the right sleeve's cap
//     joins the negative-x armhole of the front panel.
//
// Naming is derived from geometry alone — the stitch graph is deliberately not
// consulted, so that converter/evaluate.js can measure how much of the
// stitching these names actually explain.

/**
 * @typedef {{ endpoints: number[], curvature?: any }} Edge
 * @typedef {number[][]} Vertices - array of [x, y] pairs
 * @typedef {{ side?: 'L'|'R'|null, kind?: string }} NameOpts
 */

/**
 * Assign semantic names to panel edges based on geometry.
 *
 * @param {Edge[]} edges
 * @param {Vertices} vertices
 * @param {string} panelName
 * @param {string} garmentType
 * @param {NameOpts} [opts]
 * @returns {string[]} - semantic name for each edge index
 */
export function nameEdges(edges, vertices, panelName, garmentType, opts = {}) {
  const bbox = getBBox(vertices);
  const kind = opts.kind || inferPanelKind(panelName, garmentType);
  const side = opts.side ?? inferPanelSide(panelName);
  const facing = opts.facing ?? inferPanelFacing(panelName);

  const geom = edges.map((edge, i) => describeEdge(edge, vertices, bbox, i));

  const darts = detectDarts(geom);

  let names;
  switch (kind) {
    case 'sleeve': names = nameSleeveEdges(geom); break;
    case 'leg':    names = nameLegEdges(geom); break;
    case 'torso':  names = nameTorsoEdges(geom, bbox, facing); break;
    case 'skirt':  names = nameSkirtEdges(geom); break;
    case 'band':   names = nameBandEdges(geom); break;
    default:       names = nameGenericEdges(geom); break;
  }

  return disambiguate(names.map((n, i) => darts[i] || n), geom);
}

/**
 * A dart shows up in the outline as a narrow V: two consecutive edges of
 * near-equal length whose far endpoints almost meet. Both legs get named as
 * one dart so the seam that closes it reads as a dart rather than as two
 * unrelated edges.
 *
 * @returns {(string|null)[]}
 */
function detectDarts(geom) {
  const n = geom.length;
  const darts = new Array(n).fill(null);
  let count = 0;

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (darts[i] || darts[j] || j === i) continue;
    const a = geom[i];
    const b = geom[j];
    const shorter = Math.min(a.length, b.length);
    if (shorter < 2) continue;
    if (shorter / Math.max(a.length, b.length) < 0.75) continue;
    // The mouth of the V, measured between the two outer endpoints.
    const mouth = Math.hypot(b.v1[0] - a.v0[0], b.v1[1] - a.v0[1]);
    if (mouth > 0.5 * shorter) continue;

    count++;
    darts[i] = `dart${count}_a`;
    darts[j] = `dart${count}_b`;
  }

  return darts;
}

// ---------------------------------------------------------------------------
// Edge geometry
// ---------------------------------------------------------------------------

/**
 * Measure one edge in panel-normalised terms.
 * `relTop` is 0 at the top of the panel and 1 at the bottom (y is up in the
 * source data, so this is the inverse of the raw y fraction).
 */
function describeEdge(edge, vertices, bbox, index) {
  const v0 = vertices[edge.endpoints[0]];
  const v1 = vertices[edge.endpoints[1]];
  const midX = (v0[0] + v1[0]) / 2;
  const midY = (v0[1] + v1[1]) / 2;
  const w = bbox.maxX - bbox.minX;
  const h = bbox.maxY - bbox.minY;
  const dx = Math.abs(v1[0] - v0[0]);
  const dy = Math.abs(v1[1] - v0[1]);

  return {
    index,
    v0,
    v1,
    midX,
    midY,
    relX: w > 0 ? (midX - bbox.minX) / w : 0.5,
    relTop: h > 0 ? (bbox.maxY - midY) / h : 0.5,
    length: Math.hypot(dx, dy),
    isHorizontal: dx > dy * 1.5,
    isVertical: dy > dx * 1.5,
    hasCurve: !!edge.curvature,
    spansCenter: (v0[0] - (bbox.minX + w / 2)) * (v1[0] - (bbox.minX + w / 2)) <= 0,
  };
}

/** Wearer's side for a point in panel-local x: low x is the wearer's right. */
function sideSuffix(relX) {
  if (relX < 0.42) return '_r';
  if (relX > 0.58) return '_l';
  return '';
}

/**
 * Wearer's side from an anatomical x coordinate, where 0 is the body midline.
 * Half-panels sit entirely on one side of it, full panels straddle it.
 */
function anatomicalSide(x, scale) {
  if (x < -0.06 * scale) return '_r';
  if (x > 0.06 * scale) return '_l';
  return '';
}

// ---------------------------------------------------------------------------
// Torso panels (tee front/back, bodice, jacket body)
// ---------------------------------------------------------------------------

/**
 * Torso edges are placed against the body midline (anatomical x = 0) rather
 * than the panel's own centre, so a half-panel — which never straddles the
 * midline — is read the same way as a full front or back.
 *
 * @param {'front'|'back'|null} facing
 */
function nameTorsoEdges(geom, bbox, facing) {
  const reach = Math.max(Math.abs(bbox.minX), Math.abs(bbox.maxX)) || 1;
  const touchesMidline = Math.min(Math.abs(bbox.minX), Math.abs(bbox.maxX)) < 0.1 * reach;
  const centerName = facing === 'back' ? 'center_back' : 'center_front';

  return geom.map(e => {
    const nearMidline = Math.abs(e.midX) < 0.35 * reach;
    const atExtreme = Math.abs(e.midX) > 0.6 * reach;

    // Centre front/back: the fold or seam line running down the midline.
    if (touchesMidline && e.isVertical && Math.abs(e.midX) < 0.1 * reach) {
      return centerName;
    }
    // Neckline: near the top, close to the midline.
    if (e.relTop < 0.3 && nearMidline && !e.isVertical) {
      return 'neckline' + anatomicalSide(e.midX, reach);
    }
    // Shoulder: horizontal run along the top, away from the midline.
    if (e.relTop < 0.2 && e.isHorizontal) {
      return 'shoulder' + anatomicalSide(e.midX, reach);
    }
    // Armhole: the shaped edge in the upper corner.
    if (e.relTop < 0.6 && (e.hasCurve || e.isVertical) && atExtreme) {
      return 'armhole' + anatomicalSide(e.midX, reach);
    }
    // Hem: horizontal run along the bottom.
    if (e.relTop > 0.8 && e.isHorizontal) return 'hem';
    // Side seam: the long vertical edges out at the body's width.
    if (e.isVertical && atExtreme) {
      return 'side' + anatomicalSide(e.midX, reach);
    }
    return null;
  });
}

// ---------------------------------------------------------------------------
// Sleeve panels
// ---------------------------------------------------------------------------

/**
 * Sleeves are named along the arm axis rather than the panel's x/y axes: a
 * short set-in sleeve is drafted lying on its side, so "up the sleeve" may be
 * either direction. The cap is the shaped edge; the arm axis points from the
 * cap towards the rest of the panel; the cuff is the edge furthest along it.
 */
function nameSleeveEdges(geom) {
  const names = new Array(geom.length).fill(null);
  if (geom.length === 0) return names;

  // The cap is the curved edge; failing that, the shortest end edge.
  const curved = geom.filter(e => e.hasCurve);
  const cap = curved.length
    ? curved.reduce((a, b) => (a.length >= b.length ? a : b))
    : null;
  if (!cap) return names;
  names[cap.index] = 'cap';

  // A cap is often drafted as several curve segments in a row; adjacent curved
  // edges belong to it rather than being separate features.
  const n = geom.length;
  for (const e of curved) {
    const gap = Math.abs(e.index - cap.index);
    if (names[e.index] === null && (gap === 1 || gap === n - 1)) {
      names[e.index] = 'cap';
    }
  }

  const cx = geom.reduce((s, e) => s + e.midX, 0) / geom.length;
  const cy = geom.reduce((s, e) => s + e.midY, 0) / geom.length;
  let ax = cx - cap.midX;
  let ay = cy - cap.midY;
  const alen = Math.hypot(ax, ay) || 1;
  ax /= alen;
  ay /= alen;

  const rest = geom.filter(e => names[e.index] === null);
  if (rest.length === 0) return names;
  const along = e => (e.midX - cap.midX) * ax + (e.midY - cap.midY) * ay;
  const across = e => (e.midX - cap.midX) * -ay + (e.midY - cap.midY) * ax;

  // The cuff is the far end of the sleeve, and it runs across the arm axis.
  const cuff = rest.reduce((a, b) => (along(a) >= along(b) ? a : b));
  names[cuff.index] = 'cuff';

  // Whatever is left runs along the arm: the sleeve seams.
  const seams = rest.filter(e => e.index !== cuff.index);
  seams.sort((a, b) => across(b) - across(a));
  if (seams.length === 1) {
    names[seams[0].index] = 'under';
  } else if (seams.length >= 2) {
    names[seams[0].index] = 'upper';
    names[seams[seams.length - 1].index] = 'under';
    for (const e of seams.slice(1, -1)) names[e.index] = 'seam';
  }

  return names;
}

// ---------------------------------------------------------------------------
// Leg panels (pants)
// ---------------------------------------------------------------------------

/**
 * The inseam faces the wearer's midline and the outseam faces away from it, so
 * they are told apart by distance from anatomical x = 0 rather than by which
 * leg this is or how the piece happens to be drafted.
 */
function nameLegEdges(geom) {
  const xs = geom.map(e => Math.abs(e.midX));
  const near = Math.min(...xs);
  const far = Math.max(...xs);
  const mid = (near + far) / 2;

  return geom.map(e => {
    if (e.hasCurve && e.relTop < 0.5) return 'crotch';
    if (e.relTop < 0.2 && e.isHorizontal) return 'waist';
    if (e.relTop > 0.8 && e.isHorizontal) return 'hem';
    if (e.isVertical || e.relTop > 0.2) {
      return Math.abs(e.midX) < mid ? 'inseam' : 'outseam';
    }
    return null;
  });
}

// ---------------------------------------------------------------------------
// Skirt / generic panels
// ---------------------------------------------------------------------------

function nameSkirtEdges(geom) {
  return geom.map(e => {
    if (e.relTop < 0.2 && e.isHorizontal) return 'waist';
    if (e.relTop > 0.8 && e.isHorizontal) return 'hem';
    if (e.isVertical || e.length > 0) {
      if (e.relX < 0.4) return 'side_r';
      if (e.relX > 0.6) return 'side_l';
    }
    return null;
  });
}

/**
 * A waistband or cuff: a long strip whose lower edge is sewn to the garment
 * and whose upper edge finishes the opening.
 */
function nameBandEdges(geom) {
  return geom.map(e => {
    if (e.relTop < 0.3 && e.isHorizontal) return 'waist';
    if (e.relTop > 0.7 && e.isHorizontal) return 'hem';
    if (e.relX < 0.4) return 'end_r';
    if (e.relX > 0.6) return 'end_l';
    return null;
  });
}

function nameGenericEdges(geom) {
  return geom.map(e => {
    if (e.relTop < 0.2 && e.isHorizontal) return 'top';
    if (e.relTop > 0.8 && e.isHorizontal) return 'bottom';
    if (e.isVertical && e.relX < 0.3) return 'side_r';
    if (e.isVertical && e.relX > 0.7) return 'side_l';
    return null;
  });
}

// ---------------------------------------------------------------------------
// Name resolution
// ---------------------------------------------------------------------------

/**
 * Turn the raw classification into unique, honest names.
 *
 * An edge the classifier could not place keeps a positional name (`edge3`)
 * rather than borrowing a semantic one it hasn't earned. Collisions are split
 * by anatomical side first, then by vertical position, and only fall back to a
 * numeric suffix when neither separates them.
 */
function disambiguate(names, geom) {
  const counts = new Map();
  for (const n of names) if (n) counts.set(n, (counts.get(n) || 0) + 1);

  const used = new Set();
  const out = [];

  for (let i = 0; i < names.length; i++) {
    let name = names[i];

    if (!name) {
      name = `edge${i}`;
    } else if (counts.get(name) > 1) {
      const e = geom[i];
      const bySide = sideSuffix(e.relX);
      if (bySide && !name.endsWith(bySide) && !used.has(name + bySide)) {
        name += bySide;
      } else {
        const byHeight = e.relTop < 0.5 ? '_upper' : '_lower';
        if (!used.has(name + byHeight)) name += byHeight;
      }
    }

    if (used.has(name)) {
      let suffix = 2;
      while (used.has(`${name}_${suffix}`)) suffix++;
      name = `${name}_${suffix}`;
    }

    used.add(name);
    out.push(name);
  }

  return out;
}

// ---------------------------------------------------------------------------
// Panel classification
// ---------------------------------------------------------------------------

/**
 * The body region a panel maps to is a better guide to how to read its edges
 * than its name is — a jumpsuit's `Rfront` is a leg, not a bodice.
 *
 * @param {string} region
 * @returns {'sleeve'|'torso'|'leg'|'skirt'|'band'|null}
 */
export function panelKindFromRegion(region, garmentType) {
  if (!region) return null;
  const hasArm = region.includes('%arm');
  const hasLeg = region.includes('%leg');
  const hasTorso = region.includes('%torso');

  if (hasArm) return 'sleeve';
  if (region.includes('%waist') || region.includes('%hip')) return 'band';
  if (hasLeg && hasTorso) return 'skirt';
  // A skirt's gores cover the legs without being leg pieces: they have side
  // seams and a waist, not an inseam.
  if (hasLeg) return garmentType === 'skirt' ? 'skirt' : 'leg';
  if (hasTorso) return 'torso';
  return null;
}

/** @returns {'sleeve'|'torso'|'leg'|'skirt'|'band'|'generic'} */
export function inferPanelKind(panelName, garmentType) {
  const n = panelName.toLowerCase();
  if (n.includes('sleeve')) return 'sleeve';
  if (n.includes('cuff') || n.includes('band')) return 'band';
  if (n.includes('collar') || n.includes('hood')) return 'generic';
  if (n.includes('skirt')) return 'skirt';
  if (n.includes('pant') || n.includes('leg')) return 'leg';
  if (garmentType === 'pants') return 'leg';
  if (garmentType === 'skirt') return 'skirt';
  if (/torso|bodice|front|back/.test(n) || n.startsWith('top_') || n.startsWith('up_')) {
    return 'torso';
  }
  return 'generic';
}

/** @returns {'front'|'back'|null} */
export function inferPanelFacing(panelName) {
  const n = panelName.toLowerCase();
  if (/(^|_)b(torso|ack)|back|(^|_)b_|_b$/.test(n)) return 'back';
  if (/(^|_)f(torso|ront)|front|(^|_)f_|_f$/.test(n)) return 'front';
  return null;
}

/** @returns {'L'|'R'|null} */
export function inferPanelSide(panelName) {
  const n = panelName.toLowerCase();
  if (/(^|_)left(_|$)|_l$|^l[fb]?(sleeve|torso|front|back)/.test(n)) return 'L';
  if (/(^|_)right(_|$)|_r$|^r[fb]?(sleeve|torso|front|back)/.test(n)) return 'R';
  return null;
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
