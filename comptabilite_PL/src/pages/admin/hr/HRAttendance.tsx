import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { usePermission } from '@/hooks/usePermission';
import {
  Clock,
  AlertTriangle,
  TrendingUp,
  Search,
  Filter,
  Plus,
  Check,
  Edit,
  Trash2,
} from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useToast } from '@/hooks/use-toast';
import AttendanceRecordForm from '@/components/admin/hr/AttendanceRecordForm';
import OvertimeApprovalModal from '@/components/admin/hr/OvertimeApprovalModal';
import AnomalyResolutionModal from '@/components/admin/hr/AnomalyResolutionModal';
import AdminAttendanceEditor from '@/components/admin/hr/AdminAttendanceEditor';

interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  employee_number: string;
  attendance_date: string;  // Alias for work_date
  work_date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  check_in_time: string | null;  // Formatted time string
  check_out_time: string | null;  // Formatted time string
  worked_minutes: number | null;  // Alias for net_worked_minutes
  net_worked_minutes: number | null;
  day_status: string;
  status: string;  // Alias for day_status (backward compat)
  late_minutes: number;
  early_leave_minutes: number;
  overtime_minutes: number;
  is_anomaly: boolean;
  anomaly_type: string | null;
  hours_to_recover: number | null;  // Recovery hours for recovery_off status
}

interface OvertimeRequest {
  id: string;
  employee_name: string;
  employee_number: string;
  request_date: string;
  start_time: string;
  end_time: string;
  estimated_hours: number;
  reason: string;
  status: string;
  priority: string;
}

