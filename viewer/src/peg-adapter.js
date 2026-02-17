// @ts-check
/** @typedef {import('./types.js').Expr} Expr */
/** @typedef {import('./types.js').Declaration} Declaration */
/** @typedef {import('./types.js').BuildStep} BuildStep */
/** @typedef {import('./types.js').Layer} Layer */
/** @typedef {import('./types.js').Block} Block */
/** @typedef {import('./types.js').Program} Program */

/**
 * Transform a PEG parser AST into the legacy AST shape
 * expected by renderer.js and assembler.js.
 *
 * @param {any[]} pegAst - Array of garment/component objects from the PEG parser
 * @returns {Program}
 */
export function pegAstToLegacy(pegAst) {
  /** @type {Block[]} */
  const blocks = pegAst.map(convertBlock);
  return { type: 'program', blocks };
}

// ---------------------------------------------------------------------------
// Block conversion
// ---------------------------------------------------------------------------

/**
 * @param {any} node - A garment or component declaration from PEG AST
 * @returns {Block}
 */
function convertBlock(node) {
  const fabric = convertFabric(node.fabric);
  const interlining = convertInterlining(node.statements);

  /** @type {Declaration[]} */
  const declarations = [];
  /** @type {BuildStep[]} */
  const build = [];
  /** @type {Expr[]} */
  const edges = [];
  /** @type {Layer[]} */
  const layers = [];

  for (const stmt of node.statements || []) {
    switch (stmt.type) {
      case 'panel_assignment':
        declarations.push({
          type: 'declaration',
          name: stmt.name,
          value: convertPanel(stmt.panel),
        });
        break;

      case 'opening_assignment':
        declarations.push({
          type: 'declaration',
          name: stmt.name,
          value: convertOpening(stmt.opening),
        });
        break;

      case 'component_use':
        declarations.push({
          type: 'declaration',
          name: stmt.name,
          value: /** @type {Expr} */ ({
            type: 'call',
            name: 'USE',
            args: [{ type: 'reference', value: stmt.component }],
          }),
        });
        break;

      case 'landmark_assignment':
        declarations.push({
          type: 'declaration',
          name: stmt.name,
          value: convertLandmarkExpr(stmt.expr),
        });
        break;

      case 'line_assignment':
        declarations.push({
          type: 'declaration',
          name: stmt.name,
          value: /** @type {Expr} */ ({
            type: 'call',
            name: 'LINE',
            args: [convertAnyRef(stmt.from), convertAnyRef(stmt.to)],
          }),
        });
        break;

      case 'edge_decl':
        edges.push(convertEdgeDecl(stmt));
        break;

      case 'build_block':
        build.push(...convertBuildBlock(stmt));
        break;

      case 'layer_block':
        layers.push(convertLayer(stmt));
        break;

      case 'interlining_decl':
        // Handled separately via convertInterlining
        break;

      case 'comment':
        // Comments are not represented in legacy AST
        break;
    }
  }

  return /** @type {Block} */ ({
    type: node.type === 'garment' ? 'garment' : 'component',
    name: node.name,
    flags: node.flags || [],
    fabric,
    interlining,
    declarations,
    build,
    edges,
    layers,
  });
}

// ---------------------------------------------------------------------------
// Fabric / Interlining
// ---------------------------------------------------------------------------

/**
 * PEG: fabric is an array of fabric_decl objects.
 * Legacy: block.fabric is a single Expr (M(...) call) or null.
 * @param {any[]} fabricArr
 * @returns {Expr | null}
 */
function convertFabric(fabricArr) {
  if (!fabricArr || fabricArr.length === 0) return null;
  // Use the first fabric declaration
  return convertMaterial(fabricArr[0].material);
}

/**
 * Find interlining_decl in statements array.
 * @param {any[]} statements
 * @returns {Expr | null}
 */
function convertInterlining(statements) {
  if (!statements) return null;
  const decl = statements.find(s => s.type === 'interlining_decl');
  if (!decl) return null;
  return convertMaterial(decl.material);
}

