// @ts-check
/** @typedef {import('./types.js').Token} Token */
/** @typedef {import('./types.js').Expr} Expr */
/** @typedef {import('./types.js').Declaration} Declaration */
/** @typedef {import('./types.js').BuildStep} BuildStep */
/** @typedef {import('./types.js').Layer} Layer */
/** @typedef {import('./types.js').Block} Block */
/** @typedef {import('./types.js').Program} Program */

const UNITS = ['cm', 'mm', 'gsm', 'm', 'in'];

/**
 * Parse a token stream into a GNL AST.
 * @param {Token[]} tokens
 * @returns {Program}
 */
export function parse(tokens) {
  let pos = 0;

  /** @returns {Token} */
  function peek() { return tokens[pos]; }
  /** @returns {Token} */
  function advance() { return tokens[pos++]; }
  /**
   * @param {string} type
   * @param {string} [value]
   * @returns {boolean}
   */
  function check(type, value) {
    const t = peek();
    return t.type === type && (value === undefined || t.value === value);
  }
  /**
   * @param {string} type
   * @param {string} [value]
   * @returns {Token | null}
   */
  function match(type, value) {
    if (check(type, value)) return advance();
    return null;
  }
  /**
   * @param {string} type
   * @returns {Token}
   */
  function expect(type) {
    const t = advance();
    if (t.type !== type) {
      throw new Error(`Expected ${type} but got ${t.type} ('${t.value}') at line ${t.line}`);
    }
    return t;
  }

  /** @returns {Program} */
  function parseProgram() {
    /** @type {Block[]} */
    const blocks = [];
    while (!check('EOF')) {
      blocks.push(parseBlock());
    }
    return { type: 'program', blocks };
  }

  /** @returns {Block} */
  function parseBlock() {
    const kw = advance();
    if (kw.value !== 'GARMENT' && kw.value !== 'COMPONENT') {
      throw new Error(`Expected GARMENT or COMPONENT at line ${kw.line}, got '${kw.value}'`);
    }
    const name = expect('IDENT');
    /** @type {string[]} */
    let flags = [];
    if (match('LBRACKET')) {
      while (!check('RBRACKET')) {
        flags.push(expect('IDENT').value);
        match('COMMA');
      }
      expect('RBRACKET');
    }
    expect('LBRACE');
    const body = parseBody();
    expect('RBRACE');
    return /** @type {Block} */ ({ type: kw.value.toLowerCase(), name: name.value, flags, ...body });
  }

  function parseBody() {
    /** @type {Expr | null} */
    let fabric = null;
    /** @type {Expr | null} */
    let interlining = null;
    /** @type {Declaration[]} */
    const declarations = [];
    /** @type {BuildStep[]} */
    const build = [];
    /** @type {Expr[]} */
    const edges = [];
    /** @type {Layer[]} */
    const layers = [];

    while (!check('RBRACE') && !check('EOF')) {
      if (check('IDENT', 'FABRIC')) {
        advance(); expect('COLON');
        fabric = parseExpr();
      } else if (check('IDENT', 'INTERLINING')) {
        advance(); expect('COLON');
        interlining = parseExpr();
      } else if (check('IDENT', 'BUILD')) {
        advance(); expect('COLON');
        build.push(...parseBuildChain());
      } else if (check('IDENT', 'EDGE') && tokens[pos + 1]?.type === 'LPAREN') {
        // Standalone EDGE(...) call
        edges.push(parseExpr());
      } else if (check('IDENT', 'LAYER')) {
        layers.push(parseLayer());
      } else {
        declarations.push(parseDeclaration());
      }
    }
    return { fabric, interlining, declarations, build, edges, layers };
  }

  /** @returns {Layer} */
  function parseLayer() {
    advance(); // skip LAYER
    const name = expect('IDENT');
    expect('LBRACE');

    /** @type {Expr | null} */
    let fabric = null;
    /** @type {Declaration[]} */
    const declarations = [];
    /** @type {BuildStep[]} */
    const build = [];
    /** @type {Expr[]} */
    let share = [];
    /** @type {Expr[]} */
    let free = [];

    while (!check('RBRACE') && !check('EOF')) {
      if (check('IDENT', 'FABRIC')) {
        advance(); expect('COLON');
        fabric = parseExpr();
      } else if (check('IDENT', 'SHARE')) {
        advance(); expect('COLON');
        expect('LBRACKET');
        while (!check('RBRACKET') && !check('EOF')) {
          share.push(parseExpr());
          match('COMMA');
        }
        expect('RBRACKET');
      } else if (check('IDENT', 'FREE')) {
        advance(); expect('COLON');
        expect('LBRACKET');
        while (!check('RBRACKET') && !check('EOF')) {
          free.push(parseExpr());
          match('COMMA');
        }
        expect('RBRACKET');
      } else if (check('IDENT', 'BUILD')) {
        advance(); expect('COLON');
        build.push(...parseBuildChain());
      } else {
        declarations.push(parseDeclaration());
      }
    }
    expect('RBRACE');

    return { type: 'layer', name: name.value, fabric, declarations, build, share, free };
  }

  /** @returns {Declaration} */
  function parseDeclaration() {
    const name = expect('IDENT');
    expect('ASSIGN');
    const value = parseExpr();
    return { type: 'declaration', name: name.value, value };
  }

  /** @returns {BuildStep[]} */
  function parseBuildChain() {
    /** @type {BuildStep[]} */
    const steps = [];
    steps.push(parseBuildStep());
    while (match('CHAIN')) {
      steps.push(parseBuildStep());
    }
    return steps;
  }

  /** @returns {BuildStep} */
  function parseBuildStep() {
    const operation = parseExpr();
    /** @type {Expr | null} */
    let modifier = null;
    if (match('LBRACKET')) {
      modifier = parseExpr();
      expect('RBRACKET');
    }
    return { type: 'build_step', operation, modifier };
  }

  /** @returns {Expr} */
  function parseExpr() {
    let left = parseAtom();
    while (true) {
      if (match('PLUS')) {
        left = { type: 'binary', op: '+', left, right: parseAtom() };
      } else if (match('MINUS')) {
        left = { type: 'binary', op: '-', left, right: parseAtom() };
      } else if (match('STAR')) {
        left = { type: 'binary', op: '*', left, right: parseAtom() };
      } else if (match('RANGE')) {
        left = { type: 'range', start: left, end: parseAtom() };
      } else if (match('COLON')) {
        left = { type: 'modifier', base: left, value: parseAtom() };
      } else {
        break;
      }
    }
    return left;
  }

  /** @returns {Expr} */
  function parseAtom() {
    const tok = peek();

    // Unary minus
    if (tok.type === 'MINUS') {
      advance();
      const inner = parseAtom();
      if (inner.type === 'number') {
        return { ...inner, value: -inner.value };
      }
      return { type: 'binary', op: '*', left: { type: 'number', value: -1 }, right: inner };
    }

    if (tok.type === 'NUMBER') {
      advance();
      const num = parseFloat(tok.value);
      if (check('IDENT')) {
        const next = peek().value;
        if (UNITS.includes(next)) {
          advance();
          return { type: 'number', value: num, unit: next };
        } else {
          // juxtaposition: 0.5W means 0.5 * W
          const ident = advance();
          let ref = ident.value;
          while (match('DOT')) { ref += '.' + expect('IDENT').value; }
          return { type: 'binary', op: '*', left: { type: 'number', value: num }, right: { type: 'reference', value: ref } };
        }
      }
      if (match('DEGREE')) return { type: 'number', value: num, unit: 'deg' };
      if (match('PERCENT')) return { type: 'number', value: num, unit: '%' };
      return { type: 'number', value: num };
    }

    if (tok.type === 'LANDMARK') {
      advance();
      return { type: 'landmark', value: tok.value };
    }

    if (tok.type === 'REGION') {
      advance();
      /** @type {Expr | null} */
      let range = null;
      if (match('LBRACKET')) {
        range = parseExpr();
        expect('RBRACKET');
      }
      return { type: 'region', value: tok.value, range };
    }

    if (tok.type === 'LBRACE') {
      advance();
      /** @type {Expr[]} */
      const elements = [];
      while (!check('RBRACE')) {
        elements.push(parseExpr());
        match('COMMA');
      }
      expect('RBRACE');
      return { type: 'set', elements };
    }

    if (tok.type === 'LPAREN') {
      advance();
      const expr = parseExpr();
      expect('RPAREN');
      return expr;
    }

    if (tok.type === 'IDENT') {
      advance();
      let ref = tok.value;

      // member access chain
      while (check('DOT')) {
        advance();
        ref += '.' + expect('IDENT').value;
      }

      // function call
      if (match('LPAREN')) {
        const args = parseArgList();
        expect('RPAREN');
        return { type: 'call', name: ref, args };
      }

      return { type: 'reference', value: ref };
    }

    throw new Error(`Unexpected token ${tok.type} ('${tok.value}') at line ${tok.line}`);
  }

  /** @returns {Expr[]} */
  function parseArgList() {
    /** @type {Expr[]} */
    const args = [];
    while (!check('RPAREN') && !check('EOF')) {
      // named arg: ident = expr
      if (check('IDENT') && tokens[pos + 1]?.type === 'ASSIGN') {
        const name = advance().value;
        advance(); // skip =
        args.push({ type: 'named_arg', name, value: parseExpr() });
      } else {
        args.push(parseExpr());
      }
      match('COMMA');
    }
    return args;
  }

  return parseProgram();
}
