# GNL Syntax Reference

Quick reference for the Garment Notation Language (v0.2). See [garment-notation.md](../garment-notation.md) for the full specification.

---

## Block Types

| Keyword | Purpose | Syntax |
|---------|---------|--------|
| `GARMENT` | Top-level garment definition | `GARMENT name [flags] { ... }` |
| `COMPONENT` | Reusable building block | `COMPONENT name { ... }` |

Blocks contain: `FABRIC:`, declarations, `EDGE()` calls, `LAYER` blocks, and a `BUILD:` chain.

```
GARMENT t_shirt [SYM] {
  FABRIC: M(...)
  front = P(...)
  BUILD:
    S(...) >> F(...)
}
```

---

## Primitives

### Panel `P(region, shape, ease, grain)`

A flat piece of fabric mapped onto a body region.

| Parameter | Values | Example |
|-----------|--------|---------|
| `region` | `%torso.front`, `%arm.L[0..0.4]`, region unions with `+` | `%torso.front + %leg[0..0.2]` |
| `shape` | `rect`, `trapezoid`, `contour`, `circle` | `contour` |
| `ease` | Scalar `1.15` or directional `ease(1.0, 2.5)` | `1.15` |
| `grain` | `warp` (default), `weft`, `bias`, angle (`45°`) | `bias` |

```
front  = P(%torso.front, contour, 1.15)
skirt  = P(%leg.L, rect, ease(1.0, 2.5))
draped = P(%torso.front, contour, 1.1, bias)
```

### Opening `O(location, shape, circumference)`

A hole where the body enters or exits.

| Parameter | Values | Example |
|-----------|--------|---------|
| `location` | Landmark `@neck` or region `%torso.front` | `@waist` |
| `shape` | `circle`, `slit`, `V`, `keyhole`, `square`, `envelope`, `open` | `circle` |
| `circumference` | `body+Ncm` or absolute | `body+8cm` |

```
neck = O(@neck, circle, body+8cm)
hem  = O(@knee, open)
zip  = O(%torso.back, slit, @neck)
```

### Seam `S(edge_a, edge_b, type)`

Joins two edges together.

| Seam type | Description |
|-----------|-------------|
| `plain` | Basic seam |
| `french` | Enclosed seam |
| `felled` | Flat-felled |
| `lapped` | Overlapping |
| `bound` | Bound edge |
| `serged` | Overlock |

```
S(front.shoulder, back.shoulder, serged)
S(sleeve.cap, {front.armhole, back.armhole}, serged)
```

### Edge `EDGE(panel.edge, curve(landmark, curvature))`

Defines a shaped (curved) edge for princess seams and structural curves.

```
EDGE(front_center.side, curve(@bust.L, -3cm))
EDGE(front_side.center, curve(@bust.L, 3cm))
```

Positive curvature = outward, negative = inward. Two complementary EDGE curves joined by a seam create 3D shaping without darts.

---

## Operators

### Dart `D(panel, location, angle, length)`

Removes a wedge to create curvature.

```
D(front, @bust.L, 12°, 8cm)
```

### Gather `G(panel.edge, ratio)`

Compresses fabric along an edge (ratio of fabric length to seam length).

```
G(sleeve.cap, 1.08)
G(skirt.top, 1.8)
```

### Pleat `PL(panel.edge, type, width, count, direction)`

| Parameter | Values |
|-----------|--------|
| `type` | `knife`, `box`, `inverted_box`, `accordion` |
| `direction` | `L`, `R`, `center`, `away` |

```
PL(skirt.top, box, 3cm, 12, center)
```

### Fold `F(panel.edge, width, direction)`

A single fold (hem, collar roll, cuff).

```
F(hem, 2.5cm, in)
F(collar_fall, gorge_line, out)
```

### Drape `DR(panel, anchor_points[])`

Fabric falls under gravity from anchor points. Combine with `grain=bias` on the panel.

```
DR(front, [@shoulder.L, @shoulder.R])
```

### Stretch `ST(panel, axis, ratio)`

Indicates stretch zones (for knits / stretch wovens).

| Axis | Description |
|------|-------------|
| `warp` | Lengthwise stretch |
| `weft` | Crosswise stretch |
| `biaxial` | Both directions |

```
ST(body, biaxial, 1.3)
```

---

## Closures `C(opening, type, position)`

| Type | Example |
|------|---------|
| `button(n)` | `C(front_opening, button(6), center)` |
| `zip(type)` | `C(zipper, zip(invisible), center)` |
| `tie` | `C(waist, tie, L_wrap_over_R)` |
| `wrap` | `C(front, wrap, L_over_R)` |
| `hook`, `snap(n)`, `velcro`, `lace`, `toggle(n)`, `pin` | |

