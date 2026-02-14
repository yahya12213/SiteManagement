import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useSessionsFormation, useDeleteSession } from '@/hooks/useSessionsFormation';
import { SessionFormModal } from '@/components/admin/formations/SessionFormModal';
import { apiClient } from '@/lib/api/client';
import {
  Calendar,
  MapPin,
  Users,
  Plus,
  Eye,
  Edit2,
  Trash2,
  BookOpen,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';

interface Segment {
  id: string;
  name: string;
  color: string;
}

interface City {
  id: string;
  name: string;
  segment_id: string;
}

export const SessionsFormation: React.FC = () => {
  const navigate = useNavigate();

  // Permissions
  const { training } = usePermission();
  const canCreateSession = training.canCreateSession;
  const canUpdateSession = training.canUpdateSession;
  const canDeleteSession = training.canDeleteSession;

  // Filter states
  const [filters, setFilters] = useState({
    segment_id: '',
    ville_id: '',
    annee: '',
  });

  // Data for filter dropdowns
  const [segments, setSegments] = useState<Segment[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);

  // Fetch sessions with filters
  const { data: sessions, isLoading, error } = useSessionsFormation(filters.segment_id || filters.ville_id || filters.annee ? filters : undefined);
  const deleteSession = useDeleteSession();

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [editingSession, setEditingSession] = useState<any>(null);

  // Load segments
  useEffect(() => {
    const fetchSegments = async () => {
      try {
        const data = await apiClient.get<Segment[]>('/segments');
        setSegments(data);
      } catch (error) {
        console.error('Error fetching segments:', error);
      }
    };
    fetchSegments();
  }, []);

  // Load cities when segment changes
  useEffect(() => {
    const fetchCities = async () => {
      try {
        if (filters.segment_id) {
          const data = await apiClient.get<City[]>(`/cities?segment_id=${filters.segment_id}`);
          setCities(data);
        } else {
          const data = await apiClient.get<City[]>('/cities');
          setCities(data);
        }
      } catch (error) {
        console.error('Error fetching cities:', error);
      }
    };
    fetchCities();
  }, [filters.segment_id]);

  // Generate available years from sessions
  useEffect(() => {
    if (sessions && sessions.length > 0) {
      const years = new Set<string>();
      sessions.forEach(session => {
        if (session.date_debut) {
          const year = new Date(session.date_debut).getFullYear().toString();
          years.add(year);
        }
      });
      setAvailableYears(Array.from(years).sort((a, b) => parseInt(b) - parseInt(a)));
    }
  }, [sessions]);

  const handleDelete = async (id: string) => {
    try {
      await deleteSession.mutateAsync(id);
      setDeleteConfirm(null);
    } catch (error: any) {
      alert('Erreur: ' + (error.message || 'Impossible de supprimer cette session'));
    }
  };

  const resetFilters = () => {
    setFilters({ segment_id: '', ville_id: '', annee: '' });
  };

  if (isLoading) {
    return (
      <AppLayout title="Sessions de Formation" subtitle="Gérez les sessions de formation (classes)">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Chargement des sessions...</div>
        </div>
      </AppLayout>
    );
  }

  if (error) {
    return (
      <AppLayout title="Sessions de Formation" subtitle="Gérez les sessions de formation (classes)">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="h-5 w-5" />
            <span>Erreur lors du chargement des sessions</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Sessions de Formation" subtitle="Gérez les sessions de formation (classes)">
      <div className="space-y-6">
        {/* Header Actions */}
        {canCreateSession && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setEditingSession(null);
                setShowSessionModal(true);
              }}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg flex items-center gap-2 font-medium"
            >
              <Plus className="h-5 w-5" />
              Nouvelle Session
            </button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
            <div className="text-sm text-blue-600 font-medium">Total Sessions</div>
            <div className="text-3xl font-bold text-blue-900 mt-1">{sessions?.length || 0}</div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
            <div className="text-sm text-green-600 font-medium">En Cours</div>
            <div className="text-3xl font-bold text-green-900 mt-1">
              {sessions?.filter((s) => s.statut === 'en_cours').length || 0}
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
            <div className="text-sm text-purple-600 font-medium">Planifiées</div>
            <div className="text-3xl font-bold text-purple-900 mt-1">
              {sessions?.filter((s) => s.statut === 'planifiee').length || 0}
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg p-4 border border-gray-200">
            <div className="text-sm text-gray-600 font-medium">Terminées</div>
            <div className="text-3xl font-bold text-gray-900 mt-1">
              {sessions?.filter((s) => s.statut === 'terminee').length || 0}
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-5 w-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Filtres</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Segment
              </label>
              <select
                value={filters.segment_id}
                onChange={(e) => setFilters({ ...filters, segment_id: e.target.value, ville_id: '' })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Tous les segments</option>
                {segments.map((segment) => (
                  <option key={segment.id} value={segment.id}>
                    {segment.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ville
              </label>
              <select
                value={filters.ville_id}
                onChange={(e) => setFilters({ ...filters, ville_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={!filters.segment_id && cities.length === 0}
              >
                <option value="">Toutes les villes</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Année
              </label>
              <select
                value={filters.annee}
                onChange={(e) => setFilters({ ...filters, annee: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Toutes les années</option>
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={resetFilters}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                Réinitialiser
              </button>
            </div>
          </div>
        </div>

        {/* Sessions Table */}
        {sessions && sessions.length > 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Titre
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Segment
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ville
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type de session
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date Début
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Étudiants
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
                    <tr key={session.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {session.titre}
                            </div>
                            {session.corps_formation_name && (
                              <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                <BookOpen className="h-3 w-3" />
                                {session.corps_formation_name}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {session.segment_name && (
                          <span
                            className="inline-flex px-2 py-1 text-xs font-medium rounded-full"
                            style={{
                              backgroundColor: session.segment_color ? session.segment_color + '20' : '#e5e7eb',
                              color: session.segment_color || '#6b7280',
                            }}
                          >
                            {session.segment_name}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-sm text-gray-900">
                          <MapPin className="h-4 w-4 text-gray-400" />
                          {session.ville_name || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full ${
                            session.session_type === 'en_ligne'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-green-100 text-green-800'
                          }`}
                        >
                          {session.session_type === 'en_ligne' ? 'En ligne' : 'Présentielle'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-sm text-gray-900">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          {session.date_debut ? new Date(session.date_debut).toLocaleDateString('fr-FR') : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-sm text-gray-900">
                          <Users className="h-4 w-4 text-gray-400" />
                          {session.nombre_etudiants || 0}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            session.statut === 'en_cours'
                              ? 'bg-blue-100 text-blue-800'
                              : session.statut === 'terminee'
                              ? 'bg-green-100 text-green-800'
                              : session.statut === 'annulee'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {session.statut === 'planifiee' && 'Planifiée'}
                          {session.statut === 'en_cours' && 'En cours'}
                          {session.statut === 'terminee' && 'Terminée'}
                          {session.statut === 'annulee' && 'Annulée'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/sessions-formation/${session.id}`)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Voir"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {canUpdateSession && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSession(session);
                                setShowSessionModal(true);
                              }}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Modifier"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                          )}
                          {canDeleteSession && (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirm(session.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-600 text-lg mb-2">Aucune session trouvée</p>
            <p className="text-gray-500 text-sm mb-4">
              {filters.segment_id || filters.ville_id || filters.annee
                ? 'Aucune session ne correspond aux filtres sélectionnés'
                : 'Commencez par créer votre première session de formation'}
            </p>
            {!filters.segment_id && !filters.ville_id && !filters.annee && canCreateSession && (
              <button
                type="button"
                onClick={() => {
                  setEditingSession(null);
                  setShowSessionModal(true);
                }}
                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center gap-2"
              >
                <Plus className="h-5 w-5" />
                Créer une session
              </button>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md mx-4">
            <h4 className="font-bold text-gray-900 text-lg mb-2">Confirmer la suppression</h4>
            <p className="text-sm text-gray-600 mb-4">
              Êtes-vous sûr de vouloir supprimer cette session ?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm font-medium"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleteSession.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors text-sm font-medium disabled:opacity-50"
              >
                {deleteSession.isPending ? 'Suppression...' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Modal */}
      {showSessionModal && (
        <SessionFormModal
          session={editingSession}
          onClose={() => {
            setShowSessionModal(false);
            setEditingSession(null);
          }}
        />
      )}
    </AppLayout>
  );
};
