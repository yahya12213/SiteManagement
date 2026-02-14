// @ts-nocheck
/**
 * Gestion des Horaires (ScheduleManagement)
 * Gestion complète des modèles d'horaires, jours fériés, congés validés et heures supplémentaires
 * Connecté à l'API backend
 */

import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import WorkScheduleFormModal from '@/components/admin/hr/WorkScheduleFormModal';
import SystemClockEditor from '@/components/admin/hr/SystemClockEditor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProtectedButton } from '@/components/ui/ProtectedButton';
import { PERMISSIONS } from '@/config/permissions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import {
  Calendar,
  Clock,
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  CalendarDays,
  Timer,
  Loader2,
  AlertCircle,
  RefreshCw,
  Settings,
  CalendarClock,
  Users,
} from 'lucide-react';

// Hooks
import {
  useWorkSchedules,
  useDeleteSchedule,
  usePublicHolidays,
  useCreateHoliday,
  useUpdateHoliday,
  useDeleteHoliday,
  useApprovedLeaves,
  useOvertimeDeclarations,
  useApproveOvertime,
  useRejectOvertime,
  useEmployeesForOvertime,
  useOvertimePeriods,
  useCreateOvertimePeriod,
  useUpdateOvertimePeriod,
  useDeleteOvertimePeriod,
  useRecalculateOvertimePeriod,
  useOvertimeConfig,
  useUpdateOvertimeConfig,
  useEmployeeSchedules,
  useEmployeesWithoutSchedule,
  useCreateEmployeeSchedule,
  useUpdateEmployeeSchedule,
  useDeleteEmployeeSchedule,
  useBulkAssignSchedule,
} from '@/hooks/useScheduleManagement';

// Types & API
import type { WorkSchedule, PublicHoliday, OvertimePeriod, OvertimeConfig, EmployeeScheduleAssignment, EmployeeWithoutSchedule } from '@/lib/api/schedule-management';
import { scheduleManagementApi } from '@/lib/api/schedule-management';

// Tabs
type TabType = 'modeles' | 'employes' | 'feries' | 'conges' | 'heures-sup' | 'config-hs' | 'horloge';

const TABS: { id: TabType; label: string; icon: React.ElementType }[] = [
  { id: 'modeles', label: 'Modèles d\'Horaires', icon: Clock },
  { id: 'employes', label: 'Horaires Employés', icon: Users },
  { id: 'feries', label: 'Jours Fériés', icon: CalendarDays },
  { id: 'conges', label: 'Congés Validés', icon: Calendar },
  { id: 'heures-sup', label: 'Heures Supplémentaires', icon: Timer },
  { id: 'config-hs', label: 'Config HS', icon: Settings },
  { id: 'horloge', label: 'Horloge Système', icon: Clock },
];

const RATE_TYPES = [
  { value: 'normal', label: 'Taux 25%', color: 'bg-green-100 text-green-800' },
  { value: 'extended', label: 'Taux 50%', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'special', label: 'Taux 100%', color: 'bg-red-100 text-red-800' },
];

const JOURS_SEMAINE = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

