// @ts-nocheck
import { useState, useRef } from 'react';
import { X, Upload, FileText, Image, File, AlertCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface DocumentUploadModalProps {
  employeeId: string;
  employeeName: string;
  onClose: () => void;
}

const documentTypes = [
  { value: 'contract', label: 'Contrat' },
  { value: 'rib', label: 'Attestation RIB' },
  { value: 'cv', label: 'CV' },
  { value: 'diploma', label: 'Diplôme' },
  { value: 'certificate', label: 'Certificat' },
  { value: 'cin', label: 'CIN' },
  { value: 'cnss', label: 'Attestation CNSS' },
  { value: 'medical', label: 'Certificat médical' },
  { value: 'disciplinary', label: 'Document disciplinaire' },
  { value: 'photo', label: 'Photo' },
  { value: 'other', label: 'Autre' }
];

export function DocumentUploadModal({ employeeId, employeeName, onClose }: DocumentUploadModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    document_type: 'other',
    title: '',
    description: '',
    expiry_date: ''
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) {
        throw new Error('Veuillez sélectionner un fichier');
      }

      const formDataToSend = new FormData();
      formDataToSend.append('document', selectedFile);
      formDataToSend.append('document_type', formData.document_type);
      formDataToSend.append('title', formData.title || selectedFile.name);
      formDataToSend.append('description', formData.description);
      if (formData.expiry_date) {
        formDataToSend.append('expiry_date', formData.expiry_date);
      }

      // Get token from sessionStorage first (session), then localStorage (persistent)
      const token = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');

      const response = await fetch(`/api/hr/employees/${employeeId}/documents/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataToSend
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de l\'upload');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['hr-all-documents'] });
      onClose();
    },
    onError: (error: Error) => {
      setError(error.message);
    }
  });

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (file: File) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(file.type)) {
      setError('Type de fichier non supporté. Utilisez PDF, Word, JPG, PNG ou WEBP.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Le fichier est trop volumineux (max 10 MB)');
      return;
    }

    setSelectedFile(file);
    setError(null);

    // Auto-fill title if empty
    if (!formData.title) {
      setFormData(prev => ({ ...prev, title: file.name.replace(/\.[^/.]+$/, '') }));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const getFileIcon = () => {
    if (!selectedFile) return <Upload className="w-12 h-12 text-gray-400" />;

    if (selectedFile.type.startsWith('image/')) {
      return <Image className="w-12 h-12 text-blue-500" />;
    } else if (selectedFile.type === 'application/pdf') {
      return <FileText className="w-12 h-12 text-red-500" />;
    }
    return <File className="w-12 h-12 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    uploadMutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Ajouter un document</h2>
            <p className="text-sm text-gray-500">{employeeName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Drop zone */}
          <div
            className={`
              relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
              transition-colors
              ${dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
              ${selectedFile ? 'bg-green-50 border-green-300' : ''}
            `}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
              onChange={handleFileInputChange}
            />

            <div className="flex flex-col items-center gap-2">
              {getFileIcon()}

              {selectedFile ? (
                <div className="text-center">
                  <p className="font-medium text-green-700">{selectedFile.name}</p>
                  <p className="text-sm text-green-600">{formatFileSize(selectedFile.size)}</p>
                  <p className="text-xs text-gray-500 mt-1">Cliquez pour changer</p>
                </div>
              ) : (
                <>
                  <p className="text-gray-600">
                    Glissez-déposez un fichier ici ou <span className="text-blue-600">parcourir</span>
                  </p>
                  <p className="text-xs text-gray-400">PDF, Word, JPG, PNG (max 10 MB)</p>
                </>
              )}
            </div>
          </div>

          {/* Document type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type de document *
            </label>
            <select
              value={formData.document_type}
              onChange={(e) => setFormData(prev => ({ ...prev, document_type: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            >
              {documentTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Titre du document
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Ex: Contrat CDI 2024"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optionnel)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Notes ou détails sur ce document..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Expiry date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date d'expiration (optionnel)
            </label>
            <input
              type="date"
              value={formData.expiry_date}
              onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Pour les documents avec une validité limitée (certificats, attestations...)
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!selectedFile || uploadMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {uploadMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Upload en cours...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  Uploader
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
