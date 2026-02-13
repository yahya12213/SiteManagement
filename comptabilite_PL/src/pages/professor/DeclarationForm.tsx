import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Save, Send, AlertCircle, EyeOff, Upload, X, FileText, Download, ExternalLink, Link as LinkIcon } from 'lucide-react';
import { useProfessorDeclaration, useUpdateDeclaration, useSubmitDeclaration } from '@/hooks/useProfessorDeclarations';
import DeclarationStatusBadge from '@/components/professor/DeclarationStatusBadge';
import { calculateAllValues } from '@/lib/formula/dependency';
import type { FieldDefinition, FormulaContext } from '@/lib/formula/types';
import { AppLayout } from '@/components/layout/AppLayout';

const DeclarationForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: declaration, isLoading } = useProfessorDeclaration(id || '');
  const updateDeclaration = useUpdateDeclaration();
  const submitDeclaration = useSubmitDeclaration();

  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [values, setValues] = useState<FormulaContext>({});
  const [calculatedValues, setCalculatedValues] = useState<FormulaContext>({});
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });

  const isReadOnly = declaration?.status !== 'brouillon' && declaration?.status !== 'refusee' && declaration?.status !== 'en_cours' && declaration?.status !== 'a_declarer';

  // Charger les données de la déclaration
  useEffect(() => {
    if (declaration?.template_data) {
      try {
        const template = JSON.parse(declaration.template_data);
        if (template.fields && template.fields.length > 0) {
          setFields(template.fields);
        }
        if (template.canvasSize) {
          setCanvasSize(template.canvasSize);
        }
      } catch (error) {
        console.error('Error parsing template:', error);
      }
    }

    if (declaration?.form_data) {
      try {
        const data = JSON.parse(declaration.form_data);
        setValues(data);
      } catch (error) {
        console.error('Error parsing form data:', error);
      }
    }
  }, [declaration]);

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

  // Convertir un fichier en base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleFileChange = async (ref: string, file: File | null) => {
    if (!file) {
      // Supprimer tous les fichiers
      setValues((prev) => ({
        ...prev,
        [ref]: [],
      }));
      return;
    }

    try {
      // Convertir le fichier en base64
      const base64Data = await fileToBase64(file);

      // Créer l'objet fichier avec métadonnées
      const fileData = {
        name: file.name,
        size: file.size,
        type: file.type,
        data: base64Data,
        uploadedAt: new Date().toISOString(),
      };

      // Ajouter le fichier au tableau existant (support multi-fichiers)
      setValues((prev) => {
        const existingFiles = Array.isArray(prev[ref]) ? prev[ref] : [];
        return {
          ...prev,
          [ref]: [...existingFiles, fileData],
        };
      });
    } catch (error) {
      console.error('Error converting file to base64:', error);
      alert('Erreur lors du traitement du fichier');
    }
  };

  const handleFileRemove = (ref: string, index: number) => {
    setValues((prev) => {
      const files = Array.isArray(prev[ref]) ? prev[ref] : [];
      const newFiles = files.filter((_: any, i: number) => i !== index);
      return {
        ...prev,
        [ref]: newFiles,
      };
    });
  };

  const handleSave = async () => {
    if (!id) return;

    try {
      await updateDeclaration.mutateAsync({
        id,
        form_data: values,
      });

      setSaveMessage('Brouillon sauvegardé avec succès!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving declaration:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const handleSubmit = async () => {
    if (!id) return;

    if (window.confirm('Voulez-vous soumettre cette déclaration pour validation ? Vous ne pourrez plus la modifier après soumission.')) {
      try {
        // Sauvegarder d'abord les données
        await updateDeclaration.mutateAsync({
          id,
          form_data: values,
        });

        // Puis soumettre
        await submitDeclaration.mutateAsync(id);

        // Rediriger vers la liste
        navigate('/professor/declarations');
      } catch (error) {
        console.error('Error submitting declaration:', error);
        alert('Erreur lors de la soumission');
      }
    }
  };

  const renderField = (field: FieldDefinition) => {
    const layout = field.layout || { x: 0, y: 0, w: 200, h: 40 };

    // Ne pas afficher les champs masqués
    if (field.visibility?.hidden) {
      return null;
    }

    if (field.type === 'label') {
      return (
        <div
          key={field.id}
          className="absolute bg-gray-100 border-2 border-gray-300 rounded px-3 py-2 flex items-center font-semibold text-gray-700"
          style={{
            left: `${layout.x}px`,
            top: `${layout.y}px`,
            width: `${layout.w}px`,
            height: `${layout.h}px`,
          }}
        >
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
          className="absolute"
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
            className="w-full h-full px-3 py-2 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            disabled={isReadOnly}
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
          className="absolute"
          style={{
            left: `${layout.x}px`,
            top: `${layout.y}px`,
            width: `${layout.w}px`,
            height: `${layout.h}px`,
          }}
        >
          <textarea
            value={stringValue}
            onChange={(e) => handleValueChange(field.ref!, e.target.value)}
            placeholder={field.props.label || 'Écrivez vos commentaires ici...'}
            className="w-full h-full px-3 py-2 border-2 border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none disabled:bg-gray-100 disabled:cursor-not-allowed"
            disabled={isReadOnly}
          />
        </div>
      );
    }

    if (field.type === 'number') {
      const currentValue = values[field.ref!] !== undefined ? values[field.ref!] : field.props.default || 0;
      const numberValue = typeof currentValue === 'number' || typeof currentValue === 'string' ? currentValue : '';

      return (
        <div
          key={field.id}
          className="absolute"
          style={{
            left: `${layout.x}px`,
            top: `${layout.y}px`,
            width: `${layout.w}px`,
            height: `${layout.h}px`,
          }}
        >
          <input
            type="number"
            step="0.01"
            value={numberValue}
            onChange={(e) => handleValueChange(field.ref!, e.target.value)}
            className="w-full h-full px-3 py-2 border border-green-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            disabled={isReadOnly}
          />
        </div>
      );
    }

    if (field.type === 'formula') {
      const value = calculatedValues[field.ref!];
      const isError = typeof value === 'string' && value.startsWith('#');

      return (
        <div
          key={field.id}
          className="absolute flex items-center"
          style={{
            left: `${layout.x}px`,
            top: `${layout.y}px`,
            width: `${layout.w}px`,
            height: `${layout.h}px`,
          }}
        >
          <div
            className={`w-full h-full px-3 py-2 border-2 rounded font-semibold flex items-center ${
              isError
                ? 'bg-red-50 border-red-400 text-red-700'
                : 'bg-purple-50 border-purple-400 text-purple-900'
            }`}
          >
            {typeof value === 'number' ? value.toFixed(field.props.decimals || 2) : String(value || '0')}
          </div>
        </div>
      );
    }

    if (field.type === 'frame') {
      return (
        <div
          key={field.id}
          className="absolute border-2 border-orange-400 rounded-lg bg-orange-50/30"
          style={{
            left: `${layout.x}px`,
            top: `${layout.y}px`,
            width: `${layout.w}px`,
            height: `${layout.h}px`,
          }}
        >
          <div className="bg-orange-500 text-white px-3 py-1 rounded-t font-semibold text-sm">
            {field.props.label || 'Cadre'}
          </div>
        </div>
      );
    }

    if (field.type === 'file') {
      const files = Array.isArray(values[field.ref!]) ? (values[field.ref!] as any[]) : [];
      const hasFiles = files && files.length > 0;

      return (
        <div
          key={field.id}
          className="absolute"
          style={{
            left: `${layout.x}px`,
            top: `${layout.y}px`,
            width: `${layout.w}px`,
            height: `${layout.h}px`,
          }}
        >
          <div className="w-full h-full border-2 border-teal-400 bg-teal-50 rounded px-3 py-2 flex flex-col gap-2">
            {/* Label et bouton upload */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-600" />
                <span className="text-sm font-medium text-teal-900">
                  {field.props.label || 'Pièces jointes'} ({files.length})
                </span>
              </div>
              {!isReadOnly && (
                <label className="cursor-pointer px-2 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded text-xs font-medium transition-colors">
                  + Ajouter
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
                      e.target.value = ''; // Reset input pour permettre re-upload du même fichier
                    }}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Liste des fichiers */}
            {hasFiles ? (
              <div className="space-y-1 flex-1">
                {files.map((file: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-2 p-2 bg-white rounded border border-teal-200"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-teal-900 truncate">
                        {file.name}
                      </div>
                      <div className="text-xs text-teal-600">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          // Convertir base64 en blob pour téléchargement
                          const byteString = atob(file.data.split(',')[1]);
                          const mimeString = file.data.split(',')[0].split(':')[1].split(';')[0];
                          const ab = new ArrayBuffer(byteString.length);
                          const ia = new Uint8Array(ab);
                          for (let i = 0; i < byteString.length; i++) {
                            ia[i] = byteString.charCodeAt(i);
                          }
                          const blob = new Blob([ab], { type: mimeString });
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = file.name;
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                        className="p-1 hover:bg-teal-200 rounded transition-colors"
                        title="Télécharger"
                      >
                        <Download className="w-3 h-3 text-teal-700" />
                      </button>
                      {!isReadOnly && (
                        <button
                          onClick={() => handleFileRemove(field.ref!, index)}
                          className="p-1 hover:bg-red-200 rounded transition-colors"
                          title="Supprimer"
                        >
                          <X className="w-3 h-3 text-red-600" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60">
                <Upload className="w-8 h-8 text-teal-600 mb-2" />
                <span className="text-xs text-teal-700">
                  Aucune pièce jointe
                </span>
                <span className="text-xs text-teal-600 mt-1">
                  {field.props.accept || 'Tous fichiers'} (max {field.props.maxSize || 5} MB)
                </span>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (field.type === 'link') {
      const url = (values[field.ref!] as string) || '';
      const hasValidUrl = url && url.trim() !== '' && (url.startsWith('http://') || url.startsWith('https://'));

      return (
        <div
          key={field.id}
          className="absolute"
          style={{
            left: `${layout.x}px`,
            top: `${layout.y}px`,
            width: `${layout.w}px`,
            height: `${layout.h}px`,
          }}
        >
          <div className="w-full h-full border-2 border-cyan-400 bg-cyan-50 rounded px-3 py-2 flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-cyan-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <label className="block text-xs font-medium text-cyan-700 mb-1">
                {field.props.label || 'Lien'}
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => handleValueChange(field.ref!, e.target.value)}
                disabled={isReadOnly}
                placeholder="https://exemple.com"
                className={`w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 ${
                  isReadOnly
                    ? 'bg-gray-100 border-gray-300 text-gray-600 cursor-not-allowed'
                    : 'bg-white border-cyan-300 text-cyan-900'
                }`}
              />
            </div>
            {hasValidUrl && (
              <button
                onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                className="p-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded transition-colors flex-shrink-0"
                title="Ouvrir le lien"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
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
        title="Déclaration"
        subtitle="Chargement en cours..."
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement de la déclaration...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!declaration) {
    return (
      <AppLayout
        title="Déclaration"
        subtitle="Formulaire de déclaration"
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">Déclaration introuvable</h2>
            <Link
              to="/professor/declarations"
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
      title={declaration.sheet_title}
      subtitle={`${declaration.segment_name} • ${declaration.city_name} • Du ${new Date(declaration.start_date).toLocaleDateString('fr-FR')} au ${new Date(declaration.end_date).toLocaleDateString('fr-FR')}`}
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DeclarationStatusBadge status={declaration.status} />
            {isReadOnly && (
              <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium flex items-center gap-1">
                <EyeOff className="w-3 h-3" />
                Lecture seule
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Message de sauvegarde */}
            {saveMessage && (
              <div className="flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-lg">
                <span className="text-sm font-medium">{saveMessage}</span>
              </div>
            )}

            {!isReadOnly && (
              <>
                <button
                  onClick={handleSave}
                  className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-2"
                  disabled={updateDeclaration.isPending}
                >
                  <Save className="w-5 h-5" />
                  Sauvegarder
                </button>

                <button
                  onClick={handleSubmit}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
                  disabled={submitDeclaration.isPending}
                >
                  <Send className="w-5 h-5" />
                  Soumettre
                </button>
              </>
            )}
          </div>
        </div>

        {/* Message pour déclaration créée par un gérant */}
        {(declaration.status as any) === 'a_declarer' && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg px-6 py-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-800">Fiche assignée par un gérant</p>
                <p className="text-sm text-orange-700 mt-1">
                  Cette fiche de session vous a été assignée. Veuillez la remplir et la soumettre.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Rejection reason */}
        {declaration.rejection_reason && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-6 py-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">Déclaration refusée</p>
                <p className="text-sm text-red-700 mt-1">{declaration.rejection_reason}</p>
              </div>
            </div>
          </div>
        )}

        {/* Canvas - Full width layout, scroll avec la page principale */}
        <div className="bg-white rounded-lg shadow-sm">
          <div
            className="relative bg-white mx-auto"
            style={{
              width: `${canvasSize.width}px`,
              minHeight: `${canvasSize.height}px`,
            }}
          >
            {fields.map((field) => renderField(field))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default DeclarationForm;
