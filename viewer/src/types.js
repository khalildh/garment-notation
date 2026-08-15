// @ts-check

// ── Token ──────────────────────────────────────────────

/**
 * @typedef {'NUMBER'|'IDENT'|'LANDMARK'|'REGION'|'CHAIN'|'RANGE'|'DEGREE'
 *   |'ASSIGN'|'LPAREN'|'RPAREN'|'LBRACE'|'RBRACE'|'LBRACKET'|'RBRACKET'
 *   |'COMMA'|'COLON'|'PLUS'|'MINUS'|'STAR'|'PERCENT'|'DOT'|'EOF'} TokenType
 */

/**
 * @typedef {{ type: TokenType, value: string, line: number, col: number }} Token
 */

// ── AST Expressions ────────────────────────────────────

/**
 * @typedef {{ type: 'number', value: number, unit?: string }} NumberExpr
 * @typedef {{ type: 'landmark', value: string }} LandmarkExpr
 * @typedef {{ type: 'region', value: string, range: Expr | null }} RegionExpr
 * @typedef {{ type: 'reference', value: string }} ReferenceExpr
 * @typedef {{ type: 'call', name: string, args: Expr[] }} CallExpr
 * @typedef {{ type: 'binary', op: string, left: Expr, right: Expr }} BinaryExpr
 * @typedef {{ type: 'range', start: Expr, end: Expr }} RangeExpr
 * @typedef {{ type: 'modifier', base: Expr, value: Expr }} ModifierExpr
 * @typedef {{ type: 'set', elements: Expr[] }} SetExpr
 * @typedef {{ type: 'named_arg', name: string, value: Expr }} NamedArgExpr
 * @typedef {{ type: 'poly', vertices: PolyVertex[] }} PolyExpr
 */

/**
 * @typedef {NumberExpr | LandmarkExpr | RegionExpr | ReferenceExpr
 *   | CallExpr | BinaryExpr | RangeExpr | ModifierExpr
 *   | SetExpr | NamedArgExpr | PolyExpr} Expr
 */

// ── Literal outlines (poly) ────────────────────────────

/**
 * @typedef {{ x: number, y: number }} Point2
 * @typedef {{ type: 'quadratic' | 'cubic', control: Point2[] }} BezierCurve
 * @typedef {{ type: 'arc', radius: number, large_arc: number, sweep: number }} ArcCurve
 * @typedef {BezierCurve | ArcCurve} EdgeCurve
 */

/**
 * A poly vertex. `curve` and `edge` describe the edge *leaving* this vertex.
 * @typedef {{ x: number, y: number, curve: EdgeCurve | null, edge: string | null }} PolyVertex
 */

// ── AST Structures ─────────────────────────────────────

/**
 * @typedef {{ type: 'declaration', name: string, value: Expr }} Declaration
 */

/**
 * @typedef {{ type: 'build_step', operation: Expr, modifier: Expr | null }} BuildStep
 */

/**
 * @typedef {{
 *   type: 'layer',
 *   name: string,
 *   fabric: Expr | null,
 *   declarations: Declaration[],
 *   build: BuildStep[],
 *   share: Expr[],
 *   free: Expr[]
 * }} Layer
 */

/**
 * @typedef {{
 *   type: 'garment' | 'component',
 *   name: string,
 *   flags: string[],
 *   fabric: Expr | null,
 *   interlining: Expr | null,
 *   declarations: Declaration[],
 *   build: BuildStep[],
 *   edges: Expr[],
 *   layers: Layer[]
 * }} Block
 */

/**
 * @typedef {{ type: 'program', blocks: Block[] }} Program
 */

// ── Body / Region ──────────────────────────────────────

/**
 * @typedef {{ widthTop: number, widthBottom: number, height: number }} RegionDims
 */

// ── Renderer Panel ─────────────────────────────────────

/**
 * @typedef {{
 *   name: string,
 *   region: string,
 *   shape: string,
 *   ease: number,
 *   easeTop: number,
 *   easeBottom: number,
 *   grain: string,
 *   widthTop: number,
 *   widthBottom: number,
 *   height: number,
 *   darts: DartInfo[],
 *   edges: EdgeInfo[],
 *   isLining: boolean,
 *   layerName?: string,
 *   shapeParams: Expr | null,
 *   outline?: PolyVertex[] | null,
 *   seams?: PanelSeam[],
 *   w?: number,
 *   h?: number,
 *   x?: number,
 *   y?: number
 * }} Panel
 */

/**
 * @typedef {{ panel: string, location: Expr, angle: number, length: number }} DartInfo
 */

/**
 * @typedef {{ panel: string, edge: string, landmark: string, curvature: number }} EdgeInfo
 */

/**
 * @typedef {{ id: number, type: string, edge: string, partner: string, color: string }} PanelSeam
 */

export {};