---

## Fabric `M(weight, drape, stretch, opacity, texture)`

| Parameter | Values |
|-----------|--------|
| `weight` | gsm (`160gsm`) or `sheer`, `light`, `medium`, `heavy`, `coating` |
| `drape` | `stiff`, `crisp`, `fluid`, `liquid` |
| `stretch` | `none`, `weft`, `warp`, `biaxial:N%` |
| `opacity` | `0.0` (transparent) to `1.0` (opaque) |
| `texture` | `knit.jersey`, `knit.rib`, `woven.plain`, `woven.twill`, `woven.satin`, etc. |

```
FABRIC: M(160gsm, fluid, biaxial:15%, 1.0, knit.jersey)
INTERLINING: M(80gsm, stiff, none, 1.0, nonwoven)
```

---

## Build Chain `>>`

Construction steps read left-to-right as assembly order. Modifiers in `[]` apply to the preceding step.

```
BUILD:
  S(front.shoulder, back.shoulder, serged)
  >> S(sleeve.cap, {front.armhole, back.armhole}, serged)
     [G(sleeve.cap, 1.08)]
  >> F(hem, 2.5cm, in)
```

---

## Composition

### `USE(component)` — Instantiate a component

```
sleeve = USE(two_piece_sleeve)
-- creates sleeve.top and sleeve.under
```

### `ATTACH(instance, location)` — Attach to parent

```
ATTACH(sleeve, {front.armhole, back.armhole})
ATTACH(collar, neck_opening)
```

---

## Lining `LAYER`

A parallel structure sharing some edges with the shell.

```
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
```

- `SHARE` — edges sewn to the shell (facings, hems, armholes)
- `FREE` — edges that hang independently
- Attach to shell with `ATTACH_LAYER(lining)` in the outer BUILD chain

---

## Body References

### Landmarks `@` — Points on the body

```
@neck    @shoulder.L  @shoulder.R   @bust.L    @bust.R
@waist.center  @waist.L  @waist.R  @hip.center  @hip.L  @hip.R
@crotch  @knee.L  @knee.R  @ankle.L  @ankle.R
@wrist.L  @wrist.R  @elbow.L  @elbow.R  @chest.center
```

`.L` / `.R` for bilateral symmetry.

### Regions `%` — Surfaces on the body

```
%torso.front  %torso.back  %torso.L  %torso.R
%arm.L  %arm.R  %leg.L  %leg.R
%neck  %shoulder.L  %shoulder.R  %waist  %hip
```

### Ranges `[start..end]` — Subdivide a region

```
%arm.L[0..0.5]       -- upper half of left arm
%leg.R[0.5..1]       -- lower half of right leg
%torso.front[0..0.3] -- upper third of front torso
```

---

## Flags `[SYM]`

`[SYM]` enables bilateral symmetry — describe one side, the other is mirrored.

```
GARMENT t_shirt [SYM] { ... }
```

---

## Comments

```
-- This is a comment
```

Double-dash `--` comments extend to end of line.

---

## Notation Summary

| Symbol | Meaning | Example |
|--------|---------|---------|
| `@` | Body landmark | `@shoulder.L` |
| `%` | Body region | `%torso.front` |
| `P` | Panel | `P(%arm.L, contour, 1.1, bias)` |
| `O` | Opening | `O(@neck, V, depth=12cm)` |
| `S` | Seam | `S(P1.edge, P2.edge, french)` |
| `EDGE` | Shaped panel edge | `EDGE(P.side, curve(@bust, 3cm))` |
| `D` | Dart | `D(P, @bust.L, 10°, 8cm)` |
| `G` | Gather | `G(P.top, 1.5)` |
| `PL` | Pleat | `PL(P.top, box, 3cm, 8, center)` |
| `F` | Fold / Hem | `F(P.bottom, 2cm, in)` |
| `DR` | Drape | `DR(P, [@shoulder.L])` |
| `ST` | Stretch | `ST(P, biaxial, 1.2)` |
| `C` | Closure | `C(O, zip(invisible), center)` |
| `M` | Material | `M(200gsm, fluid, none, ...)` |
| `>>` | Then (build order) | `step >> step` |
| `[SYM]` | Bilateral symmetry | `GARMENT x [SYM] { ... }` |
| `[..]` | Region subdivision | `%arm[0..0.5]` |
| `USE` | Instantiate component | `sleeve = USE(two_piece_sleeve)` |
| `ATTACH` | Attach component | `ATTACH(sleeve, armhole)` |
| `LAYER` | Internal lining | `LAYER lining { ... }` |
