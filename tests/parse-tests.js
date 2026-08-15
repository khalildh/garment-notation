import { parse } from '../viewer/src/gnl-parser.js';
import { pegAstToLegacy } from '../viewer/src/peg-adapter.js';

// ============================================================================
// Test GNL programs extracted from gnl_tests.peg and viewer/src/app.js
// ============================================================================

const TESTS = {};

// ---------------------------------------------------------------------------
// From gnl_tests.peg
// ---------------------------------------------------------------------------

TESTS["test1_tank_top"] = `GARMENT tank_top [SYM] {

  FABRIC: M(120gsm, fluid, biaxial:15%, 0.9, knit.jersey)

  front = P(%torso.front, contour, 1.1)
  back  = P(%torso.back, contour, 1.1)

  neck = O(@neck, circle, body+2cm)
  hem  = O(@hip, circle, body+6cm)

  BUILD:
    S(front.shoulder, back.shoulder, serged)
    >> S(front.side, back.side, serged)
    >> F(neck, 1cm, in)
    >> F(hem, 2cm, in)
}`;

TESTS["test2_flared_skirt"] = `GARMENT flared_skirt {

  FABRIC: M(180gsm, fluid, none, 1.0, woven.plain)

  front = P(%torso.front + %leg.L[0..0.3], trapezoid(waist=0.5W, hem=1.5W), ease(1.0, 2.0))
  back  = P(%torso.back + %leg.R[0..0.3], trapezoid(waist=0.5W, hem=1.5W), ease(1.0, 2.0))

  waist = O(@waist, circle, body+2cm)

  BUILD:
    S(front.side.L, back.side.L, french)
    >> S(front.side.R, back.side.R, french)
    >> G(front.top, 1.1)
    >> C(waist, zip(invisible), center)
    >> F(front.bottom, 1.5cm, in)
}`;

TESTS["test3_draped_camisole"] = `GARMENT draped_camisole [SYM] {

  FABRIC: M(90gsm, liquid, none, 0.7, woven.satin)

  front = P(%torso.front, contour, 1.3, bias)
  back  = P(%torso.back, contour, 1.1)

  neck = O(@neck, V, depth=12cm)

  BUILD:
    DR(front, [@shoulder.L, @shoulder.R])
    >> S(front.side, back.side, french)
    >> F(neck, 0.5cm, in)
}`;

TESTS["test4_component_blouse"] = `COMPONENT set_in_sleeve {
  cap   = P(%arm[0..0.6], contour, 1.15)
  under = P(%arm[0..0.6], contour, 1.05)
  cuff  = O(@elbow, circle, body+3cm)

  BUILD:
    S(cap.back, under.back, serged)
    >> S(cap.front, under.front, serged)
    >> F(cuff, 2cm, in)
}

GARMENT blouse [SYM] {

  FABRIC: M(110gsm, fluid, none, 0.8, woven.plain)

  front = P(%torso.front, contour, 1.15)
  back  = P(%torso.back, contour, 1.12)

  sleeve = USE(set_in_sleeve)

  neck = O(@neck, circle, body+4cm)
  front_opening = O(%torso.front, slit, @neck..@hip)

  BUILD:
    S(front.shoulder, back.shoulder, french)
    >> ATTACH(sleeve, {front.armhole, back.armhole})
       [G(sleeve.cap.cap_edge, 1.12)]
    >> S(front.side, back.side, french)
    >> C(front_opening, button(7), center)
    >> F(neck, 1cm, in)
}`;

TESTS["test5_princess_bodice"] = `GARMENT princess_bodice [SYM] {

  FABRIC: M(220gsm, crisp, none, 1.0, woven.plain)

  front_center = P(%torso.front.L[0..0.5], contour, 1.0)
  front_side   = P(%torso.front.L[0.5..1], contour, 1.0)
  back         = P(%torso.back, contour, 1.05)

  EDGE(front_center.side, curve(@bust.L, -3cm))
  EDGE(front_side.center, curve(@bust.L, 3cm))

  neck = O(@neck, circle, body+1cm)

  BUILD:
    S(front_center.side, front_side.center, plain)
    >> S(front_side.side, back.side, plain)
    >> D(back, @shoulder.R, 6°, 10cm)
    >> F(neck, 1cm, in)
}`;

