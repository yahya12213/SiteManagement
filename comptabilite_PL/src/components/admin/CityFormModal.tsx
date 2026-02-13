import { useState, useEffect } from 'react';
import { X, MapPin, Hash, Layers } from 'lucide-react';
import { useCity, useCreateCity, useUpdateCity } from '@/hooks/useCities';
import { useSegments } from '@/hooks/useSegments';
import { usePermission } from '@/hooks/usePermission';

interface CityFormModalProps {
  cityId: string | null;
  onClose: () => void;
}

export default function CityFormModal({ cityId, onClose }: CityFormModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    segment_id: '',
  });

  const { data: city } = useCity(cityId || '');
  const { data: segments = [] } = useSegments();
  const createCity = useCreateCity();
  const updateCity = useUpdateCity();

  const isEdit = !!cityId;

  // Permissions
  const { accounting } = usePermission();
  const canSave = isEdit ? accounting.canUpdateCity : accounting.canCreateCity;

  useEffect(() => {
    if (city) {
      setFormData({
        name: (city as any).name,
        code: (city as any).code,
        segment_id: (city as any).segment_id,
      });
    }
  }, [city]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.code.trim() || !formData.segment_id) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    try {
      if (isEdit && cityId) {
        await updateCity.mutateAsync({ id: cityId, ...formData });
      } else {
        await createCity.mutateAsync(formData);
      }
      onClose();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde de la ville');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[500px] md:w-[550px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* En-tête */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <MapPin className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                {isEdit ? 'Modifier la ville' : 'Nouvelle ville'}
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 truncate">
                {isEdit ? 'Modifiez les informations' : 'Ajoutez une nouvelle ville'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 ml-2"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Formulaire */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4 sm:space-y-6">
          {/* Nom de la ville */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom de la ville *
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Casablanca"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Code de la ville */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Code de la ville *
            </label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="Ex: CASA"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent uppercase"
                maxLength={10}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Code court pour identifier la ville (max 10 caractères)
            </p>
          </div>

          {/* Segment */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Segment de formation *
            </label>
            <div className="relative">
              <Layers className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                required
                value={formData.segment_id}
                onChange={(e) => setFormData({ ...formData, segment_id: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent appearance-none"
              >
                <option value="">Sélectionnez un segment</option>
                {segments.map((segment: { id: string; name: string; color?: string; created_at: string }) => (
                  <option key={segment.id} value={segment.id}>
                    {segment.name}
                  </option>
                ))}
              </select>
            </div>
            {segments.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                Aucun segment disponible. Veuillez créer un segment d'abord.
              </p>
            )}
          </div>

          {/* Boutons d'action */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            {canSave && (
              <button
                type="submit"
                disabled={createCity.isPending || updateCity.isPending}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createCity.isPending || updateCity.isPending
                  ? 'Enregistrement...'
                  : isEdit
                  ? 'Mettre à jour'
                  : 'Créer'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
