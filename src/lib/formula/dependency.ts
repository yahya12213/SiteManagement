import type { FieldDefinition, FormulaContext } from './types';
import { parseFormula } from './parser';
import { evaluateFormula } from './evaluator';

/**
 * Gestionnaire de dépendances (DAG) pour détecter les cycles
 * et calculer l'ordre d'évaluation des formules
 */

export interface DependencyGraph {
  nodes: Set<string>;
  edges: Map<string, Set<string>>; // ref -> Set de refs dont elle dépend
  reversEdges: Map<string, Set<string>>; // ref -> Set de refs qui dépendent d'elle
}

export class DependencyManager {
  private graph: DependencyGraph = {
    nodes: new Set(),
    edges: new Map(),
    reversEdges: new Map(),
  };

  /**
   * Construit le graphe de dépendances à partir des champs
   */
  buildGraph(fields: FieldDefinition[]): void {
    this.graph = {
      nodes: new Set(),
      edges: new Map(),
      reversEdges: new Map(),
    };

    // Collecter toutes les références
    for (const field of fields) {
      if (field.ref) {
        this.graph.nodes.add(field.ref);
        this.graph.edges.set(field.ref, new Set());
        this.graph.reversEdges.set(field.ref, new Set());
      }
    }

    // Construire les dépendances pour les formules
    for (const field of fields) {
      if (field.type === 'formula' && field.ref && field.props.expression) {
        const dependencies = this.extractDependencies(field.props.expression);
        this.graph.edges.set(field.ref, new Set(dependencies));

        // Mettre à jour les reverse edges
        for (const dep of dependencies) {
          if (!this.graph.reversEdges.has(dep)) {
            this.graph.reversEdges.set(dep, new Set());
          }
          this.graph.reversEdges.get(dep)!.add(field.ref);
        }
      }
    }
  }

  /**
   * Extrait les références d'une expression de formule
   */
  private extractDependencies(expression: string): string[] {
    const deps: string[] = [];
    const result = parseFormula(expression);

    if (result.success && result.ast) {
      this.extractReferencesFromAST(result.ast, deps);
    }

    return [...new Set(deps)]; // Dédupliquer
  }

  private extractReferencesFromAST(node: any, deps: string[]): void {
    if (!node) return;

    if (node.type === 'reference') {
      deps.push(node.name);
    } else if (node.type === 'binary') {
      this.extractReferencesFromAST(node.left, deps);
      this.extractReferencesFromAST(node.right, deps);
    } else if (node.type === 'unary') {
      this.extractReferencesFromAST(node.operand, deps);
    } else if (node.type === 'postfix') {
      this.extractReferencesFromAST(node.operand, deps);
    } else if (node.type === 'function') {
      for (const arg of node.args) {
        this.extractReferencesFromAST(arg, deps);
      }
    }
  }

  /**
   * Détecte les cycles dans le graphe
   * Retourne la liste des références impliquées dans un cycle, ou null si pas de cycle
   */
  detectCycle(): string[] | null {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cyclePath: string[] = [];

    for (const node of this.graph.nodes) {
      if (!visited.has(node)) {
        if (this.detectCycleDFS(node, visited, recursionStack, cyclePath)) {
          return cyclePath;
        }
      }
    }

    return null;
  }

  private detectCycleDFS(
    node: string,
    visited: Set<string>,
    recursionStack: Set<string>,
    cyclePath: string[]
  ): boolean {
    visited.add(node);
    recursionStack.add(node);
    cyclePath.push(node);

    const dependencies = this.graph.edges.get(node) || new Set();

    for (const dep of dependencies) {
      if (!visited.has(dep)) {
        if (this.detectCycleDFS(dep, visited, recursionStack, cyclePath)) {
          return true;
        }
      } else if (recursionStack.has(dep)) {
        // Cycle détecté
        cyclePath.push(dep);
        return true;
      }
    }

    recursionStack.delete(node);
    cyclePath.pop();
    return false;
  }

  /**
   * Tri topologique pour déterminer l'ordre d'évaluation
   * Retourne null si un cycle est détecté
   */
  getEvaluationOrder(): string[] | null {
    const cycle = this.detectCycle();
    if (cycle) return null;

    const visited = new Set<string>();
    const stack: string[] = [];

    for (const node of this.graph.nodes) {
      if (!visited.has(node)) {
        this.topologicalSortDFS(node, visited, stack);
      }
    }

    return stack.reverse();
  }

