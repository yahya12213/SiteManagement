import { useState, useRef } from 'react';
import { X, Upload, FileText, AlertCircle, AlertTriangle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface DisciplinaryFormModalProps {
  employeeId: string;
  employeeName: string;
  onClose: () => void;
}

const actionTypes = [
  { value: 'verbal_warning', label: 'Avertissement verbal', severity: 'low' },
  { value: 'written_warning', label: 'Avertissement écrit', severity: 'medium' },
  { value: 'blame', label: 'Blâme', severity: 'medium' },
  { value: 'suspension', label: 'Mise à pied', severity: 'high' },
  { value: 'demotion', label: 'Rétrogradation', severity: 'high' },
  { value: 'dismissal', label: 'Licenciement', severity: 'critical' },
  { value: 'other', label: 'Autre', severity: 'low' }
];

const severityLevels = [
  { value: 'low', label: 'Faible', color: 'yellow' },
  { value: 'medium', label: 'Moyen', color: 'orange' },
  { value: 'high', label: 'Élevé', color: 'red' },
  { value: 'critical', label: 'Critique', color: 'red' }
];

export function DisciplinaryFormModal({ employeeId, employeeName, onClose }: DisciplinaryFormModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    action_type: 'verbal_warning',
    severity: 'low',
    issue_date: new Date().toISOString().split('T')[0],
    reason: '',
    description: '',
    duration_days: '',
    salary_impact: '',
    witnesses: ''
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const formDataToSend = new FormData();

      if (selectedFile) {
        formDataToSend.append('document', selectedFile);
      }

      formDataToSend.append('action_type', formData.action_type);
      formDataToSend.append('severity', formData.severity);
      formDataToSend.append('issue_date', formData.issue_date);
      formDataToSend.append('reason', formData.reason);
      if (formData.description) formDataToSend.append('description', formData.description);
      if (formData.duration_days) formDataToSend.append('duration_days', formData.duration_days);
      if (formData.salary_impact) formDataToSend.append('salary_impact', formData.salary_impact);
      if (formData.witnesses) {
        formDataToSend.append('witnesses', JSON.stringify(formData.witnesses.split(',').map(w => w.trim()).filter(Boolean)));
      }

      // Get token from sessionStorage first (session), then localStorage (persistent)
      const token = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');

      const response = await fetch(`/api/hr/employees/${employeeId}/disciplinary/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formDataToSend
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de la création');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['hr-all-disciplinary'] });
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
      setError('Type de fichier non supporté.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Le fichier est trop volumineux (max 10 MB)');
      return;
    }

    setSelectedFile(file);
    setError(null);
  };

  const handleActionTypeChange = (actionType: string) => {
    const action = actionTypes.find(a => a.value === actionType);
    setFormData(prev => ({
      ...prev,
      action_type: actionType,
      severity: action?.severity || 'low'
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.reason) {
      setError('Le motif est obligatoire');
      return;
    }

    uploadMutation.mutate();
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'low': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'medium': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'high': return 'bg-red-100 text-red-800 border-red-300';
      case 'critical': return 'bg-red-200 text-red-900 border-red-400';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-red-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Action disciplinaire</h2>
              <p className="text-sm text-gray-500">{employeeName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-red-100 rounded-lg transition-colors"
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
            {/* Action type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type d'action *
              </label>
              <select
                value={formData.action_type}
                onChange={(e) => handleActionTypeChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                required
              >
                {actionTypes.map(type => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
            </div>

            {/* Severity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gravité *
              </label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData(prev => ({ ...prev, severity: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-red-500 ${getSeverityColor(formData.severity)}`}
                required
              >
                {severityLevels.map(level => (
                  <option key={level.value} value={level.value}>{level.label}</option>
                ))}
              </select>
            </div>

            {/* Issue date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date *
              </label>
              <input
                type="date"
                value={formData.issue_date}
                onChange={(e) => setFormData(prev => ({ ...prev, issue_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                required
              />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Durée (jours)
              </label>
              <input
                type="number"
                min="0"
                value={formData.duration_days}
                onChange={(e) => setFormData(prev => ({ ...prev, duration_days: e.target.value }))}
                placeholder="Ex: 3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              />
              <p className="text-xs text-gray-500 mt-1">Pour les mises à pied</p>
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motif *
            </label>
            <input
              type="text"
              value={formData.reason}
              onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="Ex: Retards répétés, Faute professionnelle..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description détaillée
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Décrivez les faits, circonstances, dates..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>

          {/* Witnesses */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Témoins
            </label>
            <input
              type="text"
              value={formData.witnesses}
              onChange={(e) => setFormData(prev => ({ ...prev, witnesses: e.target.value }))}
              placeholder="Noms des témoins, séparés par des virgules"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Salary impact */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Impact sur le salaire (MAD)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.salary_impact}
              onChange={(e) => setFormData(prev => ({ ...prev, salary_impact: e.target.value }))}
              placeholder="Montant à retenir si applicable"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* File upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Document justificatif
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
                  <span>Ajouter un document (PV, lettre, etc.)</span>
                </div>
              )}
            </div>
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
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {uploadMutation.isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Enregistrement...
                </>
              ) : (
                'Enregistrer'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
