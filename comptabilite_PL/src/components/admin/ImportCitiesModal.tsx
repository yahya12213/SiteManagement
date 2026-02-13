import { useState, useRef } from 'react';
import { X, Upload, FileSpreadsheet, Download, AlertCircle, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useImportCities } from '@/hooks/useCities';
import { usePermission } from '@/hooks/usePermission';

// Type local pour les données d'import
type ImportCityData = {
  name: string;
  code: string;
  segment_id: string;
};

interface ImportCitiesModalProps {
  segmentId: string;
  segmentName: string;
  onClose: () => void;
}

export default function ImportCitiesModal({ segmentId, segmentName, onClose }: ImportCitiesModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState<{
    success: number;
    errors: Array<{ row: number; error: string; data: ImportCityData }>;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Permissions
  const { accounting } = usePermission();
  const canBulkImport = accounting.canBulkDeleteCity; // Using bulk_delete as proxy for bulk operations

  const importCities = useImportCities();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setResults(null);
    }
  };

  const handleImport = async () => {
    if (!file) return;

    setImporting(true);
    setResults(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as Array<{
        Ville?: string;
        code?: string;
      }>;

      // Transformer les données en ajoutant automatiquement le segment_id
      const cities: ImportCityData[] = jsonData.map((row) => ({
        name: row.Ville?.toString().trim() || '',
        code: row.code?.toString().trim().toUpperCase() || '',
        segment_id: segmentId, // Utiliser le segment sélectionné
      }));

      // Importer les villes
      const result = await importCities.mutateAsync(cities);
      setResults(result);
    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
      alert('Erreur lors de la lecture du fichier Excel');
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    // Créer un template Excel avec les colonnes et quelques exemples
    const templateData = [
      {
        Ville: 'Casablanca',
        code: 'A1P07',
      },
      {
        Ville: 'Rabat',
        code: 'A1P01',
      },
      {
        Ville: 'Tanger',
        code: 'A1P05',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Villes');

    // Définir la largeur des colonnes
    worksheet['!cols'] = [
      { wch: 25 }, // Ville
      { wch: 15 }, // code
    ];

    XLSX.writeFile(workbook, 'template_import_villes.xlsx');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[650px] md:w-[750px] lg:w-[850px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* En-tête */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileSpreadsheet className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Import en masse</h2>
              <p className="text-sm text-gray-500">Importer des villes pour : <strong>{segmentName}</strong></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Contenu */}
        <div className="p-6 space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Format du fichier Excel</h3>
            <p className="text-sm text-blue-800 mb-3">
              Le fichier doit contenir seulement 2 colonnes :
            </p>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li><strong>Ville</strong> : Nom de la ville (Ex: Casablanca)</li>
              <li><strong>code</strong> : Code de la ville (Ex: A1P07)</li>
            </ul>
            <p className="text-sm text-blue-700 mt-2">
              ℹ️ Toutes les villes seront automatiquement associées au segment : <strong>{segmentName}</strong>
            </p>
          </div>

          {/* Télécharger le template */}
          <button
            onClick={downloadTemplate}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
          >
            <Download className="w-5 h-5 text-blue-600" />
            <span className="text-blue-600 font-medium">Télécharger le fichier template</span>
          </button>

          {/* Zone de sélection de fichier */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-2 px-4 py-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors"
            >
              <Upload className="w-8 h-8 text-green-600" />
              <div className="text-center">
                <p className="text-green-600 font-medium">
                  {file ? file.name : 'Cliquez pour sélectionner un fichier Excel'}
                </p>
                <p className="text-sm text-gray-500 mt-1">Formats acceptés : .xlsx, .xls</p>
              </div>
            </button>
          </div>

          {/* Résultats de l'import */}
          {results && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-green-800 font-medium">
                  {results.success} ville(s) importée(s) avec succès
                </span>
              </div>

              {results.errors.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-red-800 font-medium">
                      {results.errors.length} erreur(s) détectée(s)
                    </span>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2">
                    {results.errors.map((error, index) => (
                      <div
                        key={index}
                        className="p-3 bg-white border border-red-200 rounded-lg text-sm"
                      >
                        <p className="font-medium text-red-800">Ligne {error.row}</p>
                        <p className="text-red-600">{error.error}</p>
                        <p className="text-gray-600 text-xs mt-1">
                          Ville: {error.data.name || 'N/A'} | Code: {error.data.code || 'N/A'}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Boutons d'action */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {results ? 'Fermer' : 'Annuler'}
            </button>
            {!results && canBulkImport && (
              <button
                type="button"
                onClick={handleImport}
                disabled={!file || importing}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? 'Import en cours...' : 'Importer'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
