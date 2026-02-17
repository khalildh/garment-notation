# GNL — Garment Notation Language

A formal descriptive language for clothing construction.

Dance has Labanotation. Music has staff notation. Architecture has plan/section/elevation conventions. GNL brings the same rigor to garments — a generative descriptive language where a valid expression is sufficient to construct a garment without ambiguity.

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

## Specification

See [garment-notation.md](garment-notation.md) for the full v0.1 draft specification.

## Status

**v0.1 — Draft.** A starting point that will need refinement through use, critique, and input from garment-makers, pattern-drafters, and computational designers.

## License

All rights reserved.
