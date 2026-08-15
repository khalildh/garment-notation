#!/usr/bin/env node
// Measure what converted GNL actually carries.
//
// Two questions get asked separately, because they have different answers:
//
//   1. Round trip — can the emitted GNL document, on its own, be turned back
//      into the pattern it came from? Every panel outline and every stitch has
//      to survive the trip through the notation. This is a property of the
//      language: if it fails, GNL cannot express what the dataset holds.
//
//   2. Semantics — do the edge names the converter invents actually explain
//      the stitching? A seam that joins `shoulder_l` to `shoulder_l` is
//      explained; one that joins `hem` to `edge7` is not. This is a property
//      of the converter's heuristics, not of the language, and naming every
//      edge `edge0..edgeN` would score 100% on (1) and 0% here.
//
// Usage:
//   node converter/evaluate.js            # all bundled examples
//   node converter/evaluate.js --json     # machine-readable results

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';

import { parse } from '../viewer/src/gnl-parser.js';
import { pegAstToLegacy } from '../viewer/src/peg-adapter.js';
import { outlineEdges } from '../viewer/src/outline.js';
import { convert } from './korosteleva-to-gnl.js';
import { convertGCD } from './garmentcodedata-to-gnl.js';
import { baseEdgeName } from './shared.js';

const __dirname = dirname(new URL(import.meta.url).pathname);
const TOLERANCE = 0.05; // cm

// ---------------------------------------------------------------------------
// Reading a pattern back out of GNL
// ---------------------------------------------------------------------------

/**
 * Rebuild panels and stitches from GNL source text alone.
 *
 * Nothing from the original JSON is consulted here — that is the point.
 *
 * @param {string} gnl
 */
export function readBackPattern(gnl) {
  const ast = pegAstToLegacy(parse(gnl));
  const block = ast.blocks[0];

  /** @type {Record<string, {outline: any[], edgesByName: Map<string, number>}>} */
  const panels = {};

  for (const decl of block.declarations) {
    if (decl.value.type !== 'call' || decl.value.name !== 'P') continue;
    const shape = decl.value.args[1];
    if (!shape || shape.type !== 'poly') continue;

    const edgesByName = new Map();
    outlineEdges(shape.vertices).forEach(e => {
      if (e.name) edgesByName.set(e.name, e.index);
    });
    panels[decl.name] = { outline: shape.vertices, edgesByName };
  }

  const stitches = [];
  for (const step of block.build) {
    const op = step.operation;
    if (op?.type !== 'call' || op.name !== 'S') continue;
    const a = splitRef(op.args[0]);
    const b = splitRef(op.args[1]);
    if (a && b) stitches.push([a, b]);
  }

  return { panels, stitches };
}

function splitRef(expr) {
  const raw = expr?.value;
  if (typeof raw !== 'string') return null;
  const dot = raw.indexOf('.');
  if (dot === -1) return null;
  return { panel: raw.slice(0, dot), edge: raw.slice(dot + 1) };
}

// ---------------------------------------------------------------------------
// Round trip
// ---------------------------------------------------------------------------

/**
 * Match each edge of a GNL outline back to an edge of the source panel by its
 * endpoints. A source edge that no outline edge lands on is geometry the
 * notation lost.
 */
function matchEdges(outline, sourcePanel, scale) {
  const ringEdges = outlineEdges(outline);
  const srcEdges = sourcePanel.edges.map((e, i) => {
    const [a, b] = e.endpoints;
    return {
      index: i,
      v0: sourcePanel.vertices[a].map(v => v * scale),
      v1: sourcePanel.vertices[b].map(v => v * scale),
      curved: !!e.curvature,
    };
  });

  const ringToSource = new Map();
  const usedSource = new Set();
  let curveMismatches = 0;

  for (const re of ringEdges) {
    const match = srcEdges.find(se => {
      if (usedSource.has(se.index)) return false;
      const forward = near(re.from, se.v0) && near(re.to, se.v1);
      const backward = near(re.from, se.v1) && near(re.to, se.v0);
      return forward || backward;
    });
    if (!match) continue;
    usedSource.add(match.index);
    ringToSource.set(re.index, match.index);
    if (!!re.curve !== match.curved) curveMismatches++;
  }

  return {
    ringToSource,
    matched: ringToSource.size,
    total: srcEdges.length,
    curveMismatches,
  };
}

function near(p, v) {
  return Math.abs(p.x - v[0]) < TOLERANCE && Math.abs(p.y - v[1]) < TOLERANCE;
}

function stitchKey(pair) {
  return pair
    .map(s => `${s.panel}:${s.edge}`)
    .sort()
    .join('|');
}

