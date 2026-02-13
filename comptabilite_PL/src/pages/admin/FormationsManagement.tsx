import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  Plus,
  Edit,
  Trash2,
  BookOpen,
  Package,
  ChevronDown,
  ChevronRight,
  Settings,
  Award,
  Video,
  FileQuestion,
  Layers,
  Copy,
  MapPin,
} from 'lucide-react';
import {
  useCorpsFormation,
  useCreateCorpsFormation,
  useUpdateCorpsFormation,
  useDeleteCorpsFormation,
  useDuplicateCorpsFormation,
} from '@/hooks/useCorpsFormation';
import { useFormations, useDeleteFormation, useCoursStats, useDuplicateFormation } from '@/hooks/useCours';
import { useSegments } from '@/hooks/useSegments';
import { FormationFormModal } from '@/components/admin/formations/FormationFormModal';
import PackFormModal from '@/components/admin/formations/PackFormModal';
import { packsApi } from '@/lib/api/packs';
import type { CorpsFormation } from '@/types/corps-formation';
import type { Formation } from '@/types/cours';
import { usePermission } from '@/hooks/usePermission';

export default function FormationsManagement() {
  const navigate = useNavigate();
  const { training } = usePermission();
  const { data: corpsList = [], isLoading: loadingCorps } = useCorpsFormation();
  const { data: allFormations = [], isLoading: loadingFormations } = useFormations();
  const { data: stats } = useCoursStats();
  const { data: segments = [] } = useSegments();
  const deleteFormation = useDeleteFormation();
  const duplicateFormation = useDuplicateFormation();
  const createCorps = useCreateCorpsFormation();
  const updateCorps = useUpdateCorpsFormation();
  const deleteCorps = useDeleteCorpsFormation();
  const duplicateCorps = useDuplicateCorpsFormation();

  // État pour l'expansion des corps
  const [expandedCorps, setExpandedCorps] = useState<Set<string>>(new Set());

  // États pour les modals Corps
  const [showCorpsForm, setShowCorpsForm] = useState(false);
  const [editingCorps, setEditingCorps] = useState<CorpsFormation | null>(null);
  const [corpsFormData, setCorpsFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    order_index: 0,
    segment_id: '',
  });

  // États pour les modals Formation
  const [showFormationModal, setShowFormationModal] = useState(false);
  const [editingFormation, setEditingFormation] = useState<Formation | null>(null);
  const [preSelectedCorpsId, setPreSelectedCorpsId] = useState<string>('');

  // États pour les modals Pack
  const [showPackModal, setShowPackModal] = useState(false);
  const [packCorps, setPackCorps] = useState<{ id: string; name: string } | null>(null);

  // Toggle expansion d'un corps
  const toggleCorps = (corpsId: string) => {
    setExpandedCorps((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(corpsId)) {
        newSet.delete(corpsId);
      } else {
        newSet.add(corpsId);
      }
      return newSet;
    });
  };

  // Filtrer formations par corps
  const getFormationsByCorps = (corpsId: string) => {
    return allFormations.filter((f) => f.corps_formation_id === corpsId);
  };

  // Gérer Corps de Formation
  const handleCreateEditCorps = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!corpsFormData.name.trim()) {
      alert('Le nom du corps est obligatoire');
      return;
    }

    try {
      if (editingCorps) {
        await updateCorps.mutateAsync({
          id: editingCorps.id,
          data: corpsFormData,
        });
      } else {
        await createCorps.mutateAsync(corpsFormData);
      }
      resetCorpsForm();
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert(error.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleEditCorps = (corps: CorpsFormation) => {
    setEditingCorps(corps);
    setCorpsFormData({
      name: corps.name,
      description: corps.description || '',
      color: corps.color || '#3B82F6',
      order_index: corps.order_index || 0,
      segment_id: corps.segment_id || '',
    });
    setShowCorpsForm(true);
  };

  const handleDeleteCorps = async (id: string, name: string) => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer le corps "${name}" ?`)) {
      try {
        await deleteCorps.mutateAsync(id);
      } catch (error: any) {
        console.error('Erreur lors de la suppression:', error);

        // Si erreur 409 (corps contient des formations)
        if (error.status === 409 && error.message?.includes('formation(s)')) {
          const formationsCount = error.message.match(/(\d+)\s+formation\(s\)/)?.[1] || 'plusieurs';

          const forceDelete = confirm(
            `Ce corps contient ${formationsCount} formation(s).\n\n` +
            `Voulez-vous forcer la suppression en détachant automatiquement les formations?\n\n` +
            `⚠️ Les formations ne seront PAS supprimées, elles seront simplement détachées du corps.`
          );

          if (forceDelete) {
            try {
              // Importer corpsFormationApi
              const { corpsFormationApi } = await import('@/lib/api/corps-formation');
              const result = await corpsFormationApi.deleteForce(id);

              alert(`✓ Corps supprimé avec succès!\n${result.formations_detached} formation(s) ont été détachées.`);

              // Recharger la liste
              window.location.reload();
            } catch (forceError: any) {
              console.error('Erreur lors de la suppression forcée:', forceError);
              alert(forceError.message || 'Erreur lors de la suppression forcée.');
            }
          }
        } else {
          alert(error.message || 'Erreur lors de la suppression.');
        }
      }
    }
  };

  const handleDuplicateCorps = async (id: string) => {
    try {
      await duplicateCorps.mutateAsync({
        id,
        options: { include_formations: true }
      });
    } catch (error: any) {
      alert(error.message || 'Erreur lors de la duplication');
    }
  };

  const handleDuplicateFormation = async (id: string, title: string) => {
    const includeModules = confirm(
      `Voulez-vous dupliquer la formation "${title}" avec tous ses modules ?\n\nOUI = Avec modules\nNON = Sans modules`
    );

    try {
      await duplicateFormation.mutateAsync({
        id,
        options: { include_modules: includeModules }
      });
    } catch (error: any) {
      alert(error.message || 'Erreur lors de la duplication');
    }
  };

  const resetCorpsForm = () => {
    setCorpsFormData({ name: '', description: '', color: '#3B82F6', order_index: 0, segment_id: '' });
    setEditingCorps(null);
    setShowCorpsForm(false);
  };

  // Gérer Formations
  const handleCreateFormation = (corpsId: string) => {
    setPreSelectedCorpsId(corpsId);
    setEditingFormation(null);
    setShowFormationModal(true);
  };

  const handleEditFormation = (formation: Formation) => {
    setEditingFormation(formation);
    setPreSelectedCorpsId('');
    setShowFormationModal(true);
  };

  const handleDeleteFormation = async (id: string, title: string) => {
    if (confirm(`Êtes-vous sûr de vouloir supprimer "${title}" ?`)) {
      try {
        await deleteFormation.mutateAsync(id);
      } catch (error: any) {
        alert(error.message || 'Erreur lors de la suppression');
      }
    }
  };

  // Gérer Packs
  const handleCreatePack = (corpsId: string, corpsName: string) => {
    setPackCorps({ id: corpsId, name: corpsName });
    setShowPackModal(true);
  };

  const handleSubmitPack = async (data: any) => {
    try {
      await packsApi.create(data);
      setShowPackModal(false);
      setPackCorps(null);
    } catch (error: any) {
      console.error('Erreur création pack:', error);
      throw error;
    }
  };

  return (
    <AppLayout
      title="Gestion des Formations"
      subtitle="Corps de formation et formations associées"
    >
      <div className="space-y-6">
        {/* Header Actions */}
        {training.canCreateCorps && (
          <div className="flex justify-end">
            <Button onClick={() => setShowCorpsForm(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau Corps
            </Button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Corps</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">{corpsList.length}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Layers className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Formations</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">
                    {stats?.formations?.total || 0}
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <BookOpen className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Vidéos</p>
                  <p className="text-3xl font-bold text-purple-600 mt-1">
                    {stats?.total_videos || 0}
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Video className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Tests</p>
                  <p className="text-3xl font-bold text-orange-600 mt-1">
                    {stats?.total_tests || 0}
                  </p>
                </div>
                <div className="p-3 bg-orange-100 rounded-lg">
                  <FileQuestion className="h-6 w-6 text-orange-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Modal Formulaire Corps */}
        {showCorpsForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b">
                <h2 className="text-xl font-semibold">
                  {editingCorps ? 'Modifier' : 'Nouveau'} Corps de Formation
                </h2>
              </div>
              <form onSubmit={handleCreateEditCorps} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom du corps <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={corpsFormData.name}
                    onChange={(e) => setCorpsFormData({ ...corpsFormData, name: e.target.value })}
                    placeholder="Ex: Bureautique, Développement Web..."
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={corpsFormData.description}
                    onChange={(e) =>
                      setCorpsFormData({ ...corpsFormData, description: e.target.value })
                    }
                    placeholder="Description du corps de formation..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Segment (optionnel)
                  </label>
                  <select
                    value={corpsFormData.segment_id}
                    onChange={(e) =>
                      setCorpsFormData({ ...corpsFormData, segment_id: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Aucun segment</option>
                    {segments.map((segment) => (
                      <option key={segment.id} value={segment.id}>
                        {segment.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Couleur</label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        value={corpsFormData.color}
                        onChange={(e) =>
                          setCorpsFormData({ ...corpsFormData, color: e.target.value })
                        }
                        className="w-20 h-10"
                      />
                      <Input
                        type="text"
                        value={corpsFormData.color}
                        onChange={(e) =>
                          setCorpsFormData({ ...corpsFormData, color: e.target.value })
                        }
                        placeholder="#3B82F6"
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Ordre d'affichage
                    </label>
                    <Input
                      type="number"
                      value={corpsFormData.order_index}
                      onChange={(e) =>
                        setCorpsFormData({
                          ...corpsFormData,
                          order_index: parseInt(e.target.value) || 0,
                        })
                      }
                      min="0"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-4">
                  <Button type="submit" disabled={createCorps.isPending || updateCorps.isPending}>
                    {editingCorps ? 'Modifier' : 'Créer'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetCorpsForm}>
                    Annuler
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Liste Accordion des Corps */}
        <div className="space-y-3">
          {loadingCorps ? (
            <div className="text-center py-12">
              <p className="text-gray-500">Chargement...</p>
            </div>
          ) : corpsList.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Layers className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">Aucun corps de formation</p>
                <Button onClick={() => setShowCorpsForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Créer le premier corps
                </Button>
              </CardContent>
            </Card>
          ) : (
            corpsList.map((corps) => {
              const formations = getFormationsByCorps(corps.id);
              const isExpanded = expandedCorps.has(corps.id);

              return (
                <Card key={corps.id} className="overflow-hidden">
                  {/* En-tête du Corps */}
                  <div className="bg-gray-50 border-b">
                    <div className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        {/* Bouton d'expansion */}
                        <button
                          onClick={() => toggleCorps(corps.id)}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5 text-gray-600" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-gray-600" />
                          )}
                        </button>

                        {/* Badge couleur */}
                        <div
                          className="w-8 h-8 rounded border border-gray-300 flex-shrink-0"
                          style={{ backgroundColor: corps.color || '#3B82F6' }}
                        />

                        {/* Nom et stats */}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-semibold text-gray-900">{corps.name}</h3>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {formations.length} formation{formations.length !== 1 ? 's' : ''}
                            </span>
                            {corps.segment_name && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                <MapPin className="h-3 w-3 mr-1" />
                                {corps.segment_name}
                              </span>
                            )}
                          </div>
                          {corps.description && (
                            <p className="text-sm text-gray-600 mt-0.5">{corps.description}</p>
                          )}
                        </div>
                      </div>

                      {/* Actions Corps */}
                      <div className="flex items-center gap-2">
                        {training.canCreateFormation && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCreateFormation(corps.id)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Formation
                          </Button>
                        )}
                        {training.canDuplicateCorps && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDuplicateCorps(corps.id)}
                            disabled={duplicateCorps.isPending}
                            title="Dupliquer ce corps"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        )}
                        {training.canUpdateCorps && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditCorps(corps)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        {training.canDeleteCorps && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteCorps(corps.id, corps.name)}
                            disabled={deleteCorps.isPending}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contenu déplié : Formations */}
                  {isExpanded && (
                    <CardContent className="p-0">
                      {loadingFormations ? (
                        <div className="p-8 text-center text-gray-500">
                          Chargement des formations...
                        </div>
                      ) : formations.length === 0 ? (
                        <div className="p-8 text-center">
                          <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-600 mb-4">
                            Aucune formation dans ce corps
                          </p>
                          <div className="flex gap-2 justify-center">
                            {training.canCreateFormation && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCreateFormation(corps.id)}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Créer une formation
                              </Button>
                            )}
                            {training.canCreatePack && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCreatePack(corps.id, corps.name)}
                              >
                                <Package className="h-4 w-4 mr-2" />
                                Créer un pack
                              </Button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div>
                          {/* Bouton Créer Pack */}
                          {training.canCreatePack && (
                            <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCreatePack(corps.id, corps.name)}
                                className="bg-white"
                              >
                                <Package className="h-4 w-4 mr-2 text-amber-600" />
                                Créer un pack pour ce corps
                              </Button>
                            </div>
                          )}

                          {/* Tableau des formations */}
                          <div className="overflow-x-auto">
                            <table className="w-full">
                              <thead className="bg-gray-50 border-b">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Formation
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Niveau
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Prix
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Prime Assistante
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Modules
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Certificat
                                  </th>
                                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                    Statut
                                  </th>
                                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200 bg-white">
                                {formations.map((formation) => (
                                  <tr key={formation.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                        <div className="font-medium text-gray-900">
                                          {formation.title}
                                        </div>
                                        {formation.is_pack && (
                                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                                            <Package className="h-3 w-3 mr-1" />
                                            Pack
                                          </span>
                                        )}
                                      </div>
                                      {formation.is_pack && formation.formations_count && (
                                        <div className="text-xs text-blue-600 mt-0.5">
                                          {formation.formations_count} formation
                                          {formation.formations_count > 1 ? 's' : ''} incluse
                                          {formation.formations_count > 1 ? 's' : ''}
                                        </div>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="text-sm text-gray-600 capitalize">
                                        {formation.level || '-'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="text-sm font-medium text-gray-900">
                                        {formation.price
                                          ? `${parseFloat(String(formation.price)).toFixed(2)} MAD`
                                          : 'Gratuit'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      {formation.prime_assistante && parseFloat(String(formation.prime_assistante)) > 0 ? (
                                        <span className="text-sm font-medium text-green-600">
                                          {parseFloat(String(formation.prime_assistante)).toFixed(2)} MAD
                                        </span>
                                      ) : (
                                        <span className="text-sm text-red-500 font-medium">Non définie</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span className="text-sm text-gray-600">
                                        {formation.module_count || 0}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      {formation.certificate_template_name ? (
                                        <div className="flex items-center gap-1 text-sm text-blue-600">
                                          <Award className="h-4 w-4" />
                                          <span className="truncate max-w-[150px]">
                                            {formation.certificate_template_name}
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-sm text-gray-400">-</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      <span
                                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                          formation.status === 'published'
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-gray-100 text-gray-700'
                                        }`}
                                      >
                                        {formation.status === 'published' ? 'Publié' : 'Brouillon'}
                                      </span>
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center justify-end gap-2">
                                        {training.canEditContent && !formation.is_pack && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                              navigate(`/admin/formations/cours/${formation.id}/editor`)
                                            }
                                            title="Éditeur"
                                          >
                                            <Settings className="h-4 w-4" />
                                          </Button>
                                        )}
                                        {training.canDuplicateFormation && !formation.is_pack && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                              handleDuplicateFormation(formation.id, formation.title)
                                            }
                                            disabled={duplicateFormation.isPending}
                                            title="Dupliquer cette formation"
                                          >
                                            <Copy className="h-4 w-4" />
                                          </Button>
                                        )}
                                        {training.canUpdateFormation && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleEditFormation(formation)}
                                            title="Modifier"
                                          >
                                            <Edit className="h-4 w-4" />
                                          </Button>
                                        )}
                                        {training.canDeleteFormation && (
                                          <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                              handleDeleteFormation(formation.id, formation.title)
                                            }
                                            disabled={deleteFormation.isPending}
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                            title="Supprimer"
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
                    </CardContent>
                  )}
                </Card>
              );
            })
          )}
        </div>

        {/* Modal Formation */}
        {showFormationModal && (
          <FormationFormModal
            formation={
              editingFormation
                ? { ...editingFormation, corps_formation_id: editingFormation.corps_formation_id }
                : preSelectedCorpsId
                ? ({ corps_formation_id: preSelectedCorpsId } as Formation)
                : undefined
            }
            onClose={() => {
              setShowFormationModal(false);
              setEditingFormation(null);
              setPreSelectedCorpsId('');
            }}
          />
        )}

        {/* Modal Pack */}
        {showPackModal && packCorps && (
          <PackFormModal
            isOpen={showPackModal}
            onClose={() => {
              setShowPackModal(false);
              setPackCorps(null);
            }}
            onSubmit={handleSubmitPack}
            corpsId={packCorps.id}
            corpsName={packCorps.name}
          />
        )}
      </div>
    </AppLayout>
  );
}
