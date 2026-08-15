# Contributing

GNL is a draft specification (v0.3) and the viewer is a proof-of-concept. Contributions are welcome — from language design feedback to viewer improvements.

---

## Project Structure

```
garment-notation/
  garment-notation.md     # Full v0.3 specification
  README.md               # Project overview
  index.html              # Redirects to viewer/
  images/                 # Screenshot assets for README
  docs/                   # Documentation
    syntax-reference.md   # GNL quick reference
    viewer.md             # Viewer architecture guide
    contributing.md       # This file
  grammar/
    gnl.peg               # PEG grammar — the normative syntax
  viewer/
    index.html            # Viewer app (HTML + CSS)
    src/
      gnl-parser.js       # Generated from grammar/gnl.peg — do not edit
      peg-adapter.js      # PEG AST → the renderer's AST
      types.js            # JSDoc type definitions
      tokenizer.js        # Regex-based tokenizer
      parser.js           # Recursive descent parser
      body.js             # Body measurements & region dims
      outline.js          # Literal `poly` outlines: geometry & SVG paths
      renderer.js         # Flat pattern piece SVG renderer
      assembler.js        # Assembled garment SVG renderer
      app.js              # UI controller & examples
  converter/              # Pattern datasets → GNL (see converter/README.md)
    evaluate.js           # Round-trip and semantic measurement
  tests/
    parse-tests.js        # Parse, adapter, converter, and round-trip tests
```

`viewer/src/gnl-parser.js` is generated. After changing `grammar/gnl.peg`, run
`npm run generate` and commit both.

---

## Running Locally

No build step, no dependencies. Serve the project root over HTTP:

```bash
python3 -m http.server 8000
# or
npx serve .
```

Open `http://localhost:8000/viewer/` in your browser.

> ES modules require HTTP — `file://` won't work.

---

## Code Style

- **Vanilla JavaScript** — no frameworks, no build tools, no npm
- **ES modules** — `import`/`export` between files
- **JSDoc types** — `@typedef`, `@param`, `@returns` with `// @ts-check` at the top of each file for editor type checking
- **No runtime dependencies** — everything is self-contained
- **Inline CSS** — all styles live in `viewer/index.html`
- **SVG rendering** — built as string concatenation (no DOM manipulation or libraries)

When contributing code, match the existing patterns:

- Use `const` by default, `let` when mutation is needed
- Keep functions small and focused
- Use JSDoc types for function signatures
- Name things clearly — the code should be readable without comments

---

## How to Submit Changes

1. Fork the repository
2. Create a branch for your change
3. Make your changes, keeping commits focused
4. Open a pull request with a clear description of what changed and why

For specification changes (edits to `garment-notation.md`), include rationale and examples showing why the change improves the language.

---

## Areas for Contribution

### Specification

- **Formal grammar** — BNF/EBNF for the language (mentioned in spec as future work)
- **Colorwork** — `COLOR(panel, pattern_type, palette)` for prints, stripes, colorblocking
- **Embellishment** — `EMB(panel, type, placement)` for embroidery, beading, applique
- **Layering** — `OVER(garment_a, garment_b)` for multi-garment interaction
- **Finishing** — `FINISH(garment, wash_type)` for stone-wash, distress, enzyme-wash
- **Movement** — coupling with Labanotation for garment behavior in motion

### Viewer

- **Better contour shapes** — the current body-mapped panel outlines are simplified approximations
- **More garment type layouts** — the assembler handles tops, skirts, and collars; pants, dresses, and outerwear could use dedicated rendering
- **Interactive features** — hover to highlight corresponding panels, click to inspect details
- **Error recovery** — the parser currently throws on first error; showing partial results would improve the editing experience
- **Syntax highlighting** — the editor textarea has no highlighting; a CodeMirror or custom highlighter would help readability
- **Export** — SVG download, PDF pattern output
- **Responsive improvements** — the mobile layout stacks panes vertically but could be refined

### Documentation

- **More examples** — garments that exercise less-used features (drape, stretch, complex layering)
- **Tutorials** — step-by-step guides for designing a garment in GNL
- **Visual notation** — a graphical symbol system parallel to the text syntax (mentioned in spec as future work)
