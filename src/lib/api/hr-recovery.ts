/**
 * API Client - Gestion des Récupérations d'Heures
 * Routes backend: /hr/recovery/*
 */

import { apiClient } from './client';

// ============================================================
// TYPES - Recovery Periods
// ============================================================

export interface RecoveryPeriod {
  id: string;
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  total_hours_to_recover: number;
  hours_recovered: number;
  hours_remaining: number;
  department_id?: string;
  segment_id?: string;
  centre_id?: string;
  applies_to_all: boolean;
  status: 'active' | 'completed' | 'cancelled';
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateRecoveryPeriodInput {
  name: string;
  description?: string;
  start_date: string;
  end_date: string;
  total_hours_to_recover: number;
  department_id?: string;
  segment_id?: string;
  centre_id?: string;
  applies_to_all?: boolean;
}

export interface UpdateRecoveryPeriodInput {
  name?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  total_hours_to_recover?: number;
  department_id?: string;
  segment_id?: string;
  centre_id?: string;
  applies_to_all?: boolean;
  status?: 'active' | 'completed' | 'cancelled';
}

export interface RecoveryPeriodSummary {
  period: RecoveryPeriod;
  declarations: {
    total_declarations: number;
    days_off_count: number;
    recovery_days_count: number;
    scheduled_recovery_hours: number;
    completed_declarations: number;
  };
  participation: {
    total_employees_affected: number;
    employees_present: number;
    employees_absent: number;
    actual_hours_recovered: number;
    total_deductions: number;
  };
}

// ============================================================
// TYPES - Recovery Declarations
// ============================================================

export interface RecoveryDeclaration {
  id: string;
  recovery_period_id: string;
  recovery_date: string;
  hours_to_recover: number;
  is_day_off: boolean;
  department_id?: string;
  segment_id?: string;
  centre_id?: string;
  notes?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  created_by?: string;
  created_at: string;
  updated_at: string;
  period_name?: string;
}

export interface CreateRecoveryDeclarationInput {
  recovery_period_id: string;
  recovery_date: string;
  hours_to_recover: number;
  is_day_off: boolean;
  department_id?: string;
  segment_id?: string;
  centre_id?: string;
  notes?: string;
}

export interface UpdateRecoveryDeclarationInput {
  recovery_date?: string;
  hours_to_recover?: number;
  notes?: string;
  status?: 'scheduled' | 'completed' | 'cancelled';
}

export interface VerificationResult {
  success: boolean;
  message: string;
  summary: {
    total_employees: number;
    present: number;
    absent: number;
    total_deductions: string;
  };
}

// ============================================================
// TYPES - Employee Recoveries
// ============================================================

export interface EmployeeRecovery {
  id: string;
  employee_id: string;
  recovery_declaration_id: string;
  recovery_date: string;
  is_day_off: boolean;
  expected_to_work: boolean;
  was_present?: boolean;
  attendance_record_id?: string;
  hours_recovered: number;
  deduction_applied: boolean;
  deduction_amount: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Additional fields from JOINs
  declared_hours?: number;
  period_name?: string;
  period_start?: string;
  period_end?: string;
  employee_number?: string;
  first_name?: string;
  last_name?: string;
  department?: string;
  salary_gross?: number;
}

// ============================================================
// API FUNCTIONS - Recovery Periods
// ============================================================

export async function getRecoveryPeriods(params?: {
  status?: 'active' | 'completed' | 'cancelled';
  department_id?: string;
  segment_id?: string;
}): Promise<{ success: boolean; periods: RecoveryPeriod[] }> {
  const queryParams = new URLSearchParams();
  if (params?.status) queryParams.append('status', params.status);
  if (params?.department_id) queryParams.append('department_id', params.department_id);
  if (params?.segment_id) queryParams.append('segment_id', params.segment_id);

  const url = `/hr/recovery/periods${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return await apiClient.get<{ success: boolean; periods: RecoveryPeriod[] }>(url);
}

export async function getRecoveryPeriod(id: string): Promise<{ success: boolean; period: RecoveryPeriod }> {
  return await apiClient.get<{ success: boolean; period: RecoveryPeriod }>(`/hr/recovery/periods/${id}`);
}

export async function createRecoveryPeriod(
  input: CreateRecoveryPeriodInput
): Promise<{ success: boolean; period: RecoveryPeriod }> {
  return await apiClient.post<{ success: boolean; period: RecoveryPeriod }>('/hr/recovery/periods', input);
}

export async function updateRecoveryPeriod(
  id: string,
  input: UpdateRecoveryPeriodInput
): Promise<{ success: boolean; period: RecoveryPeriod }> {
  return await apiClient.put<{ success: boolean; period: RecoveryPeriod }>(`/hr/recovery/periods/${id}`, input);
}

export async function deleteRecoveryPeriod(id: string): Promise<{ success: boolean; message: string }> {
  return await apiClient.delete<{ success: boolean; message: string }>(`/hr/recovery/periods/${id}`);
}

export async function getRecoveryPeriodSummary(
  id: string
): Promise<{ success: boolean; summary: RecoveryPeriodSummary }> {
  return await apiClient.get<{ success: boolean; summary: RecoveryPeriodSummary }>(`/hr/recovery/periods/${id}/summary`);
}

// ============================================================
// API FUNCTIONS - Recovery Declarations
// ============================================================

export async function getRecoveryDeclarations(params?: {
  period_id?: string;
  status?: 'scheduled' | 'completed' | 'cancelled';
  is_day_off?: boolean;
  start_date?: string;
  end_date?: string;
}): Promise<{ success: boolean; declarations: RecoveryDeclaration[] }> {
  const queryParams = new URLSearchParams();
  if (params?.period_id) queryParams.append('period_id', params.period_id);
  if (params?.status) queryParams.append('status', params.status);
  if (params?.is_day_off !== undefined) queryParams.append('is_day_off', String(params.is_day_off));
  if (params?.start_date) queryParams.append('start_date', params.start_date);
  if (params?.end_date) queryParams.append('end_date', params.end_date);

  const url = `/hr/recovery/declarations${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  return await apiClient.get<{ success: boolean; declarations: RecoveryDeclaration[] }>(url);
}

export async function getRecoveryDeclaration(
  id: string
): Promise<{ success: boolean; declaration: RecoveryDeclaration }> {
  return await apiClient.get<{ success: boolean; declaration: RecoveryDeclaration }>(`/hr/recovery/declarations/${id}`);
}

export async function createRecoveryDeclaration(
  input: CreateRecoveryDeclarationInput
): Promise<{ success: boolean; declaration: RecoveryDeclaration; employees_affected: number }> {
  return await apiClient.post<{ success: boolean; declaration: RecoveryDeclaration; employees_affected: number }>('/hr/recovery/declarations', input);
}

export async function updateRecoveryDeclaration(
  id: string,
  input: UpdateRecoveryDeclarationInput
): Promise<{ success: boolean; declaration: RecoveryDeclaration }> {
  return await apiClient.put<{ success: boolean; declaration: RecoveryDeclaration }>(`/hr/recovery/declarations/${id}`, input);
}

export async function deleteRecoveryDeclaration(id: string): Promise<{ success: boolean; message: string }> {
  return await apiClient.delete<{ success: boolean; message: string }>(`/hr/recovery/declarations/${id}`);
}

export async function verifyRecoveryDeclaration(id: string): Promise<VerificationResult> {
  return await apiClient.post<VerificationResult>(`/hr/recovery/declarations/${id}/verify`);
}

// ============================================================
// API FUNCTIONS - Employee Recoveries
// ============================================================

export async function getEmployeeRecoveries(
  employeeId: string
): Promise<{ success: boolean; recoveries: EmployeeRecovery[] }> {
  return await apiClient.get<{ success: boolean; recoveries: EmployeeRecovery[] }>(`/hr/recovery/employees/${employeeId}`);
}

export async function getDeclarationEmployees(
  declarationId: string
): Promise<{ success: boolean; employees: EmployeeRecovery[] }> {
  return await apiClient.get<{ success: boolean; employees: EmployeeRecovery[] }>(`/hr/recovery/declarations/${declarationId}/employees`);
}
