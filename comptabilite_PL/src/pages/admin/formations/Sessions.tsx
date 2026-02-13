import React, { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Calendar, Plus, Edit2, Trash2, Users, AlertCircle } from 'lucide-react';
import { useSessionsFormation, useDeleteSession } from '@/hooks/useSessionsFormation';
import { SessionFormModal } from '@/components/admin/formations/SessionFormModal';
import type { SessionFormation } from '@/types/sessions';
import { usePermission } from '@/hooks/usePermission';

const Sessions: React.FC = () => {
  const { training } = usePermission();
  const { data: sessions, isLoading, error } = useSessionsFormation();
  const deleteSession = useDeleteSession();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [sessionToEdit, setSessionToEdit] = useState<SessionFormation | null>(null);

  // Calculate stats from sessions data
  const stats = sessions ? {
    sessions: {
      total: sessions.length,
      planned: sessions.filter(s => s.statut === 'planifiee').length,
      active: sessions.filter(s => s.statut === 'en_cours').length,
      completed: sessions.filter(s => s.statut === 'terminee').length,
    },
    // Étudiants dans sessions non annulées uniquement
    total_students_enrolled: sessions
      .filter(s => s.statut !== 'annulee')
      .reduce((sum, s) => sum + (s.nombre_etudiants || 0), 0),
  } : null;

  const handleDelete = async (session: SessionFormation) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la session "${session.titre}" ?`)) {
      try {
        await deleteSession.mutateAsync(session.id);
      } catch (error) {
        console.error('Error deleting session:', error);
        alert('Erreur lors de la suppression de la session');
      }
    }
  };

  const getStatusColor = (status: string) => {
    const colors = {
      planifiee: 'bg-blue-100 text-blue-700',
      en_cours: 'bg-green-100 text-green-700',
      terminee: 'bg-gray-100 text-gray-700',
      annulee: 'bg-red-100 text-red-700',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      planifiee: 'Planifiée',
      en_cours: 'Active',
      terminee: 'Terminée',
      annulee: 'Annulée',
    };
    return labels[status as keyof typeof labels] || status;
  };

  return (
    <AppLayout title="Sessions de Formation" subtitle="Gérer les sessions et les inscriptions">
      <div className="space-y-6">
        {/* Stats rapides */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Sessions</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.sessions.total}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Planifiées</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.sessions.planned}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Actives</p>
                  <p className="text-2xl font-bold text-green-600">{stats.sessions.active}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Terminées</p>
                  <p className="text-2xl font-bold text-gray-600">{stats.sessions.completed}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Users className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Étudiants Inscrits</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.total_students_enrolled}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Header with create button */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Liste des sessions</h2>
            <p className="text-sm text-gray-600 mt-1">Gérez les sessions de formation et les inscriptions</p>
          </div>
          {training.canCreateSession && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Nouvelle session
            </Button>
          )}
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800">Erreur de chargement</p>
              <p className="text-sm text-red-700 mt-1">{error.message}</p>
            </div>
          </div>
        )}

        {/* Sessions table */}
        {sessions && sessions.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Session
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Formation
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Segment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ville
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dates
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Inscrits
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sessions.map((session) => (
                    <tr key={session.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{session.titre}</p>
                          {session.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{session.description}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {session.corps_formation_name ? (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              {session.corps_formation_name}
                            </span>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400">Aucun corps de formation</p>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm text-gray-900">{session.segment_name || '-'}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <p className="text-sm text-gray-900">{session.ville_name || '-'}</p>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          <p className="text-gray-900">
                            {session.date_debut && new Date(session.date_debut).toLocaleDateString('fr-FR')}
                          </p>
                          <p className="text-gray-500">
                            {session.date_fin && new Date(session.date_fin).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-900">
                            {session.nombre_etudiants || 0}
                            {session.nombre_places && ` / ${session.nombre_places}`}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(session.statut)}`}>
                          {getStatusLabel(session.statut)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          {training.canUpdateSession && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSessionToEdit(session)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                          {training.canDeleteSession && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(session)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty state */}
        {sessions && sessions.length === 0 && !isLoading && (
          <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
            <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune session</h3>
            <p className="text-sm text-gray-500 mb-6">
              Commencez par créer votre première session de formation
            </p>
            <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Créer une session
            </Button>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <SessionFormModal
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {sessionToEdit && (
        <SessionFormModal
          session={sessionToEdit}
          onClose={() => setSessionToEdit(null)}
        />
      )}
    </AppLayout>
  );
};

export default Sessions;
