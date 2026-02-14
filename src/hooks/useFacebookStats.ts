/**
 * Hooks React Query - Gestion des stats Facebook (Analyse Publicite)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  facebookStatsApi,
  type FacebookStatFilters,
  type CreateFacebookStatInput,
  type ComparisonFilters
} from '../lib/api/facebook-stats';

// ============================================================
// QUERY HOOKS
// ============================================================

/**
 * Hook pour recuperer la liste des stats Facebook
 */
export const useFacebookStats = (filters?: FacebookStatFilters) => {
  return useQuery({
    queryKey: ['facebook-stats', filters],
    queryFn: () => facebookStatsApi.getAll(filters),
    refetchInterval: 60000, // Polling toutes les minutes
  });
};

/**
 * Hook pour recuperer la comparaison Facebook vs BDD
 */
export const useFacebookStatsComparison = (filters: ComparisonFilters) => {
  return useQuery({
    queryKey: ['facebook-stats', 'comparison', filters],
    queryFn: () => facebookStatsApi.getComparison(filters),
    enabled: !!filters.date_start && !!filters.date_end,
    refetchInterval: 60000, // Polling toutes les minutes
  });
};

/**
 * Hook pour recuperer le resume par segment
 */
export const useFacebookStatsSummary = (filters: { date_start: string; date_end: string }) => {
  return useQuery({
    queryKey: ['facebook-stats', 'summary', filters],
    queryFn: () => facebookStatsApi.getSummary(filters),
    enabled: !!filters.date_start && !!filters.date_end,
  });
};

// ============================================================
// MUTATION HOOKS
// ============================================================

/**
 * Hook pour creer/mettre a jour une stat Facebook
 */
export const useCreateFacebookStat = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateFacebookStatInput) => facebookStatsApi.create(data),
    onSuccess: () => {
      // Invalider toutes les queries facebook-stats
      queryClient.invalidateQueries({ queryKey: ['facebook-stats'] });
    },
  });
};

/**
 * Hook pour supprimer une stat Facebook
 */
export const useDeleteFacebookStat = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => facebookStatsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facebook-stats'] });
    },
  });
};
