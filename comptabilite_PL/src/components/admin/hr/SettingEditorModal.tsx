import { useState, useEffect } from 'react';
import { X, Save, Settings } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface SettingEditorModalProps {
  settingKey: string;
  settingName: string;
  currentValue: any;
  onClose: () => void;
}

interface AttendanceRules {
  late_tolerance_minutes: number;
  early_leave_tolerance_minutes: number;
  min_hours_for_full_day: number;
  min_hours_for_half_day: number;
  auto_mark_absent_after_hours: number;
  require_justification_for_absence: boolean;
}

interface LeaveRules {
  annual_leave_accrual_rate: number;
  annual_leave_max_days: number;
  allow_negative_balance: boolean;
  max_negative_days: number;
  carry_over_allowed: boolean;
  max_carry_over_days: number;
  carry_over_expiry_months: number;
  min_advance_notice_days: number;
  block_overlapping_requests: boolean;
}

export default function SettingEditorModal({ settingKey, settingName, currentValue, onClose }: SettingEditorModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<AttendanceRules | LeaveRules>(currentValue);

  useEffect(() => {
    setFormData(currentValue);
  }, [currentValue]);

  const updateSetting = useMutation({
    mutationFn: async (newValue: any) => {
      const response = await apiClient.put(`/hr/settings/${settingKey}`, {
        setting_value: newValue
      });
      return (response as any).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-settings'] });
      alert('Paramètres mis à jour avec succès');
      onClose();
    },
    onError: (error: any) => {
      console.error('Error updating setting:', error);
      alert(error.response?.data?.error || 'Erreur lors de la mise à jour des paramètres');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (settingKey === 'attendance_rules') {
      const rules = formData as AttendanceRules;
      if (rules.min_hours_for_half_day > rules.min_hours_for_full_day) {
        alert('Les heures minimum pour une demi-journée ne peuvent pas dépasser celles d\'une journée complète');
        return;
      }
    }

    if (settingKey === 'leave_rules') {
      const rules = formData as LeaveRules;
      if (!rules.allow_negative_balance && rules.max_negative_days > 0) {
        alert('Le nombre de jours négatifs doit être 0 si le solde négatif n\'est pas autorisé');
        return;
      }
    }

    updateSetting.mutate(formData);
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const renderAttendanceRulesFields = () => {
    const rules = formData as AttendanceRules;
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tolérance de retard (minutes)
          </label>
          <input
            type="number"
            min="0"
            value={rules.late_tolerance_minutes}
            onChange={(e) => handleChange('late_tolerance_minutes', parseInt(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">Temps de retard acceptable avant pénalité</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tolérance de départ anticipé (minutes)
          </label>
          <input
            type="number"
            min="0"
            value={rules.early_leave_tolerance_minutes}
            onChange={(e) => handleChange('early_leave_tolerance_minutes', parseInt(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">Temps de départ anticipé acceptable</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Heures minimum pour journée complète
          </label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={rules.min_hours_for_full_day}
            onChange={(e) => handleChange('min_hours_for_full_day', parseFloat(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">Nombre d'heures requis pour compter une journée complète</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Heures minimum pour demi-journée
          </label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={rules.min_hours_for_half_day}
            onChange={(e) => handleChange('min_hours_for_half_day', parseFloat(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">Nombre d'heures requis pour compter une demi-journée</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Auto-marquer absent après (heures)
          </label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={rules.auto_mark_absent_after_hours}
            onChange={(e) => handleChange('auto_mark_absent_after_hours', parseFloat(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">Marquer automatiquement absent si pas de pointage après X heures</p>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            checked={rules.require_justification_for_absence}
            onChange={(e) => handleChange('require_justification_for_absence', e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label className="ml-2 text-sm font-medium text-gray-700">
            Exiger une justification pour les absences
          </label>
        </div>
      </div>
    );
  };

  const renderLeaveRulesFields = () => {
    const rules = formData as LeaveRules;
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Taux d'accumulation congés annuels (jours/mois)
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={rules.annual_leave_accrual_rate}
            onChange={(e) => handleChange('annual_leave_accrual_rate', parseFloat(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">Nombre de jours de congé accumulés par mois travaillé</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Maximum de jours de congés annuels
          </label>
          <input
            type="number"
            min="0"
            value={rules.annual_leave_max_days}
            onChange={(e) => handleChange('annual_leave_max_days', parseInt(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">Nombre maximum de jours de congés par an</p>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            checked={rules.allow_negative_balance}
            onChange={(e) => handleChange('allow_negative_balance', e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label className="ml-2 text-sm font-medium text-gray-700">
            Permettre un solde de congés négatif
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Maximum de jours en négatif
          </label>
          <input
            type="number"
            min="0"
            value={rules.max_negative_days}
            onChange={(e) => handleChange('max_negative_days', parseInt(e.target.value))}
            disabled={!rules.allow_negative_balance}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
          />
          <p className="mt-1 text-xs text-gray-500">Nombre de jours négatifs autorisés (0 si non permis)</p>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            checked={rules.carry_over_allowed}
            onChange={(e) => handleChange('carry_over_allowed', e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label className="ml-2 text-sm font-medium text-gray-700">
            Autoriser le report de congés
          </label>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Maximum de jours reportables
          </label>
          <input
            type="number"
            min="0"
            value={rules.max_carry_over_days}
            onChange={(e) => handleChange('max_carry_over_days', parseInt(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">Nombre maximum de jours pouvant être reportés</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Expiration des congés reportés (mois)
          </label>
          <input
            type="number"
            min="0"
            value={rules.carry_over_expiry_months}
            onChange={(e) => handleChange('carry_over_expiry_months', parseInt(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">Nombre de mois avant expiration des congés reportés</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Préavis minimum (jours)
          </label>
          <input
            type="number"
            min="0"
            value={rules.min_advance_notice_days}
            onChange={(e) => handleChange('min_advance_notice_days', parseInt(e.target.value))}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <p className="mt-1 text-xs text-gray-500">Nombre de jours de préavis requis pour une demande de congé</p>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            checked={rules.block_overlapping_requests}
            onChange={(e) => handleChange('block_overlapping_requests', e.target.checked)}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label className="ml-2 text-sm font-medium text-gray-700">
            Bloquer les demandes de congés qui se chevauchent
          </label>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[650px] md:w-[750px] lg:w-[850px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Settings className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Modifier les Paramètres</h2>
              <p className="text-sm text-gray-500">{settingName}</p>
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
        <form onSubmit={handleSubmit} className="p-6">
          {settingKey === 'attendance_rules' && renderAttendanceRulesFields()}
          {settingKey === 'leave_rules' && renderLeaveRulesFields()}

          {/* Action Buttons */}
          <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={updateSetting.isPending}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-5 h-5" />
              {updateSetting.isPending ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