// ---------------------------------------------------------------------------
// Panel: P(region, shape, ease, grain?)
// ---------------------------------------------------------------------------

/**
 * @param {any} panel - PEG panel node
 * @returns {Expr}
 */
function convertPanel(panel) {
  const args = [
    convertRegionExpr(panel.region),
    convertShape(panel.shape),
    convertEase(panel.ease),
  ];

  // Add grain if not default
  if (panel.grain && panel.grain !== 'warp') {
    args.push(convertGrain(panel.grain));
  }

  return /** @type {Expr} */ ({ type: 'call', name: 'P', args });
}

// ---------------------------------------------------------------------------
// Region expressions
// ---------------------------------------------------------------------------

/**
 * PEG: { type: "region", name: "torso", subpath: ["front"], range: null|{start,end} }
 * Legacy: { type: "region", value: "%torso.front", range: null|rangeExpr }
 *
 * PEG: { type: "region_union", regions: [...] }
 * Legacy: { type: "binary", op: "+", left, right }
 *
 * @param {any} expr
 * @returns {Expr}
 */
function convertRegionExpr(expr) {
  if (!expr) return { type: 'region', value: '%unknown', range: null };

  if (expr.type === 'region') {
    return convertRegion(expr);
  }

  if (expr.type === 'region_union') {
    // Fold regions into nested binary + expressions
    const converted = expr.regions.map(r => convertRegion(r));
    return converted.reduce((left, right) =>
      /** @type {Expr} */ ({ type: 'binary', op: '+', left, right })
    );
  }

  return convertAnyRef(expr);
}

/**
 * @param {any} region - PEG region node
 * @returns {Expr}
 */
function convertRegion(region) {
  // Build the %name.sub1.sub2 string
  let value = '%' + region.name;
  if (region.subpath && region.subpath.length > 0) {
    value += '.' + region.subpath.join('.');
  }

  /** @type {Expr | null} */
  let range = null;
  if (region.range) {
    range = /** @type {Expr} */ ({
      type: 'range',
      start: { type: 'number', value: region.range.start },
      end: { type: 'number', value: region.range.end },
    });
  }

  return /** @type {Expr} */ ({ type: 'region', value, range });
}

// ---------------------------------------------------------------------------
// Landmark expressions
// ---------------------------------------------------------------------------

/**
 * PEG: { type: "landmark", name: "bust", side: "L"|"R"|null, offset: null|{type,value} }
 * Legacy: { type: "landmark", value: "@bust.L" }
 *
 * @param {any} lm
 * @returns {Expr}
 */
function convertLandmark(lm) {
  let value = '@' + lm.name;
  if (lm.side) {
    value += '.' + lm.side;
  }
  return /** @type {Expr} */ ({ type: 'landmark', value });
}

/**
 * Convert a PEG landmark expression (landmark or landmark_offset).
 * @param {any} expr
 * @returns {Expr}
 */
function convertLandmarkExpr(expr) {
  if (expr.type === 'landmark') {
    return convertLandmark(expr);
  }
  if (expr.type === 'landmark_offset') {
    const base = convertLandmark(expr.base);
    const offset = convertMeasurement(expr.offset);
    return /** @type {Expr} */ ({
      type: 'binary',
      op: expr.op,
      left: base,
      right: offset,
    });
  }
  return convertAnyRef(expr);
}

// ---------------------------------------------------------------------------
// Shape expressions
// ---------------------------------------------------------------------------

/**
 * PEG: { shape: "contour", width: null } or { shape: "rect" } or { shape: "trapezoid", waist: ..., hem: ... }
 * or { shape: "rect", width: ..., height: ... } (from RectDims)
 * Legacy: { type: "reference", value: "contour" } or { type: "call", name: "rect", args: [...] }
 *
 * @param {any} shape
 * @returns {Expr}
 */