TESTS["test6_lined_jacket"] = `GARMENT lined_jacket [SYM] {

  FABRIC: M(280gsm, crisp, none, 1.0, woven.twill)

  front = P(%torso.front + %leg[0..0.1], contour, 1.1)
  back  = P(%torso.back + %leg[0..0.1], contour, 1.08)

  sleeve = USE(set_in_sleeve)

  LAYER lining {
    FABRIC: M(80gsm, liquid, none, 0.9, woven.satin)

    front = P(%torso.front + %leg[0..0.08], contour, 1.12)
    back  = P(%torso.back + %leg[0..0.08], contour, 1.1)

    SHARE: front.facing, hem, armhole
    FREE: body, side

    BUILD:
      S(front.shoulder, back.shoulder, plain)
      >> S(front.side, back.side, plain)
  }

  BUILD:
    S(front.shoulder, back.shoulder, plain)
    >> S(front.side, back.side, plain)
    >> ATTACH(sleeve, {front.armhole, back.armhole})
       [G(sleeve.cap.cap_edge, 1.12)]
    >> C(front_opening, button(2), center)
    >> ATTACH_LAYER(lining)
}`;

// ---------------------------------------------------------------------------
// From viewer/src/app.js — DEFAULT_SOURCE + EXAMPLES
// ---------------------------------------------------------------------------

TESTS["viewer_tshirt"] = `GARMENT t_shirt [SYM] {

  FABRIC: M(160gsm, fluid, biaxial:15%, 1.0, knit.jersey)

  -- Define panels
  front  = P(%torso.front, contour, 1.15)
  back   = P(%torso.back, contour, 1.15)
  sleeve = P(%arm[0..0.4], contour, 1.2)

  -- Define openings
  neck   = O(@neck, circle, body+8cm)
  hem    = O(@hip, circle, body+10cm)
  cuff   = O(@elbow, circle, body+4cm)

  -- Build order
  BUILD:
    S(front.shoulder, back.shoulder, serged)
    >> S(sleeve.cap, {front.armhole, back.armhole}, serged)
       [G(sleeve.cap, 1.08)]
    >> S(front.side, back.side, serged)
    >> S(sleeve.under, sleeve.under, serged)
    >> F(neck, 1.5cm, in)
    >> F(hem, 2.5cm, in)
    >> F(cuff, 2cm, in)
}`;

TESTS["viewer_button_shirt"] = `GARMENT button_shirt [SYM] {

  FABRIC: M(120gsm, crisp, none, 1.0, woven.poplin)

  -- Body panels
  front = P(%torso.front + %leg[0..0.05], contour, 1.15)
  back  = P(%torso.back + %leg[0..0.05], contour, 1.12)
  yoke  = P(%torso.back[0..0.15], rect, 1.0)

  -- Sleeve with placket
  sleeve = P(%arm[0..0.65], contour, 1.2)
  cuff   = P(%wrist, rect, 1.0)

  -- Collar
  collar_stand = P(%neck, rect, 1.0)
  collar_fall  = P(%neck, contour, 1.05)

  -- Openings
  front_opening = O(%torso.front, slit, @neck)
  neck_opening  = O(@neck, circle, body+2cm)
  hem           = O(@hip, circle, body+12cm)
  sleeve_vent   = O(%arm[0.55..0.65], slit)

  -- Placket (button stand)
  placket = P(%torso.front[0..1], rect, 1.0)

  BUILD:
    -- Back yoke
    D(back, @shoulder.L, 4, 8cm)
    >> S(yoke.bottom, back.top, plain)

    -- Shoulders and sides
    >> S(front.shoulder, yoke.shoulder, plain)
    >> S(front.side, back.side, plain)

    -- Sleeve
    >> S(sleeve.cap, {front.armhole, back.armhole}, plain)
       [G(sleeve.cap, 1.1)]
    >> S(sleeve.under, sleeve.under, plain)

    -- Cuff
    >> F(sleeve_vent, 2cm, in)
    >> G(sleeve.cuff_edge, 1.5)
    >> S(cuff.top, sleeve.cuff_edge, plain)
    >> C(cuff, button(1), inner)

    -- Collar
    >> S(collar_stand.top, collar_fall.bottom, plain)
    >> S(collar_stand.bottom, neck_opening, plain)

    -- Button placket (7 buttons, center front)
    >> S(placket.inner, front_opening, plain)
    >> C(front_opening, button(7), center)

    -- Hem
    >> F(hem, 2cm, in)
}`;

