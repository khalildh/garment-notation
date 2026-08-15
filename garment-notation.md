# GNL — Garment Notation Language

### A Formal Descriptive Language for Clothing

**Version 0.3 — Draft Specification**

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
P(region, shape, ease, grain)
```

- **region**: the body region it covers
- **shape**: geometric outline — `rect`, `trapezoid`, `circle`, `contour` (body-mapped), or `poly` (a literal outline; see §4.5)
- **ease**: fit at the panel's relationship to the body, expressed as either:
  - A single ratio: `1.05` (uniform 5% ease across the panel)
  - A top/bottom pair: `ease(1.0, 2.5)` (fitted at top, flared at bottom — e.g. A-line)
  - Ease describes the panel's *base dimensions* relative to the body. Fullness *distribution* — how excess fabric behaves — is controlled by operators (`G`, `PL`, `DR`) in the build chain, not by ease itself.
- **grain**: fabric grain direction relative to the panel (optional, default `warp`)
  - `warp` — lengthwise grain runs vertically (standard)
  - `weft` — crosswise grain runs vertically
  - `bias` or `45°` — cut on the 45° bias
  - Any angle: `30°`, `60°`, etc.

Examples:

```
P(%torso.front, contour, 1.05)                — a fitted front bodice panel, warp grain (default)
P(%leg.L, rect, ease(1.0, 2.5))               — A-line: fitted at waist, flared at hem
P(%arm.L, contour, 1.0)                        — a skin-tight sleeve
P(%torso.front, contour, 1.1, bias)            — bias-cut front panel (for drape)
P(%torso.front, contour, 1.1, grain=weft)      — crossgrain panel
```

> **v0.2 note**: In v0.1, ease was a single scalar that was ambiguous about fullness distribution. A `P(%leg, rect, 2.5)` could be a gathered skirt, a pleated one, or a flared circle skirt. The `ease(top, bottom)` form resolves this for shaped panels, while `G`/`PL`/`DR` handle fullness distribution explicitly. Grain was previously only expressible through `DR(..., 45°)`, despite being structurally significant for every panel.

### 4.2 Opening `O`

A hole in a surface — where the body enters or exits.

```
O(location, shape, circumference)
```

- **location**: landmark or region boundary
- **shape**: `circle`, `slit`, `keyhole`, `V`, `square`, `envelope`
- **circumference**: absolute measurement (`45.3cm`) or `body + ease`

```
O(@neck, circle, body+2cm)         — a crew neckline
O(@neck, circle, 45.3cm)           — a measured neckline
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

### 4.4 Edge `EDGE`

Defines a shaped (curved) edge on a panel. This is how princess seams and other structural curves are expressed — the shaping lives in the panel edge geometry, not in a dart or gather operator.

```
EDGE(panel.edge, curve(landmark, curvature))
```

- **panel.edge**: which edge of which panel (`front_side.inner`, `front_center.outer`, etc.)
- **curve**: a curve definition with a target landmark and curvature amount
  - **landmark**: the body point the curve passes through or shapes around
  - **curvature**: how far the edge deviates from straight, in cm (positive = outward, negative = inward)

```
EDGE(front_side.inner, curve(@bust.L, 3cm))     — princess seam: side panel curves out 3cm at bust
EDGE(front_center.outer, curve(@bust.L, -3cm))   — center panel curves in to match
```

When two panels with complementary EDGE curves are joined by a seam, the result is 3D shaping without darts. This is the mechanism behind princess seams, shaped yokes, and contoured waistbands.

```
-- Princess seam replacing a bust dart:
front_center = P(%torso.front.L[0..0.5], contour, 1.0)
front_side   = P(%torso.front.L[0.5..1], contour, 1.0)

EDGE(front_center.side, curve(@bust.L, -3cm))
EDGE(front_side.center, curve(@bust.L, 3cm))

S(front_center.side, front_side.center, plain)   — princess seam
```

### 4.5 Literal outlines `poly`

Every shape above is *resolved* — `contour` means "whatever this region's outline comes to on this body", which is only as well defined as the body model and the drafting rules behind it. That abstraction is the point of the notation, but it leaves GNL unable to write down a pattern piece that already exists.

`poly` closes that gap. It is a closed ring of vertices in panel-local centimetres, y-up, and it says exactly what the piece is:

```
front = P(%torso.front, poly[
  (0, 21.11) : neckline_r,
  (-25, 56.11) : shoulder_r,
  (-55, 56.11) ~ (0.7, 0.4) : armhole_r,
  (-65, 6.11) : side_r,
  (-65, -128.89) : hem,
  (65, -128.89) : side_l,
  (65, 6.11) ~ (0.2, 0.35; 0.5, 0.2) : armhole_l,
  (55, 56.11) : shoulder_l,
  (25, 56.11) : neckline_l
], 1.0)
```

Each vertex describes the edge *leaving* it — the edge from that vertex to the next, with the last wrapping back to the first — so an edge can carry a curve, a name, or both:

