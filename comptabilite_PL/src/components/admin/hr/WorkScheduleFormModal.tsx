import { useState, useEffect } from 'react';
import { X, Clock, Calendar, CheckCircle, FileText } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface WorkScheduleFormModalProps {
  scheduleId?: string | null;
  onClose: () => void;
}

interface WorkSchedule {
  id: string;
  name: string;
  description?: string;
  monday_start?: string;
  monday_end?: string;
  tuesday_start?: string;
  tuesday_end?: string;
  wednesday_start?: string;
  wednesday_end?: string;
  thursday_start?: string;
  thursday_end?: string;
  friday_start?: string;
  friday_end?: string;
  saturday_start?: string;
  saturday_end?: string;
  sunday_start?: string;
  sunday_end?: string;
  break_start?: string;
  break_end?: string;
  tolerance_late_minutes?: number;
  tolerance_early_leave_minutes?: number;
  min_hours_for_half_day?: number;
  weekly_hours: number;
  is_default: boolean;
  is_active: boolean;
}

const DAYS = [
  { key: 'monday', label: 'Lundi' },
  { key: 'tuesday', label: 'Mardi' },
  { key: 'wednesday', label: 'Mercredi' },
  { key: 'thursday', label: 'Jeudi' },
  { key: 'friday', label: 'Vendredi' },
  { key: 'saturday', label: 'Samedi' },
  { key: 'sunday', label: 'Dimanche' },
];