  private topologicalSortDFS(node: string, visited: Set<string>, stack: string[]): void {
    visited.add(node);

    // Utiliser reversEdges pour obtenir les nœuds qui dépendent du nœud actuel
    const dependents = this.graph.reversEdges.get(node) || new Set();

    for (const dep of dependents) {
      if (!visited.has(dep)) {
        this.topologicalSortDFS(dep, visited, stack);
      }
    }

    stack.push(node);
  }

  /**
   * Obtient toutes les références qui dépendent (directement ou indirectement) d'une référence donnée
   */
  getDependents(ref: string): Set<string> {
    const dependents = new Set<string>();
    const queue = [ref];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const directDependents = this.graph.reversEdges.get(current) || new Set();

      for (const dep of directDependents) {
        if (!dependents.has(dep)) {
          dependents.add(dep);
          queue.push(dep);
        }
      }
    }

    return dependents;
  }
}

/**
 * Calcule toutes les valeurs en respectant les dépendances
 */
export function calculateAllValues(fields: FieldDefinition[], initialValues: FormulaContext = {}): FormulaContext {
  const depManager = new DependencyManager();
  depManager.buildGraph(fields);

  // Détecter les cycles
  const cycle = depManager.detectCycle();
  if (cycle) {
    // Marquer toutes les références dans le cycle comme #CYCLE!
    const result: FormulaContext = { ...initialValues };
    for (const ref of cycle) {
      result[ref] = '#CYCLE!';
    }
    return result;
  }

  // Obtenir l'ordre d'évaluation
  const evaluationOrder = depManager.getEvaluationOrder();
  if (!evaluationOrder) {
    return initialValues;
  }

  const context: FormulaContext = { ...initialValues };

  // Évaluer dans l'ordre topologique
  for (const ref of evaluationOrder) {
    const field = fields.find((f) => f.ref === ref);

    if (!field) continue;

    if (field.type === 'formula' && field.props.expression) {
      // Parser et évaluer la formule
      const parseResult = parseFormula(field.props.expression);

      if (!parseResult.success || !parseResult.ast) {
        context[ref] = '#ERR';
        continue;
      }

      const evalResult = evaluateFormula(parseResult.ast, context);
      context[ref] = evalResult.value;
    } else if (field.type === 'number' && context[ref] === undefined) {
      // Utiliser la valeur par défaut si définie
      context[ref] = field.props.default !== undefined ? field.props.default : 0;
    } else if (field.type === 'text' && context[ref] === undefined) {
      context[ref] = field.props.default !== undefined ? field.props.default : '';
    }
  }

  return context;
}

/**
 * Recalcule uniquement les champs affectés par un changement de valeur
 */
export function recalculateAffected(
  fields: FieldDefinition[],
  changedRef: string,
  currentContext: FormulaContext
): FormulaContext {
  const depManager = new DependencyManager();
  depManager.buildGraph(fields);

  // Obtenir tous les champs qui dépendent du champ modifié
  const affectedRefs = depManager.getDependents(changedRef);

  if (affectedRefs.size === 0) {
    return currentContext;
  }

  // Recalculer uniquement les champs affectés
  const newContext = { ...currentContext };

  // Obtenir l'ordre d'évaluation complet
  const evaluationOrder = depManager.getEvaluationOrder();
  if (!evaluationOrder) {
    return currentContext;
  }

  // Filtrer pour ne garder que les champs affectés et les évaluer dans le bon ordre
  for (const ref of evaluationOrder) {
    if (!affectedRefs.has(ref)) continue;

    const field = fields.find((f) => f.ref === ref);
    if (!field || field.type !== 'formula' || !field.props.expression) continue;

    const parseResult = parseFormula(field.props.expression);
    if (!parseResult.success || !parseResult.ast) {
      newContext[ref] = '#ERR';
      continue;
    }

    const evalResult = evaluateFormula(parseResult.ast, newContext);
    newContext[ref] = evalResult.value;
  }

  return newContext;
}