/**
 * @param {object} json - the source pattern
 * @param {string} gnl - the converted GNL
 */
export function evaluatePattern(json, gnl) {
  const pattern = json.pattern;
  const scale = 100 / (json.properties?.units_in_meter || 100);
  const readBack = readBackPattern(gnl);

  // --- geometry ---
  let edgesMatched = 0;
  let edgesTotal = 0;
  let curveMismatches = 0;
  let panelsMissing = 0;
  /** @type {Record<string, Map<number, number>>} */
  const ringToSource = {};

  for (const [name, panel] of Object.entries(pattern.panels)) {
    edgesTotal += panel.edges.length;
    const readPanel = readBack.panels[name];
    if (!readPanel) {
      panelsMissing++;
      continue;
    }
    const m = matchEdges(readPanel.outline, panel, scale);
    edgesMatched += m.matched;
    curveMismatches += m.curveMismatches;
    ringToSource[name] = m.ringToSource;
  }

  // --- stitches ---
  const expected = new Set(
    (pattern.stitches || []).map(s => stitchKey(s.map(x => ({ panel: x.panel, edge: x.edge })))));

  const recovered = new Set();
  let unresolvable = 0;

  for (const [a, b] of readBack.stitches) {
    const resolved = [a, b].map(side => {
      const panel = readBack.panels[side.panel];
      if (!panel) return null;
      const ringIndex = panel.edgesByName.get(side.edge);
      if (ringIndex === undefined) return null;
      const srcIndex = ringToSource[side.panel]?.get(ringIndex);
      if (srcIndex === undefined) return null;
      return { panel: side.panel, edge: srcIndex };
    });
    if (resolved.some(r => r === null)) {
      unresolvable++;
      continue;
    }
    recovered.add(stitchKey(resolved));
  }

  const stitchesRecovered = [...recovered].filter(k => expected.has(k)).length;
  const spurious = [...recovered].filter(k => !expected.has(k)).length;

  // --- semantics ---
  let named = 0;
  let namedTotal = 0;
  for (const panel of Object.values(readBack.panels)) {
    for (const e of outlineEdges(panel.outline)) {
      namedTotal++;
      if (e.name && !/^edge\d+$/.test(e.name)) named++;
    }
  }

  let coherent = 0;
  for (const [a, b] of readBack.stitches) {
    if (seamIsCoherent(a.edge, b.edge)) coherent++;
  }

  return {
    panels: Object.keys(pattern.panels).length,
    panelsMissing,
    edgesTotal,
    edgesMatched,
    curveMismatches,
    stitchesExpected: expected.size,
    stitchesRecovered,
    spurious,
    unresolvable,
    edgesNamed: named,
    edgesNamedTotal: namedTotal,
    seamsCoherent: coherent,
    seamsTotal: readBack.stitches.length,
  };
}

// ---------------------------------------------------------------------------
// Semantic coherence
// ---------------------------------------------------------------------------

// Edge classes whose left/right label says which edge of the panel it is,
// not which side of the body it ends up on.
const SIDE_AGNOSTIC = new Set(['side', 'waist', 'hem', 'inseam', 'outseam']);

// Edge classes that legitimately join each other on a real garment.
const COMPATIBLE = [
  ['cap', 'armhole'],
  ['waist', 'hem'],
  ['upper', 'upper'],
  ['under', 'under'],
];

/**
 * A seam is coherent when the two edge names describe the same join from the
 * two sides — a shoulder meeting a shoulder, a sleeve cap meeting an armhole —
 * and, where both name a side of the body, agree on which side.
 */
