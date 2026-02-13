/**
 * TeamAttendance.tsx - Vue des pointages de l'équipe (Manager)
 *
 * Permet au manager de consulter les pointages de son équipe uniquement,
 * avec filtres par date et membre, et export CSV.
 */

import { useState, useMemo, useEffect } from 'react';
import {
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  RefreshCw,
  User,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Eye,
  Trash2,
  Edit,
  Plus
} from 'lucide-react';
import { format, parseISO, addMonths, subMonths, isToday } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getPayrollPeriod } from '@/utils/payroll-period';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { useTeam, useTeamAttendance, useTeamStats, useExportTeamAttendance, useRecalculateTeamAttendance } from '@/hooks/useManagerTeam';
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
import { Calculator, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { TeamAttendanceRecord } from '@/lib/api/manager';
import AdminAttendanceEditor from '@/components/admin/hr/AdminAttendanceEditor';
import { AppLayout } from '@/components/layout/AppLayout';

// ============================================================
// CONSTANTS
// ============================================================

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: any }> = {
  present: { label: 'Présent', className: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  absent: { label: 'Absent', className: 'bg-gray-100 text-gray-800', icon: XCircle },
  late: { label: 'En retard', className: 'bg-orange-100 text-orange-800', icon: AlertTriangle },
  early_leave: { label: 'Départ anticipé', className: 'bg-yellow-100 text-yellow-800', icon: Clock },
  late_early: { label: 'Retard + Départ ant.', className: 'bg-red-100 text-red-800', icon: AlertTriangle },
  half_day: { label: 'Demi-journée', className: 'bg-blue-100 text-blue-800', icon: Clock },
  incomplete: { label: 'Incomplet', className: 'bg-red-100 text-red-800', icon: AlertTriangle },
  weekend: { label: 'Week-end', className: 'bg-slate-100 text-slate-600', icon: Calendar },
  holiday: { label: 'Jour férié', className: 'bg-purple-100 text-purple-800', icon: Calendar },
  leave: { label: 'Congé', className: 'bg-teal-100 text-teal-800', icon: Calendar },
  mission: { label: 'Mission', className: 'bg-indigo-100 text-indigo-800', icon: TrendingUp },
  partial: { label: 'Partiel', className: 'bg-yellow-100 text-yellow-800', icon: Clock },
  check_in: { label: 'Pointé entrée', className: 'bg-blue-100 text-blue-800', icon: Clock },
  check_out: { label: 'Pointé sortie', className: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  // Nouveaux statuts de hr_attendance_daily
  pending: { label: 'En cours', className: 'bg-blue-100 text-blue-800', icon: Clock },
  training: { label: 'Formation', className: 'bg-violet-100 text-violet-800', icon: Calendar },
  sick: { label: 'Maladie', className: 'bg-pink-100 text-pink-800', icon: XCircle },
  recovery_off: { label: 'À récupérer', className: 'bg-teal-100 text-teal-800', icon: Calendar },
  recovery: { label: 'Récupération', className: 'bg-teal-100 text-teal-800', icon: RefreshCw },
  recovery_day: { label: 'Récupération', className: 'bg-teal-100 text-teal-800', icon: RefreshCw },  // Alias pour compatibilité
  recovery_paid: { label: 'Récupération', className: 'bg-teal-100 text-teal-800', icon: RefreshCw },  // Deprecated - migration en cours
  recovery_unpaid: { label: 'Récupération', className: 'bg-teal-100 text-teal-800', icon: RefreshCw },  // Deprecated - migration en cours
  overtime: { label: 'Heures Sup', className: 'bg-amber-100 text-amber-800', icon: Clock },
};

// ============================================================
// HELPER FUNCTIONS
// ============================================================

function formatTime(time?: string): string {
  if (!time) return '--:--';
  try {
    const date = parseISO(time);
    return format(date, 'HH:mm');
  } catch {
    return time.substring(0, 5);
  }
}

function formatHours(hours?: number): string {
  if (hours === undefined || hours === null) return '--';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return `${h}h${m.toString().padStart(2, '0')}`;
}

// getPayrollPeriod and PAYROLL_CUTOFF_DAY are now imported from @/utils/payroll-period

function formatPay(hours?: number, hourlyRate?: number): string {
  // Convertir en nombre et vérifier les valeurs invalides
  const h = Number(hours);
  const rate = Number(hourlyRate);
  if (!h || isNaN(h) || h <= 0) return '-';
  if (!rate || isNaN(rate) || rate <= 0) return '-';
  const pay = h * rate;
  return `${pay.toFixed(2)} MAD`;
}

// ============================================================
// COMPONENTS
// ============================================================

interface AttendanceDetailModalProps {
  record: TeamAttendanceRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Fallback pour statuts inconnus
const DEFAULT_STATUS = { label: 'Inconnu', className: 'bg-gray-100 text-gray-800', icon: Clock };

function AttendanceDetailModal({ record, open, onOpenChange }: AttendanceDetailModalProps) {
  if (!record) return null;

  const statusConfig = STATUS_CONFIG[record.status] || DEFAULT_STATUS;
  const StatusIcon = statusConfig.icon;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Détail du pointage
          </DialogTitle>
          <DialogDescription>
            {record.employee_name} - {format(parseISO(record.date), 'EEEE d MMMM yyyy', { locale: fr })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm text-muted-foreground">Statut</span>
            <Badge className={statusConfig.className}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusConfig.label}
            </Badge>
          </div>

          {/* Horaires */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Entrée</Label>
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                <Clock className="h-4 w-4 text-green-600" />
                <span className="font-medium">{formatTime(record.clock_in)}</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Sortie</Label>
              <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
                <Clock className="h-4 w-4 text-red-600" />
                <span className="font-medium">{formatTime(record.clock_out)}</span>
              </div>
            </div>
          </div>

          {/* Heures travaillées */}
          <div className="space-y-1">
            <Label className="text-muted-foreground text-xs">
              {record.status === 'recovery_off' ? 'Heures à récupérer'
                : record.status === 'holiday' ? 'Heures prévues (férié)'
                : 'Heures travaillées'}
            </Label>
            <div className="flex items-center gap-2 p-2 bg-muted/50 rounded">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="font-medium">
                {record.status === 'recovery_off'
                  ? `${record.scheduled_hours || record.hours_to_recover || 8}h`
                  : record.status === 'holiday'
                    ? `${record.scheduled_hours || 8}h`
                    : formatHours(record.worked_hours)}
              </span>
            </div>
          </div>

          {/* Retard */}
          {record.late_minutes && record.late_minutes > 0 && (
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Retard</Label>
              <div className="flex items-center gap-2 p-2 bg-orange-50 rounded border border-orange-200">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span className="font-medium text-orange-800">{record.late_minutes} minutes</span>
              </div>
            </div>
          )}

          {/* Type de congé */}
          {record.leave_type && (
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Type de congé</Label>
              <div className="flex items-center gap-2 p-2 bg-blue-50 rounded border border-blue-200">
                <Calendar className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800">{record.leave_type}</span>
              </div>
            </div>
          )}

          {/* Notes */}
          {record.notes && (
            <div className="space-y-1">
              <Label className="text-muted-foreground text-xs">Notes</Label>
              <p className="p-2 bg-muted/50 rounded text-sm">{record.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function TeamAttendance() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Date state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [detailRecord, setDetailRecord] = useState<TeamAttendanceRecord | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ employeeId: string; date: string; name: string } | null>(null);
  const [showAdminEditor, setShowAdminEditor] = useState(false);
  const [editRecord, setEditRecord] = useState<{ employeeId: string; date: string } | null>(null);
  const [employeeBonuses, setEmployeeBonuses] = useState<Record<string, { prime_journaliere: number; objectif_atteint: boolean }>>({});
  const [showRecalcDialog, setShowRecalcDialog] = useState(false);
  const [bonusRefetchTrigger, setBonusRefetchTrigger] = useState(0);

  // Delete mutation - uses unified attendance API
  const deleteMutation = useMutation({
    mutationFn: async ({ employeeId, date }: { employeeId: string; date: string }) => {
      // Format date to yyyy-MM-dd (remove time part if present)
      const formattedDate = date.includes('T') ? date.split('T')[0] : date;
      const response = await apiClient.delete(`/hr/attendance/admin/delete?employee_id=${employeeId}&date=${formattedDate}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-attendance'] });
      toast({ title: 'Succes', description: 'Pointage(s) supprime(s)' });
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

  // Computed date range - Utilise la période de paie (ex: janvier = 19/12 au 18/01)
  const payrollPeriod = useMemo(() => getPayrollPeriod(currentMonth), [currentMonth]);

  const dateRange = useMemo(() => {
    return {
      start_date: format(payrollPeriod.start, 'yyyy-MM-dd'),
      end_date: format(payrollPeriod.end, 'yyyy-MM-dd'),
    };
  }, [payrollPeriod]);

  // Queries
  const { data: teamData } = useTeam();
  const { data: attendanceData, isLoading: loadingAttendance, refetch } = useTeamAttendance({
    ...dateRange,
    employee_id: selectedEmployee !== 'all' ? selectedEmployee : undefined,
  });
  const { data: statsData, isLoading: loadingStats } = useTeamStats();
  const exportMutation = useExportTeamAttendance();
  const recalculateMutation = useRecalculateTeamAttendance();

  // Fetch bonuses for all employees in the attendance records
  useEffect(() => {
    const fetchBonuses = async () => {
      const records = attendanceData?.records || [];
      if (records.length === 0) {
        setEmployeeBonuses({});
        return;
      }

      // Group records by date to batch API calls per date
      const recordsByDate = new Map<string, string[]>();
      records.forEach(r => {
        const dateKey = r.date.split('T')[0];
        if (!recordsByDate.has(dateKey)) {
          recordsByDate.set(dateKey, []);
        }
        const empIds = recordsByDate.get(dateKey)!;
        if (!empIds.includes(r.employee_id)) {
          empIds.push(r.employee_id);
        }
      });

      const bonusData: Record<string, { prime_journaliere: number; objectif_atteint: boolean }> = {};

      // Fetch bonuses for each unique date
      for (const [date, employeeIds] of recordsByDate.entries()) {
        try {
          const response = await apiClient.post('/hr/assistant-bonus/batch', {
            employee_ids: employeeIds,
            date
          });

          if ((response as any).success && (response as any).data) {
            employeeIds.forEach(empId => {
              const empBonus = (response as any).data[empId];
              if (empBonus) {
                bonusData[`${empId}_${date}`] = {
                  prime_journaliere: empBonus.prime_journaliere || 0,
                  objectif_atteint: empBonus.objectif_atteint || false
                };
              }
            });
          }
        } catch (error) {
          console.error(`Error fetching bonuses for date ${date}:`, error);
        }
      }

      setEmployeeBonuses(bonusData);
    };

    fetchBonuses();
  }, [attendanceData?.records, bonusRefetchTrigger]);

  // Computed stats for current view
  const viewStats = useMemo(() => {
    const records = attendanceData?.records || [];
    const present = records.filter(r => r.status === 'present' || r.status === 'late').length;
    const absent = records.filter(r => r.status === 'absent').length;
    const onLeave = records.filter(r => r.status === 'leave').length;
    const late = records.filter(r => r.status === 'late').length;
    const total = records.length;

    return {
      present,
      absent,
      onLeave,
      late,
      total,
      attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
    };
  }, [attendanceData]);

  // Filter records by selected date if any
  const filteredRecords = useMemo(() => {
    if (!attendanceData?.records) return [];
    if (!selectedDate) return attendanceData.records;
    return attendanceData.records.filter(r => r.date === selectedDate);
  }, [attendanceData, selectedDate]);

  // Handlers
  const handlePrevMonth = () => setCurrentMonth(prev => subMonths(prev, 1));
  const handleNextMonth = () => setCurrentMonth(prev => addMonths(prev, 1));
  const handleToday = () => {
    setCurrentMonth(new Date());
    setSelectedDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const handleExport = async () => {
    try {
      await exportMutation.mutateAsync(dateRange);
      toast({ title: 'Succès', description: 'Export téléchargé avec succès' });
    } catch {
      toast({ title: 'Erreur', description: 'Erreur lors de l\'export', variant: 'destructive' });
    }
  };

  const handleRecalculate = async () => {
    setShowRecalcDialog(false);
    try {
      const result = await recalculateMutation.mutateAsync({
        start_date: dateRange.start_date,
        end_date: dateRange.end_date,
        employee_id: selectedEmployee !== 'all' ? selectedEmployee : undefined
      });
      // Force bonus refetch after recalculate
      setBonusRefetchTrigger(prev => prev + 1);
      toast({
        title: 'Succès',
        description: result.message || `${result.stats.updated} pointage(s) recalculé(s)`
      });
    } catch {
      toast({ title: 'Erreur', description: 'Erreur lors du recalcul', variant: 'destructive' });
    }
  };

  const handleViewDetail = (record: TeamAttendanceRecord) => {
    setDetailRecord(record);
    setDetailModalOpen(true);
  };

  // Team members for filter
  const teamMembers = teamData?.members || [];

  return (
    <AppLayout>
      <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Pointages de mon équipe
          </h1>
          <p className="text-muted-foreground mt-1">
            Suivez la présence et les horaires de votre équipe
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="default"
            onClick={() => {
              setEditRecord(null);
              setShowAdminEditor(true);
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Ajouter pointage
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowRecalcDialog(true)}
            disabled={recalculateMutation.isPending}
          >
            {recalculateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Calculator className="h-4 w-4 mr-2" />
            )}
            Recalculer
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={exportMutation.isPending}>
            {exportMutation.isPending ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Exporter
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Équipe</p>
                <p className="text-2xl font-bold">
                  {loadingStats ? <Skeleton className="h-8 w-12" /> : statsData?.stats?.total_members || 0}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Présents auj.</p>
                <p className="text-2xl font-bold">
                  {loadingStats ? <Skeleton className="h-8 w-12" /> : statsData?.stats?.present_today || 0}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">En congé</p>
                <p className="text-2xl font-bold">
                  {loadingStats ? <Skeleton className="h-8 w-12" /> : statsData?.stats?.on_leave_today || 0}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Retards (mois)</p>
                <p className="text-2xl font-bold">{viewStats.late}</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Taux présence</p>
                <p className="text-2xl font-bold">{viewStats.attendanceRate}%</p>
              </div>
              <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
            </div>
            <Progress value={viewStats.attendanceRate} className="mt-2 h-1" />
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center gap-4">
            {/* Month Navigation */}
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={handlePrevMonth}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-[150px] text-center font-medium">
                {format(currentMonth, 'MMMM yyyy', { locale: fr })}
              </div>
              <Button variant="outline" size="icon" onClick={handleNextMonth}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={handleToday}>
                Aujourd'hui
              </Button>
            </div>

            <div className="h-8 w-px bg-border" />

            {/* Employee Filter */}
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Tous les membres" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les membres</SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.employee_id}>
                      {member.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date Filter */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-[160px]"
              />
              {selectedDate && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedDate('')}>
                  <XCircle className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pointages
          </CardTitle>
          <CardDescription>
            {selectedDate
              ? `Pointages du ${format(parseISO(selectedDate), 'd MMMM yyyy', { locale: fr })}`
              : `Paie ${format(currentMonth, 'MMMM yyyy', { locale: fr })} (${format(payrollPeriod.start, 'dd/MM')} - ${format(payrollPeriod.end, 'dd/MM/yyyy')})`
            }
            {selectedEmployee !== 'all' && ` - ${teamMembers.find(m => m.employee_id === selectedEmployee)?.full_name}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingAttendance ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucun pointage trouvé pour cette période</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Employé</TableHead>
                  <TableHead>Entrée</TableHead>
                  <TableHead>Sortie</TableHead>
                  <TableHead>Heures</TableHead>
                  <TableHead>Paie</TableHead>
                  <TableHead>Prime</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.map((record) => {
                  const statusConfig = STATUS_CONFIG[record.status] || DEFAULT_STATUS;
                  const StatusIcon = statusConfig.icon;
                  const recordDate = parseISO(record.date);
                  const isRecordToday = isToday(recordDate);

                  return (
                    <TableRow key={record.id} className={isRecordToday ? 'bg-blue-50/50' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {format(recordDate, 'dd/MM/yyyy')}
                          </span>
                          {isRecordToday && (
                            <Badge variant="outline" className="text-xs">Aujourd'hui</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{record.employee_name}</div>
                      </TableCell>
                      <TableCell>
                        <span className={record.clock_in ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                          {formatTime(record.clock_in)}
                        </span>
                        {record.late_minutes && record.late_minutes > 0 && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline" className="ml-2 text-orange-600 border-orange-300">
                                  +{record.late_minutes}min
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                Retard de {record.late_minutes} minutes
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={record.clock_out ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                          {formatTime(record.clock_out)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {record.status === 'recovery_off'
                            ? `${record.scheduled_hours || record.hours_to_recover || 8}h (à récupérer)`
                            : record.status === 'holiday'
                              ? `${record.scheduled_hours || 8}h (férié)`
                              : formatHours(record.worked_hours)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-green-700">
                          {(() => {
                            // recovery_off = jour off accordé → paie positive (crédit donné au salarié)
                            if (record.status === 'recovery_off') {
                              const hours = record.scheduled_hours || record.hours_to_recover || 8;
                              if (record.is_working_day === false) {
                                return <span className="text-gray-400">Non payé</span>;
                              }
                              return formatPay(hours, record.hourly_rate);
                            }

                            // recovery/recovery_paid/recovery_unpaid = jour de travail de récup → PAS DE PAIE
                            // Le salarié "rembourse" les heures déjà payées, même si c'est un jour férié
                            if (['recovery', 'recovery_paid', 'recovery_unpaid', 'recovery_day'].includes(record.status)) {
                              return <span className="text-gray-400">Récup.</span>;
                            }

                            // holiday sur jour ouvrable → paie
                            if (record.status === 'holiday') {
                              const hours = record.scheduled_hours || 8;
                              if (record.is_working_day === false) {
                                return <span className="text-gray-400">Non payé</span>;
                              }
                              return formatPay(hours, record.hourly_rate);
                            }

                            // Autres statuts → heures travaillées
                            return formatPay(record.worked_hours, record.hourly_rate);
                          })()}
                        </span>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const bonusKey = `${record.employee_id}_${record.date.split('T')[0]}`;
                          const bonus = employeeBonuses[bonusKey];
                          if (!bonus || bonus.prime_journaliere === 0) return <span className="text-gray-400">-</span>;
                          return (
                            <span className={`font-medium ${bonus.objectif_atteint ? 'text-green-600' : 'text-red-500'}`}>
                              {bonus.prime_journaliere.toFixed(2)} MAD
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig.className}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                        {record.leave_type && (
                          <span className="text-xs text-muted-foreground ml-2">
                            ({record.leave_type})
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                  onClick={() => {
                                    setEditRecord({
                                      employeeId: record.employee_id,
                                      date: record.date.split('T')[0]
                                    });
                                    setShowAdminEditor(true);
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Modifier ce pointage</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleViewDetail(record)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => setDeleteConfirm({
                              employeeId: record.employee_id,
                              date: record.date,
                              name: record.employee_name
                            })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      <AttendanceDetailModal
        record={detailRecord}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Confirmer la suppression
            </DialogTitle>
            <DialogDescription>
              Voulez-vous vraiment supprimer les pointages de{' '}
              <strong>{deleteConfirm?.name}</strong> pour le{' '}
              <strong>{deleteConfirm?.date ? format(parseISO(deleteConfirm.date), 'd MMMM yyyy', { locale: fr }) : ''}</strong> ?
              <br />
              <span className="text-red-500 text-sm mt-2 block">
                Cette action est irreversible.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => {
                if (deleteConfirm) {
                  deleteMutation.mutate({
                    employeeId: deleteConfirm.employeeId,
                    date: deleteConfirm.date
                  });
                }
              }}
            >
              {deleteMutation.isPending ? 'Suppression...' : 'Supprimer'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Attendance Editor Modal */}
      {showAdminEditor && (
        <AdminAttendanceEditor
          onClose={() => {
            setShowAdminEditor(false);
            setEditRecord(null);
          }}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['team-attendance'] });
            queryClient.invalidateQueries({ queryKey: ['team-stats'] });
          }}
          initialEmployeeId={editRecord?.employeeId}
          initialDate={editRecord?.date}
        />
      )}

      {/* Recalculate Confirmation Dialog */}
      <AlertDialog open={showRecalcDialog} onOpenChange={setShowRecalcDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Recalculer les pointages ?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                Cette action va recalculer les heures travaillées et les statuts
                pour la période du {format(payrollPeriod.start, 'dd/MM/yyyy')} au {format(payrollPeriod.end, 'dd/MM/yyyy')}.
                <br /><br />
                Utile après:
                <ul className="list-disc ml-4 mt-2">
                  <li>Ajout d'un jour férié</li>
                  <li>Ajout d'une période de récupération</li>
                  <li>Saisie de pointages rétroactifs</li>
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleRecalculate}>
              Recalculer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </AppLayout>
  );
}
