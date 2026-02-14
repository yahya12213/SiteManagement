// Types pour le moteur de formules

export type FormulaValue = number | string | boolean | null | any[];

export type FormulaError =
  | '#REF!' // Référence invalide
  | '#DIV/0!' // Division par zéro
  | '#TYPE!' // Type incompatible
  | '#CYCLE!' // Dépendance circulaire
  | '#ERR'; // Erreur générique

export interface FormulaContext {
  [ref: string]: FormulaValue | FormulaError;
}

export type ASTNode =
  | { type: 'number'; value: number }
  | { type: 'string'; value: string }
  | { type: 'boolean'; value: boolean }
  | { type: 'reference'; name: string }
  | { type: 'binary'; operator: string; left: ASTNode; right: ASTNode }
  | { type: 'unary'; operator: string; operand: ASTNode }
  | { type: 'postfix'; operator: string; operand: ASTNode }
  | { type: 'function'; name: string; args: ASTNode[] }
  | { type: 'error'; error: FormulaError };

export interface ParseResult {
  success: boolean;
  ast?: ASTNode;
  error?: string;
}

export interface EvalResult {
  value: FormulaValue | FormulaError;
  isError: boolean;
}

export interface FieldDefinition {
  id: string;
  type: 'label' | 'text' | 'number' | 'formula' | 'frame' | 'file' | 'textarea' | 'link';
  ref?: string; // Référence unique (ex: HEURES_REAL)
  props: {
    label?: string;
    expression?: string; // Pour type='formula'
    decimals?: number;
    default?: FormulaValue;
    min?: number;
    max?: number;
    regex?: string;
    accept?: string; // Pour type='file' - types de fichiers acceptés
    maxSize?: number; // Pour type='file' - taille max en MB
    url?: string; // Pour type='link' - URL du lien
  };
  layout: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  visibility?: {
    hidden?: boolean; // Masqué pour les professeurs
  };
  children?: FieldDefinition[]; // Pour type='frame'
}

export interface SessionCalculationSheet {
  version: string;
  meta: {
    title: string;
    currency: string;
    locale: string;
    status: 'Brouillon' | 'Soumise' | 'En revue' | 'Approuvée' | 'Refusée';
  };
  actors: {
    centre: {
      name: string;
      rc: string;
      ice: string;
    };
    prof: {
      id: string;
      name: string;
      cin: string;
      rib: string;
    };
  };
  session: {
    ref: string;
    title: string;
    location: string;
    dates: string[];
    participants: {
      inscrits: number;
      presents: number;
    };
  };
  params: {
    taux_centre: number;
    taux_prof: number;
    tva: number;
    ir_prof: number;
    cnss_prof: number;
  };
  fields: FieldDefinition[];
  audit: AuditEntry[];
  signatures: {
    prof: Signature | null;
    admin: Signature | null;
  };
}

export interface Signature {
  date: string;
  hash: string;
  userId?: string;
}

export interface AuditEntry {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  timestamp: string;
}
