import { useState, useEffect, useRef } from 'react';
import { X, UserPlus, User, Mail, Phone, Calendar, MapPin, Briefcase, Hash, AlertCircle, Plus, Trash2, Users, Target, Gift, Camera, FileText, Eye, Shield, CreditCard, AlertTriangle, File } from 'lucide-react';
import { ProtectedButton } from '@/components/ui/ProtectedButton';
import { apiClient } from '@/lib/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSegments } from '@/hooks/useSegments';
import { DocumentUploadModal } from './DocumentUploadModal';
import { ContractFormModal } from './ContractFormModal';
import { DisciplinaryFormModal } from './DisciplinaryFormModal';

interface ManagerEntry {
  manager_id: string;
  rank: number;
  manager_name?: string;
}

interface EmployeeFormModalProps {
  employeeId: string | null;
  onClose: () => void;
}

// Types pour les primes
interface PrimeType {
  id: string;
  code: string;
  label: string;
  description?: string;
  category: 'imposable' | 'exoneree';
  exemption_ceiling: number;
  exemption_unit: 'month' | 'day' | 'percent';
  display_order: number;
}

interface EmployeePrime {
  id?: string;
  employee_id?: string;
  prime_type_code: string;
  is_active: boolean;
  amount: number;
  frequency: 'monthly' | 'daily' | 'yearly' | 'one_time';
  notes?: string;
  // Champs joints depuis hr_prime_types
  label?: string;
  category?: 'imposable' | 'exoneree';
  exemption_ceiling?: number;
  exemption_unit?: string;
  display_order?: number;
}

// Types pour les documents du dossier employé
interface EmployeeDocument {
  id: string;
  employee_id: string;
  document_type: string;
  title: string;
  description?: string;
  file_url?: string;
  expiry_date?: string;
  is_verified?: boolean;
  uploaded_at: string;
}

interface EmployeeContract {
  id: string;
  employee_id: string;
  contract_type: string;
  start_date: string;
  end_date?: string;
  trial_period_end?: string;
  base_salary?: number;
  position?: string;
  document_url?: string;
  created_at: string;
}

interface DisciplinaryAction {
  id: string;
  employee_id: string;
  action_type: string;
  severity: string;
  issue_date: string;
  reason: string;
  description?: string;
  document_url?: string;
  created_at: string;
}

interface Employee {
  id: string;
  employee_number: string;
  first_name: string;
  last_name: string;
  cin?: string;
  birth_date?: string;
  birth_place?: string;
  email?: string;
  phone?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  hire_date: string;
  termination_date?: string;
  employment_status: 'active' | 'terminated' | 'suspended' | 'on_leave';
  employment_type?: 'full_time' | 'part_time' | 'intern' | 'freelance' | 'temporary';
  position?: string;
  segment_id?: string;
  manager_id?: string;
  notes?: string;
  requires_clocking?: boolean;
  hourly_rate?: number;
  is_cnss_subject?: boolean;
  is_amo_subject?: boolean;
  social_security_number?: string;
  inscription_objective?: number;
  objective_period_start?: string;
  objective_period_end?: string;
  payroll_cutoff_day?: number;
  // Champs IR
  marital_status?: 'single' | 'married' | 'divorced' | 'widowed';
  spouse_dependent?: boolean;
  dependent_children?: number;
  other_dependents?: number;
  professional_category?: 'normal' | 'increased' | 'special_35' | 'special_40' | 'special_45';
  cimr_affiliated?: boolean;
  cimr_rate?: number;
  mutual_affiliated?: boolean;
  mutual_contribution?: number;
  initial_leave_balance?: number; // Solde de congé initial (en jours)
  // Documents du dossier (retournés par l'API)
  contracts?: EmployeeContract[];
  documents?: EmployeeDocument[];
  disciplinary_actions?: DisciplinaryAction[];
}

