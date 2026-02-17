// @ts-check
/** @typedef {import('./types.js').Token} Token */
/** @typedef {import('./types.js').TokenType} TokenType */

/** @type {[TokenType | null, RegExp][]} */
const PATTERNS = [
  [null, /^[ \t\r]+/],
  [null, /^--[^\n]*/],
  [null, /^\n/],
  ['CHAIN', /^>>/],
  ['RANGE', /^\.\./],
  ['NUMBER', /^\d+(\.\d+)?/],
  ['DEGREE', /^°/],
  ['LANDMARK', /^@[a-zA-Z_]\w*(\.[a-zA-Z_]\w*)*/],
  ['REGION', /^%[a-zA-Z_]\w*(\.[a-zA-Z_]\w*)*/],
  ['IDENT', /^[a-zA-Z_]\w*/],
  ['ASSIGN', /^=/],
  ['LPAREN', /^\(/],
  ['RPAREN', /^\)/],
  ['LBRACE', /^\{/],
  ['RBRACE', /^\}/],
  ['LBRACKET', /^\[/],
  ['RBRACKET', /^\]/],
  ['COMMA', /^,/],
  ['COLON', /^:/],
  ['PLUS', /^\+/],
  ['MINUS', /^-/],
  ['STAR', /^\*/],
  ['PERCENT', /^%/],
  ['DOT', /^\./],
];

/**
 * Tokenize GNL source into a stream of tokens.
 * @param {string} source
 * @returns {Token[]}
 */
export function tokenize(source) {
  /** @type {Token[]} */
  const tokens = [];
  let pos = 0, line = 1, col = 1;

  while (pos < source.length) {
    let matched = false;
    for (const [type, regex] of PATTERNS) {
      const m = regex.exec(source.slice(pos));
      if (m) {
        if (type) tokens.push({ type, value: m[0], line, col });
        for (const ch of m[0]) {
          if (ch === '\n') { line++; col = 1; } else { col++; }
        }
        pos += m[0].length;
        matched = true;
        break;
      }
    }
    if (!matched) {
      throw new Error(`Unexpected character '${source[pos]}' at line ${line}, col ${col}`);
    }
  }

  tokens.push({ type: 'EOF', value: '', line, col });
  return tokens;
}