export function seamIsCoherent(nameA, nameB) {
  if (/^edge\d+$/.test(nameA) || /^edge\d+$/.test(nameB)) return false;

  const dartA = nameA.match(/^dart(\d+)_[ab]$/);
  const dartB = nameB.match(/^dart(\d+)_[ab]$/);
  if (dartA || dartB) return !!(dartA && dartB && dartA[1] === dartB[1] && nameA !== nameB);

  const a = baseEdgeName(nameA);
  const b = baseEdgeName(nameB);

  // Side seams and edges that run around the body legitimately join either
  // side of the neighbouring piece — a skirt gore's left edge meets the next
  // gore's right — so only features that exist once per side are checked for
  // side agreement.
  if (!SIDE_AGNOSTIC.has(a) || !SIDE_AGNOSTIC.has(b)) {
    const sideA = (nameA.match(/_(l|r)(_|$)/) || [])[1];
    const sideB = (nameB.match(/_(l|r)(_|$)/) || [])[1];
    if (sideA && sideB && sideA !== sideB) return false;
  }

  if (a === b) return true;

  return COMPATIBLE.some(([x, y]) =>
    (a === x && b === y) || (a === y && b === x));
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

async function collectCases() {
  const cases = [];
  const korDir = join(__dirname, 'examples');
  const gcdDir = join(korDir, 'garmentcodedata');

  for (const f of (await readdir(korDir)).filter(f => f.endsWith('.json'))) {
    cases.push({ name: basename(f, '.json'), file: join(korDir, f), convert });
  }
  if (existsSync(gcdDir)) {
    for (const f of (await readdir(gcdDir)).filter(f => f.endsWith('.json'))) {
      cases.push({ name: 'gcd/' + basename(f, '.json'), file: join(gcdDir, f), convert: convertGCD });
    }
  }

  // The full Korosteleva set, if it has been downloaded.
  const templates = join(__dirname, 'templates');
  if (existsSync(templates)) {
    for (const f of (await readdir(templates)).filter(f => f.endsWith('.json'))) {
      cases.push({ name: 'templates/' + basename(f, '.json'), file: join(templates, f), convert });
    }
  }

  return cases;
}

export async function runEvaluation() {
  const cases = await collectCases();
  const results = [];

  for (const c of cases) {
    const json = JSON.parse(await readFile(c.file, 'utf8'));
    const gnl = c.convert(json, c.name.replace(/[^a-zA-Z0-9_]/g, '_'));
    results.push({ name: c.name, ...evaluatePattern(json, gnl) });
  }

  return results;
}

function pct(n, d) {
  if (d === 0) return '  n/a';
  return `${((n / d) * 100).toFixed(0).padStart(4)}%`;
}

async function main() {
  const results = await runEvaluation();

  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(results, null, 2));
    return;
  }

  console.log('\nRound trip — can the GNL document be turned back into the pattern?');
  console.log('Semantics — do the edge names explain the stitching?\n');
  console.log(
    'template'.padEnd(34) +
    ' geometry  stitches |  named  coherent');
  console.log('-'.repeat(72));

  const totals = {
    edgesMatched: 0, edgesTotal: 0,
    stitchesRecovered: 0, stitchesExpected: 0,
    edgesNamed: 0, edgesNamedTotal: 0,
    seamsCoherent: 0, seamsTotal: 0,
    spurious: 0, unresolvable: 0, panelsMissing: 0, curveMismatches: 0,
  };

  for (const r of results) {
    for (const k of Object.keys(totals)) totals[k] += r[k];
    console.log(
      r.name.slice(0, 33).padEnd(34) +
      pct(r.edgesMatched, r.edgesTotal) + '     ' +
      pct(r.stitchesRecovered, r.stitchesExpected) + ' |  ' +
      pct(r.edgesNamed, r.edgesNamedTotal) + '     ' +
      pct(r.seamsCoherent, r.seamsTotal));
  }

  console.log('-'.repeat(72));
  console.log(
    `all ${results.length} templates`.padEnd(34) +
    pct(totals.edgesMatched, totals.edgesTotal) + '     ' +
    pct(totals.stitchesRecovered, totals.stitchesExpected) + ' |  ' +
    pct(totals.edgesNamed, totals.edgesNamedTotal) + '     ' +
    pct(totals.seamsCoherent, totals.seamsTotal));

  console.log('');
  console.log(`  geometry: ${totals.edgesMatched}/${totals.edgesTotal} source edges recovered from the GNL outlines`);
  if (totals.panelsMissing) console.log(`            ${totals.panelsMissing} panels emitted without geometry`);
  if (totals.curveMismatches) console.log(`            ${totals.curveMismatches} edges disagree about being curved`);
  console.log(`  stitches: ${totals.stitchesRecovered}/${totals.stitchesExpected} recovered, ${totals.spurious} spurious, ${totals.unresolvable} unresolvable edge references`);
  console.log(`  names:    ${totals.edgesNamed}/${totals.edgesNamedTotal} edges carry a semantic name`);
  console.log(`            ${totals.seamsCoherent}/${totals.seamsTotal} seams join edges that agree about what they are`);
  console.log('');

  const roundTripClean =
    totals.edgesMatched === totals.edgesTotal &&
    totals.stitchesRecovered === totals.stitchesExpected &&
    totals.spurious === 0;

  if (!roundTripClean) {
    console.log('  Round trip is lossy — the notation is not carrying everything the');
    console.log('  source pattern holds. That is a language gap, not a heuristics gap.\n');
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
