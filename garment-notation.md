# GNL — Garment Notation Language

### A Formal Descriptive Language for Clothing

**Version 0.1 — Draft Specification**

---

## 1. Motivation

Dance has Labanotation. Music has staff notation. Architecture has plan/section/elevation conventions. Clothing — despite being a universal, structurally rich, topological art form — has no equivalent formal language. GNL aims to fill that gap.

GNL is a *generative* descriptive language: a valid GNL expression should be sufficient to construct (or reconstruct) a garment without ambiguity.

---

## 2. Design Principles

1. **Body-anchored**: The body is the coordinate system, just as Labanotation anchors movement to the body's center of gravity.
2. **Topological first**: Garments are fundamentally *surfaces with boundaries and openings*. Shape comes from how flat fabric maps onto a 3D body.
3. **Constructive**: Descriptions encode the *build order* — how a garment is assembled — not just the final form.
4. **Composable**: Complex garments are compositions of simpler elements.
5. **Fabric-aware**: Material properties modify structural descriptions.

---

## 3. The Body Reference Frame

GNL uses an anatomical coordinate system with **landmarks** and **regions**.

### 3.1 Landmarks (points)

```
@neck          @shoulder.L    @shoulder.R
@bust.L        @bust.R        @chest.center
@waist.center  @waist.L       @waist.R
@hip.center    @hip.L         @hip.R
@crotch
@knee.L        @knee.R
@ankle.L       @ankle.R
@wrist.L       @wrist.R
@elbow.L       @elbow.R
```

Landmarks use `.L` / `.R` for bilateral symmetry. When a garment is **symmetric**, the `SYM` flag allows description of one side only.

### 3.2 Regions (surfaces)

Regions are bounded areas of the body surface:

```
%torso.front    %torso.back
%torso.L        %torso.R
%arm.L          %arm.R
%leg.L          %leg.R
%neck           %shoulder.L    %shoulder.R
%waist          %hip
```

Regions can be subdivided with a fractional range:

```
%arm.L[0..0.5]      — upper half of left arm (shoulder to elbow)
%leg.R[0.5..1]      — lower half of right leg (knee to ankle)
%torso.front[0..0.3] — upper third of front torso (roughly chest area)
```

---

## 4. Primitives

### 4.1 Panel `P`

The fundamental unit: a flat piece of fabric that maps onto a body region.

```
P(region, shape, ease)
```

- **region**: the body region it covers
- **shape**: geometric outline — `rect`, `trapezoid`, `circle`, `contour` (body-mapped), or parametric curves
- **ease**: fit modifier as a ratio (1.0 = skin-tight, 1.5 = 50% extra, 3.0 = voluminous)

Examples:

```
P(%torso.front, contour, 1.05)   — a fitted front bodice panel
P(%leg.L, rect, 2.5)             — a very full rectangular skirt/leg panel
P(%arm.L, contour, 1.0)          — a skin-tight sleeve
```

### 4.2 Opening `O`

A hole in a surface — where the body enters or exits.

```
O(location, shape, circumference)
```

- **location**: landmark or region boundary
- **shape**: `circle`, `slit`, `keyhole`, `V`, `square`, `envelope`
- **circumference**: absolute measurement or `body + ease`

```
O(@neck, circle, body+2cm)         — a crew neckline
O(@neck, V, depth=15cm)            — a V-neck opening
O(@waist, circle, body+0cm)        — a fitted waist opening
O(%torso.front, slit, @neck..@hip) — a full front opening (like a coat)
```

### 4.3 Seam `S`

A join between two edges.

```
S(edge_a, edge_b, type)
```

- **type**: `plain`, `french`, `felled`, `lapped`, `bound`, `serged`

```
S(P1.right, P2.left, french)   — french seam joining panel 1 right edge to panel 2 left edge
```

---

## 5. Operators (Transformations)

Operators modify panels to create three-dimensional shape from flat fabric.

### 5.1 Dart `D`

Removes a wedge to create curvature.

```
D(panel, location, angle, length)
```

```
D(P_front, @bust.L, 12°, 8cm)   — a bust dart
D(P_back, @shoulder.R, 6°, 10cm) — a shoulder dart
```

### 5.2 Gather `G`

Compresses fabric along an edge (ratio of fabric length to seam length).

```
G(panel.edge, ratio)
```

```
G(P_skirt.top, 1.8)     — gathered into waistband at 1.8:1
G(P_sleeve.cap, 1.15)   — slight ease in a set-in sleeve cap
```

### 5.3 Pleat `PL`

Folds fabric in a structured, repeating pattern.