export default function WorkScheduleFormModal({ scheduleId, onClose }: WorkScheduleFormModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    monday_start: '09:00',
    monday_end: '17:00',
    tuesday_start: '09:00',
    tuesday_end: '17:00',
    wednesday_start: '09:00',
    wednesday_end: '17:00',
    thursday_start: '09:00',
    thursday_end: '17:00',
    friday_start: '09:00',
    friday_end: '17:00',
    saturday_start: '',
    saturday_end: '',
    sunday_start: '',
    sunday_end: '',
    break_start: '13:00',
    break_end: '14:00',
    tolerance_late: 15,
    tolerance_early: 10,
    min_hours_half_day: 4,
    is_default: false,
    is_active: true,
  });

  // Fetch schedule details if editing
  const { data: scheduleData } = useQuery({
    queryKey: ['hr-work-schedule', scheduleId],
    queryFn: async () => {
      if (!scheduleId) return null;
      const response = await apiClient.get<{ success: boolean; schedule: WorkSchedule }>(`/hr/schedule-management/schedules/${scheduleId}`);
      return (response as any).schedule;
    },
    enabled: !!scheduleId,
  });

  // Initialize form when data loads
  useEffect(() => {
    if (scheduleData) {
      setFormData({
        name: scheduleData.name || '',
        description: scheduleData.description || '',
        monday_start: scheduleData.monday_start || '',
        monday_end: scheduleData.monday_end || '',
        tuesday_start: scheduleData.tuesday_start || '',
        tuesday_end: scheduleData.tuesday_end || '',
        wednesday_start: scheduleData.wednesday_start || '',
        wednesday_end: scheduleData.wednesday_end || '',
        thursday_start: scheduleData.thursday_start || '',
        thursday_end: scheduleData.thursday_end || '',
        friday_start: scheduleData.friday_start || '',
        friday_end: scheduleData.friday_end || '',
        saturday_start: scheduleData.saturday_start || '',
        saturday_end: scheduleData.saturday_end || '',
        sunday_start: scheduleData.sunday_start || '',
        sunday_end: scheduleData.sunday_end || '',
        break_start: scheduleData.break_start || '13:00',
        break_end: scheduleData.break_end || '14:00',
        tolerance_late: scheduleData.tolerance_late_minutes !== undefined ? scheduleData.tolerance_late_minutes : 15,
        tolerance_early: scheduleData.tolerance_early_leave_minutes !== undefined ? scheduleData.tolerance_early_leave_minutes : 10,
        min_hours_half_day: scheduleData.min_hours_for_half_day !== undefined ? scheduleData.min_hours_for_half_day : 4,
        is_default: scheduleData.is_default || false,
        is_active: scheduleData.is_active !== false,
      });
    }
  }, [scheduleData]);

  // Create mutation
  const createSchedule = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.post<{ success: boolean; schedule: WorkSchedule }>('/hr/schedule-management/schedules', data);
      return (response as any).schedule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-work-schedules'] });
      alert('Horaire de travail créé avec succès');
      onClose();
    },
  });

  // Update mutation
  const updateSchedule = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.put<{ success: boolean; schedule: WorkSchedule }>(`/hr/schedule-management/schedules/${scheduleId}`, data);
      return (response as any).schedule;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-work-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['hr-work-schedule', scheduleId] });
      alert('Horaire de travail mis à jour avec succès');
      onClose();
    },
  });

  const calculateWeeklyHours = () => {
    let totalMinutes = 0;

    DAYS.forEach(day => {
      const startKey = `${day.key}_start` as keyof typeof formData;
      const endKey = `${day.key}_end` as keyof typeof formData;
      const start = formData[startKey] as string;
      const end = formData[endKey] as string;

      if (start && end) {
        const [startHour, startMin] = start.split(':').map(Number);
        const [endHour, endMin] = end.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        if (endMinutes > startMinutes) {
          totalMinutes += endMinutes - startMinutes;
        }
      }
    });

    return (totalMinutes / 60).toFixed(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Le nom est obligatoire');
      return;
    }

    // Validate time ranges
    for (const day of DAYS) {
      const startKey = `${day.key}_start` as keyof typeof formData;
      const endKey = `${day.key}_end` as keyof typeof formData;
      const start = formData[startKey] as string;
      const end = formData[endKey] as string;

      if ((start && !end) || (!start && end)) {
        alert(`${day.label}: Les heures de début et de fin doivent être toutes les deux renseignées ou vides`);
        return;
      }

      if (start && end) {
        const [startHour, startMin] = start.split(':').map(Number);
        const [endHour, endMin] = end.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;

        if (endMinutes <= startMinutes) {
          alert(`${day.label}: L'heure de fin doit être après l'heure de début`);
          return;
        }
      }
    }

    const payload = {
      nom: formData.name.trim(),
      description: formData.description.trim() || null,
      horaires: {
        Lundi: { actif: !!formData.monday_start, heureDebut: formData.monday_start || '', heureFin: formData.monday_end || '' },
        Mardi: { actif: !!formData.tuesday_start, heureDebut: formData.tuesday_start || '', heureFin: formData.tuesday_end || '' },
        Mercredi: { actif: !!formData.wednesday_start, heureDebut: formData.wednesday_start || '', heureFin: formData.wednesday_end || '' },
        Jeudi: { actif: !!formData.thursday_start, heureDebut: formData.thursday_start || '', heureFin: formData.thursday_end || '' },
        Vendredi: { actif: !!formData.friday_start, heureDebut: formData.friday_start || '', heureFin: formData.friday_end || '' },
        Samedi: { actif: !!formData.saturday_start, heureDebut: formData.saturday_start || '', heureFin: formData.saturday_end || '' },
        Dimanche: { actif: !!formData.sunday_start, heureDebut: formData.sunday_start || '', heureFin: formData.sunday_end || '' },
      },
      break_start: formData.break_start || null,
      break_end: formData.break_end || null,
      heures_hebdo: parseFloat(calculateWeeklyHours()),
      tolerance_late: formData.tolerance_late,
      tolerance_early: formData.tolerance_early,
      min_hours_for_half_day: formData.min_hours_half_day,
      is_default: formData.is_default,
      actif: formData.is_active,
    };

    try {
      if (scheduleId) {
        await updateSchedule.mutateAsync(payload);
      } else {
        await createSchedule.mutateAsync(payload);
      }
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert(error.response?.data?.error || 'Erreur lors de la sauvegarde de l\'horaire');
    }
  };

  const handleChange = (field: string, value: string | boolean | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const applyToAllDays = () => {
    if (!formData.monday_start || !formData.monday_end) {
      alert('Veuillez d\'abord définir les horaires du lundi');
      return;
    }

    setFormData(prev => ({
      ...prev,
      tuesday_start: prev.monday_start,
      tuesday_end: prev.monday_end,
      wednesday_start: prev.monday_start,
      wednesday_end: prev.monday_end,
      thursday_start: prev.monday_start,
      thursday_end: prev.monday_end,
      friday_start: prev.monday_start,
      friday_end: prev.monday_end,
    }));
  };

  const isPending = createSchedule.isPending || updateSchedule.isPending;
  const weeklyHours = calculateWeeklyHours();

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[700px] md:w-[850px] lg:w-[950px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {scheduleId ? 'Modifier l\'horaire de travail' : 'Nouvel horaire de travail'}
              </h2>
              <p className="text-sm text-gray-500">Configuration des horaires hebdomadaires</p>
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
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-600" />
              Informations de base
            </h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nom de l'horaire *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Horaire standard 35h"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                placeholder="Description de l'horaire de travail..."
                rows={2}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Weekly Schedule */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-600" />
                Horaires hebdomadaires
              </h3>
              <button
                type="button"
                onClick={applyToAllDays}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Appliquer lundi à tous les jours
              </button>
            </div>

            <div className="space-y-3">
              {DAYS.map(day => {
                const startKey = `${day.key}_start` as keyof typeof formData;
                const endKey = `${day.key}_end` as keyof typeof formData;
                const start = formData[startKey] as string;
                const end = formData[endKey] as string;

                return (
                  <div key={day.key} className="flex items-center gap-4 p-3 border border-gray-200 rounded-lg">
                    <div className="w-24">
                      <p className="text-sm font-medium text-gray-900">{day.label}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="time"
                        value={start}
                        onChange={(e) => handleChange(startKey, e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <span className="text-gray-500">→</span>
                      <input
                        type="time"
                        value={end}
                        onChange={(e) => handleChange(endKey, e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      {start && end && (
                        <span className="text-sm text-gray-600 ml-2">
                          {(() => {
                            const [startHour, startMin] = start.split(':').map(Number);
                            const [endHour, endMin] = end.split(':').map(Number);
                            const startMinutes = startHour * 60 + startMin;
                            const endMinutes = endHour * 60 + endMin;
                            const diffMinutes = endMinutes - startMinutes;
                            const hours = Math.floor(diffMinutes / 60);
                            const mins = diffMinutes % 60;
                            return diffMinutes > 0 ? `${hours}h${mins.toString().padStart(2, '0')}` : '-';
                          })()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Weekly Total */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-blue-900">Total hebdomadaire</p>
                <p className="text-2xl font-bold text-blue-600">{weeklyHours}h</p>
              </div>
            </div>
          </div>

          {/* Break Configuration */}
          <div className="space-y-4 border-t border-gray-200 pt-6">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-600" />
              Pause quotidienne
            </h3>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                ⏸️ Les employés n'ont pas besoin de pointer pendant la pause.
                Le temps sera automatiquement déduit si la journée dure ≥ 4 heures.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Début de la pause
                </label>
                <input
                  type="time"
                  value={formData.break_start || ''}
                  onChange={(e) => handleChange('break_start', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fin de la pause
                </label>
                <input
                  type="time"
                  value={formData.break_end || ''}
                  onChange={(e) => handleChange('break_end', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {formData.break_start && formData.break_end && (
              <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                Durée: {(() => {
                  const [startH, startM] = formData.break_start.split(':').map(Number);
                  const [endH, endM] = formData.break_end.split(':').map(Number);
                  const minutes = (endH * 60 + endM) - (startH * 60 + startM);
                  return `${Math.floor(minutes / 60)}h${(minutes % 60).toString().padStart(2, '0')}`;
                })()}
              </div>
            )}
          </div>

          {/* Tolerance Configuration */}
          <div className="space-y-4 border-t border-gray-200 pt-6">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-gray-600" />
              Paramètres de tolérance
            </h3>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <p className="text-sm text-yellow-800">
                ⚙️ Configurez les seuils de tolérance et les règles de calcul des présences.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="tolerance_late" className="block text-sm font-medium text-gray-700 mb-2">
                  Tolérance retard (minutes)
                </label>
                <input
                  id="tolerance_late"
                  type="number"
                  min="0"
                  max="60"
                  value={formData.tolerance_late}
                  onChange={(e) => handleChange('tolerance_late', parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Délai accepté après l'heure de début
                </p>
              </div>

              <div>
                <label htmlFor="tolerance_early" className="block text-sm font-medium text-gray-700 mb-2">
                  Tolérance départ anticipé (minutes)
                </label>
                <input
                  id="tolerance_early"
                  type="number"
                  min="0"
                  max="60"
                  value={formData.tolerance_early}
                  onChange={(e) => handleChange('tolerance_early', parseInt(e.target.value) || 0)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Délai accepté avant l'heure de fin
                </p>
              </div>

              <div>
                <label htmlFor="min_hours_half_day" className="block text-sm font-medium text-gray-700 mb-2">
                  Heures min. pour demi-journée
                </label>
                <input
                  id="min_hours_half_day"
                  type="number"
                  min="1"
                  max="8"
                  step="0.5"
                  value={formData.min_hours_half_day}
                  onChange={(e) => handleChange('min_hours_half_day', parseFloat(e.target.value) || 4)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Seuil pour comptabiliser 0.5 jour
                </p>
              </div>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-gray-600" />
              Options
            </h3>

            <div className="space-y-3">
              {/* Is Default */}
              <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_default}
                  onChange={(e) => handleChange('is_default', e.target.checked)}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Horaire par défaut</p>
                  <p className="text-xs text-gray-500">Utilisé automatiquement pour les nouveaux employés</p>
                </div>
              </label>

              {/* Is Active */}
              <label className="flex items-center gap-3 p-3 border border-red-200 rounded-lg hover:bg-red-50 cursor-pointer bg-red-50">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => {
                    if (e.target.checked) {
                      const confirmed = window.confirm(
                        "⚠️ ATTENTION: Activer cet horaire désactivera automatiquement tous les autres horaires du système.\n\nTous les employés utiliseront cet horaire.\n\nContinuer?"
                      );
                      if (!confirmed) return;
                    }
                    handleChange('is_active', e.target.checked);
                  }}
                  className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">Actif</p>
                  <p className="text-xs text-red-600 font-medium">
                    ⚠️ Un seul horaire peut être actif à la fois
                  </p>
                </div>
              </label>
            </div>
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
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? 'Enregistrement...' : scheduleId ? 'Mettre à jour' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