TESTS["viewer_wrap_skirt"] = `GARMENT wrap_skirt {

  FABRIC: M(200gsm, crisp, none, 1.0, woven.plain)

  front_L = P(%torso.front.L + %leg.L[0..0.2], trapezoid, 1.1)
  front_R = P(%torso.front.R + %leg.R[0..0.2], trapezoid, 1.1)
  back    = P(%torso.back + %leg[0..0.2], trapezoid, 1.1)

  waist     = O(@waist, circle, body+2cm)
  hem_line  = O(@knee, open)

  waistband = P(%waist, rect, 1.0)

  BUILD:
    S(front_L.side, back.side.L, plain)
    >> S(front_R.side, back.side.R, plain)
    >> F(waistband, 2cm, in)
    >> S(waistband.inner, {back.top, front_L.top, front_R.top}, plain)
       [G({front_L.top, front_R.top}, 1.0)]
    >> C(waist, tie, L_wrap_over_R)
    >> F(hem_line, 1cm, in)
}`;

TESTS["viewer_jacket_collar"] = `COMPONENT notched_lapel {

  FABRIC: M(280gsm, crisp, none, 1.0, woven.twill)
  INTERLINING: M(80gsm, stiff, none, 1.0, nonwoven)

  collar_stand = P(%neck, rect, 1.0)
  collar_fall  = P(%neck, contour, 1.0)
  lapel        = P(%torso.front[0..0.15], contour, 1.0)

  BUILD:
    FUSE(collar_stand, INTERLINING)
    >> FUSE(collar_fall, INTERLINING)
    >> FUSE(lapel, INTERLINING)
    >> S(collar_stand.top, collar_fall.bottom, plain)
    >> F(collar_fall, gorge_line, out)
    >> S(collar_stand.ends, lapel.notch, plain)
    >> F(lapel, break_point, out)
}`;

TESTS["viewer_blazer"] = `GARMENT blazer [SYM] {

  FABRIC: M(280gsm, crisp, none, 1.0, woven.twill)
  INTERLINING: M(80gsm, stiff, none, 1.0, nonwoven)

  -- Body panels
  front        = P(%torso.front + %leg[0..0.1], contour, 1.1)
  back         = P(%torso.back + %leg[0..0.1], contour, 1.08)
  side         = P(%torso.R[0..1], contour, 1.05)

  -- Two-piece sleeve
  sleeve_top   = P(%arm[0..0.7], contour, 1.1)
  sleeve_under = P(%arm[0..0.7], contour, 1.05)

  -- Collar (notched lapel)
  collar_stand = P(%neck, rect, 1.0)
  collar_fall  = P(%neck, contour, 1.0)
  lapel        = P(%torso.front[0..0.15], contour, 1.0)

  -- Welt pocket
  welt         = P(%torso.front[0.5..0.55], rect, 1.0)

  -- Lining
  lining_front  = P(%torso.front + %leg[0..0.08], contour, 1.12)
  lining_back   = P(%torso.back + %leg[0..0.08], contour, 1.1)
  lining_sleeve = P(%arm[0..0.65], contour, 1.12)

  -- Openings
  front_opening = O(%torso.front, slit, @neck)
  neck_opening  = O(@neck, circle, body+2cm)

  BUILD:
    -- Fuse interlinings
    FUSE(front, INTERLINING)
    >> FUSE(collar_stand, INTERLINING)
    >> FUSE(collar_fall, INTERLINING)
    >> FUSE(lapel, INTERLINING)

    -- Darts
    >> D(front, @bust.L, 10, 8cm)
    >> D(back, @shoulder.L, 6, 10cm)

    -- Body assembly
    >> S(front.shoulder, back.shoulder, plain)
    >> S(front.side, side.front, plain)
    >> S(back.side, side.back, plain)

    -- Two-piece sleeve
    >> S(sleeve_top.back, sleeve_under.back, plain)
    >> S(sleeve_top.front, sleeve_under.front, plain)
    >> S(sleeve_top.cap, {front.armhole, back.armhole}, plain)
       [G(sleeve_top.cap, 1.12)]

    -- Collar
    >> S(collar_stand.top, collar_fall.bottom, plain)
    >> S(collar_stand.ends, lapel.notch, plain)
    >> S(collar_stand.bottom, neck_opening, plain)
    >> F(collar_fall, gorge_line, out)
    >> F(lapel, break_point, out)

    -- Welt pocket
    >> S(welt.top, front.pocket_mark, plain)
    >> F(welt, 1cm, in)

    -- Lining assembly
    >> S(lining_front.shoulder, lining_back.shoulder, plain)
    >> S(lining_front.side, lining_back.side, plain)
    >> S(lining_sleeve.cap, {lining_front.armhole, lining_back.armhole}, plain)
    >> S(lining_front.facing, front.facing, plain)

    -- Finish
    >> C(front_opening, button(2), center)
    >> F(front.bottom, 3cm, in)
}`;

