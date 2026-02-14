import React, { useState, useMemo, useEffect } from 'react';
import { X, FolderOpen, Folder, FileText, Search, Award, Check, ChevronRight, ChevronDown } from 'lucide-react';
import { useCertificateTemplates } from '@/hooks/useCertificateTemplates';
import { useTemplateFolders } from '@/hooks/useTemplateFolders';

interface TemplateFolder {
  id: string;
  name: string;
  parent_id: string | null;
  created_at?: string;
}

interface TemplateSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (templateIds: string[]) => void;
  selectedTemplateIds?: string[];
  title?: string;
}

export const TemplateSelectionModal: React.FC<TemplateSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  selectedTemplateIds = [],
  title = 'Sélectionner des templates de certificat',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(selectedTemplateIds);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const { data: templates, isLoading: loadingTemplates } = useCertificateTemplates();
  const { data: folders, isLoading: loadingFolders } = useTemplateFolders();

  // Synchroniser avec les templates déjà sélectionnés quand le modal s'ouvre
  useEffect(() => {
    if (isOpen) {
      setLocalSelectedIds(selectedTemplateIds);
      // Expand all folders by default when opening
      if (folders) {
        setExpandedFolders(new Set(folders.map(f => f.id)));
      }
    }
  }, [isOpen, selectedTemplateIds, folders]);

  // Construire l'arborescence des dossiers
  const folderTree = useMemo(() => {
    if (!folders) return [];

    // Fonction récursive pour construire l'arbre
    const buildTree = (parentId: string | null): (TemplateFolder & { children: any[], level: number })[] => {
      return folders
        .filter(f => f.parent_id === parentId)
        .map(folder => ({
          ...folder,
          children: buildTree(folder.id),
          level: 0
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    };

    // Fonction pour aplatir l'arbre avec les niveaux
    const flattenTree = (tree: any[], level: number = 0): (TemplateFolder & { level: number, hasChildren: boolean })[] => {
      let result: (TemplateFolder & { level: number, hasChildren: boolean })[] = [];
      for (const node of tree) {
        result.push({
          ...node,
          level,
          hasChildren: node.children.length > 0
        });
        if (expandedFolders.has(node.id)) {
          result = result.concat(flattenTree(node.children, level + 1));
        }
      }
      return result;
    };

    const tree = buildTree(null);
    return flattenTree(tree);
  }, [folders, expandedFolders]);

  // Toggle expansion d'un dossier
  const toggleFolderExpand = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  // Obtenir les IDs de tous les sous-dossiers d'un dossier
  const getAllSubfolderIds = (folderId: string): string[] => {
    if (!folders) return [];
    const subfolders = folders.filter(f => f.parent_id === folderId);
    let ids = subfolders.map(f => f.id);
    for (const subfolder of subfolders) {
      ids = ids.concat(getAllSubfolderIds(subfolder.id));
    }
    return ids;
  };

  // Filtrer les templates par dossier (inclure les sous-dossiers) et recherche
  const filteredTemplates = useMemo(() => {
    if (!templates) return [];

    let result = templates;

    // Filtre par dossier (inclure les sous-dossiers)
    if (selectedFolderId) {
      const folderIds = [selectedFolderId, ...getAllSubfolderIds(selectedFolderId)];
      result = result.filter((t) => folderIds.includes(t.folder_id));
    }

    // Filtre par recherche
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.description?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [templates, selectedFolderId, searchQuery, folders]);

  // Compter les templates par dossier (inclure les sous-dossiers)
  const getTemplateCount = (folderId: string | null): number => {
    if (!templates) return 0;
    if (folderId === null) return templates.length;

    const folderIds = [folderId, ...getAllSubfolderIds(folderId)];
    return templates.filter(t => folderIds.includes(t.folder_id)).length;
  };

  // Toggle sélection d'un template
  const toggleTemplate = (templateId: string) => {
    setLocalSelectedIds((prev) =>
      prev.includes(templateId)
        ? prev.filter((id) => id !== templateId)
        : [...prev, templateId]
    );
  };

  // Sélectionner tous les templates filtrés
  const selectAll = () => {
    const allFilteredIds = filteredTemplates.map((t) => t.id);
    const newSelection = [...new Set([...localSelectedIds, ...allFilteredIds])];
    setLocalSelectedIds(newSelection);
  };

  // Désélectionner tous les templates filtrés
  const deselectAll = () => {
    const filteredIds = filteredTemplates.map((t) => t.id);
    setLocalSelectedIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
  };

  // Obtenir les templates sélectionnés
  const selectedTemplates = useMemo(() => {
    if (!templates) return [];
    return templates.filter((t) => localSelectedIds.includes(t.id));
  }, [templates, localSelectedIds]);

  // Identifier les templates déjà affectés (provenant des props)
  const alreadyAssignedIds = useMemo(() => new Set(selectedTemplateIds), [selectedTemplateIds]);

  const handleConfirm = () => {
    onSelect(localSelectedIds);
    onClose();
  };

  const handleCancel = () => {
    setLocalSelectedIds(selectedTemplateIds); // Reset
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={handleCancel}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Folder Tree */}
          <div className="w-64 border-r border-gray-200 overflow-y-auto bg-gray-50 p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
              Dossiers
            </h3>

            {/* All Templates */}
            <div
              onClick={() => setSelectedFolderId(null)}
              className={`flex items-center gap-2 px-3 py-2 rounded cursor-pointer mb-1 transition-colors ${
                selectedFolderId === null
                  ? 'bg-blue-100 text-blue-700'
                  : 'hover:bg-gray-200 text-gray-700'
              }`}
            >
              <FolderOpen className="h-4 w-4" />
              <span className="text-sm font-medium">Tous les templates</span>
              <span className="ml-auto text-xs text-gray-500">
                {templates?.length || 0}
              </span>
            </div>

            {/* Folder Tree */}
            {loadingFolders ? (
              <div className="text-xs text-gray-500 px-3 py-2">Chargement...</div>
            ) : (
              <div className="space-y-0.5">
                {folderTree.map((folder) => {
                  const isExpanded = expandedFolders.has(folder.id);
                  const templateCount = getTemplateCount(folder.id);

                  return (
                    <div
                      key={folder.id}
                      onClick={() => setSelectedFolderId(folder.id)}
                      className={`flex items-center gap-1 px-2 py-2 rounded cursor-pointer transition-colors ${
                        selectedFolderId === folder.id
                          ? 'bg-blue-100 text-blue-700'
                          : 'hover:bg-gray-200 text-gray-700'
                      }`}
                      style={{ paddingLeft: `${8 + folder.level * 16}px` }}
                    >
                      {/* Expand/Collapse button */}
                      {folder.hasChildren ? (
                        <button
                          onClick={(e) => toggleFolderExpand(folder.id, e)}
                          className="p-0.5 hover:bg-gray-300 rounded"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </button>
                      ) : (
                        <span className="w-4" />
                      )}

                      <Folder className="h-4 w-4 flex-shrink-0" />
                      <span className="text-sm flex-1 truncate">{folder.name}</span>
                      <span className="text-xs text-gray-500">{templateCount}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Panel - Templates Grid */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Search Bar */}
            <div className="p-4 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un template..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              {/* Select All / Deselect All */}
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                >
                  Tout sélectionner
                </button>
                <span className="text-xs text-gray-400">•</span>
                <button
                  onClick={deselectAll}
                  className="text-xs text-gray-600 hover:text-gray-700 font-medium"
                >
                  Tout désélectionner
                </button>
                <span className="ml-auto text-xs text-gray-600">
                  {localSelectedIds.length} sélectionné{localSelectedIds.length > 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Templates Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingTemplates ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-gray-500 text-sm">Chargement des templates...</div>
                </div>
              ) : filteredTemplates.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <FileText className="h-12 w-12 mb-2 text-gray-300" />
                  <p className="text-sm">Aucun template trouvé</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {filteredTemplates.map((template) => {
                    const isSelected = localSelectedIds.includes(template.id);
                    const wasAlreadyAssigned = alreadyAssignedIds.has(template.id);

                    return (
                      <div
                        key={template.id}
                        onClick={() => toggleTemplate(template.id)}
                        className={`relative border rounded-lg p-4 cursor-pointer transition-all min-h-[100px] ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 shadow-md'
                            : 'border-gray-200 hover:border-blue-300 hover:shadow-sm'
                        }`}
                        title={template.name}
                      >
                        {/* Badge "Déjà affecté" */}
                        {wasAlreadyAssigned && (
                          <div className="absolute top-0 left-0 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-tl-lg rounded-br-lg">
                            Déjà affecté
                          </div>
                        )}

                        {/* Checkbox */}
                        <div
                          className={`absolute top-3 right-3 w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isSelected
                              ? 'bg-blue-600 border-blue-600'
                              : 'border-gray-300 bg-white'
                          }`}
                        >
                          {isSelected && <Check className="h-3 w-3 text-white" />}
                        </div>

                        {/* Template Info */}
                        <div className={`flex items-start gap-3 ${wasAlreadyAssigned ? 'pt-4' : ''} pr-6`}>
                          <Award className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-sm text-gray-900 line-clamp-2" title={template.name}>
                              {template.name}
                            </h4>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                              {template.description || 'Aucune description'}
                            </p>
                            <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
                              <span className="px-2 py-0.5 bg-gray-100 rounded">
                                {template.template_config?.layout?.format?.toUpperCase() || 'A4'}
                              </span>
                              <span>
                                {template.template_config?.layout?.orientation === 'landscape'
                                  ? 'Paysage'
                                  : 'Portrait'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer - Selected Templates Preview */}
        {localSelectedIds.length > 0 && (
          <div className="border-t border-gray-200 p-4 bg-gray-50">
            <div className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">
              Templates sélectionnés ({localSelectedIds.length})
            </div>
            <div className="flex flex-wrap gap-2 max-h-20 overflow-y-auto">
              {selectedTemplates.map((template) => {
                const wasAlreadyAssigned = alreadyAssignedIds.has(template.id);

                return (
                  <div
                    key={template.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${
                      wasAlreadyAssigned
                        ? 'bg-green-100 text-green-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    <span className="font-medium truncate max-w-xs">{template.name}</span>
                    {wasAlreadyAssigned && (
                      <span className="text-[10px] opacity-70">(déjà)</span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTemplate(template.id);
                      }}
                      className="hover:bg-opacity-50 rounded-full p-0.5 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer - Actions */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            disabled={localSelectedIds.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Sélectionner ({localSelectedIds.length})
          </button>
        </div>
      </div>
    </div>
  );
};
