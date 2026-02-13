import { HyperFormula } from 'hyperformula';
import { parseCellRef, getCellRef } from './cellUtils';

export interface CellData {
  type: 'label' | 'number' | 'text' | 'formula';
  value?: any;
  formula?: string;
  backgroundColor?: string;
  textColor?: string;
  fontWeight?: string;
  fontSize?: number;
}

export class FormulaEngine {
  private hf: HyperFormula;
  private sheetId: number = 0;

  constructor() {
    this.hf = HyperFormula.buildEmpty({
      licenseKey: 'gpl-v3',
    });
    this.sheetId = this.hf.addSheet('Sheet1') as unknown as number;
  }

  /**
   * Initialise la feuille avec les données des cellules
   */
  initializeSheet(cells: Array<{ row: number; col: number; value: any }>) {
    // Effacer la feuille existante
    this.hf.clearSheet(this.sheetId);

    // Ajouter les cellules
    cells.forEach(({ row, col, value }) => {
      try {
        this.hf.setCellContents(
          { sheet: this.sheetId, row, col },
          [[value]]
        );
      } catch (error) {
        console.error(`Error setting cell ${getCellRef(row, col)}:`, error);
      }
    });
  }

  /**
   * Récupère la valeur d'une cellule
   */
  getCellValue(row: number, col: number): string | number {
    try {
      const value = this.hf.getCellValue({ sheet: this.sheetId, row, col });
      return (value ?? '') as string | number;
    } catch (error) {
      console.error(`Error getting cell value at (${row}, ${col}):`, error);
      return '';
    }
  }

  /**
   * Définit le contenu d'une cellule
   */
  setCellValue(row: number, col: number, value: any) {
    try {
      this.hf.setCellContents(
        { sheet: this.sheetId, row, col },
        [[value]]
      );
    } catch (error) {
      console.error(`Error setting cell value at (${row}, ${col}):`, error);
    }
  }

  /**
   * Calcule toutes les formules et retourne les valeurs
   */
  calculateAll(cellData: Record<string, CellData>): Record<string, any> {
    const results: Record<string, any> = {};

    // Préparer les données pour HyperFormula
    const cells: Array<{ row: number; col: number; value: any }> = [];

    Object.entries(cellData).forEach(([cellRef, cell]) => {
      const { row, col } = parseCellRef(cellRef);

      if (cell.type === 'formula' && cell.formula) {
        cells.push({ row, col, value: cell.formula });
      } else if (cell.type === 'number') {
        cells.push({ row, col, value: cell.value || 0 });
      } else if (cell.type === 'text' || cell.type === 'label') {
        cells.push({ row, col, value: cell.value || '' });
      }
    });

    // Initialiser la feuille
    this.initializeSheet(cells);

    // Récupérer les résultats
    Object.keys(cellData).forEach((cellRef) => {
      const { row, col } = parseCellRef(cellRef);
      results[cellRef] = this.getCellValue(row, col);
    });

    return results;
  }

  /**
   * Évalue une formule spécifique
   */
  evaluateFormula(formula: string, context: Record<string, any>): any {
    try {
      // Créer une feuille temporaire pour l'évaluation
      const tempSheetId = this.hf.addSheet('temp') as unknown as number;

      // Ajouter le contexte
      Object.entries(context).forEach(([cellRef, value]) => {
        const { row, col } = parseCellRef(cellRef);
        this.hf.setCellContents(
          { sheet: tempSheetId as number, row, col },
          [[value]]
        );
      });

      // Évaluer la formule
      this.hf.setCellContents({ sheet: tempSheetId as number, row: 0, col: 0 }, [[formula]]);
      const result = this.hf.getCellValue({ sheet: tempSheetId as number, row: 0, col: 0 });

      // Nettoyer
      this.hf.removeSheet(tempSheetId as number);

      return result;
    } catch (error) {
      console.error('Error evaluating formula:', error);
      return '#ERROR!';
    }
  }
}

// Instance singleton
let engineInstance: FormulaEngine | null = null;

export const getFormulaEngine = (): FormulaEngine => {
  if (!engineInstance) {
    engineInstance = new FormulaEngine();
  }
  return engineInstance;
};