function convertShape(shape) {
  if (!shape) return { type: 'reference', value: 'rect' };

  const name = shape.shape;

  // contour with optional width param
  if (name === 'contour') {
    if (shape.width) {
      return /** @type {Expr} */ ({
        type: 'call',
        name: 'contour',
        args: [{ type: 'named_arg', name: 'width', value: convertDimExpr(shape.width) }],
      });
    }
    return { type: 'reference', value: 'contour' };
  }

  // rect with named params (from RectDims: width, height, length)
  if (name === 'rect') {
    const namedArgs = [];
    if (shape.width) namedArgs.push({ type: 'named_arg', name: 'width', value: convertDimExpr(shape.width) });
    if (shape.height) namedArgs.push({ type: 'named_arg', name: 'height', value: convertDimExpr(shape.height) });
    if (shape.length) namedArgs.push({ type: 'named_arg', name: 'length', value: convertDimExpr(shape.length) });

    if (namedArgs.length > 0) {
      return /** @type {Expr} */ ({ type: 'call', name: 'rect', args: namedArgs });
    }
    return { type: 'reference', value: 'rect' };
  }

  // trapezoid with optional waist/hem params
  if (name === 'trapezoid') {
    const namedArgs = [];
    if (shape.waist) namedArgs.push({ type: 'named_arg', name: 'waist', value: convertDimExpr(shape.waist) });
    if (shape.hem) namedArgs.push({ type: 'named_arg', name: 'hem', value: convertDimExpr(shape.hem) });

    if (namedArgs.length > 0) {
      return /** @type {Expr} */ ({ type: 'call', name: 'trapezoid', args: namedArgs });
    }
    return { type: 'reference', value: 'trapezoid' };
  }

  // circle or other simple shapes
  return { type: 'reference', value: name };
}

// ---------------------------------------------------------------------------
// Ease expressions
// ---------------------------------------------------------------------------

/**
 * PEG: { type: "uniform_ease", value: 1.15 }
 * Legacy: { type: "number", value: 1.15 }
 *
 * PEG: { type: "graduated_ease", top: 1.0, bottom: 2.0 }
 * Legacy: { type: "call", name: "ease", args: [{type:"number",value:1.0},{type:"number",value:2.0}] }
 *
 * @param {any} ease
 * @returns {Expr}
 */
function convertEase(ease) {
  if (!ease) return { type: 'number', value: 1.0 };

  if (ease.type === 'uniform_ease') {
    return { type: 'number', value: ease.value };
  }

  if (ease.type === 'graduated_ease') {
    return /** @type {Expr} */ ({
      type: 'call',
      name: 'ease',
      args: [
        { type: 'number', value: ease.top },
        { type: 'number', value: ease.bottom },
      ],
    });
  }

  // Fallback: if it's already a number
  if (typeof ease === 'number') return { type: 'number', value: ease };

  return { type: 'number', value: 1.0 };
}

// ---------------------------------------------------------------------------
// Grain
// ---------------------------------------------------------------------------

/**
 * @param {any} grain
 * @returns {Expr}
 */
function convertGrain(grain) {
  if (typeof grain === 'string') {
    return { type: 'reference', value: grain };
  }
  // { type: "angle", degrees: 45 }
  if (grain && grain.type === 'angle') {
    return { type: 'number', value: grain.degrees, unit: 'deg' };
  }
  return { type: 'reference', value: 'warp' };
}

// ---------------------------------------------------------------------------
// Dimensional expressions
// ---------------------------------------------------------------------------

/**
 * PEG body_relative: { type: "body_relative", coefficient: 0.5, ref: "waist_circumference" }
 * Legacy: { type: "binary", op: "*", left: {type:"number",value:0.5}, right: {type:"reference",value:"W"} }
 *
 * PEG measurement: { value: 2, unit: "cm" }
 * Legacy: { type: "number", value: 2, unit: "cm" }
 *
 * @param {any} dim
 * @returns {Expr}
 */
