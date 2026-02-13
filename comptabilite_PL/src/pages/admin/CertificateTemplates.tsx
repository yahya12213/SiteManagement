import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/config/permissions';
import {
  useCertificateTemplates,
  useDeleteTemplate,
  useDuplicateTemplate,
  useDuplicateToFolder,
  useMoveTemplate,
  useUpdateTemplate,
} from '@/hooks/useCertificateTemplates';
import {
  useTemplateFolderTree,
  useCreateFolder,
  useUpdateFolder,
  useDeleteFolder,
} from '@/hooks/useTemplateFolders';
import {
  Award,
  Copy,
  Trash2,
  Edit3,
  Palette,
  Folder,
  FolderPlus,
  FolderInput,
  Edit2,
  FolderOpen,
  ChevronRight,
  AlertCircle,
  CheckSquare,
  Square,
  X,
} from 'lucide-react';
import { FolderFormModal } from '@/components/admin/templates/FolderFormModal';
import { Breadcrumb } from '@/components/admin/templates/Breadcrumb';
import { CanvasConfigModal, type CanvasConfig } from '@/components/admin/templates/CanvasConfigModal';
import { RenameTemplateModal } from '@/components/admin/templates/RenameTemplateModal';
import { RenameFolderModal } from '@/components/admin/templates/RenameFolderModal';
import { DuplicateToFolderModal } from '@/components/admin/templates/DuplicateToFolderModal';
import { MoveToFolderModal } from '@/components/admin/templates/MoveToFolderModal';
import type { TemplateFolder } from '@/types/certificateTemplate';

interface LocationState {
  folderId?: string | null;
}

