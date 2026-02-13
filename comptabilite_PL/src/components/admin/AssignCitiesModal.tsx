import { useState } from 'react';
import { X, MapPin, Plus, Trash2, Search, AlertCircle } from 'lucide-react';
import { useProfessorCities, useAssignCityToProfessor, useUnassignCityFromProfessor, useProfessorSegments } from '@/hooks/useProfessors';
import { useCities } from '@/hooks/useCities';
import { usePermission } from '@/hooks/usePermission';

interface AssignCitiesModalProps {
  professorId: string;
  professorName: string;
  onClose: () => void;
}

export default function AssignCitiesModal({ professorId, professorName, onClose }: AssignCitiesModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCityIds, setSelectedCityIds] = useState<string[]>([]);
  const [filterSegmentId, setFilterSegmentId] = useState<string>('all');

  // Permissions
  const { accounting } = usePermission();
  const canAssignCities = accounting.canAssignProfessorCities;

  const { data: professorCities = [], isLoading: loadingProfessorCities } = useProfessorCities(professorId);
  const { data: professorSegments = [], isLoading: loadingProfessorSegments } = useProfessorSegments(professorId);
  const { data: allCities = [], isLoading: loadingAllCities } = useCities();
  const assignCity = useAssignCityToProfessor();
  const unassignCity = useUnassignCityFromProfessor();

  // Filtrer les villes disponibles (non affectées au professeur ET appartenant aux segments affectés)
  const professorSegmentIds = professorSegments.map((s: { id: string; name: string; color?: string }) => s.id);
  const availableCities = (allCities as any[]).filter(
    (city: { id: string; name: string; segment_id: string; segment_name?: string; created_at: string }) =>
      !professorCities.some((pc: { id: string; name: string; segment_name: string }) => pc.id === city.id) &&
      professorSegmentIds.includes(city.segment_id)
  );

  // Filtrer par recherche et par segment
  const filteredAvailableCities = availableCities.filter((city: { id: string; name: string; segment_id: string; segment_name?: string; created_at: string }) => {
    const matchesSearch = city.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      city.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSegment = filterSegmentId === 'all' || city.segment_id === filterSegmentId;
    return matchesSearch && matchesSegment;
  });

  const handleToggleCity = (cityId: string) => {
    setSelectedCityIds(prev =>
      prev.includes(cityId)
        ? prev.filter(id => id !== cityId)
        : [...prev, cityId]
    );
  };

  const handleToggleAll = () => {
    if (selectedCityIds.length === filteredAvailableCities.length) {
      setSelectedCityIds([]);
    } else {
      setSelectedCityIds(filteredAvailableCities.map((c: { id: string; name: string; segment_id: string; segment_name?: string; created_at: string }) => c.id));
    }
  };

  const handleAssign = async () => {
    if (selectedCityIds.length === 0) {
      alert('Veuillez sélectionner au moins une ville');
      return;
    }

    try {
      for (const cityId of selectedCityIds) {
        await assignCity.mutateAsync({ professorId, cityId });
      }
      setSelectedCityIds([]);
      setSearchTerm('');
    } catch (error: any) {
      console.error('Erreur lors de l\'affectation:', error);
      alert(error.message || 'Erreur lors de l\'affectation des villes');
    }
  };

  const handleUnassign = async (cityId: string, cityName: string) => {
    if (window.confirm(`Voulez-vous retirer "${cityName}" de ce professeur ?`)) {
      try {
        await unassignCity.mutateAsync({ professorId, cityId });
      } catch (error) {
        console.error('Erreur lors du retrait:', error);
        alert('Erreur lors du retrait de la ville');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[650px] md:w-[750px] lg:w-[850px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* En-tête */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <MapPin className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Affecter des villes</h2>
              <p className="text-sm text-gray-500">Professeur : <strong>{professorName}</strong></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Contenu */}
        <div className="p-6 space-y-6">
          {/* Avertissement si aucun segment affecté */}
          {!loadingProfessorSegments && professorSegments.length === 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-orange-900">
                  Aucun segment affecté
                </p>
                <p className="text-sm text-orange-700 mt-1">
                  Vous devez d'abord affecter au moins un segment à ce professeur avant de pouvoir lui affecter des villes.
                </p>
              </div>
            </div>
          )}

          {/* Villes affectées */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">
              Villes affectées ({professorCities.length})
            </h3>
            {loadingProfessorCities ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto"></div>
              </div>
            ) : professorCities.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <p className="text-gray-600 text-sm">Aucune ville affectée pour le moment</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {professorCities.map((city: { id: string; name: string; segment_name: string }) => (
                  <div
                    key={city.id}
                    className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-green-600" />
                      <div>
                        <p className="font-medium text-gray-900">{city.name}</p>
                        <p className="text-xs text-gray-500">
                          {city.id} • {city.segment_name}
                        </p>
                      </div>
                    </div>
                    {canAssignCities && (
                      <button
                        type="button"
                        onClick={() => handleUnassign(city.id, city.name)}
                        className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-lg transition-colors"
                        title="Retirer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Ajouter des villes */}
          <div className="border-t border-gray-200 pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">
                Ajouter des villes ({selectedCityIds.length} sélectionnée{selectedCityIds.length > 1 ? 's' : ''})
              </h3>
              {filteredAvailableCities.length > 0 && canAssignCities && (
                <button
                  type="button"
                  onClick={handleToggleAll}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  {selectedCityIds.length === filteredAvailableCities.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
              )}
            </div>

            {/* Recherche et filtre */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              {/* Recherche */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Rechercher une ville..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Filtre par segment */}
              <select
                value={filterSegmentId}
                onChange={(e) => setFilterSegmentId(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">Tous les segments</option>
                {professorSegments.map((segment: { id: string; name: string; color?: string }) => (
                  <option key={segment.id} value={segment.id}>
                    {segment.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Liste des villes avec cases à cocher */}
            {loadingAllCities ? (
              <div className="text-center py-8 text-gray-500">Chargement...</div>
            ) : filteredAvailableCities.length === 0 ? (
              <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">
                {searchTerm ? 'Aucune ville trouvée pour cette recherche' : 'Aucune ville disponible'}
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg mb-3">
                {filteredAvailableCities.map((city: { id: string; name: string; segment_id: string; segment_name?: string; created_at: string }) => (
                  <label
                    key={city.id}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCityIds.includes(city.id)}
                      onChange={() => handleToggleCity(city.id)}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{city.name}</div>
                      <div className="text-sm text-gray-500">
                        {city.id} • {city.segment_name || 'N/A'}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* Bouton d'affectation */}
            {filteredAvailableCities.length > 0 && canAssignCities && (
              <button
                type="button"
                onClick={handleAssign}
                disabled={selectedCityIds.length === 0 || assignCity.isPending}
                className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" />
                Affecter {selectedCityIds.length > 0 && `(${selectedCityIds.length})`}
              </button>
            )}
          </div>

          {/* Bouton Fermer */}
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
