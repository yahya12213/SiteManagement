/**
 * Hooks React Query - Gestion des Horaires (Schedule Management)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  scheduleManagementApi,
  type CreateScheduleInput,
  type CreateHolidayInput,
  type CreateOvertimeInput,
  type CreateEmployeeScheduleInput,
} from '../lib/api/schedule-management';

// ============================================================
// WORK SCHEDULES HOOKS
// ============================================================

/**
 * Hook pour récupérer les modèles d'horaires
 */
export const useWorkSchedules = () => {
  return useQuery({
    queryKey: ['schedule-management', 'schedules'],
    queryFn: () => scheduleManagementApi.getSchedules(),
  });
};

/**
 * Hook pour créer un modèle d'horaires
 */
export const useCreateSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateScheduleInput) => scheduleManagementApi.createSchedule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'schedules'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'stats'] });
    },
  });
};

/**
 * Hook pour mettre à jour un modèle d'horaires
 */
export const useUpdateSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateScheduleInput> }) =>
      scheduleManagementApi.updateSchedule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'schedules'] });
    },
  });
};

/**
 * Hook pour supprimer un modèle d'horaires
 */
export const useDeleteSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => scheduleManagementApi.deleteSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'schedules'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'stats'] });
    },
  });
};

// ============================================================
// PUBLIC HOLIDAYS HOOKS
// ============================================================

/**
 * Hook pour récupérer les jours fériés
 */
export const usePublicHolidays = (year?: number) => {
  return useQuery({
    queryKey: ['schedule-management', 'holidays', year],
    queryFn: () => scheduleManagementApi.getHolidays(year),
  });
};

/**
 * Hook pour créer un jour férié
 */
export const useCreateHoliday = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateHolidayInput) => scheduleManagementApi.createHoliday(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'holidays'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'stats'] });
    },
  });
};

/**
 * Hook pour mettre à jour un jour férié
 */
export const useUpdateHoliday = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateHolidayInput> }) =>
      scheduleManagementApi.updateHoliday(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'holidays'] });
    },
  });
};

/**
 * Hook pour supprimer un jour férié
 */
export const useDeleteHoliday = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => scheduleManagementApi.deleteHoliday(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'holidays'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'stats'] });
    },
  });
};

// ============================================================
// APPROVED LEAVES HOOKS
// ============================================================

/**
 * Hook pour récupérer les congés approuvés
 */
export const useApprovedLeaves = (year?: number, month?: number) => {
  return useQuery({
    queryKey: ['schedule-management', 'approved-leaves', year, month],
    queryFn: () => scheduleManagementApi.getApprovedLeaves(year, month),
  });
};

// ============================================================
// OVERTIME HOOKS
// ============================================================

/**
 * Hook pour récupérer les déclarations d'heures supplémentaires
 */
export const useOvertimeDeclarations = (filters?: { status?: string; year?: number; month?: number }) => {
  return useQuery({
    queryKey: ['schedule-management', 'overtime', filters],
    queryFn: () => scheduleManagementApi.getOvertime(filters),
  });
};

/**
 * Hook pour créer une déclaration d'heures supplémentaires
 */
export const useCreateOvertime = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateOvertimeInput) => scheduleManagementApi.createOvertime(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'overtime'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'stats'] });
    },
  });
};

/**
 * Hook pour approuver une déclaration
 */
export const useApproveOvertime = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { hours_approved?: number; comment?: string } }) =>
      scheduleManagementApi.approveOvertime(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'overtime'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'stats'] });
    },
  });
};

/**
 * Hook pour rejeter une déclaration
 */
export const useRejectOvertime = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, comment }: { id: number; comment?: string }) =>
      scheduleManagementApi.rejectOvertime(id, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'overtime'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'stats'] });
    },
  });
};

/**
 * Hook pour supprimer une déclaration
 */
export const useDeleteOvertime = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => scheduleManagementApi.deleteOvertime(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'overtime'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'stats'] });
    },
  });
};

// ============================================================
// EMPLOYEES FOR OVERTIME SELECTION HOOK
// ============================================================

/**
 * Hook pour récupérer les employés disponibles pour sélection HS
 */
export const useEmployeesForOvertime = (departmentId?: string, date?: string) => {
  return useQuery({
    queryKey: ['schedule-management', 'employees-for-overtime', departmentId, date],
    queryFn: () => scheduleManagementApi.getEmployeesForOvertime(departmentId, date),
  });
};

// ============================================================
// OVERTIME PERIODS HOOKS (Manager declarations)
// ============================================================

/**
 * Hook pour récupérer les périodes HS déclarées
 */
export const useOvertimePeriods = (filters?: { year?: number; month?: number; status?: string }) => {
  return useQuery({
    queryKey: ['schedule-management', 'overtime-periods', filters],
    queryFn: () => scheduleManagementApi.getOvertimePeriods(filters),
  });
};

/**
 * Hook pour créer une période HS avec sélection d'employés
 */
