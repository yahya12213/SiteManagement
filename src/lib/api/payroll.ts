/**
 * API Client - Gestion de Paie (Payroll Management)
 * Routes backend: /api/hr/payroll/*
 */

import { apiClient } from './client';

// ============================================================
// TYPES - Payroll Periods
// ============================================================

export interface PayrollPeriod {
  id: string;
  year: number;
  month: number;
  start_date: string;
  end_date: string;
  pay_date: string;
  status: 'draft' | 'open' | 'calculating' | 'calculated' | 'validated' | 'closed';
  total_employees?: number;
  total_gross?: number;
  total_net?: number;
  created_at: string;
  created_by_name?: string;
  closed_at?: string;
  closed_by_name?: string;
}

export interface CreatePeriodInput {
  year: number;
  month: number;
  start_date: string;
  end_date: string;
  pay_date: string;
}

// ============================================================
// TYPES - Payslips
// ============================================================

export interface PayslipLine {
  id: string;
  line_type: 'earning' | 'deduction';
  code: string;
  label: string;
  quantity?: number;
  rate?: number;
  base_amount?: number;
  amount: number;
  is_taxable: boolean;
  is_social: boolean;
  sort_order: number;
}

export interface Payslip {
  id: string;
  period_id: string;
  employee_id: string;
  employee_name: string;
  employee_number?: string;
  department?: string;
  position?: string;

  // Salaires
  base_salary: number;
  gross_salary: number;
  taxable_salary: number;
  net_salary: number;

  // Retenues
  cnss_employee: number;
  cnss_employer: number;
  amo_employee: number;
  amo_employer: number;
  igr: number;  // Alias pour igr_amount
  igr_amount: number;  // Nom de la colonne dans la BDD

  // Heures
  worked_hours: number;
  overtime_hours_25: number;
  overtime_hours_50: number;
  overtime_hours_100: number;
  overtime_amount: number;

  // Autres
  seniority_bonus: number;
  other_bonuses: number;
  other_deductions: number;

  status: 'draft' | 'calculated' | 'validated' | 'paid';
  validated_at?: string;
  validated_by_name?: string;

  // Lignes de détail
  lines?: PayslipLine[];
}

export interface PayslipSummary {
  id: string;
  employee_name: string;
  employee_number?: string;
  department?: string;
  gross_salary: number;
  net_salary: number;
  cnss_employee: number;
  amo_employee: number;
  igr_amount: number;  // Nom correct de la colonne dans la BDD
  other_deductions?: number;
  status: string;
}

// ============================================================
// TYPES - Configuration
// ============================================================

export interface PayrollConfigItem {
  key: string;
  value: string;
  value_type: 'number' | 'string' | 'boolean' | 'json';
  description: string;
  category: string;
}

export interface PayrollConfig {
  cnss: {
    employee_rate: number;
    employer_rate: number;
    ceiling: number;
  };
  amo: {
    employee_rate: number;
    employer_rate: number;
  };
  igr: {
    brackets: Array<{
      min: number;
      max: number;
      rate: number;
      deduction: number;
    }>;
  };
  overtime: {
    rate_25: number;
    rate_50: number;
    rate_100: number;
  };
  seniority: {
    brackets: Array<{
      min_years: number;
      max_years: number;
      rate: number;
    }>;
  };
}

// ============================================================
// TYPES - Audit Logs
// ============================================================

export interface PayrollAuditLog {
  id: string;
  period_id?: string;
  payslip_id?: string;
  action: string;
  details: Record<string, unknown>;
  ip_address?: string;
  created_at: string;
  created_by_name: string;
}

// ============================================================
// TYPES - Payroll Employees
// ============================================================

export interface PayrollEmployee {
  id: string;
  employee_number?: string;
  first_name: string;
  last_name: string;
  department?: string;
  position?: string;
  segment_id?: string;
  segment_name?: string;
  segment_color?: string;
  hourly_rate?: number;
  base_salary?: number;
  working_hours_per_week?: number;
  payroll_cutoff_day?: number;
  is_cnss_subject?: boolean;
  is_amo_subject?: boolean;
}

