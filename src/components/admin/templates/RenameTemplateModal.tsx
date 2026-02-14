import React, { useState, useEffect } from 'react';
import { X, Edit3 } from 'lucide-react';

interface RenameTemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newName: string) => void;
  currentName: string;
  isLoading?: boolean;
}

/**
 * Modal pour renommer un template de certificat
 */
export const RenameTemplateModal: React.FC<RenameTemplateModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  currentName,
  isLoading = false,
}) => {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setName(currentName);
      setError('');
    }
  }, [isOpen, currentName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();

    if (!trimmedName) {
      setError('Le nom du template est requis');
      return;
    }

    if (trimmedName === currentName) {
      setError('Le nouveau nom doit être différent de l\'ancien');
      return;
    }

    if (trimmedName.length < 3) {
      setError('Le nom doit contenir au moins 3 caractères');
      return;
    }

    if (trimmedName.length > 100) {
      setError('Le nom ne peut pas dépasser 100 caractères');
      return;
    }

    onSubmit(trimmedName);
  };

  const handleClose = () => {
    if (!isLoading) {
      setName(currentName);
      setError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-[95vw] sm:w-[450px] md:w-[500px] max-w-[95vw]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Edit3 className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Renommer le Template</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-2 hover:bg-blue-200 rounded-lg transition-colors disabled:opacity-50"
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

          {/* Current Name Display */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Nom actuel
            </label>
            <div className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
              {currentName}
            </div>
          </div>

          {/* New Name Input */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Nouveau nom <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError('');
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="Entrez le nouveau nom"
              autoFocus
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1.5">Minimum 3 caractères, maximum 100</p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Renommage...' : 'Renommer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
