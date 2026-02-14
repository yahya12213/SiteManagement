/**
 * Hooks React Query - Boucles de Validation (Validation Workflows)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  validationWorkflowsApi,
  type CreateWorkflowInput,
  type UpdateWorkflowInput,
  type CreateStepInput,
} from '../lib/api/validation-workflows';

// ============================================================
// WORKFLOW HOOKS
// ============================================================

/**
 * Hook pour récupérer tous les workflows
 */
export const useValidationWorkflows = (filters?: { trigger_type?: string; active_only?: boolean }) => {
  return useQuery({
    queryKey: ['validation-workflows', filters],
    queryFn: () => validationWorkflowsApi.getAll(filters),
  });
};

/**
 * Hook pour récupérer un workflow spécifique
 */
export const useValidationWorkflow = (id: string) => {
  return useQuery({
    queryKey: ['validation-workflows', id],
    queryFn: () => validationWorkflowsApi.getById(id),
    enabled: !!id,
  });
};

/**
 * Hook pour créer un workflow
 */
export const useCreateWorkflow = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateWorkflowInput) => validationWorkflowsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['validation-workflows'] });
    },
  });
};

/**
 * Hook pour mettre à jour un workflow
 */
export const useUpdateWorkflow = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWorkflowInput }) =>
      validationWorkflowsApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['validation-workflows'] });
      queryClient.invalidateQueries({ queryKey: ['validation-workflows', variables.id] });
    },
  });
};

/**
 * Hook pour activer/désactiver un workflow
 */
export const useToggleWorkflow = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => validationWorkflowsApi.toggle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['validation-workflows'] });
    },
  });
};

/**
 * Hook pour supprimer un workflow
 */
export const useDeleteWorkflow = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => validationWorkflowsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['validation-workflows'] });
    },
  });
};

// ============================================================
// STEP HOOKS
// ============================================================

/**
 * Hook pour ajouter une étape
 */
export const useAddStep = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workflowId, data }: { workflowId: string; data: CreateStepInput }) =>
      validationWorkflowsApi.addStep(workflowId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['validation-workflows'] });
      queryClient.invalidateQueries({ queryKey: ['validation-workflows', variables.workflowId] });
    },
  });
};

/**
 * Hook pour mettre à jour une étape
 */
export const useUpdateStep = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workflowId, stepId, data }: { workflowId: string; stepId: string; data: Partial<CreateStepInput> }) =>
      validationWorkflowsApi.updateStep(workflowId, stepId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['validation-workflows'] });
      queryClient.invalidateQueries({ queryKey: ['validation-workflows', variables.workflowId] });
    },
  });
};

/**
 * Hook pour supprimer une étape
 */
export const useDeleteStep = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workflowId, stepId }: { workflowId: string; stepId: string }) =>
      validationWorkflowsApi.deleteStep(workflowId, stepId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['validation-workflows'] });
      queryClient.invalidateQueries({ queryKey: ['validation-workflows', variables.workflowId] });
    },
  });
};

/**
 * Hook pour déplacer une étape
 */
export const useMoveStep = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ workflowId, stepId, direction }: { workflowId: string; stepId: string; direction: 'up' | 'down' }) =>
      validationWorkflowsApi.moveStep(workflowId, stepId, direction),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['validation-workflows'] });
      queryClient.invalidateQueries({ queryKey: ['validation-workflows', variables.workflowId] });
    },
  });
};

// ============================================================
// STATS HOOK
// ============================================================

/**
 * Hook pour récupérer les statistiques
 */
export const useWorkflowStats = () => {
  return useQuery({
    queryKey: ['validation-workflows', 'stats'],
    queryFn: () => validationWorkflowsApi.getStats(),
  });
};