TESTS["viewer_composed_blazer"] = `-- Reusable components

COMPONENT two_piece_sleeve {
  FABRIC: M(280gsm, crisp, none, 1.0, woven.twill)

  top   = P(%arm[0..0.7], contour, 1.1)
  under = P(%arm[0..0.7], contour, 1.05)
  cuff  = O(@wrist, circle, body+4cm)

  BUILD:
    S(top.back, under.back, plain)
    >> S(top.front, under.front, plain)
    >> F(cuff, 3cm, in)
}

COMPONENT notched_lapel {
  FABRIC: M(280gsm, crisp, none, 1.0, woven.twill)
  INTERLINING: M(80gsm, stiff, none, 1.0, nonwoven)

  collar_stand = P(%neck, rect, 1.0)
  collar_fall  = P(%neck, contour, 1.0)
  lapel        = P(%torso.front[0..0.15], contour, 1.0)

  BUILD:
    FUSE(collar_stand, INTERLINING)
    >> FUSE(collar_fall, INTERLINING)
    >> FUSE(lapel, INTERLINING)
    >> S(collar_stand.top, collar_fall.bottom, plain)
    >> F(collar_fall, gorge_line, out)
    >> S(collar_stand.ends, lapel.notch, plain)
    >> F(lapel, break_point, out)
}

COMPONENT welt_pocket {
  welt = P(%torso.front[0.5..0.55], rect, 1.0)
  bag  = P(%torso.front[0.5..0.7], rect, 1.0)

  BUILD:
    S(welt.top, bag.top, plain)
    >> F(welt, 1cm, in)
}

-- Compose into a full garment

GARMENT blazer [SYM] {
  FABRIC: M(280gsm, crisp, none, 1.0, woven.twill)
  INTERLINING: M(80gsm, stiff, none, 1.0, nonwoven)

  -- Body panels
  front = P(%torso.front + %leg[0..0.1], contour, 1.1)
  back  = P(%torso.back + %leg[0..0.1], contour, 1.08)
  side  = P(%torso.R[0..1], contour, 1.05)

  -- Openings
  front_opening = O(%torso.front, slit, @neck)
  neck_opening  = O(@neck, circle, body+2cm)

  -- Attach components
  sleeve   = USE(two_piece_sleeve)
  collar   = USE(notched_lapel)
  pocket_L = USE(welt_pocket)

  BUILD:
    FUSE(front, INTERLINING)
    >> D(front, @bust.L, 10, 8cm)
    >> D(back, @shoulder.L, 6, 10cm)
    >> S(front.shoulder, back.shoulder, plain)
    >> S(front.side, side.front, plain)
    >> S(back.side, side.back, plain)
    >> ATTACH(sleeve, {front.armhole, back.armhole})
       [G(sleeve.top.cap, 1.12)]
    >> ATTACH(collar, neck_opening)
    >> ATTACH(pocket_L, front.pocket_mark.L)
    >> C(front_opening, button(2), center)
    >> F(front.bottom, 3cm, in)
}`;

