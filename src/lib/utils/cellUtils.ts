/**
 * Utilitaires pour la gestion des cellules Excel-like
 */

// Conversion colonne → lettre (0 → A, 25 → Z, 26 → AA)
export const colToLetter = (col: number): string => {
  let letter = '';
  while (col >= 0) {
    letter = String.fromCharCode((col % 26) + 65) + letter;
    col = Math.floor(col / 26) - 1;
  }
  return letter;
};

// Conversion lettre → colonne (A → 0, Z → 25, AA → 26)
export const letterToCol = (letter: string): number => {
  let col = 0;
  for (let i = 0; i < letter.length; i++) {
    col = col * 26 + (letter.charCodeAt(i) - 64);
  }
  return col - 1;
};

// Parse référence cellule (B5 → { row: 4, col: 1 })
export const parseCellRef = (cellRef: string): { row: number; col: number } => {
  const match = cellRef.match(/^([A-Z]+)(\d+)$/);
  if (!match) throw new Error(`Invalid cell reference: ${cellRef}`);

  const col = letterToCol(match[1]);
  const row = parseInt(match[2], 10) - 1;

  return { row, col };
};

// Génère référence (4, 1 → B5)
export const getCellRef = (row: number, col: number): string => {
  return `${colToLetter(col)}${row + 1}`;
};

// Vérifie si cellule dans plage (C3 dans A1:E5 → true)
export const isCellInRange = (
  cellRef: string,
  startCell: string,
  endCell: string
): boolean => {
  const cell = parseCellRef(cellRef);
  const start = parseCellRef(startCell);
  const end = parseCellRef(endCell);

  return (
    cell.row >= start.row &&
    cell.row <= end.row &&
    cell.col >= start.col &&
    cell.col <= end.col
  );
};

// Convertir une plage en liste de cellules (A1:B2 → [A1, A2, B1, B2])
export const rangeToCells = (startCell: string, endCell: string): string[] => {
  const start = parseCellRef(startCell);
  const end = parseCellRef(endCell);
  const cells: string[] = [];

  for (let row = start.row; row <= end.row; row++) {
    for (let col = start.col; col <= end.col; col++) {
      cells.push(getCellRef(row, col));
    }
  }

  return cells;
};

// Fonction utilitaire pour className (similaire à clsx)
export function cn(...inputs: (string | undefined | null | false)[]): string {
  return inputs.filter(Boolean).join(' ');
}