export default function EmployeeFormModal({ employeeId, onClose }: EmployeeFormModalProps) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    employee_number: '',
    first_name: '',
    last_name: '',
    cin: '',
    birth_date: '',
    birth_place: '',
    email: '',
    phone: '',
    address: '',
    postal_code: '',
    city: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    hire_date: '',
    termination_date: '',
    employment_status: 'active',
    employment_type: 'full_time',
    position: '',
    segment_id: '',
    notes: '',
    requires_clocking: false,
    profile_id: '',
    hourly_rate: '' as string | number,
    is_cnss_subject: true,
    is_amo_subject: true,
    social_security_number: '',
    inscription_objective: '' as string | number,
    objective_period_start: '',
    objective_period_end: '',
    payroll_cutoff_day: 18 as number | string,
    // Champs IR
    marital_status: 'single' as 'single' | 'married' | 'divorced' | 'widowed',
    spouse_dependent: false,
    dependent_children: 0 as number | string,
    other_dependents: 0 as number | string,
    professional_category: 'normal' as 'normal' | 'increased' | 'special_35' | 'special_40' | 'special_45',
    cimr_affiliated: false,
    cimr_rate: 0 as number | string,
    mutual_affiliated: false,
    mutual_contribution: 0 as number | string,
    initial_leave_balance: 0 as number | string,
  });

  // State pour les managers multiples avec rangs
  const [employeeManagers, setEmployeeManagers] = useState<ManagerEntry[]>([]);

  // State pour les primes employé
  const [primeTypes, setPrimeTypes] = useState<PrimeType[]>([]);
  const [employeePrimes, setEmployeePrimes] = useState<Record<string, EmployeePrime>>({});

  // State pour la photo employé
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // State pour les modals de documents
  const [showDocumentModal, setShowDocumentModal] = useState(false);
  const [showContractModal, setShowContractModal] = useState(false);
  const [showDisciplinaryModal, setShowDisciplinaryModal] = useState(false);

  const isEdit = !!employeeId;

  // Fetch employee data if editing
  const { data: employeeData } = useQuery({
    queryKey: ['hr-employee', employeeId],
    queryFn: async () => {
      if (!employeeId) return null;
      const response = await apiClient.get(`/hr/employees/${employeeId}`);
      return (response as any).data as Employee;
    },
    enabled: !!employeeId,
  });

  // Fetch segments for dropdown
  const { data: segments = [] } = useSegments();

  // Fetch potential managers (active employees)
  const { data: managersData } = useQuery({
    queryKey: ['hr-potential-managers'],
    queryFn: async () => {
      const response = await apiClient.get('/hr/employees?status=active');
      return (response as any).data as Employee[];
    },
  });
  const managers = managersData || [];

  // Fetch available profiles for linking (not already linked to other employees)
  const { data: profilesData } = useQuery({
    queryKey: ['available-profiles', employeeId],
    queryFn: async () => {
      const params = employeeId ? `?current_employee_id=${employeeId}` : '';
      const response = await apiClient.get(`/profiles/available-for-employee${params}`);
      return (response as any).data as Array<{ id: string; username: string; full_name: string }>;
    },
  });
  const availableProfiles = profilesData || [];

  // Fetch prime types (référentiel)
  const { data: primeTypesData } = useQuery({
    queryKey: ['hr-prime-types'],
    queryFn: async () => {
      const response = await apiClient.get('/hr/employees/prime-types');
      return (response as any).data as PrimeType[];
    },
  });

  // Fetch employee primes (when editing)
  const { data: employeePrimesData } = useQuery({
    queryKey: ['hr-employee-primes', employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const response = await apiClient.get(`/hr/employees/${employeeId}/primes`);
      return (response as any).data as EmployeePrime[];
    },
    enabled: !!employeeId,
  });

  // Fetch existing managers for this employee (when editing)
  const { data: existingManagersData } = useQuery({
    queryKey: ['hr-employee-managers', employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const response = await apiClient.get(`/hr/employees/${employeeId}/managers`);
      return (response as any).data as Array<{ manager_id: string; rank: number; manager_name: string }>;
    },
    enabled: !!employeeId,
  });

  // Helper to format date for input type="date" (YYYY-MM-DD)
  const formatDateForInput = (dateValue: string | null | undefined): string => {
    if (!dateValue) return '';
    // Handle ISO date strings like "2024-01-15T00:00:00.000Z"
    const date = new Date(dateValue);
    if (isNaN(date.getTime())) return '';
    return date.toISOString().split('T')[0];
  };

  // Load employee data when editing
  useEffect(() => {
    if (employeeData) {
      setFormData({
        employee_number: employeeData.employee_number || '',
        first_name: employeeData.first_name || '',
        last_name: employeeData.last_name || '',
        cin: employeeData.cin || '',
        birth_date: formatDateForInput(employeeData.birth_date),
        birth_place: employeeData.birth_place || '',
        email: employeeData.email || '',
        phone: employeeData.phone || '',
        address: employeeData.address || '',
        postal_code: employeeData.postal_code || '',
        city: employeeData.city || '',
        emergency_contact_name: employeeData.emergency_contact_name || '',
        emergency_contact_phone: employeeData.emergency_contact_phone || '',
        hire_date: formatDateForInput(employeeData.hire_date),
        termination_date: formatDateForInput(employeeData.termination_date),
        employment_status: employeeData.employment_status || 'active',
        employment_type: employeeData.employment_type || 'full_time',
        position: employeeData.position || '',
        segment_id: employeeData.segment_id || '',
        notes: employeeData.notes || '',
        requires_clocking: employeeData.requires_clocking || false,
        profile_id: (employeeData as any).profile_id || '',
        hourly_rate: employeeData.hourly_rate ?? '',
        is_cnss_subject: employeeData.is_cnss_subject ?? true,
        is_amo_subject: employeeData.is_amo_subject ?? true,
        social_security_number: employeeData.social_security_number || '',
        inscription_objective: employeeData.inscription_objective ?? '',
        objective_period_start: formatDateForInput(employeeData.objective_period_start),
        objective_period_end: formatDateForInput(employeeData.objective_period_end),
        payroll_cutoff_day: employeeData.payroll_cutoff_day ?? 18,
        // Champs IR
        marital_status: employeeData.marital_status || 'single',
        spouse_dependent: employeeData.spouse_dependent ?? false,
        dependent_children: employeeData.dependent_children ?? 0,
        other_dependents: employeeData.other_dependents ?? 0,
        professional_category: employeeData.professional_category || 'normal',
        cimr_affiliated: employeeData.cimr_affiliated ?? false,
        cimr_rate: employeeData.cimr_rate ?? 0,
        mutual_affiliated: employeeData.mutual_affiliated ?? false,
        mutual_contribution: employeeData.mutual_contribution ?? 0,
        initial_leave_balance: employeeData.initial_leave_balance ?? 0,
      });
      // Load photo URL
      if ((employeeData as any).photo_url) {
        setPhotoUrl((employeeData as any).photo_url);
      }
    }
  }, [employeeData]);

  // Load existing managers when editing
  useEffect(() => {
    if (existingManagersData && existingManagersData.length > 0) {
      setEmployeeManagers(
        existingManagersData.map(m => ({
          manager_id: m.manager_id,
          rank: m.rank,
          manager_name: m.manager_name
        }))
      );
    }
  }, [existingManagersData]);

  // Load prime types from API
  useEffect(() => {
    if (primeTypesData) {
      setPrimeTypes(primeTypesData);
    }
  }, [primeTypesData]);

  // Load employee primes when editing
  useEffect(() => {
    if (employeePrimesData && employeePrimesData.length > 0) {
      const primesMap: Record<string, EmployeePrime> = {};
      for (const prime of employeePrimesData) {
        primesMap[prime.prime_type_code] = prime;
      }
      setEmployeePrimes(primesMap);
    }
  }, [employeePrimesData]);

  // Mutation pour sauvegarder les managers d'un employé
  const saveManagers = async (empId: string) => {
    if (employeeManagers.length > 0) {
      await apiClient.put(`/hr/employees/${empId}/managers`, {
        managers: employeeManagers.map(m => ({
          manager_id: m.manager_id,
          rank: m.rank
        }))
      });
    }
  };

  // Mutation pour sauvegarder les primes d'un employé
  const savePrimes = async (empId: string) => {
    const primesToSave = Object.values(employeePrimes).filter(p =>
      p.is_active || p.amount > 0
    );

    if (primesToSave.length > 0) {
      await apiClient.put(`/hr/employees/${empId}/primes`, {
        primes: primesToSave.map(p => ({
          prime_type_code: p.prime_type_code,
          is_active: p.is_active,
          amount: p.amount || 0,
          frequency: p.frequency || 'monthly',
          notes: p.notes
        }))
      });
    }
  };

  // Helper pour mettre à jour une prime
  const handlePrimeChange = (primeCode: string, updates: Partial<EmployeePrime>) => {
    setEmployeePrimes(prev => {
      const existing = prev[primeCode];
      const defaultPrime: EmployeePrime = {
        prime_type_code: primeCode,
        is_active: false,
        amount: 0,
        frequency: 'monthly'
      };
      return {
        ...prev,
        [primeCode]: {
          ...defaultPrime,
          ...existing,
          ...updates
        }
      };
    });
  };

  // Create mutation
  const createEmployee = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiClient.post('/hr/employees', data);
      return (response as any).data as Employee;
    },
    onSuccess: async (newEmployee) => {
      // Sauvegarder les managers après création
      if (employeeManagers.length > 0) {
        try {
          await saveManagers(newEmployee.id);
        } catch (error) {
          console.error('Erreur lors de la sauvegarde des managers:', error);
        }
      }
      // Sauvegarder les primes après création
      try {
        await savePrimes(newEmployee.id);
      } catch (error) {
        console.error('Erreur lors de la sauvegarde des primes:', error);
      }
      // Upload de la photo après création
      if (photoFile) {
        try {
          await uploadPhoto(newEmployee.id);
        } catch (error) {
          console.error('Erreur lors de l\'upload de la photo:', error);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      queryClient.invalidateQueries({ queryKey: ['hr-potential-managers'] });
      onClose();
    },
  });

  // Update mutation
  const updateEmployee = useMutation({
    mutationFn: async (data: typeof formData) => {
      const response = await apiClient.put(`/hr/employees/${employeeId}`, data);
      return (response as any).data as Employee;
    },
    onSuccess: async () => {
      // Sauvegarder les managers après mise à jour
      try {
        await saveManagers(employeeId!);
      } catch (error) {
        console.error('Erreur lors de la sauvegarde des managers:', error);
      }
      // Sauvegarder les primes après mise à jour
      try {
        await savePrimes(employeeId!);
      } catch (error) {
        console.error('Erreur lors de la sauvegarde des primes:', error);
      }
      // Upload de la photo après mise à jour
      if (photoFile) {
        try {
          await uploadPhoto(employeeId!);
        } catch (error) {
          console.error('Erreur lors de l\'upload de la photo:', error);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      queryClient.invalidateQueries({ queryKey: ['hr-employee', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['hr-employee-managers', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['hr-employee-primes', employeeId] });
      queryClient.invalidateQueries({ queryKey: ['hr-potential-managers'] });
      onClose();
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.first_name.trim() || !formData.last_name.trim() || !formData.employee_number.trim() || !formData.hire_date) {
      alert('Veuillez remplir tous les champs obligatoires (Matricule, Prénom, Nom, Date d\'embauche)');
      return;
    }

    // Validation des managers: si des managers sont définis, le rang 0 (N) est obligatoire
    if (employeeManagers.length > 0 && !employeeManagers.some(m => m.rank === 0)) {
      alert('Un manager direct (rang N) est obligatoire');
      return;
    }

    try {
      if (isEdit) {
        await updateEmployee.mutateAsync(formData);
      } else {
        await createEmployee.mutateAsync(formData);
      }
    } catch (error: any) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert(error.response?.data?.error || 'Erreur lors de la sauvegarde de l\'employé');
    }
  };

  const handleChange = (field: string, value: string | boolean | number | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle photo selection
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Format non supporté. Utilisez JPG, PNG ou WEBP.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('La photo est trop volumineuse (max 5 MB)');
      return;
    }

    setPhotoFile(file);
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Upload photo to server
  const uploadPhoto = async (empId: string) => {
    if (!photoFile) return;

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append('photo', photoFile);

      // Get token from sessionStorage first (session), then localStorage (persistent)
      const token = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');

      const response = await fetch(`/api/hr/employees/${empId}/photo`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erreur lors de l\'upload de la photo');
      }

      const result = await response.json();
      setPhotoUrl(result.data.photo_url);
      setPhotoFile(null);
      setPhotoPreview(null);
    } catch (error: any) {
      console.error('Error uploading photo:', error);
      alert(error.message || 'Erreur lors de l\'upload de la photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Delete photo
  const deletePhoto = async () => {
    if (!employeeId || !photoUrl) return;

    if (!confirm('Êtes-vous sûr de vouloir supprimer la photo ?')) return;

    try {
      // Get token from sessionStorage first (session), then localStorage (persistent)
      const token = sessionStorage.getItem('auth_token') || localStorage.getItem('auth_token');

      const response = await fetch(`/api/hr/employees/${employeeId}/photo`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la suppression de la photo');
      }

      setPhotoUrl(null);
      setPhotoFile(null);
      setPhotoPreview(null);
      queryClient.invalidateQueries({ queryKey: ['hr-employee', employeeId] });
    } catch (error: any) {
      console.error('Error deleting photo:', error);
      alert(error.message || 'Erreur lors de la suppression de la photo');
    }
  };

  const isPending = createEmployee.isPending || updateEmployee.isPending;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <UserPlus className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                {isEdit
                  ? `${employeeData?.first_name || ''} ${employeeData?.last_name || ''}`.trim() || 'Modifier l\'employé'
                  : 'Nouvel employé'}
              </h2>
              <p className="text-sm text-gray-500">
                {isEdit ? 'Modifier les informations de l\'employé' : 'Ajoutez un nouvel employé au système RH'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Photo de l'employé */}
          <div className="flex items-start gap-6 pb-6 border-b border-gray-200">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                {(photoPreview || photoUrl) ? (
                  <img
                    src={photoPreview || photoUrl || ''}
                    alt="Photo employé"
                    className="w-32 h-32 rounded-full object-cover border-4 border-gray-200"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gray-100 border-4 border-gray-200 flex items-center justify-center">
                    <User className="w-16 h-16 text-gray-400" />
                  </div>
                )}
                {uploadingPhoto && (
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handlePhotoSelect}
                className="hidden"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                  title="Changer la photo"
                >
                  <Camera className="w-4 h-4" />
                  {photoUrl || photoPreview ? 'Changer' : 'Ajouter'}
                </button>
                {(photoUrl || photoPreview) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (photoUrl && isEdit) {
                        deletePhoto();
                      } else {
                        setPhotoFile(null);
                        setPhotoPreview(null);
                      }
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                    title="Supprimer la photo"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              {photoFile && (
                <p className="text-xs text-amber-600">
                  Photo en attente d'upload
                </p>
              )}
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                <Camera className="w-5 h-5 text-blue-600" />
                Photo d'identité
              </h3>
              <p className="text-sm text-gray-500">
                Ajoutez une photo d'identité de l'employé. Formats acceptés : JPG, PNG, WEBP (max 5 MB).
                {isEdit && photoFile && (
                  <button
                    type="button"
                    onClick={() => uploadPhoto(employeeId!)}
                    disabled={uploadingPhoto}
                    className="ml-2 text-blue-600 hover:text-blue-800 underline"
                  >
                    Enregistrer maintenant
                  </button>
                )}
              </p>
            </div>
          </div>

          {/* Informations de base */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              Informations de base
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Matricule */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Matricule *
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    required
                    value={formData.employee_number}
                    onChange={(e) => handleChange('employee_number', e.target.value)}
                    placeholder="Ex: EMP001"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Prénom */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prénom *
                </label>
                <input
                  type="text"
                  required
                  value={formData.first_name}
                  onChange={(e) => handleChange('first_name', e.target.value)}
                  placeholder="Ex: Ahmed"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Nom */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom *
                </label>
                <input
                  type="text"
                  required
                  value={formData.last_name}
                  onChange={(e) => handleChange('last_name', e.target.value)}
                  placeholder="Ex: Benali"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* CIN */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  CIN
                </label>
                <input
                  type="text"
                  value={formData.cin}
                  onChange={(e) => handleChange('cin', e.target.value.toUpperCase())}
                  placeholder="Ex: AB123456"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                />
              </div>

              {/* Date de naissance */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date de naissance
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="date"
                    value={formData.birth_date}
                    onChange={(e) => handleChange('birth_date', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Lieu de naissance */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Lieu de naissance
                </label>
                <input
                  type="text"
                  value={formData.birth_place}
                  onChange={(e) => handleChange('birth_place', e.target.value)}
                  placeholder="Ex: Casablanca"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Phone className="w-5 h-5 text-blue-600" />
              Contact
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    placeholder="email@example.com"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Téléphone */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Téléphone
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                    placeholder="0612345678"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Adresse */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adresse
                </label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                  <textarea
                    value={formData.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    placeholder="Adresse complète"
                    rows={2}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Code postal */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Code postal
                </label>
                <input
                  type="text"
                  value={formData.postal_code}
                  onChange={(e) => handleChange('postal_code', e.target.value)}
                  placeholder="Ex: 20000"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Ville */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ville
                </label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => handleChange('city', e.target.value)}
                  placeholder="Ex: Casablanca"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Contact d'urgence */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Contact d'urgence
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nom contact urgence */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nom du contact
                </label>
                <input
                  type="text"
                  value={formData.emergency_contact_name}
                  onChange={(e) => handleChange('emergency_contact_name', e.target.value)}
                  placeholder="Nom complet"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Téléphone contact urgence */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Téléphone du contact
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="tel"
                    value={formData.emergency_contact_phone}
                    onChange={(e) => handleChange('emergency_contact_phone', e.target.value)}
                    placeholder="0612345678"
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Informations professionnelles */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-blue-600" />
              Informations professionnelles
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Date d'embauche */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date d'embauche *
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="date"
                    required
                    value={formData.hire_date}
                    onChange={(e) => handleChange('hire_date', e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Statut d'emploi */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Statut d'emploi
                </label>
                <select
                  value={formData.employment_status}
                  onChange={(e) => handleChange('employment_status', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="active">Actif</option>
                  <option value="on_leave">En congé</option>
                  <option value="suspended">Suspendu</option>
                  <option value="terminated">Terminé</option>
                </select>
              </div>

              {/* Type d'emploi */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type d'emploi
                </label>
                <select
                  value={formData.employment_type}
                  onChange={(e) => handleChange('employment_type', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="full_time">Temps plein</option>
                  <option value="part_time">Temps partiel</option>
                  <option value="intern">Stagiaire</option>
                  <option value="freelance">Freelance</option>
                  <option value="temporary">Temporaire</option>
                </select>
              </div>

              {/* Date de fin de contrat - visible pour tous types sauf CDI, ou si statut terminé */}
              {(formData.employment_type !== 'full_time' || formData.employment_status === 'terminated') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date de fin de contrat
                    {formData.employment_type === 'temporary' && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="date"
                      value={formData.termination_date}
                      onChange={(e) => handleChange('termination_date', e.target.value)}
                      title="Date de fin de contrat"
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {formData.employment_type === 'temporary' ? 'Obligatoire pour les CDD' : 'Date de fin prévue du contrat'}
                  </p>
                </div>
              )}

              {/* Poste */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Poste
                </label>
                <input
                  type="text"
                  value={formData.position}
                  onChange={(e) => handleChange('position', e.target.value)}
                  placeholder="Ex: Développeur"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Segment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Segment
                </label>
                <select
                  value={formData.segment_id}
                  onChange={(e) => handleChange('segment_id', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Aucun segment</option>
                  {segments.map((segment: { id: string; name: string }) => (
                    <option key={segment.id} value={segment.id}>
                      {segment.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Salaire horaire */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Salaire horaire (MAD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.hourly_rate}
                  onChange={(e) => handleChange('hourly_rate', e.target.value ? parseFloat(e.target.value) : undefined)}
                  placeholder="Ex: 50.00"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* CNSS / AMO Checkboxes */}
              <div className="md:col-span-3 flex flex-wrap items-center gap-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_cnss_subject"
                    checked={formData.is_cnss_subject}
                    onChange={(e) => handleChange('is_cnss_subject', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_cnss_subject" className="text-sm font-medium text-gray-700">
                    Assujetti CNSS
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_amo_subject"
                    checked={formData.is_amo_subject}
                    onChange={(e) => handleChange('is_amo_subject', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="is_amo_subject" className="text-sm font-medium text-gray-700">
                    Assujetti AMO
                  </label>
                </div>
                <p className="text-xs text-gray-500 w-full mt-2">
                  Ces options affectent le calcul des cotisations sociales sur la paie.
                </p>
              </div>

              {/* N° CNSS Employé */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  N° CNSS Employé
                </label>
                <input
                  type="text"
                  value={formData.social_security_number}
                  onChange={(e) => handleChange('social_security_number', e.target.value)}
                  placeholder="Ex: 123456789"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Numéro d'immatriculation CNSS de l'employé (apparaîtra sur les bulletins de paie)
                </p>
              </div>

              {/* Situation familiale pour IR */}
              <div className="md:col-span-3 p-4 bg-amber-50 rounded-lg border border-amber-200">
                <h3 className="text-sm font-medium text-amber-800 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Situation familiale (calcul IR)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Situation matrimoniale */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Situation matrimoniale
                    </label>
                    <select
                      value={formData.marital_status}
                      onChange={(e) => handleChange('marital_status', e.target.value)}
                      title="Situation matrimoniale"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="single">Célibataire</option>
                      <option value="married">Marié(e)</option>
                      <option value="divorced">Divorcé(e)</option>
                      <option value="widowed">Veuf/Veuve</option>
                    </select>
                  </div>

                  {/* Conjoint à charge - visible si marié */}
                  {formData.marital_status === 'married' && (
                    <div className="flex items-center">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="spouse_dependent"
                          checked={formData.spouse_dependent}
                          onChange={(e) => handleChange('spouse_dependent', e.target.checked)}
                          className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
                        />
                        <label htmlFor="spouse_dependent" className="text-sm font-medium text-gray-700">
                          Conjoint à charge
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Enfants à charge */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Enfants à charge
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="6"
                      value={formData.dependent_children}
                      onChange={(e) => handleChange('dependent_children', parseInt(e.target.value) || 0)}
                      title="Nombre d'enfants à charge"
                      placeholder="0"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Moins de 27 ans</p>
                  </div>

                  {/* Autres personnes à charge */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Autres à charge
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="6"
                      value={formData.other_dependents}
                      onChange={(e) => handleChange('other_dependents', parseInt(e.target.value) || 0)}
                      title="Autres personnes à charge"
                      placeholder="0"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">Parents, etc.</p>
                  </div>
                </div>

                {/* Affichage du total déductions */}
                {(() => {
                  const total = (formData.spouse_dependent && formData.marital_status === 'married' ? 1 : 0) +
                    (Number(formData.dependent_children) || 0) +
                    (Number(formData.other_dependents) || 0);
                  const totalCapped = Math.min(total, 6);
                  const deduction = (totalCapped * 41.67).toFixed(2);
                  return (
                    <p className="text-xs text-amber-700 mt-3 font-medium">
                      Total personnes à charge: {totalCapped} → Déduction IR: {deduction} DH/mois (max 250 DH)
                    </p>
                  );
                })()}
              </div>

              {/* Catégorie professionnelle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Catégorie professionnelle
                </label>
                <select
                  value={formData.professional_category}
                  onChange={(e) => handleChange('professional_category', e.target.value)}
                  title="Catégorie professionnelle"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="normal">Normale (20%)</option>
                  <option value="increased">Majorée (25%)</option>
                  <option value="special_35">Spéciale - Journalistes (35%)</option>
                  <option value="special_40">Spéciale - Mineurs (40%)</option>
                  <option value="special_45">Spéciale - Autres (45%)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">Taux frais professionnels (plafond 2 500 DH/mois)</p>
              </div>

              {/* Affiliations complémentaires */}
              <div className="md:col-span-2 p-4 bg-green-50 rounded-lg border border-green-200">
                <h3 className="text-sm font-medium text-green-800 mb-3">
                  Affiliations complémentaires
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* CIMR */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        id="cimr_affiliated"
                        checked={formData.cimr_affiliated}
                        onChange={(e) => handleChange('cimr_affiliated', e.target.checked)}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                      />
                      <label htmlFor="cimr_affiliated" className="text-sm font-medium text-gray-700">
                        Affilié CIMR
                      </label>
                    </div>
                    {formData.cimr_affiliated && (
                      <select
                        value={formData.cimr_rate}
                        onChange={(e) => handleChange('cimr_rate', parseFloat(e.target.value))}
                        title="Taux CIMR"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      >
                        <option value="3">3%</option>
                        <option value="4">4%</option>
                        <option value="6">6%</option>
                      </select>
                    )}
                  </div>

                  {/* Mutuelle */}
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        id="mutual_affiliated"
                        checked={formData.mutual_affiliated}
                        onChange={(e) => handleChange('mutual_affiliated', e.target.checked)}
                        className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                      />
                      <label htmlFor="mutual_affiliated" className="text-sm font-medium text-gray-700">
                        Affilié Mutuelle
                      </label>
                    </div>
                    {formData.mutual_affiliated && (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.mutual_contribution}
                        onChange={(e) => handleChange('mutual_contribution', parseFloat(e.target.value) || 0)}
                        placeholder="Cotisation mensuelle (DH)"
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Primes et Indemnités */}
              {primeTypes.length > 0 && (
                <div className="md:col-span-3 p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <h3 className="text-sm font-medium text-purple-800 mb-4 flex items-center gap-2">
                    <Gift className="w-4 h-4" />
                    Primes et Indemnités
                  </h3>

                  {/* Primes IMPOSABLES */}
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold text-red-700 uppercase mb-2 flex items-center gap-1">
                      <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                      Primes Imposables (soumises intégralement à l'IR)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {primeTypes
                        .filter(pt => pt.category === 'imposable' && pt.code !== 'prime_rendement')
                        .map(prime => {
                          const primeValue = employeePrimes[prime.code] || {
                            prime_type_code: prime.code,
                            is_active: false,
                            amount: 0,
                            frequency: 'monthly' as const
                          };
                          return (
                            <div
                              key={prime.code}
                              className={`p-3 rounded-lg border transition-colors ${
                                primeValue.is_active
                                  ? 'bg-red-100 border-red-300'
                                  : 'bg-white border-gray-200'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <input
                                  type="checkbox"
                                  id={`prime_${prime.code}`}
                                  checked={primeValue.is_active}
                                  onChange={(e) =>
                                    handlePrimeChange(prime.code, { is_active: e.target.checked })
                                  }
                                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                                />
                                <label
                                  htmlFor={`prime_${prime.code}`}
                                  className="text-sm font-medium text-gray-700 cursor-pointer"
                                >
                                  {prime.label}
                                </label>
                              </div>

                              {primeValue.is_active && (
                                <div className="flex items-center gap-2 ml-6">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={primeValue.amount || ''}
                                    onChange={(e) =>
                                      handlePrimeChange(prime.code, {
                                        amount: parseFloat(e.target.value) || 0
                                      })
                                    }
                                    placeholder="Montant"
                                    className="w-28 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-red-500"
                                  />
                                  <span className="text-xs text-gray-500">MAD/mois</span>
                                </div>
                              )}

                              {prime.description && (
                                <p className="text-xs text-gray-500 mt-1 ml-6">{prime.description}</p>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Primes EXONÉRÉES */}
                  <div>
                    <h4 className="text-xs font-semibold text-green-700 uppercase mb-2 flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                      Primes Exonérées (avec plafonds d'exonération)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {primeTypes
                        .filter(pt => pt.category === 'exoneree')
                        .map(prime => {
                          const primeValue = employeePrimes[prime.code] || {
                            prime_type_code: prime.code,
                            is_active: false,
                            amount: 0,
                            frequency: 'monthly' as const
                          };
                          return (
                            <div
                              key={prime.code}
                              className={`p-3 rounded-lg border transition-colors ${
                                primeValue.is_active
                                  ? 'bg-green-100 border-green-300'
                                  : 'bg-white border-gray-200'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <input
                                  type="checkbox"
                                  id={`prime_${prime.code}`}
                                  checked={primeValue.is_active}
                                  onChange={(e) =>
                                    handlePrimeChange(prime.code, { is_active: e.target.checked })
                                  }
                                  className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
                                />
                                <label
                                  htmlFor={`prime_${prime.code}`}
                                  className="text-sm font-medium text-gray-700 cursor-pointer"
                                >
                                  {prime.label}
                                </label>
                              </div>

                              {primeValue.is_active && (
                                <div className="flex items-center gap-2 ml-6">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={primeValue.amount || ''}
                                    onChange={(e) =>
                                      handlePrimeChange(prime.code, {
                                        amount: parseFloat(e.target.value) || 0
                                      })
                                    }
                                    placeholder="Montant"
                                    className="w-28 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-green-500"
                                  />
                                  <span className="text-xs text-gray-500">
                                    MAD/{prime.exemption_unit === 'day' ? 'jour' : 'mois'}
                                  </span>
                                </div>
                              )}

                              {prime.exemption_ceiling > 0 && (
                                <p className="text-xs text-green-600 mt-1 ml-6">
                                  Exonéré jusqu'à {prime.exemption_ceiling}{' '}
                                  {prime.exemption_unit === 'percent'
                                    ? '% du salaire base'
                                    : prime.exemption_unit === 'day'
                                    ? 'MAD/jour'
                                    : 'MAD/mois'}
                                </p>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>

                  {/* Résumé des primes actives */}
                  {Object.values(employeePrimes).some(p => p.is_active && p.amount > 0) && (
                    <div className="mt-4 pt-3 border-t border-purple-200">
                      <p className="text-xs text-purple-700 font-medium">
                        Total primes mensuelles:{' '}
                        {Object.values(employeePrimes)
                          .filter(p => p.is_active && p.amount > 0)
                          .reduce((sum, p) => sum + (p.amount || 0), 0)
                          .toFixed(2)}{' '}
                        MAD
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Objectif d'Inscription (Prime Assistante) */}
              <div className="md:col-span-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="text-sm font-medium text-blue-800 mb-3 flex items-center gap-2">
                  <Target className="w-4 h-4" />
                  Objectif d'Inscription (Prime Assistante)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Objectif (nombre d'inscrits)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.inscription_objective}
                      onChange={(e) => handleChange('inscription_objective', e.target.value ? parseInt(e.target.value) : '')}
                      placeholder="Ex: 50"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Jour de coupure paie
                    </label>
                    <select
                      value={formData.payroll_cutoff_day}
                      onChange={(e) => handleChange('payroll_cutoff_day', parseInt(e.target.value))}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      aria-label="Jour de coupure paie"
                    >
                      {Array.from({ length: 28 }, (_, i) => i + 1).map(day => (
                        <option key={day} value={day}>{day}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      Ex: 18 = période du 19 mois précédent au 18 mois courant
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Calendar className="w-4 h-4 inline mr-1 text-green-600" />
                      Solde congé initial (jours)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={formData.initial_leave_balance}
                      onChange={(e) => handleChange('initial_leave_balance', e.target.value ? parseFloat(e.target.value) : 0)}
                      placeholder="Ex: 18"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Solde de congé initial lors de l'embauche (affiché sur le bulletin de paie)
                    </p>
                  </div>
                </div>
                <p className="text-xs text-blue-600 mt-3">
                  La prime d'inscription sera affichée en vert si l'objectif est atteint, en rouge sinon (non comptabilisée en paie).
                </p>
              </div>

              {/* Managers multiples avec rangs */}
              <div className="md:col-span-3">
                <div className="flex items-center justify-between mb-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Users className="w-4 h-4 text-blue-600" />
                    Chaîne hiérarchique
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      // Trouver le prochain rang disponible
                      const existingRanks = employeeManagers.map(m => m.rank);
                      let nextRank = 0;
                      while (existingRanks.includes(nextRank)) {
                        nextRank++;
                      }
                      setEmployeeManagers([...employeeManagers, { manager_id: '', rank: nextRank }]);
                    }}
                    className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Ajouter un niveau
                  </button>
                </div>

                {employeeManagers.length === 0 ? (
                  <div className="text-center py-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <Users className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Aucun manager configuré</p>
                    <p className="text-xs text-gray-400 mt-1">Cliquez sur "Ajouter un niveau" pour configurer la chaîne hiérarchique</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {employeeManagers
                      .sort((a, b) => a.rank - b.rank)
                      .map((entry, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                          {/* Badge du rang */}
                          <div className="flex-shrink-0 w-16 text-center">
                            <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                              entry.rank === 0
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-200 text-gray-700'
                            }`}>
                              N{entry.rank === 0 ? '' : `+${entry.rank}`}
                            </span>
                          </div>

                          {/* Select du manager */}
                          <select
                            value={entry.manager_id}
                            onChange={(e) => {
                              const newManagers = [...employeeManagers];
                              newManagers[index] = { ...entry, manager_id: e.target.value };
                              setEmployeeManagers(newManagers);
                            }}
                            title={`Manager niveau N${entry.rank === 0 ? '' : `+${entry.rank}`}`}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                          >
                            <option value="">Sélectionner un manager</option>
                            {managers
                              .filter((m: Employee) =>
                                m.id !== employeeId && // Ne pas se sélectionner soi-même
                                !employeeManagers.some(em => em.manager_id === m.id && em !== entry) // Ne pas avoir le même manager 2 fois
                              )
                              .map((manager: Employee) => (
                                <option key={manager.id} value={manager.id}>
                                  {manager.first_name} {manager.last_name} - {manager.position || 'N/A'}
                                </option>
                              ))}
                          </select>

                          {/* Bouton supprimer */}
                          <button
                            type="button"
                            onClick={() => {
                              setEmployeeManagers(employeeManagers.filter((_, i) => i !== index));
                            }}
                            className="flex-shrink-0 p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Supprimer ce niveau"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}

                    <p className="text-xs text-gray-500 mt-2">
                      <strong>N</strong> = Manager direct (obligatoire), <strong>N+1</strong> = Supérieur du manager, <strong>N+2, N+3...</strong> = Niveaux supérieurs.
                      Les demandes suivent cette chaîne séquentiellement.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Compte utilisateur */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-purple-600" />
              Compte utilisateur
            </h3>
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <label htmlFor="profile_id" className="block text-sm font-medium text-gray-700 mb-2">
                Lier a un compte utilisateur
              </label>
              <select
                id="profile_id"
                value={formData.profile_id}
                onChange={(e) => handleChange('profile_id', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">Aucun compte lie</option>
                {availableProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.username} {profile.full_name ? `(${profile.full_name})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-600 mt-2">
                Necessaire pour que l'employe puisse pointer via son compte.
                Seuls les comptes non lies a d'autres employes sont affiches.
              </p>
            </div>
          </div>

          {/* Section Documents du Dossier - Only show when editing */}
          {isEdit && employeeId && (
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Documents du Dossier
              </h3>

              {/* Quick Add Buttons */}
              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setShowDocumentModal(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Document (CIN, CNSS, CV...)
                </button>
                <button
                  type="button"
                  onClick={() => setShowContractModal(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Contrat
                </button>
                <button
                  type="button"
                  onClick={() => setShowDisciplinaryModal(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Action Disciplinaire
                </button>
              </div>

              {/* Documents List */}
              <div className="space-y-4">
                {/* Contracts */}
                {employeeData?.contracts && employeeData.contracts.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h4 className="font-medium text-green-800 mb-2 flex items-center gap-2">
                      <Briefcase className="w-4 h-4" />
                      Contrats ({employeeData.contracts.length})
                    </h4>
                    <div className="space-y-2">
                      {employeeData.contracts.map((contract) => (
                        <div key={contract.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-green-100">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                              <FileText className="w-4 h-4 text-green-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">
                                {contract.contract_type?.toUpperCase() || 'Contrat'}
                              </p>
                              <p className="text-xs text-gray-500">
                                Du {new Date(contract.start_date).toLocaleDateString('fr-FR')}
                                {contract.end_date && ` au ${new Date(contract.end_date).toLocaleDateString('fr-FR')}`}
                              </p>
                            </div>
                          </div>
                          {contract.document_url && (
                            <a
                              href={contract.document_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200"
                            >
                              <Eye className="w-3 h-3" />
                              Voir
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Documents (CIN, CNSS, CV, etc.) */}
                {employeeData?.documents && employeeData.documents.length > 0 && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
                      <File className="w-4 h-4" />
                      Documents ({employeeData.documents.length})
                    </h4>
                    <div className="space-y-2">
                      {employeeData.documents.map((doc) => (
                        <div key={doc.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-blue-100">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              doc.document_type === 'cin' ? 'bg-purple-100' :
                              doc.document_type === 'cnss' ? 'bg-orange-100' :
                              doc.document_type === 'rib' ? 'bg-yellow-100' :
                              doc.document_type === 'cv' ? 'bg-cyan-100' :
                              doc.document_type === 'diploma' ? 'bg-pink-100' :
                              'bg-blue-100'
                            }`}>
                              {doc.document_type === 'cin' ? <CreditCard className="w-4 h-4 text-purple-600" /> :
                               doc.document_type === 'cnss' ? <Shield className="w-4 h-4 text-orange-600" /> :
                               <FileText className={`w-4 h-4 ${
                                 doc.document_type === 'rib' ? 'text-yellow-600' :
                                 doc.document_type === 'cv' ? 'text-cyan-600' :
                                 doc.document_type === 'diploma' ? 'text-pink-600' :
                                 'text-blue-600'
                               }`} />
                              }
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">
                                {doc.title || doc.document_type?.toUpperCase()}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(doc.uploaded_at).toLocaleDateString('fr-FR')}
                                {doc.expiry_date && ` • Expire: ${new Date(doc.expiry_date).toLocaleDateString('fr-FR')}`}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {doc.is_verified && (
                              <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">Vérifié</span>
                            )}
                            {doc.file_url && (
                              <a
                                href={doc.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                              >
                                <Eye className="w-3 h-3" />
                                Voir
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Disciplinary Actions */}
                {employeeData?.disciplinary_actions && employeeData.disciplinary_actions.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <h4 className="font-medium text-red-800 mb-2 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Actions Disciplinaires ({employeeData.disciplinary_actions.length})
                    </h4>
                    <div className="space-y-2">
                      {employeeData.disciplinary_actions.map((action) => (
                        <div key={action.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-red-100">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                              <AlertTriangle className="w-4 h-4 text-red-600" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">
                                {action.action_type === 'verbal_warning' ? 'Avertissement verbal' :
                                 action.action_type === 'written_warning' ? 'Avertissement écrit' :
                                 action.action_type === 'blame' ? 'Blâme' :
                                 action.action_type === 'suspension' ? 'Mise à pied' :
                                 action.action_type === 'dismissal' ? 'Licenciement' :
                                 action.action_type}
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(action.issue_date).toLocaleDateString('fr-FR')} • {action.reason}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-xs px-2 py-0.5 rounded ${
                              action.severity === 'low' ? 'bg-yellow-100 text-yellow-700' :
                              action.severity === 'medium' ? 'bg-orange-100 text-orange-700' :
                              action.severity === 'high' ? 'bg-red-100 text-red-700' :
                              'bg-red-200 text-red-800'
                            }`}>
                              {action.severity === 'low' ? 'Faible' :
                               action.severity === 'medium' ? 'Moyen' :
                               action.severity === 'high' ? 'Élevé' :
                               action.severity === 'critical' ? 'Critique' : action.severity}
                            </span>
                            {action.document_url && (
                              <a
                                href={action.document_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                              >
                                <Eye className="w-3 h-3" />
                                Voir
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {(!employeeData?.contracts || employeeData.contracts.length === 0) &&
                 (!employeeData?.documents || employeeData.documents.length === 0) &&
                 (!employeeData?.disciplinary_actions || employeeData.disciplinary_actions.length === 0) && (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border border-gray-200">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">Aucun document dans le dossier</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Utilisez les boutons ci-dessus pour ajouter des documents
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Requires Clocking Checkbox */}
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <input
              type="checkbox"
              id="requires_clocking"
              checked={formData.requires_clocking}
              onChange={(e) => handleChange('requires_clocking', e.target.checked)}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
            />
            <label htmlFor="requires_clocking" className="flex-1">
              <div className="text-sm font-medium text-gray-900">
                Cet employé doit pointer
              </div>
              <div className="text-xs text-gray-600 mt-1">
                Si coché, l'employé devra enregistrer ses heures d'arrivée et de départ.
                Les vacataires et partenaires ne doivent pas pointer.
              </div>
            </label>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Notes internes sur l'employé..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 sticky bottom-0 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Annuler
            </button>
            <ProtectedButton
              permission={isEdit ? 'hr.employees.update' : 'hr.employees.create'}
              type="submit"
              disabled={isPending}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending
                ? 'Enregistrement...'
                : isEdit
                ? 'Mettre à jour'
                : 'Créer l\'employé'}
            </ProtectedButton>
          </div>
        </form>
      </div>

      {/* Document Upload Modals */}
      {showDocumentModal && employeeId && (
        <DocumentUploadModal
          employeeId={employeeId}
          employeeName={`${formData.first_name} ${formData.last_name}`}
          onClose={() => {
            setShowDocumentModal(false);
            // Refresh employee data to show new document
            queryClient.invalidateQueries({ queryKey: ['hr-employee', employeeId] });
          }}
        />
      )}

      {showContractModal && employeeId && (
        <ContractFormModal
          employeeId={employeeId}
          employeeName={`${formData.first_name} ${formData.last_name}`}
          onClose={() => {
            setShowContractModal(false);
            // Refresh employee data to show new contract
            queryClient.invalidateQueries({ queryKey: ['hr-employee', employeeId] });
          }}
        />
      )}

      {showDisciplinaryModal && employeeId && (
        <DisciplinaryFormModal
          employeeId={employeeId}
          employeeName={`${formData.first_name} ${formData.last_name}`}
          onClose={() => {
            setShowDisciplinaryModal(false);
            // Refresh employee data to show new disciplinary action
            queryClient.invalidateQueries({ queryKey: ['hr-employee', employeeId] });
          }}
        />
      )}
    </div>
  );
}
