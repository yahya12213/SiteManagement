import { useState, useEffect } from 'react';
import { X, Edit3, Layers, MapPin, Calendar, Tag, FileText } from 'lucide-react';
import { useUpdateDeclarationMetadata } from '@/hooks/useAdminDeclarations';
import { useSegments } from '@/hooks/useSegments';
import { useCities } from '@/hooks/useCities';
import type { Declaration, DeclarationStatus } from '@/lib/api/declarations';

interface EditDeclarationModalProps {
  declaration: Declaration;
  onClose: () => void;
}

export default function EditDeclarationModal({ declaration, onClose }: EditDeclarationModalProps) {
  const [formData, setFormData] = useState<{
    session_name: string;
    segment_id: string;
    city_id: string;
    start_date: string;
    end_date: string;
    status: DeclarationStatus;
  }>({
    session_name: declaration.session_name || '',
    segment_id: declaration.segment_id,
    city_id: declaration.city_id,
    start_date: declaration.start_date.split('T')[0], // Format YYYY-MM-DD pour input type="date"
    end_date: declaration.end_date.split('T')[0],
    status: declaration.status,
  });

  const { data: segments = [] } = useSegments();
  const { data: allCities = [] } = useCities();
  const updateDeclaration = useUpdateDeclarationMetadata();

  // Filtrer les villes par segment sélectionné
  const cities = allCities.filter((city: any) => city.segment_id === formData.segment_id);

  // Vérifier si la ville sélectionnée appartient au segment
  useEffect(() => {
    if (formData.segment_id && formData.city_id) {
      const cityBelongsToSegment = allCities.find(
        (city: any) => city.id === formData.city_id && city.segment_id === formData.segment_id
      );

      // Si la ville ne correspond pas au segment, réinitialiser la sélection
      if (!cityBelongsToSegment) {
        setFormData(prev => ({ ...prev, city_id: '' }));
      }
    }
  }, [formData.segment_id, formData.city_id, allCities]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.session_name.trim()) {
      alert('Veuillez saisir le nom de la session');
      return;
    }
    if (!formData.segment_id || !formData.city_id || !formData.start_date || !formData.end_date) {
      alert('Veuillez remplir tous les champs obligatoires');
      return;
    }

    // Vérifier que la date de fin est après la date de début
    if (new Date(formData.end_date) < new Date(formData.start_date)) {
      alert('La date de fin doit être postérieure à la date de début');
      return;
    }

    try {
      await updateDeclaration.mutateAsync({
        id: declaration.id,
        ...formData,
      });
      onClose();
    } catch (error) {
      console.error('Erreur lors de la modification:', error);
      alert('Erreur lors de la modification de la déclaration');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[650px] md:w-[750px] lg:w-[850px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* En-tête */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Edit3 className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 truncate">
                Modifier la déclaration
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 truncate">
                Professeur: {declaration.professor_name}
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
          {/* Nom de la session - PREMIER CHAMP */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nom de la session *
            </label>
            <div className="relative">
              <FileText className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                required
                value={formData.session_name}
                onChange={(e) => setFormData({ ...formData, session_name: e.target.value })}
                placeholder="Ex: Session Janvier 2025"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
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
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
              >
                <option value="">Sélectionnez un segment</option>
                {segments.map((segment: any) => (
                  <option key={segment.id} value={segment.id}>
                    {segment.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Ville */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Ville *
            </label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                required
                value={formData.city_id}
                onChange={(e) => setFormData({ ...formData, city_id: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
                disabled={!formData.segment_id}
              >
                <option value="">Sélectionnez une ville</option>
                {cities.map((city: any) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>
            {!formData.segment_id && (
              <p className="mt-1 text-xs text-amber-600">
                Veuillez d'abord sélectionner un segment
              </p>
            )}
            {formData.segment_id && cities.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                Aucune ville disponible pour ce segment
              </p>
            )}
          </div>

          {/* Date de début */}
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
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Date de fin */}
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
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Statut */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Statut *
            </label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                required
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as DeclarationStatus })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
              >
                <option value="brouillon">Brouillon</option>
                <option value="a_declarer">À déclarer</option>
                <option value="en_cours">En cours</option>
                <option value="soumise">Soumise</option>
                <option value="approuvee">Approuvée</option>
                <option value="refusee">Refusée</option>
              </select>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Vous pouvez changer le statut (ex: de brouillon à à déclarer)
            </p>
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
            <button
              type="submit"
              disabled={updateDeclaration.isPending}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateDeclaration.isPending ? 'Modification...' : 'Modifier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
