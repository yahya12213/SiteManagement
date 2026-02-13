import React, { useState, useRef } from 'react';
import { Upload, Link, X, AlertCircle, Image as ImageIcon, FolderOpen } from 'lucide-react';
import type { CertificateTemplate } from '@/types/certificateTemplate';
import { certificateTemplatesApi } from '@/lib/api/certificateTemplates';
import { getRecommendedImageDimensions } from '@/lib/utils/canvasDimensions';

interface BackgroundImageManagerProps {
  template: CertificateTemplate;
  onUpdate: (template: CertificateTemplate) => void;
  pageId?: string; // ID de la page actuelle pour support multi-pages
}

export const BackgroundImageManager: React.FC<BackgroundImageManagerProps> = ({
  template,
  onUpdate,
  pageId,
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'url' | 'path'>('upload');
  const [url, setUrl] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pathInputRef = useRef<HTMLInputElement>(null);

  // Obtenir les dimensions recommandées en fonction du format et de l'orientation
  const recommendedDimensions = getRecommendedImageDimensions(
    template.template_config.layout.format,
    template.template_config.layout.orientation,
    template.template_config.layout.customWidth,
    template.template_config.layout.customHeight
  );

  // Helper function to update background correctly for both page-level and template-level
  const updateBackground = (backgroundUrl: string, backgroundType: 'upload' | 'url') => {
    if (pageId && template.template_config?.pages) {
      // Multi-pages: mettre à jour dans template_config.pages[]
      const updatedPages = template.template_config.pages.map(page => {
        if (page.id === pageId) {
          return {
            ...page,
            background_image_url: backgroundUrl,
            background_image_type: backgroundType,
          };
        }
        return page;
      });

      onUpdate({
        ...template,
        template_config: {
          ...template.template_config,
          pages: updatedPages,
        },
      });
    } else {
      // Comportement original: niveau template
      onUpdate({
        ...template,
        background_image_url: backgroundUrl,
        background_image_type: backgroundType,
      });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      setError('Veuillez sélectionner une image (JPG, PNG, WEBP ou SVG)');
      return;
    }

    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('L\'image ne doit pas dépasser 5 MB');
      return;
    }

    // Pour les nouveaux templates, on doit d'abord sauvegarder avant d'uploader
    if (template.id === 'new') {
      setError('Veuillez d\'abord enregistrer le template avant d\'uploader une image. Utilisez l\'onglet "URL" pour définir une URL directement.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Passer pageId à l'API si fourni (support multi-pages)
      const result = await certificateTemplatesApi.uploadBackground(template.id, file, pageId);

      // IMPORTANT: Ne pas utiliser result.template car il écrase les modifications locales
      // On utilise uniquement l'URL retournée pour mettre à jour la page actuelle
      const backgroundUrl = result.background_url || result.template?.background_image_url;

      if (backgroundUrl) {
        updateBackground(backgroundUrl, 'upload');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'upload de l\'image');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleUrlSubmit = async () => {
    if (!url.trim()) {
      setError('Veuillez saisir une URL');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Pour les nouveaux templates (id === 'new'), on met à jour uniquement localement
      // L'URL sera sauvegardée en base quand le template sera enregistré
      if (template.id === 'new') {
        updateBackground(url.trim(), 'url');
        setUrl('');
      } else {
        // Passer pageId à l'API si fourni (support multi-pages)
        const result = await certificateTemplatesApi.setBackgroundUrl(template.id, url.trim(), pageId);

        // IMPORTANT: Ne pas utiliser result.template car il écrase les modifications locales
        const backgroundUrl = result.background_url || result.template?.background_image_url || url.trim();

        updateBackground(backgroundUrl, 'url');
        setUrl('');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la définition de l\'URL');
    } finally {
      setIsUploading(false);
    }
  };

  // Upload depuis un chemin local - envoie directement le chemin au serveur
  const handleLocalPathSubmit = async () => {
    if (!localPath.trim()) {
      setError('Veuillez saisir un chemin de fichier');
      return;
    }

    // Vérifier que c'est un chemin de fichier image valide
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif'];
    const lowerPath = localPath.toLowerCase();
    const hasValidExtension = validExtensions.some(ext => lowerPath.endsWith(ext));

    if (!hasValidExtension) {
      setError('Le fichier doit être une image (JPG, PNG, WEBP, SVG ou GIF)');
      return;
    }

    // Pour les nouveaux templates, on doit d'abord sauvegarder avant d'uploader
    if (template.id === 'new') {
      setError('Veuillez d\'abord enregistrer le template avant d\'uploader une image. Utilisez l\'onglet "URL" pour définir une URL directement.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Envoyer directement le chemin au serveur qui va lire le fichier
      const result = await certificateTemplatesApi.uploadBackgroundFromPath(template.id, localPath.trim(), pageId);
      const backgroundUrl = result.background_url || result.template?.background_image_url;

      if (backgroundUrl) {
        updateBackground(backgroundUrl, 'upload');
        setLocalPath('');
        setError(null);
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'upload depuis le chemin local. Vérifiez que le serveur a accès à ce chemin.');
    } finally {
      setIsUploading(false);
    }
  };

  // Ouvrir directement le sélecteur de fichier
  const handleOpenFilePicker = async () => {
    // Pour les nouveaux templates, on doit d'abord sauvegarder avant d'uploader
    if (template.id === 'new') {
      setError('Veuillez d\'abord enregistrer le template avant d\'uploader une image. Utilisez l\'onglet "URL" pour définir une URL directement.');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Vérifier si le File System Access API est supporté
      if ('showOpenFilePicker' in window) {
        const [fileHandle] = await (window as any).showOpenFilePicker({
          types: [
            {
              description: 'Images',
              accept: {
                'image/*': ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif'],
              },
            },
          ],
          multiple: false,
        });

        const file = await fileHandle.getFile();

        // Mettre à jour le chemin affiché
        setLocalPath(file.name);

        // Uploader le fichier
        const result = await certificateTemplatesApi.uploadBackground(template.id, file, pageId);

        const backgroundUrl = result.background_url || result.template?.background_image_url;

        if (backgroundUrl) {
          updateBackground(backgroundUrl, 'upload');
          setLocalPath('');
          setError(null);
        }
      } else {
        // Fallback: utiliser l'input file standard
        fileInputRef.current?.click();
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // L'utilisateur a annulé
        setError(null);
      } else {
        setError(err.message || 'Erreur lors de la sélection du fichier');
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteBackground = async () => {
    if (!confirm('Supprimer l\'arrière-plan ?')) return;

    setIsUploading(true);
    setError(null);

    try {
      // Pour les nouveaux templates, on supprime uniquement localement
      if (template.id === 'new') {
        if (pageId && template.template_config?.pages) {
          // Multi-pages: supprimer le background de la page spécifique
          const updatedPages = template.template_config.pages.map(page => {
            if (page.id === pageId) {
              return {
                ...page,
                background_image_url: undefined,
                background_image_type: undefined,
              };
            }
            return page;
          });

          onUpdate({
            ...template,
            template_config: {
              ...template.template_config,
              pages: updatedPages,
            },
          });
        } else {
          onUpdate({
            ...template,
            background_image_url: undefined,
            background_image_type: undefined,
          });
        }
      } else {
        // Passer pageId à l'API si fourni (support multi-pages)
        await certificateTemplatesApi.deleteBackground(template.id, pageId);

        // IMPORTANT: Ne pas utiliser result.template car il écrase les modifications locales
        // Supprimer uniquement le background_image_url de la page actuelle
        if (pageId && template.template_config?.pages) {
          const updatedPages = template.template_config.pages.map(page => {
            if (page.id === pageId) {
              return {
                ...page,
                background_image_url: undefined,
                background_image_type: undefined,
              };
            }
            return page;
          });

          onUpdate({
            ...template,
            template_config: {
              ...template.template_config,
              pages: updatedPages,
            },
          });
        } else {
          onUpdate({
            ...template,
            background_image_url: undefined,
            background_image_type: undefined,
          });
        }
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la suppression de l\'arrière-plan');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      setError('Veuillez déposer une image (JPG, PNG, WEBP ou SVG)');
      return;
    }

    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('L\'image ne doit pas dépasser 5 MB');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Passer pageId à l'API si fourni (support multi-pages)
      const result = await certificateTemplatesApi.uploadBackground(template.id, file, pageId);

      // IMPORTANT: Ne pas utiliser result.template car il écrase les modifications locales
      const backgroundUrl = result.background_url || result.template?.background_image_url;

      if (backgroundUrl) {
        onUpdate({
          ...template,
          background_image_url: backgroundUrl,
          background_image_type: 'upload',
        });
      }
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'upload de l\'image');
    } finally {
      setIsUploading(false);
    }
  };

  // Obtenir l'URL et le type du background actuel (page-level ou template-level)
  const getCurrentBackground = () => {
    // Pour les templates multi-pages, chercher d'abord dans pages[]
    if (pageId && template.template_config?.pages) {
      const currentPage = template.template_config.pages.find((p: any) => p.id === pageId);
      if (currentPage?.background_image_url) {
        return {
          url: currentPage.background_image_url,
          type: currentPage.background_image_type || 'url',
        };
      }
    }
    // Fallback au niveau template
    if (template.background_image_url) {
      return {
        url: template.background_image_url,
        type: template.background_image_type || 'url',
      };
    }
    return null;
  };

  const currentBackground = getCurrentBackground();

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="p-4 space-y-6">
        {/* Header */}
        <div className="border-b border-gray-200 pb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-1">Image d'arrière-plan</h3>
          <p className="text-xs text-gray-500">
            Uploadez une image ou définissez une URL pour le fond du certificat
          </p>
        </div>

        {/* Aperçu actuel */}
        {currentBackground && (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600">Arrière-plan actuel</label>
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <ImageIcon className="h-4 w-4 text-blue-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-gray-700 truncate font-mono">
                      {currentBackground.url}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Type: {currentBackground.type === 'upload' ? 'Fichier uploadé' : 'URL externe'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDeleteBackground}
                  disabled={isUploading}
                  className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                  title="Supprimer l'arrière-plan"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Preview image */}
              <div className="mt-3">
                <img
                  src={currentBackground.url}
                  alt="Aperçu arrière-plan"
                  className="w-full h-32 object-cover rounded border border-gray-200"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab('upload')}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === 'upload'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Upload className="h-3 w-3 inline mr-1" />
            Upload
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('path')}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === 'path'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <FolderOpen className="h-3 w-3 inline mr-1" />
            Chemin
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
              activeTab === 'url'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Link className="h-3 w-3 inline mr-1" />
            URL
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'upload' && (
          <div className="space-y-4">
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={isUploading}
              className="hidden"
              title="Sélectionner une image"
              aria-label="Sélectionner une image d'arrière-plan"
            />

            {/* Drag & Drop Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/50'
              } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <Upload className={`h-12 w-12 mx-auto mb-3 ${isDragging ? 'text-blue-600' : 'text-gray-400'}`} />
              <p className="text-sm font-medium text-gray-700 mb-1">
                {isDragging ? 'Déposez l\'image ici' : 'Glissez-déposez une image ou cliquez pour parcourir'}
              </p>
              <p className="text-xs text-gray-500">
                JPG, PNG, WEBP ou SVG • Max 5 MB
              </p>
              <p className="text-xs text-blue-600 font-medium mt-2">
                Recommandé: {recommendedDimensions}
              </p>
              {isUploading && (
                <div className="mt-4">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="text-xs text-gray-600 mt-2">Upload en cours...</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'path' && (
          <div className="space-y-4">
            {/* Bouton principal pour parcourir */}
            <button
              type="button"
              onClick={handleOpenFilePicker}
              disabled={isUploading}
              className="w-full px-4 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {isUploading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Upload en cours...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <FolderOpen className="h-5 w-5" />
                  Parcourir et sélectionner un fichier
                </span>
              )}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-white text-gray-500">ou coller un chemin</span>
              </div>
            </div>

            <div>
              <label htmlFor="localPathInput" className="block text-xs font-medium text-gray-600 mb-2">
                Chemin du fichier local
              </label>
              <div className="flex gap-2">
                <input
                  id="localPathInput"
                  ref={pathInputRef}
                  type="text"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  placeholder="C:\Users\...\image.jpg"
                  disabled={isUploading}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 font-mono text-xs"
                />
                <button
                  type="button"
                  onClick={handleLocalPathSubmit}
                  disabled={isUploading || !localPath.trim()}
                  className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 text-xs font-medium whitespace-nowrap"
                >
                  Uploader
                </button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs text-blue-700">
                <strong>Astuce:</strong> Cliquez sur "Parcourir" pour sélectionner directement un fichier depuis votre ordinateur. Le fichier sera uploadé sur le serveur.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'url' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="urlInput" className="block text-xs font-medium text-gray-600 mb-2">
                URL de l'image
              </label>
              <input
                id="urlInput"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://exemple.com/image.jpg"
                disabled={isUploading}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
              />
            </div>
            <button
              type="button"
              onClick={handleUrlSubmit}
              disabled={isUploading || !url.trim()}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {isUploading ? 'Application...' : 'Appliquer l\'URL'}
            </button>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {/* Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-700">
            <strong>Astuce:</strong> L'image d'arrière-plan sera affichée en plein écran sur le
            canvas. Vous pourrez ensuite placer vos éléments texte par-dessus.
          </p>
        </div>
      </div>
    </div>
  );
};
