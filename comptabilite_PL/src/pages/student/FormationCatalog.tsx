import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import {
  BookOpen,
  Clock,
  Award,
  Search,
  Filter,
  TrendingUp,
  PlayCircle,
  CheckCircle,
} from 'lucide-react';
import { usePublicFormations } from '@/hooks/useStudent';
import { formatPrice } from '@/lib/utils/formatPrice';
import type { Formation, FormationLevel } from '@/types/cours';

const FormationCatalog: React.FC = () => {
  const navigate = useNavigate();
  const { data: response, isLoading } = usePublicFormations();
  const allFormations = response?.data?.results || [];

  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<FormationLevel | 'all'>('all');

  // Filter only published formations
  const publishedFormations = allFormations.filter((f: Formation) => f.status === 'published');

  // Apply search and filters
  const filteredFormations = useMemo(() => {
    return publishedFormations.filter((formation: Formation) => {
      const matchesSearch =
        formation.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        formation.description?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesLevel = levelFilter === 'all' || formation.level === levelFilter;

      return matchesSearch && matchesLevel;
    });
  }, [publishedFormations, searchTerm, levelFilter]);

  const getLevelBadge = (level?: FormationLevel) => {
    const badges = {
      debutant: { bg: 'bg-green-100', text: 'text-green-700', label: 'Débutant' },
      intermediaire: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Intermédiaire' },
      avance: { bg: 'bg-red-100', text: 'text-red-700', label: 'Avancé' },
    };
    const badge = level ? badges[level] : { bg: 'bg-gray-100', text: 'text-gray-700', label: 'N/A' };
    return (
      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  const getLevelIcon = (level?: FormationLevel) => {
    if (level === 'debutant') return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (level === 'intermediaire') return <TrendingUp className="h-4 w-4 text-yellow-600" />;
    if (level === 'avance') return <Award className="h-4 w-4 text-red-600" />;
    return <BookOpen className="h-4 w-4 text-gray-400" />;
  };

  return (
    <AppLayout
      title="Catalogue de formations"
      subtitle="Explorez nos formations disponibles"
    >
      <div className="space-y-6">
        {/* Stats Banner */}
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">
                {publishedFormations.length} formations disponibles
              </h2>
              <p className="text-blue-100">
                Développez vos compétences avec nos formations en ligne
              </p>
            </div>
            <BookOpen className="h-16 w-16 text-blue-200 opacity-50" />
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Search className="h-4 w-4 inline mr-2" />
                Rechercher
              </label>
              <input
                type="text"
                value={searchTerm}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                placeholder="Titre ou description..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Level Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Filter className="h-4 w-4 inline mr-2" />
                Niveau
              </label>
              <select
                value={levelFilter}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLevelFilter(e.target.value as FormationLevel | 'all')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Tous les niveaux</option>
                <option value="debutant">Débutant</option>
                <option value="intermediaire">Intermédiaire</option>
                <option value="avance">Avancé</option>
              </select>
            </div>
          </div>

          {/* Active Filters Display */}
          {(searchTerm || levelFilter !== 'all') && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-gray-600">Filtres actifs:</span>
              {searchTerm && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                  Recherche: "{searchTerm}"
                </span>
              )}
              {levelFilter !== 'all' && (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                  Niveau: {
                    levelFilter === 'debutant' ? 'Débutant' :
                      levelFilter === 'intermediaire' ? 'Intermédiaire' :
                        levelFilter === 'avance' ? 'Avancé' : ''
                  }
                </span>
              )}
              <button
                onClick={() => {
                  setSearchTerm('');
                  setLevelFilter('all');
                }}
                className="text-xs text-red-600 hover:text-red-700"
              >
                Effacer les filtres
              </button>
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600">
            {filteredFormations.length} formation(s) trouvée(s)
          </p>
        </div>

        {/* Formations Grid */}
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredFormations.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
            <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Aucune formation trouvée
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm || levelFilter !== 'all'
                ? 'Essayez de modifier vos critères de recherche'
                : 'Aucune formation publiée pour le moment'}
            </p>
            {(searchTerm || levelFilter !== 'all') && (
              <Button
                onClick={() => {
                  setSearchTerm('');
                  setLevelFilter('all');
                }}
                variant="outline"
              >
                Effacer les filtres
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredFormations.map((formation) => (
              <div
                key={formation.id}
                className="bg-white rounded-lg shadow-sm border hover:shadow-lg transition-all duration-200 overflow-hidden group"
              >
                {/* Thumbnail */}
                <div className="h-48 bg-gradient-to-br from-blue-500 to-purple-600 relative overflow-hidden">
                  {formation.thumbnail_url ? (
                    <img
                      src={formation.thumbnail_url}
                      alt={formation.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <BookOpen className="h-16 w-16 text-white opacity-50" />
                    </div>
                  )}
                  <div className="absolute top-3 right-3">
                    {getLevelBadge(formation.level)}
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {formation.title}
                  </h3>

                  {formation.description && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-3">
                      {formation.description}
                    </p>
                  )}

                  {/* Meta Information */}
                  <div className="space-y-2 mb-4">
                    {formation.duration_hours && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="h-4 w-4 text-gray-400" />
                        <span>{formation.duration_hours}h de contenu</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      {getLevelIcon(formation.level)}
                      <span>Niveau {formation.level || 'N/A'}</span>
                    </div>

                    {formation.module_count !== undefined && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <PlayCircle className="h-4 w-4 text-gray-400" />
                        <span>{formation.module_count} module(s)</span>
                      </div>
                    )}

                    {formation.passing_score_percentage !== undefined && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <CheckCircle className="h-4 w-4 text-gray-400" />
                        <span>Score de réussite: {formation.passing_score_percentage}%</span>
                      </div>
                    )}
                  </div>

                  {/* Price */}
                  {formation.price !== undefined && formation.price !== null && Number(formation.price) > 0 && (
                    <div className="mb-4 pb-4 border-b">
                      <p className="text-2xl font-bold text-blue-600">
                        {formatPrice(formation.price)}
                      </p>
                    </div>
                  )}

                  {/* Action Button */}
                  <Button
                    onClick={() => navigate(`/student/formations/${formation.id}`)}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Voir la formation
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default FormationCatalog;
