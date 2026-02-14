import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { usePermission } from '@/hooks/usePermission';
import { PERMISSIONS } from '@/config/permissions';
import {
  X,
  FileText,
  AlertTriangle,
  Plus,
  Download,
  Trash2,
  Search,
  Loader2,
  CheckCircle,
  Clock,
  Package,
} from 'lucide-react';
import { WorkCertificateFormModal } from './WorkCertificateFormModal';

interface DocumentsManagementProps {
  onClose: () => void;
}

interface WorkCertificate {
  id: string;
  certificate_number: string;
  certificate_type: string;
  purpose: string;
  issue_date: string;
  status: string;
  pdf_url: string;
  first_name: string;
  last_name: string;
  employee_number: string;
  position: string;
  segment_name: string;
  created_by_name: string;
  created_at: string;
}

interface DisciplinaryAction {
  id: string;
  action_type: string;
  severity: string;
  issue_date: string;
  reason: string;
  description: string;
  first_name: string;
  last_name: string;
  employee_number: string;
}

const certificateTypeLabels: Record<string, string> = {
  standard: 'Standard',
  with_salary: 'Avec salaire',
  end_of_contract: 'Fin de contrat',
  custom: 'Personnalisée',
};

const statusLabels: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Brouillon', color: 'text-gray-600 bg-gray-100', icon: Clock },
  generated: { label: 'Générée', color: 'text-blue-600 bg-blue-100', icon: FileText },
  delivered: { label: 'Livrée', color: 'text-green-600 bg-green-100', icon: CheckCircle },
};

const actionTypeLabels: Record<string, string> = {
  verbal_warning: 'Avertissement verbal',
  written_warning: 'Avertissement écrit',
  blame: 'Blâme',
  suspension: 'Mise à pied',
  demotion: 'Rétrogradation',
  dismissal: 'Licenciement',
  other: 'Autre',
};

const severityColors: Record<string, string> = {
  low: 'text-yellow-700 bg-yellow-100',
  medium: 'text-orange-700 bg-orange-100',
  high: 'text-red-700 bg-red-100',
  critical: 'text-red-900 bg-red-200',
};

export function DocumentsManagement({ onClose }: DocumentsManagementProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'attestations' | 'disciplinary'>('attestations');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Permissions
  const { can } = usePermission();
  const canViewAttestations = can(PERMISSIONS.ressources_humaines.gestion_paie.attestations.voir);
  const canCreateAttestations = can(PERMISSIONS.ressources_humaines.gestion_paie.attestations.creer);
  const canDeleteAttestations = can(PERMISSIONS.ressources_humaines.gestion_paie.attestations.supprimer);
  const canDownloadAttestations = can(PERMISSIONS.ressources_humaines.gestion_paie.attestations.telecharger);
  const canViewDisciplinary = can(PERMISSIONS.ressources_humaines.gestion_paie.disciplinaire_vue.voir);

  // Fetch work certificates
  const { data: certificatesData, isLoading: loadingCertificates } = useQuery({
    queryKey: ['hr-certificates', searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      const url = `/hr/certificates${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await apiClient.get<{ success: boolean; data: WorkCertificate[] }>(url);
      return response.data;
    },
    enabled: canViewAttestations && activeTab === 'attestations',
  });

  // Fetch disciplinary actions
  const { data: disciplinaryData, isLoading: loadingDisciplinary } = useQuery({
    queryKey: ['hr-all-disciplinary', searchTerm],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: DisciplinaryAction[] }>('/hr/employees/all-disciplinary');
      return response.data;
    },
    enabled: canViewDisciplinary && activeTab === 'disciplinary',
  });

  // Delete certificate mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/hr/certificates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-certificates'] });
    },
  });

  // Download PDF
  const handleDownloadPdf = async (id: string, certificateNumber: string) => {
    try {
      const response = await fetch(`/api/hr/certificates/${id}/pdf`, {
        headers: {
          'Authorization': `Bearer ${sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token')}`,
        },
      });

      if (!response.ok) throw new Error('Erreur lors du téléchargement');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Attestation_${certificateNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download error:', error);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer cette attestation ?')) {
      deleteMutation.mutate(id);
    }
  };

  const certificates = certificatesData || [];
  const disciplinaryActions = (disciplinaryData || []).filter(
    (d) =>
      !searchTerm ||
      d.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.employee_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('fr-FR');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm">
              <Package className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Documents RH</h2>
              <p className="text-sm text-gray-500">Attestations de travail et actions disciplinaires</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b">
          {canViewAttestations && (
            <button
              onClick={() => setActiveTab('attestations')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'attestations'
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <FileText className="w-4 h-4" />
              Attestations de travail
            </button>
          )}
          {canViewDisciplinary && (
            <button
              onClick={() => setActiveTab('disciplinary')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === 'disciplinary'
                  ? 'text-red-600 border-b-2 border-red-600 bg-red-50/50'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              Actions disciplinaires
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col p-4">
          {/* Search and Actions */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher par nom, matricule..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {activeTab === 'attestations' && canCreateAttestations && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nouvelle attestation
              </button>
            )}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-auto">
            {activeTab === 'attestations' && (
              <>
                {loadingCertificates ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  </div>
                ) : certificates.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Aucune attestation trouvée</p>
                    {canCreateAttestations && (
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="mt-4 text-blue-600 hover:text-blue-800"
                      >
                        Créer une attestation
                      </button>
                    )}
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">N°</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employé</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Statut</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {certificates.map((cert) => {
                        const status = statusLabels[cert.status] || statusLabels.draft;
                        const StatusIcon = status.icon;
                        return (
                          <tr key={cert.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {cert.certificate_number}
                            </td>
                            <td className="px-4 py-3">
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {cert.last_name} {cert.first_name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {cert.employee_number} - {cert.position || 'N/A'}
                                </p>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {certificateTypeLabels[cert.certificate_type] || cert.certificate_type}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600">
                              {formatDate(cert.issue_date)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${status.color}`}>
                                <StatusIcon className="w-3 h-3" />
                                {status.label}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2">
                                {canDownloadAttestations && (
                                  <button
                                    onClick={() => handleDownloadPdf(cert.id, cert.certificate_number)}
                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Télécharger PDF"
                                  >
                                    <Download className="w-4 h-4" />
                                  </button>
                                )}
                                {canDeleteAttestations && (
                                  <button
                                    onClick={() => handleDelete(cert.id)}
                                    disabled={deleteMutation.isPending}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                    title="Supprimer"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </>
            )}

            {activeTab === 'disciplinary' && (
              <>
                {loadingDisciplinary ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-red-600" />
                  </div>
                ) : disciplinaryActions.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Aucune action disciplinaire trouvée</p>
                  </div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employé</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Gravité</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Motif</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {disciplinaryActions.map((action) => (
                        <tr key={action.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {action.last_name} {action.first_name}
                              </p>
                              <p className="text-xs text-gray-500">{action.employee_number}</p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {actionTypeLabels[action.action_type] || action.action_type}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${severityColors[action.severity] || 'text-gray-600 bg-gray-100'}`}>
                              {action.severity === 'low' ? 'Faible' :
                               action.severity === 'medium' ? 'Moyen' :
                               action.severity === 'high' ? 'Élevé' :
                               action.severity === 'critical' ? 'Critique' : action.severity}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            {formatDate(action.issue_date)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">
                            {action.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <WorkCertificateFormModal
            onClose={() => setShowCreateModal(false)}
          />
        )}
      </div>
    </div>
  );
}
