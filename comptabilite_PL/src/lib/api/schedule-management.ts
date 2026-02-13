/**
 * API Client - Gestion des Horaires (Schedule Management)
 */

import { apiClient } from './client';

// ============================================================
// TYPES - Work Schedules
// ============================================================

export interface HoraireJour {
  actif: boolean;
  heureDebut: string;
  heureFin: string;
  pauses: { nom: string; debut: string; fin: string; remuneree: boolean }[];
}

export interface WorkSchedule {
  id: string;
  nom: string;
  description: string;
  actif: boolean;
  horaires: {
    Lundi: HoraireJour;
    Mardi: HoraireJour;
    Mercredi: HoraireJour;
    Jeudi: HoraireJour;
    Vendredi: HoraireJour;
    Samedi: HoraireJour;
    Dimanche: HoraireJour;
  };
  heures_hebdo: number;
  is_default?: boolean;
  tolerance_late?: number;
  tolerance_early?: number;
}

export interface CreateScheduleInput {
  nom: string;
  description?: string;
  horaires: WorkSchedule['horaires'];
  heures_hebdo?: number;
  is_default?: boolean;
  tolerance_late?: number;
  tolerance_early?: number;
  actif?: boolean;
}

// ============================================================
// TYPES - Public Holidays
// ============================================================

export interface PublicHoliday {
  id: string;
  nom: string;
  date_debut: string;
  date_fin: string;
  type: 'ferie' | 'collectif' | 'pont';
  recurrent: boolean;
  description?: string;
}

export interface CreateHolidayInput {
  nom: string;
  date_debut: string;
  date_fin?: string;
  type?: 'ferie' | 'collectif' | 'pont';
  recurrent?: boolean;
  description?: string;
}

// ============================================================
// TYPES - Approved Leaves
// ============================================================

export interface ApprovedLeave {
  id: number;
  employe_nom: string;
  type_conge: string;
  type_code: string;
  date_debut: string;
  date_fin: string;
  jours: number;
  statut: 'approved';
  description?: string;
}

// ============================================================
// TYPES - Overtime Declarations
// ============================================================

export interface OvertimeDeclaration {
  id: number;
  employe_nom: string;
  employee_number: string;
  request_date: string;
  start_time?: string;
  end_time?: string;
  heures_demandees: number;
  heures_approuvees?: number;
  motif: string;
  statut: 'pending' | 'approved' | 'rejected';
  is_prior_approved: boolean;
  periode: string;
  n1_comment?: string;
  n2_comment?: string;
}

export interface CreateOvertimeInput {
  employee_id: string;
  request_date: string;
  start_time?: string;
  end_time?: string;
  hours_requested: number;
  reason?: string;
  is_prior_approved?: boolean;
}

// ============================================================
// TYPES - Overtime Periods (Manager declarations)
// ============================================================

export interface OvertimePeriod {
  id: string;
  declared_by: string;
  declared_by_name?: string;
  declared_by_email?: string;
  period_date: string;
  start_time: string;
  end_time: string;
  department_id?: string;
  reason?: string;
  rate_type: 'normal' | 'extended' | 'special';
  status: 'active' | 'cancelled';
  employee_count?: number;
  total_minutes?: number;
  created_at: string;
  updated_at: string;
}

export interface CreateOvertimePeriodInput {
  period_date: string;
  start_time: string;
  end_time: string;
  department_id?: string;
  reason?: string;
  rate_type?: 'normal' | 'extended' | 'special';
  employee_ids: string[]; // Required: IDs of employees to include in this overtime period
}

export interface EmployeeForOvertime {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
  department: string;
  position: string;
}

export interface OvertimePeriodEmployee {
  selection_id: string;
  employee_id: string;
  employee_name: string;
  employee_number: string;
  department: string;
  actual_minutes: number | null;
  rate_type: string | null;
  validated_for_payroll: boolean | null;
  selected_at: string;
  has_overtime_record: boolean;
}

// ============================================================
// TYPES - Overtime Config
// ============================================================

export interface OvertimeConfig {
  id?: string;
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
}

// ============================================================
// TYPES - Employee Schedule Assignments
// ============================================================

export interface EmployeeScheduleAssignment {
  id: string;
  employee_id: string;
  schedule_id: string;
  start_date: string;
  end_date: string | null;
  is_primary: boolean;
  created_at: string;
  employee_name: string;
  employee_number: string;
  department: string;
  position: string;
  schedule_name: string;
  schedule_description: string;
  weekly_hours: number;
}

export interface CreateEmployeeScheduleInput {
  employee_id: string;
  schedule_id: string;
  start_date: string;
  end_date?: string | null;
  is_primary?: boolean;
}

export interface EmployeeWithoutSchedule {
  id: string;
  first_name: string;
  last_name: string;
  employee_number: string;
  department: string;
  position: string;
}

// ============================================================
// TYPES - Stats
// ============================================================

export interface ScheduleStats {
  active_schedules: number;
  holidays_this_year: number;
  approved_leaves: number;
  pending_overtime: number;
}

