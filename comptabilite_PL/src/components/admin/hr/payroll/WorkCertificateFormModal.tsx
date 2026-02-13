import { useState } from 'react';
import { X, FileText, Loader2, Search } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

interface WorkCertificateFormModalProps {
  onClose: () => void;
}

const certificateTypes = [
  { value: 'standard', label: 'Attestation standard', description: "Confirme l'emploi actuel" },
  { value: 'with_salary', label: 'Attestation avec salaire', description: 'Inclut le salaire mensuel' },
  { value: 'end_of_contract', label: 'Attestation de fin de contrat', description: 'Pour les employés sortants' },
  { value: 'custom', label: 'Attestation personnalisée', description: 'Avec texte libre' },
];

interface Employee {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  position: string;
  segment_name: string;
}

export function WorkCertificateFormModal({ onClose }: WorkCertificateFormModalProps) {
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [formData, setFormData] = useState({
    certificate_type: 'standard',
    purpose: '',
    include_salary: false,
    include_position: true,
    custom_text: '',
    generate_pdf: true,
  });
  const [error, setError] = useState<string | null>(null);

  // Fetch employees for selection
  const { data: employeesData, isLoading: loadingEmployees } = useQuery({
    queryKey: ['hr-employees-search', searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      const url = `/hr/employees${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await apiClient.get<{ success: boolean; data: Employee[] }>(url);
      return response.data;
    },
    enabled: searchTerm.length >= 2 || searchTerm.length === 0,
  });

  const employees = employeesData || [];

  // Create certificate mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedEmployee) throw new Error('Veuillez sélectionner un employé');

      const response = await apiClient.post('/hr/certificates', {
        employee_id: selectedEmployee.id,
        ...formData,
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-certificates'] });
      onClose();
    },
    onError: (err: Error) => {
      setError(err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedEmployee) {
      setError('Veuillez sélectionner un employé');
      return;
    }

    createMutation.mutate();
  };

  const handleTypeChange = (type: string) => {
    setFormData(prev => ({
      ...prev,
      certificate_type: type,
      include_salary: type === 'with_salary',
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-blue-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Nouvelle attestation de travail</h2>
              <p className="text-sm text-gray-500">Créer une attestation pour un employé</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-blue-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Employee Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Employé *
            </label>
            {selectedEmployee ? (
              <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">
                    {selectedEmployee.last_name} {selectedEmployee.first_name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {selectedEmployee.employee_number} - {selectedEmployee.position || 'N/A'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedEmployee(null)}
                  className="text-blue-600 hover:text-blue-800 text-sm"
                >
                  Changer
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Rechercher par nom, matricule..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                {loadingEmployees ? (
                  <div className="p-4 text-center text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  </div>
                ) : employees.length > 0 ? (
                  <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                    {employees.slice(0, 10).map((emp) => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => setSelectedEmployee(emp)}
                        className="w-full p-3 text-left hover:bg-gray-50 transition-colors"
                      >
                        <p className="font-medium text-gray-900">
                          {emp.last_name} {emp.first_name}
                        </p>
                        <p className="text-sm text-gray-500">
                          {emp.employee_number} - {emp.position || 'N/A'} - {emp.segment_name || 'N/A'}
                        </p>
                      </button>
                    ))}
                  </div>
                ) : searchTerm.length >= 2 ? (
                  <p className="text-sm text-gray-500 p-2">Aucun employé trouvé</p>
                ) : (
                  <p className="text-sm text-gray-500 p-2">Tapez au moins 2 caractères pour rechercher</p>
                )}
              </div>
            )}
          </div>

          {/* Certificate Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type d'attestation *
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {certificateTypes.map((type) => (
                <label
                  key={type.value}
                  className={`
                    flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors
                    ${formData.certificate_type === type.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <input
                    type="radio"
                    name="certificate_type"
                    value={type.value}
                    checked={formData.certificate_type === type.value}
                    onChange={(e) => handleTypeChange(e.target.value)}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-medium text-gray-900">{type.label}</p>
                    <p className="text-xs text-gray-500">{type.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Purpose */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Motif / Destination
            </label>
            <input
              type="text"
              value={formData.purpose}
              onChange={(e) => setFormData(prev => ({ ...prev, purpose: e.target.value }))}
              placeholder="Ex: demande de visa, ouverture de compte bancaire..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Options */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.include_position}
                onChange={(e) => setFormData(prev => ({ ...prev, include_position: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Inclure le poste</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.include_salary}
                onChange={(e) => setFormData(prev => ({ ...prev, include_salary: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Inclure le salaire</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.generate_pdf}
                onChange={(e) => setFormData(prev => ({ ...prev, generate_pdf: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Générer le PDF automatiquement</span>
            </label>
          </div>

          {/* Custom text (only for custom type) */}
          {formData.certificate_type === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Texte personnalisé
              </label>
              <textarea
                value={formData.custom_text}
                onChange={(e) => setFormData(prev => ({ ...prev, custom_text: e.target.value }))}
                placeholder="Texte additionnel à inclure dans l'attestation..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          )}

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
              disabled={createMutation.isPending || !selectedEmployee}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Création...
                </>
              ) : (
                'Créer l\'attestation'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
