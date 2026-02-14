/**
 * API Client - Boucles de Validation (Validation Workflows)
 */

import { apiClient } from './client';

// ============================================================
// TYPES
// ============================================================

export interface ValidationStep {
  id: string;
  ordre: number;
  validateur_type: 'user' | 'role' | 'manager' | 'hr';
  validateur_id?: string;
  validateur_role?: string;
  validateur_nom: string;
  condition?: string;
  timeout_hours?: number;
}

export interface ValidationWorkflow {
  id: string;
  nom: string;
  description?: string;
  declencheur: string;
  segment_id?: string;
  segment_nom?: string;
  actif: boolean;
  priority?: number;
  conditions?: Record<string, any>;
  etapes: ValidationStep[];
  etapes_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface CreateWorkflowInput {
  nom: string;
  description?: string;
  declencheur: string;
  segment_id?: string;
  actif?: boolean;
  priority?: number;
  etapes?: Omit<ValidationStep, 'id'>[];
}

export interface UpdateWorkflowInput extends Partial<CreateWorkflowInput> {}

export interface CreateStepInput {
  validateur_type: 'user' | 'role' | 'manager' | 'hr';
  validateur_id?: string;
  validateur_role?: string;
  validateur_nom: string;
  condition?: string;
  timeout_hours?: number;
  reminder_hours?: number;
  allow_delegation?: boolean;
}

export interface WorkflowStats {
  total: number;
  active: number;
  inactive: number;
  trigger_types: number;
  pending_instances: number;
}

// ============================================================
// TRIGGER TYPES (for reference)
// ============================================================

export const TRIGGER_TYPES = [
  { value: 'demande_conge', label: 'Demande de congé' },
  { value: 'demande_administrative', label: 'Demande administrative' },
  { value: 'correction_pointage', label: 'Correction de pointage' },
  { value: 'note_frais', label: 'Note de frais' },
  { value: 'demande_formation', label: 'Demande de formation' },
  { value: 'recrutement', label: 'Processus de recrutement' },
  { value: 'heures_supplementaires', label: 'Heures supplémentaires' },
] as const;

export const APPROVER_TYPES = [
  { value: 'manager', label: 'Manager direct (N+1)' },
  { value: 'hr', label: 'Responsable RH' },
  { value: 'role', label: 'Rôle spécifique' },
  { value: 'user', label: 'Utilisateur spécifique' },
] as const;

// ============================================================
// API FUNCTIONS
// ============================================================

export const validationWorkflowsApi = {
  // === WORKFLOWS ===

  /**
   * Get all workflows
   */
  getAll: async (filters?: { trigger_type?: string; active_only?: boolean }): Promise<{ success: boolean; workflows: ValidationWorkflow[] }> => {
    const params = new URLSearchParams();
    if (filters?.trigger_type) params.append('trigger_type', filters.trigger_type);
    if (filters?.active_only) params.append('active_only', 'true');
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<{ success: boolean; workflows: ValidationWorkflow[] }>(`/hr/validation-workflows${queryString}`);
  },

  /**
   * Get a single workflow
   */
  getById: async (id: string): Promise<{ success: boolean; workflow: ValidationWorkflow }> => {
    return apiClient.get<{ success: boolean; workflow: ValidationWorkflow }>(`/hr/validation-workflows/${id}`);
  },

  /**
   * Create a new workflow
   */
  create: async (data: CreateWorkflowInput): Promise<{ success: boolean; workflow: ValidationWorkflow }> => {
    return apiClient.post<{ success: boolean; workflow: ValidationWorkflow }>('/hr/validation-workflows', data);
  },

  /**
   * Update a workflow
   */
  update: async (id: string, data: UpdateWorkflowInput): Promise<{ success: boolean; workflow: ValidationWorkflow }> => {
    return apiClient.put<{ success: boolean; workflow: ValidationWorkflow }>(`/hr/validation-workflows/${id}`, data);
  },

  /**
   * Toggle workflow active status
   */
  toggle: async (id: string): Promise<{ success: boolean; workflow: ValidationWorkflow; message: string }> => {
    return apiClient.put<{ success: boolean; workflow: ValidationWorkflow; message: string }>(`/hr/validation-workflows/${id}/toggle`);
  },

  /**
   * Delete a workflow
   */
  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete<{ success: boolean; message: string }>(`/hr/validation-workflows/${id}`);
  },

  // === STEPS ===

  /**
   * Add a step to workflow
   */
  addStep: async (workflowId: string, data: CreateStepInput): Promise<{ success: boolean; step: ValidationStep }> => {
    return apiClient.post<{ success: boolean; step: ValidationStep }>(`/hr/validation-workflows/${workflowId}/steps`, data);
  },

  /**
   * Update a step
   */
  updateStep: async (workflowId: string, stepId: string, data: Partial<CreateStepInput>): Promise<{ success: boolean; step: ValidationStep }> => {
    return apiClient.put<{ success: boolean; step: ValidationStep }>(`/hr/validation-workflows/${workflowId}/steps/${stepId}`, data);
  },

  /**
   * Delete a step
   */
  deleteStep: async (workflowId: string, stepId: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete<{ success: boolean; message: string }>(`/hr/validation-workflows/${workflowId}/steps/${stepId}`);
  },

  /**
   * Move step up or down
   */
  moveStep: async (workflowId: string, stepId: string, direction: 'up' | 'down'): Promise<{ success: boolean; message: string }> => {
    return apiClient.put<{ success: boolean; message: string }>(`/hr/validation-workflows/${workflowId}/steps/${stepId}/move`, { direction });
  },

  // === STATS ===

  /**
   * Get workflow statistics
   */
  getStats: async (): Promise<{ success: boolean; stats: WorkflowStats }> => {
    return apiClient.get<{ success: boolean; stats: WorkflowStats }>('/hr/validation-workflows/stats/summary');
  },
};