// ============================================================
// API FUNCTIONS
// ============================================================

export const scheduleManagementApi = {
  // === WORK SCHEDULES ===
  getSchedules: async (): Promise<{ success: boolean; schedules: WorkSchedule[] }> => {
    return apiClient.get<{ success: boolean; schedules: WorkSchedule[] }>('/hr/schedule-management/schedules');
  },

  createSchedule: async (data: CreateScheduleInput): Promise<{ success: boolean; schedule: WorkSchedule }> => {
    return apiClient.post<{ success: boolean; schedule: WorkSchedule }>('/hr/schedule-management/schedules', data);
  },

  updateSchedule: async (id: string, data: Partial<CreateScheduleInput>): Promise<{ success: boolean; schedule: WorkSchedule }> => {
    return apiClient.put<{ success: boolean; schedule: WorkSchedule }>(`/hr/schedule-management/schedules/${id}`, data);
  },

  deleteSchedule: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete<{ success: boolean; message: string }>(`/hr/schedule-management/schedules/${id}`);
  },

  // === PUBLIC HOLIDAYS ===
  getHolidays: async (year?: number): Promise<{ success: boolean; holidays: PublicHoliday[] }> => {
    const params = year ? `?year=${year}` : '';
    return apiClient.get<{ success: boolean; holidays: PublicHoliday[] }>(`/hr/schedule-management/holidays${params}`);
  },

  createHoliday: async (data: CreateHolidayInput): Promise<{ success: boolean; holiday: PublicHoliday }> => {
    return apiClient.post<{ success: boolean; holiday: PublicHoliday }>('/hr/schedule-management/holidays', data);
  },

  updateHoliday: async (id: string, data: Partial<CreateHolidayInput>): Promise<{ success: boolean; holiday: PublicHoliday }> => {
    return apiClient.put<{ success: boolean; holiday: PublicHoliday }>(`/hr/schedule-management/holidays/${id}`, data);
  },

  deleteHoliday: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete<{ success: boolean; message: string }>(`/hr/schedule-management/holidays/${id}`);
  },

  // === APPROVED LEAVES ===
  getApprovedLeaves: async (year?: number, month?: number): Promise<{ success: boolean; leaves: ApprovedLeave[] }> => {
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    if (month) params.append('month', month.toString());
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<{ success: boolean; leaves: ApprovedLeave[] }>(`/hr/schedule-management/approved-leaves${queryString}`);
  },

  // === OVERTIME ===
  // Note: Ces endpoints utilisent hr-overtime.js (/hr/overtime/requests)
  getOvertime: async (filters?: { status?: string; year?: number; month?: number }): Promise<{ success: boolean; overtime: OvertimeDeclaration[] }> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.year) params.append('year', filters.year.toString());
    if (filters?.month) params.append('month', filters.month.toString());
    const queryString = params.toString() ? `?${params.toString()}` : '';
    // Utiliser l'endpoint existant hr-overtime.js - retourne {success, data} au lieu de {success, overtime}
    const response = await apiClient.get<{ success: boolean; data: OvertimeDeclaration[] }>(`/hr/overtime/requests${queryString}`);
    return { success: response.success, overtime: response.data || [] };
  },

  createOvertime: async (data: CreateOvertimeInput): Promise<{ success: boolean; overtime: OvertimeDeclaration }> => {
    const response = await apiClient.post<{ success: boolean; data: OvertimeDeclaration }>('/hr/overtime/requests', data);
    return { success: response.success, overtime: response.data };
  },

  approveOvertime: async (id: number, data: { hours_approved?: number; comment?: string; level?: string }): Promise<{ success: boolean; overtime: OvertimeDeclaration }> => {
    const response = await apiClient.put<{ success: boolean; data: OvertimeDeclaration }>(`/hr/overtime/requests/${id}/approve`, data);
    return { success: response.success, overtime: response.data };
  },

  rejectOvertime: async (id: number, comment?: string, level?: string): Promise<{ success: boolean; overtime: OvertimeDeclaration }> => {
    const response = await apiClient.put<{ success: boolean; data: OvertimeDeclaration }>(`/hr/overtime/requests/${id}/reject`, { comment, level });
    return { success: response.success, overtime: response.data };
  },

  deleteOvertime: async (id: number): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete<{ success: boolean; message: string }>(`/hr/overtime/requests/${id}`);
  },

  // === EMPLOYEES FOR OVERTIME SELECTION ===
  getEmployeesForOvertime: async (departmentId?: string, date?: string): Promise<{ success: boolean; employees: EmployeeForOvertime[] }> => {
    const params = new URLSearchParams();
    if (departmentId) params.append('department_id', departmentId);
    if (date) params.append('date', date);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<{ success: boolean; employees: EmployeeForOvertime[] }>(`/hr/schedule-management/employees-for-overtime${queryString}`);
  },

  // === OVERTIME PERIODS (Manager declarations) ===
  getOvertimePeriods: async (filters?: { year?: number; month?: number; status?: string }): Promise<{ success: boolean; periods: OvertimePeriod[] }> => {
    const params = new URLSearchParams();
    if (filters?.year) params.append('year', filters.year.toString());
    if (filters?.month) params.append('month', filters.month.toString());
    if (filters?.status) params.append('status', filters.status);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<{ success: boolean; periods: OvertimePeriod[] }>(`/hr/schedule-management/overtime-periods${queryString}`);
  },

  createOvertimePeriod: async (data: CreateOvertimePeriodInput): Promise<{ success: boolean; period: OvertimePeriod; message: string; warnings?: { employee_id: string; employee_name: string; reason: string }[] }> => {
    return apiClient.post<{ success: boolean; period: OvertimePeriod; message: string; warnings?: { employee_id: string; employee_name: string; reason: string }[] }>('/hr/schedule-management/overtime-periods', data);
  },

  updateOvertimePeriod: async (id: string, data: CreateOvertimePeriodInput): Promise<{ success: boolean; period: OvertimePeriod; message: string; warnings?: { employee_id: string; employee_name: string; reason: string }[] }> => {
    return apiClient.put<{ success: boolean; period: OvertimePeriod; message: string; warnings?: { employee_id: string; employee_name: string; reason: string }[] }>(`/hr/schedule-management/overtime-periods/${id}`, data);
  },

  getOvertimePeriodById: async (id: string): Promise<{ success: boolean; period: OvertimePeriod; selected_employees: { employee_id: string; employee_name: string; employee_number: string }[] }> => {
    return apiClient.get<{ success: boolean; period: OvertimePeriod; selected_employees: { employee_id: string; employee_name: string; employee_number: string }[] }>(`/hr/schedule-management/overtime-periods/${id}`);
  },

  deleteOvertimePeriod: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete<{ success: boolean; message: string }>(`/hr/schedule-management/overtime-periods/${id}`);
  },

  recalculateOvertimePeriod: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.post<{ success: boolean; message: string }>(`/hr/schedule-management/overtime-periods/${id}/recalculate`, {});
  },

  getOvertimePeriodEmployees: async (id: string): Promise<{ success: boolean; employees: OvertimePeriodEmployee[] }> => {
    return apiClient.get<{ success: boolean; employees: OvertimePeriodEmployee[] }>(`/hr/schedule-management/overtime-periods/${id}/employees`);
  },

  // === OVERTIME CONFIG ===
  getOvertimeConfig: async (): Promise<{ success: boolean; config: OvertimeConfig }> => {
    return apiClient.get<{ success: boolean; config: OvertimeConfig }>('/hr/schedule-management/overtime-config');
  },

  updateOvertimeConfig: async (data: Partial<OvertimeConfig>): Promise<{ success: boolean; config: OvertimeConfig }> => {
    return apiClient.put<{ success: boolean; config: OvertimeConfig }>('/hr/schedule-management/overtime-config', data);
  },

  // === EMPLOYEE SCHEDULE ASSIGNMENTS ===
  getEmployeeSchedules: async (): Promise<{ success: boolean; assignments: EmployeeScheduleAssignment[] }> => {
    return apiClient.get<{ success: boolean; assignments: EmployeeScheduleAssignment[] }>('/hr/schedule-management/employee-schedules');
  },

  getEmployeesWithoutSchedule: async (): Promise<{ success: boolean; employees: EmployeeWithoutSchedule[] }> => {
    return apiClient.get<{ success: boolean; employees: EmployeeWithoutSchedule[] }>('/hr/schedule-management/employees-without-schedule');
  },

  createEmployeeSchedule: async (data: CreateEmployeeScheduleInput): Promise<{ success: boolean; assignment: EmployeeScheduleAssignment }> => {
    return apiClient.post<{ success: boolean; assignment: EmployeeScheduleAssignment }>('/hr/schedule-management/employee-schedules', data);
  },

  updateEmployeeSchedule: async (id: string, data: Partial<CreateEmployeeScheduleInput>): Promise<{ success: boolean; assignment: EmployeeScheduleAssignment }> => {
    return apiClient.put<{ success: boolean; assignment: EmployeeScheduleAssignment }>(`/hr/schedule-management/employee-schedules/${id}`, data);
  },

  deleteEmployeeSchedule: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete<{ success: boolean; message: string }>(`/hr/schedule-management/employee-schedules/${id}`);
  },

  bulkAssignSchedule: async (data: { employee_ids: string[]; schedule_id: string; start_date: string; end_date?: string }): Promise<{ success: boolean; message: string; created: number; skipped: number }> => {
    return apiClient.post<{ success: boolean; message: string; created: number; skipped: number }>('/hr/schedule-management/employee-schedules/bulk', data);
  },

  // === STATS ===
  getStats: async (): Promise<{ success: boolean; stats: ScheduleStats }> => {
    return apiClient.get<{ success: boolean; stats: ScheduleStats }>('/hr/schedule-management/stats');
  },
};
