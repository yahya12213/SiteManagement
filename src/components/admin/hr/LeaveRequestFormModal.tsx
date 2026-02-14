import { useState, useEffect } from 'react';
import { X, CalendarDays, Calendar, FileText, Phone, User, AlertCircle, Upload } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface LeaveRequestFormModalProps {
  employeeId?: string;
  onClose: () => void;
}

interface LeaveType {
  id: string;
  code: string;
  name: string;
  color: string;
  is_paid: boolean;
  max_days_per_request?: number;
  min_days_per_request: number;
  requires_justification: boolean;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
}

export default function LeaveRequestFormModal({ employeeId, onClose }: LeaveRequestFormModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    employee_id: employeeId || '',
    leave_type_id: '',
    start_date: '',
    end_date: '',
    start_half_day: false,
    end_half_day: false,
    reason: '',
    contact_during_leave: '',
    handover_notes: '',
  });

  const [estimatedDays, setEstimatedDays] = useState<number>(0);
  const [justificationFile, setJustificationFile] = useState<File | null>(null);

  // Fetch leave types
  const { data: leaveTypesData } = useQuery({
    queryKey: ['hr-leave-types'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: LeaveType[] }>('/hr/leaves/types');
      return (response as any).data;
    },
  });
  const leaveTypes = leaveTypesData || [];

  // Fetch employees (if not pre-selected)
  const { data: employeesData } = useQuery({
    queryKey: ['hr-employees-active'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: Employee[] }>('/hr/employees?status=active');
      return (response as any).data;
    },
    enabled: !employeeId, // Only fetch if employee not pre-selected
  });
  const employees = employeesData || [];

  // Calculate estimated days
  useEffect(() => {
    if (formData.start_date && formData.end_date) {
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);

      if (end >= start) {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        let days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 to include both start and end days

        // Adjust for half days
        if (formData.start_half_day) days -= 0.5;
        if (formData.end_half_day) days -= 0.5;

        setEstimatedDays(Math.max(0, days));
      }
    }
  }, [formData.start_date, formData.end_date, formData.start_half_day, formData.end_half_day]);

  // Get selected leave type details
  const selectedLeaveType = leaveTypes.find((lt: LeaveType) => lt.id === formData.leave_type_id);

  // Create mutation
  const createLeaveRequest = useMutation({
    mutationFn: async (formDataToSend: FormData) => {
      // apiClient automatically detects FormData and sets proper Content-Type
      const response = await apiClient.post<{ success: boolean; data: any }>('/hr/leaves/requests', formDataToSend);
      return (response as any).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-leave-requests'] });
      onClose();
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.employee_id || !formData.leave_type_id || !formData.start_date || !formData.end_date) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      alert('La date de fin doit être après la date de début');
      return;
    }

    if (selectedLeaveType?.max_days_per_request && estimatedDays > selectedLeaveType.max_days_per_request) {
      alert(`Le nombre maximum de jours pour ce type de congé est ${selectedLeaveType.max_days_per_request}`);
      return;
    }

    if (selectedLeaveType && estimatedDays < selectedLeaveType.min_days_per_request) {
      alert(`Le nombre minimum de jours pour ce type de congé est ${selectedLeaveType.min_days_per_request}`);
      return;
    }

    if (selectedLeaveType?.requires_justification && !justificationFile) {
      alert('Un justificatif est requis pour ce type de congé');
      return;
    }

    try {
      // Create FormData object
      const formDataToSend = new FormData();
      formDataToSend.append('employee_id', formData.employee_id);
      formDataToSend.append('leave_type_id', formData.leave_type_id);
      formDataToSend.append('start_date', formData.start_date);
      formDataToSend.append('end_date', formData.end_date);
      formDataToSend.append('start_half_day', formData.start_half_day.toString());
      formDataToSend.append('end_half_day', formData.end_half_day.toString());
      formDataToSend.append('reason', formData.reason);
      formDataToSend.append('contact_during_leave', formData.contact_during_leave);
      formDataToSend.append('handover_notes', formData.handover_notes);

      // Add file if selected
      if (justificationFile) {
        formDataToSend.append('attachment', justificationFile);
      }

      await createLeaveRequest.mutateAsync(formDataToSend);
    } catch (error: any) {
      console.error('Erreur lors de la création de la demande:', error);
      alert(error.response?.data?.error || 'Erreur lors de la création de la demande de congé');
    }
  };

  const handleChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const isPending = createLeaveRequest.isPending;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[650px] md:w-[750px] lg:w-[850px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <CalendarDays className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Nouvelle demande de congé</h2>
              <p className="text-sm text-gray-500">Créer une demande de congé pour un employé</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Employee Selection (if not pre-selected) */}
          {!employeeId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Employé *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <select
                  required
                  value={formData.employee_id}
                  onChange={(e) => handleChange('employee_id', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Sélectionnez un employé</option>
                  {employees.map((emp: Employee) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} - {emp.employee_number}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Leave Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type de congé *
            </label>
            <select
              required
              value={formData.leave_type_id}
              onChange={(e) => handleChange('leave_type_id', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="">Sélectionnez un type de congé</option>
              {leaveTypes.map((type: LeaveType) => (
                <option key={type.id} value={type.id}>
                  {type.name} {type.is_paid ? '(Payé)' : '(Non payé)'}
                </option>
              ))}
            </select>
            {selectedLeaveType && (
              <div className="mt-2 flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedLeaveType.color }}
                ></div>
                <p className="text-xs text-gray-600">
                  Min: {selectedLeaveType.min_days_per_request} jour(s)
                  {selectedLeaveType.max_days_per_request && ` • Max: ${selectedLeaveType.max_days_per_request} jour(s)`}
                </p>
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Start Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date de début *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="date"
                  required
                  value={formData.start_date}
                  onChange={(e) => handleChange('start_date', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div className="mt-2">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={formData.start_half_day}
                    onChange={(e) => handleChange('start_half_day', e.target.checked)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  Demi-journée (matin uniquement)
                </label>
              </div>
            </div>

            {/* End Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date de fin *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="date"
                  required
                  value={formData.end_date}
                  onChange={(e) => handleChange('end_date', e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div className="mt-2">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={formData.end_half_day}
                    onChange={(e) => handleChange('end_half_day', e.target.checked)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  Demi-journée (après-midi uniquement)
                </label>
              </div>
            </div>
          </div>

          {/* Estimated Days */}
          {estimatedDays > 0 && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-purple-900">
                    Durée estimée: <span className="font-bold">{estimatedDays} jour(s)</span>
                  </p>
                  <p className="text-xs text-purple-700 mt-1">
                    Du {formData.start_date && new Date(formData.start_date).toLocaleDateString('fr-FR')}
                    {' au '}
                    {formData.end_date && new Date(formData.end_date).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Motif {selectedLeaveType?.requires_justification && '*'}
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
              <textarea
                required={selectedLeaveType?.requires_justification}
                value={formData.reason}
                onChange={(e) => handleChange('reason', e.target.value)}
                placeholder="Expliquez la raison de votre demande..."
                rows={3}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Medical Certificate / Justification (only for types that require it) */}
          {selectedLeaveType?.requires_justification && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Justificatif médical *
              </label>
              <div className="relative">
                <input
                  type="file"
                  id="justification-file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // Check file size (10MB max)
                      if (file.size > 10 * 1024 * 1024) {
                        alert('Le fichier est trop volumineux (max 10MB)');
                        e.target.value = '';
                        return;
                      }
                      setJustificationFile(file);
                    }
                  }}
                  className="hidden"
                />
                <label
                  htmlFor="justification-file"
                  className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-purple-400 transition-colors"
                >
                  <Upload className="w-5 h-5 text-gray-400" />
                  <span className="text-sm text-gray-600">
                    {justificationFile ? justificationFile.name : 'Sélectionner un fichier (PDF, Word, Image)'}
                  </span>
                </label>
              </div>
              {justificationFile && (
                <div className="mt-2 flex items-center justify-between bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-600" />
                    <span className="text-sm text-purple-900">{justificationFile.name}</span>
                    <span className="text-xs text-purple-600">
                      ({(justificationFile.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setJustificationFile(null);
                      const input = document.getElementById('justification-file') as HTMLInputElement;
                      if (input) input.value = '';
                    }}
                    className="text-purple-600 hover:text-purple-800 text-sm font-medium"
                  >
                    Supprimer
                  </button>
                </div>
              )}
              <p className="mt-1 text-xs text-gray-500">
                Formats acceptés: PDF, Word, JPG, PNG (max 10MB)
              </p>
            </div>
          )}

          {/* Contact during leave */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contact durant le congé
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                value={formData.contact_during_leave}
                onChange={(e) => handleChange('contact_during_leave', e.target.value)}
                placeholder="Téléphone ou email de contact"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Handover notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes de passation
            </label>
            <textarea
              value={formData.handover_notes}
              onChange={(e) => handleChange('handover_notes', e.target.value)}
              placeholder="Informations de passation des tâches pendant l'absence..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              Décrivez comment vos tâches seront gérées pendant votre absence
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? 'Envoi en cours...' : 'Soumettre la demande'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
