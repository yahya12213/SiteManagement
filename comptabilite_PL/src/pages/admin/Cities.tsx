import { useState } from 'react';
import { Plus, Search, Edit2, Trash2, MapPin } from 'lucide-react';
import { useCities, useDeleteCity, type City } from '@/hooks/useCities';
import { useSegments, type Segment } from '@/hooks/useSegments';
import { AppLayout } from '@/components/layout/AppLayout';
import CityFormModal from '@/components/admin/CityFormModal';
import { usePermission } from '@/hooks/usePermission';

export default function Cities() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCityId, setSelectedCityId] = useState<string | null>(null);
  const [filterSegment, setFilterSegment] = useState<string>('all');
  const [selectedCityIds, setSelectedCityIds] = useState<string[]>([]);

  const { accounting } = usePermission();
  const { data: cities = [], isLoading } = useCities();
  const { data: segments = [] } = useSegments();
  const deleteCity = useDeleteCity();

  const filteredCities = cities.filter((city: City & { code: string }) => {
    const matchesSearch = city.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      city.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSegment = filterSegment === 'all' || city.segment_id === filterSegment;
    return matchesSearch && matchesSegment;
  });

  const handleEdit = (cityId: string) => {
    setSelectedCityId(cityId);
    setIsFormOpen(true);
  };

  const handleToggleCity = (cityId: string) => {
    setSelectedCityIds(prev =>
      prev.includes(cityId)
        ? prev.filter(id => id !== cityId)
        : [...prev, cityId]
    );
  };

  const handleToggleAll = () => {
    if (selectedCityIds.length === filteredCities.length && filteredCities.length > 0) {
      setSelectedCityIds([]);
    } else {
      setSelectedCityIds(filteredCities.map((c: City & { code: string }) => c.id));
    }
  };

  const handleDelete = async (cityId: string, cityName: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la ville "${cityName}" ?`)) {
      try {
        await deleteCity.mutateAsync(cityId);
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression de la ville');
      }
    }
  };

  const handleBulkDelete = async () => {
    if (selectedCityIds.length === 0) {
      alert('Veuillez sélectionner au moins une ville à supprimer');
      return;
    }

    if (window.confirm(`Êtes-vous sûr de vouloir supprimer ${selectedCityIds.length} ville(s) sélectionnée(s) ?\n\nCette action est irréversible.`)) {
      try {
        for (const cityId of selectedCityIds) {
          await deleteCity.mutateAsync(cityId);
        }
        setSelectedCityIds([]);
      } catch (error) {
        console.error('Erreur lors de la suppression en masse:', error);
        alert('Erreur lors de la suppression des villes');
      }
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setSelectedCityId(null);
  };

  return (
    <AppLayout title="Gestion des Villes" subtitle="Gérer les villes et leur affectation">
      <div className="space-y-6">
        {/* Barre d'actions */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            {/* Recherche */}
            <div className="relative flex-1 md:w-80">
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
              value={filterSegment}
              onChange={(e) => setFilterSegment(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="all">Tous les segments</option>
              {segments.map((segment: Segment) => (
                <option key={segment.id} value={segment.id}>
                  {segment.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            {/* Bouton Supprimer en masse */}
            {accounting.canBulkDeleteCity && selectedCityIds.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-4 sm:px-6 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-sm sm:text-base">Supprimer ({selectedCityIds.length})</span>
              </button>
            )}

            {/* Bouton Ajouter */}
            {accounting.canCreateCity && (
              <button
                onClick={() => setIsFormOpen(true)}
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-4 sm:px-6 py-2 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="text-sm sm:text-base">Nouvelle Ville</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Liste des villes */}
      {isLoading ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Chargement...</p>
        </div>
      ) : filteredCities.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-8 text-center">
          <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">
            {searchTerm || filterSegment !== 'all'
              ? 'Aucune ville trouvée'
              : 'Aucune ville enregistrée'}
          </p>
          <p className="text-gray-400 mt-2">
            {searchTerm || filterSegment !== 'all'
              ? 'Essayez de modifier vos critères de recherche'
              : 'Commencez par créer une nouvelle ville'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedCityIds.length === filteredCities.length && filteredCities.length > 0}
                      onChange={handleToggleAll}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Code
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nom de la ville
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Segment
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date de création
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredCities.map((city: City & { code: string }) => (
                  <tr key={city.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedCityIds.includes(city.id)}
                        onChange={() => handleToggleCity(city.id)}
                        className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-gray-900">{city.code}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 text-green-600 mr-2" />
                        <span className="text-sm font-medium text-gray-900">{city.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {city.segment_name || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(city.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {accounting.canUpdateCity && (
                          <button
                            onClick={() => handleEdit(city.id)}
                            className="text-blue-600 hover:text-blue-900 p-2 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Modifier"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {accounting.canDeleteCity && (
                          <button
                            onClick={() => handleDelete(city.id, city.name)}
                            className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-lg transition-colors"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Résumé */}
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Affichage de {filteredCities.length} ville(s)
              {filterSegment !== 'all' && ' filtrée(s)'}
            </p>
          </div>
        </div>
      )}

      {/* Modal de formulaire */}
      {isFormOpen && (
        <CityFormModal
          cityId={selectedCityId}
          onClose={handleCloseForm}
        />
      )}
      </div>
    </AppLayout>
  );
}
