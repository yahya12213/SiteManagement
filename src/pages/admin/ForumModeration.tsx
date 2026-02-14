import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Pin,
  Lock,
  Trash2,
  Eye,
  Search,
  TrendingUp,
  Users,
  Activity,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useForumStats } from '@/hooks/useForums';
import { useFormations } from '@/hooks/useCours';
import { Button } from '@/components/ui/button';
import type { Formation } from '@/types/cours';

export const ForumModeration: React.FC = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFormation, setSelectedFormation] = useState<string>('');

  const { data: statsData } = useForumStats();
  const { data: formationsData } = useFormations();

  const stats = statsData?.stats;
  const formations = formationsData || [];

  const filteredFormations = selectedFormation
    ? formations.filter((f: Formation) => f.id === selectedFormation)
    : formations;

  return (
    <AppLayout
      title="Modération des Forums"
      subtitle="Gérez les discussions et modérez le contenu des forums"
    >
      <div className="space-y-6">
        {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <MessageSquare className="h-8 w-8 opacity-80" />
          </div>
          <div className="text-3xl font-bold">
            {stats?.total_threads || 0}
          </div>
          <div className="text-blue-100 text-sm">Total discussions</div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <Activity className="h-8 w-8 opacity-80" />
          </div>
          <div className="text-3xl font-bold">{stats?.total_posts || 0}</div>
          <div className="text-green-100 text-sm">Total réponses</div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="h-8 w-8 opacity-80" />
          </div>
          <div className="text-3xl font-bold">
            {stats?.total_reactions || 0}
          </div>
          <div className="text-purple-100 text-sm">Total réactions</div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-lg p-5 text-white">
          <div className="flex items-center justify-between mb-2">
            <Users className="h-8 w-8 opacity-80" />
          </div>
          <div className="text-3xl font-bold">
            {stats?.active_posters || 0}
          </div>
          <div className="text-amber-100 text-sm">Participants actifs</div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher une discussion..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={selectedFormation}
            onChange={(e) => setSelectedFormation(e.target.value)}
            className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Toutes les formations</option>
            {formations.map((formation: Formation) => (
              <option key={formation.id} value={formation.id}>
                {formation.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Formations List with Forum Access */}
      <div className="space-y-4">
        {filteredFormations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <MessageSquare className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Aucune formation trouvée
            </h3>
            <p className="text-gray-600">
              Créez des formations pour activer les forums
            </p>
          </div>
        ) : (
          filteredFormations.map((formation: Formation) => (
            <div
              key={formation.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {formation.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {formation.description}
                  </p>

                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="h-4 w-4" />
                      Forum actif
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {(formation as any).enrolled_count || 0} étudiants
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => navigate(`/student/forums/${formation.id}`)}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 text-white"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Voir le forum
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Moderation Actions Info */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 mb-2">
          Actions de modération disponibles
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-blue-800">
          <div className="flex items-start gap-2">
            <Pin className="h-4 w-4 mt-0.5 text-yellow-600" />
            <span>
              <strong>Épingler:</strong> Mettre en avant les discussions
              importantes
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Lock className="h-4 w-4 mt-0.5 text-gray-600" />
            <span>
              <strong>Verrouiller:</strong> Empêcher de nouvelles réponses
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Trash2 className="h-4 w-4 mt-0.5 text-red-600" />
            <span>
              <strong>Supprimer:</strong> Retirer du contenu inapproprié
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Eye className="h-4 w-4 mt-0.5 text-blue-600" />
            <span>
              <strong>Surveiller:</strong> Suivre l'activité des discussions
            </span>
          </div>
        </div>
        <p className="mt-3 text-sm text-blue-700">
          💡 Accédez à un forum spécifique pour utiliser ces actions de
          modération.
        </p>
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="mt-6 bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-lg p-5">
          <h3 className="font-semibold text-gray-900 mb-3">
            Statistiques générales
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Créateurs de discussions:</span>
              <span className="ml-2 font-semibold text-gray-900">
                {stats.active_thread_creators}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Participants actifs:</span>
              <span className="ml-2 font-semibold text-gray-900">
                {stats.active_posters}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Taux d'engagement:</span>
              <span className="ml-2 font-semibold text-gray-900">
                {stats.total_threads > 0
                  ? ((stats.total_posts / stats.total_threads) * 100).toFixed(1)
                  : 0}
                % réponses/thread
              </span>
            </div>
          </div>
        </div>
      )}
      </div>
    </AppLayout>
  );
};
