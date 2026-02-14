/**
 * Hooks React Query - Interface Manager (Vue équipe)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { managerApi } from '../lib/api/manager';

// ============================================================
// TEAM HOOKS
// ============================================================

/**
 * Hook pour récupérer les membres de l'équipe
 */
export const useTeam = () => {
  return useQuery({
    queryKey: ['manager', 'team'],
    queryFn: () => managerApi.getTeam(),
  });
};

/**
 * Hook pour récupérer les pointages de l'équipe
 */
export const useTeamAttendance = (filters?: {
  start_date?: string;
  end_date?: string;
  employee_id?: string;
}) => {
  return useQuery({
    queryKey: ['manager', 'team-attendance', filters],
    queryFn: () => managerApi.getTeamAttendance(filters),
  });
};

/**
 * Hook pour récupérer les demandes de l'équipe
 */
export const useTeamRequests = (filters?: {
  status?: string;
  type?: string;
  employee_id?: string;
}) => {
  return useQuery({
    queryKey: ['manager', 'team-requests', filters],
    queryFn: () => managerApi.getTeamRequests(filters),
  });
};

/**
 * Hook pour récupérer les statistiques de l'équipe
 */
export const useTeamStats = () => {
  return useQuery({
    queryKey: ['manager', 'team-stats'],
    queryFn: () => managerApi.getTeamStats(),
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });
};

// ============================================================
// APPROVAL HOOKS
// ============================================================

/**
 * Hook pour approuver une demande
 */
export const useApproveRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, comment, request_type }: { requestId: string; comment?: string; request_type?: string }) =>
      managerApi.approveRequest(requestId, comment, request_type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager', 'team-requests'] });
      queryClient.invalidateQueries({ queryKey: ['manager', 'team-stats'] });
      // Also invalidate validation requests if the same data is used
      queryClient.invalidateQueries({ queryKey: ['hr-requests-validation'] });
    },
  });
};

/**
 * Hook pour rejeter une demande
 */
export const useRejectRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, reason, request_type }: { requestId: string; reason: string; request_type?: string }) =>
      managerApi.rejectRequest(requestId, reason, request_type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager', 'team-requests'] });
      queryClient.invalidateQueries({ queryKey: ['manager', 'team-stats'] });
      queryClient.invalidateQueries({ queryKey: ['hr-requests-validation'] });
    },
  });
};

/**
 * Hook pour annuler une demande approuvée (admin uniquement)
 */
export const useCancelRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId, reason, request_type }: { requestId: string; reason: string; request_type?: string }) =>
      managerApi.cancelRequest(requestId, reason, request_type),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['manager', 'team-requests'] });
      queryClient.invalidateQueries({ queryKey: ['manager', 'team-stats'] });
      queryClient.invalidateQueries({ queryKey: ['hr-requests-validation'] });
    },
  });
};

// ============================================================
// RECALCULATE HOOKS
// ============================================================

/**
 * Hook pour recalculer les pointages de l'équipe
 * Utile après ajout de jours fériés, récupérations ou pointages rétroactifs
 */
export const useRecalculateTeamAttendance = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: { start_date: string; end_date: string; employee_id?: string }) =>
      managerApi.recalculateTeamAttendance(params),
    onSuccess: () => {
      // Rafraîchir les données de pointage après recalcul
      queryClient.invalidateQueries({ queryKey: ['manager', 'team-attendance'] });
      queryClient.invalidateQueries({ queryKey: ['manager', 'team-stats'] });
    },
  });
};

// ============================================================
// EXPORT HOOKS
// ============================================================

/**
 * Hook pour exporter les pointages de l'équipe
 */
export const useExportTeamAttendance = () => {
  return useMutation({
    mutationFn: async (filters?: { start_date?: string; end_date?: string }) => {
      const blob = await managerApi.exportTeamAttendance(filters);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pointages-equipe-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
  });
};
