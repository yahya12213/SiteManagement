import type { ASTNode, FormulaContext, FormulaValue, FormulaError, EvalResult } from './types';

/**
 * Évaluateur de formules avec support des fonctions intégrées
 */

const FUNCTIONS: Record<string, (args: FormulaValue[]) => FormulaValue | FormulaError> = {
  // Fonctions mathématiques
  SUM: (args) => {
    let sum = 0;
    for (const arg of args) {
      if (typeof arg === 'number') sum += arg;
      else if (typeof arg === 'string') {
        const num = parseFloat(arg);
        if (!isNaN(num)) sum += num;
      }
    }
    return sum;
  },

  AVG: (args) => {
    if (args.length === 0) return '#ERR';
    const sum = FUNCTIONS.SUM(args);
    return typeof sum === 'number' ? sum / args.length : '#ERR';
  },

  MIN: (args) => {
    const numbers = args.filter((a) => typeof a === 'number') as number[];
    return numbers.length > 0 ? Math.min(...numbers) : '#ERR';
  },

  MAX: (args) => {
    const numbers = args.filter((a) => typeof a === 'number') as number[];
    return numbers.length > 0 ? Math.max(...numbers) : '#ERR';
  },

  COUNT: (args) => {
    return args.filter((a) => a !== null && a !== undefined).length;
  },

  IF: (args) => {
    if (args.length < 2) return '#ERR';
    const condition = args[0];
    const trueValue = args[1];
    const falseValue = args.length > 2 ? args[2] : null;
    return condition ? trueValue : falseValue;
  },

  ROUND: (args) => {
    if (args.length === 0) return '#ERR';
    const num = typeof args[0] === 'number' ? args[0] : parseFloat(String(args[0]));
    const decimals = args.length > 1 && typeof args[1] === 'number' ? args[1] : 0;
    if (isNaN(num)) return '#TYPE!';
    const factor = Math.pow(10, decimals);
    return Math.round(num * factor) / factor;
  },

  FLOOR: (args) => {
    if (args.length === 0) return '#ERR';
    const num = typeof args[0] === 'number' ? args[0] : parseFloat(String(args[0]));
    if (isNaN(num)) return '#TYPE!';
    return Math.floor(num);
  },

  CEIL: (args) => {
    if (args.length === 0) return '#ERR';
    const num = typeof args[0] === 'number' ? args[0] : parseFloat(String(args[0]));
    if (isNaN(num)) return '#TYPE!';
    return Math.ceil(num);
  },

  ABS: (args) => {
    if (args.length === 0) return '#ERR';
    const num = typeof args[0] === 'number' ? args[0] : parseFloat(String(args[0]));
    if (isNaN(num)) return '#TYPE!';
    return Math.abs(num);
  },

  // Fonctions de chaînes
  LEN: (args) => {
    if (args.length === 0) return '#ERR';
    return String(args[0] || '').length;
  },

  CONCAT: (args) => {
    return args.map((a) => String(a || '')).join('');
  },

  COALESCE: (args) => {
    for (const arg of args) {
      if (arg !== null && arg !== undefined && arg !== '') {
        return arg;
      }
    }
    return null;
  },

  // Fonctions de date
  TODAY: () => {
    return new Date().toISOString().split('T')[0];
  },

  DATE: (args) => {
    if (args.length < 3) return '#ERR';
    const year = Number(args[0]);
    const month = Number(args[1]);
    const day = Number(args[2]);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return '#TYPE!';
    const date = new Date(year, month - 1, day);
    return date.toISOString().split('T')[0];
  },

  YEAR: (args) => {
    if (args.length === 0) return '#ERR';
    const dateStr = String(args[0]);
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '#TYPE!';
    return date.getFullYear();
  },

  MONTH: (args) => {
    if (args.length === 0) return '#ERR';
    const dateStr = String(args[0]);
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '#TYPE!';
    return date.getMonth() + 1;
  },

  DAY: (args) => {
    if (args.length === 0) return '#ERR';
    const dateStr = String(args[0]);
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '#TYPE!';
    return date.getDate();
  },

  // Fonction de conversion
  NUMBER: (args) => {
    if (args.length === 0) return '#ERR';
    const num = parseFloat(String(args[0]));
    return isNaN(num) ? '#TYPE!' : num;
  },
};

export class FormulaEvaluator {
  private context: FormulaContext;

  constructor(context: FormulaContext = {}) {
    this.context = context;
  }

  setContext(context: FormulaContext): void {
    this.context = context;
  }

