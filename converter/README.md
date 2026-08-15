# Pattern Dataset → GNL Converters

Two converters turn published sewing-pattern datasets into [GNL](../garment-notation.md):

| Dataset | Converter | Input |
|---|---|---|
| [Korosteleva NeurIPS 2021](https://github.com/maria-korosteleva/Garment-Pattern-Generator) | `convert.js` | 2D panel geometry as JSON, 21 templates |
| [GarmentCodeData (ECCV 2024)](https://github.com/maria-korosteleva/GarmentCode) | `convert-gcd.js` | same shape, plus edge labels, panel order, darts, `right_wrong` annotations |

## Usage

```sh
# Korosteleva — auto-downloads 21 templates from GitHub on first run
node converter/convert.js
node converter/convert.js path/to/template.json    # single file

# GarmentCodeData — converts the bundled examples
node converter/convert-gcd.js
node converter/convert-gcd.js path/to/pattern.json

# Measure what the conversion carries
node converter/evaluate.js
node converter/evaluate.js --json
```

Output goes to `converter/output/` and `converter/output-gcd/`. Requires Node.js 18+.

## What gets converted

Panel geometry is carried over literally, as a GNL `poly` outline: the vertex
ring in centimetres, per-edge curvature (quadratic, cubic, and circular arcs
all survive), and a name for each edge. Stitches become `S(...)` seams
referring to those edge names. Openings are the edges nothing is stitched to,
with their circumference measured from the outline.

Everything else is inference, and the converted file says so in a header
comment. That header exists because converted GNL is indistinguishable from
hand-written GNL once it is in the viewer, and the difference matters.

### Edge naming

The interesting part, and the part most likely to be wrong. Edges are named
from geometry alone — the stitch graph is deliberately not consulted, so that
`evaluate.js` can measure how much of the stitching the names actually explain.

Two conventions make this work across pieces:

- **y is up.** In both datasets a torso panel's hem sits at the *lowest* y and
  its shoulders at the highest.
- **Anatomical x.** Panels are placed in 3D by a rotation and a translation, and
  a back panel is usually drafted mirrored. Edges are classified after undoing
  that mirror and shifting the panel so x = 0 is the body midline, so "left"
  means the wearer's left on every piece regardless of how it was drafted. This
  is what makes `S(front.shoulder_l, back.shoulder_l, plain)` come out right
  rather than crossing sides.

From there, naming is per panel kind — torso, sleeve, leg, skirt, waistband —
chosen from the body region the panel maps to rather than its name, since a
jumpsuit's `Rfront` is a leg, not a bodice. Sleeves are named along the arm
axis (`cap`, `cuff`, `upper`, `under`) because a short set-in sleeve is drafted
lying on its side and its panel-local x/y say nothing useful. Darts are found
geometrically — a narrow V of two near-equal edges — and both legs are named as
one dart, so the seam that closes it reads as a dart.

An edge the classifier cannot place keeps a positional name (`edge7`) rather
than borrowing a semantic one it has not earned.

### Panel name → body region

Panel names like `front`, `Lback`, `lfsleeve`, `right_0` map to GNL body
regions (`%torso.front`, `%leg.L`, `%arm.L`, `%torso.R + %leg.R[0..0.3]`)
through a lookup table in `region-map.js` and `garmentcodedata-region-map.js`.

## What it doesn't do

- **Parametric variations** — only base templates at default parameter values;
  the `parameters` and `constraints` sections are skipped.
- **Seam types** — the datasets record that two edges are joined, not how, so
  every seam is emitted as `plain`.
- **Construction order** — `BUILD` lists the stitches in dataset order. That is
  not a sewing sequence, and the converted file says so.
- **Fabric and grain** — not present in the geometric data.
- **Darts as `D(...)`** — dart legs are found and named, but emitted as a seam
  joining them rather than as GNL's dart operator.
- **`right_wrong` annotations** — GarmentCodeData records which face of the
  fabric a seam joins; GNL has no parameter for it, so it survives only as a
  header note.

## Verification

`evaluate.js` converts each template, reparses the GNL with the real parser,
and rebuilds the pattern from the document alone — no peeking at the source
JSON. It reports two things that are easy to conflate:

**Round trip.** Every source edge has to be recoverable from the GNL outlines
by matching endpoints, and every stitch recoverable from `BUILD` by resolving
edge names back to those edges. This is a property of the *language*: if it
fails, GNL cannot hold what the dataset holds. `npm test` asserts it.

**Semantics.** Whether the inferred names explain the stitching — a seam
joining `shoulder_l` to `shoulder_l`, or a cap to an armhole, is explained; one
joining `hem` to `edge7` is not. This is a property of the *heuristics*, and it
is reported rather than asserted, because naming every edge `edge0..edgeN`
would score 100% on the round trip and 0% here.

Current results across 30 templates:

```
geometry: 1060/1060 source edges recovered from the GNL outlines
stitches: 398/398 recovered, 0 spurious, 0 unresolvable edge references
names:    1036/1060 edges carry a semantic name
          353/398 seams join edges that agree about what they are
```

The seams that do not agree are mostly hoods and multi-panel bodices, where the
edge being stitched has no name in GNL's vocabulary to be given.

## Files

```
converter/
  convert.js                    # Korosteleva CLI
  convert-gcd.js                # GarmentCodeData CLI
  evaluate.js                   # round-trip and semantic measurement
  korosteleva-to-gnl.js         # Korosteleva conversion + GNL document layout
  garmentcodedata-to-gnl.js     # GarmentCodeData conversion
  shared.js                     # orientation, outline emission, openings, provenance
  edge-namer.js                 # geometric edge classification
  region-map.js                 # Korosteleva panel name → body region
  garmentcodedata-region-map.js # GarmentCodeData panel name → body region
  examples/                     # bundled sample patterns from both datasets
  templates/                    # cached Korosteleva JSON (auto-downloaded, gitignored)
  output/, output-gcd/          # generated .gnl files
```

## Browser integration

The converter modules are pure ES modules with no Node.js dependencies, so they
run in both Node and the browser. The [viewer](../viewer/index.html) converts
client-side: pick a template from the examples dropdown and use the GNL/JSON
toggle to compare the raw geometric input with the converted output.
