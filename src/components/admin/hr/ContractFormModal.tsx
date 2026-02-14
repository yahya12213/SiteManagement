import { useState, useRef } from 'react';
import { X, Upload, FileText, AlertCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface ContractFormModalProps {
  employeeId: string;
  employeeName: string;
  onClose: () => void;
}

const contractTypes = [
  { value: 'CDI', label: 'CDI - Contrat à Durée Indéterminée' },
  { value: 'CDD', label: 'CDD - Contrat à Durée Déterminée' },
  { value: 'stage', label: 'Stage' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'interim', label: 'Intérim' },
  { value: 'apprenticeship', label: 'Apprentissage' }
];

export function ContractFormModal({ employeeId, employeeName, onClose }: ContractFormModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    contract_type: 'CDI',
    start_date: '',
    end_date: '',
    trial_period_end: '',
    base_salary: '',
    position: '',
    department: '',
    notes: ''
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const formDataToSend = new FormData();

      if (selectedFile) {
        formDataToSend.append('document', selectedFile);
      }

      formDataToSend.append('contract_type', formData.contract_type);
      formDataToSend.append('start_date', formData.start_date);
      if (formData.end_date) formDataToSend.append('end_date', formData.end_date);
      if (formData.trial_period_end) formDataToSend.append('trial_period_end', formData.trial_period_end);
      if (formData.base_salary) formDataToSend.append('base_salary', formData.base_salary);
      if (formData.position) formDataToSend.append('position', formData.position);
      if (formData.department) formDataToSend.append('department', formData.department);
      if (formData.notes) formDataToSend.append('notes', formData.notes);

      // Get token from sessionStorage first (session), then localStorage (persistent)
      const token = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');

      const response = await fetch(`/api/hr/employees/${employeeId}/contracts/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataToSend
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la création du contrat');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['hr-all-contracts'] });
      onClose();
    },
    onError: (error: Error) => {
      setError(error.message);
    }
  });

  const handleFileSelect = (file: File) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(file.type)) {
      setError('Type de fichier non supporté. Utilisez PDF, Word ou images.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Le fichier est trop volumineux (max 10 MB)');
      return;
    }

    setSelectedFile(file);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.start_date) {
      setError('La date de début est obligatoire');
      return;
    }

    uploadMutation.mutate();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Nouveau contrat</h2>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Contract type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type de contrat *
              </label>
              <select
                value={formData.contract_type}
                onChange={(e) => setFormData(prev => ({ ...prev, contract_type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              >
                {contractTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            {/* Base salary */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Salaire de base (MAD)
              </label>
              <input
                type="number"
                step="0.01"
                value={formData.base_salary}
                onChange={(e) => setFormData(prev => ({ ...prev, base_salary: e.target.value }))}
                placeholder="Ex: 5000.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Start date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de début *
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            {/* End date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de fin {formData.contract_type !== 'CDI' && '*'}
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
              {formData.contract_type === 'CDI' && (
                <p className="text-xs text-gray-500 mt-1">Optionnel pour les CDI</p>
              )}
            </div>

            {/* Trial period end */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fin de période d'essai
              </label>
              <input
                type="date"
                value={formData.trial_period_end}
                onChange={(e) => setFormData(prev => ({ ...prev, trial_period_end: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Position */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Poste
              </label>
              <input
                type="text"
                value={formData.position}
                onChange={(e) => setFormData(prev => ({ ...prev, position: e.target.value }))}
                placeholder="Ex: Développeur Full Stack"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Department */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Département
              </label>
              <input
                type="text"
                value={formData.department}
                onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                placeholder="Ex: IT, Commercial, RH..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* File upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Document du contrat (scan)
            </label>
            <div
              className={`
                border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
                ${selectedFile ? 'border-green-300 bg-green-50' : 'border-gray-300 hover:border-gray-400'}
              `}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />

              {selectedFile ? (
                <div className="flex items-center justify-center gap-2 text-green-700">
                  <FileText className="w-5 h-5" />
                  <span>{selectedFile.name}</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-gray-500">
                  <Upload className="w-5 h-5" />
                  <span>Cliquez pour ajouter le scan du contrat</span>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optionnel)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Informations complémentaires..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
            />
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
              disabled={uploadMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {uploadMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Création...
                </>
              ) : (
                'Créer le contrat'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