```
PL(panel.edge, type, width, count, direction)
```

- **type**: `knife`, `box`, `inverted_box`, `accordion`
- **direction**: `L`, `R`, `center`, `away`

```
PL(P_skirt.top, box, 3cm, 12, center)   — 12 box pleats, 3cm wide, pressing toward center
```

### 5.4 Fold `F`

A single structural fold (collar, cuff, hem).

```
F(panel.edge, width, direction)
```

```
F(P_collar.outer, 5cm, out)    — collar folds over 5cm outward
F(P_front.bottom, 3cm, in)     — 3cm hem folded inward
```

### 5.5 Drape `DR`

Allows fabric to fall under gravity from anchor points (bias cuts, cowls).

```
DR(panel, anchor_points[], grain_angle)
```

```
DR(P_front, [@shoulder.L, @shoulder.R], 45°)   — bias-cut draped front panel
DR(P_cowl, [@neck], 45°)                        — cowl neckline
```

### 5.6 Stretch `ST`

Indicates areas where fabric is under tension (for knits, stretch wovens).

```
ST(panel, axis, ratio)
```

- **axis**: `warp`, `weft`, `biaxial`

```
ST(P_body, biaxial, 1.3)   — stretches up to 30% in both directions
```

---

## 6. Closures `C`

Mechanisms that allow openings to be sealed.

```
C(opening, type, position)
```

- **type**: `button(n)`, `zip(type)`, `hook`, `tie`, `snap(n)`, `velcro`, `lace`, `toggle(n)`, `wrap`, `pin`

```
C(O_front, zip(invisible), center)
C(O_front, button(6), center)
C(O_cuff, button(1), inner)
C(O_front, wrap, L_over_R)
```

---

## 7. Fabric Modifier `M`

Material properties that affect how operators resolve visually.

```
M(weight, drape, stretch, opacity, texture)
```

- **weight**: gsm (grams per square meter) or category `sheer|light|medium|heavy|coating`
- **drape**: `stiff`, `crisp`, `fluid`, `liquid`
- **stretch**: `none`, `weft`, `warp`, `biaxial` with percentage
- **opacity**: 0.0 (transparent) to 1.0 (opaque)
- **texture**: `smooth`, `napped`, `pile`, `knit.jersey`, `knit.rib`, `woven.plain`, `woven.twill`, `woven.satin`, etc.

```
M(120gsm, fluid, biaxial:20%, 0.9, woven.satin)   — silk charmeuse-like
M(350gsm, stiff, none, 1.0, woven.twill)            — structured denim-like
```

---

## 8. Composition & Build Order

Garments are assembled using the `>>` (then) operator, read left-to-right as a construction sequence.

```
garment = step >> step >> step
```

### Example: Basic T-Shirt

```
GARMENT t_shirt [SYM] {

  FABRIC: M(160gsm, fluid, biaxial:15%, 1.0, knit.jersey)
  
  -- Define panels
  front  = P(%torso.front, contour, 1.15)
  back   = P(%torso.back, contour, 1.15)
  sleeve = P(%arm[0..0.4], contour, 1.2)
  
  -- Define openings
  neck   = O(@neck, circle, body+8cm)
  hem    = O(@hip, circle, body+10cm)
  cuff   = O(@elbow, circle, body+4cm)    -- short sleeve ends above elbow
  
  -- Build order
  BUILD:
    S(front.shoulder, back.shoulder, serged)
    >> S(sleeve.cap, {front.armhole, back.armhole}, serged)
       [G(sleeve.cap, 1.08)]              -- slight ease in cap
    >> S(front.side, back.side, serged)    -- side seams
    >> S(sleeve.under, sleeve.under, serged) -- underarm seam
    >> F(neck, 1.5cm, in)                  -- neck hem
    >> F(hem, 2.5cm, in)                   -- bottom hem
    >> F(cuff, 2cm, in)                    -- sleeve hem
}
```

### Example: A-Line Wrap Skirt

