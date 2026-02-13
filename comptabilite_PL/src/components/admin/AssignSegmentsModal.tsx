import { useState } from 'react';
import { X, Layers, Plus, Trash2 } from 'lucide-react';
import { useProfessorSegments, useAssignSegmentToProfessor, useUnassignSegmentFromProfessor } from '@/hooks/useProfessors';
import { useSegments } from '@/hooks/useSegments';
import { usePermission } from '@/hooks/usePermission';

interface AssignSegmentsModalProps {
  professorId: string;
  professorName: string;
  onClose: () => void;
}

export default function AssignSegmentsModal({ professorId, professorName, onClose }: AssignSegmentsModalProps) {
  const [selectedSegmentId, setSelectedSegmentId] = useState('');

  // Permissions
  const { accounting } = usePermission();
  const canAssignCities = accounting.canAssignProfessorCities;

  const { data: professorSegments = [], isLoading: loadingProfessorSegments } = useProfessorSegments(professorId);
  const { data: allSegments = [], isLoading: loadingAllSegments } = useSegments();
  const assignSegment = useAssignSegmentToProfessor();
  const unassignSegment = useUnassignSegmentFromProfessor();

  // Filtrer les segments disponibles (non affectés au professeur)
  const availableSegments = allSegments.filter(
    (segment: { id: string; name: string; color?: string; created_at: string }) => !professorSegments.some((ps: { id: string; name: string; color?: string }) => ps.id === segment.id)
  );

  const handleAssign = async () => {
    if (!selectedSegmentId) {
      alert('Veuillez sélectionner un segment');
      return;
    }

    try {
      await assignSegment.mutateAsync({ professorId, segmentId: selectedSegmentId });
      setSelectedSegmentId('');
    } catch (error: any) {
      console.error('Erreur lors de l\'affectation:', error);
      alert(error.message || 'Erreur lors de l\'affectation du segment');
    }
  };

  const handleUnassign = async (segmentId: string, segmentName: string) => {
    if (window.confirm(`Voulez-vous retirer le segment "${segmentName}" de ce professeur ?\n\nToutes les villes de ce segment seront également retirées.`)) {
      try {
        await unassignSegment.mutateAsync({ professorId, segmentId });
      } catch (error) {
        console.error('Erreur lors du retrait:', error);
        alert('Erreur lors du retrait du segment');
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[650px] md:w-[750px] lg:w-[850px] max-w-[95vw] max-h-[90vh] overflow-y-auto">
        {/* En-tête */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Layers className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Affecter des segments</h2>
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
          {/* Segments affectés */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">
              Segments affectés ({professorSegments.length})
            </h3>
            {loadingProfessorSegments ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : professorSegments.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <p className="text-gray-600 text-sm">Aucun segment affecté pour le moment</p>
                <p className="text-gray-500 text-xs mt-1">Affectez au moins un segment avant de pouvoir affecter des villes</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {professorSegments.map((segment: { id: string; name: string; color?: string }) => (
                  <div
                    key={segment.id}
                    className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: segment.color || '#3B82F6' }}
                      />
                      <span className="font-medium text-gray-900">{segment.name}</span>
                    </div>
                    {canAssignCities && (
                      <button
                        type="button"
                        onClick={() => handleUnassign(segment.id, segment.name)}
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

          {/* Ajouter un segment */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="font-semibold text-gray-900 mb-3">Ajouter un segment</h3>

            <div className="flex gap-2">
              <select
                value={selectedSegmentId}
                onChange={(e) => setSelectedSegmentId(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Sélectionnez un segment</option>
                {loadingAllSegments ? (
                  <option disabled>Chargement...</option>
                ) : availableSegments.length === 0 ? (
                  <option disabled>
                    {allSegments.length === 0
                      ? 'Aucun segment disponible'
                      : 'Tous les segments sont déjà affectés'}
                  </option>
                ) : (
                  availableSegments.map((segment: { id: string; name: string; color?: string; created_at: string }) => (
                    <option key={segment.id} value={segment.id}>
                      {segment.name}
                    </option>
                  ))
                )}
              </select>
              {canAssignCities && (
                <button
                  type="button"
                  onClick={handleAssign}
                  disabled={!selectedSegmentId || assignSegment.isPending}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Affecter
                </button>
              )}
            </div>

            {availableSegments.length === 0 && allSegments.length > 0 && (
              <p className="mt-2 text-sm text-gray-500">
                Tous les segments disponibles sont déjà affectés à ce professeur.
              </p>
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
