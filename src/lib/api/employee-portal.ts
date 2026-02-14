/**
 * API Client - Portail Employé RH
 */

import { apiClient } from './client';

// Types
export interface EmployeeProfile {
  id: number;
  first_name: string;
  last_name: string;
  employee_number: string;
  position: string;
  department: string;
  hire_date: string;
  email: string;
  phone: string;
  requires_clocking: boolean;
  segment_id: number;
  leave_balances: LeaveBalance[];
  contract: Contract | null;
}

export interface LeaveBalance {
  code: string;
  name: string;
  current_balance: number;
  taken: number;
  initial_balance: number;
}

export interface Contract {
  contract_type: string;
  start_date: string;
  end_date: string;
  salary_gross: number;
  working_hours_per_week: number;
}

export interface CorrectionRequestInfo {
  id: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'approved_n1' | 'approved_n2' | 'approved_n3';
  requested_check_in: string | null;
  requested_check_out: string | null;
  reason: string;
  created_at: string;
  current_approver_name?: string | null;
}

export type AttendanceStatus =
  | 'present'
  | 'absent'
  | 'late'
  | 'early_leave'
  | 'late_early'
  | 'half_day'
  | 'incomplete'
  | 'weekend'
  | 'holiday'
  | 'leave'
  | 'mission'
  | 'check_in'
  | 'check_out'
  | 'recovery_off'
  | 'recovery_paid'
  | 'recovery_unpaid'
  | 'pending'
  | 'partial'
  | 'sick'
  | 'training'
  | 'overtime';

export interface AttendanceRecord {
  date: string;
  check_in: string;
  check_out: string;
  status: AttendanceStatus;
  worked_minutes?: number | null;
  has_anomaly?: boolean;
  late_minutes?: number;
  correction_request?: CorrectionRequestInfo | null;
}

export interface AttendanceStats {
  total_hours: string;
  present_days: number;
  leave_days: number;
  late_minutes: number;
}

export interface AttendanceResponse {
  success: boolean;
  year: number;
  month: number;
  records: AttendanceRecord[];
  leaves: any[];
  holidays: any[];
  stats: AttendanceStats;
}

export interface HRRequest {
  id: number;
  request_type: 'leave' | 'overtime';
  type_code: string;
  type_name: string;
  start_date: string;
  end_date: string;
  days_requested: number;
  description: string;
  status: 'pending' | 'approved' | 'rejected' | 'draft';
  date_soumission: string;
  n1_comment?: string;
  n2_comment?: string;
  hr_comment?: string;
}

export interface TodayClocking {
  success: boolean;
  requires_clocking: boolean;
  employee?: {
    id: number;
    name: string;
  };
  today?: {
    date: string;
    records: any[];
    last_action: any;
    can_check_in: boolean;
    can_check_out: boolean;
    worked_minutes: number;
    is_complete: boolean;
  };
}

export interface CreateRequestInput {
  type: string;
  start_date?: string;
  end_date?: string;
  description: string;
}

export interface LeaveType {
  id: number;
  code: string;
  name: string;
  is_paid: boolean;
  max_days_per_year: number;
}

// API functions
export const employeePortalApi = {
  // Get employee profile
  getProfile: async (): Promise<{ success: boolean; employee: EmployeeProfile }> => {
    return apiClient.get<{ success: boolean; employee: EmployeeProfile }>('/hr/employee-portal/profile');
  },

  // Get attendance records for a month
  getAttendance: async (year?: number, month?: number): Promise<AttendanceResponse> => {
    const params = new URLSearchParams();
    if (year) params.append('year', year.toString());
    if (month) params.append('month', month.toString());
    return apiClient.get<AttendanceResponse>(`/hr/employee-portal/attendance?${params}`);
  },

  // Get my HR requests
  getRequests: async (): Promise<{ success: boolean; requests: HRRequest[] }> => {
    return apiClient.get<{ success: boolean; requests: HRRequest[] }>('/hr/employee-portal/requests');
  },

  // Create new request
  createRequest: async (data: CreateRequestInput | FormData): Promise<{ success: boolean; message: string; request_id: number }> => {
    return apiClient.post<{ success: boolean; message: string; request_id: number }>('/hr/employee-portal/requests', data);
  },

  // Get leave types
  getLeaveTypes: async (): Promise<{ success: boolean; leave_types: LeaveType[] }> => {
    return apiClient.get<{ success: boolean; leave_types: LeaveType[] }>('/hr/employee-portal/leave-types');
  },

  // Clocking endpoints (consolidated into /hr/attendance)
  getTodayClocking: async (): Promise<TodayClocking> => {
    return apiClient.get<TodayClocking>('/hr/attendance/my-today');
  },

  checkIn: async (): Promise<{ success: boolean; message: string; record: any }> => {
    return apiClient.post<{ success: boolean; message: string; record: any }>('/hr/attendance/clock-in');
  },

  checkOut: async (): Promise<{ success: boolean; message: string; record: any; worked_minutes_today: number }> => {
    return apiClient.post<{ success: boolean; message: string; record: any; worked_minutes_today: number }>('/hr/attendance/clock-out');
  },
};
