import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  Search,
  Plus,
  Edit,
  Trash2,
  FileText,
  Briefcase,
  AlertTriangle,
  Download,
  Loader2,
  Eye,
  AlertCircle,
  CheckCircle,
  Clock,
  UserCheck,
  Calendar,
  PauseCircle,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import EmployeeFormModal from '@/components/admin/hr/EmployeeFormModal';
import { DocumentUploadModal } from '@/components/admin/hr/DocumentUploadModal';
import { ContractFormModal } from '@/components/admin/hr/ContractFormModal';
import { DisciplinaryFormModal } from '@/components/admin/hr/DisciplinaryFormModal';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface Employee {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  cin: string;
  email: string;
  phone: string;
  position: string;
  department: string;
  employment_status: string;
  hire_date: string;
  segment_name: string;
  requires_clocking: boolean;
  photo_url?: string;
}

interface Contract {
  id: string;
  employee_id: string;
  employee_name: string;
  contract_type: 'cdi' | 'cdd' | 'stage' | 'interim';
  start_date: string;
  end_date?: string;
  trial_end_date?: string;
  base_salary: number;
  position: string;
  department: string;
  status: 'active' | 'expired' | 'terminated';
  created_at: string;
}

interface EmployeeDocument {
  id: string;
  employee_id: string;
  employee_name: string;
  document_type: 'cin' | 'diploma' | 'certificate' | 'medical' | 'rib' | 'other';
  document_name: string;
  file_path: string;
  expiry_date?: string;
  is_verified: boolean;
  verified_by?: string;
  verified_at?: string;
  uploaded_at: string;
}

interface DisciplinaryAction {
  id: string;
  employee_id: string;
  employee_name: string;
  action_type: 'warning_verbal' | 'warning_written' | 'blame' | 'suspension' | 'demotion' | 'termination';
  incident_date: string;
  description: string;
  decision: string;
  decision_date: string;
  appeal_deadline?: string;
  appeal_status?: 'none' | 'pending' | 'accepted' | 'rejected';
  attachments?: string[];
  created_by_name: string;
  created_at: string;
}

const CONTRACT_TYPES = {
  cdi: { label: 'CDI', className: 'bg-green-100 text-green-800' },
  cdd: { label: 'CDD', className: 'bg-blue-100 text-blue-800' },
  stage: { label: 'Stage', className: 'bg-purple-100 text-purple-800' },
  interim: { label: 'Intérim', className: 'bg-orange-100 text-orange-800' },
};

const DOCUMENT_TYPES = {
  cin: 'Carte d\'Identité Nationale',
  diploma: 'Diplôme',
  certificate: 'Certificat',
  medical: 'Certificat Médical',
  rib: 'RIB Bancaire',
  other: 'Autre',
};

const DISCIPLINARY_TYPES = {
  warning_verbal: { label: 'Avertissement verbal', severity: 1, className: 'bg-yellow-100 text-yellow-800' },
  warning_written: { label: 'Avertissement écrit', severity: 2, className: 'bg-orange-100 text-orange-800' },
  blame: { label: 'Blâme', severity: 3, className: 'bg-orange-200 text-orange-900' },
  suspension: { label: 'Mise à pied', severity: 4, className: 'bg-red-100 text-red-800' },
  demotion: { label: 'Rétrogradation', severity: 5, className: 'bg-red-200 text-red-900' },
  termination: { label: 'Licenciement', severity: 6, className: 'bg-red-600 text-white' },
};

