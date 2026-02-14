import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { BookOpen, Plus, Edit2, Trash2, AlertCircle, Video, FileQuestion, DollarSign, Settings, Award, Package } from 'lucide-react';
import { useFormations, useDeleteFormation, useCoursStats } from '@/hooks/useCours';
import { useCorpsFormation } from '@/hooks/useCorpsFormation';
import { packsApi } from '@/lib/api/packs';
import { FormationFormModal } from '@/components/admin/formations/FormationFormModal';
import PackFormModal from '@/components/admin/formations/PackFormModal';
import { formatPrice } from '@/lib/utils/formatPrice';
import type { Formation } from '@/types/cours';
import type { CreatePackInput } from '@/types/cours';

const Cours: React.FC = () => {
  const navigate = useNavigate();
  const { data: formations, isLoading, error, refetch } = useFormations();
  const { data: corpsList = [] } = useCorpsFormation();
  const { data: stats } = useCoursStats();
  const deleteFormation = useDeleteFormation();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formationToEdit, setFormationToEdit] = useState<Formation | null>(null);
  const [selectedCorpsId, setSelectedCorpsId] = useState<string>('');
  const [showPackModal, setShowPackModal] = useState(false);
  const [packCorps, setPackCorps] = useState<{ id: string; name: string } | null>(null);

  // Filtrer les formations par corps si un corps est sélectionné
  const filteredFormations = useMemo(() => {
    if (!formations) return [];
    if (!selectedCorpsId) return formations;
    return formations.filter((f) => f.corps_formation_id === selectedCorpsId);
  }, [formations, selectedCorpsId]);

  const handleDelete = async (formation: Formation) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer la formation "${formation.title}" ? Tous les modules, vidéos et tests associés seront également supprimés.`)) {
      try {
        await deleteFormation.mutateAsync(formation.id);
      } catch (error) {
        console.error('Error deleting formation:', error);
        alert('Erreur lors de la suppression de la formation');
      }
    }
  };

  const handleCreatePack = async (data: CreatePackInput) => {
    try {
      await packsApi.create(data);
      refetch(); // Recharger les formations
      setShowPackModal(false);
      setPackCorps(null);
    } catch (error: any) {
      console.error('Error creating pack:', error);
      throw error;
    }
  };

  const handleOpenPackModal = (corpsId: string, corpsName: string) => {
    setPackCorps({ id: corpsId, name: corpsName });
    setShowPackModal(true);
  };

  const getStatusColor = (status: string) => {
    const colors = {
      draft: 'bg-gray-100 text-gray-700',
      published: 'bg-green-100 text-green-700',
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700';
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      draft: 'Brouillon',
      published: 'Publiée',
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getLevelLabel = (level?: string) => {
    const labels = {
      debutant: 'Débutant',
      intermediaire: 'Intermédiaire',
      avance: 'Avancé',
    };
    return level ? labels[level as keyof typeof labels] || level : '-';
  };

  const getLevelColor = (level?: string) => {
    const colors = {
      debutant: 'bg-blue-50 text-blue-700',
      intermediaire: 'bg-yellow-50 text-yellow-700',
      avance: 'bg-purple-50 text-purple-700',
    };
    return level ? colors[level as keyof typeof colors] || 'bg-gray-50 text-gray-700' : 'bg-gray-50 text-gray-700';
  };

  return (
    <AppLayout title="Formations en Ligne" subtitle="Gérer les formations, modules, vidéos et tests">
      <div className="space-y-6">
        {/* Stats rapides */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <BookOpen className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Formations</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.formations.total}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <BookOpen className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Publiées</p>
                  <p className="text-2xl font-bold text-green-600">{stats.formations.published}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Video className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Vidéos</p>
                  <p className="text-2xl font-bold text-purple-600">{stats.total_videos}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <FileQuestion className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Tests</p>
                  <p className="text-2xl font-bold text-orange-600">{stats.total_tests}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filtres */}
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Filtrer par corps de formation
              </label>
              <select
                value={selectedCorpsId}
                onChange={(e) => setSelectedCorpsId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tous les corps</option>
                {corpsList.map((corps) => (
                  <option key={corps.id} value={corps.id}>
                    {corps.name} ({corps.formations_count || 0})
                  </option>
                ))}
              </select>
            </div>
            {selectedCorpsId && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    const corps = corpsList.find((c) => c.id === selectedCorpsId);
                    if (corps) handleOpenPackModal(corps.id, corps.name);
                  }}
                  className="flex-1"
                >
                  <Package className="h-4 w-4 mr-2" />
                  Créer un pack
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Header with create button */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Liste des formations</h2>
            <p className="text-sm text-gray-600 mt-1">
              {selectedCorpsId
                ? `Formations du corps "${corpsList.find((c) => c.id === selectedCorpsId)?.name}"`
                : 'Créez et gérez vos formations en ligne'}
            </p>
          </div>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Nouvelle formation
          </Button>
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

        {/* Formations table */}
        {filteredFormations && filteredFormations.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Formation
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Corps
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Niveau
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Modules
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Prix
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Template Certificat
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
                  {filteredFormations.map((formation) => (
                    <tr key={formation.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">{formation.title}</p>
                            {formation.is_pack && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                                <Package className="h-3 w-3 mr-1" />
                                Pack
                              </span>
                            )}
                          </div>
                          {formation.description && (
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{formation.description}</p>
                          )}
                          {formation.is_pack && formation.formations_count && (
                            <p className="text-xs text-blue-600 mt-1">
                              {formation.formations_count} formation{formation.formations_count > 1 ? 's' : ''} incluse{formation.formations_count > 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {formation.corps_formation_name || '-'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getLevelColor(formation.level)}`}>
                          {getLevelLabel(formation.level)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <BookOpen className="h-4 w-4 text-gray-400" />
                          <span className="text-sm text-gray-900">
                            {formation.module_count || 0}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-sm text-gray-900">
                          {formation.price && Number(formation.price) > 0 ? (
                            <>
                              <DollarSign className="h-4 w-4 text-gray-400" />
                              {formatPrice(formation.price)}
                            </>
                          ) : (
                            <span className="text-gray-400">Gratuit</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {formation.certificate_template_name ? (
                          <div className="flex items-center gap-1 text-sm">
                            <Award className="h-4 w-4 text-blue-600" />
                            <span className="text-gray-900">{formation.certificate_template_name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Défaut système</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(formation.status)}`}>
                          {getStatusLabel(formation.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/admin/formations/cours/${formation.id}/editor`)}
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            title="Gérer le contenu (modules, vidéos, tests)"
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setFormationToEdit(formation)}
                            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                            title="Éditer les informations"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(formation)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            title="Supprimer la formation"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
        {filteredFormations && filteredFormations.length === 0 && !isLoading && (
          <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune formation</h3>
            <p className="text-sm text-gray-500 mb-6">
              Commencez par créer votre première formation en ligne
            </p>
            <Button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Créer une formation
            </Button>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateModal && (
        <FormationFormModal
          onClose={() => setShowCreateModal(false)}
        />
      )}

      {formationToEdit && (
        <FormationFormModal
          formation={formationToEdit}
          onClose={() => setFormationToEdit(null)}
        />
      )}

      {showPackModal && packCorps && (
        <PackFormModal
          isOpen={showPackModal}
          onClose={() => {
            setShowPackModal(false);
            setPackCorps(null);
          }}
          onSubmit={handleCreatePack}
          corpsId={packCorps.id}
          corpsName={packCorps.name}
        />
      )}
    </AppLayout>
  );
};

export default Cours;
