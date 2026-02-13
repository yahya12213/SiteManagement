import React, { useState, useRef } from 'react';
import { AlertCircle, Type, Trash2 } from 'lucide-react';
import { useCustomFonts, useUploadCustomFont, useDeleteCustomFont } from '@/hooks/useCertificateTemplates';

export const CustomFontManager: React.FC = () => {
  const [fontName, setFontName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: customFonts, isLoading } = useCustomFonts();
  const uploadFont = useUploadCustomFont();
  const deleteFont = useDeleteCustomFont();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vérifier que le nom est renseigné
    if (!fontName.trim()) {
      setError('Veuillez saisir un nom pour la police');
      return;
    }

    // Vérifier le format du fichier
    const allowedExtensions = ['.ttf', '.otf', '.woff', '.woff2'];
    const fileExtension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (!allowedExtensions.includes(fileExtension)) {
      setError('Format de fichier non valide. Utilisez TTF, OTF, WOFF ou WOFF2');
      return;
    }

    // Vérifier la taille (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError('La police ne doit pas dépasser 2 MB');
      return;
    }

    setError(null);

    try {
      await uploadFont.mutateAsync({ file, fontName: fontName.trim() });
      setFontName('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'upload de la police');
    }
  };

  const handleDeleteFont = async (id: string, name: string) => {
    if (!confirm(`Supprimer la police "${name}" ?`)) return;

    try {
      await deleteFont.mutateAsync(id);
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression de la police');
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="p-4 space-y-6">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Polices personnalisées</h3>
          <p className="text-xs text-gray-500">
            Uploadez des polices personnalisées pour les utiliser dans vos certificats
          </p>
        </div>

        {/* Upload Form */}
        <div className="space-y-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
          <h4 className="text-xs font-medium text-gray-700">Ajouter une police</h4>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Nom de la police
            </label>
            <input
              type="text"
              value={fontName}
              onChange={(e) => setFontName(e.target.value)}
              placeholder="ex: Ma Police Custom"
              disabled={uploadFont.isPending}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Fichier de police
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ttf,.otf,.woff,.woff2"
              onChange={handleFileSelect}
              disabled={uploadFont.isPending}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
            />
            <p className="text-xs text-gray-500 mt-2">
              TTF, OTF, WOFF ou WOFF2 • Max 2 MB
            </p>
          </div>

          {uploadFont.isPending && (
            <div className="text-xs text-blue-600 flex items-center gap-2">
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
              Upload en cours...
            </div>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {/* Liste des polices */}
        <div className="space-y-2">
          <label className="block text-xs font-medium text-gray-600">
            Polices disponibles ({customFonts?.length || 0})
          </label>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-xs text-gray-500">Chargement des polices...</p>
            </div>
          ) : customFonts && customFonts.length > 0 ? (
            <div className="space-y-2">
              {customFonts.map((font) => (
                <div
                  key={font.id}
                  className="border border-gray-200 rounded-lg p-3 bg-white hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Type className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {font.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Format: {font.file_format.toUpperCase()}
                          {font.file_size && ` • ${(font.file_size / 1024).toFixed(1)} KB`}
                        </p>
                        {/* Preview avec la font appliquée */}
                        <style>
                          {`
                            @font-face {
                              font-family: 'custom-${font.id}';
                              src: url('${font.file_url}');
                            }
                          `}
                        </style>
                        <p
                          className="text-xs text-gray-700 mt-2 italic"
                          style={{ fontFamily: `'custom-${font.id}', sans-serif` }}
                        >
                          Aperçu: {font.name}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteFont(font.id, font.name)}
                      disabled={deleteFont.isPending}
                      className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                      title="Supprimer la police"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border border-gray-200 rounded-lg bg-gray-50">
              <Type className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-xs text-gray-500">Aucune police personnalisée</p>
              <p className="text-xs text-gray-400 mt-1">
                Uploadez une police pour la rendre disponible dans l'éditeur
              </p>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-700">
            <strong>Info:</strong> Les polices personnalisées seront disponibles dans la liste des
            polices lors de l'édition d'éléments texte. Assurez-vous d'avoir les droits d'utilisation
            pour les polices que vous uploadez.
          </p>
        </div>
      </div>
    </div>
  );
};
