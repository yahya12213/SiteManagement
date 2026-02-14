import React, { useState, useEffect } from 'react';
import { getCellRef, colToLetter } from '@/lib/utils/cellUtils';
import { getFormulaEngine, type CellData } from '@/lib/utils/formulaEngine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface Block {
  id: number;
  title: string;
  startCell: string;
  endCell: string;
  color: string;
}

interface SpreadsheetEditorProps {
  initialData?: {
    rows: number;
    cols: number;
    cellData: Record<string, CellData>;
    blocks: Block[];
  };
  onSave?: (data: any) => void;
  readOnly?: boolean;
}

const SpreadsheetEditor: React.FC<SpreadsheetEditorProps> = ({
  initialData,
  onSave,
  readOnly = false,
}) => {
  const [rows] = useState(initialData?.rows || 20);
  const [cols] = useState(initialData?.cols || 10);
  const [cellData, setCellData] = useState<Record<string, CellData>>(
    initialData?.cellData || {}
  );
  const [blocks] = useState<Block[]>(initialData?.blocks || []);
  const [selectedCell, setSelectedCell] = useState<string | null>(null);
  const [calculatedValues, setCalculatedValues] = useState<Record<string, any>>({});

  const engine = getFormulaEngine();

  useEffect(() => {
    // Calculer les formules
    const values = engine.calculateAll(cellData);
    setCalculatedValues(values);
  }, [cellData]);

  const handleCellChange = (cellRef: string, value: any, type: CellData['type'] = 'text') => {
    setCellData((prev) => ({
      ...prev,
      [cellRef]: {
        ...prev[cellRef],
        type,
        value,
      },
    }));
  };

  const getCellStyle = (cellRef: string) => {
    const cell = cellData[cellRef];
    return {
      backgroundColor: cell?.backgroundColor || '#fff',
      color: cell?.textColor || '#000',
      fontWeight: cell?.fontWeight || 'normal',
      fontSize: cell?.fontSize ? `${cell.fontSize}px` : '14px',
    };
  };

  const getCellDisplayValue = (cellRef: string) => {
    const cell = cellData[cellRef];
    if (!cell) return '';

    if (cell.type === 'formula') {
      return calculatedValues[cellRef] ?? cell.formula;
    }

    return cell.value ?? '';
  };

  const handleSave = () => {
    if (onSave) {
      onSave({
        rows,
        cols,
        cellData,
        blocks,
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      {!readOnly && (
        <div className="bg-white border-b p-4 flex gap-2">
          <Button onClick={handleSave} size="sm">
            Enregistrer
          </Button>
          <div className="flex-1"></div>
          <span className="text-sm text-gray-600">
            Cellule sélectionnée: {selectedCell || 'Aucune'}
          </span>
        </div>
      )}

      {/* Spreadsheet Grid */}
      <div className="flex-1 overflow-auto p-4">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="border border-gray-300 bg-gray-100 w-12 h-8 text-xs"></th>
              {Array.from({ length: cols }).map((_, colIdx) => (
                <th
                  key={colIdx}
                  className="border border-gray-300 bg-gray-100 min-w-[100px] h-8 text-xs font-semibold"
                >
                  {colToLetter(colIdx)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, rowIdx) => (
              <tr key={rowIdx}>
                <td className="border border-gray-300 bg-gray-100 w-12 h-8 text-center text-xs font-semibold">
                  {rowIdx + 1}
                </td>
                {Array.from({ length: cols }).map((_, colIdx) => {
                  const cellRef = getCellRef(rowIdx, colIdx);
                  const cell = cellData[cellRef];
                  const isSelected = selectedCell === cellRef;
                  const isReadOnly = readOnly || (cell?.type === 'formula' || cell?.type === 'label');

                  return (
                    <td
                      key={cellRef}
                      className={`border border-gray-300 p-0 ${
                        isSelected ? 'ring-2 ring-blue-500' : ''
                      }`}
                      style={getCellStyle(cellRef)}
                      onClick={() => setSelectedCell(cellRef)}
                    >
                      {isReadOnly ? (
                        <div className="px-2 py-1 h-8 flex items-center">
                          {getCellDisplayValue(cellRef)}
                        </div>
                      ) : (
                        <Input
                          type="text"
                          value={getCellDisplayValue(cellRef)}
                          onChange={(e) => handleCellChange(cellRef, e.target.value)}
                          className="border-0 h-8 px-2 focus:ring-0 rounded-none"
                          style={{ ...getCellStyle(cellRef), border: 'none' }}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SpreadsheetEditor;
