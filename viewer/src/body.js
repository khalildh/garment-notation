// @ts-check
/** @typedef {import('./types.js').RegionDims} RegionDims */
/** @typedef {import('./types.js').Expr} Expr */

// Standard body measurements in cm (women's medium / size 10)
export const BODY = {
  neck_circ: 37,
  shoulder_width: 40,
  bust_circ: 92,
  waist_circ: 74,
  hip_circ: 98,
  torso_length: 42,
  full_length: 58,
  arm_length: 58,
  upper_arm_circ: 32,
  elbow_circ: 24,
  wrist_circ: 16,
  inseam: 78,
  thigh_circ: 56,
  knee_circ: 38,
  ankle_circ: 22,
};

/** @type {Record<string, { wTop: number, wBot: number, h: number }>} */
const REGION_DIMS = {
  'torso.front':   { wTop: 46, wBot: 37, h: 42 },
  'torso.back':    { wTop: 44, wBot: 37, h: 40 },
  'torso':         { wTop: 46, wBot: 37, h: 42 },
  'torso.L':       { wTop: 23, wBot: 18.5, h: 42 },
  'torso.R':       { wTop: 23, wBot: 18.5, h: 42 },
  'torso.front.L': { wTop: 23, wBot: 18.5, h: 42 },
  'torso.front.R': { wTop: 23, wBot: 18.5, h: 42 },
  'torso.back.L':  { wTop: 22, wBot: 18.5, h: 40 },
  'torso.back.R':  { wTop: 22, wBot: 18.5, h: 40 },
  'arm':           { wTop: 32, wBot: 16, h: 58 },
  'arm.L':         { wTop: 32, wBot: 16, h: 58 },
  'arm.R':         { wTop: 32, wBot: 16, h: 58 },
  'leg':           { wTop: 28, wBot: 11, h: 78 },
  'leg.L':         { wTop: 28, wBot: 11, h: 78 },
  'leg.R':         { wTop: 28, wBot: 11, h: 78 },
  'neck':          { wTop: 37, wBot: 37, h: 8 },
  'shoulder':      { wTop: 14, wBot: 14, h: 5 },
  'shoulder.L':    { wTop: 14, wBot: 14, h: 5 },
  'shoulder.R':    { wTop: 14, wBot: 14, h: 5 },
  'waist':         { wTop: 74, wBot: 74, h: 4 },
  'hip':           { wTop: 98, wBot: 98, h: 10 },
};

/**
 * @param {number} a
 * @param {number} b
 * @param {number} t
 */
function lerp(a, b, t) { return a + (b - a) * t; }

/**
 * Get dimensions for a body region, optionally narrowed by a range.
 * @param {string} regionStr - e.g. "%torso.front"
 * @param {Expr | null} range - range expression or null
 * @returns {RegionDims}
 */
export function getRegionDims(regionStr, range) {
  const key = regionStr.replace(/^%/, '');
  const base = REGION_DIMS[key] || { wTop: 30, wBot: 30, h: 30 };

  let rangeStart = 0, rangeEnd = 1;
  if (range && range.type === 'range') {
    rangeStart = /** @type {any} */ (range).start?.value ?? 0;
    rangeEnd = /** @type {any} */ (range).end?.value ?? 1;
  }

  return {
    widthTop: lerp(base.wTop, base.wBot, rangeStart),
    widthBottom: lerp(base.wTop, base.wBot, rangeEnd),
    height: base.h * (rangeEnd - rangeStart),
  };
}

/**
 * Combine dimensions for region unions (A + B).
 * @param {RegionDims} dimsA
 * @param {RegionDims} dimsB
 * @returns {RegionDims}
 */
export function combineRegions(dimsA, dimsB) {
  return {
    widthTop: Math.max(dimsA.widthTop, dimsB.widthTop),
    widthBottom: Math.max(dimsA.widthBottom, dimsB.widthBottom),
    height: dimsA.height + dimsB.height,
  };
}

/**
 * Resolve a named variable to a body measurement.
 * @param {string} name
 * @returns {number | null}
 */
export function resolveVar(name) {
  /** @type {Record<string, number>} */
  const map = {
    W: BODY.waist_circ,
    neck_circ: BODY.neck_circ,
    bust_circ: BODY.bust_circ,
    waist_circ: BODY.waist_circ,
    hip_circ: BODY.hip_circ,
  };
  return map[name] ?? null;
}
