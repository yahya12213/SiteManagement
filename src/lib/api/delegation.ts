/**
 * API Client - Gestion des Délégations d'Approbation
 * Routes backend: /api/hr/delegation/*
 */

import { apiClient } from './client';

// ============================================================
// TYPES - Delegations
// ============================================================

export interface Delegation {
  id: string;
  delegator_id: string;
  delegator_name: string;
  delegator_email?: string;
  delegate_id: string;
  delegate_name: string;
  delegate_email?: string;
  start_date: string;
  end_date: string;
  delegation_type: 'all' | 'leaves' | 'overtime' | 'corrections';
  reason?: string;
  is_active: boolean;
  excluded_employees?: string[];
  max_amount?: number;
  requires_notification: boolean;
  created_at: string;
  created_by?: string;
  created_by_name?: string;
}

export interface CreateDelegationInput {
  delegate_id: string;
  start_date: string;
  end_date: string;
  delegation_type: 'all' | 'leaves' | 'overtime' | 'corrections';
  reason?: string;
  excluded_employees?: string[];
  max_amount?: number;
  requires_notification?: boolean;
}

export interface UpdateDelegationInput {
  delegate_id?: string;
  start_date?: string;
  end_date?: string;
  delegation_type?: 'all' | 'leaves' | 'overtime' | 'corrections';
  reason?: string;
  is_active?: boolean;
  excluded_employees?: string[];
  max_amount?: number;
  requires_notification?: boolean;
}

export interface DelegationFilters {
  is_active?: boolean;
  include_expired?: boolean;
}

// ============================================================
// API FUNCTIONS
// ============================================================

export const delegationApi = {
  /**
   * Get my delegations (delegations I created)
   */
  getMyDelegations: async (filters?: DelegationFilters): Promise<{ success: boolean; delegations: Delegation[] }> => {
    const params = new URLSearchParams();
    if (filters?.is_active !== undefined) params.append('is_active', filters.is_active.toString());
    if (filters?.include_expired) params.append('include_expired', 'true');
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<{ success: boolean; delegations: Delegation[] }>(`/hr/delegation/my${queryString}`);
  },

  /**
   * Get delegations received (delegations where I am the delegate)
   */
  getReceivedDelegations: async (): Promise<{ success: boolean; delegations: Delegation[] }> => {
    return apiClient.get<{ success: boolean; delegations: Delegation[] }>('/hr/delegation/received');
  },

  /**
   * Get all delegations (admin only)
   */
  getAllDelegations: async (filters?: DelegationFilters): Promise<{ success: boolean; delegations: Delegation[] }> => {
    const params = new URLSearchParams();
    if (filters?.is_active !== undefined) params.append('is_active', filters.is_active.toString());
    if (filters?.include_expired) params.append('include_expired', 'true');
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<{ success: boolean; delegations: Delegation[] }>(`/hr/delegation/all${queryString}`);
  },

  /**
   * Get a specific delegation
   */
  getDelegation: async (id: string): Promise<{ success: boolean; delegation: Delegation }> => {
    return apiClient.get<{ success: boolean; delegation: Delegation }>(`/hr/delegation/${id}`);
  },

  /**
   * Create a new delegation
   */
  createDelegation: async (data: CreateDelegationInput): Promise<{ success: boolean; delegation: Delegation; message: string }> => {
    return apiClient.post<{ success: boolean; delegation: Delegation; message: string }>('/hr/delegation', data);
  },

  /**
   * Update a delegation
   */
  updateDelegation: async (id: string, data: UpdateDelegationInput): Promise<{ success: boolean; delegation: Delegation }> => {
    return apiClient.put<{ success: boolean; delegation: Delegation }>(`/hr/delegation/${id}`, data);
  },

  /**
   * Cancel/Delete a delegation
   */
  cancelDelegation: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete<{ success: boolean; message: string }>(`/hr/delegation/${id}`);
  },

  /**
   * Get potential delegates (users who can receive delegation)
   */
  getPotentialDelegates: async (): Promise<{ success: boolean; users: Array<{ id: string; full_name: string; email: string; role?: string }> }> => {
    return apiClient.get<{ success: boolean; users: Array<{ id: string; full_name: string; email: string; role?: string }> }>('/hr/delegation/potential-delegates');
  },
};
