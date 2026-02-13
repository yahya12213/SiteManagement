/**
 * Hooks React Query - Validation des Demandes RH
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { requestsValidationApi, type DecisionInput } from '../lib/api/requests-validation';

// ============================================================
// QUERY HOOKS
// ============================================================

/**
 * Hook pour recuperer les demandes en attente
 */
export const usePendingRequests = (type?: string) => {
  return useQuery({
    queryKey: ['requests-validation', 'pending', type],
    queryFn: () => requestsValidationApi.getPending(type),
  });
};

/**
 * Hook pour recuperer l'historique des decisions
 */
export const useValidationHistory = (limit?: number) => {
  return useQuery({
    queryKey: ['requests-validation', 'history', limit],
    queryFn: () => requestsValidationApi.getHistory(limit),
  });
};

/**
 * Hook pour recuperer les details d'une demande
 */
export const useRequestDetails = (id: number, type: 'leave' | 'overtime') => {
  return useQuery({
    queryKey: ['requests-validation', 'details', id, type],
    queryFn: () => requestsValidationApi.getDetails(id, type),
    enabled: !!id,
  });
};

// ============================================================
// MUTATION HOOKS
// ============================================================

/**
 * Hook pour approuver une demande
 */
export const useApproveRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: DecisionInput }) =>
      requestsValidationApi.approve(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests-validation', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['requests-validation', 'history'] });
      queryClient.invalidateQueries({ queryKey: ['employee-portal', 'requests'] });
    },
  });
};

/**
 * Hook pour rejeter une demande
 */
export const useRejectRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: DecisionInput }) =>
      requestsValidationApi.reject(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests-validation', 'pending'] });
      queryClient.invalidateQueries({ queryKey: ['requests-validation', 'history'] });
      queryClient.invalidateQueries({ queryKey: ['employee-portal', 'requests'] });
    },
  });
};