export default function HREmployees() {
  const { hr } = usePermission();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'list' | 'contracts' | 'documents' | 'disciplinary'>('list');
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  // Delete confirmation
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);

  // Contract modal (controlled by selectedContract)
  const [selectedContract, setSelectedContract] = useState<Contract | null>(null);

  // Document modal (controlled by selectedDocument) - reserved for future document details modal
  const [_selectedDocument, setSelectedDocument] = useState<EmployeeDocument | null>(null);

  // Disciplinary modal (controlled by selectedDisciplinary)
  const [selectedDisciplinary, setSelectedDisciplinary] = useState<DisciplinaryAction | null>(null);

  // Upload modals - for adding new documents/contracts/disciplinary
  const [showDocumentUploadModal, setShowDocumentUploadModal] = useState(false);
  const [showContractFormModal, setShowContractFormModal] = useState(false);
  const [showDisciplinaryFormModal, setShowDisciplinaryFormModal] = useState(false);
  const [selectedEmployeeForModal, setSelectedEmployeeForModal] = useState<{ id: string; name: string } | null>(null);

  // Fetch employees
  const { data: employeesData, isLoading } = useQuery({
    queryKey: ['hr-employees', searchTerm, statusFilter, departmentFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter) params.append('status', statusFilter);
      if (departmentFilter) params.append('department', departmentFilter);

      const response = await apiClient.get<{ success: boolean; data: Employee[] }>(`/hr/employees?${params.toString()}`);
      return (response as { data: Employee[] }).data;
    },
  });

  // Fetch departments for filter
  const { data: departmentsData } = useQuery({
    queryKey: ['hr-departments'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: string[] }>('/hr/employees/meta/departments');
      return (response as { data: string[] }).data;
    },
  });

  // Fetch contracts
  const { data: contractsData, isLoading: contractsLoading } = useQuery({
    queryKey: ['hr-all-contracts'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: Contract[] }>('/hr/employees/all-contracts');
      return (response as { data: Contract[] }).data;
    },
    enabled: activeTab === 'contracts',
  });

  // Fetch documents
  const { data: documentsData, isLoading: documentsLoading } = useQuery({
    queryKey: ['hr-all-documents'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: EmployeeDocument[] }>('/hr/employees/all-documents');
      return (response as { data: EmployeeDocument[] }).data;
    },
    enabled: activeTab === 'documents',
  });

  // Fetch disciplinary actions
  const { data: disciplinaryData, isLoading: disciplinaryLoading } = useQuery({
    queryKey: ['hr-all-disciplinary'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: DisciplinaryAction[] }>('/hr/employees/all-disciplinary');
      return (response as { data: DisciplinaryAction[] }).data;
    },
    enabled: activeTab === 'disciplinary',
  });

  // Delete employee mutation
  const deleteEmployeeMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiClient.delete(`/hr/employees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      toast({
        title: 'Succès',
        description: 'Employé supprimé avec succès',
      });
      setEmployeeToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de supprimer l\'employé',
        variant: 'destructive',
      });
    },
  });

  const employees = employeesData || [];
  const departments = departmentsData || [];
  const contracts = contractsData || [];
  const documents = documentsData || [];
  const disciplinaryActions = disciplinaryData || [];

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD' }).format(amount);
  };

  const isContractExpiringSoon = (contract: Contract) => {
    if (!contract.end_date) return false;
    const endDate = new Date(contract.end_date);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const isDocumentExpiringSoon = (doc: EmployeeDocument) => {
    if (!doc.expiry_date) return false;
    const expiryDate = new Date(doc.expiry_date);
    const today = new Date();
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  const handleDeleteEmployee = async () => {
    if (!employeeToDelete) return;
    await deleteEmployeeMutation.mutateAsync(employeeToDelete.id);
  };

  const handleExportEmployees = () => {
    // Export to CSV
    const headers = ['Matricule', 'Nom', 'Prénom', 'Email', 'Poste', 'Département', 'Statut', 'Date embauche'];
    const rows = employees.map((e: Employee) => [
      e.employee_number,
      e.last_name,
      e.first_name,
      e.email,
      e.position || '',
      e.department || '',
      e.employment_status,
      e.hire_date,
    ].join(';'));

    const csvContent = [headers.join(';'), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `employes-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: 'Export réussi',
      description: `${employees.length} employés exportés`,
    });
  };

  // Pastel colors for avatar initials
  const getAvatarColor = (name: string) => {
    const colors = [
      { bg: '#E3F5FF', text: '#0088CC' },
      { bg: '#E5ECF6', text: '#5B6B82' },
      { bg: '#FFF4E5', text: '#F26522' },
      { bg: '#E6FAF5', text: '#05CD99' },
      { bg: '#FEE2E2', text: '#EE5D50' },
      { bg: '#F3E8FF', text: '#9333EA' },
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  return (
    <AppLayout>
      <div className="min-h-screen" style={{ backgroundColor: '#F4F7FE' }}>
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-3" style={{ color: '#2B3674' }}>
                <div className="p-2 rounded-xl" style={{ backgroundColor: '#F26522', boxShadow: '0px 4px 12px rgba(242, 101, 34, 0.25)' }}>
                  <Users className="h-6 w-6 text-white" />
                </div>
                Dossiers du Personnel
              </h1>
              <p className="mt-2" style={{ color: '#A3AED0' }}>
                Gestion des employés, contrats et documents administratifs
              </p>
            </div>
            {hr.canCreateEmployee && (
              <button
                type="button"
                onClick={() => {
                  setSelectedEmployeeId(null);
                  setShowEmployeeModal(true);
                }}
                className="flex items-center gap-2 text-white px-5 py-2.5 font-medium transition-all duration-200 hover:scale-[1.02]"
                style={{
                  backgroundColor: '#F26522',
                  borderRadius: '12px',
                  boxShadow: '0px 4px 12px rgba(242, 101, 34, 0.35)'
                }}
              >
                <Plus className="h-5 w-5" />
                Nouvel Employé
              </button>
            )}
          </div>

          {/* KPI Stats Cards - Moved to top */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div
              className="bg-white p-5 transition-all duration-200 hover:scale-[1.02]"
              style={{
                borderRadius: '20px',
                boxShadow: '0px 20px 27px 0px rgba(112, 144, 176, 0.05)'
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#A3AED0' }}>
                    Total Employés
                  </p>
                  <p className="text-3xl font-bold mt-1" style={{ color: '#2B3674' }}>
                    {employees.length}
                  </p>
                </div>
                <div
                  className="p-3 rounded-xl"
                  style={{ backgroundColor: '#E3F5FF' }}
                >
                  <Users className="h-6 w-6" style={{ color: '#0088CC' }} />
                </div>
              </div>
            </div>

            <div
              className="bg-white p-5 transition-all duration-200 hover:scale-[1.02]"
              style={{
                borderRadius: '20px',
                boxShadow: '0px 20px 27px 0px rgba(112, 144, 176, 0.05)'
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#A3AED0' }}>
                    Actifs
                  </p>
                  <p className="text-3xl font-bold mt-1" style={{ color: '#05CD99' }}>
                    {employees.filter((e: Employee) => e.employment_status === 'active').length}
                  </p>
                </div>
                <div
                  className="p-3 rounded-xl"
                  style={{ backgroundColor: '#E6FAF5' }}
                >
                  <UserCheck className="h-6 w-6" style={{ color: '#05CD99' }} />
                </div>
              </div>
            </div>

            <div
              className="bg-white p-5 transition-all duration-200 hover:scale-[1.02]"
              style={{
                borderRadius: '20px',
                boxShadow: '0px 20px 27px 0px rgba(112, 144, 176, 0.05)'
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#A3AED0' }}>
                    En congé
                  </p>
                  <p className="text-3xl font-bold mt-1" style={{ color: '#0088CC' }}>
                    {employees.filter((e: Employee) => e.employment_status === 'on_leave').length}
                  </p>
                </div>
                <div
                  className="p-3 rounded-xl"
                  style={{ backgroundColor: '#E3F5FF' }}
                >
                  <Calendar className="h-6 w-6" style={{ color: '#0088CC' }} />
                </div>
              </div>
            </div>

            <div
              className="bg-white p-5 transition-all duration-200 hover:scale-[1.02]"
              style={{
                borderRadius: '20px',
                boxShadow: '0px 20px 27px 0px rgba(112, 144, 176, 0.05)'
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#A3AED0' }}>
                    Suspendus
                  </p>
                  <p className="text-3xl font-bold mt-1" style={{ color: '#FFCE20' }}>
                    {employees.filter((e: Employee) => e.employment_status === 'suspended').length}
                  </p>
                </div>
                <div
                  className="p-3 rounded-xl"
                  style={{ backgroundColor: '#FFF8E5' }}
                >
                  <PauseCircle className="h-6 w-6" style={{ color: '#FFCE20' }} />
                </div>
              </div>
            </div>
          </div>

          {/* Tabs - Modern style */}
          <div
            className="bg-white p-1.5 inline-flex gap-1"
            style={{
              borderRadius: '14px',
              boxShadow: '0px 20px 27px 0px rgba(112, 144, 176, 0.05)'
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('list')}
              className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm transition-all duration-200 ${
                activeTab === 'list'
                  ? 'text-white'
                  : 'hover:bg-gray-50'
              }`}
              style={{
                borderRadius: '10px',
                backgroundColor: activeTab === 'list' ? '#F26522' : 'transparent',
                color: activeTab === 'list' ? 'white' : '#A3AED0',
                boxShadow: activeTab === 'list' ? '0px 4px 12px rgba(242, 101, 34, 0.25)' : 'none'
              }}
            >
              <Users className="h-4 w-4" />
              Liste des Employés
            </button>
            {hr.canViewContracts && (
              <button
                type="button"
                onClick={() => setActiveTab('contracts')}
                className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm transition-all duration-200 ${
                  activeTab === 'contracts'
                    ? 'text-white'
                    : 'hover:bg-gray-50'
                }`}
                style={{
                  borderRadius: '10px',
                  backgroundColor: activeTab === 'contracts' ? '#F26522' : 'transparent',
                  color: activeTab === 'contracts' ? 'white' : '#A3AED0',
                  boxShadow: activeTab === 'contracts' ? '0px 4px 12px rgba(242, 101, 34, 0.25)' : 'none'
                }}
              >
                <Briefcase className="h-4 w-4" />
                Contrats
                {contracts.filter(c => isContractExpiringSoon(c)).length > 0 && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ backgroundColor: activeTab === 'contracts' ? 'rgba(255,255,255,0.3)' : '#FFF4E5', color: activeTab === 'contracts' ? 'white' : '#F26522' }}
                  >
                    {contracts.filter(c => isContractExpiringSoon(c)).length}
                  </span>
                )}
              </button>
            )}
            {hr.canManageDocuments && (
              <button
                type="button"
                onClick={() => setActiveTab('documents')}
                className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm transition-all duration-200 ${
                  activeTab === 'documents'
                    ? 'text-white'
                    : 'hover:bg-gray-50'
                }`}
                style={{
                  borderRadius: '10px',
                  backgroundColor: activeTab === 'documents' ? '#F26522' : 'transparent',
                  color: activeTab === 'documents' ? 'white' : '#A3AED0',
                  boxShadow: activeTab === 'documents' ? '0px 4px 12px rgba(242, 101, 34, 0.25)' : 'none'
                }}
              >
                <FileText className="h-4 w-4" />
                Documents
                {documents.filter(d => !d.is_verified).length > 0 && (
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-semibold"
                    style={{ backgroundColor: activeTab === 'documents' ? 'rgba(255,255,255,0.3)' : '#FFCE20', color: activeTab === 'documents' ? 'white' : '#2B3674' }}
                  >
                    {documents.filter(d => !d.is_verified).length}
                  </span>
                )}
              </button>
            )}
            {hr.canViewDisciplinary && (
              <button
                type="button"
                onClick={() => setActiveTab('disciplinary')}
                className={`flex items-center gap-2 px-4 py-2.5 font-medium text-sm transition-all duration-200 ${
                  activeTab === 'disciplinary'
                    ? 'text-white'
                    : 'hover:bg-gray-50'
                }`}
                style={{
                  borderRadius: '10px',
                  backgroundColor: activeTab === 'disciplinary' ? '#F26522' : 'transparent',
                  color: activeTab === 'disciplinary' ? 'white' : '#A3AED0',
                  boxShadow: activeTab === 'disciplinary' ? '0px 4px 12px rgba(242, 101, 34, 0.25)' : 'none'
                }}
              >
                <AlertTriangle className="h-4 w-4" />
                Disciplinaire
              </button>
            )}
          </div>

          {/* Filters - Modern card */}
          <div
            className="bg-white p-5"
            style={{
              borderRadius: '20px',
              boxShadow: '0px 20px 27px 0px rgba(112, 144, 176, 0.05)'
            }}
          >
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: '#A3AED0' }} />
                <input
                  type="text"
                  placeholder="Rechercher un employé..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-11 w-full py-3 px-4 text-sm transition-all duration-200 focus:outline-none focus:ring-2"
                  style={{
                    borderRadius: '12px',
                    border: '1px solid #E9EDF7',
                    color: '#2B3674',
                    backgroundColor: '#F4F7FE'
                  }}
                />
              </div>
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full py-3 px-4 text-sm transition-all duration-200 focus:outline-none focus:ring-2 cursor-pointer"
                  style={{
                    borderRadius: '12px',
                    border: '1px solid #E9EDF7',
                    color: statusFilter ? '#2B3674' : '#A3AED0',
                    backgroundColor: '#F4F7FE'
                  }}
                >
                  <option value="">Tous les statuts</option>
                  <option value="active">Actif</option>
                  <option value="on_leave">En congé</option>
                  <option value="suspended">Suspendu</option>
                  <option value="terminated">Terminé</option>
                </select>
              </div>
              <div>
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  className="w-full py-3 px-4 text-sm transition-all duration-200 focus:outline-none focus:ring-2 cursor-pointer"
                  style={{
                    borderRadius: '12px',
                    border: '1px solid #E9EDF7',
                    color: departmentFilter ? '#2B3674' : '#A3AED0',
                    backgroundColor: '#F4F7FE'
                  }}
                >
                  <option value="">Tous les départements</option>
                  {departments.map((dept: string) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleExportEmployees}
                  className="flex items-center gap-2 px-5 py-3 font-medium text-sm transition-all duration-200 hover:scale-[1.02] flex-1 justify-center"
                  style={{
                    borderRadius: '12px',
                    backgroundColor: '#E5ECF6',
                    color: '#2B3674'
                  }}
                >
                  <Download className="h-4 w-4" />
                  Exporter
                </button>
              </div>
            </div>
          </div>

          {/* Content - Employees List */}
          {activeTab === 'list' && (
            <div
              className="bg-white overflow-hidden"
              style={{
                borderRadius: '20px',
                boxShadow: '0px 20px 27px 0px rgba(112, 144, 176, 0.05)'
              }}
            >
              {isLoading ? (
                <div className="p-12 text-center">
                  <Loader2 className="h-10 w-10 animate-spin mx-auto" style={{ color: '#F26522' }} />
                  <p className="mt-3 font-medium" style={{ color: '#A3AED0' }}>Chargement des employés...</p>
                </div>
              ) : employees.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="inline-flex p-4 rounded-2xl mb-4" style={{ backgroundColor: '#F4F7FE' }}>
                    <Users className="h-12 w-12" style={{ color: '#A3AED0' }} />
                  </div>
                  <p className="font-medium" style={{ color: '#2B3674' }}>Aucun employé trouvé</p>
                  <p className="mt-1 text-sm" style={{ color: '#A3AED0' }}>Commencez par ajouter votre premier employé</p>
                  {hr.canCreateEmployee && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedEmployeeId(null);
                        setShowEmployeeModal(true);
                      }}
                      className="mt-5 text-white px-5 py-2.5 font-medium transition-all duration-200 hover:scale-[1.02]"
                      style={{
                        backgroundColor: '#F26522',
                        borderRadius: '12px',
                        boxShadow: '0px 4px 12px rgba(242, 101, 34, 0.35)'
                      }}
                    >
                      Ajouter un employé
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr style={{ backgroundColor: '#FAFCFE' }}>
                          <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A3AED0' }}>
                            Employé
                          </th>
                          <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A3AED0' }}>
                            Matricule
                          </th>
                          <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A3AED0' }}>
                            Poste
                          </th>
                          <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A3AED0' }}>
                            Département
                          </th>
                          <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A3AED0' }}>
                            Statut
                          </th>
                          <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A3AED0' }}>
                            Embauche
                          </th>
                          <th className="px-6 py-4 text-center text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A3AED0' }}>
                            Pointage
                          </th>
                          <th className="px-6 py-4 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A3AED0' }}>
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ borderColor: '#E9EDF7' }}>
                        {employees.map((employee: Employee) => {
                          const avatarColor = getAvatarColor(employee.first_name);
                          return (
                            <tr
                              key={employee.id}
                              className="transition-colors duration-150"
                              style={{ '--tw-bg-opacity': 1 } as React.CSSProperties}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FAFCFE'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center gap-3">
                                  {employee.photo_url ? (
                                    <img
                                      src={employee.photo_url}
                                      alt={`${employee.first_name} ${employee.last_name}`}
                                      className="w-11 h-11 rounded-xl object-cover"
                                      style={{ border: '2px solid #E9EDF7' }}
                                    />
                                  ) : (
                                    <div
                                      className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm"
                                      style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
                                    >
                                      {getInitials(employee.first_name, employee.last_name)}
                                    </div>
                                  )}
                                  <div>
                                    <div className="font-semibold text-sm" style={{ color: '#2B3674' }}>
                                      {employee.first_name} {employee.last_name}
                                    </div>
                                    <div className="text-xs" style={{ color: '#A3AED0' }}>{employee.email}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm font-medium" style={{ color: '#2B3674' }}>
                                  {employee.employee_number}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm" style={{ color: '#2B3674' }}>
                                  {employee.position || '-'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm" style={{ color: '#2B3674' }}>
                                  {employee.department || '-'}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {employee.employment_status === 'active' ? (
                                  <span
                                    className="inline-flex items-center px-3 py-1 text-xs font-semibold"
                                    style={{ backgroundColor: '#E6FAF5', color: '#05CD99', borderRadius: '20px' }}
                                  >
                                    Actif
                                  </span>
                                ) : employee.employment_status === 'terminated' ? (
                                  <span
                                    className="inline-flex items-center px-3 py-1 text-xs font-semibold"
                                    style={{ backgroundColor: '#FEE2E2', color: '#EE5D50', borderRadius: '20px' }}
                                  >
                                    Terminé
                                  </span>
                                ) : employee.employment_status === 'suspended' ? (
                                  <span
                                    className="inline-flex items-center px-3 py-1 text-xs font-semibold"
                                    style={{ backgroundColor: '#FFF8E5', color: '#FFCE20', borderRadius: '20px' }}
                                  >
                                    Suspendu
                                  </span>
                                ) : employee.employment_status === 'on_leave' ? (
                                  <span
                                    className="inline-flex items-center px-3 py-1 text-xs font-semibold"
                                    style={{ backgroundColor: '#E3F5FF', color: '#0088CC', borderRadius: '20px' }}
                                  >
                                    En congé
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center px-3 py-1 text-xs font-semibold"
                                    style={{ backgroundColor: '#E5ECF6', color: '#5B6B82', borderRadius: '20px' }}
                                  >
                                    {employee.employment_status}
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className="text-sm" style={{ color: '#2B3674' }}>
                                  {formatDate(employee.hire_date)}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-center">
                                {employee.requires_clocking ? (
                                  <span
                                    className="inline-flex items-center px-3 py-1 text-xs font-semibold"
                                    style={{ backgroundColor: '#E6FAF5', color: '#05CD99', borderRadius: '20px' }}
                                  >
                                    Pointeur
                                  </span>
                                ) : (
                                  <span
                                    className="inline-flex items-center px-3 py-1 text-xs font-semibold"
                                    style={{ backgroundColor: '#E5ECF6', color: '#5B6B82', borderRadius: '20px' }}
                                  >
                                    Non
                                  </span>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-right">
                                <div className="flex justify-end gap-2">
                                  {hr.canUpdateEmployee && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedEmployeeId(employee.id);
                                        setShowEmployeeModal(true);
                                      }}
                                      className="p-2 rounded-lg transition-all duration-200 hover:scale-110"
                                      style={{ backgroundColor: '#E3F5FF', color: '#0088CC' }}
                                      title="Modifier l'employé"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </button>
                                  )}
                                  {hr.canDeleteEmployee && (
                                    <button
                                      type="button"
                                      onClick={() => setEmployeeToDelete(employee)}
                                      className="p-2 rounded-lg transition-all duration-200 hover:scale-110"
                                      style={{ backgroundColor: '#FEE2E2', color: '#EE5D50' }}
                                      title="Supprimer l'employé"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="md:hidden p-4 space-y-4">
                    {employees.map((employee: Employee) => {
                      const avatarColor = getAvatarColor(employee.first_name);
                      return (
                        <div
                          key={employee.id}
                          className="p-4"
                          style={{
                            backgroundColor: '#FAFCFE',
                            borderRadius: '16px',
                            border: '1px solid #E9EDF7'
                          }}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              {employee.photo_url ? (
                                <img
                                  src={employee.photo_url}
                                  alt={`${employee.first_name} ${employee.last_name}`}
                                  className="w-12 h-12 rounded-xl object-cover"
                                  style={{ border: '2px solid #E9EDF7' }}
                                />
                              ) : (
                                <div
                                  className="w-12 h-12 rounded-xl flex items-center justify-center font-bold"
                                  style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
                                >
                                  {getInitials(employee.first_name, employee.last_name)}
                                </div>
                              )}
                              <div>
                                <div className="font-semibold" style={{ color: '#2B3674' }}>
                                  {employee.first_name} {employee.last_name}
                                </div>
                                <div className="text-xs" style={{ color: '#A3AED0' }}>
                                  {employee.email}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {hr.canUpdateEmployee && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedEmployeeId(employee.id);
                                    setShowEmployeeModal(true);
                                  }}
                                  className="p-2 rounded-lg"
                                  style={{ backgroundColor: '#E3F5FF', color: '#0088CC' }}
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                              )}
                              {hr.canDeleteEmployee && (
                                <button
                                  type="button"
                                  onClick={() => setEmployeeToDelete(employee)}
                                  className="p-2 rounded-lg"
                                  style={{ backgroundColor: '#FEE2E2', color: '#EE5D50' }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                            <div>
                              <span className="text-[10px] uppercase font-semibold" style={{ color: '#A3AED0' }}>Matricule</span>
                              <p className="font-medium" style={{ color: '#2B3674' }}>{employee.employee_number}</p>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-semibold" style={{ color: '#A3AED0' }}>Poste</span>
                              <p className="font-medium" style={{ color: '#2B3674' }}>{employee.position || '-'}</p>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-semibold" style={{ color: '#A3AED0' }}>Département</span>
                              <p className="font-medium" style={{ color: '#2B3674' }}>{employee.department || '-'}</p>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-semibold" style={{ color: '#A3AED0' }}>Embauche</span>
                              <p className="font-medium" style={{ color: '#2B3674' }}>{formatDate(employee.hire_date)}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            {employee.employment_status === 'active' ? (
                              <span
                                className="inline-flex items-center px-3 py-1 text-xs font-semibold"
                                style={{ backgroundColor: '#E6FAF5', color: '#05CD99', borderRadius: '20px' }}
                              >
                                Actif
                              </span>
                            ) : employee.employment_status === 'terminated' ? (
                              <span
                                className="inline-flex items-center px-3 py-1 text-xs font-semibold"
                                style={{ backgroundColor: '#FEE2E2', color: '#EE5D50', borderRadius: '20px' }}
                              >
                                Terminé
                              </span>
                            ) : employee.employment_status === 'suspended' ? (
                              <span
                                className="inline-flex items-center px-3 py-1 text-xs font-semibold"
                                style={{ backgroundColor: '#FFF8E5', color: '#FFCE20', borderRadius: '20px' }}
                              >
                                Suspendu
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center px-3 py-1 text-xs font-semibold"
                                style={{ backgroundColor: '#E3F5FF', color: '#0088CC', borderRadius: '20px' }}
                              >
                                En congé
                              </span>
                            )}
                            {employee.requires_clocking && (
                              <span
                                className="inline-flex items-center px-3 py-1 text-xs font-semibold"
                                style={{ backgroundColor: '#E6FAF5', color: '#05CD99', borderRadius: '20px' }}
                              >
                                Pointeur
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Content - Contracts Tab */}
          {activeTab === 'contracts' && (
            <div
              className="bg-white overflow-hidden"
              style={{
                borderRadius: '20px',
                boxShadow: '0px 20px 27px 0px rgba(112, 144, 176, 0.05)'
              }}
            >
              {/* Add Contract Button */}
              {hr.canViewContracts && employees.length > 0 && (
                <div className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4" style={{ backgroundColor: '#FAFCFE', borderBottom: '1px solid #E9EDF7' }}>
                  <p className="text-sm" style={{ color: '#A3AED0' }}>
                    Gérez les contrats de travail des employés
                  </p>
                  <div className="flex items-center gap-3">
                    <select
                      aria-label="Sélectionner un employé pour le contrat"
                      className="py-2.5 px-4 text-sm cursor-pointer"
                      style={{
                        borderRadius: '12px',
                        border: '1px solid #E9EDF7',
                        color: selectedEmployeeForModal ? '#2B3674' : '#A3AED0',
                        backgroundColor: 'white'
                      }}
                      onChange={(e) => {
                        const emp = employees.find((emp: Employee) => emp.id === e.target.value);
                        if (emp) {
                          setSelectedEmployeeForModal({ id: emp.id, name: `${emp.first_name} ${emp.last_name}` });
                        }
                      }}
                      value={selectedEmployeeForModal?.id || ''}
                    >
                      <option value="">Sélectionner un employé</option>
                      {employees.map((emp: Employee) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedEmployeeForModal) {
                          setShowContractFormModal(true);
                        }
                      }}
                      disabled={!selectedEmployeeForModal}
                      className="flex items-center gap-2 text-white px-4 py-2.5 font-medium transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      style={{
                        backgroundColor: '#F26522',
                        borderRadius: '12px',
                        boxShadow: '0px 4px 12px rgba(242, 101, 34, 0.35)'
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Ajouter un contrat
                    </button>
                  </div>
                </div>
              )}
              {contractsLoading ? (
                <div className="p-12 text-center">
                  <Loader2 className="h-10 w-10 animate-spin mx-auto" style={{ color: '#F26522' }} />
                  <p className="mt-3 font-medium" style={{ color: '#A3AED0' }}>Chargement des contrats...</p>
                </div>
              ) : contracts.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="inline-flex p-4 rounded-2xl mb-4" style={{ backgroundColor: '#F4F7FE' }}>
                    <Briefcase className="h-12 w-12" style={{ color: '#A3AED0' }} />
                  </div>
                  <p className="font-medium" style={{ color: '#2B3674' }}>Aucun contrat trouvé</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr style={{ backgroundColor: '#FAFCFE' }}>
                        <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A3AED0' }}>
                          Employé
                        </th>
                        <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A3AED0' }}>
                          Type
                        </th>
                        <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A3AED0' }}>
                          Poste
                        </th>
                        <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A3AED0' }}>
                          Période
                        </th>
                        <th className="px-6 py-4 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A3AED0' }}>
                          Salaire
                        </th>
                        <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A3AED0' }}>
                          Statut
                        </th>
                        <th className="px-6 py-4 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A3AED0' }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: '#E9EDF7' }}>
                      {contracts.map((contract: Contract) => {
                        const expiringSoon = isContractExpiringSoon(contract);
                        const contractTypeStyles: Record<string, { bg: string; text: string }> = {
                          cdi: { bg: '#E6FAF5', text: '#05CD99' },
                          cdd: { bg: '#E3F5FF', text: '#0088CC' },
                          stage: { bg: '#F3E8FF', text: '#9333EA' },
                          interim: { bg: '#FFF4E5', text: '#F26522' },
                        };
                        const typeStyle = contractTypeStyles[contract.contract_type] || { bg: '#E5ECF6', text: '#5B6B82' };

                        return (
                          <tr
                            key={contract.id}
                            className="transition-colors duration-150"
                            style={{ backgroundColor: expiringSoon ? '#FFF8F0' : 'transparent' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = expiringSoon ? '#FFF4E5' : '#FAFCFE'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = expiringSoon ? '#FFF8F0' : 'transparent'}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-semibold text-sm" style={{ color: '#2B3674' }}>{contract.employee_name}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className="inline-flex items-center px-3 py-1 text-xs font-semibold"
                                style={{ backgroundColor: typeStyle.bg, color: typeStyle.text, borderRadius: '20px' }}
                              >
                                {CONTRACT_TYPES[contract.contract_type]?.label || contract.contract_type}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm" style={{ color: '#2B3674' }}>{contract.position}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center gap-2 text-sm" style={{ color: '#2B3674' }}>
                                {formatDate(contract.start_date)}
                                {contract.end_date && (
                                  <>
                                    <span style={{ color: '#A3AED0' }}>→</span>
                                    <span className={expiringSoon ? 'font-semibold' : ''} style={{ color: expiringSoon ? '#F26522' : '#2B3674' }}>
                                      {formatDate(contract.end_date)}
                                    </span>
                                    {expiringSoon && (
                                      <AlertCircle className="h-4 w-4" style={{ color: '#F26522' }} />
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <span className="text-sm font-semibold" style={{ color: '#05CD99' }}>
                                {formatMoney(contract.base_salary)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {contract.status === 'active' ? (
                                <span
                                  className="inline-flex items-center px-3 py-1 text-xs font-semibold"
                                  style={{ backgroundColor: '#E6FAF5', color: '#05CD99', borderRadius: '20px' }}
                                >
                                  Actif
                                </span>
                              ) : contract.status === 'expired' ? (
                                <span
                                  className="inline-flex items-center px-3 py-1 text-xs font-semibold"
                                  style={{ backgroundColor: '#FEE2E2', color: '#EE5D50', borderRadius: '20px' }}
                                >
                                  Expiré
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center px-3 py-1 text-xs font-semibold"
                                  style={{ backgroundColor: '#E5ECF6', color: '#5B6B82', borderRadius: '20px' }}
                                >
                                  Terminé
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedContract(contract)}
                                className="p-2 rounded-lg transition-all duration-200 hover:scale-110"
                                style={{ backgroundColor: '#E3F5FF', color: '#0088CC' }}
                                title="Voir les détails"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Contract alerts */}
              {contracts.filter(c => isContractExpiringSoon(c)).length > 0 && (
                <div className="p-4" style={{ backgroundColor: '#FFF8F0', borderTop: '1px solid #FFE4D0' }}>
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: '#FFF4E5' }}>
                      <AlertCircle className="h-5 w-5" style={{ color: '#F26522' }} />
                    </div>
                    <span className="font-medium text-sm" style={{ color: '#F26522' }}>
                      {contracts.filter(c => isContractExpiringSoon(c)).length} contrat(s) expirent dans les 30 prochains jours
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Content - Documents Tab */}
          {activeTab === 'documents' && (
            <div
              className="bg-white overflow-hidden"
              style={{
                borderRadius: '20px',
                boxShadow: '0px 20px 27px 0px rgba(112, 144, 176, 0.05)'
              }}
            >
              {/* Add Document Button */}
              {hr.canManageDocuments && employees.length > 0 && (
                <div className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4" style={{ backgroundColor: '#FAFCFE', borderBottom: '1px solid #E9EDF7' }}>
                  <p className="text-sm" style={{ color: '#A3AED0' }}>
                    Gérez les documents administratifs des employés
                  </p>
                  <div className="flex items-center gap-3">
                    <select
                      aria-label="Sélectionner un employé pour le document"
                      className="py-2.5 px-4 text-sm cursor-pointer"
                      style={{
                        borderRadius: '12px',
                        border: '1px solid #E9EDF7',
                        color: selectedEmployeeForModal ? '#2B3674' : '#A3AED0',
                        backgroundColor: 'white'
                      }}
                      onChange={(e) => {
                        const emp = employees.find((emp: Employee) => emp.id === e.target.value);
                        if (emp) {
                          setSelectedEmployeeForModal({ id: emp.id, name: `${emp.first_name} ${emp.last_name}` });
                        }
                      }}
                      value={selectedEmployeeForModal?.id || ''}
                    >
                      <option value="">Sélectionner un employé</option>
                      {employees.map((emp: Employee) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedEmployeeForModal) {
                          setShowDocumentUploadModal(true);
                        }
                      }}
                      disabled={!selectedEmployeeForModal}
                      className="flex items-center gap-2 text-white px-4 py-2.5 font-medium transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      style={{
                        backgroundColor: '#F26522',
                        borderRadius: '12px',
                        boxShadow: '0px 4px 12px rgba(242, 101, 34, 0.35)'
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Ajouter un document
                    </button>
                  </div>
                </div>
              )}
              {documentsLoading ? (
                <div className="p-12 text-center">
                  <Loader2 className="h-10 w-10 animate-spin mx-auto" style={{ color: '#F26522' }} />
                  <p className="mt-3 font-medium" style={{ color: '#A3AED0' }}>Chargement des documents...</p>
                </div>
              ) : documents.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="inline-flex p-4 rounded-2xl mb-4" style={{ backgroundColor: '#F4F7FE' }}>
                    <FileText className="h-12 w-12" style={{ color: '#A3AED0' }} />
                  </div>
                  <p className="font-medium" style={{ color: '#2B3674' }}>Aucun document trouvé</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr style={{ backgroundColor: '#FAFCFE' }}>
                        <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A3AED0' }}>
                          Employé
                        </th>
                        <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A3AED0' }}>
                          Type
                        </th>
                        <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A3AED0' }}>
                          Document
                        </th>
                        <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A3AED0' }}>
                          Expiration
                        </th>
                        <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A3AED0' }}>
                          Vérification
                        </th>
                        <th className="px-6 py-4 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A3AED0' }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: '#E9EDF7' }}>
                      {documents.map((doc: EmployeeDocument) => {
                        const expiringSoon = isDocumentExpiringSoon(doc);
                        return (
                          <tr
                            key={doc.id}
                            className="transition-colors duration-150"
                            style={{ backgroundColor: expiringSoon ? '#FFF8F0' : 'transparent' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = expiringSoon ? '#FFF4E5' : '#FAFCFE'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = expiringSoon ? '#FFF8F0' : 'transparent'}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-semibold text-sm" style={{ color: '#2B3674' }}>{doc.employee_name}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className="inline-flex items-center px-3 py-1 text-xs font-semibold"
                                style={{ backgroundColor: '#E5ECF6', color: '#5B6B82', borderRadius: '20px' }}
                              >
                                {DOCUMENT_TYPES[doc.document_type] || doc.document_type}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm" style={{ color: '#2B3674' }}>{doc.document_name}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {doc.expiry_date ? (
                                <div className="flex items-center gap-1.5 text-sm" style={{ color: expiringSoon ? '#F26522' : '#2B3674' }}>
                                  <span className={expiringSoon ? 'font-semibold' : ''}>{formatDate(doc.expiry_date)}</span>
                                  {expiringSoon && <AlertCircle className="h-4 w-4" style={{ color: '#F26522' }} />}
                                </div>
                              ) : (
                                <span style={{ color: '#A3AED0' }}>-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {doc.is_verified ? (
                                <span
                                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold"
                                  style={{ backgroundColor: '#E6FAF5', color: '#05CD99', borderRadius: '20px' }}
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  Vérifié
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold"
                                  style={{ backgroundColor: '#FFF8E5', color: '#FFCE20', borderRadius: '20px' }}
                                >
                                  <Clock className="h-3.5 w-3.5" />
                                  En attente
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => window.open(doc.file_path, '_blank')}
                                  className="p-2 rounded-lg transition-all duration-200 hover:scale-110"
                                  style={{ backgroundColor: '#E3F5FF', color: '#0088CC' }}
                                  title="Voir le document"
                                >
                                  <Eye className="h-4 w-4" />
                                </button>
                                {!doc.is_verified && hr.canManageDocuments && (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedDocument(doc)}
                                    className="p-2 rounded-lg transition-all duration-200 hover:scale-110"
                                    style={{ backgroundColor: '#E6FAF5', color: '#05CD99' }}
                                    title="Vérifier le document"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Document alerts */}
              {documents.filter(d => !d.is_verified).length > 0 && (
                <div className="p-4" style={{ backgroundColor: '#FFFBF0', borderTop: '1px solid #FFF0D0' }}>
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: '#FFF8E5' }}>
                      <Clock className="h-5 w-5" style={{ color: '#FFCE20' }} />
                    </div>
                    <span className="font-medium text-sm" style={{ color: '#B8860B' }}>
                      {documents.filter(d => !d.is_verified).length} document(s) en attente de vérification
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Content - Disciplinary Tab */}
          {activeTab === 'disciplinary' && (
            <div
              className="bg-white overflow-hidden"
              style={{
                borderRadius: '20px',
                boxShadow: '0px 20px 27px 0px rgba(112, 144, 176, 0.05)'
              }}
            >
              {/* Add Disciplinary Action Button */}
              {hr.canViewDisciplinary && employees.length > 0 && (
                <div className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4" style={{ backgroundColor: '#FEF2F2', borderBottom: '1px solid #FECACA' }}>
                  <p className="text-sm" style={{ color: '#A3AED0' }}>
                    Gérez les actions disciplinaires
                  </p>
                  <div className="flex items-center gap-3">
                    <select
                      aria-label="Sélectionner un employé pour l'action disciplinaire"
                      className="py-2.5 px-4 text-sm cursor-pointer"
                      style={{
                        borderRadius: '12px',
                        border: '1px solid #E9EDF7',
                        color: selectedEmployeeForModal ? '#2B3674' : '#A3AED0',
                        backgroundColor: 'white'
                      }}
                      onChange={(e) => {
                        const emp = employees.find((emp: Employee) => emp.id === e.target.value);
                        if (emp) {
                          setSelectedEmployeeForModal({ id: emp.id, name: `${emp.first_name} ${emp.last_name}` });
                        }
                      }}
                      value={selectedEmployeeForModal?.id || ''}
                    >
                      <option value="">Sélectionner un employé</option>
                      {employees.map((emp: Employee) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.first_name} {emp.last_name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedEmployeeForModal) {
                          setShowDisciplinaryFormModal(true);
                        }
                      }}
                      disabled={!selectedEmployeeForModal}
                      className="flex items-center gap-2 text-white px-4 py-2.5 font-medium transition-all duration-200 hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      style={{
                        backgroundColor: '#EE5D50',
                        borderRadius: '12px',
                        boxShadow: '0px 4px 12px rgba(238, 93, 80, 0.35)'
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      Nouvelle action
                    </button>
                  </div>
                </div>
              )}
              {disciplinaryLoading ? (
                <div className="p-12 text-center">
                  <Loader2 className="h-10 w-10 animate-spin mx-auto" style={{ color: '#F26522' }} />
                  <p className="mt-3 font-medium" style={{ color: '#A3AED0' }}>Chargement des actions disciplinaires...</p>
                </div>
              ) : disciplinaryActions.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="inline-flex p-4 rounded-2xl mb-4" style={{ backgroundColor: '#F4F7FE' }}>
                    <AlertTriangle className="h-12 w-12" style={{ color: '#A3AED0' }} />
                  </div>
                  <p className="font-medium" style={{ color: '#2B3674' }}>Aucune action disciplinaire</p>
                  <p className="mt-1 text-sm" style={{ color: '#A3AED0' }}>Aucun incident n'a été enregistré</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr style={{ backgroundColor: '#FAFCFE' }}>
                        <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A3AED0' }}>
                          Employé
                        </th>
                        <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A3AED0' }}>
                          Type
                        </th>
                        <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A3AED0' }}>
                          Date incident
                        </th>
                        <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A3AED0' }}>
                          Description
                        </th>
                        <th className="px-6 py-4 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A3AED0' }}>
                          Recours
                        </th>
                        <th className="px-6 py-4 text-right text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#A3AED0' }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: '#E9EDF7' }}>
                      {disciplinaryActions.map((action: DisciplinaryAction) => {
                        const disciplinaryTypeStyles: Record<string, { bg: string; text: string }> = {
                          warning_verbal: { bg: '#FFF8E5', text: '#FFCE20' },
                          warning_written: { bg: '#FFF4E5', text: '#F26522' },
                          blame: { bg: '#FFEDD5', text: '#EA580C' },
                          suspension: { bg: '#FEE2E2', text: '#EE5D50' },
                          demotion: { bg: '#FECACA', text: '#DC2626' },
                          termination: { bg: '#DC2626', text: 'white' },
                        };
                        const typeStyle = disciplinaryTypeStyles[action.action_type] || { bg: '#E5ECF6', text: '#5B6B82' };

                        return (
                          <tr
                            key={action.id}
                            className="transition-colors duration-150"
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FAFCFE'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="font-semibold text-sm" style={{ color: '#2B3674' }}>{action.employee_name}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className="inline-flex items-center px-3 py-1 text-xs font-semibold"
                                style={{ backgroundColor: typeStyle.bg, color: typeStyle.text, borderRadius: '20px' }}
                              >
                                {DISCIPLINARY_TYPES[action.action_type]?.label || action.action_type}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-sm" style={{ color: '#2B3674' }}>{formatDate(action.incident_date)}</span>
                            </td>
                            <td className="px-6 py-4 max-w-xs">
                              <span className="text-sm line-clamp-2" style={{ color: '#2B3674' }}>{action.description}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {action.appeal_status === 'pending' ? (
                                <span
                                  className="inline-flex items-center px-3 py-1 text-xs font-semibold"
                                  style={{ backgroundColor: '#FFF8E5', color: '#FFCE20', borderRadius: '20px' }}
                                >
                                  En cours
                                </span>
                              ) : action.appeal_status === 'accepted' ? (
                                <span
                                  className="inline-flex items-center px-3 py-1 text-xs font-semibold"
                                  style={{ backgroundColor: '#E6FAF5', color: '#05CD99', borderRadius: '20px' }}
                                >
                                  Accepté
                                </span>
                              ) : action.appeal_status === 'rejected' ? (
                                <span
                                  className="inline-flex items-center px-3 py-1 text-xs font-semibold"
                                  style={{ backgroundColor: '#FEE2E2', color: '#EE5D50', borderRadius: '20px' }}
                                >
                                  Rejeté
                                </span>
                              ) : (
                                <span style={{ color: '#A3AED0' }}>-</span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedDisciplinary(action)}
                                className="p-2 rounded-lg transition-all duration-200 hover:scale-110"
                                style={{ backgroundColor: '#E3F5FF', color: '#0088CC' }}
                                title="Voir les détails"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Employee Form Modal */}
          {showEmployeeModal && (
            <EmployeeFormModal
              employeeId={selectedEmployeeId}
              onClose={() => {
                setShowEmployeeModal(false);
                setSelectedEmployeeId(null);
              }}
            />
          )}

          {/* Delete Employee Confirmation */}
          <AlertDialog open={!!employeeToDelete} onOpenChange={() => setEmployeeToDelete(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer l'employé ?</AlertDialogTitle>
                <AlertDialogDescription>
                  Êtes-vous sûr de vouloir supprimer {employeeToDelete?.first_name} {employeeToDelete?.last_name} ?
                  Cette action est irréversible et supprimera toutes les données associées.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteEmployee}
                  disabled={deleteEmployeeMutation.isPending}
                  className="bg-red-500 hover:bg-red-600"
                >
                  {deleteEmployeeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Contract Details Modal */}
          <Dialog open={!!selectedContract} onOpenChange={() => setSelectedContract(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Détails du contrat</DialogTitle>
              </DialogHeader>
              {selectedContract && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-gray-400">Employé</Label>
                      <p className="font-medium text-gray-900">{selectedContract.employee_name}</p>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-gray-400">Type de contrat</Label>
                      <p className="font-medium text-gray-900">
                        {CONTRACT_TYPES[selectedContract.contract_type]?.label || selectedContract.contract_type}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-gray-400">Poste</Label>
                      <p className="font-medium text-gray-900">{selectedContract.position}</p>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-gray-400">Département</Label>
                      <p className="font-medium text-gray-900">{selectedContract.department}</p>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-gray-400">Date de début</Label>
                      <p className="font-medium text-gray-900">{formatDate(selectedContract.start_date)}</p>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-gray-400">Date de fin</Label>
                      <p className="font-medium text-gray-900">
                        {selectedContract.end_date ? formatDate(selectedContract.end_date) : 'Indéterminée'}
                      </p>
                    </div>
                    {selectedContract.trial_end_date && (
                      <div>
                        <Label className="text-xs uppercase tracking-wide text-gray-400">Fin période d'essai</Label>
                        <p className="font-medium text-gray-900">{formatDate(selectedContract.trial_end_date)}</p>
                      </div>
                    )}
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-gray-400">Salaire de base</Label>
                      <p className="font-medium text-green-600">{formatMoney(selectedContract.base_salary)}</p>
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedContract(null)}>
                  Fermer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Disciplinary Details Modal */}
          <Dialog open={!!selectedDisciplinary} onOpenChange={() => setSelectedDisciplinary(null)}>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Action disciplinaire</DialogTitle>
              </DialogHeader>
              {selectedDisciplinary && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-gray-400">Employé</Label>
                      <p className="font-medium text-gray-900">{selectedDisciplinary.employee_name}</p>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-gray-400">Type</Label>
                      <p className="font-medium text-gray-900">
                        {DISCIPLINARY_TYPES[selectedDisciplinary.action_type]?.label || selectedDisciplinary.action_type}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-gray-400">Date de l'incident</Label>
                      <p className="font-medium text-gray-900">{formatDate(selectedDisciplinary.incident_date)}</p>
                    </div>
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-gray-400">Date de décision</Label>
                      <p className="font-medium text-gray-900">{formatDate(selectedDisciplinary.decision_date)}</p>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-gray-400">Description</Label>
                    <p className="mt-1 text-sm text-gray-900">{selectedDisciplinary.description}</p>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-wide text-gray-400">Décision</Label>
                    <p className="mt-1 text-sm text-gray-900">{selectedDisciplinary.decision}</p>
                  </div>
                  {selectedDisciplinary.appeal_deadline && (
                    <div>
                      <Label className="text-xs uppercase tracking-wide text-gray-400">Date limite de recours</Label>
                      <p className="font-medium text-gray-900">{formatDate(selectedDisciplinary.appeal_deadline)}</p>
                    </div>
                  )}
                  <div className="text-xs text-gray-400">
                    Créé par {selectedDisciplinary.created_by_name} le {formatDate(selectedDisciplinary.created_at)}
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setSelectedDisciplinary(null)}>
                  Fermer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Document Upload Modal */}
          {showDocumentUploadModal && selectedEmployeeForModal && (
            <DocumentUploadModal
              employeeId={selectedEmployeeForModal.id}
              employeeName={selectedEmployeeForModal.name}
              onClose={() => {
                setShowDocumentUploadModal(false);
                setSelectedEmployeeForModal(null);
              }}
            />
          )}

          {/* Contract Form Modal */}
          {showContractFormModal && selectedEmployeeForModal && (
            <ContractFormModal
              employeeId={selectedEmployeeForModal.id}
              employeeName={selectedEmployeeForModal.name}
              onClose={() => {
                setShowContractFormModal(false);
                setSelectedEmployeeForModal(null);
              }}
            />
          )}

          {/* Disciplinary Form Modal */}
          {showDisciplinaryFormModal && selectedEmployeeForModal && (
            <DisciplinaryFormModal
              employeeId={selectedEmployeeForModal.id}
              employeeName={selectedEmployeeForModal.name}
              onClose={() => {
                setShowDisciplinaryFormModal(false);
                setSelectedEmployeeForModal(null);
              }}
            />
          )}
        </div>
      </div>
    </AppLayout>
  );
}
