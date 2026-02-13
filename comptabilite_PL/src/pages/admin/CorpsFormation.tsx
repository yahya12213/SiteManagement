import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit, Trash2, BookOpen, Package } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  useCorpsFormation,
  useCreateCorpsFormation,
  useUpdateCorpsFormation,
  useDeleteCorpsFormation,
} from '@/hooks/useCorpsFormation';
import type { CorpsFormation } from '@/types/corps-formation';
import { usePermission } from '@/hooks/usePermission';

export default function CorpsFormationPage() {
  const { training } = usePermission();
  const { data: corpsList = [], isLoading, error } = useCorpsFormation();
  const createCorps = useCreateCorpsFormation();
  const updateCorps = useUpdateCorpsFormation();
  const deleteCorps = useDeleteCorpsFormation();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3B82F6',
    order_index: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Le nom du corps de formation est obligatoire');
      return;
    }

    try {
      if (editingId) {
        await updateCorps.mutateAsync({
          id: editingId,
          data: {
            name: formData.name,
            description: formData.description || undefined,
            color: formData.color,
            order_index: formData.order_index,
          },
        });
      } else {
        await createCorps.mutateAsync({
          name: formData.name,
          description: formData.description || undefined,
          color: formData.color,
          order_index: formData.order_index,
        });
      }
      resetForm();
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert(error.message || 'Erreur lors de la sauvegarde du corps de formation');
    }
  };

  const handleEdit = (corps: CorpsFormation) => {
    setFormData({
      name: corps.name,
      description: corps.description || '',
      color: corps.color || '#3B82F6',
      order_index: corps.order_index || 0,
    });
    setEditingId(corps.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string, name: string) => {
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
              await deleteCorps.reset();
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

  const resetForm = () => {
    setFormData({ name: '', description: '', color: '#3B82F6', order_index: 0 });
    setEditingId(null);
    setShowForm(false);
  };

  if (error) {
    return (
      <AppLayout title="Corps de Formation" subtitle="Gérez les catégories de formations">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Erreur lors du chargement: {(error as Error).message}</p>
        </div>
      </AppLayout>
    );
  }

  const totalFormations = corpsList.reduce((sum, corps) => sum + (corps.formations_count || 0), 0);

  return (
    <AppLayout title="Corps de Formation" subtitle="Gérez les catégories de formations">
      <div className="space-y-6">
        {/* Header Actions */}
        {training.canCreateCorps && (
          <div className="flex justify-end">
            <Button onClick={() => setShowForm(!showForm)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Nouveau corps
            </Button>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Corps</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">{corpsList.length}</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <BookOpen className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Formations</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">{totalFormations}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <Package className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Moyenne</p>
                  <p className="text-3xl font-bold text-purple-600 mt-1">
                    {corpsList.length > 0 ? Math.round(totalFormations / corpsList.length) : 0}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">formations/corps</p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <BookOpen className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Form */}
        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{editingId ? 'Modifier' : 'Nouveau'} Corps de Formation</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nom du corps <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Bureautique, Développement Web..."
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Couleur
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="color"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="w-20 h-10"
                      />
                      <Input
                        type="text"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        placeholder="#3B82F6"
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Description du corps de formation..."
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ordre d'affichage
                  </label>
                  <Input
                    type="number"
                    value={formData.order_index}
                    onChange={(e) => setFormData({ ...formData, order_index: parseInt(e.target.value) || 0 })}
                    placeholder="0"
                    min="0"
                  />
                  <p className="text-xs text-gray-500 mt-1">Plus le nombre est petit, plus il apparaît en premier</p>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={createCorps.isPending || updateCorps.isPending}
                  >
                    {editingId ? 'Modifier' : 'Créer'}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Annuler
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* List */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des Corps de Formation</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8">
                <p className="text-gray-500">Chargement...</p>
              </div>
            ) : corpsList.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">Aucun corps de formation</p>
                <Button onClick={() => setShowForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Créer le premier corps
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Couleur
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Nom
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Description
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Formations
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        Ordre
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {corpsList.map((corps) => (
                      <tr key={corps.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div
                            className="w-8 h-8 rounded border border-gray-300"
                            style={{ backgroundColor: corps.color || '#3B82F6' }}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{corps.name}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-gray-600 max-w-xs truncate">
                            {corps.description || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {corps.formations_count || 0} formation{(corps.formations_count || 0) !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm text-gray-600">{corps.order_index}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            {training.canUpdateCorps && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEdit(corps)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            )}
                            {training.canDeleteCorps && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDelete(corps.id, corps.name)}
                                disabled={deleteCorps.isPending}
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
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
