import type { ASTNode, ParseResult } from './types';

/**
 * Parser de formules avec support des opérateurs, fonctions et références
 * Grammaire simplifié utilise:
 * Expression := Term (('+' | '-') Term)*
 * Term := Factor (('*' | '/') Factor)*
 * Factor := Power ('^' Power)*
 * Power := Unary | Primary
 * Unary := ('-' | '+') Unary | Primary
 * Primary := Number | String | Boolean | Reference | Function | '(' Expression ')'
 */

class FormulaParser {
  private input: string = '';
  private pos: number = 0;
  private currentChar: string | null = null;

  parse(expression: string): ParseResult {
    try {
      this.input = expression.trim();
      this.pos = 0;
      this.currentChar = this.input.length > 0 ? this.input[0] : null;

      if (!this.currentChar) {
        return { success: false, error: 'Expression vide' };
      }

      const ast = this.parseExpression();

      // Vérifier qu'on a tout consommé
      this.skipWhitespace();
      if (this.currentChar !== null) {
        return { success: false, error: `Caractère inattendu: ${this.currentChar}` };
      }

      return { success: true, ast };
    } catch (error: any) {
      return { success: false, error: error.message || 'Erreur de parsing' };
    }
  }

  private advance(): void {
    this.pos++;
    this.currentChar = this.pos < this.input.length ? this.input[this.pos] : null;
  }

  private peek(offset: number = 1): string | null {
    const peekPos = this.pos + offset;
    return peekPos < this.input.length ? this.input[peekPos] : null;
  }

  private skipWhitespace(): void {
    while (this.currentChar && /\s/.test(this.currentChar)) {
      this.advance();
    }
  }

  private parseExpression(): ASTNode {
    let node = this.parseTerm();

    this.skipWhitespace();
    while (this.currentChar === '+' || this.currentChar === '-') {
      const op = this.currentChar;
      this.advance();
      this.skipWhitespace();
      const right = this.parseTerm();
      this.skipWhitespace();
      node = { type: 'binary', operator: op, left: node, right };
    }

    return node;
  }

  private parseTerm(): ASTNode {
    let node = this.parseFactor();

    this.skipWhitespace();
    while (this.currentChar === '*' || this.currentChar === '/') {
      const op = this.currentChar;
      this.advance();
      this.skipWhitespace();
      const right = this.parseFactor();
      this.skipWhitespace();
      node = { type: 'binary', operator: op, left: node, right };
    }

    return node;
  }

  private parsePostfix(): ASTNode {
    let node = this.parsePrimary();

    this.skipWhitespace();
    // Check for postfix operators like %
    if (this.currentChar === '%') {
      this.advance();
      node = { type: 'postfix', operator: '%', operand: node };
    }

    return node;
  }

  private parseFactor(): ASTNode {
    let node = this.parseUnary();

    this.skipWhitespace();
    while (this.currentChar === '^') {
      this.advance();
      this.skipWhitespace();
      const right = this.parseUnary();
      this.skipWhitespace();
      node = { type: 'binary', operator: '^', left: node, right };
    }

    return node;
  }

  private parseUnary(): ASTNode {
    if (this.currentChar === '-' || this.currentChar === '+') {
      const op = this.currentChar;
      this.advance();
      const operand = this.parseUnary();
      return { type: 'unary', operator: op, operand };
    }

    return this.parsePostfix();
  }

  private parsePrimary(): ASTNode {
    this.skipWhitespace();

    // Nombre
    if (this.currentChar && /[0-9.]/.test(this.currentChar)) {
      return this.parseNumber();
    }

    // String (entre guillemets)
    if (this.currentChar === '"') {
      return this.parseString();
    }

    // Boolean ou Reference ou Function
    if (this.currentChar && /[A-Za-z_]/.test(this.currentChar)) {
      return this.parseIdentifier();
    }

    // Parenthèses
    if (this.currentChar === '(') {
      this.advance();
      const node = this.parseExpression();
      this.skipWhitespace();
      if ((this.currentChar as string) !== ')') {
        throw new Error('Parenthèse fermante manquante');
      }
      this.advance();
      return node;
    }

    // Comparaisons
    if (this.currentChar === '>' || this.currentChar === '<' || this.currentChar === '=') {
      return this.parseComparison();
    }

    throw new Error(`Caractère inattendu: ${this.currentChar}`);
  }

  private parseNumber(): ASTNode {
    let numStr = '';
    let hasDecimal = false;

    while (this.currentChar && (/[0-9]/.test(this.currentChar) || this.currentChar === '.')) {
      if (this.currentChar === '.') {
        if (hasDecimal) throw new Error('Nombre invalide: deux points décimaux');
        hasDecimal = true;
      }
      numStr += this.currentChar;
      this.advance();
    }

    const value = parseFloat(numStr);
    if (isNaN(value)) throw new Error(`Nombre invalide: ${numStr}`);

    return { type: 'number', value };
  }

  private parseString(): ASTNode {
    this.advance(); // Skip opening "
    let str = '';

    while (this.currentChar && this.currentChar !== '"') {
      if (this.currentChar === '\\' && this.peek() === '"') {
        this.advance();
        str += '"';
        this.advance();
      } else {
        str += this.currentChar;
        this.advance();
      }
    }

    if (this.currentChar !== '"') {
      throw new Error('Guillemet fermant manquant');
    }

    this.advance(); // Skip closing "
    return { type: 'string', value: str };
  }

  private parseIdentifier(): ASTNode {
    let name = '';

    while (this.currentChar && /[A-Za-z0-9_]/.test(this.currentChar)) {
      name += this.currentChar;
      this.advance();
    }

    this.skipWhitespace();

    // Boolean literals
    if (name.toUpperCase() === 'TRUE') {
      return { type: 'boolean', value: true };
    }
    if (name.toUpperCase() === 'FALSE') {
      return { type: 'boolean', value: false };
    }

    // Function call
    if (this.currentChar === '(') {
      return this.parseFunction(name);
    }

    // Reference
    return { type: 'reference', name };
  }

  private parseFunction(name: string): ASTNode {
    this.advance(); // Skip '('
    const args: ASTNode[] = [];

    this.skipWhitespace();

    if (this.currentChar === ')') {
      this.advance();
      return { type: 'function', name: name.toUpperCase(), args };
    }

    while (true) {
      args.push(this.parseExpression());
      this.skipWhitespace();

      if (this.currentChar === ')') {
        this.advance();
        break;
      }

      if (this.currentChar === ',') {
        this.advance();
        this.skipWhitespace();
        continue;
      }

      throw new Error('Virgule ou parenthèse fermante attendue dans la fonction');
    }

    return { type: 'function', name: name.toUpperCase(), args };
  }

  private parseComparison(): ASTNode {
    // Simplified comparison for now - can be extended
    throw new Error('Comparaisons not yet implemented');
  }
}

export function parseFormula(expression: string): ParseResult {
  const parser = new FormulaParser();
  return parser.parse(expression);
}
