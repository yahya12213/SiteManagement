import { useState } from 'react';
import { X, AlertTriangle, User, Calendar, Clock, FileText, CheckCircle } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface AnomalyResolutionModalProps {
  attendanceId: string;
  onClose: () => void;
}

interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_number: string;
  attendance_date: string;
  check_in_time: string;
  check_out_time: string;
  worked_minutes: number;
  status: string;
  notes: string;
  is_anomaly: boolean;
  anomaly_type: string;
  anomaly_resolved: boolean;
  resolved_by?: string;
  resolved_by_name?: string;
  resolved_at?: string;
  resolution_notes?: string;
}

export default function AnomalyResolutionModal({ attendanceId, onClose }: AnomalyResolutionModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    check_in_time: '',
    check_out_time: '',
    status: 'present' as const,
    resolution_notes: '',
  });

  // Fetch attendance record details
  const { data: recordData, isLoading } = useQuery({
    queryKey: ['hr-attendance-record', attendanceId],
    queryFn: async () => {
      const response = await apiClient.get(`/hr/attendance/${attendanceId}`);
      return (response as any).data as AttendanceRecord;
    },
  });

  const record = recordData;

  // Initialize form when data loads
  useState(() => {
    if (record) {
      setFormData({
        check_in_time: record.check_in_time || '',
        check_out_time: record.check_out_time || '',
        status: record.status as any,
        resolution_notes: '',
      });
    }
  });

  // Resolve anomaly mutation
  const resolveAnomaly = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiClient.put(`/hr/attendance/${attendanceId}/resolve`, data);
      return (response as any).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['hr-attendance-anomalies'] });
      queryClient.invalidateQueries({ queryKey: ['hr-attendance-record', attendanceId] });
      alert('Anomalie résolue avec succès');
      onClose();
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.resolution_notes.trim()) {
      alert('Veuillez ajouter une note de résolution');
      return;
    }

    if (formData.status === 'present' && !formData.check_in_time && !formData.check_out_time) {
      alert('Veuillez renseigner au moins une heure pour un statut "présent"');
      return;
    }

    if (formData.check_in_time && formData.check_out_time) {
      const checkIn = new Date(`${record?.attendance_date}T${formData.check_in_time}`);
      const checkOut = new Date(`${record?.attendance_date}T${formData.check_out_time}`);

      if (checkOut <= checkIn) {
        alert('L\'heure de sortie doit être après l\'heure d\'entrée');
        return;
      }
    }

    try {
      await resolveAnomaly.mutateAsync(formData);
    } catch (error: any) {
      console.error('Erreur lors de la résolution:', error);
      alert(error.response?.data?.error || 'Erreur lors de la résolution de l\'anomalie');
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getAnomalyTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      missing_check_in: 'Heure d\'entrée manquante',
      missing_check_out: 'Heure de sortie manquante',
      excessive_hours: 'Heures excessives',
      late_without_status: 'Retard sans statut',
      early_departure: 'Départ anticipé',
      weekend_work_unplanned: 'Travail de week-end non planifié',
    };
    return labels[type] || type;
  };

  const getAnomalyDescription = (type: string) => {
    const descriptions: Record<string, string> = {
      missing_check_in: 'L\'heure d\'arrivée n\'a pas été enregistrée',
      missing_check_out: 'L\'heure de départ n\'a pas été enregistrée',
      excessive_hours: 'La durée de travail dépasse les limites normales',
      late_without_status: 'Retard non justifié par le statut',
      early_departure: 'Départ avant l\'heure prévue',
      weekend_work_unplanned: 'Présence détectée un week-end sans planification',
    };
    return descriptions[type] || '';
  };

  const isPending = resolveAnomaly.isPending;

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!record || !record.is_anomaly) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[650px] md:w-[750px] lg:w-[850px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Résolution d'Anomalie</h2>
              <p className="text-sm text-gray-500">Corriger une anomalie de présence</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Anomaly Alert */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-semibold text-red-900">{getAnomalyTypeLabel(record.anomaly_type)}</p>
                <p className="text-sm text-red-700 mt-1">{getAnomalyDescription(record.anomaly_type)}</p>
              </div>
            </div>
          </div>

          {/* Employee Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <User className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Employé</h3>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Nom:</span>
                <p className="font-medium text-gray-900">{record.employee_name}</p>
              </div>
              <div>
                <span className="text-gray-600">Matricule:</span>
                <p className="font-medium text-gray-900">{record.employee_number}</p>
              </div>
            </div>
          </div>

          {/* Current Attendance Data */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <Calendar className="w-5 h-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Données Actuelles</h3>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-600">Date:</span>
                <p className="font-medium text-gray-900">
                  {new Date(record.attendance_date).toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                  })}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-gray-600">Heure d'entrée:</span>
                  <p className={`font-medium ${record.check_in_time ? 'text-gray-900' : 'text-red-600'}`}>
                    {record.check_in_time || 'Non enregistrée'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">Heure de sortie:</span>
                  <p className={`font-medium ${record.check_out_time ? 'text-gray-900' : 'text-red-600'}`}>
                    {record.check_out_time || 'Non enregistrée'}
                  </p>
                </div>
              </div>
              <div>
                <span className="text-gray-600">Temps travaillé:</span>
                <p className="font-medium text-gray-900">
                  {record.worked_minutes ? (record.worked_minutes / 60).toFixed(2) + 'h' : 'Non calculé'}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Statut:</span>
                <p className="font-medium text-gray-900">{record.status}</p>
              </div>
              {record.notes && (
                <div>
                  <span className="text-gray-600">Notes:</span>
                  <p className="text-gray-900">{record.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Resolution Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                <CheckCircle className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Correction de l'Anomalie</h3>
              </div>

              <div className="space-y-4">
                {/* Time Corrections */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Heure d'entrée
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="time"
                        value={formData.check_in_time}
                        onChange={(e) => handleChange('check_in_time', e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Heure de sortie
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                      <input
                        type="time"
                        value={formData.check_out_time}
                        onChange={(e) => handleChange('check_out_time', e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                {/* Status Correction */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Statut corrigé *
                  </label>
                  <select
                    required
                    value={formData.status}
                    onChange={(e) => handleChange('status', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="present">Présent</option>
                    <option value="absent">Absent</option>
                    <option value="late">Retard</option>
                    <option value="half_day">Demi-journée</option>
                    <option value="leave">En congé</option>
                    <option value="remote">Télétravail</option>
                  </select>
                </div>

                {/* Resolution Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes de résolution * <span className="text-xs text-gray-500">(Obligatoire)</span>
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                    <textarea
                      required
                      value={formData.resolution_notes}
                      onChange={(e) => handleChange('resolution_notes', e.target.value)}
                      placeholder="Expliquez la correction apportée et la raison de l'anomalie..."
                      rows={3}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Décrivez la nature de l'anomalie et comment vous l'avez corrigée
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
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
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle className="w-5 h-5" />
                {isPending ? 'Résolution en cours...' : 'Résoudre l\'anomalie'}
              </button>
            </div>
          </form>

          {/* Resolution History (if already resolved) */}
          {record.anomaly_resolved && record.resolved_by_name && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-green-900">Anomalie Résolue</p>
                    {record.resolved_at && (
                      <span className="text-xs text-green-600">
                        {new Date(record.resolved_at).toLocaleString('fr-FR')}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-green-700">Par: {record.resolved_by_name}</p>
                  {record.resolution_notes && (
                    <div className="mt-2 bg-white rounded p-2 text-sm text-gray-700">
                      {record.resolution_notes}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
