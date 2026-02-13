import { useState, useEffect } from 'react';
import { Clock, User, Calendar, FileText, CheckCircle } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface AttendanceRecordFormProps {
  onSuccess?: () => void;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
}

export default function AttendanceRecordForm({ onSuccess }: AttendanceRecordFormProps) {
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    employee_id: '',
    attendance_date: today,
    check_in_time: '',
    check_out_time: '',
    status: 'present' as const,
    notes: '',
  });

  const [workedMinutes, setWorkedMinutes] = useState<number | null>(null);

  // Fetch active employees
  const { data: employeesData } = useQuery({
    queryKey: ['hr-employees-active'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: Employee[] }>('/hr/employees?status=active');
      return (response as any).data;
    },
  });
  const employees = employeesData || [];

  // Calculate worked time
  useEffect(() => {
    if (formData.check_in_time && formData.check_out_time) {
      const checkIn = new Date(`${formData.attendance_date}T${formData.check_in_time}`);
      const checkOut = new Date(`${formData.attendance_date}T${formData.check_out_time}`);

      if (checkOut > checkIn) {
        const diffMs = checkOut.getTime() - checkIn.getTime();
        const minutes = Math.floor(diffMs / (1000 * 60));
        setWorkedMinutes(minutes);
      } else {
        setWorkedMinutes(null);
      }
    } else {
      setWorkedMinutes(null);
    }
  }, [formData.check_in_time, formData.check_out_time, formData.attendance_date]);

  // Record attendance mutation
  const recordAttendance = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiClient.post<{ success: boolean; data: any }>('/hr/attendance/record', data);
      return (response as any).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['hr-attendance-anomalies'] });
      // Reset form
      setFormData({
        employee_id: '',
        attendance_date: today,
        check_in_time: '',
        check_out_time: '',
        status: 'present',
        notes: '',
      });
      setWorkedMinutes(null);
      if (onSuccess) onSuccess();
      alert('Présence enregistrée avec succès');
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.employee_id || !formData.attendance_date) {
      alert('Veuillez sélectionner un employé et une date');
      return;
    }

    if (!formData.check_in_time && !formData.check_out_time && formData.status === 'present') {
      alert('Veuillez renseigner au moins une heure (entrée ou sortie) pour un statut "présent"');
      return;
    }

    if (formData.check_in_time && formData.check_out_time) {
      const checkIn = new Date(`${formData.attendance_date}T${formData.check_in_time}`);
      const checkOut = new Date(`${formData.attendance_date}T${formData.check_out_time}`);

      if (checkOut <= checkIn) {
        alert('L\'heure de sortie doit être après l\'heure d\'entrée');
        return;
      }
    }

    try {
      await recordAttendance.mutateAsync(formData);
    } catch (error: any) {
      console.error('Erreur lors de l\'enregistrement:', error);
      alert(error.response?.data?.error || 'Erreur lors de l\'enregistrement de la présence');
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins.toString().padStart(2, '0')}`;
  };

  const isPending = recordAttendance.isPending;

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
          <CheckCircle className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Enregistrer une présence</h3>
          <p className="text-sm text-gray-600">Enregistrer l'arrivée, le départ ou l'absence d'un employé</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Date *
            </label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="date"
                required
                value={formData.attendance_date}
                onChange={(e) => handleChange('attendance_date', e.target.value)}
                max={today}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Employee */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Employé *
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                required
                value={formData.employee_id}
                onChange={(e) => handleChange('employee_id', e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Check-in Time */}
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Check-out Time */}
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Statut *
            </label>
            <select
              required
              value={formData.status}
              onChange={(e) => handleChange('status', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="present">Présent</option>
              <option value="absent">Absent</option>
              <option value="late">Retard</option>
              <option value="half_day">Demi-journée</option>
              <option value="leave">En congé</option>
              <option value="remote">Télétravail</option>
            </select>
          </div>

          {/* Worked time display */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Temps travaillé
            </label>
            <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg">
              <p className="text-sm font-medium text-gray-900">
                {workedMinutes !== null ? formatDuration(workedMinutes) : '-'}
              </p>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Notes / Commentaires
          </label>
          <div className="relative">
            <FileText className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Notes ou commentaires sur cette présence..."
              rows={2}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end pt-4 border-t border-gray-200">
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckCircle className="w-5 h-5" />
            {isPending ? 'Enregistrement...' : 'Enregistrer la présence'}
          </button>
        </div>
      </form>
    </div>
  );
}
