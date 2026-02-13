import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Edit, Trash2, Upload, Image, X } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import ImportCitiesModal from '@/components/admin/ImportCitiesModal';
import { useSegments, useCreateSegment, useUpdateSegment, useDeleteSegment, useUploadSegmentLogo } from '@/hooks/useSegments';
import { usePermission } from '@/hooks/usePermission';
import type { Segment } from '@/hooks/useSegments';

export default function Segments() {
  const { data: segments = [], isLoading, error } = useSegments();
  const createSegment = useCreateSegment();
  const updateSegment = useUpdateSegment();
  const deleteSegment = useDeleteSegment();
  const uploadLogo = useUploadSegmentLogo();
  const { accounting } = usePermission();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [selectedSegment, setSelectedSegment] = useState<{ id: string; name: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    color: '#3b82f6',
    cnss_number: '',
    identifiant_fiscal: '',
    registre_commerce: '',
    ice: '',
    company_address: '',
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingId) {
        await updateSegment.mutateAsync({
          id: editingId,
          name: formData.name,
          color: formData.color,
          cnss_number: formData.cnss_number || undefined,
          identifiant_fiscal: formData.identifiant_fiscal || undefined,
          registre_commerce: formData.registre_commerce || undefined,
          ice: formData.ice || undefined,
          company_address: formData.company_address || undefined,
        });

        // Upload logo si nouveau fichier sélectionné
        if (logoFile) {
          await uploadLogo.mutateAsync({ segmentId: editingId, file: logoFile });
        }
      } else {
        await createSegment.mutateAsync({
          name: formData.name,
          color: formData.color,
        });
      }
      resetForm();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde du segment');
    }
  };

  const handleEdit = (segment: Segment) => {
    setFormData({
      name: segment.name,
      color: segment.color || '#3B82F6',
      cnss_number: segment.cnss_number || '',
      identifiant_fiscal: segment.identifiant_fiscal || '',
      registre_commerce: segment.registre_commerce || '',
      ice: segment.ice || '',
      company_address: segment.company_address || '',
    });
    setLogoPreview(segment.logo_url || null);
    setLogoFile(null);
    setEditingId(segment.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce segment ?')) {
      try {
        await deleteSegment.mutateAsync(id);
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression du segment');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      color: '#3b82f6',
      cnss_number: '',
      identifiant_fiscal: '',
      registre_commerce: '',
      ice: '',
      company_address: '',
    });
    setEditingId(null);
    setShowForm(false);
    setLogoFile(null);
    setLogoPreview(null);
  };

  const handleOpenImport = (segment: Segment) => {
    setSelectedSegment({ id: segment.id, name: segment.name });
    setImportModalOpen(true);
  };

  if (error) {
    return (
      <AppLayout title="Gestion des Segments" subtitle="Gérer les segments de formation">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Erreur lors du chargement des segments: {(error as Error).message}</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Gestion des Segments" subtitle="Gérer les segments de formation">
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex justify-end">
          {accounting.canCreateSegment && (
            <Button onClick={() => setShowForm(!showForm)} className="w-full sm:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Nouveau Segment
            </Button>
          )}
        </div>

        {/* Form */}
        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{editingId ? 'Modifier' : 'Nouveau'} Segment</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Nom du segment</label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Formation Informatique"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Couleur</label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="w-20"
                      />
                      <Input
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        placeholder="#3b82f6"
                      />
                    </div>
                  </div>
                </div>

                {/* Logo - uniquement en mode édition */}
                {editingId && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      <Image className="h-4 w-4 inline mr-1" />
                      Logo du segment (pour bulletins de paie)
                    </label>
                    <div className="flex items-center gap-4">
                      {/* Preview */}
                      {logoPreview && (
                        <div className="relative w-20 h-20 border rounded overflow-hidden bg-gray-50">
                          <img
                            src={logoPreview}
                            alt="Logo"
                            className="w-full h-full object-contain"
                          />
                          <button
                            type="button"
                            title="Supprimer le logo"
                            onClick={() => {
                              setLogoFile(null);
                              setLogoPreview(null);
                            }}
                            className="absolute top-0 right-0 bg-red-500 text-white p-1 rounded-bl"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                      {/* Input file */}
                      <div className="flex-1">
                        <Input
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setLogoFile(file);
                              setLogoPreview(URL.createObjectURL(file));
                            }
                          }}
                        />
                        <p className="text-xs text-gray-500 mt-1">PNG, JPG ou WebP. Max 2MB. Apparaîtra sur les bulletins PDF.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Informations fiscales - uniquement en mode édition */}
                {editingId && (
                  <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
                    <h3 className="font-semibold text-gray-700">Informations Fiscales & Légales</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* N° CNSS Employeur */}
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          N° CNSS Employeur
                        </label>
                        <Input
                          value={formData.cnss_number}
                          onChange={(e) => setFormData({ ...formData, cnss_number: e.target.value })}
                          placeholder="Ex: 1234567"
                        />
                      </div>

                      {/* Identifiant Fiscal (IF) */}
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Identifiant Fiscal (IF)
                        </label>
                        <Input
                          value={formData.identifiant_fiscal}
                          onChange={(e) => setFormData({ ...formData, identifiant_fiscal: e.target.value })}
                          placeholder="Ex: 12345678"
                        />
                      </div>

                      {/* Registre de Commerce (RC) */}
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          Registre de Commerce (RC)
                        </label>
                        <Input
                          value={formData.registre_commerce}
                          onChange={(e) => setFormData({ ...formData, registre_commerce: e.target.value })}
                          placeholder="Ex: 123456"
                        />
                      </div>

                      {/* ICE */}
                      <div>
                        <label className="text-sm font-medium mb-2 block">
                          ICE (Identifiant Commun de l'Entreprise)
                        </label>
                        <Input
                          value={formData.ice}
                          onChange={(e) => setFormData({ ...formData, ice: e.target.value })}
                          placeholder="Ex: 001524896000088"
                        />
                      </div>
                    </div>

                    {/* Adresse siège social */}
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Adresse Siège Social
                      </label>
                      <textarea
                        value={formData.company_address}
                        onChange={(e) => setFormData({ ...formData, company_address: e.target.value })}
                        placeholder="Adresse complète du siège social..."
                        className="w-full p-2 border rounded-md text-sm resize-none"
                        rows={2}
                      />
                    </div>

                    <p className="text-xs text-gray-500">
                      Ces informations apparaîtront sur les bulletins de paie générés pour ce segment.
                    </p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button type="submit" disabled={createSegment.isPending || updateSegment.isPending} className="w-full sm:w-auto">
                    {(createSegment.isPending || updateSegment.isPending) ? 'Enregistrement...' : (editingId ? 'Modifier' : 'Créer')}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm} className="w-full sm:w-auto">
                    Annuler
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="text-center py-12">
            <p className="text-gray-500">Chargement des segments...</p>
          </div>
        )}

        {/* List */}
        {!isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {segments.map((segment: Segment) => (
              <Card key={segment.id} style={{ borderLeft: `4px solid ${segment.color || '#3B82F6'}` }}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{segment.name}</span>
                    <div
                      className="w-6 h-6 rounded"
                      style={{ backgroundColor: segment.color || '#3B82F6' }}
                    />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-2">
                    {accounting.canImportCities && (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => handleOpenImport(segment)}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Importer des villes
                      </Button>
                    )}
                    <div className="flex gap-2">
                      {accounting.canUpdateSegment && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(segment)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {accounting.canDeleteSegment && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDelete(segment.id)}
                          disabled={deleteSegment.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!isLoading && segments.length === 0 && !showForm && (
          <div className="text-center py-12">
            <p className="text-gray-500">Aucun segment créé pour le moment</p>
          </div>
        )}
      </div>

      {/* Modal d'import */}
      {importModalOpen && selectedSegment && (
        <ImportCitiesModal
          segmentId={selectedSegment.id}
          segmentName={selectedSegment.name}
          onClose={() => {
            setImportModalOpen(false);
            setSelectedSegment(null);
          }}
        />
      )}
    </AppLayout>
  );
}
