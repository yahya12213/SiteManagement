/**
 * Hooks React Query - Gestion des visites physiques
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  visitsApi,
  type VisitFilters,
  type CreateVisitInput,
  type UpdateVisitInput,
  type AnalyticsFilters
} from '../lib/api/visits';

// ============================================================
// QUERY HOOKS
// ============================================================

/**
 * Hook pour récupérer la liste des visites
 */
export const useVisits = (filters?: VisitFilters) => {
  return useQuery({
    queryKey: ['visits', filters],
    queryFn: () => visitsApi.getAll(filters),
    refetchInterval: 30000, // Polling toutes les 30 secondes
  });
};

/**
 * Hook pour récupérer une visite par ID
 */
export const useVisit = (id: string) => {
  return useQuery({
    queryKey: ['visits', id],
    queryFn: () => visitsApi.getById(id),
    enabled: !!id,
  });
};

/**
 * Hook pour récupérer les motifs de non-inscription
 */
export const useRejectionReasons = () => {
  return useQuery({
    queryKey: ['visits', 'rejection-reasons'],
    queryFn: () => visitsApi.getRejectionReasons(),
    staleTime: 5 * 60 * 1000, // Cache 5 minutes
  });
};

/**
 * Hook pour récupérer les analytics des visites
 */
export const useVisitAnalytics = (filters?: AnalyticsFilters) => {
  return useQuery({
    queryKey: ['visits', 'analytics', filters],
    queryFn: () => visitsApi.getAnalytics(filters),
    refetchInterval: 60000, // Polling toutes les minutes
  });
};

// ============================================================
// MUTATION HOOKS
// ============================================================

/**
 * Hook pour créer une nouvelle visite
 */
export const useCreateVisit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateVisitInput) => visitsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      // 🔄 Rafraîchir aussi les prospects car le statut peut changer après visite
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    },
  });
};

/**
 * Hook pour mettre à jour une visite
 */
export const useUpdateVisit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateVisitInput) => visitsApi.update(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
      queryClient.invalidateQueries({ queryKey: ['visits', variables.id] });
    },
  });
};

/**
 * Hook pour supprimer une visite
 */
export const useDeleteVisit = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => visitsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] });
    },
  });
};

/**
 * Hook pour exporter les visites en CSV
 */
export const useExportVisits = () => {
  return useMutation({
    mutationFn: async (filters?: AnalyticsFilters) => {
      const blob = await visitsApi.exportCSV(filters);

      // Créer un lien de téléchargement
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `visites_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      return true;
    },
  });
};