export const CertificateTemplates: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAuth();
  const { training } = usePermission();
  const { data: templates, isLoading, error } = useCertificateTemplates();
  const { data: folderTree, isLoading: foldersLoading } = useTemplateFolderTree();
  const deleteMutation = useDeleteTemplate();
  const duplicateMutation = useDuplicateTemplate();
  const duplicateToFolderMutation = useDuplicateToFolder();
  const moveTemplateMutation = useMoveTemplate();
  const updateTemplateMutation = useUpdateTemplate();
  const createFolderMutation = useCreateFolder();
  const updateFolderMutation = useUpdateFolder();
  const deleteFolderMutation = useDeleteFolder();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderModalMode, setFolderModalMode] = useState<'create' | 'edit'>('create');
  const [editingFolder, setEditingFolder] = useState<TemplateFolder | null>(null);
  const [showCanvasConfigModal, setShowCanvasConfigModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renamingTemplate, setRenamingTemplate] = useState<{ id: string; name: string } | null>(null);
  const [showRenameFolderModal, setShowRenameFolderModal] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<{ id: string; name: string } | null>(null);
  const [showDuplicateToFolderModal, setShowDuplicateToFolderModal] = useState(false);
  const [duplicatingTemplate, setDuplicatingTemplate] = useState<{ id: string; name: string; folderId: string } | null>(null);
  const [showMoveToFolderModal, setShowMoveToFolderModal] = useState(false);
  const [movingTemplate, setMovingTemplate] = useState<{ id: string; name: string; folderId: string } | null>(null);
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);

  // Multi-selection state
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showBulkMoveModal, setShowBulkMoveModal] = useState(false);

  // Set folder from navigation state (when returning from canvas editor)
  useEffect(() => {
    const state = location.state as LocationState | null;
    if (state?.folderId !== undefined) {
      setSelectedFolderId(state.folderId);
      // Clear the state to avoid re-applying it on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Filter templates by selected folder
  const filteredTemplates = useMemo(() => {
    if (!templates) return [];
    if (!selectedFolderId) {
      // At root: show only templates without a folder (orphan templates)
      return templates.filter((t) => !t.folder_id);
    }
    return templates.filter((t) => t.folder_id === selectedFolderId);
  }, [templates, selectedFolderId]);

  // Get selected folder info
  const selectedFolder = useMemo(() => {
    if (!selectedFolderId || !folderTree) return null;
    const findFolder = (folders: TemplateFolder[]): TemplateFolder | null => {
      for (const folder of folders) {
        if (folder.id === selectedFolderId) return folder;
        if (folder.children) {
          const found = findFolder(folder.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findFolder(folderTree);
  }, [selectedFolderId, folderTree]);

  // Get child folders of currently selected folder (for Windows Explorer view)
  const currentChildFolders = useMemo((): TemplateFolder[] => {
    if (!folderTree) return [];

    // If no folder selected, show root folders
    if (!selectedFolderId) {
      return folderTree;
    }

    // Otherwise, find the selected folder and return its children
    if (selectedFolder && selectedFolder.children) {
      return selectedFolder.children;
    }

    return [];
  }, [selectedFolderId, selectedFolder, folderTree]);

  // Build breadcrumb path from root to selected folder
  const breadcrumbPath = useMemo((): TemplateFolder[] => {
    if (!selectedFolderId || !folderTree) return [];

    const buildPath = (
      folders: TemplateFolder[],
      targetId: string,
      path: TemplateFolder[] = []
    ): TemplateFolder[] | null => {
      for (const folder of folders) {
        const currentPath = [...path, folder];
        if (folder.id === targetId) {
          return currentPath;
        }
        if (folder.children) {
          const found = buildPath(folder.children, targetId, currentPath);
          if (found) return found;
        }
      }
      return null;
    };

    return buildPath(folderTree, selectedFolderId) || [];
  }, [selectedFolderId, folderTree]);

  // Flatten folder tree for modal
  const flattenedFolders = useMemo(() => {
    if (!folderTree) return [];
    const flatten = (folders: TemplateFolder[], result: TemplateFolder[] = []): TemplateFolder[] => {
      for (const folder of folders) {
        result.push(folder);
        if (folder.children) {
          flatten(folder.children, result);
        }
      }
      return result;
    };
    return flatten(folderTree);
  }, [folderTree]);

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      setShowDeleteConfirm(null);
    } catch (error: any) {
      alert('Erreur: ' + (error.message || 'Impossible de supprimer ce template'));
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateMutation.mutateAsync(id);
    } catch (error: any) {
      alert('Erreur: ' + (error.message || 'Impossible de dupliquer ce template'));
    }
  };

  const handleRenameClick = (id: string, name: string) => {
    setRenamingTemplate({ id, name });
    setShowRenameModal(true);
  };

  const handleRenameSubmit = async (newName: string) => {
    if (!renamingTemplate) return;

    try {
      await updateTemplateMutation.mutateAsync({
        id: renamingTemplate.id,
        data: { name: newName },
      });
      setShowRenameModal(false);
      setRenamingTemplate(null);
    } catch (error: any) {
      alert('Erreur: ' + (error.message || 'Impossible de renommer ce template'));
    }
  };

  const handleDuplicateToFolderClick = (id: string, name: string, folderId: string) => {
    setDuplicatingTemplate({ id, name, folderId });
    setShowDuplicateToFolderModal(true);
  };

  const handleDuplicateToFolderSubmit = async (targetFolderId: string) => {
    if (!duplicatingTemplate) return;

    try {
      await duplicateToFolderMutation.mutateAsync({
        id: duplicatingTemplate.id,
        targetFolderId,
      });
      setShowDuplicateToFolderModal(false);
      setDuplicatingTemplate(null);
    } catch (error: any) {
      alert('Erreur: ' + (error.message || 'Impossible de dupliquer ce template'));
    }
  };

  const handleMoveToFolderClick = (id: string, name: string, folderId: string) => {
    setMovingTemplate({ id, name, folderId });
    setShowMoveToFolderModal(true);
  };

  const handleMoveToFolderSubmit = async (targetFolderId: string) => {
    if (!movingTemplate) return;

    try {
      await moveTemplateMutation.mutateAsync({
        id: movingTemplate.id,
        targetFolderId,
      });
      setShowMoveToFolderModal(false);
      setMovingTemplate(null);
    } catch (error: any) {
      alert('Erreur: ' + (error.message || 'Impossible de déplacer ce template'));
    }
  };

  // Multi-selection handlers
  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(templateId)) {
        newSet.delete(templateId);
      } else {
        newSet.add(templateId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedTemplates.size === filteredTemplates.length) {
      // Deselect all
      setSelectedTemplates(new Set());
    } else {
      // Select all filtered templates
      setSelectedTemplates(new Set(filteredTemplates.map(t => t.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedTemplates(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedTemplates.size === 0) return;

    try {
      // Delete all selected templates
      for (const templateId of selectedTemplates) {
        await deleteMutation.mutateAsync(templateId);
      }
      setSelectedTemplates(new Set());
      setShowBulkDeleteConfirm(false);
    } catch (error: any) {
      alert('Erreur: ' + (error.message || 'Impossible de supprimer certains templates'));
    }
  };

  const handleBulkMoveSubmit = async (targetFolderId: string) => {
    if (selectedTemplates.size === 0) return;

    try {
      // Move all selected templates
      for (const templateId of selectedTemplates) {
        await moveTemplateMutation.mutateAsync({
          id: templateId,
          targetFolderId,
        });
      }
      setSelectedTemplates(new Set());
      setShowBulkMoveModal(false);
    } catch (error: any) {
      alert('Erreur: ' + (error.message || 'Impossible de déplacer certains templates'));
    }
  };

  const handleRenameFolderClick = (id: string, name: string) => {
    setRenamingFolder({ id, name });
    setShowRenameFolderModal(true);
  };

  const handleRenameFolderSubmit = async (newName: string) => {
    if (!renamingFolder) return;

    try {
      await updateFolderMutation.mutateAsync({
        id: renamingFolder.id,
        data: { name: newName },
      });
      setShowRenameFolderModal(false);
      setRenamingFolder(null);
    } catch (error: any) {
      alert('Erreur: ' + (error.message || 'Impossible de renommer ce dossier'));
    }
  };

  const handleDeleteFolderClick = (folderId: string) => {
    setDeletingFolderId(folderId);
  };

  const handleDeleteFolderConfirm = async () => {
    if (!deletingFolderId) return;

    try {
      await deleteFolderMutation.mutateAsync(deletingFolderId);
      if (selectedFolderId === deletingFolderId) {
        setSelectedFolderId(null);
      }
      setDeletingFolderId(null);
    } catch (error: any) {
      alert('Erreur: ' + (error.message || 'Impossible de supprimer ce dossier'));
      setDeletingFolderId(null);
    }
  };

  const handleCreateFolder = () => {
    setFolderModalMode('create');
    setEditingFolder(null);
    setShowFolderModal(true);
  };

  const handleFolderFormSubmit = async (name: string, parentId?: string | null) => {
    try {
      if (folderModalMode === 'create') {
        // Create subfolder in current location, or root if none selected
        await createFolderMutation.mutateAsync({
          name,
          parent_id: parentId !== undefined ? parentId : selectedFolderId
        });
      } else if (editingFolder) {
        await updateFolderMutation.mutateAsync({ id: editingFolder.id, data: { name } });
      }
      setShowFolderModal(false);
    } catch (error: any) {
      alert('Erreur: ' + (error.message || 'Impossible d\'enregistrer le dossier'));
    }
  };

  const handleCreateCanvasTemplate = () => {
    if (flattenedFolders.length === 0) {
      alert('Veuillez d\'abord créer au moins un dossier avant de créer un template.');
      handleCreateFolder();
      return;
    }
    // Open config modal
    setShowCanvasConfigModal(true);
  };

  const handleCanvasConfigSubmit = (config: CanvasConfig) => {
    // Get folder ID
    const folderId = selectedFolderId || flattenedFolders[0]?.id;

    // Build query params with configuration
    const params = new URLSearchParams({
      folderId,
      name: config.name,
      format: config.format,
      orientation: config.orientation,
      margins: config.margins.toString(),
    });

    // Add custom dimensions if Custom format
    if (config.format === 'Custom' && config.customWidth && config.customHeight) {
      params.set('customWidth', config.customWidth.toString());
      params.set('customHeight', config.customHeight.toString());
    }

    // Navigate to Canvas editor with config
    navigate(`/admin/certificate-templates/new/canvas-edit?${params.toString()}`);
  };

  if (isLoading || foldersLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Chargement des templates...</div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="h-5 w-5" />
            <span>Erreur lors du chargement des templates</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Award className="h-7 w-7 text-blue-600" />
              Templates de Certificats
            </h1>
            <p className="text-sm text-gray-600 mt-1">
              Gérez les templates utilisés pour générer les certificats
            </p>
          </div>

          <div className="flex gap-3">
            {/* Nouveau Dossier Button - Creates subfolder in current location */}
            {hasPermission(PERMISSIONS.training.certificate_templates.create_folder) && (
              <button
                onClick={handleCreateFolder}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all shadow-md hover:shadow-lg flex items-center gap-2 font-medium"
              >
                <FolderPlus className="h-5 w-5" />
                Nouveau Dossier
              </button>
            )}

            {/* Ajouter Template Canvas Button - Creates template in current folder */}
            {hasPermission(PERMISSIONS.training.certificate_templates.create_template) && (
              <button
                onClick={handleCreateCanvasTemplate}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg flex items-center gap-2 font-medium"
              >
                <Palette className="h-5 w-5" />
                Ajouter Template Canvas
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
            <div className="text-sm text-blue-600 font-medium">Total Templates</div>
            <div className="text-3xl font-bold text-blue-900 mt-1">{templates?.length || 0}</div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
            <div className="text-sm text-purple-600 font-medium">Dossiers</div>
            <div className="text-3xl font-bold text-purple-900 mt-1">
              {flattenedFolders?.length || 0}
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
            <div className="text-sm text-green-600 font-medium">Dossier Actuel</div>
            <div className="text-lg font-bold text-green-900 mt-1 truncate">
              {selectedFolder ? selectedFolder.name : 'Tous'} ({filteredTemplates.length} templates)
            </div>
          </div>
        </div>

        {/* Breadcrumb Navigation */}
        <Breadcrumb currentPath={breadcrumbPath} onNavigate={setSelectedFolderId} />

        {/* Main Content: Full-Width Windows Explorer View */}
        <div>
            {currentChildFolders.length === 0 && filteredTemplates.length === 0 ? (
              <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
                <Folder className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 text-sm">
                  {flattenedFolders.length === 0
                    ? 'Aucun dossier. Utilisez le bouton "Nouveau Dossier" pour commencer.'
                    : selectedFolder
                    ? `Ce dossier est vide`
                    : 'Aucun contenu'}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Folders Section (Windows Explorer Style) */}
                {currentChildFolders.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <Folder className="h-4 w-4" />
                      Dossiers ({currentChildFolders.length})
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                      {currentChildFolders.map((folder) => (
                        <div
                          key={folder.id}
                          className="relative bg-white rounded-lg border-2 border-gray-200 hover:border-purple-300 hover:shadow-lg transition-all duration-200"
                        >
                          {/* Clickable Folder Area */}
                          <button
                            onClick={() => setSelectedFolderId(folder.id)}
                            className="group w-full p-5 text-left"
                          >
                            {/* Folder Icon Area - Larger */}
                            <div className="flex items-center gap-3 mb-3">
                              <div className="p-3 bg-gradient-to-br from-purple-100 to-purple-200 rounded-lg group-hover:from-purple-200 group-hover:to-purple-300 transition-all">
                                <FolderOpen className="h-8 w-8 text-purple-600" />
                              </div>
                              <ChevronRight className="h-5 w-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
                            </div>

                            {/* Folder Info */}
                            <div>
                              <h4 className="font-bold text-gray-900 text-sm mb-1 truncate group-hover:text-purple-700 transition-colors">
                                {folder.name}
                              </h4>
                              <p className="text-xs text-gray-500">
                                {folder.template_count || 0} template{(folder.template_count || 0) !== 1 ? 's' : ''}
                                {folder.children && folder.children.length > 0 && (
                                  <> • {folder.children.length} sous-dossier{folder.children.length !== 1 ? 's' : ''}</>
                                )}
                              </p>
                            </div>
                          </button>

                          {/* Action Buttons */}
                          <div className="px-5 pb-4 flex gap-2">
                            {training.canRenameFolder && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRenameFolderClick(folder.id, folder.name);
                                }}
                                className="flex-1 px-2 py-1.5 bg-green-50 text-green-700 rounded border border-green-300 hover:bg-green-100 transition-colors text-xs font-medium flex items-center justify-center gap-1"
                                title="Renommer le dossier"
                              >
                                <Edit2 className="h-3 w-3" />
                                Renommer
                              </button>
                            )}

                            {training.canDeleteFolder && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteFolderClick(folder.id);
                                }}
                                disabled={deleteFolderMutation.isPending && deletingFolderId === folder.id}
                                className="flex-1 px-2 py-1.5 bg-red-50 text-red-700 rounded border border-red-300 hover:bg-red-100 transition-colors text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-50"
                                title="Supprimer le dossier"
                              >
                                <Trash2 className="h-3 w-3" />
                                Supprimer
                              </button>
                            )}
                          </div>

                          {/* Delete Confirmation Overlay */}
                          {deletingFolderId === folder.id && (
                            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
                              <div className="bg-white p-4 rounded-lg shadow-xl max-w-xs mx-4">
                                <h4 className="font-bold text-gray-900 text-sm mb-2">Confirmer la suppression</h4>
                                <p className="text-xs text-gray-600 mb-4">
                                  Supprimer le dossier "{folder.name}" ?<br />
                                  <span className="text-red-600 font-medium">Le dossier doit être vide.</span>
                                </p>
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => setDeletingFolderId(null)}
                                    className="flex-1 px-3 py-1.5 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-xs font-medium"
                                  >
                                    Annuler
                                  </button>
                                  <button
                                    onClick={handleDeleteFolderConfirm}
                                    className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-xs font-medium"
                                  >
                                    Supprimer
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Templates Section - Liste/Tableau */}
                {filteredTemplates.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <Award className="h-4 w-4" />
                        Templates ({filteredTemplates.length})
                      </h3>

                      {/* Bulk Actions Bar */}
                      {selectedTemplates.size > 0 && (
                        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                          <span className="text-sm font-medium text-blue-700">
                            {selectedTemplates.size} sélectionné{selectedTemplates.size > 1 ? 's' : ''}
                          </span>
                          <div className="h-4 w-px bg-blue-300" />
                          {hasPermission(PERMISSIONS.training.certificate_templates.organize) && (
                            <button
                              onClick={() => setShowBulkMoveModal(true)}
                              disabled={moveTemplateMutation.isPending}
                              className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs font-medium hover:bg-orange-200 transition-colors flex items-center gap-1 disabled:opacity-50"
                            >
                              <FolderInput className="h-3 w-3" />
                              Déplacer
                            </button>
                          )}
                          {training.canDeleteTemplate && (
                            <button
                              onClick={() => setShowBulkDeleteConfirm(true)}
                              disabled={deleteMutation.isPending}
                              className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium hover:bg-red-200 transition-colors flex items-center gap-1 disabled:opacity-50"
                            >
                              <Trash2 className="h-3 w-3" />
                              Supprimer
                            </button>
                          )}
                          <button
                            onClick={handleClearSelection}
                            className="p-1 text-gray-500 hover:text-gray-700 transition-colors"
                            title="Annuler la sélection"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-3 text-left w-10">
                              <button
                                onClick={handleSelectAll}
                                className="p-1 hover:bg-gray-200 rounded transition-colors"
                                title={selectedTemplates.size === filteredTemplates.length ? "Désélectionner tout" : "Sélectionner tout"}
                              >
                                {selectedTemplates.size === filteredTemplates.length && filteredTemplates.length > 0 ? (
                                  <CheckSquare className="h-4 w-4 text-blue-600" />
                                ) : (
                                  <Square className="h-4 w-4 text-gray-400" />
                                )}
                              </button>
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Nom
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Format
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Couleurs
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {filteredTemplates.map((template) => (
                            <tr
                              key={template.id}
                              className={`hover:bg-blue-50 transition-colors ${selectedTemplates.has(template.id) ? 'bg-blue-50' : ''}`}
                            >
                              {/* Checkbox */}
                              <td className="px-3 py-3">
                                <button
                                  onClick={() => handleSelectTemplate(template.id)}
                                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                                >
                                  {selectedTemplates.has(template.id) ? (
                                    <CheckSquare className="h-4 w-4 text-blue-600" />
                                  ) : (
                                    <Square className="h-4 w-4 text-gray-400" />
                                  )}
                                </button>
                              </td>
                              {/* Nom et Description */}
                              <td className="px-4 py-3">
                                <div>
                                  <div className="font-semibold text-gray-900">{template.name}</div>
                                  <div className="text-xs text-gray-500 mt-0.5">
                                    {template.description || 'Aucune description'}
                                  </div>
                                </div>
                              </td>

                              {/* Format et Orientation */}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <Award className="h-4 w-4 text-gray-400" />
                                  <div className="text-sm">
                                    <div className="font-medium text-gray-900">
                                      {template.template_config.layout.format.toUpperCase()}
                                    </div>
                                    <div className="text-xs text-gray-500">
                                      {template.template_config.layout.orientation === 'landscape' ? 'Paysage' : 'Portrait'}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Couleurs */}
                              <td className="px-4 py-3">
                                <div className="flex gap-1.5">
                                  <div
                                    className="w-6 h-6 rounded border border-gray-300"
                                    style={{ backgroundColor: template.template_config.colors.primary }}
                                    title="Couleur primaire"
                                  />
                                  <div
                                    className="w-6 h-6 rounded border border-gray-300"
                                    style={{ backgroundColor: template.template_config.colors.secondary }}
                                    title="Couleur secondaire"
                                  />
                                  <div
                                    className="w-6 h-6 rounded border border-gray-300"
                                    style={{ backgroundColor: template.template_config.colors.text }}
                                    title="Couleur du texte"
                                  />
                                </div>
                              </td>

                              {/* Actions */}
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-2">
                                  {hasPermission(PERMISSIONS.training.certificate_templates.edit_canvas) && (
                                    <button
                                      onClick={() => navigate(`/admin/certificate-templates/${template.id}/canvas-edit`)}
                                      className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded border border-purple-300 hover:bg-purple-100 transition-colors text-xs font-medium flex items-center gap-1"
                                      title="Modifier avec l'éditeur Canvas"
                                    >
                                      <Edit3 className="h-3.5 w-3.5" />
                                      Modifier
                                    </button>
                                  )}

                                  {training.canRenameTemplate && (
                                    <button
                                      onClick={() => handleRenameClick(template.id, template.name)}
                                      className="px-3 py-1.5 bg-green-50 text-green-700 rounded border border-green-300 hover:bg-green-100 transition-colors text-xs font-medium flex items-center gap-1"
                                      title="Renommer le template"
                                    >
                                      <Edit2 className="h-3.5 w-3.5" />
                                      Renommer
                                    </button>
                                  )}

                                  {hasPermission(PERMISSIONS.training.certificate_templates.duplicate) && (
                                    <button
                                      onClick={() => handleDuplicate(template.id)}
                                      disabled={duplicateMutation.isPending}
                                      className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded border border-blue-300 hover:bg-blue-100 transition-colors text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                                      title="Dupliquer"
                                    >
                                      <Copy className="h-3.5 w-3.5" />
                                      Dupliquer
                                    </button>
                                  )}

                                  {hasPermission(PERMISSIONS.training.certificate_templates.duplicate) && (
                                    <button
                                      onClick={() => handleDuplicateToFolderClick(template.id, template.name, template.folder_id)}
                                      disabled={duplicateToFolderMutation.isPending}
                                      className="px-3 py-1.5 bg-cyan-50 text-cyan-700 rounded border border-cyan-300 hover:bg-cyan-100 transition-colors text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                                      title="Dupliquer vers un autre dossier"
                                    >
                                      <FolderPlus className="h-3.5 w-3.5" />
                                      Vers dossier
                                    </button>
                                  )}

                                  {hasPermission(PERMISSIONS.training.certificate_templates.organize) && (
                                    <button
                                      onClick={() => handleMoveToFolderClick(template.id, template.name, template.folder_id)}
                                      disabled={moveTemplateMutation.isPending}
                                      className="px-3 py-1.5 bg-orange-50 text-orange-700 rounded border border-orange-300 hover:bg-orange-100 transition-colors text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                                      title="Déplacer vers un autre dossier"
                                    >
                                      <FolderInput className="h-3.5 w-3.5" />
                                      Déplacer
                                    </button>
                                  )}

                                  {training.canDeleteTemplate && (
                                    <button
                                      onClick={() => setShowDeleteConfirm(template.id)}
                                      disabled={deleteMutation.isPending}
                                      className="px-3 py-1.5 bg-red-50 text-red-700 rounded border border-red-300 hover:bg-red-100 transition-colors text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                                      title="Supprimer"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Supprimer
                                    </button>
                                  )}
                                </div>

                                {/* Delete Confirmation */}
                                {showDeleteConfirm === template.id && (
                                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                                    <div className="bg-white p-6 rounded-lg shadow-xl max-w-md mx-4">
                                      <h4 className="font-bold text-gray-900 text-lg mb-2">Confirmer la suppression</h4>
                                      <p className="text-sm text-gray-600 mb-6">
                                        Êtes-vous sûr de vouloir supprimer le template "<strong>{template.name}</strong>" ?
                                      </p>
                                      <div className="flex gap-3 justify-end">
                                        <button
                                          onClick={() => setShowDeleteConfirm(null)}
                                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm font-medium"
                                        >
                                          Annuler
                                        </button>
                                        <button
                                          onClick={() => handleDelete(template.id)}
                                          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium"
                                        >
                                          Supprimer
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
        </div>

        {/* Folder Form Modal */}
        <FolderFormModal
          isOpen={showFolderModal}
          onClose={() => setShowFolderModal(false)}
          onSubmit={handleFolderFormSubmit}
          folder={editingFolder}
          folders={flattenedFolders}
          isLoading={createFolderMutation.isPending || updateFolderMutation.isPending}
          mode={folderModalMode}
        />

        {/* Canvas Config Modal */}
        <CanvasConfigModal
          isOpen={showCanvasConfigModal}
          onClose={() => setShowCanvasConfigModal(false)}
          onSubmit={handleCanvasConfigSubmit}
          currentFolderName={selectedFolder?.name || 'Tous les dossiers'}
        />

        {/* Rename Template Modal */}
        {renamingTemplate && (
          <RenameTemplateModal
            isOpen={showRenameModal}
            onClose={() => {
              setShowRenameModal(false);
              setRenamingTemplate(null);
            }}
            onSubmit={handleRenameSubmit}
            currentName={renamingTemplate.name}
            isLoading={updateTemplateMutation.isPending}
          />
        )}

        {/* Rename Folder Modal */}
        {renamingFolder && (
          <RenameFolderModal
            isOpen={showRenameFolderModal}
            onClose={() => {
              setShowRenameFolderModal(false);
              setRenamingFolder(null);
            }}
            onSubmit={handleRenameFolderSubmit}
            currentName={renamingFolder.name}
            isLoading={updateFolderMutation.isPending}
          />
        )}

        {/* Duplicate To Folder Modal */}
        {duplicatingTemplate && (
          <DuplicateToFolderModal
            isOpen={showDuplicateToFolderModal}
            onClose={() => {
              setShowDuplicateToFolderModal(false);
              setDuplicatingTemplate(null);
            }}
            onSubmit={handleDuplicateToFolderSubmit}
            folders={flattenedFolders}
            currentFolderId={duplicatingTemplate.folderId}
            templateName={duplicatingTemplate.name}
            isLoading={duplicateToFolderMutation.isPending}
          />
        )}

        {/* Move To Folder Modal */}
        {movingTemplate && (
          <MoveToFolderModal
            isOpen={showMoveToFolderModal}
            onClose={() => {
              setShowMoveToFolderModal(false);
              setMovingTemplate(null);
            }}
            onSubmit={handleMoveToFolderSubmit}
            folders={flattenedFolders}
            currentFolderId={movingTemplate.folderId}
            templateName={movingTemplate.name}
            isLoading={moveTemplateMutation.isPending}
          />
        )}

        {/* Bulk Move Modal */}
        {showBulkMoveModal && selectedTemplates.size > 0 && (
          <MoveToFolderModal
            isOpen={showBulkMoveModal}
            onClose={() => setShowBulkMoveModal(false)}
            onSubmit={handleBulkMoveSubmit}
            folders={flattenedFolders}
            currentFolderId={selectedFolderId || ''}
            templateName={`${selectedTemplates.size} template${selectedTemplates.size > 1 ? 's' : ''}`}
            isLoading={moveTemplateMutation.isPending}
          />
        )}

        {/* Bulk Delete Confirmation */}
        {showBulkDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-xl max-w-md mx-4">
              <h4 className="font-bold text-gray-900 text-lg mb-2">Confirmer la suppression multiple</h4>
              <p className="text-sm text-gray-600 mb-4">
                Êtes-vous sûr de vouloir supprimer <strong>{selectedTemplates.size} template{selectedTemplates.size > 1 ? 's' : ''}</strong> ?
              </p>
              <p className="text-xs text-red-600 mb-6">
                Cette action est irréversible.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowBulkDeleteConfirm(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {deleteMutation.isPending ? 'Suppression...' : `Supprimer ${selectedTemplates.size} template${selectedTemplates.size > 1 ? 's' : ''}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
};