function convertDimExpr(dim) {
  if (!dim) return { type: 'number', value: 0 };

  if (dim.type === 'body_relative') {
    const refMap = {
      waist_circumference: 'W',
      hip_circumference: 'H',
      neck_circumference: 'neck_circ',
      bust_circumference: 'bust_circ',
    };
    const refName = refMap[dim.ref] || dim.ref;

    if (dim.coefficient === 1) {
      return { type: 'reference', value: refName };
    }
    return /** @type {Expr} */ ({
      type: 'binary',
      op: '*',
      left: { type: 'number', value: dim.coefficient },
      right: { type: 'reference', value: refName },
    });
  }

  // Measurement { value, unit }
  if (dim.value !== undefined && dim.unit) {
    return { type: 'number', value: dim.value, unit: dim.unit };
  }

  // Plain number
  if (typeof dim === 'number') {
    return { type: 'number', value: dim };
  }

  return { type: 'number', value: dim.value ?? 0 };
}

// ---------------------------------------------------------------------------
// Measurement
// ---------------------------------------------------------------------------

/**
 * @param {any} m - { value, unit }
 * @returns {Expr}
 */
function convertMeasurement(m) {
  if (!m) return { type: 'number', value: 0 };
  if (m.value !== undefined && m.unit) {
    return { type: 'number', value: m.value, unit: m.unit };
  }
  if (typeof m === 'number') return { type: 'number', value: m };
  return { type: 'number', value: m.value ?? 0 };
}

// ---------------------------------------------------------------------------
// Opening: O(location, shape, ...params)
// ---------------------------------------------------------------------------

/**
 * PEG: { type: "opening", location, shape, circumference?, depth?, span? }
 * Legacy: { type: "call", name: "O", args: [locationExpr, shapeRef, ...params] }
 *
 * @param {any} opening
 * @returns {Expr}
 */
function convertOpening(opening) {
  const args = [
    convertLocationExpr(opening.location),
    /** @type {Expr} */ ({ type: 'reference', value: opening.shape }),
  ];

  if (opening.circumference) {
    const circ = opening.circumference;
    if (circ.base === 'body' && circ.ease) {
      args.push(/** @type {Expr} */ ({
        type: 'binary',
        op: '+',
        left: { type: 'reference', value: 'body' },
        right: convertMeasurement(circ.ease),
      }));
    }
  }

  if (opening.depth) {
    args.push(/** @type {Expr} */ ({
      type: 'named_arg',
      name: 'depth',
      value: convertMeasurement(opening.depth),
    }));
  }

  if (opening.span) {
    args.push(/** @type {Expr} */ ({
      type: 'range',
      start: convertQualifiedRef(opening.span.from),
      end: convertQualifiedRef(opening.span.to),
    }));
  }

  return /** @type {Expr} */ ({ type: 'call', name: 'O', args });
}

// ---------------------------------------------------------------------------
// Location expression (landmark or region)
// ---------------------------------------------------------------------------

/**
 * @param {any} loc
 * @returns {Expr}
 */
function convertLocationExpr(loc) {
  if (!loc) return { type: 'reference', value: 'unknown' };
  if (loc.type === 'landmark') return convertLandmark(loc);
  if (loc.type === 'region') return convertRegion(loc);
  return convertAnyRef(loc);
}

// ---------------------------------------------------------------------------
// Edge declarations
// ---------------------------------------------------------------------------

/**
 * PEG: { type: "edge_decl", edge: qualifiedRef, curve: curveExpr }
 * Legacy: { type: "call", name: "EDGE", args: [qualifiedRef, curveCall] }
 *
 * @param {any} stmt
 * @returns {Expr}
 */
function convertEdgeDecl(stmt) {
  return /** @type {Expr} */ ({
    type: 'call',
    name: 'EDGE',
    args: [
      convertQualifiedRef(stmt.edge),
      convertCurveExpr(stmt.curve),
    ],
  });
}

