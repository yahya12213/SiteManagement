/**
 * Hooks React Query - Gestion des Délégations d'Approbation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  delegationApi,
  type CreateDelegationInput,
  type UpdateDelegationInput,
  type DelegationFilters,
} from '../lib/api/delegation';

// ============================================================
// MY DELEGATIONS HOOKS
// ============================================================

/**
 * Hook pour récupérer mes délégations (que j'ai créées)
 */
export const useMyDelegations = (filters?: DelegationFilters) => {
  return useQuery({
    queryKey: ['delegation', 'my', filters],
    queryFn: () => delegationApi.getMyDelegations(filters),
  });
};

/**
 * Hook pour récupérer les délégations reçues
 */
export const useReceivedDelegations = () => {
  return useQuery({
    queryKey: ['delegation', 'received'],
    queryFn: () => delegationApi.getReceivedDelegations(),
  });
};

/**
 * Hook pour récupérer toutes les délégations (admin)
 */
export const useAllDelegations = (filters?: DelegationFilters) => {
  return useQuery({
    queryKey: ['delegation', 'all', filters],
    queryFn: () => delegationApi.getAllDelegations(filters),
  });
};

/**
 * Hook pour récupérer une délégation spécifique
 */
export const useDelegation = (id: string) => {
  return useQuery({
    queryKey: ['delegation', id],
    queryFn: () => delegationApi.getDelegation(id),
    enabled: !!id,
  });
};

// ============================================================
// MUTATION HOOKS
// ============================================================

/**
 * Hook pour créer une délégation
 */
export const useCreateDelegation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateDelegationInput) => delegationApi.createDelegation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegation'] });
    },
  });
};

/**
 * Hook pour mettre à jour une délégation
 */
export const useUpdateDelegation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDelegationInput }) =>
      delegationApi.updateDelegation(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['delegation'] });
      queryClient.invalidateQueries({ queryKey: ['delegation', variables.id] });
    },
  });
};

/**
 * Hook pour annuler une délégation
 */
export const useCancelDelegation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => delegationApi.cancelDelegation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['delegation'] });
    },
  });
};

// ============================================================
// UTILITY HOOKS
// ============================================================

/**
 * Hook pour récupérer les délégués potentiels
 */
export const usePotentialDelegates = () => {
  return useQuery({
    queryKey: ['delegation', 'potential-delegates'],
    queryFn: () => delegationApi.getPotentialDelegates(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
