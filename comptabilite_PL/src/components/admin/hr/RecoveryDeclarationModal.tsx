import { useState } from 'react';
import { X, Calendar, Clock, AlertCircle, Info } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getRecoveryPeriods,
  createRecoveryDeclaration,
  updateRecoveryDeclaration,
  type RecoveryDeclaration,
  type RecoveryPeriod,
  type CreateRecoveryDeclarationInput,
  type UpdateRecoveryDeclarationInput
} from '@/lib/api/hr-recovery';

interface RecoveryDeclarationModalProps {
  declaration?: RecoveryDeclaration;
  periodId?: string;
  onClose: () => void;
}

export default function RecoveryDeclarationModal({
  declaration,
  periodId,
  onClose
}: RecoveryDeclarationModalProps) {
  const queryClient = useQueryClient();
  const isEdit = !!declaration;

  const [formData, setFormData] = useState<CreateRecoveryDeclarationInput>({
    recovery_period_id: declaration?.recovery_period_id || periodId || '',
    recovery_date: declaration?.recovery_date || '',
    hours_to_recover: declaration?.hours_to_recover || 8,
    is_day_off: declaration?.is_day_off ?? false,
    notes: declaration?.notes || '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch recovery periods
  const { data: periodsData } = useQuery({
    queryKey: ['recovery-periods', { status: 'active' }],
    queryFn: async () => await getRecoveryPeriods({ status: 'active' }),
  });
  const periods = periodsData?.periods || [];

  // Get selected period details
  const selectedPeriod = periods.find((p: RecoveryPeriod) => p.id === formData.recovery_period_id);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: CreateRecoveryDeclarationInput) => {
      return await createRecoveryDeclaration(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recovery-declarations'] });
      queryClient.invalidateQueries({ queryKey: ['recovery-periods'] });
      onClose();
    },
    onError: (error: any) => {
      console.error('Error creating recovery declaration:', error);
      alert(error.response?.data?.error || 'Erreur lors de la création de la déclaration');
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: UpdateRecoveryDeclarationInput) => {
      if (!declaration?.id) throw new Error('Declaration ID is required');
      return await updateRecoveryDeclaration(declaration.id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recovery-declarations'] });
      queryClient.invalidateQueries({ queryKey: ['recovery-periods'] });
      onClose();
    },
    onError: (error: any) => {
      console.error('Error updating recovery declaration:', error);
      alert(error.response?.data?.error || 'Erreur lors de la modification de la déclaration');
    }
  });

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.recovery_period_id) {
      newErrors.recovery_period_id = 'La période est obligatoire';
    }

    if (!formData.recovery_date) {
      newErrors.recovery_date = 'La date est obligatoire';
    }

    if (formData.hours_to_recover < 0) {
      newErrors.hours_to_recover = 'Les heures doivent être positives';
    }

    if (!formData.is_day_off && formData.hours_to_recover === 0) {
      newErrors.hours_to_recover = 'Les heures à récupérer ne peuvent pas être 0 pour un jour de récupération';
    }

    // Check if hours exceed remaining hours
    if (selectedPeriod && !formData.is_day_off) {
      if (formData.hours_to_recover > selectedPeriod.hours_remaining) {
        newErrors.hours_to_recover = `Heures restantes insuffisantes (${selectedPeriod.hours_remaining}h disponibles)`;
      }
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
        await updateMutation.mutateAsync({
          recovery_date: formData.recovery_date,
          hours_to_recover: formData.hours_to_recover,
          notes: formData.notes,
        });
      } else {
        const result = await createMutation.mutateAsync(formData);
        if (result.employees_affected) {
          alert(`Déclaration créée avec succès. ${result.employees_affected} employés concernés.`);
        }
      }
    } catch (error) {
      // Error is handled by mutation's onError
    }
  };

  const handleChange = (field: keyof CreateRecoveryDeclarationInput, value: any) => {
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
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[550px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              formData.is_day_off ? 'bg-green-100' : 'bg-orange-100'
            }`}>
              <Calendar className={`w-6 h-6 ${formData.is_day_off ? 'text-green-600' : 'text-orange-600'}`} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isEdit ? 'Modifier la déclaration' : 'Nouvelle déclaration'}
              </h2>
              <p className="text-sm text-gray-500">
                {isEdit ? 'Modifier les détails' : 'Déclarer un jour off ou un jour de récupération'}
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
          {/* Period Selection */}
          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Période de récupération <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.recovery_period_id}
                onChange={(e) => handleChange('recovery_period_id', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  errors.recovery_period_id ? 'border-red-500' : 'border-gray-300'
                }`}
                disabled={isPending || !!periodId}
              >
                <option value="">Sélectionner une période...</option>
                {periods.map((period: RecoveryPeriod) => (
                  <option key={period.id} value={period.id}>
                    {period.name} ({period.hours_remaining}h restantes)
                  </option>
                ))}
              </select>
              {errors.recovery_period_id && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.recovery_period_id}
                </p>
              )}
            </div>
          )}

          {/* Period Info */}
          {selectedPeriod && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Période:</span>
                <span className="font-medium">{selectedPeriod.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Heures totales:</span>
                <span className="font-medium">{selectedPeriod.total_hours_to_recover}h</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Déjà récupérées:</span>
                <span className="font-medium">{selectedPeriod.hours_recovered}h</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Restantes:</span>
                <span className="font-medium text-orange-600">{selectedPeriod.hours_remaining}h</span>
              </div>
            </div>
          )}

          {/* Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Type de déclaration <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleChange('is_day_off', true)}
                className={`p-4 border-2 rounded-lg transition-all ${
                  formData.is_day_off
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                disabled={isPending}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    formData.is_day_off ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    ✓
                  </div>
                  <span className="font-medium text-sm">Jour off</span>
                  <span className="text-xs text-gray-500 text-center">
                    Jour où les employés ne travaillent pas (payé)
                  </span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleChange('is_day_off', false)}
                className={`p-4 border-2 rounded-lg transition-all ${
                  !formData.is_day_off
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                disabled={isPending}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    !formData.is_day_off ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    <Clock className="w-4 h-4" />
                  </div>
                  <span className="font-medium text-sm">Récupération</span>
                  <span className="text-xs text-gray-500 text-center">
                    Jour où les employés doivent venir
                  </span>
                </div>
              </button>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date {formData.is_day_off ? 'du jour off' : 'de récupération'} <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={formData.recovery_date}
              onChange={(e) => handleChange('recovery_date', e.target.value)}
              className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.recovery_date ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={isPending}
            />
            {errors.recovery_date && (
              <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.recovery_date}
              </p>
            )}
          </div>

          {/* Hours to Recover */}
          {!formData.is_day_off && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Heures à récupérer ce jour <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.hours_to_recover}
                  onChange={(e) => handleChange('hours_to_recover', parseFloat(e.target.value) || 0)}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    errors.hours_to_recover ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="8"
                  min="0"
                  step="0.5"
                  disabled={isPending}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                  heures
                </div>
              </div>
              {errors.hours_to_recover && (
                <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.hours_to_recover}
                </p>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes / Commentaires
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
              placeholder={formData.is_day_off
                ? "Ex: Pont Fête du Travail - Jeudi férié + Vendredi off"
                : "Ex: Récupération du pont"}
              disabled={isPending}
            />
          </div>

          {/* Info Box */}
          <div className={`border rounded-lg p-4 ${
            formData.is_day_off ? 'bg-green-50 border-green-200' : 'bg-orange-50 border-orange-200'
          }`}>
            <div className="flex gap-2">
              <Info className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                formData.is_day_off ? 'text-green-600' : 'text-orange-600'
              }`} />
              <div className="text-sm">
                {formData.is_day_off ? (
                  <>
                    <p className="font-medium mb-1 text-green-700">Jour off donné:</p>
                    <ul className="list-disc list-inside space-y-1 text-green-700">
                      <li>Les employés ne viennent pas ce jour</li>
                      <li>Ils seront payés normalement</li>
                      <li>Pas de déduction de heures pour ce jour</li>
                    </ul>
                  </>
                ) : (
                  <>
                    <p className="font-medium mb-1 text-orange-700">Jour de récupération:</p>
                    <ul className="list-disc list-inside space-y-1 text-orange-700">
                      <li>Les employés doivent venir travailler</li>
                      <li>Les heures seront décomptées du solde</li>
                      <li>Si absent: déduction salariale appliquée</li>
                    </ul>
                  </>
                )}
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
              className={`px-5 py-2.5 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
                formData.is_day_off ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'
              }`}
            >
              {isPending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>{isEdit ? 'Modification...' : 'Création...'}</span>
                </>
              ) : (
                <span>{isEdit ? 'Modifier' : 'Créer la déclaration'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