  evaluate(ast: ASTNode): EvalResult {
    try {
      const value = this.evaluateNode(ast);
      const isError = typeof value === 'string' && value.startsWith('#');
      return { value, isError };
    } catch (error: any) {
      return { value: '#ERR', isError: true };
    }
  }

  private evaluateNode(node: ASTNode): FormulaValue | FormulaError {
    switch (node.type) {
      case 'number':
        return node.value;

      case 'string':
        return node.value;

      case 'boolean':
        return node.value;

      case 'reference':
        return this.evaluateReference(node.name);

      case 'binary':
        return this.evaluateBinary(node.operator, node.left, node.right);

      case 'unary':
        return this.evaluateUnary(node.operator, node.operand);

      case 'postfix':
        return this.evaluatePostfix(node.operator, node.operand);

      case 'function':
        return this.evaluateFunction(node.name, node.args);

      case 'error':
        return node.error;

      default:
        return '#ERR';
    }
  }

  private evaluateReference(name: string): FormulaValue | FormulaError {
    if (name in this.context) {
      return this.context[name];
    }
    return '#REF!';
  }

  private evaluateBinary(
    operator: string,
    left: ASTNode,
    right: ASTNode
  ): FormulaValue | FormulaError {
    const leftVal = this.evaluateNode(left);
    const rightVal = this.evaluateNode(right);

    // Si une des valeurs est une erreur, propager l'erreur
    if (typeof leftVal === 'string' && leftVal.startsWith('#')) return leftVal;
    if (typeof rightVal === 'string' && rightVal.startsWith('#')) return rightVal;

    const leftNum = typeof leftVal === 'number' ? leftVal : parseFloat(String(leftVal));
    const rightNum = typeof rightVal === 'number' ? rightVal : parseFloat(String(rightVal));

    if (isNaN(leftNum) || isNaN(rightNum)) return '#TYPE!';

    switch (operator) {
      case '+':
        return leftNum + rightNum;
      case '-':
        return leftNum - rightNum;
      case '*':
        return leftNum * rightNum;
      case '/':
        if (rightNum === 0) return '#DIV/0!';
        return leftNum / rightNum;
      case '^':
        return Math.pow(leftNum, rightNum);
      case '>':
        return leftNum > rightNum;
      case '<':
        return leftNum < rightNum;
      case '>=':
        return leftNum >= rightNum;
      case '<=':
        return leftNum <= rightNum;
      case '=':
      case '==':
        return leftNum === rightNum;
      case '!=':
      case '<>':
        return leftNum !== rightNum;
      default:
        return '#ERR';
    }
  }

  private evaluateUnary(operator: string, operand: ASTNode): FormulaValue | FormulaError {
    const value = this.evaluateNode(operand);

    if (typeof value === 'string' && value.startsWith('#')) return value;

    const numValue = typeof value === 'number' ? value : parseFloat(String(value));

    if (isNaN(numValue)) return '#TYPE!';

    switch (operator) {
      case '-':
        return -numValue;
      case '+':
        return numValue;
      default:
        return '#ERR';
    }
  }

  private evaluatePostfix(operator: string, operand: ASTNode): FormulaValue | FormulaError {
    const value = this.evaluateNode(operand);

    if (typeof value === 'string' && value.startsWith('#')) return value;

    const numValue = typeof value === 'number' ? value : parseFloat(String(value));

    if (isNaN(numValue)) return '#TYPE!';

    switch (operator) {
      case '%':
        return numValue / 100;
      default:
        return '#ERR';
    }
  }

  private evaluateFunction(name: string, args: ASTNode[]): FormulaValue | FormulaError {
    const upperName = name.toUpperCase();

    if (!(upperName in FUNCTIONS)) {
      return '#ERR';
    }

    // Évaluer tous les arguments
    const evaluatedArgs: FormulaValue[] = [];
    for (const arg of args) {
      const val = this.evaluateNode(arg);
      // Si un argument est une erreur, on peut choisir de propager ou d'ignorer
      // Pour SUM, on ignore les erreurs; pour d'autres, on pourrait propager
      if (typeof val === 'string' && val.startsWith('#')) {
        // Pour la plupart des fonctions, propager l'erreur
        if (!['SUM', 'COUNT', 'COALESCE'].includes(upperName)) {
          return val;
        }
      }
      evaluatedArgs.push(val);
    }

    return FUNCTIONS[upperName](evaluatedArgs);
  }
}

export function evaluateFormula(ast: ASTNode, context: FormulaContext = {}): EvalResult {
  const evaluator = new FormulaEvaluator(context);
  return evaluator.evaluate(ast);
}