export default function ScheduleManagement() {
  const { toast } = useToast();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>('modeles');
  const currentYear = new Date().getFullYear();

  // State for modals
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showOvertimePeriodModal, setShowOvertimePeriodModal] = useState(false);
  const [showEmployeeScheduleModal, setShowEmployeeScheduleModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<WorkSchedule | null>(null);
  const [editingHoliday, setEditingHoliday] = useState<PublicHoliday | null>(null);
  const [editingPeriodId, setEditingPeriodId] = useState<string | null>(null);
  const [editingEmployeeSchedule, setEditingEmployeeSchedule] = useState<EmployeeScheduleAssignment | null>(null);

  // Form states
  const [holidayForm, setHolidayForm] = useState({
    nom: '',
    date_debut: '',
    recurrent: false,
    description: '',
  });

  // Overtime period form
  const [overtimePeriodForm, setOvertimePeriodForm] = useState({
    period_date: new Date().toISOString().split('T')[0],
    start_time: '17:00',
    end_time: '21:00',
    rate_type: 'normal' as 'normal' | 'extended' | 'special',
    reason: '',
    employee_ids: [] as string[],
  });

  // Overtime config form
  const [overtimeConfigForm, setOvertimeConfigForm] = useState<Partial<OvertimeConfig>>({});

  // Employee schedule form
  const [employeeScheduleForm, setEmployeeScheduleForm] = useState({
    employee_id: '',
    schedule_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '' as string | null,
    is_primary: true,
  });

  // Bulk assign state
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [bulkAssignForm, setBulkAssignForm] = useState({
    employee_ids: [] as string[],
    schedule_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '' as string | null,
  });

  // Queries
  const { data: schedulesData, isLoading: schedulesLoading, error: schedulesError } = useWorkSchedules();
  const { data: holidaysData, isLoading: holidaysLoading, error: holidaysError } = usePublicHolidays(currentYear);
  const { data: leavesData, isLoading: leavesLoading, error: leavesError } = useApprovedLeaves(currentYear);
  const { data: overtimeData, isLoading: overtimeLoading, error: overtimeError } = useOvertimeDeclarations();
  const { data: overtimePeriodsData, isLoading: periodsLoading, error: periodsError } = useOvertimePeriods();
  const { data: overtimeConfigData, isLoading: configLoading } = useOvertimeConfig();
  const { data: employeesForOvertimeData } = useEmployeesForOvertime();
  const { data: employeeSchedulesData, isLoading: empSchedulesLoading, error: empSchedulesError } = useEmployeeSchedules();
  const { data: employeesWithoutScheduleData } = useEmployeesWithoutSchedule();

  // Mutations
  const deleteSchedule = useDeleteSchedule();
  const createHoliday = useCreateHoliday();
  const updateHoliday = useUpdateHoliday();
  const deleteHoliday = useDeleteHoliday();
  const approveOvertime = useApproveOvertime();
  const rejectOvertime = useRejectOvertime();
  const createOvertimePeriod = useCreateOvertimePeriod();
  const updateOvertimePeriod = useUpdateOvertimePeriod();
  const deleteOvertimePeriod = useDeleteOvertimePeriod();
  const recalculateOvertimePeriod = useRecalculateOvertimePeriod();
  const updateOvertimeConfig = useUpdateOvertimeConfig();
  const createEmployeeSchedule = useCreateEmployeeSchedule();
  const updateEmployeeSchedule = useUpdateEmployeeSchedule();
  const deleteEmployeeSchedule = useDeleteEmployeeSchedule();
  const bulkAssignSchedule = useBulkAssignSchedule();

  // Data
  const modeles = schedulesData?.schedules || [];
  const joursFeries = holidaysData?.holidays || [];
  const congesValides = leavesData?.leaves || [];
  const declarationsHS = overtimeData?.overtime || [];
  const overtimePeriods = overtimePeriodsData?.periods || [];
  const availableEmployees = employeesForOvertimeData?.employees || [];
  const overtimeConfig = overtimeConfigData?.config;
  const employeeScheduleAssignments = employeeSchedulesData?.assignments || [];
  const employeesWithoutSchedule = employeesWithoutScheduleData?.employees || [];

  // Handlers - Schedules
  const handleOpenScheduleModal = (schedule?: WorkSchedule) => {
    setEditingSchedule(schedule || null);
    setShowScheduleModal(true);
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('Supprimer ce modèle d\'horaires ?')) return;
    try {
      await deleteSchedule.mutateAsync(id);
      toast({ title: 'Succès', description: 'Modèle supprimé' });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message || 'Erreur lors de la suppression', variant: 'destructive' });
    }
  };

  // Handlers - Holidays
  const handleOpenHolidayModal = (holiday?: PublicHoliday) => {
    if (holiday) {
      setEditingHoliday(holiday);
      setHolidayForm({
        nom: holiday.nom,
        date_debut: holiday.date_debut,
        recurrent: holiday.recurrent,
        description: holiday.description || '',
      });
    } else {
      setEditingHoliday(null);
      setHolidayForm({
        nom: '',
        date_debut: '',
        recurrent: false,
        description: '',
      });
    }
    setShowHolidayModal(true);
  };

  const handleSaveHoliday = async () => {
    if (!holidayForm.nom || !holidayForm.date_debut) {
      toast({ title: 'Erreur', description: 'Le nom et la date sont requis', variant: 'destructive' });
      return;
    }

    try {
      if (editingHoliday) {
        await updateHoliday.mutateAsync({ id: editingHoliday.id, data: holidayForm });
        toast({ title: 'Succès', description: 'Jour férié mis à jour' });
      } else {
        await createHoliday.mutateAsync(holidayForm);
        toast({ title: 'Succès', description: 'Jour férié ajouté' });
      }
      setShowHolidayModal(false);
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message || 'Erreur lors de la sauvegarde', variant: 'destructive' });
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    if (!confirm('Supprimer ce jour férié ?')) return;
    try {
      await deleteHoliday.mutateAsync(id);
      toast({ title: 'Succès', description: 'Jour férié supprimé' });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message || 'Erreur lors de la suppression', variant: 'destructive' });
    }
  };

  // Handlers - Overtime
  const handleApproveOvertime = async (id: number, hours: number) => {
    try {
      await approveOvertime.mutateAsync({ id, data: { hours_approved: hours } });
      toast({ title: 'Succès', description: 'Heures supplémentaires approuvées' });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message || 'Erreur lors de l\'approbation', variant: 'destructive' });
    }
  };

  const handleRejectOvertime = async (id: number) => {
    const comment = prompt('Motif du refus (optionnel):');
    try {
      await rejectOvertime.mutateAsync({ id, comment: comment || undefined });
      toast({ title: 'Succès', description: 'Heures supplémentaires refusées' });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message || 'Erreur lors du refus', variant: 'destructive' });
    }
  };

  // Handlers - Overtime Periods
  const handleCreateOrUpdateOvertimePeriod = async () => {
    if (!overtimePeriodForm.period_date || !overtimePeriodForm.start_time || !overtimePeriodForm.end_time) {
      toast({ title: 'Erreur', description: 'Date et horaires requis', variant: 'destructive' });
      return;
    }

    if (overtimePeriodForm.employee_ids.length === 0) {
      toast({ title: 'Erreur', description: 'Veuillez sélectionner au moins un employé', variant: 'destructive' });
      return;
    }

    try {
      let result;
      if (editingPeriodId) {
        // Update existing period
        result = await updateOvertimePeriod.mutateAsync({ id: editingPeriodId, data: overtimePeriodForm });
      } else {
        // Create new period
        result = await createOvertimePeriod.mutateAsync(overtimePeriodForm);
      }

      // Afficher message avec avertissements si présents
      let message = editingPeriodId
        ? `Période HS mise à jour pour ${overtimePeriodForm.employee_ids.length} employé(s)`
        : `Période HS déclarée pour ${overtimePeriodForm.employee_ids.length} employé(s)`;
      if (result.warnings && result.warnings.length > 0) {
        const warningNames = result.warnings.map(w => w.employee_name).join(', ');
        message += `. Attention: ${warningNames} n'ont pas de pointage pour cette date.`;
      }
      toast({ title: 'Succès', description: message });

      setShowOvertimePeriodModal(false);
      setEditingPeriodId(null);
      // Reset form
      setOvertimePeriodForm({
        period_date: new Date().toISOString().split('T')[0],
        start_time: '17:00',
        end_time: '21:00',
        rate_type: 'normal',
        reason: '',
        employee_ids: [],
      });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message || 'Erreur lors de l\'opération', variant: 'destructive' });
    }
  };

  const handleEditOvertimePeriod = async (period: OvertimePeriod) => {
    // Fetch selected employees for this period using API client
    try {
      const data = await scheduleManagementApi.getOvertimePeriodById(period.id);

      if (data.success) {
        setOvertimePeriodForm({
          period_date: period.period_date,
          start_time: period.start_time,
          end_time: period.end_time,
          rate_type: period.rate_type as 'normal' | 'extended' | 'special',
          reason: period.reason || '',
          employee_ids: data.selected_employees.map((e: any) => e.employee_id),
        });
        setEditingPeriodId(period.id);
        setShowOvertimePeriodModal(true);
      }
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message || 'Erreur lors du chargement des données', variant: 'destructive' });
    }
  };

  const handleDeleteOvertimePeriod = async (id: string) => {
    if (!confirm('Supprimer cette période d\'heures supplémentaires ?')) return;
    try {
      await deleteOvertimePeriod.mutateAsync(id);
      toast({ title: 'Succès', description: 'Période supprimée' });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message || 'Erreur lors de la suppression', variant: 'destructive' });
    }
  };

  const handleRecalculatePeriod = async (id: string) => {
    try {
      await recalculateOvertimePeriod.mutateAsync(id);
      toast({ title: 'Succès', description: 'Heures recalculées' });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message || 'Erreur lors du recalcul', variant: 'destructive' });
    }
  };

  // Handlers - Overtime Config
  const handleSaveOvertimeConfig = async () => {
    try {
      await updateOvertimeConfig.mutateAsync(overtimeConfigForm);
      toast({ title: 'Succès', description: 'Configuration sauvegardée' });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message || 'Erreur lors de la sauvegarde', variant: 'destructive' });
    }
  };

  // Handlers - Employee Schedules
  const handleOpenEmployeeScheduleModal = (assignment?: EmployeeScheduleAssignment) => {
    if (assignment) {
      setEditingEmployeeSchedule(assignment);
      setEmployeeScheduleForm({
        employee_id: assignment.employee_id,
        schedule_id: assignment.schedule_id,
        start_date: assignment.start_date,
        end_date: assignment.end_date || '',
        is_primary: assignment.is_primary,
      });
    } else {
      setEditingEmployeeSchedule(null);
      setEmployeeScheduleForm({
        employee_id: '',
        schedule_id: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        is_primary: true,
      });
    }
    setShowEmployeeScheduleModal(true);
  };

  const handleSaveEmployeeSchedule = async () => {
    if (!employeeScheduleForm.employee_id || !employeeScheduleForm.schedule_id || !employeeScheduleForm.start_date) {
      toast({ title: 'Erreur', description: 'Employé, horaire et date de début sont requis', variant: 'destructive' });
      return;
    }

    try {
      const data = {
        ...employeeScheduleForm,
        end_date: employeeScheduleForm.end_date || null,
      };

      if (editingEmployeeSchedule) {
        await updateEmployeeSchedule.mutateAsync({ id: editingEmployeeSchedule.id, data });
        toast({ title: 'Succès', description: 'Attribution mise à jour' });
      } else {
        await createEmployeeSchedule.mutateAsync(data);
        toast({ title: 'Succès', description: 'Horaire attribué à l\'employé' });
      }
      setShowEmployeeScheduleModal(false);
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message || 'Erreur lors de la sauvegarde', variant: 'destructive' });
    }
  };

  const handleDeleteEmployeeSchedule = async (id: string) => {
    if (!confirm('Supprimer cette attribution d\'horaire ?')) return;
    try {
      await deleteEmployeeSchedule.mutateAsync(id);
      toast({ title: 'Succès', description: 'Attribution supprimée' });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message || 'Erreur lors de la suppression', variant: 'destructive' });
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkAssignForm.schedule_id || bulkAssignForm.employee_ids.length === 0 || !bulkAssignForm.start_date) {
      toast({ title: 'Erreur', description: 'Sélectionnez un horaire, au moins un employé et une date de début', variant: 'destructive' });
      return;
    }

    try {
      const result = await bulkAssignSchedule.mutateAsync({
        ...bulkAssignForm,
        end_date: bulkAssignForm.end_date || undefined,
      });
      toast({ title: 'Succès', description: result.message });
      setShowBulkAssignModal(false);
      setBulkAssignForm({
        employee_ids: [],
        schedule_id: '',
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
      });
    } catch (error: any) {
      toast({ title: 'Erreur', description: error.message || 'Erreur lors de l\'attribution', variant: 'destructive' });
    }
  };

  // Initialize config form when data loads
  const initConfigForm = () => {
    if (overtimeConfig && Object.keys(overtimeConfigForm).length === 0) {
      setOvertimeConfigForm({
        daily_threshold_hours: overtimeConfig.daily_threshold_hours,
        weekly_threshold_hours: overtimeConfig.weekly_threshold_hours,
        monthly_max_hours: overtimeConfig.monthly_max_hours,
        rate_25_multiplier: overtimeConfig.rate_25_multiplier,
        rate_50_multiplier: overtimeConfig.rate_50_multiplier,
        rate_100_multiplier: overtimeConfig.rate_100_multiplier,
        rate_25_threshold_hours: overtimeConfig.rate_25_threshold_hours,
        rate_50_threshold_hours: overtimeConfig.rate_50_threshold_hours,
        night_start: overtimeConfig.night_start,
        night_end: overtimeConfig.night_end,
        apply_100_for_night: overtimeConfig.apply_100_for_night,
        apply_100_for_weekend: overtimeConfig.apply_100_for_weekend,
        apply_100_for_holiday: overtimeConfig.apply_100_for_holiday,
        requires_prior_approval: overtimeConfig.requires_prior_approval,
      });
    }
  };

  // Call initConfigForm when switching to config tab
  if (activeTab === 'config-hs' && overtimeConfig && Object.keys(overtimeConfigForm).length === 0) {
    initConfigForm();
  }

  // Render loading/error states
  const renderLoadingOrError = (loading: boolean, error: any, tabName: string) => {
    if (loading) {
      return (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Chargement...</span>
          </CardContent>
        </Card>
      );
    }
    if (error) {
      return (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <span className="ml-2 text-red-500">Erreur de chargement</span>
          </CardContent>
        </Card>
      );
    }
    return null;
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'modeles':
        const scheduleState = renderLoadingOrError(schedulesLoading, schedulesError, 'modèles');
        if (scheduleState) return scheduleState;

        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Modèles d'Horaires
              </CardTitle>
              <ProtectedButton
                permission={PERMISSIONS.ressources_humaines.gestion_horaires.modeles.creer}
                size="sm"
                onClick={() => handleOpenScheduleModal()}
              >
                <Plus className="h-4 w-4 mr-2" />
                Nouveau modèle
              </ProtectedButton>
            </CardHeader>
            <CardContent>
              {modeles.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Aucun modèle d'horaires. Cliquez sur "Nouveau modèle" pour en créer un.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Heures/Semaine</TableHead>
                      <TableHead>Jours travaillés</TableHead>
                      <TableHead>Statut</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {modeles.map(modele => (
                      <TableRow key={modele.id}>
                        <TableCell className="font-medium">
                          {modele.nom}
                          {modele.is_default && (
                            <Badge className="ml-2 bg-blue-100 text-blue-800" variant="outline">Par défaut</Badge>
                          )}
                        </TableCell>
                        <TableCell>{modele.description}</TableCell>
                        <TableCell>{modele.heures_hebdo}h</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {JOURS_SEMAINE.map(jour => (
                              <span
                                key={jour}
                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                                  modele.horaires?.[jour]?.actif
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-400'
                                }`}
                              >
                                {jour[0]}
                              </span>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          {modele.actif ? (
                            <Badge className="bg-green-100 text-green-800">Actif</Badge>
                          ) : (
                            <Badge variant="outline">Inactif</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <ProtectedButton
                            permission={PERMISSIONS.ressources_humaines.gestion_horaires.modeles.modifier}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenScheduleModal(modele)}
                          >
                            <Edit className="h-4 w-4" />
                          </ProtectedButton>
                          <ProtectedButton
                            permission={PERMISSIONS.ressources_humaines.gestion_horaires.modeles.supprimer}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteSchedule(modele.id)}
                            disabled={deleteSchedule.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </ProtectedButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        );

      case 'employes':
        const empScheduleState = renderLoadingOrError(empSchedulesLoading, empSchedulesError, 'horaires employés');
        if (empScheduleState) return empScheduleState;

        return (
          <div className="space-y-6">
            {/* Employés sans horaire */}
            {employeesWithoutSchedule.length > 0 && (
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-amber-800">
                    <AlertCircle className="h-5 w-5" />
                    Employés sans horaire ({employeesWithoutSchedule.length})
                  </CardTitle>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-amber-500 text-amber-700 hover:bg-amber-100"
                    onClick={() => {
                      setBulkAssignForm({
                        employee_ids: employeesWithoutSchedule.map(e => e.id),
                        schedule_id: '',
                        start_date: new Date().toISOString().split('T')[0],
                        end_date: '',
                      });
                      setShowBulkAssignModal(true);
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Assigner un horaire à tous
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {employeesWithoutSchedule.map(emp => (
                      <Badge key={emp.id} variant="outline" className="bg-white">
                        {emp.first_name} {emp.last_name}
                        {emp.employee_number && <span className="text-gray-400 ml-1">#{emp.employee_number}</span>}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Liste des attributions */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Horaires par Employé
                </CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setBulkAssignForm({
                        employee_ids: [],
                        schedule_id: '',
                        start_date: new Date().toISOString().split('T')[0],
                        end_date: '',
                      });
                      setShowBulkAssignModal(true);
                    }}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Attribution multiple
                  </Button>
                  <ProtectedButton
                    permission={PERMISSIONS.ressources_humaines.gestion_horaires.modeles.modifier}
                    size="sm"
                    onClick={() => handleOpenEmployeeScheduleModal()}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nouvelle attribution
                  </ProtectedButton>
                </div>
              </CardHeader>
              <CardContent>
                {employeeScheduleAssignments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Aucune attribution d'horaire spécifique.
                    <br />
                    <span className="text-sm">Les employés utilisent l'horaire par défaut du système.</span>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employé</TableHead>
                        <TableHead>Département</TableHead>
                        <TableHead>Horaire</TableHead>
                        <TableHead>Heures/sem</TableHead>
                        <TableHead>Date début</TableHead>
                        <TableHead>Date fin</TableHead>
                        <TableHead>Principal</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employeeScheduleAssignments.map((assignment: EmployeeScheduleAssignment) => (
                        <TableRow key={assignment.id}>
                          <TableCell className="font-medium">
                            {assignment.employee_name}
                            {assignment.employee_number && (
                              <span className="text-gray-400 text-sm ml-1">#{assignment.employee_number}</span>
                            )}
                          </TableCell>
                          <TableCell>{assignment.department || '-'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-blue-50">
                              {assignment.schedule_name}
                            </Badge>
                          </TableCell>
                          <TableCell>{assignment.weekly_hours}h</TableCell>
                          <TableCell>
                            {new Date(assignment.start_date).toLocaleDateString('fr-FR')}
                          </TableCell>
                          <TableCell>
                            {assignment.end_date
                              ? new Date(assignment.end_date).toLocaleDateString('fr-FR')
                              : <span className="text-gray-400">Indéfini</span>
                            }
                          </TableCell>
                          <TableCell>
                            {assignment.is_primary ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <ProtectedButton
                              permission={PERMISSIONS.ressources_humaines.gestion_horaires.modeles.modifier}
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEmployeeScheduleModal(assignment)}
                            >
                              <Edit className="h-4 w-4" />
                            </ProtectedButton>
                            <ProtectedButton
                              permission={PERMISSIONS.ressources_humaines.gestion_horaires.modeles.supprimer}
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteEmployeeSchedule(assignment.id)}
                              disabled={deleteEmployeeSchedule.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </ProtectedButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'feries':
        const holidayState = renderLoadingOrError(holidaysLoading, holidaysError, 'jours fériés');
        if (holidayState) return holidayState;

        return (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Jours Fériés & Congés Collectifs ({currentYear})
              </CardTitle>
              <ProtectedButton
                permission={PERMISSIONS.ressources_humaines.gestion_horaires.jours_feries.creer}
                size="sm"
                onClick={() => handleOpenHolidayModal()}
              >
                <Plus className="h-4 w-4 mr-2" />
                Ajouter
              </ProtectedButton>
            </CardHeader>
            <CardContent>
              {joursFeries.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Aucun jour férié pour {currentYear}. Cliquez sur "Ajouter" pour en créer.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nom</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Récurrent</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {joursFeries.map(jour => (
                      <TableRow key={jour.id}>
                        <TableCell className="font-medium">{jour.nom}</TableCell>
                        <TableCell>
                          {new Date(jour.date_debut).toLocaleDateString('fr-FR')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-red-50 text-red-700">
                            Férié
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {jour.recurrent ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <ProtectedButton
                            permission={PERMISSIONS.ressources_humaines.gestion_horaires.jours_feries.modifier}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenHolidayModal(jour)}
                          >
                            <Edit className="h-4 w-4" />
                          </ProtectedButton>
                          <ProtectedButton
                            permission={PERMISSIONS.ressources_humaines.gestion_horaires.jours_feries.supprimer}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteHoliday(jour.id)}
                            disabled={deleteHoliday.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </ProtectedButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        );

      case 'conges':
        const leavesState = renderLoadingOrError(leavesLoading, leavesError, 'congés');
        if (leavesState) return leavesState;

        return (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Congés Validés ({currentYear})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {congesValides.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Aucun congé validé pour {currentYear}.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employé</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Période</TableHead>
                      <TableHead>Durée</TableHead>
                      <TableHead>Statut</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {congesValides.map(conge => (
                      <TableRow key={conge.id}>
                        <TableCell className="font-medium">{conge.employe_nom}</TableCell>
                        <TableCell>{conge.type_conge}</TableCell>
                        <TableCell>
                          {new Date(conge.date_debut).toLocaleDateString('fr-FR')} → {new Date(conge.date_fin).toLocaleDateString('fr-FR')}
                        </TableCell>
                        <TableCell>{conge.jours} jours</TableCell>
                        <TableCell>
                          <Badge className="bg-green-100 text-green-800">Approuvé</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        );

      case 'heures-sup':
        const overtimeState = renderLoadingOrError(overtimeLoading || periodsLoading, overtimeError || periodsError, 'heures sup');
        if (overtimeState) return overtimeState;

        return (
          <div className="space-y-6">
            {/* Périodes HS déclarées par le manager */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Timer className="h-5 w-5" />
                  Périodes d'Heures Supplémentaires (Manager)
                </CardTitle>
                <ProtectedButton
                  permission={PERMISSIONS.ressources_humaines.gestion_horaires.heures_sup.creer_periode}
                  size="sm"
                  onClick={() => setShowOvertimePeriodModal(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Déclarer une période HS
                </ProtectedButton>
              </CardHeader>
              <CardContent>
                {overtimePeriods.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Aucune période d'heures supplémentaires déclarée.
                    <br />
                    <span className="text-sm">Cliquez sur "Déclarer une période HS" pour créer une période.</span>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Horaire</TableHead>
                        <TableHead>Taux</TableHead>
                        <TableHead>Employés</TableHead>
                        <TableHead>Heures totales</TableHead>
                        <TableHead>Motif</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overtimePeriods.map((period: OvertimePeriod) => {
                        const rateInfo = RATE_TYPES.find(r => r.value === period.rate_type) || RATE_TYPES[0];
                        return (
                          <TableRow key={period.id}>
                            <TableCell className="font-medium">
                              {new Date(period.period_date).toLocaleDateString('fr-FR', {
                                weekday: 'short',
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric'
                              })}
                            </TableCell>
                            <TableCell>
                              {period.start_time?.slice(0, 5)} - {period.end_time?.slice(0, 5)}
                            </TableCell>
                            <TableCell>
                              <Badge className={rateInfo.color}>{rateInfo.label}</Badge>
                            </TableCell>
                            <TableCell>{period.employee_count || 0}</TableCell>
                            <TableCell>{period.total_minutes ? Math.round(period.total_minutes / 60 * 100) / 100 : 0}h</TableCell>
                            <TableCell className="max-w-xs truncate">{period.reason || '-'}</TableCell>
                            <TableCell>
                              <Badge className={period.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                                {period.status === 'active' ? 'Actif' : 'Annulé'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <ProtectedButton
                                permission={PERMISSIONS.ressources_humaines.gestion_horaires.heures_sup.recalculer}
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditOvertimePeriod(period)}
                                title="Modifier la période"
                              >
                                <Edit className="h-4 w-4" />
                              </ProtectedButton>
                              <ProtectedButton
                                permission={PERMISSIONS.ressources_humaines.gestion_horaires.heures_sup.recalculer}
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRecalculatePeriod(period.id)}
                                disabled={recalculateOvertimePeriod.isPending}
                                title="Recalculer les heures"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </ProtectedButton>
                              <ProtectedButton
                                permission={PERMISSIONS.ressources_humaines.gestion_horaires.heures_sup.supprimer_periode}
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteOvertimePeriod(period.id)}
                                disabled={deleteOvertimePeriod.isPending}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </ProtectedButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Déclarations HS individuelles (ancien système) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Demandes individuelles d'Heures Supplémentaires
                </CardTitle>
              </CardHeader>
              <CardContent>
                {declarationsHS.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    Aucune demande individuelle d'heures supplémentaires.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employé</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Heures demandées</TableHead>
                        <TableHead>Motif</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {declarationsHS.map(decl => (
                        <TableRow key={decl.id}>
                          <TableCell className="font-medium">{decl.employe_nom}</TableCell>
                          <TableCell>{new Date(decl.request_date).toLocaleDateString('fr-FR')}</TableCell>
                          <TableCell>{decl.heures_demandees}h</TableCell>
                          <TableCell className="max-w-xs truncate">{decl.motif || '-'}</TableCell>
                          <TableCell>
                            <Badge className={
                              decl.statut === 'approved' ? 'bg-green-100 text-green-800' :
                              decl.statut === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }>
                              {decl.statut === 'approved' ? 'Approuvé' :
                               decl.statut === 'pending' ? 'En attente' : 'Refusé'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {decl.statut === 'pending' && (
                              <>
                                <ProtectedButton
                                  permission={PERMISSIONS.ressources_humaines.gestion_horaires.heures_sup.approuver}
                                  variant="ghost"
                                  size="sm"
                                  className="text-green-600"
                                  onClick={() => handleApproveOvertime(decl.id, decl.heures_demandees)}
                                  disabled={approveOvertime.isPending}
                                >
                                  <Check className="h-4 w-4" />
                                </ProtectedButton>
                                <ProtectedButton
                                  permission={PERMISSIONS.ressources_humaines.gestion_horaires.heures_sup.rejeter}
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600"
                                  onClick={() => handleRejectOvertime(decl.id)}
                                  disabled={rejectOvertime.isPending}
                                >
                                  <X className="h-4 w-4" />
                                </ProtectedButton>
                              </>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 'config-hs':
        if (configLoading) {
          return (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                <span className="ml-2 text-gray-500">Chargement de la configuration...</span>
              </CardContent>
            </Card>
          );
        }

        return (
          <div className="space-y-6">
            {/* Seuils */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Seuils Heures Supplémentaires
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label>Seuil quotidien (heures)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={overtimeConfigForm.daily_threshold_hours ?? 8}
                      onChange={(e) => setOvertimeConfigForm({ ...overtimeConfigForm, daily_threshold_hours: parseFloat(e.target.value) })}
                    />
                    <p className="text-xs text-gray-500 mt-1">Heures normales par jour avant HS</p>
                  </div>
                  <div>
                    <Label>Seuil hebdomadaire (heures)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={overtimeConfigForm.weekly_threshold_hours ?? 44}
                      onChange={(e) => setOvertimeConfigForm({ ...overtimeConfigForm, weekly_threshold_hours: parseFloat(e.target.value) })}
                    />
                    <p className="text-xs text-gray-500 mt-1">Heures normales par semaine avant HS</p>
                  </div>
                  <div>
                    <Label>Maximum mensuel HS (heures)</Label>
                    <Input
                      type="number"
                      step="0.5"
                      value={overtimeConfigForm.monthly_max_hours ?? 40}
                      onChange={(e) => setOvertimeConfigForm({ ...overtimeConfigForm, monthly_max_hours: parseFloat(e.target.value) })}
                    />
                    <p className="text-xs text-gray-500 mt-1">Maximum heures sup par mois</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Taux de majoration */}
            <Card>
              <CardHeader>
                <CardTitle>Taux de Majoration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg bg-green-50">
                    <Label className="text-green-700">Taux 25%</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm text-gray-600">Multiplicateur:</span>
                      <Input
                        type="number"
                        step="0.05"
                        className="w-24"
                        value={overtimeConfigForm.rate_25_multiplier ?? 1.25}
                        onChange={(e) => setOvertimeConfigForm({ ...overtimeConfigForm, rate_25_multiplier: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm text-gray-600">Jusqu'à:</span>
                      <Input
                        type="number"
                        step="0.5"
                        className="w-24"
                        value={overtimeConfigForm.rate_25_threshold_hours ?? 8}
                        onChange={(e) => setOvertimeConfigForm({ ...overtimeConfigForm, rate_25_threshold_hours: parseFloat(e.target.value) })}
                      />
                      <span className="text-sm text-gray-600">h HS</span>
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg bg-yellow-50">
                    <Label className="text-yellow-700">Taux 50%</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm text-gray-600">Multiplicateur:</span>
                      <Input
                        type="number"
                        step="0.05"
                        className="w-24"
                        value={overtimeConfigForm.rate_50_multiplier ?? 1.50}
                        onChange={(e) => setOvertimeConfigForm({ ...overtimeConfigForm, rate_50_multiplier: parseFloat(e.target.value) })}
                      />
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm text-gray-600">Jusqu'à:</span>
                      <Input
                        type="number"
                        step="0.5"
                        className="w-24"
                        value={overtimeConfigForm.rate_50_threshold_hours ?? 16}
                        onChange={(e) => setOvertimeConfigForm({ ...overtimeConfigForm, rate_50_threshold_hours: parseFloat(e.target.value) })}
                      />
                      <span className="text-sm text-gray-600">h HS</span>
                    </div>
                  </div>
                  <div className="p-4 border rounded-lg bg-red-50">
                    <Label className="text-red-700">Taux 100%</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm text-gray-600">Multiplicateur:</span>
                      <Input
                        type="number"
                        step="0.05"
                        className="w-24"
                        value={overtimeConfigForm.rate_100_multiplier ?? 2.00}
                        onChange={(e) => setOvertimeConfigForm({ ...overtimeConfigForm, rate_100_multiplier: parseFloat(e.target.value) })}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Au-delà du seuil 50%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Plage horaire nuit */}
            <Card>
              <CardHeader>
                <CardTitle>Plage Horaire de Nuit (Taux 100%)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Début de nuit</Label>
                    <Input
                      type="time"
                      value={overtimeConfigForm.night_start ?? '21:00'}
                      onChange={(e) => setOvertimeConfigForm({ ...overtimeConfigForm, night_start: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Fin de nuit</Label>
                    <Input
                      type="time"
                      value={overtimeConfigForm.night_end ?? '06:00'}
                      onChange={(e) => setOvertimeConfigForm({ ...overtimeConfigForm, night_end: e.target.value })}
                    />
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={overtimeConfigForm.apply_100_for_night ?? true}
                      onCheckedChange={(checked) => setOvertimeConfigForm({ ...overtimeConfigForm, apply_100_for_night: !!checked })}
                    />
                    <Label>Appliquer taux 100% pour travail de nuit</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={overtimeConfigForm.apply_100_for_weekend ?? true}
                      onCheckedChange={(checked) => setOvertimeConfigForm({ ...overtimeConfigForm, apply_100_for_weekend: !!checked })}
                    />
                    <Label>Appliquer taux 100% pour le weekend</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={overtimeConfigForm.apply_100_for_holiday ?? true}
                      onCheckedChange={(checked) => setOvertimeConfigForm({ ...overtimeConfigForm, apply_100_for_holiday: !!checked })}
                    />
                    <Label>Appliquer taux 100% pour les jours fériés</Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Options */}
            <Card>
              <CardHeader>
                <CardTitle>Options</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={overtimeConfigForm.requires_prior_approval ?? false}
                    onCheckedChange={(checked) => setOvertimeConfigForm({ ...overtimeConfigForm, requires_prior_approval: !!checked })}
                  />
                  <Label>Approbation préalable obligatoire pour les heures supplémentaires</Label>
                </div>
              </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
              <ProtectedButton
                permission={PERMISSIONS.ressources_humaines.gestion_horaires.config_hs.modifier}
                onClick={handleSaveOvertimeConfig}
                disabled={updateOvertimeConfig.isPending}
              >
                {updateOvertimeConfig.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enregistrer la configuration
              </ProtectedButton>
            </div>
          </div>
        );

      case 'horloge':
        return (
          <div className="space-y-6">
            <SystemClockEditor />
          </div>
        );
    }
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Calendar className="h-8 w-8 text-blue-600" />
            Gestion des Horaires
          </h1>
          <p className="text-gray-500 mt-1">
            Modèles d'horaires, jours fériés, congés et heures supplémentaires
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex gap-4" aria-label="Tabs">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-600 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
            {/* Onglet Récupération - Lien vers page séparée */}
            <Link
              to="/admin/hr/recovery"
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                location.pathname === '/admin/hr/recovery'
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <CalendarClock className="h-4 w-4" />
              Récupération
            </Link>
          </nav>
        </div>

        {/* Tab Content */}
        {renderTabContent()}
      </div>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <WorkScheduleFormModal
          scheduleId={editingSchedule?.id || null}
          onClose={() => {
            setShowScheduleModal(false);
            setEditingSchedule(null);
          }}
        />
      )}

      {/* Holiday Modal */}
      <Dialog open={showHolidayModal} onOpenChange={setShowHolidayModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingHoliday ? 'Modifier le jour férié' : 'Nouveau jour férié'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Nom *</Label>
              <Input
                value={holidayForm.nom}
                onChange={(e) => setHolidayForm({ ...holidayForm, nom: e.target.value })}
                placeholder="Ex: Fête du Travail"
              />
            </div>
            <div>
              <Label>Date *</Label>
              <Input
                type="date"
                value={holidayForm.date_debut}
                onChange={(e) => setHolidayForm({ ...holidayForm, date_debut: e.target.value })}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={holidayForm.description}
                onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })}
                placeholder="Description optionnelle..."
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={holidayForm.recurrent}
                onCheckedChange={(checked) => setHolidayForm({ ...holidayForm, recurrent: !!checked })}
              />
              <Label>Récurrent chaque année</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHolidayModal(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSaveHoliday}
              disabled={createHoliday.isPending || updateHoliday.isPending}
            >
              {(createHoliday.isPending || updateHoliday.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingHoliday ? 'Mettre à jour' : 'Ajouter'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Overtime Period Modal */}
      <Dialog open={showOvertimePeriodModal} onOpenChange={setShowOvertimePeriodModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" />
              {editingPeriodId ? 'Modifier la période d\'heures supplémentaires' : 'Déclarer une période d\'heures supplémentaires'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Date *</Label>
              <Input
                type="date"
                value={overtimePeriodForm.period_date}
                onChange={(e) => setOvertimePeriodForm({ ...overtimePeriodForm, period_date: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Heure début *</Label>
                <Input
                  type="time"
                  value={overtimePeriodForm.start_time}
                  onChange={(e) => setOvertimePeriodForm({ ...overtimePeriodForm, start_time: e.target.value })}
                />
              </div>
              <div>
                <Label>Heure fin *</Label>
                <Input
                  type="time"
                  value={overtimePeriodForm.end_time}
                  onChange={(e) => setOvertimePeriodForm({ ...overtimePeriodForm, end_time: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Taux de majoration</Label>
              <Select
                value={overtimePeriodForm.rate_type}
                onValueChange={(value: 'normal' | 'extended' | 'special') =>
                  setOvertimePeriodForm({ ...overtimePeriodForm, rate_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RATE_TYPES.map(rate => (
                    <SelectItem key={rate.value} value={rate.value}>
                      {rate.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Section Sélection des Employés */}
            <div className="border rounded-lg p-4">
              <Label className="text-base font-semibold mb-3 block">
                Employés concernés * ({overtimePeriodForm.employee_ids.length} sélectionné(s))
              </Label>
              <div className="max-h-48 overflow-y-auto space-y-2 border rounded p-2 bg-gray-50">
                {availableEmployees.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    Aucun employé actif disponible
                  </div>
                ) : (
                  availableEmployees.map(emp => (
                    <div key={emp.id} className="flex items-center gap-2 p-2 hover:bg-white rounded">
                      <Checkbox
                        id={`emp-${emp.id}`}
                        checked={overtimePeriodForm.employee_ids.includes(emp.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setOvertimePeriodForm({
                              ...overtimePeriodForm,
                              employee_ids: [...overtimePeriodForm.employee_ids, emp.id]
                            });
                          } else {
                            setOvertimePeriodForm({
                              ...overtimePeriodForm,
                              employee_ids: overtimePeriodForm.employee_ids.filter(id => id !== emp.id)
                            });
                          }
                        }}
                      />
                      <label htmlFor={`emp-${emp.id}`} className="flex-1 cursor-pointer text-sm">
                        <span className="font-medium">{emp.first_name} {emp.last_name}</span>
                        {emp.employee_number && (
                          <span className="text-gray-500 ml-2">#{emp.employee_number}</span>
                        )}
                        {emp.department && (
                          <span className="text-gray-400 ml-2 text-xs">({emp.department})</span>
                        )}
                      </label>
                    </div>
                  ))
                )}
              </div>
              {availableEmployees.length > 0 && (
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOvertimePeriodForm({
                      ...overtimePeriodForm,
                      employee_ids: availableEmployees.map(e => e.id)
                    })}
                  >
                    Tout sélectionner
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setOvertimePeriodForm({ ...overtimePeriodForm, employee_ids: [] })}
                  >
                    Tout désélectionner
                  </Button>
                </div>
              )}
            </div>

            <div>
              <Label>Motif (optionnel)</Label>
              <Textarea
                value={overtimePeriodForm.reason}
                onChange={(e) => setOvertimePeriodForm({ ...overtimePeriodForm, reason: e.target.value })}
                placeholder="Ex: Projet urgent, inventaire..."
              />
            </div>
            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
              <p className="font-medium">Comment ça marche ?</p>
              <p className="mt-1">Les employés sélectionnés ayant pointé pendant cette période auront leurs heures supplémentaires calculées (intersection avec leur pointage) et ajoutées à leur fiche.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowOvertimePeriodModal(false);
              setEditingPeriodId(null);
              setOvertimePeriodForm({
                period_date: new Date().toISOString().split('T')[0],
                start_time: '17:00',
                end_time: '21:00',
                rate_type: 'normal',
                reason: '',
                employee_ids: [],
              });
            }}>
              Annuler
            </Button>
            <Button
              onClick={handleCreateOrUpdateOvertimePeriod}
              disabled={(createOvertimePeriod.isPending || updateOvertimePeriod.isPending) || overtimePeriodForm.employee_ids.length === 0}
            >
              {(createOvertimePeriod.isPending || updateOvertimePeriod.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingPeriodId ? `Modifier (${overtimePeriodForm.employee_ids.length})` : `Déclarer (${overtimePeriodForm.employee_ids.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Employee Schedule Assignment Modal */}
      <Dialog open={showEmployeeScheduleModal} onOpenChange={setShowEmployeeScheduleModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {editingEmployeeSchedule ? 'Modifier l\'attribution' : 'Nouvelle attribution d\'horaire'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Employé *</Label>
              <Select
                value={employeeScheduleForm.employee_id}
                onValueChange={(value) => setEmployeeScheduleForm({ ...employeeScheduleForm, employee_id: value })}
                disabled={!!editingEmployeeSchedule}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un employé" />
                </SelectTrigger>
                <SelectContent>
                  {/* Show current employee if editing */}
                  {editingEmployeeSchedule && (
                    <SelectItem value={editingEmployeeSchedule.employee_id}>
                      {editingEmployeeSchedule.employee_name}
                    </SelectItem>
                  )}
                  {/* Show employees without schedule for new assignment */}
                  {!editingEmployeeSchedule && employeesWithoutSchedule.map(emp => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name}
                      {emp.employee_number && ` (${emp.employee_number})`}
                    </SelectItem>
                  ))}
                  {/* Also show all employees from overtime list as fallback */}
                  {!editingEmployeeSchedule && availableEmployees
                    .filter(e => !employeesWithoutSchedule.find(ews => ews.id === e.id))
                    .map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.first_name} {emp.last_name}
                        {emp.employee_number && ` (${emp.employee_number})`}
                      </SelectItem>
                    ))
                  }
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Horaire *</Label>
              <Select
                value={employeeScheduleForm.schedule_id}
                onValueChange={(value) => setEmployeeScheduleForm({ ...employeeScheduleForm, schedule_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un horaire" />
                </SelectTrigger>
                <SelectContent>
                  {modeles.filter(m => m.actif).map(schedule => (
                    <SelectItem key={schedule.id} value={schedule.id}>
                      {schedule.nom} ({schedule.heures_hebdo}h/sem)
                      {schedule.is_default && ' - Par défaut'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date de début *</Label>
                <Input
                  type="date"
                  value={employeeScheduleForm.start_date}
                  onChange={(e) => setEmployeeScheduleForm({ ...employeeScheduleForm, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Date de fin (optionnel)</Label>
                <Input
                  type="date"
                  value={employeeScheduleForm.end_date || ''}
                  onChange={(e) => setEmployeeScheduleForm({ ...employeeScheduleForm, end_date: e.target.value || null })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                checked={employeeScheduleForm.is_primary}
                onCheckedChange={(checked) => setEmployeeScheduleForm({ ...employeeScheduleForm, is_primary: !!checked })}
              />
              <Label>Horaire principal</Label>
            </div>

            <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-700">
              <p className="font-medium">Note</p>
              <p className="mt-1">L'horaire principal est utilisé pour le calcul des retards et départs anticipés.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEmployeeScheduleModal(false)}>
              Annuler
            </Button>
            <Button
              onClick={handleSaveEmployeeSchedule}
              disabled={createEmployeeSchedule.isPending || updateEmployeeSchedule.isPending}
            >
              {(createEmployeeSchedule.isPending || updateEmployeeSchedule.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingEmployeeSchedule ? 'Mettre à jour' : 'Attribuer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Modal */}
      <Dialog open={showBulkAssignModal} onOpenChange={setShowBulkAssignModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Attribution multiple d'horaire
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Horaire à attribuer *</Label>
              <Select
                value={bulkAssignForm.schedule_id}
                onValueChange={(value) => setBulkAssignForm({ ...bulkAssignForm, schedule_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner un horaire" />
                </SelectTrigger>
                <SelectContent>
                  {modeles.filter(m => m.actif).map(schedule => (
                    <SelectItem key={schedule.id} value={schedule.id}>
                      {schedule.nom} ({schedule.heures_hebdo}h/sem)
                      {schedule.is_default && ' - Par défaut'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date de début *</Label>
                <Input
                  type="date"
                  value={bulkAssignForm.start_date}
                  onChange={(e) => setBulkAssignForm({ ...bulkAssignForm, start_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Date de fin (optionnel)</Label>
                <Input
                  type="date"
                  value={bulkAssignForm.end_date || ''}
                  onChange={(e) => setBulkAssignForm({ ...bulkAssignForm, end_date: e.target.value || null })}
                />
              </div>
            </div>

            <div className="border rounded-lg p-4">
              <Label className="text-base font-semibold mb-3 block">
                Employés à attribuer * ({bulkAssignForm.employee_ids.length} sélectionné(s))
              </Label>
              <div className="max-h-48 overflow-y-auto space-y-2 border rounded p-2 bg-gray-50">
                {availableEmployees.length === 0 ? (
                  <div className="text-center py-4 text-gray-500 text-sm">
                    Aucun employé actif disponible
                  </div>
                ) : (
                  availableEmployees.map(emp => (
                    <div key={emp.id} className="flex items-center gap-2 p-2 hover:bg-white rounded">
                      <Checkbox
                        id={`bulk-emp-${emp.id}`}
                        checked={bulkAssignForm.employee_ids.includes(emp.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setBulkAssignForm({
                              ...bulkAssignForm,
                              employee_ids: [...bulkAssignForm.employee_ids, emp.id]
                            });
                          } else {
                            setBulkAssignForm({
                              ...bulkAssignForm,
                              employee_ids: bulkAssignForm.employee_ids.filter(id => id !== emp.id)
                            });
                          }
                        }}
                      />
                      <label htmlFor={`bulk-emp-${emp.id}`} className="flex-1 cursor-pointer text-sm">
                        <span className="font-medium">{emp.first_name} {emp.last_name}</span>
                        {emp.employee_number && (
                          <span className="text-gray-500 ml-2">#{emp.employee_number}</span>
                        )}
                        {emp.department && (
                          <span className="text-gray-400 ml-2 text-xs">({emp.department})</span>
                        )}
                      </label>
                    </div>
                  ))
                )}
              </div>
              {availableEmployees.length > 0 && (
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setBulkAssignForm({
                      ...bulkAssignForm,
                      employee_ids: availableEmployees.map(e => e.id)
                    })}
                  >
                    Tout sélectionner
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setBulkAssignForm({ ...bulkAssignForm, employee_ids: [] })}
                  >
                    Tout désélectionner
                  </Button>
                </div>
              )}
            </div>

            <div className="bg-amber-50 p-3 rounded-lg text-sm text-amber-700">
              <p className="font-medium">Attention</p>
              <p className="mt-1">Les employés ayant déjà une attribution à la même date de début seront ignorés.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowBulkAssignModal(false);
              setBulkAssignForm({
                employee_ids: [],
                schedule_id: '',
                start_date: new Date().toISOString().split('T')[0],
                end_date: '',
              });
            }}>
              Annuler
            </Button>
            <Button
              onClick={handleBulkAssign}
              disabled={bulkAssignSchedule.isPending || bulkAssignForm.employee_ids.length === 0}
            >
              {bulkAssignSchedule.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Attribuer ({bulkAssignForm.employee_ids.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
