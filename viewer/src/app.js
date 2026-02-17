import { tokenize } from './tokenizer.js';
import { parse } from './parser.js';
import { render } from './renderer.js';

const editor = document.getElementById('editor');
const viewer = document.getElementById('viewer');
const status = document.getElementById('status');

const DEFAULT_SOURCE = `GARMENT t_shirt [SYM] {

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

editor.value = DEFAULT_SOURCE;

let debounceTimer;
editor.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(update, 250);
});

function update() {
  const source = editor.value;
  if (!source.trim()) {
    viewer.innerHTML = render({ blocks: [] });
    status.textContent = 'Empty';
    status.className = 'status';
    return;
  }

  try {
    const tokens = tokenize(source);
    const ast = parse(tokens);
    const svg = render(ast);
    viewer.innerHTML = svg;

    const block = ast.blocks[0];
    const panels = block?.declarations.filter(d => d.value.type === 'call' && d.value.name === 'P').length ?? 0;
    const steps = block?.build.length ?? 0;
    status.textContent = `Parsed: ${panels} panel${panels !== 1 ? 's' : ''}, ${steps} build step${steps !== 1 ? 's' : ''}`;
    status.className = 'status ok';
  } catch (err) {
    status.textContent = err.message;
    status.className = 'status error';
  }
}

// Initial render
update();

// Examples dropdown
const examples = document.getElementById('examples');
if (examples) {
  examples.addEventListener('change', () => {
    const val = examples.value;
    if (val && EXAMPLES[val]) {
      editor.value = EXAMPLES[val];
      update();
    }
    examples.value = '';
  });
}

const EXAMPLES = {
  tshirt: DEFAULT_SOURCE,
  wrap_skirt: `GARMENT wrap_skirt {

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
}`,
  jacket_collar: `COMPONENT notched_lapel {

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
}`,
};