export interface SegmentWithCount {
  id: string;
  name: string;
  color: string;
  employee_count: number;
}

export interface CalculatePayrollOptions {
  employee_ids?: string[];
  segment_id?: string;
}

// ============================================================
// TYPES - Calculation Result
// ============================================================

export interface CalculationResult {
  success: boolean;
  period_id: string;
  employees_selected?: number | 'all';
  employees_processed?: number;
  payslips_created?: number;
  total_gross: number;
  total_net: number;
  total_cnss?: number;
  total_cnss_employee?: number;
  total_cnss_employer?: number;
  total_amo: number;
  total_igr: number;
  errors?: string[];
}

// ============================================================
// TYPES - Export
// ============================================================

export interface CNSSExport {
  period: string;
  declaration_number?: string;
  total_employees: number;
  total_salaries: number;
  total_cnss_employee: number;
  total_cnss_employer: number;
  employees: Array<{
    cnss_number: string;
    full_name: string;
    gross_salary: number;
    worked_days: number;
    cnss_amount: number;
  }>;
}

export interface BankTransferExport {
  period: string;
  total_amount: number;
  transfer_date: string;
  transfers: Array<{
    employee_name: string;
    bank_name?: string;
    rib?: string;
    amount: number;
  }>;
}

// ============================================================
// API FUNCTIONS
// ============================================================

