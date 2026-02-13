import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Search,
  User,
  Calendar,
  Clock,
  FileText,
  Edit,
  Plus,
  AlertTriangle,
  Info,
  CheckCircle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';

interface AdminAttendanceEditorProps {
  onClose: () => void;
  onSuccess?: () => void;
  initialEmployeeId?: string;
  initialDate?: string;
}

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
}

interface AttendanceRecord {
  id: string;
  employee_id: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  worked_minutes: number | null;
  is_manual_entry: boolean;
  source: string;
  notes: string | null;
}

interface CorrectionRequest {
  id: string;
  status: string;
  requested_check_in: string | null;
  requested_check_out: string | null;
  reason: string;
}

interface AttendanceByDateData {
  employee: {
    id: string;
    name: string;
    employee_number: string;
  };
  date: string;
  break_duration_minutes: number;
  has_records: boolean;
  records: AttendanceRecord[];
  pending_correction_request: CorrectionRequest | null;
  public_holiday: { name: string } | null;
  recovery_day: { recovery_name: string } | null;
}

type Mode = 'search' | 'review' | 'edit' | 'declare-presence' | 'declare-absence' | 'loading';

export default function AdminAttendanceEditor({ onClose, onSuccess, initialEmployeeId, initialDate }: AdminAttendanceEditorProps) {
  const queryClient = useQueryClient();

  // State management
  const [mode, setMode] = useState<Mode>(() => {
    // Bouton "Modifier" : initialEmployeeId + initialDate fournis
    if (initialEmployeeId && initialDate) {
      return 'loading'; // Va auto-fetch puis passer en 'edit'
    }
    // Bouton "Ajouter pointage" : pas d'initial values
    return 'declare-presence'; // Formulaire direct avec sélecteurs intégrés
  });
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    initialDate || new Date().toISOString().split('T')[0]
  );
  const [attendanceData, setAttendanceData] = useState<AttendanceByDateData | null>(null);
  const [initialSearchDone, setInitialSearchDone] = useState(false);

  const [formData, setFormData] = useState({
    check_in_time: '',
    check_out_time: '',
    status: 'present',
    absence_status: '',
    notes: '',
    correction_reason: '',
  });

  // Fetch active employees
  const { data: employeesData } = useQuery({
    queryKey: ['hr-employees-active'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: Employee[] }>(
        '/hr/employees?status=active'
      );
      return (response as any).data;
    },
  });
  const employees = employeesData || [];

  // Search attendance by date (manual trigger)
  const {
    data: searchData,
    refetch: searchAttendance,
    isFetching: isSearching,
  } = useQuery({
    queryKey: ['attendance-by-date', selectedEmployee?.id, selectedDate],
    queryFn: async () => {
      if (!selectedEmployee) return null;
      const response = await apiClient.get<{ success: boolean; data: AttendanceByDateData }>(
        `/hr/attendance/by-date?employee_id=${selectedEmployee.id}&date=${selectedDate}`
      );
      return (response as any).data;
    },
    enabled: false, // Manual trigger only
  });

  // Save mutation (edit or declare)
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiClient.put('/hr/attendance/admin/edit', data);
      return (response as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['hr-attendance-anomalies'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-by-date'] });
      if (onSuccess) onSuccess();
      alert('✅ Pointage mis à jour avec succès');
      onClose();
    },
    onError: (error: any) => {
      alert(
        `❌ Erreur : ${error.response?.data?.error || 'Erreur lors de la sauvegarde'}`
      );
    },
  });

  // Update attendance data when search completes
  useEffect(() => {
    if (searchData) {
      setAttendanceData(searchData);

      // Pre-fill form data if records exist
      if (searchData.has_records && searchData.records.length > 0) {
        const record = searchData.records[0];
        setFormData({
          check_in_time: record.check_in_time || '',
          check_out_time: record.check_out_time || '',
          status: record.status || 'present',
          absence_status: '',
          notes: record.notes || '',
          correction_reason: '',
        });
        // ✅ Passer directement en mode 'edit'
        setMode('edit');
      } else {
        // ✅ Passer directement en mode 'declare-presence'
        setMode('declare-presence');
      }
    }
  }, [searchData]);

  // Auto-select employee and search when initial values are provided
  useEffect(() => {
    if (initialEmployeeId && employees.length > 0 && !initialSearchDone) {
      const emp = employees.find((e: Employee) => e.id === initialEmployeeId);
      if (emp) {
        setSelectedEmployee(emp);
        setInitialSearchDone(true);
      }
    }
  }, [initialEmployeeId, employees, initialSearchDone]);

  // Auto-search when employee is selected from initial props
  useEffect(() => {
    if (selectedEmployee && initialEmployeeId && initialDate && initialSearchDone) {
      searchAttendance();
    }
  }, [selectedEmployee, initialEmployeeId, initialDate, initialSearchDone]);

  // Calculate worked time
  const workedMinutes = (() => {
    if (!formData.check_in_time || !formData.check_out_time) return null;
    const [inH, inM] = formData.check_in_time.split(':').map(Number);
    const [outH, outM] = formData.check_out_time.split(':').map(Number);
    const totalMinutes = (outH * 60 + outM) - (inH * 60 + inM);

    // Déduire la pause de l'employé
    const breakMinutes = attendanceData?.break_duration_minutes || 0;
    return Math.max(0, totalMinutes - breakMinutes);
  })();

  const formatDuration = (minutes: number | null): string => {
    if (minutes === null || minutes === undefined) return '-';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h${mins.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    return `${dateStr.split('-').reverse().join('/')} (${days[date.getDay()]})`;
  };

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      present: 'Présent',
      absent: 'Absent',
      late: 'En retard',
      early_leave: 'Départ anticipé',
      partial: 'Partiel',
      pending: 'En cours',
      leave: 'Congé',
      sick: 'Maladie',
      mission: 'Mission',
      training: 'Formation',
      holiday: 'Jour férié',
      weekend: 'Weekend',
      recovery_off: 'À récupérer',
      recovery_paid: 'Récup. payée',
      recovery_unpaid: 'Récup. non payée',
      half_day: 'Demi-journée',
    };
    return labels[status] || status;
  };

  // === HANDLERS ===

  const handleSearch = async () => {
    if (!selectedEmployee || !selectedDate) {
      alert('⚠️ Veuillez sélectionner un employé et une date');
      return;
    }
    await searchAttendance();
  };

  const handleSave = () => {
    // Determine action type
    const action = mode === 'edit' ? 'edit' : 'declare';

    // Validation
    if (action === 'edit') {
      if (!formData.correction_reason || formData.correction_reason.trim().length < 10) {
        alert('⚠️ Une raison de correction (min 10 caractères) est requise');
        return;
      }
    }

    if (action === 'declare') {
      if (!formData.notes || formData.notes.trim().length < 5) {
        alert('⚠️ Des notes (min 5 caractères) sont requises pour une déclaration');
        return;
      }
    }

    // Validate time logic
    if (formData.check_in_time && formData.check_out_time) {
      const [inH, inM] = formData.check_in_time.split(':').map(Number);
      const [outH, outM] = formData.check_out_time.split(':').map(Number);
      if (outH * 60 + outM <= inH * 60 + inM) {
        alert('⚠️ L\'heure de sortie doit être après l\'heure d\'entrée');
        return;
      }
    }

    // Build payload
    const payload = {
      employee_id: selectedEmployee!.id,
      date: selectedDate,
      action,
      check_in_time: formData.check_in_time || null,
      check_out_time: formData.check_out_time || null,
      status: formData.status,
      absence_status: formData.absence_status || null,
      notes: formData.notes || null,
      correction_reason: formData.correction_reason || null,
    };

    saveMutation.mutate(payload);
  };

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);

    // Reset form if switching to declare modes
    if (newMode === 'declare-presence' || newMode === 'declare-absence') {
      setFormData({
        check_in_time: '',
        check_out_time: '',
        status: 'present',
        absence_status: '',
        notes: '',
        correction_reason: '',
      });
    }
  };

  // === RENDER ===

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Edit className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {mode === 'edit' || mode === 'review' ? 'Modifier le Pointage' : 'Corriger / Déclarer un Pointage'}
              </h2>
              <p className="text-sm text-gray-600">
                {mode === 'search' && 'Rechercher un pointage'}
                {mode === 'review' && selectedEmployee && selectedDate && (
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-purple-600">{selectedEmployee.first_name} {selectedEmployee.last_name}</span>
                    <span>•</span>
                    <span className="font-medium">{new Date(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </span>
                )}
                {mode === 'edit' && selectedEmployee && selectedDate && (
                  <span className="flex items-center gap-2">
                    <span className="font-medium text-purple-600">{selectedEmployee.first_name} {selectedEmployee.last_name}</span>
                    <span>•</span>
                    <span className="font-medium">{new Date(selectedDate).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  </span>
                )}
                {mode === 'loading' && 'Chargement...'}
                {mode === 'declare-presence' && 'Déclarer une présence manuelle'}
                {mode === 'declare-absence' && 'Déclarer une absence'}
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

        {/* Content */}
        <div className="px-6 py-6 space-y-6">
          {/* === STEP 1: SEARCH === */}
          {mode === 'search' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">
                  Recherchez un employé et une date pour voir son pointage ou déclarer une nouvelle journée.
                </p>
              </div>

              {/* Employee Select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Employé *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <select
                    value={selectedEmployee?.id || ''}
                    onChange={(e) => {
                      const emp = employees.find((emp: Employee) => emp.id === e.target.value);
                      setSelectedEmployee(emp || null);
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">Sélectionnez un employé</option>
                    {employees.map((emp: Employee) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name} - {emp.employee_number}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Date Select */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date *
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Search Button */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSearch}
                  disabled={!selectedEmployee || !selectedDate || isSearching}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Search className="w-5 h-5" />
                  {isSearching ? 'Recherche...' : 'Rechercher'}
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}

          {/* === MODE LOADING === */}
          {mode === 'loading' && (
            <div className="flex flex-col items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-purple-600 mb-4" />
              <p className="text-gray-600">Chargement du pointage...</p>
            </div>
          )}

          {/* === STEP 2: REVIEW === */}
          {mode === 'review' && attendanceData && (
            <div className="space-y-4">
              {/* Employee & Date Info */}
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm text-gray-500">Employé</div>
                    <div className="font-medium text-gray-900">
                      {attendanceData.employee.name} ({attendanceData.employee.employee_number})
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-500">Date</div>
                    <div className="font-medium text-gray-900">
                      {formatDate(attendanceData.date)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Warnings */}
              {attendanceData.pending_correction_request && (
                <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-yellow-800">Demande de correction en attente</div>
                    <div className="text-sm text-yellow-700 mt-1">
                      Demandé : {attendanceData.pending_correction_request.requested_check_in || '-'} - {attendanceData.pending_correction_request.requested_check_out || '-'}
                    </div>
                    <div className="text-sm text-yellow-700">
                      (Cette demande sera annulée automatiquement si vous corrigez le pointage)
                    </div>
                  </div>
                </div>
              )}

              {attendanceData.public_holiday && (
                <div className="flex items-start gap-3 p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-orange-800">Jour férié</div>
                    <div className="text-sm text-orange-700">
                      {attendanceData.public_holiday.name}
                    </div>
                  </div>
                </div>
              )}

              {attendanceData.recovery_day && (
                <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-medium text-blue-800">Jour de récupération</div>
                    <div className="text-sm text-blue-700">
                      {attendanceData.recovery_day.recovery_name}
                    </div>
                  </div>
                </div>
              )}

              {/* Current Records */}
              {attendanceData.has_records ? (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <div className="font-medium text-green-800">Pointages trouvés</div>
                  </div>
                  {attendanceData.records.map((record, idx) => (
                    <div key={record.id} className="text-sm text-green-700 space-y-1">
                      <div>• Entrée: {record.check_in_time || '-'} | Sortie: {record.check_out_time || '-'}</div>
                      <div>• Travaillé: {formatDuration(record.worked_minutes)} | Statut: {getStatusLabel(record.status)}</div>
                      {record.source && <div>• Source: {record.source}</div>}
                      {record.notes && <div>• Note: {record.notes}</div>}
                      {idx < attendanceData.records.length - 1 && <hr className="my-2 border-green-300" />}
                    </div>
                  ))}

                  <div className="flex gap-3 mt-4 pt-4 border-t border-green-300">
                    <button
                      onClick={() => handleModeChange('edit')}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Edit className="w-5 h-5" />
                      Corriger ce pointage
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-3">
                    <Info className="w-5 h-5 text-gray-600" />
                    <div className="font-medium text-gray-800">Aucun pointage trouvé</div>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Aucun pointage enregistré pour cette date.
                  </p>

                  <div className="flex gap-3">
                    <button
                      onClick={() => handleModeChange('declare-presence')}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Plus className="w-5 h-5" />
                      Déclarer présence
                    </button>
                    <button
                      onClick={() => handleModeChange('declare-absence')}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                      <XCircle className="w-5 h-5" />
                      Déclarer absence
                    </button>
                  </div>
                </div>
              )}

              {/* Back Button */}
              <div className="flex justify-end pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setMode('search');
                    setAttendanceData(null);
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Nouvelle recherche
                </button>
              </div>
            </div>
          )}

          {/* === STEP 3A: EDIT FORM === */}
          {mode === 'edit' && attendanceData && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <Edit className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-purple-800">
                  Modifiez les heures et le statut du pointage. Les valeurs originales seront conservées pour audit.
                </p>
              </div>

              {/* Ancien Pointage - Affichage des valeurs existantes */}
              {attendanceData.records.length > 0 && (
                <div className="p-4 bg-gray-100 border-2 border-gray-300 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Pointage Existant</h4>
                    <span className="text-xs text-gray-500">Valeurs actuelles</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-white p-3 rounded border border-gray-200">
                      <div className="text-xs text-gray-500 mb-1">Entrée</div>
                      <div className="text-lg font-bold text-gray-900">
                        {attendanceData.records[0].check_in_time || '--:--'}
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded border border-gray-200">
                      <div className="text-xs text-gray-500 mb-1">Sortie</div>
                      <div className="text-lg font-bold text-gray-900">
                        {attendanceData.records[0].check_out_time || '--:--'}
                      </div>
                    </div>
                    <div className="bg-white p-3 rounded border border-gray-200">
                      <div className="text-xs text-gray-500 mb-1">Statut</div>
                      <div className="text-sm font-semibold text-gray-900">
                        {getStatusLabel(attendanceData.records[0].status)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Nouveau Pointage - Formulaire de modification */}
              <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-blue-700 uppercase tracking-wide">Nouveau Pointage</h4>
                  <span className="text-xs text-blue-600">À enregistrer</span>
                </div>

                <div className="space-y-4">
                  {/* Time Inputs */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pointage d'entrée
                      </label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                          type="time"
                          value={formData.check_in_time}
                          onChange={(e) => setFormData({ ...formData, check_in_time: e.target.value })}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pointage de sortie
                      </label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                          type="time"
                          value={formData.check_out_time}
                          onChange={(e) => setFormData({ ...formData, check_out_time: e.target.value })}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Statut
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="present">Présent</option>
                      <option value="absent">Absent</option>
                      <option value="late">En retard</option>
                      <option value="early_leave">Départ anticipé</option>
                      <option value="partial">Journée partielle</option>
                      <option value="leave">En congé</option>
                      <option value="sick">Maladie</option>
                      <option value="mission">Mission</option>
                      <option value="training">Formation</option>
                      <option value="holiday">Jour férié</option>
                      <option value="recovery_off">À récupérer</option>
                      <option value="recovery_paid">Récup. payée</option>
                      <option value="recovery_unpaid">Récup. non payée</option>
                    </select>
                  </div>

                  {/* Worked Time Display */}
                  <div className="p-3 bg-white border border-blue-200 rounded-lg">
                    <div className="text-sm text-gray-500">Temps calculé</div>
                    <div className="text-lg font-medium text-gray-900">
                      {formatDuration(workedMinutes)}
                    </div>
                  </div>

                  {/* Correction Reason */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Raison de correction *
                    </label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                      <textarea
                        value={formData.correction_reason}
                        onChange={(e) => setFormData({ ...formData, correction_reason: e.target.value })}
                        placeholder="Défaillance badge biométrique, confirmé par manager..."
                        rows={2}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Minimum 10 caractères</p>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notes additionnelles
                    </label>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Correction suite à réclamation employé..."
                      rows={2}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setMode('review')}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  <CheckCircle className="w-5 h-5" />
                  {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          )}

          {/* === STEP 3B: DECLARE PRESENCE === */}
          {mode === 'declare-presence' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <Plus className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800">
                  Déclarez une présence manuelle avec les horaires de travail.
                </p>
              </div>

              {/* Sélecteur employé - INTÉGRÉ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Employé *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <select
                    value={selectedEmployee?.id || ''}
                    onChange={(e) => {
                      const emp = employees.find((emp: Employee) => emp.id === e.target.value);
                      setSelectedEmployee(emp || null);
                    }}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Sélectionnez un employé</option>
                    {employees.map((emp: Employee) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name} - {emp.employee_number}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Sélecteur date - INTÉGRÉ */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date *
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Time Inputs */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pointage d'entrée *
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="time"
                      value={formData.check_in_time}
                      onChange={(e) => setFormData({ ...formData, check_in_time: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pointage de sortie *
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="time"
                      value={formData.check_out_time}
                      onChange={(e) => setFormData({ ...formData, check_out_time: e.target.value })}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Worked Time Display */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="text-sm text-gray-500">Temps calculé</div>
                <div className="text-lg font-medium text-gray-900">
                  {formatDuration(workedMinutes)}
                </div>
              </div>

              {/* Raison */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Raison / Notes *
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Employé en télétravail sans VPN, présence confirmée..."
                    rows={3}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Minimum 5 caractères</p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <CheckCircle className="w-5 h-5" />
                  {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          )}

          {/* === STEP 3C: DECLARE ABSENCE === */}
          {mode === 'declare-absence' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg">
                <XCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">
                  Déclarez une absence pour cette journée complète.
                </p>
              </div>

              {/* Absence Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type d'absence *
                </label>
                <select
                  value={formData.absence_status}
                  onChange={(e) => setFormData({ ...formData, absence_status: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                >
                  <option value="">Sélectionnez un type</option>
                  <option value="leave">Congé (leave)</option>
                  <option value="sick">Maladie (sick)</option>
                  <option value="mission">Mission (mission)</option>
                  <option value="training">Formation (training)</option>
                  <option value="absent">Absence injustifiée (absent)</option>
                  <option value="half_day">Demi-journée (half_day)</option>
                </select>
              </div>

              {/* Raison */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Raison / Notes *
                </label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 text-gray-400 w-5 h-5" />
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Congé approuvé par manager, email du 10/01..."
                    rows={3}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">Minimum 5 caractères</p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => setMode('review')}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  <CheckCircle className="w-5 h-5" />
                  {saveMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
