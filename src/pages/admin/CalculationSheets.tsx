import { useState, useEffect } from 'react';
import { Calculator, Edit3, Save, CheckCircle2, Upload, X, FileText, Download, Eye, EyeOff, User, Shield, Link as LinkIcon, ExternalLink } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { calculateAllValues } from '@/lib/formula/dependency';
import type { FormulaContext, FieldDefinition } from '@/lib/formula/types';
import { useCalculationSheet } from '@/hooks/useCalculationSheets';
import { AppLayout } from '@/components/layout/AppLayout';
import { usePermission } from '@/hooks/usePermission';

// Mode test - Affichage de la fiche sans padding pour alignement parfait

export default function CalculationSheets() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewMode = searchParams.get('mode') || 'user'; // 'admin' ou 'user'
  const { accounting } = usePermission();
  const { data: sheetData, isLoading } = useCalculationSheet(id || '');
  const queryClient = useQueryClient();

  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [sheetTitle, setSheetTitle] = useState('Fiche de Calcul');
  const [values, setValues] = useState<FormulaContext>({});
  const [calculatedValues, setCalculatedValues] = useState<FormulaContext>({});
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, File | null>>({});
  const [canvasSize] = useState({ width: 1200, height: 800 });

  // Charger les données de la fiche
  useEffect(() => {
    if (sheetData) {
      setSheetTitle(sheetData.title);

      if (sheetData.template_data) {
        try {
          const template = JSON.parse(sheetData.template_data);
          if (template.fields && template.fields.length > 0) {
            setFields(template.fields);
          }
        } catch (error) {
          console.error('Erreur lors du chargement du template:', error);
        }
      }
    }
  }, [sheetData]);

  // Recalculer les valeurs à chaque changement
  useEffect(() => {
    const newCalculated = calculateAllValues(fields, values);
    setCalculatedValues(newCalculated);
  }, [values, fields]);

  const handleValueChange = (ref: string, value: string) => {
    const field = fields.find((f) => f.ref === ref);
    if (!field) return;

    let parsedValue: number | string = value;

    if (field.type === 'number') {
      parsedValue = value === '' ? 0 : parseFloat(value) || 0;
    }

    setValues((prev) => ({
      ...prev,
      [ref]: parsedValue,
    }));
  };

  const handleFileChange = (ref: string, file: File | null) => {
    setUploadedFiles((prev) => ({
      ...prev,
      [ref]: file,
    }));
  };

  const handleSave = () => {
    // Sauvegarder les données dans localStorage avec clé unique par fiche
    const dataToSave = {
      values,
      calculatedValues,
      timestamp: new Date().toISOString(),
      sheetId: id,
    };

    // Use unique storage key based on sheet ID
    const storageKey = id ? `calculation_sheet_data_${id}` : 'calculation_sheet_data';
    localStorage.setItem(storageKey, JSON.stringify(dataToSave));
    setSaveMessage('Données sauvegardées avec succès!');

    // Effacer le message après 3 secondes
    setTimeout(() => setSaveMessage(null), 3000);
  };


  // Invalidate queries when id changes (handles browser back button)
  useEffect(() => {
    if (id) {
      // Force refresh the calculation sheet data when navigating
      queryClient.invalidateQueries({ queryKey: ['calculation-sheets', id] });
    }
  }, [id, queryClient]);

  // Charger les données sauvegardées au montage du composant
  useEffect(() => {
    // Create unique localStorage key based on sheet ID
    const storageKey = id ? `calculation_sheet_data_${id}` : 'calculation_sheet_data';
    const saved = localStorage.getItem(storageKey);

    if (saved) {
      try {
        const data = JSON.parse(saved);
        setValues(data.values || {});
      } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
      }
    }

    // Cleanup function to clear localStorage when leaving the component
    return () => {
      if (viewMode === 'user') {
        // Only clear localStorage when navigating away, not on every render
        const isNavigatingAway = !window.location.pathname.includes(`/calculation-sheets/${id}`);
        if (isNavigatingAway) {
          localStorage.removeItem(storageKey);
        }
      }
    };
  }, [id, viewMode]);

  const renderField = (field: FieldDefinition) => {
    const layout = field.layout || { x: 0, y: 0, w: 200, h: 40 };

    // En mode utilisateur, ne pas afficher les champs masqués
    if (viewMode === 'user' && field.visibility?.hidden) {
      return null;
    }

    // En mode admin, afficher les champs masqués avec un style spécial
    const isHiddenInUserMode = field.visibility?.hidden;

    if (field.type === 'label') {
      return (
        <div
          key={field.id}
          className={`absolute bg-gray-100 border-2 border-gray-300 rounded px-3 py-2 flex items-center font-semibold text-gray-700 ${
            isHiddenInUserMode ? 'opacity-60 ring-2 ring-red-400' : ''
          }`}
          style={{
            left: `${layout.x}px`,
            top: `${layout.y}px`,
            width: `${layout.w}px`,
            height: `${layout.h}px`,
          }}
        >
          {isHiddenInUserMode && viewMode === 'admin' && (
            <EyeOff className="w-4 h-4 mr-2 text-red-500" />
          )}
          {field.props.label}
        </div>
      );
    }

    if (field.type === 'text') {
      const currentValue = values[field.ref!];
      const stringValue = typeof currentValue === 'string' || typeof currentValue === 'number' ? String(currentValue) : '';

      return (
        <div
          key={field.id}
          className={`absolute ${isHiddenInUserMode ? 'ring-2 ring-red-400 opacity-60' : ''}`}
          style={{
            left: `${layout.x}px`,
            top: `${layout.y}px`,
            width: `${layout.w}px`,
            height: `${layout.h}px`,
          }}
        >
          <input
            type="text"
            value={stringValue}
            onChange={(e) => handleValueChange(field.ref!, e.target.value)}
            className="w-full h-full px-3 py-2 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      );
    }

    if (field.type === 'textarea') {
      const currentValue = values[field.ref!];
      const stringValue = typeof currentValue === 'string' || typeof currentValue === 'number' ? String(currentValue) : '';

      return (
        <div
          key={field.id}
          className={`absolute ${isHiddenInUserMode ? 'ring-2 ring-red-400 opacity-60' : ''}`}
          style={{
            left: `${layout.x}px`,
            top: `${layout.y}px`,
            width: `${layout.w}px`,
            height: `${layout.h}px`,
          }}
        >
          <div className="relative w-full h-full">
            {isHiddenInUserMode && viewMode === 'admin' && (
              <div className="absolute top-2 right-2 z-10">
                <EyeOff className="w-4 h-4 text-red-500" />
              </div>
            )}
            <textarea
              value={stringValue}
              onChange={(e) => handleValueChange(field.ref!, e.target.value)}
              placeholder={field.props.label || 'Écrivez vos commentaires ici...'}
              className="w-full h-full px-3 py-2 border-2 border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
            />
          </div>
        </div>
      );
    }

    if (field.type === 'number') {
      const currentValue = values[field.ref!] !== undefined ? values[field.ref!] : field.props.default || 0;
      const numberValue = typeof currentValue === 'number' || typeof currentValue === 'string' ? currentValue : '';

      return (
        <div
          key={field.id}
          className={`absolute ${isHiddenInUserMode ? 'ring-2 ring-red-400 opacity-60' : ''}`}
          style={{
            left: `${layout.x}px`,
            top: `${layout.y}px`,
            width: `${layout.w}px`,
            height: `${layout.h}px`,
          }}
        >
          <div className="relative w-full h-full">
            {isHiddenInUserMode && viewMode === 'admin' && (
              <div className="absolute top-1/2 -translate-y-1/2 right-2 z-10">
                <EyeOff className="w-4 h-4 text-red-500" />
              </div>
            )}
            <input
              type="number"
              step="0.01"
              value={numberValue}
              onChange={(e) => handleValueChange(field.ref!, e.target.value)}
              className="w-full h-full px-3 py-2 border border-green-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>
      );
    }

    if (field.type === 'formula') {
      const value = calculatedValues[field.ref!];
      const isError = typeof value === 'string' && value.startsWith('#');

      return (
        <div
          key={field.id}
          className={`absolute flex items-center ${isHiddenInUserMode ? 'ring-2 ring-red-400 opacity-60' : ''}`}
          style={{
            left: `${layout.x}px`,
            top: `${layout.y}px`,
            width: `${layout.w}px`,
            height: `${layout.h}px`,
          }}
        >
          <div
            className={`relative w-full h-full px-3 py-2 border-2 rounded font-semibold flex items-center ${
              isError
                ? 'bg-red-50 border-red-400 text-red-700'
                : 'bg-purple-50 border-purple-400 text-purple-900'
            }`}
          >
            {isHiddenInUserMode && viewMode === 'admin' && (
              <EyeOff className="w-4 h-4 text-red-500 mr-2 flex-shrink-0" />
            )}
            {typeof value === 'number' ? value.toFixed(field.props.decimals || 2) : String(value || '0')}
          </div>
        </div>
      );
    }

    if (field.type === 'frame') {
      return (
        <div
          key={field.id}
          className={`absolute border-2 border-orange-400 rounded-lg bg-orange-50/30 ${
            isHiddenInUserMode ? 'ring-2 ring-red-400 opacity-60' : ''
          }`}
          style={{
            left: `${layout.x}px`,
            top: `${layout.y}px`,
            width: `${layout.w}px`,
            height: `${layout.h}px`,
          }}
        >
          {/* Titre du cadre en haut */}
          <div className="bg-orange-500 text-white px-3 py-1 rounded-t font-semibold text-sm flex items-center">
            {isHiddenInUserMode && viewMode === 'admin' && (
              <EyeOff className="w-3 h-3 mr-2" />
            )}
            {field.props.label || 'Cadre'}
          </div>
        </div>
      );
    }

    if (field.type === 'file') {
      const uploadedFile = uploadedFiles[field.ref!];

      return (
        <div
          key={field.id}
          className={`absolute ${isHiddenInUserMode ? 'ring-2 ring-red-400 opacity-60' : ''}`}
          style={{
            left: `${layout.x}px`,
            top: `${layout.y}px`,
            width: `${layout.w}px`,
            height: `${layout.h}px`,
          }}
        >
          {uploadedFile ? (
            <div className="w-full h-full border-2 border-teal-400 bg-teal-50 rounded px-3 py-2 flex items-center justify-between gap-2">
              {isHiddenInUserMode && viewMode === 'admin' && (
                <div className="flex-shrink-0">
                  <EyeOff className="w-4 h-4 text-red-500" />
                </div>
              )}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileText className="w-5 h-5 text-teal-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-teal-900 truncate">
                    {uploadedFile.name}
                  </div>
                  <div className="text-xs text-teal-600">
                    {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => {
                    // Prévisualiser le fichier
                    const url = URL.createObjectURL(uploadedFile);
                    window.open(url, '_blank');
                  }}
                  className="p-1.5 hover:bg-teal-200 rounded transition-colors"
                  title="Prévisualiser"
                >
                  <Eye className="w-4 h-4 text-teal-700" />
                </button>
                <button
                  onClick={() => {
                    // Télécharger le fichier
                    const url = URL.createObjectURL(uploadedFile);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = uploadedFile.name;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="p-1.5 hover:bg-teal-200 rounded transition-colors"
                  title="Télécharger"
                >
                  <Download className="w-4 h-4 text-teal-700" />
                </button>
                <button
                  onClick={() => handleFileChange(field.ref!, null)}
                  className="p-1.5 hover:bg-red-200 rounded transition-colors"
                  title="Supprimer"
                >
                  <X className="w-4 h-4 text-red-600" />
                </button>
              </div>
            </div>
          ) : (
            <label className="w-full h-full border-2 border-dashed border-teal-300 bg-teal-50/50 rounded px-3 py-2 flex flex-col items-center justify-center cursor-pointer hover:bg-teal-100/50 transition-colors relative">
              {isHiddenInUserMode && viewMode === 'admin' && (
                <div className="absolute top-2 right-2">
                  <EyeOff className="w-4 h-4 text-red-500" />
                </div>
              )}
              <Upload className="w-6 h-6 text-teal-600 mb-1" />
              <span className="text-sm font-medium text-teal-700">
                {field.props.label || 'Télécharger un fichier'}
              </span>
              <span className="text-xs text-teal-600 mt-1">
                {field.props.accept || 'Tous les fichiers'} (max {field.props.maxSize || 5} MB)
              </span>
              <input
                type="file"
                accept={field.props.accept}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const maxSize = (field.props.maxSize || 5) * 1024 * 1024;
                    if (file.size > maxSize) {
                      alert(`Le fichier est trop volumineux. Taille maximum: ${field.props.maxSize || 5} MB`);
                      return;
                    }
                    handleFileChange(field.ref!, file);
                  }
                }}
                className="hidden"
              />
            </label>
          )}
        </div>
      );
    }

    if (field.type === 'link') {
      const url = (values[field.ref!] as string) || field.props.url || '';
      const hasValidUrl = url && url.trim() !== '' && (url.startsWith('http://') || url.startsWith('https://'));

      return (
        <div
          key={field.id}
          className={`absolute ${isHiddenInUserMode ? 'ring-2 ring-red-400 opacity-60' : ''}`}
          style={{
            left: `${layout.x}px`,
            top: `${layout.y}px`,
            width: `${layout.w}px`,
            height: `${layout.h}px`,
          }}
        >
          <div className="w-full h-full border-2 border-cyan-400 bg-cyan-50 rounded px-2 flex items-center gap-2">
            {isHiddenInUserMode && viewMode === 'admin' && (
              <EyeOff className="w-4 h-4 text-red-500 flex-shrink-0" />
            )}
            <LinkIcon className="w-4 h-4 text-cyan-600 flex-shrink-0" />
            <span className="text-xs font-medium text-cyan-700 flex-shrink-0 whitespace-nowrap">
              {field.props.label || 'Lien'}:
            </span>
            <input
              type="url"
              value={url}
              onChange={(e) => handleValueChange(field.ref!, e.target.value)}
              placeholder="https://..."
              className="flex-1 min-w-0 px-2 py-1 text-xs border border-cyan-300 rounded focus:ring-1 focus:ring-cyan-500 focus:border-transparent bg-white"
            />
            {hasValidUrl && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 bg-cyan-600 hover:bg-cyan-700 text-white rounded transition-colors flex-shrink-0"
                title="Ouvrir le lien"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      );
    }

    return null;
  };

  if (isLoading) {
    return (
      <AppLayout
        title="Test Fiche de Calcul"
        subtitle="Chargement en cours..."
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement de la fiche...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!sheetData || fields.length === 0) {
    return (
      <AppLayout
        title="Test Fiche de Calcul"
        subtitle="Aucune fiche trouvée"
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Calculator className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Aucune fiche trouvée</h2>
            <p className="text-gray-500 mb-4">Cette fiche n'existe pas ou n'a pas encore de champs.</p>
            <Link
              to="/admin/calculation-sheets"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Retour à la liste
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={sheetTitle}
      subtitle={viewMode === 'admin' ? 'Tous les champs visibles - Simulation complète' : 'Mode Test - Vérifiez vos calculs'}
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className={`px-2.5 sm:px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-fit ${
              viewMode === 'admin'
                ? 'bg-purple-100 text-purple-800'
                : 'bg-blue-100 text-blue-800'
            }`}>
              {viewMode === 'admin' ? (
                <>
                  <Shield className="w-3 h-3" />
                  Mode Admin
                </>
              ) : (
                <>
                  <User className="w-3 h-3" />
                  Mode Utilisateur
                </>
              )}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {/* Basculer entre les modes */}
            <div className="flex gap-2">
              <button
                onClick={() => setSearchParams({ mode: 'admin' })}
                className={`px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm ${
                  viewMode === 'admin'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Shield className="w-4 h-4" />
                <span className="hidden sm:inline">Admin</span>
              </button>
              <button
                onClick={() => setSearchParams({ mode: 'user' })}
                className={`px-3 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm ${
                  viewMode === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <User className="w-4 h-4" />
                <span className="hidden sm:inline">Utilisateur</span>
              </button>
            </div>

            {/* Message de sauvegarde */}
            {saveMessage && (
              <div className="flex items-center gap-2 bg-green-100 text-green-800 px-3 sm:px-4 py-2 rounded-lg">
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium">{saveMessage}</span>
              </div>
            )}

            <button
              onClick={handleSave}
              className="px-3 sm:px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
            >
              <Save className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>Sauvegarder Test</span>
            </button>

            {accounting.canEditCalculationSheet && (
              <Link
                to={`/admin/calculation-sheets/${id}/editor`}
                className="px-3 sm:px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <Edit3 className="w-4 h-4 sm:w-5 sm:h-5" />
                <span>Modifier</span>
              </Link>
            )}
          </div>
        </div>

        {/* Canvas de la fiche */}
        <div className="bg-white rounded-lg shadow-sm overflow-auto">
          <div
            className="relative bg-white"
            style={{
              width: `${canvasSize.width}px`,
              minHeight: `${canvasSize.height}px`,
            }}
          >
            {fields.map((field) => renderField(field))}
          </div>
        </div>

        {/* Aide */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
            <Calculator className="w-5 h-5" />
            Mode Test - Comment utiliser
          </h3>
          <div className="text-sm text-blue-800 space-y-1">
            <p>✓ Saisissez des valeurs dans les champs <strong>Nombre</strong> et <strong>Texte</strong></p>
            <p>✓ Les formules se calculent automatiquement en temps réel</p>
            <p>✓ Vérifiez que les calculs sont corrects avant d'utiliser en production</p>
            <p>✓ Cliquez sur "Modifier" pour retourner à l'éditeur et ajuster les champs</p>
            <p>✓ Les données de test sont sauvegardées temporairement</p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
