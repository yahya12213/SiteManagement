import React, { useState, useMemo } from 'react';
import { X, Copy, Folder } from 'lucide-react';
import type { TemplateFolder } from '@/types/certificateTemplate';

interface DuplicateToFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (targetFolderId: string) => void;
  folders: TemplateFolder[];
  currentFolderId: string;
  templateName: string;
  isLoading?: boolean;
}

interface FolderWithLevel {
  folder: TemplateFolder;
  level: number;
}

/**
 * Modal pour dupliquer un template vers un autre dossier
 */
export const DuplicateToFolderModal: React.FC<DuplicateToFolderModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  folders,
  currentFolderId,
  templateName,
  isLoading = false,
}) => {
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedFolderId) {
      setError('Veuillez sélectionner un dossier de destination');
      return;
    }

    if (selectedFolderId === currentFolderId) {
      setError('Veuillez choisir un dossier différent du dossier actuel');
      return;
    }

    onSubmit(selectedFolderId);
  };

  const handleClose = () => {
    if (!isLoading) {
      setSelectedFolderId('');
      setError('');
      onClose();
    }
  };

  // Trouver le nom du dossier actuel
  const currentFolder = folders.find(f => f.id === currentFolderId);

  // Build hierarchical folder list with levels for indentation
  const hierarchicalFolders = useMemo((): FolderWithLevel[] => {
    // Build a map of parent_id -> children
    const childrenMap = new Map<string | null, TemplateFolder[]>();

    folders.forEach(f => {
      const parentKey = f.parent_id || null;
      if (!childrenMap.has(parentKey)) {
        childrenMap.set(parentKey, []);
      }
      childrenMap.get(parentKey)!.push(f);
    });

    // Recursively build the hierarchical list
    const result: FolderWithLevel[] = [];

    const addFolderWithChildren = (parentId: string | null, level: number) => {
      const children = childrenMap.get(parentId) || [];
      // Sort alphabetically
      children.sort((a, b) => a.name.localeCompare(b.name));

      children.forEach(child => {
        // Skip current folder
        if (child.id === currentFolderId) {
          // Still add its children but at the same level
          addFolderWithChildren(child.id, level);
          return;
        }

        result.push({
          folder: child,
          level,
        });

        // Recursively add children
        addFolderWithChildren(child.id, level + 1);
      });
    };

    // Start from root level (parent_id = null)
    addFolderWithChildren(null, 0);

    return result;
  }, [folders, currentFolderId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-[95vw] sm:w-[450px] md:w-[500px] max-w-[95vw]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-blue-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600 rounded-lg">
              <Copy className="h-5 w-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Dupliquer vers un dossier</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="p-2 hover:bg-blue-200 rounded-lg transition-colors disabled:opacity-50"
            type="button"
            title="Fermer"
            aria-label="Fermer"
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

          {/* Template Info */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Template à dupliquer
            </label>
            <div className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 font-medium">
              {templateName}
            </div>
          </div>

          {/* Current Folder */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Dossier actuel
            </label>
            <div className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700 flex items-center gap-2">
              <Folder className="h-4 w-4 text-gray-500" />
              {currentFolder?.name || 'Tous les dossiers'}
            </div>
          </div>

          {/* Target Folder Selection */}
          <div>
            <label htmlFor="target-folder-select" className="block text-sm font-semibold text-gray-700 mb-2">
              Dossier de destination <span className="text-red-500">*</span>
            </label>
            <select
              id="target-folder-select"
              value={selectedFolderId}
              onChange={(e) => {
                setSelectedFolderId(e.target.value);
                setError('');
              }}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              disabled={isLoading}
              title="Sélectionnez le dossier de destination"
            >
              <option value="">Sélectionnez un dossier</option>
              {hierarchicalFolders.map(({ folder, level }) => (
                <option key={folder.id} value={folder.id}>
                  {'│  '.repeat(level)}├─ 📁 {folder.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1.5">
              Le template sera dupliqué avec le suffixe " - Copie"
            </p>
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
              {isLoading ? 'Duplication...' : 'Dupliquer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