- `~ (cx, cy)` — quadratic curve, one control point
- `~ (cx, cy; cx2, cy2)` — cubic curve, two control points
- `~ arc(radius, large_arc, sweep)` — circular arc
- `: name` — the edge's name, which is what `S(...)` and `F(...)` refer to

Control points are given in the edge's own frame: x runs along the edge from start to end, y runs perpendicular to it, both as fractions of the edge vector. This is the convention the Korosteleva and GarmentCode pattern datasets use, so their geometry transfers without reinterpretation.

Naming edges inside the outline is what makes a literal panel addressable. Without it a poly is only a shape; with it, `S(front.shoulder_l, back.shoulder_l, plain)` refers to specific segments of specific pieces, and the document can be turned back into a sewing pattern.

Because the outline is itself the measurement, `ease` carries no further information on a poly panel — write `1.0`.

> **Where this leaves the generative claim.** With `poly`, a GNL document can be sufficient to construct a garment without ambiguity, because the geometry is in the document. Without it — using `contour` and a region — the document is sufficient only relative to a body model and a drafting procedure, and GNL does not yet specify either normatively. The two levels are meant to coexist: `contour` says what a piece is *for*, `poly` says what it *is*.

> **v0.3 note**: `poly` is new in v0.3, along with absolute circumferences on `O(...)`. Both exist because converting real pattern datasets showed the language could describe a garment but not record one: panel geometry had to be thrown away at the door, and openings could only be stated as an ease over an unstated body. `converter/evaluate.js` measures what the notation now carries — 1060 edges and 398 stitches across 30 dataset templates survive the round trip through GNL and back.

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

Allows fabric to fall under gravity from anchor points (cowls, draped necklines).

```
DR(panel, anchor_points[])
```

The panel's `grain` parameter (set on `P`) determines the bias angle. `DR` specifies *where* fabric is anchored; grain determines *how* it falls.

```
DR(P_front, [@shoulder.L, @shoulder.R])   — draped front (combine with grain=bias on P)
DR(P_cowl, [@neck])                        — cowl neckline
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
| `P`    | Panel                | `P(%arm.L, contour, 1.1, bias)` |
| `O`    | Opening              | `O(@neck, V, depth=12cm)`       |
| `S`    | Seam                 | `S(P1.edge, P2.edge, french)`   |
| `D`    | Dart                 | `D(P, @bust.L, 10°, 8cm)`      |
| `G`    | Gather               | `G(P.top, 1.5)`                 |
| `PL`   | Pleat                | `PL(P.top, box, 3cm, 8, center)`|
| `F`    | Fold / Hem           | `F(P.bottom, 2cm, in)`          |
| `DR`   | Drape                | `DR(P, [@shoulder.L])`          |
| `ST`   | Stretch              | `ST(P, biaxial, 1.2)`           |
| `C`    | Closure              | `C(O, zip(invisible), center)`  |
| `M`    | Material             | `M(200gsm, fluid, none, ...)`   |
| `>>`   | Then (build order)   | `step >> step`                   |
| `SYM`  | Bilateral symmetry   | `GARMENT x [SYM] { ... }`       |
| `[]`   | Region subdivision   | `%arm[0..0.5]`                   |
| `USE`  | Instantiate component| `sleeve = USE(two_piece_sleeve)` |
| `ATTACH`| Attach component    | `ATTACH(sleeve, armhole)`        |
| `EDGE` | Shaped panel edge    | `EDGE(P.side, curve(@bust, 3cm))`|
| `LAYER`| Internal lining      | `LAYER lining { ... }`           |
| `poly` | Literal outline      | `poly[(0,0) : hem, (10,0) : side]`|
| `~`    | Edge curve (in poly) | `(10,0) ~ (0.5, 0.2) : armhole`  |

---

## 10. Composition

Components are reusable building blocks that can be composed into garments using `USE` and `ATTACH`.

### 10.1 Defining Components

```
COMPONENT two_piece_sleeve {
  top   = P(%arm[0..0.7], contour, 1.1)
  under = P(%arm[0..0.7], contour, 1.05)
  cuff  = O(@wrist, circle, body+4cm)

  BUILD:
    S(top.back, under.back, plain)
    >> S(top.front, under.front, plain)
    >> F(cuff, 3cm, in)
}
```

### 10.2 Using Components

Inside a `GARMENT`, instantiate a component with `USE`. Each instance gets a name that namespaces the component's panels:

```
sleeve = USE(two_piece_sleeve)
-- creates sleeve.top and sleeve.under
```

### 10.3 Attaching Components

`ATTACH` connects a component instance to the parent garment at a specific location:

```
ATTACH(sleeve, {front.armhole, back.armhole})
```

### 10.4 Full Composition Example

```
COMPONENT notched_lapel { ... }
COMPONENT two_piece_sleeve { ... }
COMPONENT welt_pocket { ... }