export const useCreateOvertimePeriod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { period_date: string; start_time: string; end_time: string; department_id?: string; reason?: string; rate_type?: 'normal' | 'extended' | 'special'; employee_ids: string[] }) =>
      scheduleManagementApi.createOvertimePeriod(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'overtime-periods'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'overtime'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'stats'] });
      // Rafraîchir aussi les données d'attendance car overtime_minutes est mis à jour
      queryClient.invalidateQueries({ queryKey: ['hr', 'attendance'] });
    },
  });
};

/**
 * Hook pour supprimer/annuler une période HS
 */
export const useDeleteOvertimePeriod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => scheduleManagementApi.deleteOvertimePeriod(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'overtime-periods'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'overtime'] });
    },
  });
};

/**
 * Hook pour modifier une période HS
 */
export const useUpdateOvertimePeriod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { period_date: string; start_time: string; end_time: string; department_id?: string; reason?: string; rate_type?: 'normal' | 'extended' | 'special'; employee_ids: string[] } }) =>
      scheduleManagementApi.updateOvertimePeriod(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'overtime-periods'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'overtime'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['hr', 'attendance'] });
    },
  });
};

/**
 * Hook pour recalculer une période HS
 */
export const useRecalculateOvertimePeriod = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => scheduleManagementApi.recalculateOvertimePeriod(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'overtime-periods'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'overtime'] });
    },
  });
};

/**
 * Hook pour récupérer les employés d'une période HS
 */
export const useOvertimePeriodEmployees = (periodId: string | null) => {
  return useQuery({
    queryKey: ['schedule-management', 'overtime-periods', periodId, 'employees'],
    queryFn: () => scheduleManagementApi.getOvertimePeriodEmployees(periodId!),
    enabled: !!periodId,
  });
};

// ============================================================
// OVERTIME CONFIG HOOKS
// ============================================================

/**
 * Hook pour récupérer la configuration HS
 */
export const useOvertimeConfig = () => {
  return useQuery({
    queryKey: ['schedule-management', 'overtime-config'],
    queryFn: () => scheduleManagementApi.getOvertimeConfig(),
  });
};

/**
 * Hook pour mettre à jour la configuration HS
 */
export const useUpdateOvertimeConfig = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Partial<{
      daily_threshold_hours: number;
      weekly_threshold_hours: number;
      monthly_max_hours: number;
      rate_25_multiplier: number;
      rate_50_multiplier: number;
      rate_100_multiplier: number;
      rate_25_threshold_hours: number;
      rate_50_threshold_hours: number;
      night_start: string;
      night_end: string;
      apply_100_for_night: boolean;
      apply_100_for_weekend: boolean;
      apply_100_for_holiday: boolean;
      requires_prior_approval: boolean;
    }>) => scheduleManagementApi.updateOvertimeConfig(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'overtime-config'] });
    },
  });
};

// ============================================================
// EMPLOYEE SCHEDULE ASSIGNMENTS HOOKS
// ============================================================

/**
 * Hook pour récupérer les attributions d'horaires des employés
 */
export const useEmployeeSchedules = () => {
  return useQuery({
    queryKey: ['schedule-management', 'employee-schedules'],
    queryFn: () => scheduleManagementApi.getEmployeeSchedules(),
  });
};

/**
 * Hook pour récupérer les employés sans horaire assigné
 */
export const useEmployeesWithoutSchedule = () => {
  return useQuery({
    queryKey: ['schedule-management', 'employees-without-schedule'],
    queryFn: () => scheduleManagementApi.getEmployeesWithoutSchedule(),
  });
};

/**
 * Hook pour créer une attribution d'horaire
 */
export const useCreateEmployeeSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateEmployeeScheduleInput) => scheduleManagementApi.createEmployeeSchedule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'employee-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'employees-without-schedule'] });
    },
  });
};

/**
 * Hook pour mettre à jour une attribution d'horaire
 */
export const useUpdateEmployeeSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateEmployeeScheduleInput> }) =>
      scheduleManagementApi.updateEmployeeSchedule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'employee-schedules'] });
    },
  });
};

/**
 * Hook pour supprimer une attribution d'horaire
 */
export const useDeleteEmployeeSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => scheduleManagementApi.deleteEmployeeSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'employee-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'employees-without-schedule'] });
    },
  });
};

/**
 * Hook pour assigner un horaire à plusieurs employés
 */
export const useBulkAssignSchedule = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { employee_ids: string[]; schedule_id: string; start_date: string; end_date?: string }) =>
      scheduleManagementApi.bulkAssignSchedule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'employee-schedules'] });
      queryClient.invalidateQueries({ queryKey: ['schedule-management', 'employees-without-schedule'] });
    },
  });
};

// ============================================================
// STATS HOOK
// ============================================================

/**
 * Hook pour récupérer les statistiques
 */
export const useScheduleStats = () => {
  return useQuery({
    queryKey: ['schedule-management', 'stats'],
    queryFn: () => scheduleManagementApi.getStats(),
  });
};
