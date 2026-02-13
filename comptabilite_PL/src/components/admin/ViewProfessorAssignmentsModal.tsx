import { X, Layers, MapPin } from 'lucide-react';
import { useProfessorSegments, useProfessorCities } from '@/hooks/useProfessors';

interface ViewProfessorAssignmentsModalProps {
  professorId: string;
  professorName: string;
  onClose: () => void;
}

export default function ViewProfessorAssignmentsModal({
  professorId,
  professorName,
  onClose
}: ViewProfessorAssignmentsModalProps) {
  const { data: professorSegments = [], isLoading: loadingSegments } = useProfessorSegments(professorId);
  const { data: professorCities = [], isLoading: loadingCities } = useProfessorCities(professorId);

  // Grouper les villes par segment
  type ProfessorCity = { id: string; name: string; segment_name: string; code?: string };
  const citiesBySegment = professorCities.reduce((acc: Record<string, ProfessorCity[]>, city: ProfessorCity) => {
    const segmentName = city.segment_name || 'N/A';
    if (!acc[segmentName]) {
      acc[segmentName] = [];
    }
    acc[segmentName].push(city);
    return acc;
  }, {} as Record<string, ProfessorCity[]>);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* En-tête */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Affectations du professeur</h2>
              <p className="text-blue-100 text-sm">{professorName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:bg-white/10 p-2 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Contenu */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Segments affectés */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                Segments affectés ({professorSegments.length})
              </h3>

              {loadingSegments ? (
                <div className="text-center py-8 text-gray-500">Chargement...</div>
              ) : professorSegments.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                  <Layers className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p>Aucun segment affecté</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {professorSegments.map((segment: { id: string; name: string; color?: string }) => (
                    <div
                      key={segment.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: segment.color || '#3B82F6' }}
                      />
                      <span className="font-medium text-gray-900">{segment.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Villes affectées */}
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-green-600" />
                Villes affectées ({professorCities.length})
              </h3>

              {loadingCities ? (
                <div className="text-center py-8 text-gray-500">Chargement...</div>
              ) : professorCities.length === 0 ? (
                <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                  <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                  <p>Aucune ville affectée</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {professorCities.map((city: ProfessorCity) => (
                    <div
                      key={city.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{city.name}</div>
                        <div className="text-sm text-gray-500">
                          {city.code || city.id} • {city.segment_name}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Villes groupées par segment */}
          {professorCities.length > 0 && (
            <div className="mt-6 bg-white border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-600" />
                Villes par segment
              </h3>

              <div className="space-y-4">
                {Object.entries(citiesBySegment).map(([segmentName, cities]: [string, ProfessorCity[]]) => (
                  <div key={segmentName} className="border border-gray-200 rounded-lg p-4">
                    <div className="font-medium text-gray-900 mb-3 flex items-center gap-2">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {segmentName}
                      </span>
                      <span className="text-sm text-gray-500">({cities.length} ville{cities.length > 1 ? 's' : ''})</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {cities.map((city: ProfessorCity) => (
                        <div
                          key={city.id}
                          className="flex items-center gap-2 p-2 bg-gray-50 rounded text-sm"
                        >
                          <MapPin className="w-3 h-3 text-green-600 flex-shrink-0" />
                          <span className="truncate">{city.name}</span>
                          <span className="text-gray-500 text-xs">({city.code || city.id})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Résumé */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-3xl font-bold text-blue-600">{professorSegments.length}</div>
                <div className="text-sm text-blue-700 mt-1">Segment{professorSegments.length > 1 ? 's' : ''}</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-600">{professorCities.length}</div>
                <div className="text-sm text-green-700 mt-1">Ville{professorCities.length > 1 ? 's' : ''}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Pied de page */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