```
GARMENT wrap_skirt {

  FABRIC: M(200gsm, crisp, none, 1.0, woven.plain)
  
  front_L = P(%torso.front.L + %leg.L[0..0.2], trapezoid(waist=0.5W, hem=1.2W), 1.1)
  front_R = P(%torso.front.R + %leg.R[0..0.2], trapezoid(waist=0.5W, hem=1.2W), 1.1)
  back    = P(%torso.back + %leg[0..0.2], trapezoid(waist=W, hem=2W), 1.1)
  
  waist   = O(@waist, circle, body+2cm)
  hem_line = O(@knee, open)
  
  waistband = P(%waist, rect(width=4cm, length=W+40cm), 1.0)
  
  BUILD:
    S(front_L.side, back.side.L, plain)
    >> S(front_R.side, back.side.R, plain)
    -- front_L and front_R overlap, not seamed (wrap)
    >> F(waistband, 2cm, in)              -- fold waistband in half
    >> S(waistband.inner, {back.top, front_L.top, front_R.top}, plain)
       [G({front_L.top, front_R.top}, 1.0)]
    >> C(waist, tie, L_wrap_over_R)       -- tie closure
    >> F(hem_line, 1cm, in)               -- narrow hem
}
```

### Example: Tailored Jacket Collar

```
-- Describing just the collar component

COMPONENT notched_lapel {

  FABRIC: M(280gsm, crisp, none, 1.0, woven.twill)
  INTERLINING: M(80gsm, stiff, none, 1.0, nonwoven)  -- fusing
  
  collar_stand  = P(%neck, rect(height=3cm, length=neck_circ), 1.0)
  collar_fall   = P(%neck, contour(width=6cm), 1.0)
  lapel         = P(%torso.front[0..0.15], contour, 1.0)
  
  break_point   = @chest.center + 5cm_below
  gorge_line    = LINE(break_point, @shoulder * 0.7)
  
  BUILD:
    FUSE(collar_stand, INTERLINING)
    >> FUSE(collar_fall, INTERLINING)
    >> FUSE(lapel, INTERLINING)
    >> S(collar_stand.top, collar_fall.bottom, plain)
    >> F(collar_fall, gorge_line, out)     -- collar rolls over at gorge
    >> S(collar_stand.ends, lapel.notch, plain)
    -- lapel rolls back from break_point downward
    >> F(lapel, break_point..@hem, out)
}
```

---

## 9. Notation Summary

| Symbol | Meaning              | Example                          |
|--------|----------------------|----------------------------------|
| `@`    | Body landmark        | `@shoulder.L`                    |
| `%`    | Body region          | `%torso.front`                   |
| `P`    | Panel                | `P(%arm.L, contour, 1.1)`       |
| `O`    | Opening              | `O(@neck, V, depth=12cm)`       |
| `S`    | Seam                 | `S(P1.edge, P2.edge, french)`   |
| `D`    | Dart                 | `D(P, @bust.L, 10°, 8cm)`      |
| `G`    | Gather               | `G(P.top, 1.5)`                 |
| `PL`   | Pleat                | `PL(P.top, box, 3cm, 8, center)`|
| `F`    | Fold / Hem           | `F(P.bottom, 2cm, in)`          |
| `DR`   | Drape                | `DR(P, [@shoulder.L], 45°)`     |
| `ST`   | Stretch              | `ST(P, biaxial, 1.2)`           |
| `C`    | Closure              | `C(O, zip(invisible), center)`  |
| `M`    | Material             | `M(200gsm, fluid, none, ...)`   |
| `>>`   | Then (build order)   | `step >> step`                   |
| `SYM`  | Bilateral symmetry   | `GARMENT x [SYM] { ... }`       |
| `[]`   | Region subdivision   | `%arm[0..0.5]`                   |

---

## 10. Extensions (Future)

- **Layering**: `OVER(garment_a, garment_b)` — describing how garments interact when worn together
- **Animation / Movement**: coupling with Labanotation to describe how garments behave in motion
- **Colorwork**: `COLOR(panel, pattern_type, palette)` — prints, stripes, colorblocking
- **Embellishment**: `EMB(panel, type, placement)` — embroidery, beading, appliqué
- **Degradation / Finishing**: `FINISH(garment, wash_type)` — stone-wash, distress, enzyme-wash
- **Formal grammar specification**: BNF/EBNF for parser implementation
- **Visual notation**: A graphical symbol system parallel to the textual syntax (as Labanotation has both verbal description and staff notation)

---

## 11. Comparison to Existing Systems

| System          | Classifies | Generates | Encodes construction | Formal grammar |
|-----------------|:----------:|:---------:|:-------------------:|:--------------:|
| HS Codes        | ✓          |           |                     |                |
| FashionPedia    | ✓          |           |                     |                |
| Sewing patterns | ✓          | ✓         | partial             |                |
| Knitting notation| ✓         | ✓         | ✓                   | ✓              |
| **GNL**         | ✓          | ✓         | ✓                   | ✓              |

---

*GNL v0.1 — A starting point. Like early Labanotation, this will need refinement through use, critique, and the input of garment-makers, pattern-drafters, and computational designers.*
