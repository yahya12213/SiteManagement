import React, { useState, useRef, useEffect } from 'react';
import { Upload, Download, Trash2, FileText, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import type { DeclarationAttachment } from '@/types/declarations';
import {
  uploadDeclarationAttachment,
  getDeclarationAttachments,
  deleteDeclarationAttachment,
  downloadAttachment
} from '@/lib/api/declarations-attachments';
import {
  formatFileSize,
  getFileTypeIcon,
  MAX_ATTACHMENT_SIZE,
  ATTACHMENT_TYPE_NAMES
} from '@/types/declarations';

interface DeclarationAttachmentsManagerProps {
  declarationId: string;
  canUpload?: boolean;
  canDelete?: boolean;
}

export const DeclarationAttachmentsManager: React.FC<DeclarationAttachmentsManagerProps> = ({
  declarationId,
  canUpload = true,
  canDelete = true,
}) => {
  const [attachments, setAttachments] = useState<DeclarationAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Charger les pièces jointes au montage
  useEffect(() => {
    loadAttachments();
  }, [declarationId]);

  const loadAttachments = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getDeclarationAttachments(declarationId);
      setAttachments(data);
    } catch (err: any) {
      console.error('Error loading attachments:', err);
      setError(err.message || 'Erreur lors du chargement des pièces jointes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await handleFileUpload(file);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileUpload = async (file: File) => {
    // Vérifier la taille (max 10MB)
    if (file.size > MAX_ATTACHMENT_SIZE) {
      setError(`Le fichier ne doit pas dépasser ${formatFileSize(MAX_ATTACHMENT_SIZE)}`);
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const newAttachment = await uploadDeclarationAttachment(declarationId, file);
      setAttachments(prev => [newAttachment, ...prev]);
    } catch (err: any) {
      console.error('Error uploading file:', err);
      setError(err.message || 'Erreur lors de l\'upload du fichier');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (attachmentId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette pièce jointe ?')) {
      return;
    }

    try {
      await deleteDeclarationAttachment(declarationId, attachmentId);
      setAttachments(prev => prev.filter(a => a.id !== attachmentId));
    } catch (err: any) {
      console.error('Error deleting attachment:', err);
      setError(err.message || 'Erreur lors de la suppression');
    }
  };

  const handleDownload = (attachment: DeclarationAttachment) => {
    downloadAttachment(attachment);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      await handleFileUpload(file);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          Pièces jointes ({attachments.length})
        </h3>
        {canUpload && (
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            variant="outline"
            size="sm"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Upload en cours...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Ajouter un fichier
              </>
            )}
          </Button>
        )}
      </div>

      {/* Zone de drag and drop */}
      {canUpload && (
        <div
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`
            border-2 border-dashed rounded-lg p-8 text-center transition-colors
            ${isDragging
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
            }
          `}
        >
          <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-sm text-gray-600 mb-2">
            Glissez-déposez un fichier ici, ou cliquez pour sélectionner
          </p>
          <p className="text-xs text-gray-500">
            PDF, Excel, Word ou images (max {formatFileSize(MAX_ATTACHMENT_SIZE)})
          </p>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            accept=".pdf,.xls,.xlsx,.doc,.docx,.jpg,.jpeg,.png,.webp"
            className="hidden"
          />
        </div>
      )}

      {/* Message d'erreur */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
          <div>
            <h4 className="text-sm font-medium text-red-900">Erreur</h4>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* Liste des pièces jointes */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : attachments.length === 0 ? (
        <Card className="p-8 text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">Aucune pièce jointe</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <Card key={attachment.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="text-2xl flex-shrink-0">
                    {getFileTypeIcon(attachment.mime_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {attachment.original_filename}
                      </p>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded flex-shrink-0">
                        {ATTACHMENT_TYPE_NAMES[attachment.mime_type] || 'Fichier'}
                      </span>
                    </div>
                    <div className="flex items-center space-x-4 mt-1">
                      <p className="text-xs text-gray-500">
                        {formatFileSize(attachment.file_size)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(attachment.uploaded_at)}
                      </p>
                      {attachment.uploaded_by_name && (
                        <p className="text-xs text-gray-500">
                          par {attachment.uploaded_by_name}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <Button
                    onClick={() => handleDownload(attachment)}
                    variant="ghost"
                    size="sm"
                    title="Télécharger"
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {canDelete && (
                    <Button
                      onClick={() => handleDelete(attachment.id)}
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