/**
 * PEG: { type: "curve", landmark, curvature: { value, unit } }
 * Legacy: { type: "call", name: "curve", args: [landmarkExpr, measurementExpr] }
 *
 * @param {any} curve
 * @returns {Expr}
 */
function convertCurveExpr(curve) {
  return /** @type {Expr} */ ({
    type: 'call',
    name: 'curve',
    args: [
      convertLandmark(curve.landmark),
      convertMeasurement(curve.curvature),
    ],
  });
}

// ---------------------------------------------------------------------------
// Build block → flat BuildStep[]
// ---------------------------------------------------------------------------

/**
 * PEG: { type: "build_block", steps: [{ ...op, modifiers?: [...] }] }
 * Legacy: flat array of { type: "build_step", operation: Expr, modifier: Expr|null }
 *
 * @param {any} block
 * @returns {BuildStep[]}
 */
function convertBuildBlock(block) {
  return block.steps
    .filter(step => step.type !== 'comment')
    .map(step => {
      const modifiers = step.modifiers || [];
      /** @type {Expr | null} */
      let modifier = null;
      if (modifiers.length === 1) {
        modifier = convertBuildOp(modifiers[0]);
      } else if (modifiers.length > 1) {
        // Multiple modifiers: use the first (legacy format only supports one)
        modifier = convertBuildOp(modifiers[0]);
      }

      return /** @type {BuildStep} */ ({
        type: 'build_step',
        operation: convertBuildOp(step),
        modifier,
      });
    });
}

/**
 * Convert a PEG build operation to a legacy call expression.
 * @param {any} op
 * @returns {Expr}
 */
function convertBuildOp(op) {
  switch (op.type) {
    case 'seam':
      return /** @type {Expr} */ ({
        type: 'call',
        name: 'S',
        args: [
          convertEdgeRef(op.edge_a),
          convertEdgeRef(op.edge_b),
          { type: 'reference', value: op.seam_type },
        ],
      });

    case 'dart':
      return /** @type {Expr} */ ({
        type: 'call',
        name: 'D',
        args: [
          convertAnyRef(op.panel),
          convertLandmark(op.location),
          { type: 'number', value: op.angle, unit: 'deg' },
          convertMeasurement(op.length),
        ],
      });

    case 'gather':
      return /** @type {Expr} */ ({
        type: 'call',
        name: 'G',
        args: [
          convertEdgeRef(op.edge),
          { type: 'number', value: op.ratio },
        ],
      });

    case 'pleat':
      return /** @type {Expr} */ ({
        type: 'call',
        name: 'PL',
        args: [
          convertEdgeRef(op.edge),
          { type: 'reference', value: op.pleat_type },
          convertMeasurement(op.width),
          { type: 'number', value: op.count },
          { type: 'reference', value: op.direction },
        ],
      });

    case 'fold':
      return /** @type {Expr} */ ({
        type: 'call',
        name: 'F',
        args: [
          convertEdgeRef(op.target),
          convertFoldWidth(op.width),
          { type: 'reference', value: op.direction },
        ],
      });

    case 'drape':
      return /** @type {Expr} */ ({
        type: 'call',
        name: 'DR',
        args: [
          convertAnyRef(op.panel),
          /** @type {Expr} */ ({
            type: 'set',
            elements: op.anchors.map(a => convertLandmark(a)),
          }),
        ],
      });

    case 'stretch':
      return /** @type {Expr} */ ({
        type: 'call',
        name: 'ST',
        args: [
          convertAnyRef(op.panel),
          { type: 'reference', value: op.axis },
          { type: 'number', value: op.ratio },
        ],
      });

    case 'fuse':
      return /** @type {Expr} */ ({
        type: 'call',
        name: 'FUSE',
        args: [
          convertAnyRef(op.panel),
          { type: 'reference', value: op.material },
        ],
      });

    case 'closure':
      return /** @type {Expr} */ ({
        type: 'call',
        name: 'C',
        args: [
          convertAnyRef(op.opening),
          convertClosureType(op.closure_type),
          { type: 'reference', value: op.position },
        ],
      });

    case 'attach':
      return /** @type {Expr} */ ({
        type: 'call',
        name: 'ATTACH',
        args: [
          convertAnyRef(op.component),
          convertEdgeRef(op.target),
        ],
      });

    case 'attach_layer':
      return /** @type {Expr} */ ({
        type: 'call',
        name: 'ATTACH_LAYER',
        args: [
          { type: 'reference', value: op.layer },
        ],
      });

    default:
      return { type: 'reference', value: String(op.type) };
  }
}

