import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useSessionFormation } from '@/hooks/useSessionsFormation';
import { AddStudentToSessionModal } from '@/components/admin/sessions-formation/AddStudentToSessionModal';
import { EditStudentModal } from '@/components/admin/sessions-formation/EditStudentModal';
import { DiscountModal } from '@/components/admin/sessions-formation/DiscountModal';
import { PaymentManagerModal } from '@/components/admin/sessions-formation/PaymentManagerModal';
import { StudentDocumentsModal } from '@/components/admin/sessions-formation/StudentDocumentsModal';
import { SessionDocumentsDownloadModal } from '@/components/admin/sessions-formation/SessionDocumentsDownloadModal';
import { DeliveryStatusModal } from '@/components/admin/sessions-formation/DeliveryStatusModal';
import { ImageCropperModal } from '@/components/admin/students/ImageCropperModal';
import { apiClient } from '@/lib/api/client';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import {
  Calendar,
  MapPin,
  Users,
  DollarSign,
  BookOpen,
  UserCheck,
  FileText,
  ClipboardList,
  ArrowLeft,
  AlertCircle,
  MoreVertical,
  Edit,
  Receipt,
  Tag,
  Trash2,
  CheckSquare,
  Square,
  ShieldCheck,
  ShieldX,
  FileDown,
  Loader2,
  Download,
  Package,
} from 'lucide-react';

