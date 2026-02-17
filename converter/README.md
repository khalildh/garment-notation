# Korosteleva Dataset → GNL Converter

Converts garment templates from the [Korosteleva NeurIPS 2021 dataset](https://github.com/maria-korosteleva/Garment-Pattern-Generator) (2D panel geometry as JSON) into [GNL](../garment-notation.md) (semantic garment notation).

## Usage

```sh
# Auto-downloads 21 templates from GitHub on first run, converts all
node converter/convert.js

# Convert a single JSON file
node converter/convert.js path/to/template.json

# Output goes to converter/output/*.gnl
```

Requires Node.js 18+ (uses `fetch` and ES modules).

## What it converts

The converter handles all template categories in the dataset:

| Category | Templates | Examples |
|----------|-----------|---------|
| Skirts | 5 | 2-panel, 4-panel, 8-panel, waistband |
| Pants | 3 | straight, flare, waistband |
| Tees | 7 | tee, jacket, sleeveless, hooded variants |
| Dresses | 3 | sleeved, sleeveless, waistband |
| Jumpsuits | 3 | sleeved, sleeveless, waistband |

## How the mapping works

### Panel name → body region
Panel names like `front`, `Lback`, `lfsleeve` are mapped to GNL body regions (`%torso.front`, `%leg.L`, `%arm.L`) via a heuristic lookup table in `region-map.js`.

### Shape inference
From vertex geometry:
- 4 vertices with similar top/bottom width → `rect`
- 4 vertices with different top/bottom width → `trapezoid`
- 5+ vertices or any curved edges → `contour`

### Ease computation
Compares panel width (from vertices) to standard body region width. Falls back to `1.1` when the ratio can't be determined.

### Edge naming
Edges are assigned semantic names (`shoulder_l`, `armhole_r`, `hem`, `side_l`, `cap`, `cuff`, etc.) based on their position within the panel's bounding box. See `edge-namer.js`.

### Stitch → seam mapping
Each Korosteleva stitch `[{panel, edge}, {panel, edge}]` becomes `S(panel.edge, panel.edge, plain)`. All seams default to `plain` since the dataset has no construction method info.

### Openings
Edges not involved in any stitch are treated as open edges. These are mapped to GNL openings (`O()`) based on their semantic name and garment type (e.g. `hem` → `O(@hip, circle, body+10cm)` for tees).

## What it doesn't do

- **Parametric variations**: Only converts base templates (parameter values at default). The `parameters` and `constraints` sections are skipped.
- **Precise body region ranges**: Without a body model, `[0..0.4]` ranges are approximated.
- **Seam types**: All seams default to `plain`.
- **Grain, fabric, darts, gathers**: Not present in the geometric data.

## Files

```
converter/
  convert.js           # CLI entry point
  korosteleva-to-gnl.js # Main converter logic
  region-map.js        # Panel name → body region mapping
  edge-namer.js        # Edge index → semantic name inference
  templates/           # Cached JSON templates (auto-downloaded)
  output/              # Generated .gnl files
```

## Browser integration

Four example templates (tee, skirt, pants, dress) are embedded in the [GNL Viewer](../viewer/index.html) — select from the "Korosteleva Dataset" section of the examples dropdown. The converter runs client-side (no server needed) and a GNL/JSON toggle shows both the raw geometric input and the converted semantic output.

The converter modules (`korosteleva-to-gnl.js`, `region-map.js`, `edge-namer.js`) are pure ES modules with no Node.js dependencies, so they work in both Node.js and the browser.

## Verification

Load any `.gnl` output into the [GNL Viewer](../viewer/index.html) — it should parse without errors. The viewer will render flat pattern pieces from the GNL declarations.