// ---------------------------------------------------------------------------
// Closure type
// ---------------------------------------------------------------------------

/**
 * PEG: { type: "button", count: 7 } or { type: "zip", zip_type: "invisible" } etc.
 * Legacy: { type: "call", name: "button", args: [{type:"number",value:7}] }
 *
 * @param {any} ct
 * @returns {Expr}
 */
function convertClosureType(ct) {
  switch (ct.type) {
    case 'button':
      return /** @type {Expr} */ ({
        type: 'call',
        name: 'button',
        args: [{ type: 'number', value: ct.count }],
      });

    case 'zip':
      return /** @type {Expr} */ ({
        type: 'call',
        name: 'zip',
        args: [{ type: 'reference', value: ct.zip_type }],
      });

    case 'snap':
      return /** @type {Expr} */ ({
        type: 'call',
        name: 'snap',
        args: [{ type: 'number', value: ct.count }],
      });

    case 'toggle':
      return /** @type {Expr} */ ({
        type: 'call',
        name: 'toggle',
        args: [{ type: 'number', value: ct.count }],
      });

    // Simple closures with no args
    case 'hook':
    case 'tie':
    case 'velcro':
    case 'lace':
    case 'wrap':
    case 'pin':
      return { type: 'reference', value: ct.type };

    default:
      return { type: 'reference', value: String(ct.type) };
  }
}

// ---------------------------------------------------------------------------
// Material: M(weight, drape, stretch, opacity, texture)
// ---------------------------------------------------------------------------

/**
 * PEG: { type: "material", weight, drape, stretch, opacity, texture }
 * Legacy: { type: "call", name: "M", args: [...] }
 *
 * @param {any} mat
 * @returns {Expr}
 */
function convertMaterial(mat) {
  if (!mat) return /** @type {Expr} */ ({ type: 'call', name: 'M', args: [] });

  const args = [
    convertWeightExpr(mat.weight),
    /** @type {Expr} */ ({ type: 'reference', value: mat.drape }),
    convertStretchExpr(mat.stretch),
    /** @type {Expr} */ ({ type: 'number', value: mat.opacity }),
    convertTextureExpr(mat.texture),
  ];

  return /** @type {Expr} */ ({ type: 'call', name: 'M', args });
}

/**
 * @param {any} weight - integer "gsm" object or string keyword
 * @returns {Expr}
 */
function convertWeightExpr(weight) {
  if (typeof weight === 'string') {
    return { type: 'reference', value: weight };
  }
  // { type: "gsm", value: 200 }
  if (weight && weight.type === 'gsm') {
    return { type: 'number', value: weight.value, unit: 'gsm' };
  }
  return { type: 'reference', value: String(weight) };
}

/**
 * PEG: { axis: "biaxial", percentage: 15 } or { axis: "none" } or { axis: "biaxial" }
 * Legacy: { type: "modifier", base: {type:"reference",value:"biaxial"}, value: {type:"number",value:15,unit:"%"} }
 * or { type: "reference", value: "none" }
 *
 * @param {any} stretch
 * @returns {Expr}
 */
function convertStretchExpr(stretch) {
  if (!stretch) return { type: 'reference', value: 'none' };

  if (stretch.axis === 'none') {
    return { type: 'reference', value: 'none' };
  }

  if (stretch.percentage !== undefined) {
    return /** @type {Expr} */ ({
      type: 'modifier',
      base: { type: 'reference', value: stretch.axis },
      value: { type: 'number', value: stretch.percentage, unit: '%' },
    });
  }

  return { type: 'reference', value: stretch.axis };
}