export default function HRAttendance() {
  const { hr } = usePermission();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize state from URL params for filter persistence
  const [activeTab, setActiveTab] = useState<'records' | 'anomalies' | 'overtime'>(
    (searchParams.get('tab') as 'records' | 'anomalies' | 'overtime') || 'records'
  );
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('from') || new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(searchParams.get('to') || new Date().toISOString().split('T')[0]);

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeTab !== 'records') params.set('tab', activeTab);
    if (searchTerm) params.set('search', searchTerm);
    if (statusFilter) params.set('status', statusFilter);
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    setSearchParams(params, { replace: true });
  }, [activeTab, searchTerm, statusFilter, dateFrom, dateTo, setSearchParams]);
  const [showOvertimeApprovalModal, setShowOvertimeApprovalModal] = useState(false);
  const [selectedOvertimeRequestId, setSelectedOvertimeRequestId] = useState<string | null>(null);
  const [showAnomalyResolutionModal, setShowAnomalyResolutionModal] = useState(false);
  const [selectedAnomalyId, setSelectedAnomalyId] = useState<string | null>(null);
  const [showAdminEditor, setShowAdminEditor] = useState(false);
  const [editingRecord, setEditingRecord] = useState<{ employeeId: string; date: string; name: string } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ employeeId: string; date: string; name: string } | null>(null);

  // Delete attendance mutation
  const deleteMutation = useMutation({
    mutationFn: async ({ employeeId, date }: { employeeId: string; date: string }) => {
      const formattedDate = date.includes('T') ? date.split('T')[0] : date;
      const response = await apiClient.delete(`/hr/attendance/admin/delete?employee_id=${employeeId}&date=${formattedDate}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['hr-attendance-anomalies'] });
      toast({ title: 'Succes', description: 'Pointage supprime avec succes' });
      setDeleteConfirm(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur',
        description: error.response?.data?.error || 'Erreur lors de la suppression',
        variant: 'destructive'
      });
    }
  });

  // Fetch attendance records
  const { data: attendanceData, isLoading: attendanceLoading } = useQuery({
    queryKey: ['hr-attendance', dateFrom, dateTo, statusFilter, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (dateFrom) params.append('start_date', dateFrom);
      if (dateTo) params.append('end_date', dateTo);
      if (statusFilter) params.append('status', statusFilter);

      const response = await apiClient.get<{ success: boolean; data: AttendanceRecord[] }>(`/hr/attendance?${params.toString()}`);
      return (response as any).data;
    },
    enabled: activeTab === 'records',
  });

  // Fetch anomalies
  const { data: anomaliesData, isLoading: anomaliesLoading } = useQuery({
    queryKey: ['hr-attendance-anomalies'],
    queryFn: async () => {
      const response = await apiClient.get<{ success: boolean; data: AttendanceRecord[] }>('/hr/attendance/anomalies');
      return (response as any).data;
    },
    enabled: activeTab === 'anomalies',
  });

  // Fetch overtime requests
  const { data: overtimeData, isLoading: overtimeLoading } = useQuery({
    queryKey: ['hr-overtime-requests', statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.append('status', statusFilter);

      const response = await apiClient.get<{ success: boolean; data: OvertimeRequest[] }>(`/hr/attendance/overtime/requests?${params.toString()}`);
      return (response as any).data;
    },
    enabled: activeTab === 'overtime',
  });

  const attendance = attendanceData || [];
  const anomalies = anomaliesData || [];
  const overtime = overtimeData || [];

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      present: 'bg-green-100 text-green-800',
      absent: 'bg-red-100 text-red-800',
      late: 'bg-orange-100 text-orange-800',
      early_leave: 'bg-yellow-100 text-yellow-800',
      partial: 'bg-yellow-100 text-yellow-800',
      pending: 'bg-blue-100 text-blue-800',
      leave: 'bg-indigo-100 text-indigo-800',
      holiday: 'bg-purple-100 text-purple-800',
      weekend: 'bg-gray-100 text-gray-600',
      recovery_off: 'bg-teal-100 text-teal-800',
      recovery: 'bg-teal-100 text-teal-800',
      recovery_paid: 'bg-teal-100 text-teal-800',  // Deprecated - migration en cours
      recovery_unpaid: 'bg-teal-100 text-teal-800',  // Deprecated - migration en cours
      mission: 'bg-cyan-100 text-cyan-800',
      training: 'bg-violet-100 text-violet-800',
      sick: 'bg-pink-100 text-pink-800',
      half_day: 'bg-purple-100 text-purple-800',
      overtime: 'bg-amber-100 text-amber-800',
    };
    const labels: Record<string, string> = {
      present: 'Présent',
      absent: 'Absent',
      late: 'En retard',
      early_leave: 'Départ anticipé',
      partial: 'Partiel',
      pending: 'En cours',
      leave: 'Congé',
      holiday: 'Jour férié',
      weekend: 'Weekend',
      recovery_off: 'À récupérer',
      recovery: 'Récupération',
      recovery_paid: 'Récupération',  // Deprecated
      recovery_unpaid: 'Récupération',  // Deprecated
      mission: 'Mission',
      training: 'Formation',
      sick: 'Maladie',
      half_day: 'Demi-journée',
      overtime: 'Heures Sup',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      urgent: 'bg-red-100 text-red-800',
      high: 'bg-orange-100 text-orange-800',
      normal: 'bg-blue-100 text-blue-800',
      low: 'bg-gray-100 text-gray-800',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[priority] || styles.normal}`}>
        {priority}
      </span>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Clock className="h-7 w-7 text-blue-600" />
              Temps & Présence
            </h1>
            <p className="text-gray-600 mt-1">
              Gestion de la présence, anomalies et heures supplémentaires
            </p>
          </div>
          <div className="flex gap-3">
            {hr.canRecordAttendance && (
              <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                <Plus className="h-5 w-5" />
                Enregistrer Présence
              </button>
            )}
            {hr.canCorrectAttendance && (
              <button
                onClick={() => setShowAdminEditor(true)}
                className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Edit className="h-5 w-5" />
                Corriger / Déclarer
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('records')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'records'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Clock className="h-4 w-4 inline mr-2" />
              Enregistrements
            </button>
            <button
              onClick={() => setActiveTab('anomalies')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'anomalies'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <AlertTriangle className="h-4 w-4 inline mr-2" />
              Anomalies ({anomalies.length})
            </button>
            <button
              onClick={() => setActiveTab('overtime')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overtime'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <TrendingUp className="h-4 w-4 inline mr-2" />
              Heures Supplémentaires
            </button>
          </nav>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Rechercher un employé..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full border border-gray-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Tous les statuts</option>
                <option value="present">Présent</option>
                <option value="absent">Absent</option>
                <option value="late">En retard</option>
                <option value="early_leave">Départ anticipé</option>
                <option value="partial">Partiel</option>
                <option value="pending">En cours</option>
                <option value="leave">Congé</option>
                <option value="holiday">Jour férié</option>
                <option value="mission">Mission</option>
                <option value="training">Formation</option>
              </select>
            </div>
            <button className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-200">
              <Filter className="h-4 w-4" />
              Filtres
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'records' && (
          <>
            {/* Attendance Record Form */}
            {hr.canRecordAttendance && <AttendanceRecordForm />}

            <div className="bg-white rounded-lg shadow overflow-hidden">
              {attendanceLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Chargement...</p>
              </div>
            ) : attendance.length === 0 ? (
              <div className="p-8 text-center">
                <Clock className="h-12 w-12 text-gray-400 mx-auto" />
                <p className="mt-2 text-gray-600">Aucun enregistrement trouvé</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Employé
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Entrée
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Sortie
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Heures
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
                    {attendance.map((record: AttendanceRecord) => (
                      <tr key={record.id} className={record.is_anomaly ? 'bg-red-50' : 'hover:bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{record.employee_name}</div>
                          <div className="text-sm text-gray-500">{record.employee_number}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(record.attendance_date).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.check_in_time || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.check_out_time || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {record.status === 'recovery_off'
                            ? `${record.hours_to_recover || 8}h (à récupérer)`
                            : record.worked_minutes ? (record.worked_minutes / 60).toFixed(2) + 'h' : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(record.status)}
                          {record.is_anomaly && (
                            <AlertTriangle className="h-4 w-4 text-red-500 inline ml-2" />
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right flex gap-2 justify-end">
                          {hr.canCorrectAttendance && (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRecord({
                                  employeeId: record.employee_id,
                                  date: record.work_date || record.attendance_date,
                                  name: record.employee_name
                                });
                                setShowAdminEditor(true);
                              }}
                              className="text-blue-600 hover:text-blue-900 p-1 rounded hover:bg-blue-50 transition-colors"
                              title="Modifier ce pointage"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm({
                              employeeId: record.employee_id,
                              date: record.work_date || record.attendance_date,
                              name: record.employee_name
                            })}
                            className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50 transition-colors"
                            title="Supprimer ce pointage"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

        {activeTab === 'anomalies' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {anomaliesLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Chargement...</p>
              </div>
            ) : anomalies.length === 0 ? (
              <div className="p-8 text-center">
                <Check className="h-12 w-12 text-green-500 mx-auto" />
                <p className="mt-2 text-gray-600">Aucune anomalie à résoudre</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {anomalies.map((anomaly: AttendanceRecord) => (
                  <div key={anomaly.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                          <div>
                            <p className="font-medium text-gray-900">{anomaly.employee_name}</p>
                            <p className="text-sm text-gray-600">
                              {anomaly.employee_number} • {new Date(anomaly.attendance_date).toLocaleDateString('fr-FR')}
                            </p>
                          </div>
                        </div>
                        <p className="mt-2 text-sm text-red-600">
                          Type: {anomaly.anomaly_type?.replace('_', ' ')}
                        </p>
                      </div>
                      {hr.canCorrectAttendance && (
                        <button
                          onClick={() => {
                            setSelectedAnomalyId(anomaly.id);
                            setShowAnomalyResolutionModal(true);
                          }}
                          className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700"
                        >
                          Résoudre
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'overtime' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {overtimeLoading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Chargement...</p>
              </div>
            ) : overtime.length === 0 ? (
              <div className="p-8 text-center">
                <TrendingUp className="h-12 w-12 text-gray-400 mx-auto" />
                <p className="mt-2 text-gray-600">Aucune demande d'heures supplémentaires</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Employé
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Horaires
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Heures
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Priorité
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
                    {overtime.map((request: OvertimeRequest) => (
                      <tr
                        key={request.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          setSelectedOvertimeRequestId(request.id);
                          setShowOvertimeApprovalModal(true);
                        }}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-medium text-gray-900">{request.employee_name}</div>
                          <div className="text-sm text-gray-500">{request.employee_number}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(request.request_date).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {request.start_time} - {request.end_time}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {request.estimated_hours}h
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getPriorityBadge(request.priority)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(request.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            className="text-blue-600 hover:text-blue-900"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOvertimeRequestId(request.id);
                              setShowOvertimeApprovalModal(true);
                            }}
                          >
                            Voir détails
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Overtime Approval Modal */}
        {showOvertimeApprovalModal && selectedOvertimeRequestId && (
          <OvertimeApprovalModal
            requestId={selectedOvertimeRequestId}
            onClose={() => {
              setShowOvertimeApprovalModal(false);
              setSelectedOvertimeRequestId(null);
            }}
          />
        )}

        {/* Anomaly Resolution Modal */}
        {showAnomalyResolutionModal && selectedAnomalyId && (
          <AnomalyResolutionModal
            attendanceId={selectedAnomalyId}
            onClose={() => {
              setShowAnomalyResolutionModal(false);
              setSelectedAnomalyId(null);
            }}
          />
        )}

        {/* Admin Attendance Editor Modal */}
        {showAdminEditor && (
          <AdminAttendanceEditor
            onClose={() => {
              setShowAdminEditor(false);
              setEditingRecord(null);
            }}
            onSuccess={() => {
              // Invalidate queries to refresh data
              queryClient.invalidateQueries({ queryKey: ['hr-attendance'] });
              setShowAdminEditor(false);
              setEditingRecord(null);
            }}
            initialEmployeeId={editingRecord?.employeeId}
            initialDate={editingRecord?.date}
          />
        )}

        {/* Delete Confirmation Dialog */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Confirmer la suppression
                </h3>
              </div>
              <p className="text-gray-600 mb-6">
                Voulez-vous vraiment supprimer le pointage de{' '}
                <strong>{deleteConfirm.name}</strong> pour le{' '}
                <strong>{new Date(deleteConfirm.date).toLocaleDateString('fr-FR')}</strong> ?
                <br />
                <span className="text-red-500 text-sm mt-2 block">
                  Cette action est irreversible.
                </span>
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={() => deleteMutation.mutate({
                    employeeId: deleteConfirm.employeeId,
                    date: deleteConfirm.date
                  })}
                  disabled={deleteMutation.isPending}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
