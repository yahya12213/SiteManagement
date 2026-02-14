import { useState } from 'react';
import { Plus, Calculator, Edit3, Eye, Trash2, FileSpreadsheet, Layers, MapPin, Settings, Upload, XCircle, Copy, Download, Wrench } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useCalculationSheets, useDeleteCalculationSheet, useCreateCalculationSheet, useUpdateCalculationSheet, useTogglePublishCalculationSheet, useDuplicateCalculationSheet, type CalculationSheetData } from '@/hooks/useCalculationSheets';
import { useSegments, type Segment } from '@/hooks/useSegments';
import { useCities, type City } from '@/hooks/useCities';
import { MigrationPanel } from '@/components/admin/MigrationPanel';
import { tokenManager } from '@/lib/api/client';
import { usePermission } from '@/hooks/usePermission';

export default function CalculationSheetsList() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingSheet, setEditingSheet] = useState<any>(null);
  const [isMigrationPanelOpen, setIsMigrationPanelOpen] = useState(false);

  // Permissions
  const { accounting } = usePermission();

  // Check if current user is admin
  const currentUser = tokenManager.getUser();
  const isAdmin = currentUser?.role === 'admin';

  const { data: sheets = [], isLoading } = useCalculationSheets();
  const { data: segments = [] } = useSegments();
  const { data: cities = [] } = useCities();
  const deleteSheet = useDeleteCalculationSheet();
  const togglePublish = useTogglePublishCalculationSheet();
  const duplicateSheet = useDuplicateCalculationSheet();

  // Enrichir les sheets avec les données complètes de segments et villes
  const enrichedSheets = sheets.map((sheet: CalculationSheetData) => ({
    ...sheet,
    segments: segments.filter((s: Segment) => s && sheet.segment_ids?.includes(s.id)),
    cities: cities.filter((c: City) => c && sheet.city_ids?.includes(c.id)),
  }));

  const handleDelete = async (id: string, title: string) => {
    if (window.confirm(`Êtes-vous sûr de vouloir supprimer "${title}" ?`)) {
      try {
        await deleteSheet.mutateAsync(id);
      } catch (error) {
        console.error('Erreur lors de la suppression:', error);
        alert('Erreur lors de la suppression de la fiche');
      }
    }
  };

  const handleTogglePublish = async (id: string, currentStatus: string, title: string) => {
    const action = currentStatus === 'published' ? 'dépublier' : 'publier';
    const message = currentStatus === 'published'
      ? `Êtes-vous sûr de vouloir dépublier "${title}" ?\n\nLes professeurs ne pourront plus l'utiliser.`
      : `Êtes-vous sûr de vouloir publier "${title}" ?\n\nLes professeurs pourront utiliser cette fiche.`;

    if (window.confirm(message)) {
      try {
        await togglePublish.mutateAsync(id);
      } catch (error) {
        console.error(`Erreur lors de la ${action}ication:`, error);
        alert(`Erreur lors de la ${action}ication de la fiche`);
      }
    }
  };

  const handleDuplicate = async (id: string, title: string) => {
    if (window.confirm(`Voulez-vous dupliquer "${title}" ?\n\nUne copie en brouillon sera créée.`)) {
      try {
        await duplicateSheet.mutateAsync(id);
      } catch (error) {
        console.error('Erreur lors de la duplication:', error);
        alert('Erreur lors de la duplication de la fiche');
      }
    }
  };

  const handleExport = (sheet: any) => {
    try {
      // Parse template_data to get fields
      const templateData = JSON.parse(sheet.template_data);

      // Create export object
      const exportData = {
        name: sheet.title,
        fields: templateData.fields || [],
        version: templateData.version || '1.0.0',
      };

      // Convert to JSON string
      const jsonString = JSON.stringify(exportData, null, 2);

      // Create blob and download
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${sheet.title.replace(/\s+/g, '-').toLowerCase()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur lors de l\'export:', error);
      alert('Erreur lors de l\'export de la fiche');
    }
  };

  return (
    <AppLayout
      title="Gestion des Fiches de Calcul"
      subtitle="Créer et gérer les templates de fiches de calcul pour les sessions"
    >
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex justify-end gap-3">
          {isAdmin && (
            <button
              onClick={() => setIsMigrationPanelOpen(true)}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm"
              title="Migrations & Diagnostics"
            >
              <Wrench className="w-4 h-4" />
              Migrations
            </button>
          )}
          {accounting.canCreateSheet && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Nouvelle Fiche
            </button>
          )}
        </div>

        {/* Migration Panel */}
        <MigrationPanel
          open={isMigrationPanelOpen}
          onOpenChange={setIsMigrationPanelOpen}
        />

        {/* Liste des fiches */}
      {isLoading ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des fiches...</p>
        </div>
      ) : enrichedSheets.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm p-12 text-center">
          <FileSpreadsheet className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucune fiche créée</h3>
          <p className="text-gray-500 mb-6">
            Commencez par créer votre première fiche de calcul
          </p>
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Créer ma première fiche
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {enrichedSheets.map((sheet) => (
            <div
              key={sheet.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="p-6">
                {/* En-tête de la carte */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {sheet.title}
                    </h3>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        sheet.status === 'published'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {sheet.status === 'published' ? 'Publiée' : 'Brouillon'}
                    </span>
                  </div>
                  <Calculator className="w-8 h-8 text-blue-500" />
                </div>

                {/* Segments affectés */}
                <div className="mb-3">
                  <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                    <Layers className="w-4 h-4" />
                    <span className="font-medium">Segments ({sheet.segments.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sheet.segments.filter((segment): segment is Segment => !!segment).map((segment) => (
                      <span
                        key={segment.id}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                      >
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: segment.color || '#3B82F6' }}
                        />
                        {segment.name}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Villes affectées */}
                <div className="mb-4">
                  <div className="flex items-center gap-1 text-sm text-gray-600 mb-2">
                    <MapPin className="w-4 h-4" />
                    <span className="font-medium">Villes ({sheet.cities.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {sheet.cities.slice(0, 3).map((city) => (
                      <span
                        key={city.id}
                        className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs"
                      >
                        {city.name}
                      </span>
                    ))}
                    {sheet.cities.length > 3 && (
                      <span className="inline-flex items-center px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                        +{sheet.cities.length - 3} autres
                      </span>
                    )}
                  </div>
                </div>

                {/* Date */}
                <div className="text-xs text-gray-500 mb-4">
                  Modifié le {new Date(sheet.updated_at).toLocaleDateString('fr-FR')}
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-4 border-t border-gray-200">
                  {/* Bouton Publier/Dépublier en pleine largeur */}
                  {accounting.canPublishSheet && (
                    <button
                      onClick={() => handleTogglePublish(sheet.id, sheet.status, sheet.title)}
                      disabled={togglePublish.isPending}
                      className={`w-full px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                        sheet.status === 'published'
                          ? 'bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200'
                          : 'bg-green-50 hover:bg-green-100 text-green-700 border border-green-200'
                      }`}
                    >
                      {sheet.status === 'published' ? (
                        <>
                          <XCircle className="w-4 h-4" />
                          Dépublier
                        </>
                      ) : (
                        <>
                          <Upload className="w-4 h-4" />
                          Publier
                        </>
                      )}
                    </button>
                  )}

                  {/* Autres actions */}
                  <div className="flex gap-2">
                    {accounting.canViewSheet && (
                      <Link
                        to={`/admin/calculation-sheets/${sheet.id}`}
                        className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors"
                      >
                        <Eye className="w-4 h-4" />
                        Voir
                      </Link>
                    )}
                    {accounting.canManageSheetSettings && (
                      <button
                        onClick={() => setEditingSheet(sheet)}
                        className="px-3 py-2 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-lg text-sm transition-colors"
                        title="Modifier les informations"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    )}
                    {accounting.canEditCalculationSheet && (
                      <Link
                        to={`/admin/calculation-sheets/${sheet.id}/editor`}
                        className="flex-1 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                        Modifier
                      </Link>
                    )}
                  </div>

                  {/* Actions secondaires */}
                  <div className="flex gap-2 mt-2">
                    {accounting.canExportSheet && (
                      <button
                        onClick={() => handleExport(sheet)}
                        className="flex-1 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium flex items-center justify-center gap-1 transition-colors"
                        title="Exporter en JSON"
                      >
                        <Download className="w-4 h-4" />
                        Exporter
                      </button>
                    )}
                    {accounting.canDuplicateSheet && (
                      <button
                        onClick={() => handleDuplicate(sheet.id, sheet.title)}
                        className="px-3 py-2 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 rounded-lg text-sm transition-colors"
                        title="Dupliquer"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    )}
                    {accounting.canDeleteSheet && (
                      <button
                        onClick={() => handleDelete(sheet.id, sheet.title)}
                        className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de création */}
      {isCreateModalOpen && (
        <CreateSheetModal onClose={() => setIsCreateModalOpen(false)} />
      )}

      {/* Modal de modification */}
      {editingSheet && (
        <EditSheetModal
          sheet={editingSheet}
          onClose={() => setEditingSheet(null)}
        />
      )}
      </div>
    </AppLayout>
  );
}

// Composant Modal de création
function CreateSheetModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [selectedSegments, setSelectedSegments] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const navigate = useNavigate();

  const createSheet = useCreateCalculationSheet();
  const { data: segments = [] } = useSegments();
  const { data: cities = [] } = useCities();

  const filteredCities = cities.filter((city: City) =>
    selectedSegments.includes(city.segment_id)
  );

  const handleCreate = async () => {
    try {
      const newSheet = await createSheet.mutateAsync({
        title,
        segment_ids: selectedSegments,
        city_ids: selectedCities,
      });
      onClose();
      // Rediriger vers l'éditeur avec l'ID de la nouvelle fiche
      navigate(`/admin/calculation-sheets/${newSheet.id}/editor`);
    } catch (error) {
      console.error('Erreur lors de la création:', error);
      alert('Erreur lors de la création de la fiche');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[650px] md:w-[750px] lg:w-[850px] max-w-[95vw] max-h-[90vh] overflow-hidden">
        {/* En-tête */}
        <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Créer une Fiche de Calcul</h2>
            <p className="text-green-100 text-sm">Étape {step} sur 3</p>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white/10 p-2 rounded-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenu */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Étape 1: Titre */}
          {step === 1 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Informations générales</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Titre de la fiche
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Fiche Formation Professionnelle"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Étape 2: Segments */}
          {step === 2 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">
                Sélectionner les segments ({selectedSegments.length} sélectionné{selectedSegments.length > 1 ? 's' : ''})
              </h3>
              <div className="space-y-2">
                {segments.map((segment) => (
                  <label
                    key={segment.id}
                    className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSegments.includes(segment.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSegments([...selectedSegments, segment.id]);
                        } else {
                          setSelectedSegments(selectedSegments.filter((s) => s !== segment.id));
                          // Retirer les villes de ce segment
                          const citiesToRemove = cities
                            .filter((c: City) => c.segment_id === segment.id)
                            .map((c: City) => c.id);
                          setSelectedCities(selectedCities.filter((c) => !citiesToRemove.includes(c)));
                        }
                      }}
                      className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: segment.color || '#3B82F6' }}
                    />
                    <span className="flex-1 font-medium text-gray-900">{segment.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Étape 3: Villes */}
          {step === 3 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">
                Sélectionner les villes ({selectedCities.length} sélectionnée{selectedCities.length > 1 ? 's' : ''})
              </h3>
              {selectedSegments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Vous devez d'abord sélectionner au moins un segment
                </div>
              ) : filteredCities.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Aucune ville disponible pour les segments sélectionnés
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCities.map((city) => (
                    <label
                      key={city.id}
                      className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCities.includes(city.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCities([...selectedCities, city.id]);
                          } else {
                            setSelectedCities(selectedCities.filter((c) => c !== city.id));
                          }
                        }}
                        className="w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      />
                      <MapPin className="w-4 h-4 text-green-600" />
                      <span className="flex-1 font-medium text-gray-900">{city.name}</span>
                      <span className="text-sm text-gray-500">
                        {segments.find((s: Segment) => s.id === city.segment_id)?.name}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pied de page */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
          >
            {step === 1 ? 'Annuler' : 'Précédent'}
          </button>
          <button
            onClick={() => {
              if (step < 3) {
                setStep(step + 1);
              } else {
                handleCreate();
              }
            }}
            disabled={step === 1 && !title}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {step === 3 ? 'Créer la fiche' : 'Suivant'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Composant Modal de modification
function EditSheetModal({ sheet, onClose }: { sheet: any; onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState(sheet.title);
  const [selectedSegments, setSelectedSegments] = useState<string[]>(sheet.segment_ids || []);
  const [selectedCities, setSelectedCities] = useState<string[]>(sheet.city_ids || []);

  const updateSheet = useUpdateCalculationSheet();
  const { data: segments = [] } = useSegments();
  const { data: cities = [] } = useCities();

  const filteredCities = cities.filter((city: City) =>
    selectedSegments.includes(city.segment_id)
  );

  const handleUpdate = async () => {
    try {
      await updateSheet.mutateAsync({
        id: sheet.id,
        title,
        template_data: sheet.template_data,
        status: sheet.status,
        sheet_date: sheet.sheet_date,
        segment_ids: selectedSegments,
        city_ids: selectedCities,
      });
      onClose();
    } catch (error) {
      console.error('Erreur lors de la modification:', error);
      alert('Erreur lors de la modification de la fiche');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-[95vw] sm:w-[650px] md:w-[750px] lg:w-[850px] max-w-[95vw] max-h-[90vh] overflow-hidden">
        {/* En-tête */}
        <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Modifier la Fiche de Calcul</h2>
            <p className="text-purple-100 text-sm">Étape {step} sur 3</p>
          </div>
          <button onClick={onClose} className="text-white hover:bg-white/10 p-2 rounded-lg">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Contenu */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {/* Étape 1: Titre */}
          {step === 1 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Informations générales</h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Titre de la fiche
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Fiche Formation Professionnelle"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Étape 2: Segments */}
          {step === 2 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">
                Sélectionner les segments ({selectedSegments.length} sélectionné{selectedSegments.length > 1 ? 's' : ''})
              </h3>
              <div className="space-y-2">
                {segments.map((segment) => (
                  <label
                    key={segment.id}
                    className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSegments.includes(segment.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSegments([...selectedSegments, segment.id]);
                        } else {
                          setSelectedSegments(selectedSegments.filter((s) => s !== segment.id));
                          // Retirer les villes de ce segment
                          const citiesToRemove = cities
                            .filter((c: City) => c.segment_id === segment.id)
                            .map((c: City) => c.id);
                          setSelectedCities(selectedCities.filter((c) => !citiesToRemove.includes(c)));
                        }
                      }}
                      className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: segment.color || '#3B82F6' }}
                    />
                    <span className="flex-1 font-medium text-gray-900">{segment.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Étape 3: Villes */}
          {step === 3 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">
                Sélectionner les villes ({selectedCities.length} sélectionnée{selectedCities.length > 1 ? 's' : ''})
              </h3>
              {selectedSegments.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Vous devez d'abord sélectionner au moins un segment
                </div>
              ) : filteredCities.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Aucune ville disponible pour les segments sélectionnés
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCities.map((city) => (
                    <label
                      key={city.id}
                      className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedCities.includes(city.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCities([...selectedCities, city.id]);
                          } else {
                            setSelectedCities(selectedCities.filter((c) => c !== city.id));
                          }
                        }}
                        className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                      />
                      <MapPin className="w-4 h-4 text-purple-600" />
                      <span className="flex-1 font-medium text-gray-900">{city.name}</span>
                      <span className="text-sm text-gray-500">
                        {segments.find((s: Segment) => s.id === city.segment_id)?.name}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Pied de page */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-between">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
            className="px-6 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg transition-colors"
          >
            {step === 1 ? 'Annuler' : 'Précédent'}
          </button>
          <button
            onClick={() => {
              if (step < 3) {
                setStep(step + 1);
              } else {
                handleUpdate();
              }
            }}
            disabled={(step === 1 && !title) || updateSheet.isPending}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updateSheet.isPending ? 'Sauvegarde...' : step === 3 ? 'Enregistrer' : 'Suivant'}
          </button>
        </div>
      </div>
    </div>
  );
}
