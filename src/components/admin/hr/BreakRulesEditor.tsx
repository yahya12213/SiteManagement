import { useState, useEffect } from 'react';
import { Coffee, Save, Info } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';

interface BreakRules {
  default_break_minutes: number;
  break_start_after_hours: number;
  deduct_break_automatically: boolean;
  allow_multiple_breaks: boolean;
  max_breaks_per_day: number;
}

interface BreakRulesEditorProps {
  currentRules: BreakRules;
}

function BreakRulesEditor({ currentRules }: BreakRulesEditorProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<BreakRules>(currentRules);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setFormData(currentRules);
  }, [currentRules]);

  useEffect(() => {
    const changed = JSON.stringify(formData) !== JSON.stringify(currentRules);
    setHasChanges(changed);
  }, [formData, currentRules]);

  const updateMutation = useMutation({
    mutationFn: async (newRules: BreakRules) => {
      const response = await apiClient.put('/hr/settings/break_rules', {
        setting_value: newRules
      });
      return (response as any).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-settings'] });
      alert('Règles de pause mises à jour avec succès');
      setHasChanges(false);
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Erreur lors de la mise à jour');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (formData.default_break_minutes < 0 || formData.default_break_minutes > 180) {
      alert('La durée de pause doit être entre 0 et 180 minutes');
      return;
    }

    if (formData.break_start_after_hours < 0 || formData.break_start_after_hours > 12) {
      alert('Le seuil d\'application doit être entre 0 et 12 heures');
      return;
    }

    updateMutation.mutate(formData);
  };

  const handleReset = () => {
    setFormData(currentRules);
    setHasChanges(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <Coffee className="h-6 w-6 text-blue-600" />
        <h3 className="text-xl font-bold text-gray-900">Règles de Pause</h3>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">ℹ️ Important</p>
            <p>
              Les employés <strong>ne doivent pas pointer</strong> pour les pauses régulières (déjeuner, etc.).
              Le temps de pause configuré ici sera <strong>automatiquement déduit</strong> des heures travaillées.
            </p>
            <p className="mt-2">
              Ils pointent la sortie uniquement s'ils quittent exceptionnellement leur poste (projet extérieur, urgence).
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Durée de pause */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Durée de pause quotidienne (minutes)
          </label>
          <input
            type="number"
            value={formData.default_break_minutes}
            onChange={(e) => setFormData({ ...formData, default_break_minutes: parseInt(e.target.value) || 0 })}
            min="0"
            max="180"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-sm text-gray-500 mt-1">
            Par exemple : 60 minutes pour une pause déjeuner d'une heure
          </p>
        </div>

        {/* Déduction automatique */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            id="deduct_break_automatically"
            checked={formData.deduct_break_automatically}
            onChange={(e) => setFormData({ ...formData, deduct_break_automatically: e.target.checked })}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
          />
          <label htmlFor="deduct_break_automatically" className="flex-1">
            <div className="text-sm font-medium text-gray-700">
              Déduire automatiquement des heures travaillées
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Si activé, la durée de pause sera automatiquement soustraite du temps de travail calculé
            </div>
          </label>
        </div>

        {/* Seuil d'application */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Appliquer la pause après (heures de travail)
          </label>
          <input
            type="number"
            value={formData.break_start_after_hours}
            onChange={(e) => setFormData({ ...formData, break_start_after_hours: parseInt(e.target.value) || 0 })}
            min="0"
            max="12"
            step="0.5"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-sm text-gray-500 mt-1">
            La pause sera déduite seulement si l'employé travaille plus que ce nombre d'heures
          </p>
        </div>

        {/* Pauses multiples */}
        <div className="border-t border-gray-200 pt-6">
          <div className="flex items-start gap-3 mb-4">
            <input
              type="checkbox"
              id="allow_multiple_breaks"
              checked={formData.allow_multiple_breaks}
              onChange={(e) => setFormData({ ...formData, allow_multiple_breaks: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
            />
            <label htmlFor="allow_multiple_breaks" className="flex-1">
              <div className="text-sm font-medium text-gray-700">
                Autoriser plusieurs pauses par jour
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Pour les journées de travail longues (&gt; 10 heures)
              </div>
            </label>
          </div>

          {formData.allow_multiple_breaks && (
            <div className="ml-7">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre maximum de pauses par jour
              </label>
              <input
                type="number"
                value={formData.max_breaks_per_day}
                onChange={(e) => setFormData({ ...formData, max_breaks_per_day: parseInt(e.target.value) || 1 })}
                min="1"
                max="5"
                className="w-32 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
        </div>

        {/* Example calculation */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="text-sm font-medium text-gray-700 mb-2">📊 Exemple de calcul</div>
          <div className="text-sm text-gray-600 space-y-1">
            <p>
              • Employé entre à <strong>09:00</strong> et sort à <strong>18:00</strong>
            </p>
            <p>
              • Temps total : <strong>9 heures</strong>
            </p>
            <p>
              • Pause déduite : <strong>{formData.default_break_minutes} minutes ({Math.round(formData.default_break_minutes / 60 * 10) / 10}h)</strong>
            </p>
            <p className="pt-2 border-t border-gray-300">
              • Temps travaillé final : <strong>{9 - (formData.default_break_minutes / 60)} heures</strong>
            </p>
          </div>
        </div>

        {/* Action buttons */}
        {hasChanges && (
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={handleReset}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {updateMutation.isPending ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

export default BreakRulesEditor;