TESTS["viewer_fitted_dress"] = `GARMENT fitted_dress [SYM] {

  FABRIC: M(200gsm, crisp, none, 1.0, woven.plain)

  -- Princess seam panels (split front and back at bust/shoulder)
  front_center = P(%torso.front.L[0..0.5] + %leg.L[0..0.3], contour, 1.0)
  front_side   = P(%torso.front.L[0.5..1] + %leg.L[0..0.3], contour, 1.0)
  back_center  = P(%torso.back.L[0..0.5] + %leg.L[0..0.3], contour, 1.0)
  back_side    = P(%torso.back.L[0.5..1] + %leg.L[0..0.3], contour, 1.0)

  -- Shape the princess seam edges
  EDGE(front_center.side, curve(@bust.L, -3cm))
  EDGE(front_side.center, curve(@bust.L, 3cm))
  EDGE(back_center.side, curve(@shoulder.L, -2cm))
  EDGE(back_side.center, curve(@shoulder.L, 2cm))

  -- Openings
  neck   = O(@neck, circle, body+2cm)
  hem    = O(@knee, circle, body+4cm)
  zipper = O(%torso.back, slit, @neck)

  -- Lining
  LAYER lining {
    FABRIC: M(80gsm, liquid, none, 0.9, woven.satin)

    front = P(%torso.front + %leg[0..0.1], contour, 1.1)
    back  = P(%torso.back + %leg[0..0.1], contour, 1.1)

    SHARE: [front.armhole, back.armhole, front.neck, back.neck]
    FREE: [front.side, back.side, front.bottom, back.bottom]

    BUILD:
      S(front.shoulder, back.shoulder, plain)
      >> S(front.side, back.side, plain)
  }

  BUILD:
    S(front_center.side, front_side.center, plain)
    >> S(back_center.side, back_side.center, plain)
    >> S(front_center.shoulder, back_center.shoulder, plain)
    >> S(front_side.shoulder, back_side.shoulder, plain)
    >> S(front_side.side, back_side.side, plain)
    >> F(neck, 1cm, in)
    >> F(hem, 3cm, in)
    >> C(zipper, zip(invisible), center_back)
    >> ATTACH_LAYER(lining)
}`;
// NOTE: The viewer's fitted_dress example uses `C(zipper, invisible, center_back)`,
// but the spec requires `zip(invisible)`. The adapter/integration step will fix the
// viewer example. This test uses the spec-correct form.

TESTS["poly_outline"] = `-- Literal panel geometry: every curve form, named edges,
-- and an opening whose circumference is measured rather than body-relative.
GARMENT measured_bodice {

  FABRIC: M(200gsm, crisp, none, 1.0, woven.plain)

  front = P(%torso.front, poly[
    (0, 21.11) : neckline_r,
    (-25, 56.11) : shoulder_r,
    (-55, 56.11) ~ (0.7, 0.4) : armhole_r,
    (-65, 6.11) : side_r,
    (-65, -128.89) ~ arc(10.88, 0, 1) : hem,
    (65, -128.89) : side_l,
    (65, 6.11) ~ (0.2, 0.35; 0.5, 0.2) : armhole_l,
    (55, 56.11) : shoulder_l,
    (25, 56.11) : neckline_l
  ], 1.0)

  back = P(%torso.back, poly[
    (-25, 58.75) ~ (0.5, -0.3) : neckline,
    (25, 58.75) : shoulder_l,
    (65, 8.75) : side_l,
    (65, -126.25) : hem,
    (-65, -126.25) : side_r,
    (-65, 8.75) : shoulder_r
  ], 1.0)

  neck = O(@neck, circle, 45.3cm)

  BUILD:
    S(front.shoulder_l, back.shoulder_l, plain)
    >> S(front.shoulder_r, back.shoulder_r, plain)
    >> S(front.side_l, back.side_l, plain)
    >> S(front.side_r, back.side_r, plain)
    >> F(front.hem, 2.5cm, in)
}`;

// ============================================================================
// Runner
// ============================================================================

let passed = 0;
let failed = 0;
const failures = [];

