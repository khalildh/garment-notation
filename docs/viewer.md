# Viewer & Architecture Guide

The GNL Viewer is a browser-based tool that parses Garment Notation Language and renders both assembled garment views and flat pattern pieces.

**Live version:** [khalildh.github.io/garment-notation/viewer/](https://khalildh.github.io/garment-notation/viewer/)

---

## Running Locally

The viewer is a static site with no build step or dependencies. Serve the project root with any HTTP server:

```bash
# Python
python3 -m http.server 8000

# Node.js (npx)
npx serve .

# PHP
php -S localhost:8000
```

Then open `http://localhost:8000/viewer/` in your browser. The root `index.html` redirects to the viewer automatically.

> **Note:** Opening `viewer/index.html` directly via `file://` will fail because ES module imports require HTTP.

---

## Architecture

The pipeline flows from source text to rendered SVG:

```
Source text
    |
    v
tokenizer.js  -->  Token[]
    |
    v
parser.js      -->  AST (Program)
    |
    v
renderer.js    -->  SVG (flat pattern pieces)
assembler.js   -->  SVG (assembled garment view)
```

Supporting modules:

- `types.js` — JSDoc type definitions shared across all modules
- `body.js` — Body measurement data and region dimension resolution
- `app.js` — UI wiring (editor, view toggle, examples dropdown)

### Data Flow

1. **Tokenize** — Regex-based scanner converts source into typed tokens (`IDENT`, `LANDMARK`, `REGION`, `NUMBER`, `CHAIN`, etc.)
2. **Parse** — Recursive descent parser builds an AST with `Program > Block[] > declarations, build steps, edges, layers`
3. **Render/Assemble** — The AST is walked to extract panels, openings, darts, edges, and layers. Components are resolved via `USE()` expansion. The result is SVG.

---

## File-by-File Overview

### `viewer/index.html`

The single-page app shell. Contains all CSS (no external stylesheets) and the layout: a left editor pane (textarea), a right viewer pane (SVG container), and a status bar. Loads `src/app.js` as an ES module.

### `viewer/src/types.js`

JSDoc `@typedef` declarations for the entire type system:

- **Tokens:** `TokenType`, `Token`
- **AST expressions:** `NumberExpr`, `LandmarkExpr`, `RegionExpr`, `ReferenceExpr`, `CallExpr`, `BinaryExpr`, `RangeExpr`, `ModifierExpr`, `SetExpr`, `NamedArgExpr`
- **AST structures:** `Declaration`, `BuildStep`, `Layer`, `Block`, `Program`
- **Rendering:** `RegionDims`, `Panel`, `DartInfo`, `EdgeInfo`

No runtime code — only type exports for `@ts-check` usage.

### `viewer/src/tokenizer.js`

Regex-based tokenizer. Matches tokens in priority order from the `PATTERNS` array. Skips whitespace and `--` comments. Tracks line/column for error reporting. Returns a `Token[]` ending with `EOF`.

Token types: `NUMBER`, `IDENT`, `LANDMARK` (`@...`), `REGION` (`%...`), `CHAIN` (`>>`), `RANGE` (`..`), `DEGREE` (`°`), `ASSIGN`, parentheses, braces, brackets, operators.

### `viewer/src/parser.js`

Recursive descent parser. Key functions:

- `parseProgram()` — top level, parses sequential `GARMENT`/`COMPONENT` blocks
- `parseBlock()` — parses block header (name, flags) and body
- `parseBody()` — dispatches `FABRIC:`, `INTERLINING:`, `BUILD:`, `EDGE()`, `LAYER`, and declarations
- `parseLayer()` — parses `LAYER` blocks with `SHARE:` / `FREE:` edge lists
- `parseBuildChain()` — parses `>>` chains of build steps with optional `[modifier]`
- `parseExpr()` / `parseAtom()` — expression parsing with binary ops, ranges, member access, function calls, named args, units

Supports: numeric units (`cm`, `mm`, `gsm`, `°`, `%`), unary minus, juxtaposition multiplication (`0.5W` = `0.5 * W`), set literals (`{a, b}`).

### `viewer/src/body.js`

Body measurement constants and region dimension lookups.

- `BODY` — Standard measurements in cm (women's medium / size 10): neck, shoulder, bust, waist, hip, arm, leg circumferences and lengths
- `REGION_DIMS` — Width (top/bottom) and height for each named region (`torso.front`, `arm.L`, etc.)
- `getRegionDims(region, range)` — Resolves a region string + optional `[start..end]` range to `{ widthTop, widthBottom, height }`
- `combineRegions(a, b)` — Merges two region dimensions for `+` unions (max width, summed height)
- `resolveVar(name)` — Maps named variables (`W`, `neck_circ`, etc.) to body measurements

### `viewer/src/renderer.js`

Renders **flat pattern pieces** as SVG. Each panel gets:

- A shaped outline (`rect`, `trapezoid`, `contour` with torso/sleeve/leg curves)
- Grain line with directional arrow (rotated for `weft`, `bias`, custom angles)
- Dart marks (wedge lines)
- Edge curve indicators (dashed red lines for princess seam shaping)
- Lining panels with cross-hatch pattern
- Labels: name, dimensions (cm), shape/ease/grain info

Layout: row-based arrangement with 700px max row width. Handles component resolution via `USE()` expansion.

### `viewer/src/assembler.js`

Renders **assembled garment views** as SVG technical flats. Detects garment type (`top`, `skirt`, `collar`, `generic`) from panel names and regions, then dispatches to specialized drawing functions:

- `drawTop()` — Body with sleeves, neckline, hem stitch lines. Detects and draws: collar/lapels, buttons, welt pockets, princess seam lines, lining indicators
- `drawSkirt()` — Waistband + trapezoidal skirt body with dimension callouts
- `drawCollar()` — Collar stand, collar fall with roll line, lapels with gorge lines
- `drawGeneric()` — Falls back to `drawTop()`

Includes component resolution (same `USE()` expansion as renderer) and dimension annotations.

### `viewer/src/app.js`

UI controller. Wires up:

- **Editor** — textarea with debounced input handling (250ms)
- **View toggle** — switches between "Assembled" (`assemble()`) and "Pieces" (`render()`)
- **Status bar** — shows parse results (panel/step/edge/layer counts) or error messages
- **Examples dropdown** — loads built-in examples: T-Shirt, Wrap Skirt, Jacket Collar, Blazer (inline), Blazer (composed), Fitted Dress (princess + lining)

The `update()` function runs the full pipeline: `tokenize() -> parse() -> assemble()/render()`.

---

## Adding a New Example

1. Open `viewer/src/app.js`
2. Add an `<option>` to the `#examples` select in `viewer/index.html`:
   ```html
   <option value="my_example">My Example</option>
   ```
3. Add the corresponding GNL source to the `EXAMPLES` object in `app.js`:
   ```js
   const EXAMPLES = {
     // ...existing examples...
     my_example: `GARMENT my_example {
       FABRIC: M(...)
       // ...
     }`,
   };
   ```

---

## Adding a New Operator or Primitive

### Adding a new primitive (e.g. a new function call like `TRIM()`)

1. **Tokenizer** — No changes needed. New identifiers are already tokenized as `IDENT` tokens, and function call syntax (`NAME(args)`) is handled generically.

2. **Parser** — If the new primitive appears as a standalone statement (like `EDGE()`), add a check in `parseBody()`:
   ```js
   } else if (check('IDENT', 'TRIM') && tokens[pos + 1]?.type === 'LPAREN') {
     // Parse as expression and store appropriately
   }
   ```
   If it appears only inside assignments or build steps, no parser changes are needed.

3. **Types** — Add any new AST node types or panel properties to `types.js`.

4. **Renderer** — In `renderer.js`, extract the new data from the AST in `render()` and add visual representation in `renderPanel()`.

5. **Assembler** — Similarly in `assembler.js`, handle the new data in the appropriate `draw*()` function.

### Adding a new operator (e.g. a new build step like `BIND()`)

1. **Tokenizer/Parser** — No changes needed if it follows existing function call syntax in the build chain.

2. **Renderer** — If the operator modifies panels (like `D` adds darts), extract it from build steps in a new `extractXxx()` function and apply to panels.

3. **Assembler** — Add visual indicators in the appropriate `draw*()` function.