GARMENT blazer [SYM] {
  FABRIC: M(280gsm, crisp, none, 1.0, woven.twill)

  front = P(%torso.front + %leg[0..0.1], contour, 1.1)
  back  = P(%torso.back + %leg[0..0.1], contour, 1.08)
  side  = P(%torso.R[0..1], contour, 1.05)

  -- Compose components
  sleeve   = USE(two_piece_sleeve)
  collar   = USE(notched_lapel)
  pocket_L = USE(welt_pocket)

  BUILD:
    S(front.shoulder, back.shoulder, plain)
    >> S(front.side, side.front, plain)
    >> S(back.side, side.back, plain)
    >> ATTACH(sleeve, {front.armhole, back.armhole})
       [G(sleeve.top.cap, 1.12)]
    >> ATTACH(collar, neck_opening)
    >> ATTACH(pocket_L, front.pocket_mark.L)
    >> C(front_opening, button(2), center)
}
```

> **v0.2 note**: Composition via `USE`/`ATTACH` is new in v0.2. Components define their own internal build order, which runs before attachment. This allows a library of reusable components (sleeve types, collar types, pocket types) that can be mixed into different garments.

---

## 11. Lining (`LAYER`)

A lining is not a component (attached at one point) or a separate garment (worn over). It's a parallel structure that shares some edges with the shell and floats free at others. GNL handles this with `LAYER`.

```
LAYER(name, fabric) {
  panels...

  SHARE: [edges that are sewn to the shell]
  FREE: [edges that hang independently]

  BUILD: ...
}
```

### Example: Lined Jacket

```
GARMENT jacket [SYM] {
  FABRIC: M(280gsm, crisp, none, 1.0, woven.twill)

  front = P(%torso.front + %leg[0..0.1], contour, 1.1)
  back  = P(%torso.back + %leg[0..0.1], contour, 1.08)

  sleeve = USE(two_piece_sleeve)
  collar = USE(notched_lapel)

  LAYER lining {
    FABRIC: M(80gsm, liquid, none, 0.9, woven.satin)

    front = P(%torso.front + %leg[0..0.08], contour, 1.12)
    back  = P(%torso.back + %leg[0..0.08], contour, 1.1)
    sleeve = P(%arm[0..0.65], contour, 1.12)

    SHARE: front.facing, hem, armhole
    FREE: body, side

    BUILD:
      S(front.shoulder, back.shoulder, plain)
      >> S(front.side, back.side, plain)
      >> S(sleeve.cap, {front.armhole, back.armhole}, plain)
  }

  BUILD:
    ...shell assembly...
    >> ATTACH_LAYER(lining)
}
```

- `SHARE` edges are sewn to the corresponding shell edges — the lining is caught at facings, hems, and armholes
- `FREE` edges hang independently — the lining body floats inside the jacket
- The lining's own `BUILD` order runs first, then `ATTACH_LAYER` connects it to the shell

> This is distinct from `OVER(garment_a, garment_b)` in the extensions section, which describes separate garments worn together. `LAYER` is a structural part of a single garment.

---

## 12. Extensions (future)

- **Layering**: `OVER(garment_a, garment_b)` — describing how garments interact when worn together
- **Animation / Movement**: coupling with Labanotation to describe how garments behave in motion
- **Colorwork**: `COLOR(panel, pattern_type, palette)` — prints, stripes, colorblocking
- **Embellishment**: `EMB(panel, type, placement)` — embroidery, beading, appliqué
- **Degradation / Finishing**: `FINISH(garment, wash_type)` — stone-wash, distress, enzyme-wash
- **Normative body model**: measurements as a first-class part of the language, with a specified procedure for resolving region + ease + `contour` into an outline — the missing half of the generative claim (see §4.5)
- **Darts from geometry**: a converted V-notch currently arrives as two edges joined by a seam rather than as `D(...)`
- **Visual notation**: A graphical symbol system parallel to the textual syntax (as Labanotation has both verbal description and staff notation)

---

## 13. Comparison to Existing Systems

| System          | Classifies | Generates | Encodes construction | Formal grammar |
|-----------------|:----------:|:---------:|:-------------------:|:--------------:|
| HS Codes        | ✓          |           |                     |                |
| FashionPedia    | ✓          |           |                     |                |
| Sewing patterns | ✓          | ✓         | partial             |                |
| Knitting notation| ✓         | ✓         | ✓                   | ✓              |
| **GNL**         | ✓          | with `poly` | ✓                 | ✓              |

GNL's "generates" is qualified on purpose. A document using `poly` carries its own geometry and can be built from without further assumptions; a document using `contour` cannot, until the body model and drafting procedure in §4.5 are specified. Sewing patterns are marked "partial" on construction because they carry stitching but rarely an ordered build sequence; GNL's `>>` chain is an ordering, though converted files fill it with dataset order rather than a real sewing sequence.

---

*GNL v0.3 — A starting point. Like early Labanotation, this will need refinement through use, critique, and the input of garment-makers, pattern-drafters, and computational designers.*
