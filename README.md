# GNL — Garment Notation Language

A formal descriptive language for clothing construction.

**[Try the live viewer](https://khalildh.github.io/garment-notation/viewer/)**

Dance has Labanotation. Music has staff notation. Architecture has plan/section/elevation conventions. GNL brings the same rigor to garments — a generative descriptive language where a valid expression is sufficient to construct a garment without ambiguity.

![T-Shirt — assembled view](images/tshirt-assembled.png)

## Core Concepts

- **Body-anchored** — the body is the coordinate system, using anatomical landmarks (`@shoulder.L`) and regions (`%torso.front`)
- **Topological** — garments are surfaces with boundaries and openings
- **Constructive** — descriptions encode build order, not just final form
- **Composable** — complex garments are compositions of simpler elements

## Quick Example

```
GARMENT t_shirt [SYM] {
  FABRIC: M(160gsm, fluid, biaxial:15%, 1.0, knit.jersey)

  front  = P(%torso.front, contour, 1.15)
  back   = P(%torso.back, contour, 1.15)
  sleeve = P(%arm[0..0.4], contour, 1.2)

  neck = O(@neck, circle, body+8cm)
  hem  = O(@hip, circle, body+10cm)

  BUILD:
    S(front.shoulder, back.shoulder, serged)
    >> S(sleeve.cap, {front.armhole, back.armhole}, serged)
    >> S(front.side, back.side, serged)
    >> F(hem, 2.5cm, in)
}
```

## Grammar

The language is formally defined as a [PEG grammar](grammar/gnl.peg) targeting [Peggy](https://peggyjs.org). The generated parser produces a richly-typed AST which is adapted to the renderer's internal format at runtime.

```sh
npm install          # install Peggy (dev dependency only)
npm run generate     # regenerate viewer/src/gnl-parser.js from grammar/gnl.peg
npm test             # run parse + adapter tests against all examples
```

## Viewer

The repo includes a [live viewer](https://khalildh.github.io/garment-notation/viewer/) that parses GNL and renders both assembled garment views and flat pattern pieces.

### Assembled View

Write GNL on the left, see the full garment on the right — with stitch lines, dimension callouts, and construction details.

| T-Shirt | Wrap Skirt | Jacket Collar |
|---------|------------|---------------|
| ![T-Shirt](images/tshirt-assembled.png) | ![Wrap Skirt](images/wrap-skirt-assembled.png) | ![Jacket Collar](images/collar-assembled.png) |

### Pattern Pieces

Toggle to "Pieces" to see the individual flat pattern pieces with shape outlines, grain lines, and dimensions.

![T-Shirt — pattern pieces](images/tshirt-pieces.png)

## Korosteleva Dataset Converter

The repo includes a [converter](converter/) that transforms garment templates from the [Korosteleva NeurIPS 2021 dataset](https://github.com/maria-korosteleva/Garment-Pattern-Generator) (2D panel geometry as JSON) into GNL.

```sh
# Auto-downloads 21 templates from GitHub on first run, converts all
node converter/convert.js
```

Four example templates (tee, skirt, pants, dress) are also available directly in the viewer — select from the "Korosteleva Dataset" section of the examples dropdown. A GNL/JSON toggle lets you compare the raw geometric input with the converted semantic output.

See [converter/README.md](converter/README.md) for details on the mapping approach.

## Documentation

- **[Full Specification](garment-notation.md)** — the complete v0.2 spec

## Star History

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=khalildh/garment-notation&type=Date&theme=dark" />
  <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=khalildh/garment-notation&type=Date" />
  <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=khalildh/garment-notation&type=Date" />
</picture>

## Status

**v0.2 — Draft.** Includes grain parameter, directional ease, princess seams (EDGE), lining (LAYER), and component composition (USE/ATTACH). A starting point that will need refinement through use, critique, and input from garment-makers, pattern-drafters, and computational designers.

## License

All rights reserved.
