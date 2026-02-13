import React, { useEffect } from 'react';
import { X, Download, ChevronLeft, ChevronRight, FileText } from 'lucide-react';

interface FileData {
  name: string;
  size: number;
  type: string;
  data: string; // Base64 data URL
  uploadedAt: string;
}

interface FilePreviewModalProps {
  files: FileData[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  files,
  currentIndex,
  onClose,
  onNavigate,
}) => {
  const currentFile = files[currentIndex];

  // Fermer avec la touche Échap
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Navigation avec les flèches
  useEffect(() => {
    const handleArrows = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        onNavigate(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && currentIndex < files.length - 1) {
        onNavigate(currentIndex + 1);
      }
    };

    window.addEventListener('keydown', handleArrows);
    return () => window.removeEventListener('keydown', handleArrows);
  }, [currentIndex, files.length, onNavigate]);

  // Fonction de téléchargement
  const handleDownload = () => {
    try {
      // Extraire le base64 et le type MIME
      const base64Data = currentFile.data.split(',')[1];
      const mimeType = currentFile.data.split(',')[0].split(':')[1].split(';')[0];

      // Convertir en Blob
      const byteString = atob(base64Data);
      const arrayBuffer = new ArrayBuffer(byteString.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      for (let i = 0; i < byteString.length; i++) {
        uint8Array[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([arrayBuffer], { type: mimeType });

      // Télécharger
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = currentFile.name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur lors du téléchargement:', error);
      alert('Erreur lors du téléchargement du fichier');
    }
  };

  // Formater la taille du fichier
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  // Déterminer si c'est une image
  const isImage = currentFile.type.startsWith('image/');
  const isPDF = currentFile.type === 'application/pdf';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-lg">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {currentFile.name}
            </h3>
            <p className="text-sm text-gray-500">
              {formatFileSize(currentFile.size)} • {currentFile.type}
            </p>
          </div>

          <div className="flex items-center gap-2 ml-4">
            {/* Bouton télécharger */}
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              title="Télécharger"
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Télécharger</span>
            </button>

            {/* Bouton fermer */}
            <button
              onClick={onClose}
              className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              title="Fermer (Échap)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenu principal */}
        <div className="flex-1 overflow-auto p-6 bg-gray-100">
          {isImage ? (
            // Prévisualisation image
            <div className="flex items-center justify-center h-full">
              <img
                src={currentFile.data}
                alt={currentFile.name}
                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
              />
            </div>
          ) : isPDF ? (
            // Prévisualisation PDF
            <iframe
              src={currentFile.data}
              className="w-full h-full min-h-[600px] rounded-lg shadow-lg"
              title={currentFile.name}
            />
          ) : (
            // Autres types de fichiers
            <div className="flex flex-col items-center justify-center h-full text-center">
              <FileText className="w-24 h-24 text-gray-400 mb-4" />
              <h4 className="text-xl font-semibold text-gray-700 mb-2">
                Prévisualisation non disponible
              </h4>
              <p className="text-gray-500 mb-6">
                Ce type de fichier ne peut pas être prévisualisé.<br />
                Cliquez sur "Télécharger" pour l'ouvrir sur votre ordinateur.
              </p>
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Download className="w-4 h-4" />
                Télécharger le fichier
              </button>
            </div>
          )}
        </div>

        {/* Navigation (si plusieurs fichiers) */}
        {files.length > 1 && (
          <div className="flex items-center justify-between p-4 border-t bg-gray-50">
            <button
              onClick={() => onNavigate(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Précédent
            </button>

            <span className="text-sm text-gray-600">
              {currentIndex + 1} / {files.length}
            </span>

            <button
              onClick={() => onNavigate(currentIndex + 1)}
              disabled={currentIndex === files.length - 1}
              className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Suivant
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FilePreviewModal;