export const SessionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: session, isLoading, error, refetch } = useSessionFormation(id);
  const [activeTab, setActiveTab] = useState<'etudiants' | 'profs' | 'tests' | 'presences'>('etudiants');
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showEditStudentModal, setShowEditStudentModal] = useState(false);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [showDeliveryStatusModal, setShowDeliveryStatusModal] = useState(false);
  const [showCropModal, setShowCropModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [isChangingStatus, setIsChangingStatus] = useState(false);
  const [showBulkDocumentModal, setShowBulkDocumentModal] = useState(false);
  const [bulkTemplates, setBulkTemplates] = useState<any[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<Set<string>>(new Set());
  const [generatingBulkDocuments, setGeneratingBulkDocuments] = useState(false);
  const [bulkGenerationProgress, setBulkGenerationProgress] = useState({ current: 0, total: 0, templateName: '', templateIndex: 0, totalTemplates: 0 });
  const [showSessionDocumentsModal, setShowSessionDocumentsModal] = useState(false);

  const handleDeleteStudent = async (etudiant: any) => {
    if (!confirm(`Êtes-vous sûr de vouloir retirer ${etudiant.student_name} de cette session?`)) {
      return;
    }

    try {
      await apiClient.delete(`/sessions-formation/${id}/etudiants/${etudiant.student_id}`);
      alert('Étudiant retiré de la session avec succès');
      refetch();
    } catch (error: any) {
      console.error('Error deleting student:', error);
      alert('Erreur lors de la suppression: ' + error.message);
    }
  };

  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const toggleAllStudents = () => {
    if (!session?.etudiants) return;

    // Exclure les étudiants abandonnés de la sélection
    const validStudents = session.etudiants.filter((e: any) => e.student_status !== 'abandonne');

    if (selectedStudents.size === validStudents.length && validStudents.length > 0) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(validStudents.map((e: any) => e.student_id)));
    }
  };

  const handleBulkStatusChange = async (newStatus: 'valide' | 'abandonne') => {
    if (selectedStudents.size === 0) {
      alert('Veuillez sélectionner au moins un étudiant');
      return;
    }

    const statusLabel = newStatus === 'valide' ? 'Valide' : 'Abandonné';
    if (!confirm(`Êtes-vous sûr de vouloir changer le statut de ${selectedStudents.size} étudiant(s) en "${statusLabel}"?`)) {
      return;
    }

    setIsChangingStatus(true);
    try {
      await apiClient.put(`/sessions-formation/${id}/etudiants/bulk-status`, {
        student_ids: Array.from(selectedStudents),
        status: newStatus
      });

      alert(`Statut mis à jour avec succès pour ${selectedStudents.size} étudiant(s)`);
      setSelectedStudents(new Set());
      refetch();
    } catch (error: any) {
      console.error('Error changing status:', error);
      // Afficher un message d'erreur plus détaillé pour le cas des documents générés
      if (error.response?.data?.code === 'HAS_DOCUMENTS') {
        const studentsWithDocs = error.response.data.students_with_documents || [];
        const names = studentsWithDocs.map((s: any) => s.name).join('\n- ');
        alert(`⚠️ Impossible de mettre le statut "Abandonné"\n\nLes étudiants suivants ont des documents générés :\n- ${names}\n\nSeul un administrateur peut effectuer cette action.`);
      } else {
        alert('Erreur lors du changement de statut: ' + (error.response?.data?.error || error.message));
      }
    } finally {
      setIsChangingStatus(false);
    }
  };

  // Charger TOUS les templates pour la génération en masse (groupés par formation)
  const loadBulkTemplates = async () => {
    if (selectedStudents.size === 0) {
      alert('Veuillez sélectionner au moins un étudiant');
      return;
    }

    try {
      // Récupérer les étudiants sélectionnés (exclure les abandonnés)
      const selectedEtudiants = session?.etudiants?.filter(
        (e: any) => selectedStudents.has(e.student_id) && e.student_status !== 'abandonne'
      ) || [];

      if (selectedEtudiants.length === 0) {
        alert('Aucun étudiant valide sélectionné');
        return;
      }

      // Récupérer les formation_ids uniques avec leur nom
      const formationsMap = new Map<string, string>();
      selectedEtudiants.forEach((e: any) => {
        if (!formationsMap.has(e.formation_id)) {
          // L'API retourne formation_title (pas formation_name)
          formationsMap.set(e.formation_id, e.formation_title || e.formation_name || 'Formation inconnue');
        }
      });

      // Charger les templates pour chaque formation
      const allTemplates: any[] = [];
      const seenTemplates = new Set<string>(); // Pour éviter les doublons

      for (const [formationId, formationName] of formationsMap) {
        const studentForFormation = selectedEtudiants.find((e: any) => e.formation_id === formationId);
        if (studentForFormation) {
          const response = await apiClient.get(`/sessions-formation/${id}/etudiants/${studentForFormation.student_id}/available-documents`) as { templates: any[] };
          const templates = response.templates || [];

          // Ajouter chaque template avec les infos de formation
          templates.forEach((template: any) => {
            // Clé unique: template_id + formation_id
            const uniqueKey = `${template.template_id}_${formationId}`;
            if (!seenTemplates.has(uniqueKey)) {
              seenTemplates.add(uniqueKey);
              allTemplates.push({
                ...template,
                formation_id: formationId,
                formation_name: formationName,
                // Nombre d'étudiants concernés par ce template
                student_count: selectedEtudiants.filter((e: any) => e.formation_id === formationId).length
              });
            }
          });
        }
      }

      if (allTemplates.length === 0) {
        alert('Aucun template trouvé pour les formations sélectionnées');
        return;
      }

      // Trier par formation puis par nom de template
      allTemplates.sort((a, b) => {
        if (a.formation_name !== b.formation_name) {
          return a.formation_name.localeCompare(b.formation_name);
        }
        return a.template_name.localeCompare(b.template_name);
      });

      setBulkTemplates(allTemplates);
      setShowBulkDocumentModal(true);
    } catch (error: any) {
      console.error('Error loading bulk templates:', error);
      alert('Erreur lors du chargement des templates: ' + error.message);
    }
  };

  // Toggle template selection (utilise clé unique: template_id_formation_id)
  const toggleTemplateSelection = (uniqueKey: string) => {
    setSelectedTemplates(prev => {
      const newSet = new Set(prev);
      if (newSet.has(uniqueKey)) {
        newSet.delete(uniqueKey);
      } else {
        newSet.add(uniqueKey);
      }
      return newSet;
    });
  };

  // Générer la clé unique pour un template
  const getTemplateUniqueKey = (template: any) => `${template.template_id}_${template.formation_id}`;

  // Select/deselect all templates
  const toggleAllTemplates = () => {
    if (selectedTemplates.size === bulkTemplates.length) {
      setSelectedTemplates(new Set());
    } else {
      setSelectedTemplates(new Set(bulkTemplates.map((t: any) => getTemplateUniqueKey(t))));
    }
  };

  // Générer les documents pour TOUS les templates sélectionnés
  const handleBulkDocumentGenerationAll = async () => {
    if (selectedTemplates.size === 0) {
      alert('Veuillez sélectionner au moins un type de document');
      return;
    }

    // Filtrer les templates sélectionnés en utilisant la clé unique
    const templatesToGenerate = bulkTemplates.filter((t: any) => selectedTemplates.has(getTemplateUniqueKey(t)));
    const selectedEtudiants = session?.etudiants?.filter(
      (e: any) => selectedStudents.has(e.student_id) && e.student_status !== 'abandonne'
    ) || [];

    if (selectedEtudiants.length === 0) {
      alert('Aucun étudiant valide sélectionné');
      return;
    }

    setGeneratingBulkDocuments(true);
    let totalSaved = 0;

    try {
      for (let templateIndex = 0; templateIndex < templatesToGenerate.length; templateIndex++) {
        const template = templatesToGenerate[templateIndex];

        // Filtrer les étudiants qui appartiennent à la formation de ce template
        const etudiantsForTemplate = selectedEtudiants.filter(
          (e: any) => e.formation_id === template.formation_id
        );

        if (etudiantsForTemplate.length === 0) {
          console.log(`⏭️ Aucun étudiant pour ${template.template_name} (${template.formation_name})`);
          continue;
        }

        setBulkGenerationProgress({
          current: 0,
          total: etudiantsForTemplate.length,
          templateName: `${template.template_name} (${template.formation_name})`,
          templateIndex: templateIndex + 1,
          totalTemplates: templatesToGenerate.length
        });

        // Enregistrer chaque certificat en base de données
        for (let i = 0; i < etudiantsForTemplate.length; i++) {
          const etudiant = etudiantsForTemplate[i];
          setBulkGenerationProgress(prev => ({ ...prev, current: i + 1 }));

          try {
            const requestData = {
              student_id: etudiant.student_id,
              formation_id: etudiant.formation_id,
              session_id: id || session?.id,
              template_id: template.template_id,
              completion_date: new Date().toISOString(),
              grade: null,
              document_type: template.document_type || 'certificat',
              template_name: template.template_name,
              replace_existing: true // Permet de régénérer les documents existants
            };

            console.log(`📤 Génération document: ${template.template_name} pour ${etudiant.student_name}, formation: ${template.formation_name}`);
            const response = await apiClient.post('/certificates/generate', requestData) as { success: boolean; error?: string };

            if (response.success) {
              totalSaved++;
              console.log(`✅ Document généré: ${template.template_name} pour ${etudiant.student_name}`);
            } else {
              console.error(`❌ Échec enregistrement pour ${etudiant.student_name} (${template.template_name}):`, response.error);
            }
          } catch (error: any) {
            // Essayer d'extraire le message d'erreur du serveur
            const serverError = error.response?.data?.error || error.message;
            console.error(`❌ Erreur enregistrement pour ${etudiant.student_name} (${template.template_name}):`, serverError, error);
          }
        }
      }

      setShowBulkDocumentModal(false);
      setSelectedTemplates(new Set());
      alert(`${totalSaved} document(s) généré(s) avec succès!`);

      // Rafraîchir la page pour voir les nouveaux documents
      window.location.reload();
    } catch (error: any) {
      console.error('Error generating bulk documents:', error);
      alert('Erreur lors de la génération: ' + error.message);
    } finally {
      setGeneratingBulkDocuments(false);
      setBulkGenerationProgress({ current: 0, total: 0, templateName: '', templateIndex: 0, totalTemplates: 0 });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Chargement...</div>
        </div>
      </AppLayout>
    );
  }

  if (error || !session) {
    return (
      <AppLayout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-800">
            <AlertCircle className="h-5 w-5" />
            <span>Erreur lors du chargement de la session</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  const stats = session.statistiques;
  const totalPaye = Number(parseFloat(stats?.total_paye?.toString() || '0')) || 0;
  const totalImpaye = Number(parseFloat(stats?.total_impaye?.toString() || '0')) || 0;
  const totalPartiellement = Number(parseFloat(stats?.total_partiellement_paye?.toString() || '0')) || 0;

  // Helper pour construire l'URL complète des images
  const getImageUrl = (relativeUrl: string | null | undefined): string => {
    if (!relativeUrl) return '';
    if (relativeUrl.startsWith('http')) return relativeUrl;
    // Use relative path directly - works in both dev (Vite proxy) and production (same domain)
    return relativeUrl;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <button
              onClick={() => navigate('/admin/sessions-formation')}
              className="mt-1 p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                {session.titre}
                <span
                  className={`px-3 py-1 text-xs font-semibold rounded-full ${
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
              </h1>

              <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                {session.date_debut && (
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {new Date(session.date_debut).toLocaleDateString('fr-FR')}
                    {session.date_fin && ` - ${new Date(session.date_fin).toLocaleDateString('fr-FR')}`}
                  </div>
                )}
                {session.ville_name && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {session.ville_name}
                  </div>
                )}
                {session.segment_name && (
                  <span
                    className="px-2 py-1 rounded text-xs font-medium"
                    style={{
                      backgroundColor: session.segment_color ? session.segment_color + '20' : '#e5e7eb',
                      color: session.segment_color || '#6b7280'
                    }}
                  >
                    {session.segment_name}
                  </span>
                )}
                {session.corps_formation_name && (
                  <div className="flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    {session.corps_formation_name}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-blue-600 font-medium">Étudiants</div>
                <div className="text-2xl font-bold text-blue-900 mt-1">{session.nombre_etudiants || 0}</div>
              </div>
              <Users className="h-8 w-8 text-blue-600 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-purple-600 font-medium">Professeurs</div>
                <div className="text-2xl font-bold text-purple-900 mt-1">{session.nombre_professeurs || 0}</div>
              </div>
              <UserCheck className="h-8 w-8 text-purple-600 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-green-600 font-medium">Total Payé</div>
                <div className="text-2xl font-bold text-green-900 mt-1">
                  {totalPaye.toFixed(2)} DH
                </div>
              </div>
              <DollarSign className="h-8 w-8 text-green-600 opacity-50" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-red-600 font-medium">Total Dû</div>
                <div className="text-2xl font-bold text-red-900 mt-1">
                  {totalImpaye.toFixed(2)} DH
                </div>
              </div>
              <DollarSign className="h-8 w-8 text-red-600 opacity-50" />
            </div>
          </div>
        </div>

        {/* Payment Statistics Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistiques de Paiement</h3>
          <div className="h-64">
            {session.etudiants && session.etudiants.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Payé', value: totalPaye, count: session.etudiants.filter((e: any) => e.statut_paiement === 'paye').length },
                      { name: 'Partiellement', value: totalPartiellement, count: session.etudiants.filter((e: any) => e.statut_paiement === 'partiellement_paye').length },
                      { name: 'Impayé', value: totalImpaye, count: session.etudiants.filter((e: any) => e.statut_paiement === 'impaye').length },
                    ].filter(item => item.value > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(props: any) => `${props.name} ${(props.percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    <Cell key="cell-0" fill="#22c55e" />
                    <Cell key="cell-1" fill="#eab308" />
                    <Cell key="cell-2" fill="#ef4444" />
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string, props: any) => [
                      `${value.toFixed(2)} DH (${props.payload.count} étudiants)`,
                      name
                    ]}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    formatter={(value, entry: any) => (
                      <span className="text-sm text-gray-600">
                        {value}: {entry.payload.value.toFixed(2)} DH ({entry.payload.count} étudiants)
                      </span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full bg-gray-50 rounded-lg">
                <div className="text-center">
                  <DollarSign className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500">Aucun étudiant inscrit</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveTab('etudiants')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'etudiants'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Users className="h-4 w-4" />
                Étudiants
              </button>
              <button
                onClick={() => setActiveTab('profs')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'profs'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <UserCheck className="h-4 w-4" />
                Profs
              </button>
              <button
                onClick={() => setActiveTab('tests')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'tests'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <FileText className="h-4 w-4" />
                Fichier Tests
              </button>
              <button
                onClick={() => setActiveTab('presences')}
                className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'presences'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <ClipboardList className="h-4 w-4" />
                Fiche de présences
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'etudiants' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Liste des étudiants ({session.etudiants?.length || 0})
                    </h3>
                    {/* Légende des couleurs */}
                    <div className="flex items-center gap-4 mt-2 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded bg-green-200 border border-green-400"></span>
                        <span className="text-gray-600">Documents générés</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded bg-yellow-200 border border-yellow-400"></span>
                        <span className="text-gray-600">Documents non générés</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded bg-red-200 border border-red-400"></span>
                        <span className="text-gray-600">Abandonné</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowAddStudentModal(true)}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Ajouter un étudiant
                    </button>
                    <button
                      onClick={() => setShowSessionDocumentsModal(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Download className="h-4 w-4" />
                      Télécharger Documents
                    </button>
                  </div>
                </div>

                {session.etudiants && session.etudiants.length > 0 ? (
                  <div>
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            <button
                              onClick={toggleAllStudents}
                              className="p-1 hover:bg-gray-200 rounded transition-colors"
                              title={selectedStudents.size === session.etudiants.length ? "Désélectionner tout" : "Sélectionner tout"}
                            >
                              {selectedStudents.size === session.etudiants.length ? (
                                <CheckSquare className="h-5 w-5 text-blue-600" />
                              ) : (
                                <Square className="h-5 w-5 text-gray-400" />
                              )}
                            </button>
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Photo
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Nom
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Date d'insertion
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Statut
                          </th>
                          {session.session_type === 'en_ligne' && (
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                              Statut de livraison
                            </th>
                          )}
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Formation
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Prix Formation
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Remise
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            CIN
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Téléphone
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Statut Paiement
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Montant Payé
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Reste à Payer
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {session.etudiants.map((etudiant) => {
                          const initials = etudiant.student_name
                            ?.split(' ')
                            .map(n => n[0])
                            .join('')
                            .toUpperCase() || '??';

                          // Déterminer la couleur de la ligne selon le statut
                          // 🔴 Rouge: abandonné | 🟢 Vert: documents livrés/générés | 🟡 Jaune: par défaut
                          const getRowColorClass = () => {
                            // Rouge : étudiant abandonné
                            if (etudiant.student_status === 'abandonne') {
                              return 'bg-red-200 hover:bg-red-300';
                            }
                            // Vert : documents livrés (pour sessions en ligne)
                            if (session.session_type === 'en_ligne' && etudiant.delivery_status === 'livree') {
                              return 'bg-green-200 hover:bg-green-300';
                            }
                            // Vert : documents générés (pour sessions présentielles)
                            if (session.session_type === 'presentielle' && etudiant.has_documents) {
                              return 'bg-green-200 hover:bg-green-300';
                            }
                            // Jaune : par défaut (documents non livrés/générés)
                            return 'bg-yellow-200 hover:bg-yellow-300';
                          };

                          return (
                            <tr key={etudiant.id} className={getRowColorClass()}>
                              {/* Checkbox */}
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => toggleStudentSelection(etudiant.student_id)}
                                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                                >
                                  {selectedStudents.has(etudiant.student_id) ? (
                                    <CheckSquare className="h-5 w-5 text-blue-600" />
                                  ) : (
                                    <Square className="h-5 w-5 text-gray-400" />
                                  )}
                                </button>
                              </td>

                              {/* Photo */}
                              <td className="px-4 py-3">
                                {(() => {
                                  const hasImageError = imageErrors.has(etudiant.id);
                                  const shouldShowImage = etudiant.profile_image_url && !hasImageError;

                                  return shouldShowImage ? (
                                    <img
                                      src={getImageUrl(etudiant.profile_image_url)}
                                      alt={etudiant.student_name}
                                      className="w-[60px] h-20 rounded-lg object-cover border-3 border-gray-300 shadow-sm cursor-pointer hover:border-blue-500 transition-all"
                                      onClick={() => {
                                        setSelectedStudent(etudiant);
                                        setShowCropModal(true);
                                      }}
                                      onError={() => {
                                        setImageErrors(prev => new Set(prev).add(etudiant.id));
                                      }}
                                    />
                                  ) : (
                                    <div
                                      className="w-[60px] h-20 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-semibold text-xl border-3 border-blue-300 shadow-sm cursor-pointer hover:border-blue-500 transition-all"
                                      onClick={() => {
                                        setSelectedStudent(etudiant);
                                        setShowCropModal(true);
                                      }}
                                    >
                                      {initials}
                                    </div>
                                  );
                                })()}
                              </td>

                              <td className="px-4 py-3 text-sm text-gray-900">{etudiant.student_name}</td>

                              {/* Date d'insertion */}
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {etudiant.date_inscription
                                  ? new Date(etudiant.date_inscription).toLocaleDateString('fr-FR')
                                  : '-'}
                              </td>

                              {/* Statut étudiant */}
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                                    etudiant.student_status === 'abandonne'
                                      ? 'bg-red-100 text-red-800'
                                      : etudiant.has_documents && (session.session_type === 'presentielle' || session.session_type === 'en_ligne')
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-green-100 text-green-800'
                                  }`}
                                >
                                  {etudiant.student_status === 'abandonne' ? (
                                    <>
                                      <ShieldX className="h-3 w-3" />
                                      Abandonné
                                    </>
                                  ) : etudiant.has_documents && (session.session_type === 'presentielle' || session.session_type === 'en_ligne') ? (
                                    <>
                                      <FileText className="h-3 w-3" />
                                      Imprimé
                                    </>
                                  ) : (
                                    <>
                                      <ShieldCheck className="h-3 w-3" />
                                      Valide
                                    </>
                                  )}
                                </span>
                              </td>

                              {/* Statut de livraison - seulement pour sessions en ligne */}
                              {session.session_type === 'en_ligne' && (
                                <td className="px-4 py-3">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                                      etudiant.delivery_status === 'livree'
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                    }`}
                                  >
                                    {etudiant.delivery_status === 'livree' ? (
                                      <>
                                        <Package className="h-3 w-3" />
                                        Livrée
                                      </>
                                    ) : (
                                      <>
                                        <Package className="h-3 w-3" />
                                        Non livrée
                                      </>
                                    )}
                                  </span>
                                </td>
                              )}

                              <td className="px-4 py-3 text-sm text-blue-600 font-medium">{etudiant.formation_title || '-'}</td>

                              {/* Prix Formation */}
                              <td className="px-4 py-3 text-sm">
                                {etudiant.formation_original_price && parseFloat(etudiant.formation_original_price.toString()) > 0 ? (
                                  <div>
                                    <div className="font-semibold text-gray-900">
                                      {parseFloat(etudiant.formation_original_price.toString()).toFixed(2)} DH
                                    </div>
                                    {etudiant.discount_percentage && parseFloat(etudiant.discount_percentage.toString()) > 0 && (
                                      <div className="text-xs text-green-600 mt-0.5">
                                        Après remise: {parseFloat(etudiant.montant_total?.toString() || '0').toFixed(2)} DH
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="font-semibold text-indigo-600">
                                    {parseFloat(etudiant.montant_total?.toString() || '0').toFixed(2)} DH
                                  </div>
                                )}
                              </td>

                              {/* Remise */}
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  {etudiant.discount_percentage && parseFloat(etudiant.discount_percentage.toString()) > 0 ? (
                                    <button
                                      onClick={() => {
                                        setSelectedStudent(etudiant);
                                        setShowDiscountModal(true);
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200 transition-colors"
                                    >
                                      <span>{parseFloat(etudiant.discount_percentage.toString()).toFixed(1)}%</span>
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        setSelectedStudent(etudiant);
                                        setShowDiscountModal(true);
                                      }}
                                      className="text-xs text-gray-400 hover:text-purple-600 hover:underline"
                                    >
                                      Ajouter
                                    </button>
                                  )}
                                </div>
                              </td>

                              <td className="px-4 py-3 text-sm text-gray-600">{etudiant.student_cin}</td>
                              <td className="px-4 py-3 text-sm text-gray-600">{etudiant.student_phone}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                                    etudiant.statut_paiement === 'paye'
                                      ? 'bg-green-100 text-green-800'
                                      : etudiant.statut_paiement === 'partiellement_paye'
                                      ? 'bg-yellow-100 text-yellow-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {etudiant.statut_paiement === 'paye' && 'Payé'}
                                  {etudiant.statut_paiement === 'partiellement_paye' && 'Partiellement'}
                                  {etudiant.statut_paiement === 'impaye' && 'Impayé'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {parseFloat(etudiant.montant_paye?.toString() || '0').toFixed(2)} DH
                              </td>

                              {/* Reste à Payer */}
                              <td className="px-4 py-3">
                                <span
                                  className={`text-sm font-semibold ${
                                    parseFloat(etudiant.montant_du?.toString() || '0') === 0
                                      ? 'text-green-600'
                                      : parseFloat(etudiant.montant_du?.toString() || '0') === parseFloat(etudiant.montant_total?.toString() || '0')
                                      ? 'text-red-600'
                                      : 'text-orange-600'
                                  }`}
                                >
                                  {parseFloat(etudiant.montant_du?.toString() || '0').toFixed(2)} DH
                                </span>
                              </td>

                              {/* Actions */}
                              <td className="px-4 py-3 relative">
                                <button
                                  onClick={() => setOpenMenuId(openMenuId === etudiant.id ? null : etudiant.id)}
                                  className="p-1 hover:bg-gray-100 rounded transition-colors"
                                >
                                  <MoreVertical className="h-5 w-5 text-gray-600" />
                                </button>

                                {openMenuId === etudiant.id && (
                                  <>
                                    <div
                                      className="fixed inset-0 z-10"
                                      onClick={() => {
                                        setOpenMenuId(null);
                                      }}
                                    />
                                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                                      <button
                                        onClick={() => {
                                          setSelectedStudent(etudiant);
                                          setShowEditStudentModal(true);
                                          setOpenMenuId(null);
                                        }}
                                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                      >
                                        <Edit className="h-4 w-4" />
                                        Modifier
                                      </button>

                                      <button
                                        onClick={() => {
                                          setSelectedStudent(etudiant);
                                          setShowDiscountModal(true);
                                          setOpenMenuId(null);
                                        }}
                                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                      >
                                        <Tag className="h-4 w-4" />
                                        Remise
                                      </button>

                                      <button
                                        onClick={() => {
                                          setSelectedStudent(etudiant);
                                          setShowPaymentModal(true);
                                          setOpenMenuId(null);
                                        }}
                                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                      >
                                        <Receipt className="h-4 w-4" />
                                        Paiements
                                      </button>

                                      <button
                                        onClick={() => {
                                          setSelectedStudent(etudiant);
                                          setShowDocumentsModal(true);
                                          setOpenMenuId(null);
                                        }}
                                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                      >
                                        <FileText className="h-4 w-4" />
                                        Voir les documents
                                      </button>

                                      {session.session_type === 'en_ligne' && (
                                        <button
                                          onClick={() => {
                                            setSelectedStudent(etudiant);
                                            setShowDeliveryStatusModal(true);
                                            setOpenMenuId(null);
                                          }}
                                          className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                                        >
                                          <Package className="h-4 w-4" />
                                          Statut de livraison
                                        </button>
                                      )}

                                      <div className="border-t border-gray-200 my-1" />

                                      <button
                                        onClick={() => {
                                          handleDeleteStudent(etudiant);
                                          setOpenMenuId(null);
                                        }}
                                        className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        Supprimer
                                      </button>
                                    </div>
                                  </>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>

                    {/* Barre d'action flottante pour sélection multiple */}
                    {selectedStudents.size > 0 && (
                      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-xl border border-gray-200 p-4 flex items-center gap-4 z-50">
                        <div className="text-sm font-medium text-gray-700">
                          {selectedStudents.size} étudiant(s) sélectionné(s)
                        </div>
                        <div className="h-6 w-px bg-gray-300" />
                        <button
                          onClick={() => handleBulkStatusChange('valide')}
                          disabled={isChangingStatus}
                          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ShieldCheck className="h-4 w-4" />
                          Valider
                        </button>
                        <button
                          onClick={() => handleBulkStatusChange('abandonne')}
                          disabled={isChangingStatus}
                          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <ShieldX className="h-4 w-4" />
                          Abandonner
                        </button>
                        <div className="h-6 w-px bg-gray-300" />
                        <button
                          onClick={loadBulkTemplates}
                          disabled={isChangingStatus || generatingBulkDocuments}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <FileDown className="h-4 w-4" />
                          Générer Documents
                        </button>
                        <button
                          onClick={() => setSelectedStudents(new Set())}
                          className="px-3 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                        >
                          Annuler
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">Aucun étudiant inscrit</div>
                )}
              </div>
            )}

            {activeTab === 'profs' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Liste des professeurs ({session.professeurs?.length || 0})
                  </h3>
                  <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors">
                    Affecter un professeur
                  </button>
                </div>

                {session.professeurs && session.professeurs.length > 0 ? (
                  <div className="space-y-2">
                    {session.professeurs.map((prof) => (
                      <div
                        key={prof.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <div className="font-medium text-gray-900">{prof.professeur_name}</div>
                          <div className="text-sm text-gray-600">{prof.professeur_email}</div>
                        </div>
                        <button className="text-red-600 hover:text-red-800 transition-colors">
                          Retirer
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">Aucun professeur affecté</div>
                )}
              </div>
            )}

            {activeTab === 'tests' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Liste des tests</h3>
                  <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                    Ajouter un fichier de test
                  </button>
                </div>

                {session.fichiers?.filter((f) => f.type === 'test').length ? (
                  <div className="space-y-2">
                    {session.fichiers
                      .filter((f) => f.type === 'test')
                      .map((fichier) => (
                        <div key={fichier.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-gray-400" />
                            <div>
                              <div className="font-medium text-gray-900">{fichier.titre}</div>
                              {fichier.file_name && (
                                <div className="text-sm text-gray-600">{fichier.file_name}</div>
                              )}
                            </div>
                          </div>
                          <button className="text-red-600 hover:text-red-800 transition-colors">
                            Supprimer
                          </button>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">Aucun fichier de test</div>
                )}
              </div>
            )}

            {activeTab === 'presences' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Liste des fiches de présences</h3>
                  <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
                    Ajouter une fiche de présence
                  </button>
                </div>

                {session.fichiers?.filter((f) => f.type === 'presence').length ? (
                  <div className="space-y-2">
                    {session.fichiers
                      .filter((f) => f.type === 'presence')
                      .map((fichier) => (
                        <div key={fichier.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <ClipboardList className="h-5 w-5 text-gray-400" />
                            <div>
                              <div className="font-medium text-gray-900">{fichier.titre}</div>
                              {fichier.file_name && (
                                <div className="text-sm text-gray-600">{fichier.file_name}</div>
                              )}
                            </div>
                          </div>
                          <button className="text-red-600 hover:text-red-800 transition-colors">
                            Supprimer
                          </button>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">Aucune fiche de présence</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Student Modal */}
      {showAddStudentModal && session?.corps_formation_id && (
        <AddStudentToSessionModal
          sessionId={session.id}
          corpsFormationId={session.corps_formation_id}
          onClose={() => setShowAddStudentModal(false)}
          onSuccess={() => {
            refetch();
            setShowAddStudentModal(false);
          }}
        />
      )}

      {/* Edit Student Modal */}
      {showEditStudentModal && selectedStudent && session && (
        <EditStudentModal
          student={selectedStudent}
          sessionId={session.id}
          corpsFormationId={session.corps_formation_id}
          onClose={() => {
            setShowEditStudentModal(false);
            setSelectedStudent(null);
          }}
          onSuccess={() => {
            refetch();
            setShowEditStudentModal(false);
            setSelectedStudent(null);
          }}
        />
      )}

      {/* Discount Modal */}
      {showDiscountModal && selectedStudent && session && (
        <DiscountModal
          student={selectedStudent}
          sessionId={session.id}
          onClose={() => {
            setShowDiscountModal(false);
            setSelectedStudent(null);
          }}
          onSuccess={() => {
            refetch();
            setShowDiscountModal(false);
            setSelectedStudent(null);
          }}
        />
      )}

      {/* Image Cropper Modal */}
      {showCropModal && selectedStudent && (
        <ImageCropperModal
          student={selectedStudent}
          onClose={() => {
            setShowCropModal(false);
            setSelectedStudent(null);
          }}
          onSuccess={() => {
            refetch();
            setShowCropModal(false);
            setSelectedStudent(null);
            setImageErrors(new Set()); // Reset image errors after successful upload
          }}
        />
      )}

      {/* Payment Manager Modal */}
      {showPaymentModal && selectedStudent && session && (
        <PaymentManagerModal
          student={selectedStudent}
          sessionId={session.id}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedStudent(null);
          }}
          onSuccess={() => {
            refetch();
            setShowPaymentModal(false);
            setSelectedStudent(null);
          }}
        />
      )}

      {/* Student Documents Modal */}
      {showDocumentsModal && selectedStudent && session && (
        <StudentDocumentsModal
          sessionId={session.id}
          studentId={selectedStudent.student_id}
          studentName={selectedStudent.student_name || `${selectedStudent.student_first_name || ''} ${selectedStudent.student_last_name || ''}`.trim() || 'Étudiant'}
          onClose={() => {
            setShowDocumentsModal(false);
            setSelectedStudent(null);
          }}
        />
      )}

      {/* Delivery Status Modal */}
      {showDeliveryStatusModal && selectedStudent && session && (
        <DeliveryStatusModal
          student={selectedStudent}
          sessionId={session.id}
          onClose={() => {
            setShowDeliveryStatusModal(false);
            setSelectedStudent(null);
          }}
          onSuccess={() => {
            refetch();
            setShowDeliveryStatusModal(false);
            setSelectedStudent(null);
          }}
        />
      )}

      {/* Modal de génération de documents en masse */}
      {showBulkDocumentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Générer Documents en Masse
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {selectedStudents.size} étudiant(s) sélectionné(s) - Sélectionnez les types de documents
              </p>
            </div>

            {generatingBulkDocuments ? (
              <div className="p-6">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
                  <p className="text-sm font-medium text-gray-900">
                    Génération en cours...
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Document {bulkGenerationProgress.templateIndex}/{bulkGenerationProgress.totalTemplates}: {bulkGenerationProgress.templateName}
                  </p>
                  <div className="mt-4 bg-gray-200 rounded-full h-2.5">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                      style={{
                        width: `${(bulkGenerationProgress.current / bulkGenerationProgress.total) * 100}%`
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    {bulkGenerationProgress.current} / {bulkGenerationProgress.total} étudiants
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-3">
                {bulkTemplates.length === 0 ? (
                  <p className="text-sm text-gray-500 italic">
                    Aucun template disponible
                  </p>
                ) : (
                  <>
                    {/* Bouton Tout sélectionner */}
                    <div className="flex items-center justify-between pb-3 border-b border-gray-200">
                      <button
                        onClick={toggleAllTemplates}
                        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        <input
                          type="checkbox"
                          checked={selectedTemplates.size === bulkTemplates.length}
                          onChange={toggleAllTemplates}
                          className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        {selectedTemplates.size === bulkTemplates.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                      </button>
                      <span className="text-sm text-gray-500">
                        {selectedTemplates.size} / {bulkTemplates.length} sélectionné(s)
                      </span>
                    </div>

                    {/* Liste des templates groupés par formation */}
                    <div className="max-h-96 overflow-y-auto space-y-4">
                      {/* Grouper par formation */}
                      {(() => {
                        const formationGroups: Record<string, any[]> = {};
                        bulkTemplates.forEach((t: any) => {
                          const key = t.formation_name || 'Autre';
                          if (!formationGroups[key]) formationGroups[key] = [];
                          formationGroups[key].push(t);
                        });

                        return Object.entries(formationGroups).map(([formationName, templates]) => (
                          <div key={formationName} className="space-y-2">
                            {/* En-tête de formation */}
                            <div className="sticky top-0 bg-gray-100 px-3 py-2 rounded-lg flex items-center justify-between">
                              <span className="text-sm font-semibold text-gray-700">
                                📚 {formationName}
                              </span>
                              <span className="text-xs text-gray-500">
                                {templates[0]?.student_count || 0} étudiant(s)
                              </span>
                            </div>

                            {/* Templates de cette formation */}
                            {templates.map((template: any) => {
                              const uniqueKey = getTemplateUniqueKey(template);
                              return (
                                <label
                                  key={uniqueKey}
                                  className={`w-full p-4 border rounded-lg cursor-pointer transition-colors flex items-center gap-3 ${
                                    selectedTemplates.has(uniqueKey)
                                      ? 'border-blue-500 bg-blue-50'
                                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedTemplates.has(uniqueKey)}
                                    onChange={() => toggleTemplateSelection(uniqueKey)}
                                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <div className="flex-1">
                                    <p className="font-medium text-gray-900">
                                      {template.template_name}
                                    </p>
                                    <p className="text-sm text-gray-600">
                                      {template.document_type}
                                    </p>
                                  </div>
                                  <FileDown className={`h-5 w-5 ${selectedTemplates.has(uniqueKey) ? 'text-blue-600' : 'text-gray-400'}`} />
                                </label>
                              );
                            })}
                          </div>
                        ));
                      })()}
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="p-6 border-t border-gray-200 flex justify-between items-center">
              <p className="text-sm text-gray-600">
                {selectedTemplates.size > 0 && !generatingBulkDocuments && (
                  <>
                    <span className="font-medium text-blue-600">
                      {/* Calculer le nombre exact de documents à générer */}
                      {bulkTemplates
                        .filter((t: any) => selectedTemplates.has(getTemplateUniqueKey(t)))
                        .reduce((sum: number, t: any) => sum + (t.student_count || 0), 0)}
                    </span> document(s) seront générés
                  </>
                )}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowBulkDocumentModal(false);
                    setSelectedTemplates(new Set());
                  }}
                  disabled={generatingBulkDocuments}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900 disabled:opacity-50"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleBulkDocumentGenerationAll}
                  disabled={generatingBulkDocuments || selectedTemplates.size === 0}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <FileDown className="h-4 w-4" />
                  Générer {selectedTemplates.size > 0 ? `(${selectedTemplates.size})` : ''}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal téléchargement documents session */}
      {showSessionDocumentsModal && session && (
        <SessionDocumentsDownloadModal
          sessionId={session.id}
          sessionTitle={session.titre}
          onClose={() => setShowSessionDocumentsModal(false)}
        />
      )}
    </AppLayout>
  );
};
