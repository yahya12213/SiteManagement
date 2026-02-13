/**
 * API Client - Employé Self-Service (Mon Espace RH)
 * Routes backend: /api/hr/my/*
 */

import { apiClient } from './client';

// ============================================================
// TYPES - Requests
// ============================================================

export interface MyRequest {
  id: string;
  request_type: 'leave' | 'overtime' | 'correction' | 'administrative';
  request_subtype?: string;
  start_date?: string;
  end_date?: string;
  duration_days?: number;
  duration_hours?: number;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  current_step?: number;
  total_steps?: number;
  current_approver_name?: string;
  workflow_steps?: Array<{
    step_number: number;
    approver_name: string;
    status: 'pending' | 'approved' | 'rejected';
    comment?: string;
    decided_at?: string;
  }>;
  created_at: string;
  updated_at?: string;
  attachments?: Array<{ id: string; filename: string; url: string }>;
}

export interface CreateRequestInput {
  request_type: 'leave' | 'overtime' | 'correction' | 'administrative';
  request_subtype?: string;
  start_date?: string;
  end_date?: string;
  duration_hours?: number;
  reason: string;
  contact_during_absence?: string;
  interim_person?: string;
}

export interface LeaveBalance {
  type: string;
  label: string;
  total: number;
  used: number;
  pending: number;
  available: number;
}

// ============================================================
// TYPES - Payslips
// ============================================================

export interface MyPayslip {
  id: string;
  period_id: string;
  year: number;
  month: number;
  period_label: string;
  base_salary: number;
  gross_salary: number;
  net_salary: number;
  cnss_employee: number;
  amo_employee: number;
  igr: number;
  status: 'draft' | 'calculated' | 'validated' | 'paid';
  pay_date?: string;
  created_at: string;
}

export interface PayslipDetail extends MyPayslip {
  lines: Array<{
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
  }>;
  employee_info: {
    full_name: string;
    employee_number?: string;
    department?: string;
    position?: string;
    hire_date?: string;
    cnss_number?: string;
  };
  company_info: {
    name: string;
    address?: string;
    cnss_number?: string;
  };
}

// ============================================================
// TYPES - Profile
// ============================================================

export interface MyProfile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  employee_number?: string;
  department?: string;
  position?: string;
  hire_date?: string;
  contract_type?: string;
  manager_name?: string;
  profile_picture?: string;
  bank_rib?: string;
  cnss_number?: string;
}

// ============================================================
// API FUNCTIONS
// ============================================================

export const myHRApi = {
  // === REQUESTS ===

  /**
   * Get my requests
   */
  getMyRequests: async (filters?: {
    status?: string;
    type?: string;
  }): Promise<{ success: boolean; requests: MyRequest[] }> => {
    const params = new URLSearchParams();
    if (filters?.status) params.append('status', filters.status);
    if (filters?.type) params.append('type', filters.type);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<{ success: boolean; requests: MyRequest[] }>(`/hr/my/requests${queryString}`);
  },

  /**
   * Get a specific request
   */
  getRequest: async (id: string): Promise<{ success: boolean; request: MyRequest }> => {
    return apiClient.get<{ success: boolean; request: MyRequest }>(`/hr/my/requests/${id}`);
  },

  /**
   * Create a new request
   */
  createRequest: async (data: CreateRequestInput | FormData): Promise<{ success: boolean; request: MyRequest; message: string }> => {
    return apiClient.post<{ success: boolean; request: MyRequest; message: string }>('/hr/my/requests', data);
  },

  /**
   * Cancel a request (only if pending)
   */
  cancelRequest: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.post<{ success: boolean; message: string }>(`/hr/my/requests/${id}/cancel`, {});
  },

  /**
   * Get leave balances
   */
  getLeaveBalances: async (): Promise<{ success: boolean; balances: LeaveBalance[] }> => {
    return apiClient.get<{ success: boolean; balances: LeaveBalance[] }>('/hr/my/leave-balances');
  },

  // === PAYSLIPS ===

  /**
   * Get my payslips
   */
  getMyPayslips: async (filters?: {
    year?: number;
  }): Promise<{ success: boolean; payslips: MyPayslip[] }> => {
    const params = new URLSearchParams();
    if (filters?.year) params.append('year', filters.year.toString());
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<{ success: boolean; payslips: MyPayslip[] }>(`/hr/my/payslips${queryString}`);
  },

  /**
   * Get payslip detail
   */
  getPayslipDetail: async (id: string): Promise<{ success: boolean; payslip: PayslipDetail }> => {
    return apiClient.get<{ success: boolean; payslip: PayslipDetail }>(`/hr/my/payslips/${id}`);
  },

  /**
   * Download payslip PDF
   */
  downloadPayslipPdf: async (id: string): Promise<Blob> => {
    const response = await fetch(`/api/hr/my/payslips/${id}/pdf`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    if (!response.ok) throw new Error('Failed to download PDF');
    return response.blob();
  },

  // === PROFILE ===

  /**
   * Get my profile
   */
  getMyProfile: async (): Promise<{ success: boolean; profile: MyProfile }> => {
    return apiClient.get<{ success: boolean; profile: MyProfile }>('/hr/my/profile');
  },

  /**
   * Update my profile (limited fields)
   */
  updateMyProfile: async (data: {
    phone?: string;
    bank_rib?: string;
  }): Promise<{ success: boolean; profile: MyProfile }> => {
    return apiClient.put<{ success: boolean; profile: MyProfile }>('/hr/my/profile', data);
  },
};
