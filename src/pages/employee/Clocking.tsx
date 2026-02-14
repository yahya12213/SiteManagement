import { useState, useEffect, useRef } from 'react';
import { Clock, LogIn, LogOut, Calendar, TrendingUp, AlertCircle, CheckCircle, FileEdit, X, Coffee } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { AppLayout } from '@/components/layout/AppLayout';

// Modale de demande de correction de pointage
interface CorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  currentRecord: DayRecord | null;
  onSubmit: (data: { request_date: string; requested_check_in: string; requested_check_out: string; original_check_in: string; original_check_out: string; reason: string }) => void;
  isSubmitting: boolean;
}

function CorrectionModal({ isOpen, onClose, date, currentRecord, onSubmit, isSubmitting }: CorrectionModalProps) {
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [reason, setReason] = useState('');

  const formatTimeFromTimestamp = (timestamp: string | null) => {
    if (!timestamp) return null;
    return new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const originalCheckInTime = formatTimeFromTimestamp(currentRecord?.clock_in_at || null);
  const originalCheckOutTime = formatTimeFromTimestamp(currentRecord?.clock_out_at || null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      request_date: date,
      requested_check_in: checkIn || '',
      requested_check_out: checkOut || '',
      original_check_in: originalCheckInTime || '',
      original_check_out: originalCheckOutTime || '',
      reason
    });
  };

  const formatDateDisplay = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="fixed inset-0 bg-black/50" onClick={onClose} />
        <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileEdit className="h-5 w-5 text-blue-600" />
              Demande de correction
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="text"
                value={formatDateDisplay(date)}
                disabled
                className="w-full px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-gray-600"
              />
            </div>

            {/* Affichage du pointage actuel */}
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <div className="text-sm font-medium text-orange-800 mb-2">Pointage actuel enregistré</div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-orange-600">Entrée:</span>{' '}
                  <span className="font-bold text-orange-900">
                    {originalCheckInTime || 'Non enregistrée'}
                  </span>
                </div>
                <div>
                  <span className="text-orange-600">Sortie:</span>{' '}
                  <span className="font-bold text-orange-900">
                    {originalCheckOutTime || 'Non enregistrée'}
                  </span>
                </div>
              </div>
            </div>

            {/* Nouvelles heures demandées */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-sm font-medium text-blue-800 mb-2">Nouveau pointage demandé</div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-blue-600 mb-1">
                    Nouvelle entrée
                  </label>
                  <input
                    type="time"
                    value={checkIn}
                    onChange={(e) => setCheckIn(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-blue-600 mb-1">
                    Nouvelle sortie
                  </label>
                  <input
                    type="time"
                    value={checkOut}
                    onChange={(e) => setCheckOut(e.target.value)}
                    className="w-full px-3 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Motif <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
                rows={3}
                placeholder="Expliquez la raison de cette demande de correction..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !reason.trim() || (!checkIn && !checkOut)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Envoi...' : 'Soumettre'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Types pour le nouveau modèle de données unifié
interface TodayStatus {
  id: string | null;
  work_date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  day_status: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  scheduled_break_minutes: number;
  net_worked_minutes: number | null;
  late_minutes: number;
  early_leave_minutes: number;
  overtime_minutes: number;
  is_anomaly: boolean;
  can_clock_in: boolean;
  can_clock_out: boolean;
}

interface CorrectionRequestInfo {
  id: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_check_in: string | null;
  requested_check_out: string | null;
  reason: string;
  created_at: string;
}

interface DayRecord {
  id: string;
  work_date: string;
  clock_in_at: string | null;
  clock_out_at: string | null;
  day_status: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  scheduled_break_minutes: number;
  net_worked_minutes: number | null;
  late_minutes: number;
  early_leave_minutes: number;
  overtime_minutes: number;
  is_anomaly: boolean;
  correction_request: CorrectionRequestInfo | null;
  hours_to_recover: number | null;
}

// Badge de statut de correction
function CorrectionStatusBadge({ correction }: { correction: CorrectionRequestInfo }) {
  const statusConfig = {
    pending: {
      label: 'Correction en attente',
      className: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      icon: '🟡'
    },
    approved: {
      label: 'Correction approuvée',
      className: 'bg-green-100 text-green-800 border-green-300',
      icon: '🟢'
    },
    rejected: {
      label: 'Correction refusée',
      className: 'bg-red-100 text-red-800 border-red-300',
      icon: '🔴'
    }
  };

  const config = statusConfig[correction.status] || statusConfig.pending;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium border ${config.className}`}
      title={`Motif: ${correction.reason}`}
    >
      <span>{config.icon}</span>
      {config.label}
    </span>
  );
}

// Badge de statut du jour
function DayStatusBadge({ status }: { status: string }) {
  const statusConfig: Record<string, { label: string; className: string }> = {
    present: { label: 'Présent', className: 'bg-green-100 text-green-800' },
    late: { label: 'En retard', className: 'bg-orange-100 text-orange-800' },
    early_leave: { label: 'Départ anticipé', className: 'bg-yellow-100 text-yellow-800' },
    partial: { label: 'Journée partielle', className: 'bg-yellow-100 text-yellow-800' },
    absent: { label: 'Absent', className: 'bg-red-100 text-red-800' },
    pending: { label: 'En cours', className: 'bg-blue-100 text-blue-800' },
    holiday: { label: 'Jour férié', className: 'bg-purple-100 text-purple-800' },
    leave: { label: 'Congé', className: 'bg-indigo-100 text-indigo-800' },
    weekend: { label: 'Weekend', className: 'bg-gray-100 text-gray-600' },
    recovery_off: { label: 'À récupérer', className: 'bg-teal-100 text-teal-800' },
    recovery: { label: 'Récupération', className: 'bg-teal-100 text-teal-800' },
    recovery_paid: { label: 'Récupération', className: 'bg-teal-100 text-teal-800' },  // Deprecated
    recovery_unpaid: { label: 'Récupération', className: 'bg-teal-100 text-teal-800' },  // Deprecated
    mission: { label: 'Mission', className: 'bg-cyan-100 text-cyan-800' },
    training: { label: 'Formation', className: 'bg-violet-100 text-violet-800' },
    sick: { label: 'Maladie', className: 'bg-pink-100 text-pink-800' },
    overtime: { label: 'Heures Sup', className: 'bg-amber-100 text-amber-800' }
  };

  const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-600' };

  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${config.className}`}>
      {config.label}
    </span>
  );
}

function Clocking() {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [correctionModalOpen, setCorrectionModalOpen] = useState(false);
  const [selectedDayForCorrection, setSelectedDayForCorrection] = useState<DayRecord | null>(null);
  const queryClient = useQueryClient();

  // State pour l'heure système (reçue du backend)
  const [systemTime, setSystemTime] = useState<Date | null>(null);
  const systemTimeRef = useRef<Date | null>(null);

  // Get today's status from new unified API
  const { data: todayData, isLoading: todayLoading } = useQuery({
    queryKey: ['attendance-today'],
    queryFn: async () => {
      const response = await apiClient.get('/hr/attendance/my-today');
      return (response as any).data as {
        success: boolean;
        requires_clocking: boolean;
        system_time: string;
        employee: any;
        today: TodayStatus;
        schedule: any;
      };
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Synchroniser l'heure système depuis le backend
  useEffect(() => {
    if (todayData?.system_time) {
      const time = new Date(todayData.system_time);
      setSystemTime(time);
      systemTimeRef.current = time;
    }
  }, [todayData?.system_time]);

  // Timer pour faire avancer l'heure chaque seconde
  useEffect(() => {
    const interval = setInterval(() => {
      if (systemTimeRef.current) {
        const newTime = new Date(systemTimeRef.current.getTime() + 1000);
        systemTimeRef.current = newTime;
        setSystemTime(newTime);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Get full history from new unified API
  const { data: historyData, isLoading: historyLoading } = useQuery({
    queryKey: ['attendance-history', selectedMonth, selectedYear],
    queryFn: async () => {
      const startDate = new Date(selectedYear, selectedMonth, 1).toISOString().split('T')[0];
      const endDate = new Date(selectedYear, selectedMonth + 1, 0).toISOString().split('T')[0];

      const response = await apiClient.get(`/hr/attendance/my-records?start_date=${startDate}&end_date=${endDate}&limit=100`);
      return (response as any).data as { success: boolean; employee: any; records: DayRecord[] };
    }
  });

  // Clock-in mutation (new endpoint)
  const clockInMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/hr/attendance/clock-in');
      return (response as any).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-history'] });
      alert('Entrée enregistrée avec succès !');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Erreur lors de l\'enregistrement de l\'entrée');
    }
  });

  // Clock-out mutation (new endpoint)
  const clockOutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/hr/attendance/clock-out');
      return (response as any).data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attendance-today'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-history'] });
      const minutes = data.record?.net_worked_minutes || 0;
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      alert(`Sortie enregistrée avec succès !\n\nTemps travaillé aujourd'hui : ${hours}h ${mins}min`);
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Erreur lors de l\'enregistrement de la sortie');
    }
  });

  // Mutation pour soumettre une demande de correction
  const correctionMutation = useMutation({
    mutationFn: async (data: { request_date: string; requested_check_in: string; requested_check_out: string; original_check_in: string; original_check_out: string; reason: string }) => {
      const response = await apiClient.post('/hr/my/correction-requests', data);
      return (response as any).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance-history'] });
      setCorrectionModalOpen(false);
      setSelectedDayForCorrection(null);
      alert('Demande de correction soumise avec succès !');
    },
    onError: (error: any) => {
      alert(error.response?.data?.error || 'Erreur lors de la soumission de la demande');
    }
  });

  const handleOpenCorrectionModal = (day: DayRecord) => {
    setSelectedDayForCorrection(day);
    setCorrectionModalOpen(true);
  };

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return '--:--';
    return new Date(timestamp).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const formatWorkedTime = (minutes: number | null) => {
    if (minutes === null || minutes === undefined) return '-- h --';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins.toString().padStart(2, '0')}min`;
  };

  const months = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
  ];

  if (todayLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </AppLayout>
    );
  }

  if (!todayData?.requires_clocking) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto py-12 px-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            <AlertCircle className="h-12 w-12 text-yellow-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Pointage non requis
            </h2>
            <p className="text-gray-600">
              Vous n'êtes pas autorisé à utiliser le système de pointage.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const today = todayData.today;
  const schedule = todayData.schedule;
  // Utiliser l'heure système du backend (configurée par l'admin)
  const currentTime = systemTime
    ? systemTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '--:--:--';

  // Determine current status display
  const getStatusDisplay = () => {
    if (today.clock_in_at && !today.clock_out_at) {
      return {
        icon: <CheckCircle className="h-5 w-5" />,
        text: `Présent depuis ${formatTime(today.clock_in_at)}`,
        className: 'bg-green-100 text-green-700'
      };
    }
    if (today.clock_in_at && today.clock_out_at) {
      return {
        icon: <LogOut className="h-5 w-5" />,
        text: `Sorti à ${formatTime(today.clock_out_at)}`,
        className: 'bg-gray-100 text-gray-700'
      };
    }
    return {
      icon: <AlertCircle className="h-5 w-5" />,
      text: 'Non pointé aujourd\'hui',
      className: 'bg-yellow-100 text-yellow-700'
    };
  };

  const statusDisplay = getStatusDisplay();

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Clock className="h-8 w-8 text-blue-600" />
            Mon Pointage
          </h1>
          <p className="text-gray-600 mt-2">
            Enregistrez vos heures d'arrivée et de départ
          </p>
        </div>

        {/* Today's Status Card */}
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg p-8 mb-8 border border-blue-100">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {formatDate(today.work_date)}
              </h2>
              <p className="text-lg text-gray-600 mt-1">
                Heure actuelle : {currentTime}
              </p>
              {schedule && (
                <p className="text-sm text-gray-500 mt-1">
                  Horaire prévu : {schedule.scheduled_start || '--:--'} - {schedule.scheduled_end || '--:--'}
                </p>
              )}
            </div>
            <div className="text-right">
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${statusDisplay.className}`}>
                {statusDisplay.icon}
                <span className="font-semibold">{statusDisplay.text}</span>
              </div>
            </div>
          </div>

          {/* Worked Time & Details */}
          {today.net_worked_minutes !== null && today.net_worked_minutes > 0 && (
            <div className="bg-white/60 backdrop-blur rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  <span className="text-gray-700">Temps travaillé :</span>
                  <span className="text-xl font-bold text-blue-600">
                    {formatWorkedTime(today.net_worked_minutes)}
                  </span>
                </div>
                {today.scheduled_break_minutes > 0 && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Coffee className="h-4 w-4" />
                    <span>Pause déduite : {today.scheduled_break_minutes} min</span>
                  </div>
                )}
                {today.late_minutes > 0 && (
                  <div className="text-sm text-orange-600 font-medium">
                    Retard : {today.late_minutes} min
                  </div>
                )}
                {today.overtime_minutes > 0 && (
                  <div className="text-sm text-green-600 font-medium">
                    Heures sup : {today.overtime_minutes} min
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => clockInMutation.mutate()}
              disabled={!today.can_clock_in || clockInMutation.isPending}
              className={`py-6 px-8 rounded-xl font-bold text-lg transition-all transform hover:scale-105 flex items-center justify-center gap-3 ${
                today.can_clock_in && !clockInMutation.isPending
                  ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <LogIn className="h-6 w-6" />
              {clockInMutation.isPending ? 'Enregistrement...' : 'POINTER ENTRÉE'}
            </button>

            <button
              onClick={() => clockOutMutation.mutate()}
              disabled={!today.can_clock_out || clockOutMutation.isPending}
              className={`py-6 px-8 rounded-xl font-bold text-lg transition-all transform hover:scale-105 flex items-center justify-center gap-3 ${
                today.can_clock_out && !clockOutMutation.isPending
                  ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg hover:shadow-xl'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              <LogOut className="h-6 w-6" />
              {clockOutMutation.isPending ? 'Enregistrement...' : 'POINTER SORTIE'}
            </button>
          </div>

          {/* Today's Details */}
          {(today.clock_in_at || today.clock_out_at) && (
            <div className="mt-6 bg-white/60 backdrop-blur rounded-lg p-4">
              <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Pointages d'aujourd'hui
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className={`p-4 rounded-lg text-center ${today.clock_in_at ? 'bg-green-100' : 'bg-gray-100'}`}>
                  <div className="text-sm font-medium text-gray-600 mb-1">Entrée</div>
                  <div className={`text-2xl font-bold ${today.clock_in_at ? 'text-green-700' : 'text-gray-400'}`}>
                    {formatTime(today.clock_in_at)}
                  </div>
                  {today.late_minutes > 0 && (
                    <div className="text-xs text-orange-600 mt-1">+{today.late_minutes} min de retard</div>
                  )}
                </div>
                <div className={`p-4 rounded-lg text-center ${today.clock_out_at ? 'bg-red-100' : 'bg-gray-100'}`}>
                  <div className="text-sm font-medium text-gray-600 mb-1">Sortie</div>
                  <div className={`text-2xl font-bold ${today.clock_out_at ? 'text-red-700' : 'text-gray-400'}`}>
                    {formatTime(today.clock_out_at)}
                  </div>
                  {today.early_leave_minutes > 0 && (
                    <div className="text-xs text-orange-600 mt-1">-{today.early_leave_minutes} min anticipé</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* History Section */}
        <div className="bg-white rounded-lg shadow-md border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-blue-600" />
                Historique des pointages
              </h2>
              <div className="flex gap-2">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {months.map((month, index) => (
                    <option key={index} value={index}>
                      {month}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[2024, 2025, 2026].map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="p-6">
            {historyLoading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : historyData && historyData.records.length > 0 ? (
              <div className="space-y-4">
                {historyData.records.map((day) => (
                  <div
                    key={day.id || day.work_date}
                    className={`border rounded-lg p-4 ${
                      day.is_anomaly
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="font-semibold text-gray-900">
                          {formatDate(day.work_date)}
                        </div>
                        <DayStatusBadge status={day.day_status} />
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        {/* Afficher le badge de correction si une demande existe */}
                        {day.correction_request ? (
                          <CorrectionStatusBadge correction={day.correction_request} />
                        ) : day.is_anomaly && (
                          <>
                            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
                              Anomalie
                            </span>
                            <button
                              type="button"
                              onClick={() => handleOpenCorrectionModal(day)}
                              className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-full font-medium transition-colors"
                              title="Soumettre une demande de correction de pointage"
                            >
                              <FileEdit className="h-3 w-3" />
                              Demande de pointage
                            </button>
                          </>
                        )}
                        <div className="text-sm font-bold text-blue-600">
                          {day.day_status === 'recovery_off'
                            ? `${day.hours_to_recover || 8}h (à récupérer)`
                            : ['recovery', 'recovery_paid', 'recovery_unpaid'].includes(day.day_status)
                              ? `${formatWorkedTime(day.net_worked_minutes)} (récupération)`
                              : formatWorkedTime(day.net_worked_minutes)}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className={`p-3 rounded text-center ${day.clock_in_at ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                        <div className="text-xs mb-1">Entrée</div>
                        <div className="font-bold">{formatTime(day.clock_in_at)}</div>
                        {day.late_minutes > 0 && (
                          <div className="text-xs text-orange-600">+{day.late_minutes} min</div>
                        )}
                      </div>
                      <div className={`p-3 rounded text-center ${day.clock_out_at ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-500'}`}>
                        <div className="text-xs mb-1">Sortie</div>
                        <div className="font-bold">{formatTime(day.clock_out_at)}</div>
                        {day.early_leave_minutes > 0 && (
                          <div className="text-xs text-orange-600">-{day.early_leave_minutes} min</div>
                        )}
                      </div>
                      {day.scheduled_break_minutes > 0 && (
                        <div className="p-3 rounded text-center bg-gray-100 text-gray-600">
                          <div className="text-xs mb-1">Pause</div>
                          <div className="font-bold">{day.scheduled_break_minutes} min</div>
                        </div>
                      )}
                      {day.overtime_minutes > 0 && (
                        <div className="p-3 rounded text-center bg-purple-100 text-purple-700">
                          <div className="text-xs mb-1">Heures sup</div>
                          <div className="font-bold">+{day.overtime_minutes} min</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Aucun pointage pour ce mois
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modale de demande de correction */}
      {selectedDayForCorrection && (
        <CorrectionModal
          isOpen={correctionModalOpen}
          onClose={() => {
            setCorrectionModalOpen(false);
            setSelectedDayForCorrection(null);
          }}
          date={selectedDayForCorrection.work_date}
          currentRecord={selectedDayForCorrection}
          onSubmit={(data) => correctionMutation.mutate(data)}
          isSubmitting={correctionMutation.isPending}
        />
      )}
    </AppLayout>
  );
}

export default Clocking;
