import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle, XCircle, AlertCircle, FileText, Eye, Save, Link, ExternalLink, Trash2, Send, X, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProtectedButton } from '@/components/ui/ProtectedButton';
import {
  useAdminDeclaration,
  useApproveDeclaration,
  useRejectDeclaration,
  useRequestModification,
  useDeleteAdminDeclaration,
} from '@/hooks/useAdminDeclarations';
import { useUpdateDeclaration, useSubmitDeclaration } from '@/hooks/useProfessorDeclarations';
import { calculateAllValues } from '@/lib/formula/dependency';
import type { FieldDefinition, FormulaContext } from '@/lib/formula/types';
import FilePreviewModal from '@/components/admin/FilePreviewModal';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';

const DeclarationViewer: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const { data: declaration, isLoading } = useAdminDeclaration(id!);
  const approveDeclaration = useApproveDeclaration();
  const rejectDeclaration = useRejectDeclaration();
  const requestModification = useRequestModification();
  const updateDeclaration = useUpdateDeclaration();
  const submitDeclaration = useSubmitDeclaration();
  const deleteDeclaration = useDeleteAdminDeclaration();

  const [fields, setFields] = useState<FieldDefinition[]>([]);
  const [values, setValues] = useState<FormulaContext>({});
  const [calculatedValues, setCalculatedValues] = useState<FormulaContext>({});
  const [canvasSize, setCanvasSize] = useState({ width: 1200, height: 800 });
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showModificationModal, setShowModificationModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // États pour le modal de prévisualisation des fichiers
  const [showFilePreview, setShowFilePreview] = useState(false);
  const [previewFiles, setPreviewFiles] = useState<any[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);

  // Invalidate queries when id changes (handles browser back button)
  useEffect(() => {
    if (id) {
      // Force refresh the declaration data when navigating to a different declaration
      queryClient.invalidateQueries({ queryKey: ['admin-declaration', id] });
    }
  }, [id, queryClient]);

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
  }, [declaration, id]); // Added id to dependencies

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

  const handleSave = async () => {
    if (!id) return;

    try {
      await updateDeclaration.mutateAsync({
        id,
        form_data: values,
      });

      setSaveMessage('Modifications sauvegardées avec succès!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (error) {
      console.error('Error saving declaration:', error);
      alert('Erreur lors de la sauvegarde');
    }
  };

  const handleApprove = async () => {
    if (confirm('Voulez-vous vraiment approuver cette déclaration ?')) {
      try {
        await approveDeclaration.mutateAsync(id!);
        navigate('/admin/declarations');
      } catch (error) {
        console.error('Error approving declaration:', error);
        alert('Erreur lors de l\'approbation');
      }
    }
  };

  const handleReject = async () => {
    if (!rejectionReason.trim()) {
      alert('Veuillez fournir un motif de refus');
      return;
    }

    try {
      await rejectDeclaration.mutateAsync({ id: id!, reason: rejectionReason });
      navigate('/admin/declarations');
    } catch (error) {
      console.error('Error rejecting declaration:', error);
      alert('Erreur lors du refus');
    }
  };

  const handleRequestModification = async () => {
    if (!rejectionReason.trim()) {
      alert('Veuillez fournir un motif de demande de modification');
      return;
    }

    try {
      await requestModification.mutateAsync({ id: id!, reason: rejectionReason });
      navigate('/admin/declarations');
    } catch (error) {
      console.error('Error requesting modification:', error);
      alert('Erreur lors de la demande de modification');
    }
  };

  const handleDelete = async () => {
    const confirmMessage = `Êtes-vous sûr de vouloir supprimer cette déclaration de ${declaration?.professor_name} ?\n\nCette action est irréversible.`;

    if (confirm(confirmMessage)) {
      try {
        await deleteDeclaration.mutateAsync(id!);
        navigate('/admin/declarations');
      } catch (error) {
        console.error('Error deleting declaration:', error);
        alert('Erreur lors de la suppression de la déclaration');
      }
    }
  };

  const handleSubmit = async () => {
    if (!id) return;

    if (window.confirm('Voulez-vous soumettre cette déclaration pour validation ?')) {
      try {
        // D'abord sauvegarder les modifications en cours
        await updateDeclaration.mutateAsync({ id, form_data: values });
        // Puis soumettre la déclaration
        await submitDeclaration.mutateAsync(id);
        alert('Déclaration soumise avec succès !');
        navigate('/admin/declarations');
      } catch (error) {
        console.error('Error submitting declaration:', error);
        alert('Erreur lors de la soumission de la déclaration');
      }
    }
  };

  const renderField = (field: FieldDefinition) => {
    const layout = field.layout || { x: 0, y: 0, w: 200, h: 40 };
    const isAdminOnly = field.visibility?.hidden === true;

    // Masquer les champs admin-only pour les non-admins
    if (isAdminOnly && !isAdmin) {
      return null;
    }

    // Helper pour les classes des champs admin uniquement
    const getAdminOnlyClasses = (baseClasses: string) => {
      if (isAdminOnly) {
        return `${baseClasses} ring-2 ring-red-400 ring-offset-2`;
      }
      return baseClasses;
    };

    // Badge "Admin uniquement"
    const AdminOnlyBadge = () => {
      if (!isAdminOnly) return null;
      return (
        <div className="absolute -top-2 -right-2 z-10 px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded-full shadow-lg">
          ADMIN
        </div>
      );
    };

    if (field.type === 'label') {
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
          <div className={getAdminOnlyClasses("w-full h-full bg-gray-100 border-2 border-gray-300 rounded px-3 py-2 flex items-center font-semibold text-gray-700")}>
            {field.props.label}
          </div>
          <AdminOnlyBadge />
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
            className={getAdminOnlyClasses("w-full h-full px-3 py-2 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent")}
          />
          <AdminOnlyBadge />
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
            className={getAdminOnlyClasses("w-full h-full px-3 py-2 border-2 border-indigo-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none")}
          />
          <AdminOnlyBadge />
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
            className={getAdminOnlyClasses("w-full h-full px-3 py-2 border border-green-300 rounded focus:ring-2 focus:ring-green-500 focus:border-transparent")}
          />
          <AdminOnlyBadge />
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
            className={getAdminOnlyClasses(`w-full h-full px-3 py-2 border-2 rounded font-semibold flex items-center ${
              isError
                ? 'bg-red-50 border-red-400 text-red-700'
                : 'bg-purple-50 border-purple-400 text-purple-900'
            }`)}
          >
            {typeof value === 'number' ? value.toFixed(field.props.decimals || 2) : String(value || '0')}
          </div>
          <AdminOnlyBadge />
        </div>
      );
    }

    if (field.type === 'frame') {
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
          <div className={getAdminOnlyClasses("w-full h-full border-2 border-orange-400 rounded-lg bg-orange-50/30")}>
            <div className="bg-orange-500 text-white px-3 py-1 rounded-t font-semibold text-sm">
              {field.props.label || 'Cadre'}
            </div>
          </div>
          <AdminOnlyBadge />
        </div>
      );
    }

    if (field.type === 'file') {
      const fileData = values[field.ref!];
      const hasFiles = fileData && Array.isArray(fileData) && fileData.length > 0;
      const files = hasFiles ? fileData : [];

      // Fonction pour ouvrir la prévisualisation
      const openPreview = (index: number) => {
        setPreviewFiles(fileData as any);
        setCurrentFileIndex(index);
        setShowFilePreview(true);
      };

      // Fonction pour ajouter des fichiers
      const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = e.target.files;
        if (!selectedFiles || selectedFiles.length === 0) return;

        const newFiles: any[] = [];
        const maxSize = 5 * 1024 * 1024; // 5MB max par fichier

        for (let i = 0; i < selectedFiles.length; i++) {
          const file = selectedFiles[i];

          if (file.size > maxSize) {
            alert(`Le fichier "${file.name}" est trop volumineux (max 5MB)`);
            continue;
          }

          try {
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });

            newFiles.push({
              name: file.name,
              type: file.type,
              size: file.size,
              data: base64
            });
          } catch (error) {
            console.error('Erreur lecture fichier:', error);
          }
        }

        if (newFiles.length > 0) {
          setValues((prev) => ({
            ...prev,
            [field.ref!]: [...files, ...newFiles]
          }));
        }

        // Reset input
        e.target.value = '';
      };

      // Fonction pour supprimer un fichier
      const handleRemoveFile = (index: number) => {
        const updatedFiles = files.filter((_: any, i: number) => i !== index);
        setValues((prev) => ({
          ...prev,
          [field.ref!]: updatedFiles
        }));
      };

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
          <div className={getAdminOnlyClasses("w-full h-full border-2 border-dashed border-teal-300 bg-teal-50/50 rounded px-2 flex items-center gap-2 overflow-hidden")}>
            <FileText className="w-4 h-4 text-teal-600 flex-shrink-0" />
            <span className="text-xs font-medium text-teal-700 flex-shrink-0 whitespace-nowrap">
              {field.props.label || 'Fichiers'}:
            </span>
            <div className="flex-1 min-w-0 flex items-center gap-1 overflow-x-auto">
              {files.length > 0 ? (
                files.map((file: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center gap-1 px-1.5 py-0.5 bg-white rounded border border-teal-200 flex-shrink-0 group"
                  >
                    <span className="text-xs text-teal-800 truncate max-w-[80px]" title={file.name}>
                      {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => openPreview(index)}
                      className="p-0.5 hover:bg-blue-100 text-blue-600 rounded"
                      title="Voir"
                    >
                      <Eye className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveFile(index)}
                      className="p-0.5 hover:bg-red-100 text-red-600 rounded"
                      title="Supprimer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))
              ) : (
                <span className="text-xs text-teal-500 italic">Aucun fichier</span>
              )}
            </div>
            <label className="cursor-pointer p-1 bg-teal-600 hover:bg-teal-700 text-white rounded transition-colors flex-shrink-0" title="Ajouter des fichiers">
              <Plus className="w-3.5 h-3.5" />
              <input
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleFileUpload}
                className="hidden"
                title="Ajouter des fichiers"
              />
            </label>
          </div>
          <AdminOnlyBadge />
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
          <div className={getAdminOnlyClasses("w-full h-full border-2 border-cyan-400 bg-cyan-50 rounded px-2 flex items-center gap-2")}>
            <Link className="w-4 h-4 text-cyan-600 flex-shrink-0" />
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
          <AdminOnlyBadge />
        </div>
      );
    }

    return null;
  };

  const statusConfig = {
    brouillon: { label: 'Brouillon', color: 'bg-gray-100 text-gray-800' },
    a_declarer: { label: 'À déclarer', color: 'bg-orange-100 text-orange-800' },
    soumise: { label: 'Soumise', color: 'bg-blue-100 text-blue-800' },
    en_cours: { label: 'En cours', color: 'bg-yellow-100 text-yellow-800' },
    approuvee: { label: 'Approuvée', color: 'bg-green-100 text-green-800' },
    refusee: { label: 'Refusée', color: 'bg-red-100 text-red-800' },
  };

  if (isLoading) {
    return (
      <AppLayout
        title="Visualisation Déclaration"
        subtitle="Chargement en cours..."
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Chargement...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!declaration) {
    return (
      <AppLayout
        title="Visualisation Déclaration"
        subtitle="Mode administrateur"
      >
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-gray-600">Déclaration introuvable</p>
            <Button onClick={() => navigate('/admin/declarations')} className="mt-4">
              Retour
            </Button>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout
      title={declaration.sheet_title}
      subtitle={`${declaration.professor_name} • ${declaration.segment_name} • ${declaration.city_name} • Du ${new Date(declaration.start_date).toLocaleDateString('fr-FR')} au ${new Date(declaration.end_date).toLocaleDateString('fr-FR')}`}
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                (statusConfig as any)[declaration.status].color
              }`}
            >
              {(statusConfig as any)[declaration.status].label}
            </span>
            <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium flex items-center gap-1">
              <Eye className="w-3 h-3" />
              Mode Admin
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Message de sauvegarde */}
            {saveMessage && (
              <div className="flex items-center gap-2 bg-green-100 text-green-800 px-4 py-2 rounded-lg">
                <span className="text-sm font-medium">{saveMessage}</span>
              </div>
            )}

            {/* Bouton Supprimer - Admin uniquement */}
            {isAdmin && (
              <ProtectedButton
                permission="accounting.declarations.delete"
                variant="outline"
                className="text-red-600 hover:bg-red-50"
                onClick={handleDelete}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer
              </ProtectedButton>
            )}

            <Button
              variant="outline"
              onClick={handleSave}
              disabled={updateDeclaration.isPending}
            >
              <Save className="w-4 h-4 mr-2" />
              Sauvegarder
            </Button>

            {/* Bouton Soumettre - uniquement pour les statuts modifiables */}
            {(declaration.status === 'brouillon' ||
              declaration.status === 'a_declarer' ||
              declaration.status === 'en_cours' ||
              declaration.status === 'refusee') && (
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={handleSubmit}
                disabled={submitDeclaration.isPending}
              >
                <Send className="w-4 h-4 mr-2" />
                {submitDeclaration.isPending ? 'Soumission...' : 'Soumettre'}
              </Button>
            )}

            {declaration.status === 'soumise' && (
              <>
                <ProtectedButton
                  permission="accounting.declarations.approve"
                  variant="outline"
                  className="text-green-600 hover:bg-green-50"
                  onClick={handleApprove}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Approuver
                </ProtectedButton>
                <ProtectedButton
                  permission="accounting.declarations.request_modification"
                  variant="outline"
                  className="text-yellow-600 hover:bg-yellow-50"
                  onClick={() => setShowModificationModal(true)}
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  Demander modification
                </ProtectedButton>
                <ProtectedButton
                  permission="accounting.declarations.reject"
                  variant="outline"
                  className="text-red-600 hover:bg-red-50"
                  onClick={() => setShowRejectModal(true)}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Refuser
                </ProtectedButton>
              </>
            )}
          </div>
        </div>

        {/* Rejection reason */}
        {declaration.rejection_reason && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-6 py-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">
                  {declaration.status === 'refusee' ? 'Déclaration refusée' : 'Modifications demandées'}
                </p>
                <p className="text-sm text-red-700 mt-1">{declaration.rejection_reason}</p>
              </div>
            </div>
          </div>
        )}

        {/* Canvas - Full width layout, scroll avec la page principale */}
        <div>
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

      {/* Modal Refus */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[450px] md:w-[500px] max-w-[95vw]">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Refuser la déclaration</h2>
              <p className="text-sm text-gray-600 mb-4">
                Veuillez fournir un motif de refus pour la déclaration de{' '}
                <strong>{declaration.professor_name}</strong>
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                rows={4}
                placeholder="Motif du refus..."
              />
              <div className="flex justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRejectModal(false);
                    setRejectionReason('');
                  }}
                >
                  Annuler
                </Button>
                <Button
                  className="bg-red-600 hover:bg-red-700 text-white"
                  onClick={handleReject}
                  disabled={!rejectionReason.trim()}
                >
                  Refuser
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Demande de modification */}
      {showModificationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[450px] md:w-[500px] max-w-[95vw]">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">Demander une modification</h2>
              <p className="text-sm text-gray-600 mb-4">
                Veuillez préciser les modifications à apporter pour la déclaration de{' '}
                <strong>{declaration.professor_name}</strong>
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                rows={4}
                placeholder="Modifications demandées..."
              />
              <div className="flex justify-end gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowModificationModal(false);
                    setRejectionReason('');
                  }}
                >
                  Annuler
                </Button>
                <Button
                  className="bg-yellow-600 hover:bg-yellow-700 text-white"
                  onClick={handleRequestModification}
                  disabled={!rejectionReason.trim()}
                >
                  Demander
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de prévisualisation des fichiers */}
      {showFilePreview && previewFiles.length > 0 && (
        <FilePreviewModal
          files={previewFiles}
          currentIndex={currentFileIndex}
          onClose={() => setShowFilePreview(false)}
          onNavigate={(index: number) => setCurrentFileIndex(index)}
        />
      )}
      </div>
    </AppLayout>
  );
};

export default DeclarationViewer;