for (const [name, source] of Object.entries(TESTS)) {
  try {
    parse(source);
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name}`);
    // Show the relevant portion of the error
    const loc = err.location;
    if (loc) {
      const lines = source.split('\n');
      const line = lines[loc.start.line - 1] || '';
      console.log(`        Line ${loc.start.line}, Col ${loc.start.column}: ${err.message.split('\n')[0]}`);
      console.log(`        > ${line}`);
      console.log(`        ${' '.repeat(loc.start.column + 1)}^`);
    } else {
      console.log(`        ${err.message.split('\n')[0]}`);
    }
    failures.push(name);
    failed++;
  }
}

console.log(`\n${passed} passed, ${failed} failed out of ${passed + failed} tests`);
if (failures.length) {
  console.log(`Failed: ${failures.join(', ')}`);
  process.exit(1);
}

// ============================================================================
// Adapter tests: PEG parse → adapter → legacy AST shape
// ============================================================================

console.log('\n--- Adapter Tests ---\n');

let adapterPassed = 0;
let adapterFailed = 0;
const adapterFailures = [];

for (const [name, source] of Object.entries(TESTS)) {
  try {
    const pegAst = parse(source);
    const legacy = pegAstToLegacy(pegAst);

    // Verify basic structure
    if (legacy.type !== 'program') throw new Error(`Expected program, got ${legacy.type}`);
    if (!Array.isArray(legacy.blocks)) throw new Error('blocks is not an array');
    for (const block of legacy.blocks) {
      if (!['garment', 'component'].includes(block.type)) throw new Error(`Bad block type: ${block.type}`);
      if (!Array.isArray(block.declarations)) throw new Error('declarations not an array');
      if (!Array.isArray(block.build)) throw new Error('build not an array');
      if (!Array.isArray(block.edges)) throw new Error('edges not an array');
      if (!Array.isArray(block.layers)) throw new Error('layers not an array');

      // Verify panels are call P
      for (const d of block.declarations) {
        if (d.type !== 'declaration') throw new Error(`Bad decl type: ${d.type}`);
        if (d.value.type === 'call' && d.value.name === 'P') {
          if (!d.value.args || d.value.args.length < 3) throw new Error(`Panel ${d.name} missing args`);
        }
      }

      // Verify build steps
      for (const s of block.build) {
        if (s.type !== 'build_step') throw new Error(`Bad build step type: ${s.type}`);
        if (!s.operation) throw new Error('Build step missing operation');
      }
    }

    console.log(`  PASS  ${name}`);
    adapterPassed++;
  } catch (err) {
    console.log(`  FAIL  ${name}: ${err.message}`);
    adapterFailures.push(name);
    adapterFailed++;
  }
}

console.log(`\n${adapterPassed} passed, ${adapterFailed} failed out of ${adapterPassed + adapterFailed} adapter tests`);
if (adapterFailures.length) {
  console.log(`Failed: ${adapterFailures.join(', ')}`);
  process.exit(1);
}

// ============================================================================
// GarmentCodeData converter tests
// Convert existing Korosteleva examples through the GCD converter (compatible
// format) and verify the output parses as valid GNL.
// ============================================================================

import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { convert } from '../converter/korosteleva-to-gnl.js';
import { convertGCD } from '../converter/garmentcodedata-to-gnl.js';

const __dirname = dirname(new URL(import.meta.url).pathname);
const examplesDir = join(__dirname, '..', 'converter', 'examples');

console.log('\n--- Converter Tests (Korosteleva → GNL) ---\n');

let convPassed = 0;
let convFailed = 0;
const convFailures = [];

// Test that existing Korosteleva examples convert and parse
const exampleFiles = existsSync(examplesDir)
  ? (await readdir(examplesDir)).filter(f => f.endsWith('.json'))
  : [];

for (const file of exampleFiles) {
  const name = `korosteleva_${basename(file, '.json')}`;
  try {
    const raw = await readFile(join(examplesDir, file), 'utf-8');
    const json = JSON.parse(raw);
    const gnl = convert(json, basename(file, '.json'));
    parse(gnl); // verify it parses
    console.log(`  PASS  ${name}`);
    convPassed++;
  } catch (err) {
    console.log(`  FAIL  ${name}: ${err.message}`);
    convFailures.push(name);
    convFailed++;
  }
}

console.log(`\n${convPassed} passed, ${convFailed} failed out of ${convPassed + convFailed} Korosteleva converter tests`);

console.log('\n--- Converter Tests (GarmentCodeData → GNL) ---\n');

let gcdPassed = 0;
let gcdFailed = 0;
const gcdFailures = [];

// Test GCD converter against the same Korosteleva examples (compatible format)
for (const file of exampleFiles) {
  const name = `gcd_${basename(file, '.json')}`;
  try {
    const raw = await readFile(join(examplesDir, file), 'utf-8');
    const json = JSON.parse(raw);
    const gnl = convertGCD(json, basename(file, '.json'));
    parse(gnl); // verify it parses
    console.log(`  PASS  ${name}`);
    gcdPassed++;
  } catch (err) {
    console.log(`  FAIL  ${name}: ${err.message}`);
    gcdFailures.push(name);
    gcdFailed++;
  }
}

// Also test GarmentCodeData-specific examples if they exist
const gcdExamplesDir = join(__dirname, '..', 'converter', 'examples', 'garmentcodedata');
if (existsSync(gcdExamplesDir)) {
  const gcdFiles = (await readdir(gcdExamplesDir)).filter(f => f.endsWith('.json'));
  for (const file of gcdFiles) {
    const name = `gcd_native_${basename(file, '.json')}`;
    try {
      const raw = await readFile(join(gcdExamplesDir, file), 'utf-8');
      const json = JSON.parse(raw);
      const gnl = convertGCD(json, basename(file, '.json'));
      parse(gnl);
      console.log(`  PASS  ${name}`);
      gcdPassed++;
    } catch (err) {
      console.log(`  FAIL  ${name}: ${err.message}`);
      gcdFailures.push(name);
      gcdFailed++;
    }
  }
}

console.log(`\n${gcdPassed} passed, ${gcdFailed} failed out of ${gcdPassed + gcdFailed} GarmentCodeData converter tests`);

// ============================================================================
// Round-trip tests
//
// Parsing is a low bar: nonsense parses. These check that a converted document
// still contains the pattern — every source edge recoverable from the outlines,
// every stitch recoverable from BUILD, and nothing invented along the way.
// ============================================================================

console.log('\n--- Round-trip Tests (pattern → GNL → pattern) ---\n');

const { runEvaluation } = await import('../converter/evaluate.js');
const roundTrip = await runEvaluation();
const rtFailures = [];

for (const r of roundTrip) {
  const problems = [];
  if (r.edgesMatched !== r.edgesTotal) {
    problems.push(`${r.edgesTotal - r.edgesMatched}/${r.edgesTotal} edges lost`);
  }
  if (r.stitchesRecovered !== r.stitchesExpected) {
    problems.push(`${r.stitchesExpected - r.stitchesRecovered}/${r.stitchesExpected} stitches lost`);
  }
  if (r.spurious) problems.push(`${r.spurious} spurious stitches`);
  if (r.unresolvable) problems.push(`${r.unresolvable} unresolvable edge refs`);
  if (r.curveMismatches) problems.push(`${r.curveMismatches} curve mismatches`);

  if (problems.length) {
    console.log(`  FAIL  ${r.name}: ${problems.join(', ')}`);
    rtFailures.push(r.name);
  } else {
    console.log(`  PASS  ${r.name}`);
  }
}

const rtTotals = roundTrip.reduce((acc, r) => ({
  edges: acc.edges + r.edgesTotal,
  stitches: acc.stitches + r.stitchesExpected,
  coherent: acc.coherent + r.seamsCoherent,
  seams: acc.seams + r.seamsTotal,
}), { edges: 0, stitches: 0, coherent: 0, seams: 0 });

console.log(`\n${roundTrip.length - rtFailures.length} passed, ${rtFailures.length} failed out of ${roundTrip.length} round-trip tests`);
console.log(`${rtTotals.edges} edges and ${rtTotals.stitches} stitches round-tripped`);
console.log(`${((rtTotals.coherent / rtTotals.seams) * 100).toFixed(0)}% of seams join edges that agree about what they are ` +
            `(reported, not asserted — see converter/evaluate.js)`);

if (convFailures.length || gcdFailures.length || rtFailures.length) {
  const all = [...convFailures, ...gcdFailures, ...rtFailures];
  console.log(`Failed: ${all.join(', ')}`);
  process.exit(1);
}