/**
 * @param {any} texture - string like "woven.twill" or "knit"
 * @returns {Expr}
 */
function convertTextureExpr(texture) {
  if (!texture) return { type: 'reference', value: 'unknown' };
  return { type: 'reference', value: texture };
}

// ---------------------------------------------------------------------------
// Layer block
// ---------------------------------------------------------------------------

/**
 * PEG: { type: "layer_block", name, fabric, share, free, statements }
 * Legacy: { type: "layer", name, fabric, declarations, build, share, free }
 *
 * @param {any} layerNode
 * @returns {Layer}
 */
function convertLayer(layerNode) {
  /** @type {Declaration[]} */
  const declarations = [];
  /** @type {BuildStep[]} */
  const build = [];

  for (const stmt of layerNode.statements || []) {
    switch (stmt.type) {
      case 'panel_assignment':
        declarations.push({
          type: 'declaration',
          name: stmt.name,
          value: convertPanel(stmt.panel),
        });
        break;

      case 'build_block':
        build.push(...convertBuildBlock(stmt));
        break;

      case 'comment':
        break;
    }
  }

  // Layer fabric: single fabric_decl or null
  const fabric = layerNode.fabric
    ? convertMaterial(layerNode.fabric.material)
    : null;

  // share/free: arrays of qualified refs
  const share = (layerNode.share || []).map(ref => convertQualifiedRef(ref));
  const free = (layerNode.free || []).map(ref => convertQualifiedRef(ref));

  return {
    type: 'layer',
    name: layerNode.name,
    fabric,
    declarations,
    build,
    share,
    free,
  };
}

// ---------------------------------------------------------------------------
// Reference conversions
// ---------------------------------------------------------------------------

/**
 * PEG qualified_ref: string (single) or { type: "qualified_ref", parts: [...] }
 * Legacy: { type: "reference", value: "front.shoulder" }
 *
 * @param {any} ref
 * @returns {Expr}
 */
function convertQualifiedRef(ref) {
  if (typeof ref === 'string') {
    return { type: 'reference', value: ref };
  }
  if (ref && ref.type === 'qualified_ref') {
    return { type: 'reference', value: ref.parts.join('.') };
  }
  return convertAnyRef(ref);
}

/**
 * Convert any ref (landmark, region, or qualified identifier).
 * @param {any} ref
 * @returns {Expr}
 */
function convertAnyRef(ref) {
  if (!ref) return { type: 'reference', value: '' };
  if (typeof ref === 'string') return { type: 'reference', value: ref };

  switch (ref.type) {
    case 'landmark':
      return convertLandmark(ref);
    case 'region':
      return convertRegion(ref);
    case 'qualified_ref':
      return { type: 'reference', value: ref.parts.join('.') };
    default:
      return { type: 'reference', value: String(ref.name || ref.value || ref) };
  }
}

/**
 * Convert an edge ref (qualified ref, landmark, or edge_set).
 * @param {any} ref
 * @returns {Expr}
 */
function convertEdgeRef(ref) {
  if (!ref) return { type: 'reference', value: '' };

  if (ref.type === 'edge_set') {
    return /** @type {Expr} */ ({
      type: 'set',
      elements: ref.edges.map(e => convertAnyRef(e)),
    });
  }

  return convertAnyRef(ref);
}

/**
 * Convert a fold width expression (measurement or range).
 * @param {any} width
 * @returns {Expr}
 */
function convertFoldWidth(width) {
  if (!width) return { type: 'number', value: 0 };

  if (width.type === 'range') {
    return /** @type {Expr} */ ({
      type: 'range',
      start: convertAnyRef(width.from),
      end: convertAnyRef(width.to),
    });
  }

  return convertMeasurement(width);
}