export const payrollApi = {
  // === PERIODS ===

  getPeriods: async (filters?: { year?: number; status?: string }): Promise<{ success: boolean; periods: PayrollPeriod[] }> => {
    const params = new URLSearchParams();
    if (filters?.year) params.append('year', filters.year.toString());
    if (filters?.status) params.append('status', filters.status);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<{ success: boolean; periods: PayrollPeriod[] }>(`/hr/payroll/periods${queryString}`);
  },

  getPeriod: async (id: string): Promise<{ success: boolean; period: PayrollPeriod }> => {
    return apiClient.get<{ success: boolean; period: PayrollPeriod }>(`/hr/payroll/periods/${id}`);
  },

  createPeriod: async (data: CreatePeriodInput): Promise<{ success: boolean; period: PayrollPeriod }> => {
    return apiClient.post<{ success: boolean; period: PayrollPeriod }>('/hr/payroll/periods', data);
  },

  updatePeriod: async (id: string, data: Partial<CreatePeriodInput>): Promise<{ success: boolean; period: PayrollPeriod }> => {
    return apiClient.put<{ success: boolean; period: PayrollPeriod }>(`/hr/payroll/periods/${id}`, data);
  },

  deletePeriod: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete<{ success: boolean; message: string }>(`/hr/payroll/periods/${id}`);
  },

  openPeriod: async (id: string): Promise<{ success: boolean; period: PayrollPeriod }> => {
    return apiClient.post<{ success: boolean; period: PayrollPeriod }>(`/hr/payroll/periods/${id}/open`, {});
  },

  closePeriod: async (id: string): Promise<{ success: boolean; period: PayrollPeriod }> => {
    return apiClient.post<{ success: boolean; period: PayrollPeriod }>(`/hr/payroll/periods/${id}/close`, {});
  },

  // === EMPLOYEES ===

  getPayrollEmployees: async (filters?: { search?: string; segment_id?: string }): Promise<{ success: boolean; employees: PayrollEmployee[] }> => {
    const params = new URLSearchParams();
    if (filters?.search) params.append('search', filters.search);
    if (filters?.segment_id) params.append('segment_id', filters.segment_id);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<{ success: boolean; employees: PayrollEmployee[] }>(`/hr/payroll/employees${queryString}`);
  },

  getEmployeeCountsBySegment: async (): Promise<{ success: boolean; data: SegmentWithCount[] }> => {
    return apiClient.get<{ success: boolean; data: SegmentWithCount[] }>('/hr/payroll/employees/counts-by-segment');
  },

  // === CALCULATION ===

  calculatePayroll: async (periodId: string, options?: CalculatePayrollOptions): Promise<CalculationResult> => {
    return apiClient.post<CalculationResult>(`/hr/payroll/calculate/${periodId}`, options || {});
  },

  resetPayrollCalculations: async (periodId: string): Promise<{ success: boolean; message: string; deleted_payslips: number }> => {
    return apiClient.post<{ success: boolean; message: string; deleted_payslips: number }>(`/hr/payroll/calculate/${periodId}/reset`, {});
  },

  // === PAYSLIPS ===

  getPayslips: async (filters?: { period_id?: string; employee_id?: string; status?: string }): Promise<{ success: boolean; payslips: PayslipSummary[] }> => {
    const params = new URLSearchParams();
    if (filters?.period_id) params.append('period_id', filters.period_id);
    if (filters?.employee_id) params.append('employee_id', filters.employee_id);
    if (filters?.status) params.append('status', filters.status);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<{ success: boolean; payslips: PayslipSummary[] }>(`/hr/payroll/payslips${queryString}`);
  },

  getPayslip: async (id: string): Promise<{ success: boolean; payslip: Payslip }> => {
    return apiClient.get<{ success: boolean; payslip: Payslip }>(`/hr/payroll/payslips/${id}`);
  },

  validatePayslip: async (id: string): Promise<{ success: boolean; payslip: Payslip }> => {
    return apiClient.post<{ success: boolean; payslip: Payslip }>(`/hr/payroll/payslips/${id}/validate`, {});
  },

  validateAllPayslips: async (periodId: string): Promise<{ success: boolean; validated_count: number }> => {
    return apiClient.post<{ success: boolean; validated_count: number }>(`/hr/payroll/periods/${periodId}/validate-all`, {});
  },

  getPayslipPdf: async (id: string): Promise<Blob> => {
    // Utiliser tokenManager pour récupérer le token correctement (clé 'auth_token')
    const { tokenManager } = await import('./client');
    const token = tokenManager.getToken();

    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`/api/hr/payroll/payslips/${id}/pdf`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download PDF: ${response.status}`);
    }

    return response.blob();
  },

  // === CONFIGURATION ===

  getConfig: async (): Promise<{ success: boolean; config: PayrollConfig }> => {
    return apiClient.get<{ success: boolean; config: PayrollConfig }>('/hr/payroll/config');
  },

  updateConfig: async (category: string, data: Record<string, unknown>): Promise<{ success: boolean; message: string }> => {
    return apiClient.put<{ success: boolean; message: string }>(`/hr/payroll/config/${category}`, data);
  },

  // === AUDIT LOGS ===

  getLogs: async (filters?: { period_id?: string; action?: string; limit?: number }): Promise<{ success: boolean; logs: PayrollAuditLog[] }> => {
    const params = new URLSearchParams();
    if (filters?.period_id) params.append('period_id', filters.period_id);
    if (filters?.action) params.append('action', filters.action);
    if (filters?.limit) params.append('limit', filters.limit.toString());
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<{ success: boolean; logs: PayrollAuditLog[] }>(`/hr/payroll/logs${queryString}`);
  },

  // === EXPORTS ===

  exportCNSS: async (periodId: string): Promise<{ success: boolean; data: CNSSExport }> => {
    return apiClient.get<{ success: boolean; data: CNSSExport }>(`/hr/payroll/export/cnss/${periodId}`);
  },

  exportBankTransfers: async (periodId: string): Promise<{ success: boolean; data: BankTransferExport }> => {
    return apiClient.get<{ success: boolean; data: BankTransferExport }>(`/hr/payroll/export/bank/${periodId}`);
  },

  downloadPayslipsZip: async (periodId: string): Promise<Blob> => {
    // Utiliser tokenManager pour récupérer le token correctement (clé 'auth_token')
    const { tokenManager } = await import('./client');
    const token = tokenManager.getToken();

    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`/api/hr/payroll/export/payslips/${periodId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download payslips: ${response.status}`);
    }

    return response.blob();
  },

  // === STATS ===

  getStats: async (year?: number): Promise<{
    success: boolean;
    stats: {
      total_periods: number;
      open_periods: number;
      total_employees_paid: number;
      total_mass_salary: number;
      avg_salary: number;
    }
  }> => {
    const params = year ? `?year=${year}` : '';
    return apiClient.get(`/hr/payroll/stats${params}`);
  },
};
