import { useState } from 'react';
import { X, CalendarClock, AlertCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createRecoveryPeriod,
  updateRecoveryPeriod,
  type RecoveryPeriod,
  type CreateRecoveryPeriodInput,
  type UpdateRecoveryPeriodInput
} from '@/lib/api/hr-recovery';

interface RecoveryPeriodModalProps {
  period?: RecoveryPeriod;
  onClose: () => void;
}

export default function RecoveryPeriodModal({ period, onClose }: RecoveryPeriodModalProps) {
  const queryClient = useQueryClient();
  const isEdit = !!period;

  const [formData, setFormData] = useState<CreateRecoveryPeriodInput>({
    name: period?.name || '',
    description: period?.description || '',
    start_date: period?.start_date || '',
    end_date: period?.end_date || '',
    total_hours_to_recover: period?.total_hours_to_recover || 0,
    department_id: period?.department_id || undefined,
    segment_id: period?.segment_id || undefined,
    centre_id: period?.centre_id || undefined,
    applies_to_all: period?.applies_to_all ?? true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateRecoveryPeriodInput) => {
      return await createRecoveryPeriod(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recovery-periods'] });
      onClose();
    },
    onError: (error: any) => {
      console.error('Error creating recovery period:', error);
      alert(error.response?.data?.error || 'Erreur lors de la création de la période');
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: UpdateRecoveryPeriodInput) => {
      if (!period?.id) throw new Error('Period ID is required');
      return await updateRecoveryPeriod(period.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recovery-periods'] });
      onClose();
    },
    onError: (error: any) => {
      console.error('Error updating recovery period:', error);
      alert(error.response?.data?.error || 'Erreur lors de la modification de la période');
    }
  });

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Le nom est obligatoire';
    }

    if (!formData.start_date) {
      newErrors.start_date = 'La date de début est obligatoire';
    }

    if (!formData.end_date) {
      newErrors.end_date = 'La date de fin est obligatoire';
    }

    if (formData.start_date && formData.end_date) {
      const start = new Date(formData.start_date);
      const end = new Date(formData.end_date);
      if (end < start) {
        newErrors.end_date = 'La date de fin doit être après la date de début';
      }
    }

    if (formData.total_hours_to_recover <= 0) {
      newErrors.total_hours_to_recover = 'Les heures à récupérer doivent être positives';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    try {
      if (isEdit) {
        await updateMutation.mutateAsync(formData);
      } else {
        await createMutation.mutateAsync(formData);
      }
    } catch (error) {
      // Error is handled by mutation's onError
    }
  };

  const handleChange = (field: keyof CreateRecoveryPeriodInput, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[600px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <CalendarClock className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isEdit ? 'Modifier la période' : 'Nouvelle période de récupération'}
              </h2>
              <p className="text-sm text-gray-500">
                {isEdit ? 'Modifier les détails de la période' : 'Créer une nouvelle période de récupération d\'heures'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom de la période <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.name ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Ex: Ramadan 2026, Pont Fête du Travail"
              disabled={isPending}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.name}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={2}
              placeholder="Description optionnelle de la période"
              disabled={isPending}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de début <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => handleChange('start_date', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.start_date ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={isPending}
              />
              {errors.start_date && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.start_date}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date de fin <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => handleChange('end_date', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.end_date ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={isPending}
              />
              {errors.end_date && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.end_date}
                </p>
              )}
            </div>
          </div>

          {/* Total Hours */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Heures totales à récupérer <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={formData.total_hours_to_recover}
                onChange={(e) => handleChange('total_hours_to_recover', parseFloat(e.target.value) || 0)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.total_hours_to_recover ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="60"
                min="0"
                step="0.5"
                disabled={isPending}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                heures
              </div>
            </div>
            {errors.total_hours_to_recover && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.total_hours_to_recover}
              </p>
            )}
            <p className="mt-1 text-sm text-gray-500">
              Nombre total d'heures que les employés doivent récupérer pendant cette période
            </p>
          </div>

          {/* Applies to all */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="applies_to_all"
              checked={formData.applies_to_all}
              onChange={(e) => handleChange('applies_to_all', e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              disabled={isPending}
            />
            <label htmlFor="applies_to_all" className="text-sm font-medium text-gray-700">
              Appliquer à tous les employés
            </label>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-700">
                <p className="font-medium mb-1">Informations importantes:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Cette période représente des heures non travaillées qui doivent être récupérées</li>
                  <li>Vous pourrez ensuite déclarer des jours off et des jours de récupération</li>
                  <li>Les heures récupérées seront automatiquement soustraites du compteur</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{isEdit ? 'Modification...' : 'Création...'}</span>
                </>
              ) : (
                <span>{isEdit ? 'Modifier' : 'Créer la période'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
