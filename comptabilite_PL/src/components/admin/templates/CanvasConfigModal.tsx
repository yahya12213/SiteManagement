import React, { useState } from 'react';
import { X, FileText } from 'lucide-react';

interface CanvasConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (config: CanvasConfig) => void;
  currentFolderName?: string;
}

export interface CanvasConfig {
  name: string;
  format: 'A4' | 'Letter' | 'Badge' | 'Custom';
  orientation: 'portrait' | 'landscape';
  margins: number;
  customWidth?: number;
  customHeight?: number;
}

const FORMATS = {
  A4: { width: 210, height: 297, label: 'A4 (210 x 297 mm)' },
  Letter: { width: 216, height: 279, label: 'Letter (216 x 279 mm)' },
  Badge: { width: 85, height: 55, label: 'Badge (85 x 55 mm)' },
  Custom: { width: 210, height: 297, label: 'Personnalisé' },
};

export const CanvasConfigModal: React.FC<CanvasConfigModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  currentFolderName,
}) => {
  const [name, setName] = useState('');
  const [format, setFormat] = useState<'A4' | 'Letter' | 'Badge' | 'Custom'>('A4');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [margins, setMargins] = useState(10);
  const [customWidth, setCustomWidth] = useState(210);
  const [customHeight, setCustomHeight] = useState(297);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('Le nom du template est requis');
      return;
    }

    if (margins < 0 || margins > 50) {
      setError('Les marges doivent être entre 0 et 50 mm');
      return;
    }

    if (format === 'Custom') {
      if (customWidth < 10 || customWidth > 500 || customHeight < 10 || customHeight > 500) {
        setError('Les dimensions personnalisées doivent être entre 10 et 500 mm');
        return;
      }
    }

    const config: CanvasConfig = {
      name: name.trim(),
      format,
      orientation,
      margins,
    };

    if (format === 'Custom') {
      config.customWidth = customWidth;
      config.customHeight = customHeight;
    }

    onSubmit(config);
    handleClose();
  };

  const handleClose = () => {
    setName('');
    setFormat('A4');
    setOrientation('portrait');
    setMargins(10);
    setCustomWidth(210);
    setCustomHeight(297);
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-[95vw] sm:w-[500px] md:w-[550px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <FileText className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Nouveau Template Canvas</h2>
              {currentFolderName && (
                <p className="text-sm text-gray-600 mt-0.5">
                  Dossier: <span className="font-medium">{currentFolderName}</span>
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-blue-200 rounded-lg transition-colors"
            type="button"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Error Message */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Name Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nom du template <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="Ex: Certificat de Formation"
              autoFocus
            />
          </div>

          {/* Format Select */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Format</label>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as any)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            >
              {Object.entries(FORMATS).map(([key, { label }]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Dimensions (only if Custom format) */}
          {format === 'Custom' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Largeur (mm)
                </label>
                <input
                  type="number"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  min="10"
                  max="500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Hauteur (mm)
                </label>
                <input
                  type="number"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  min="10"
                  max="500"
                />
              </div>
            </div>
          )}

          {/* Orientation Select */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Orientation</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setOrientation('portrait')}
                className={`px-4 py-3 border-2 rounded-lg font-medium transition-all ${
                  orientation === 'portrait'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                Portrait
              </button>
              <button
                type="button"
                onClick={() => setOrientation('landscape')}
                className={`px-4 py-3 border-2 rounded-lg font-medium transition-all ${
                  orientation === 'landscape'
                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                }`}
              >
                Paysage
              </button>
            </div>
          </div>

          {/* Margins Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Marges (mm)
            </label>
            <input
              type="number"
              value={margins}
              onChange={(e) => setMargins(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              min="0"
              max="50"
            />
            <p className="text-xs text-gray-500 mt-1">Valeur par défaut: 10mm</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="flex-1 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg font-medium"
            >
              Créer et Modifier
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
