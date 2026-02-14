/**
 * Hooks React Query - Employé Self-Service (Mon Espace RH)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { myHRApi, type CreateRequestInput } from '../lib/api/my-hr';

// ============================================================
// REQUESTS HOOKS
// ============================================================

/**
 * Hook pour récupérer mes demandes
 */
export const useMyRequests = (filters?: { status?: string; type?: string }) => {
  return useQuery({
    queryKey: ['my-hr', 'requests', filters],
    queryFn: () => myHRApi.getMyRequests(filters),
  });
};

/**
 * Hook pour récupérer une demande spécifique
 */
export const useMyRequest = (id: string) => {
  return useQuery({
    queryKey: ['my-hr', 'requests', id],
    queryFn: () => myHRApi.getRequest(id),
    enabled: !!id,
  });
};

/**
 * Hook pour créer une demande
 */
export const useCreateRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRequestInput | FormData) => myHRApi.createRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-hr', 'requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-hr', 'leave-balances'] });
    },
  });
};

/**
 * Hook pour annuler une demande
 */
export const useCancelRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => myHRApi.cancelRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-hr', 'requests'] });
      queryClient.invalidateQueries({ queryKey: ['my-hr', 'leave-balances'] });
    },
  });
};

/**
 * Hook pour récupérer les soldes de congés
 */
export const useLeaveBalances = () => {
  return useQuery({
    queryKey: ['my-hr', 'leave-balances'],
    queryFn: () => myHRApi.getLeaveBalances(),
  });
};

// ============================================================
// PAYSLIPS HOOKS
// ============================================================

/**
 * Hook pour récupérer mes bulletins de paie
 */
export const useMyPayslips = (filters?: { year?: number }) => {
  return useQuery({
    queryKey: ['my-hr', 'payslips', filters],
    queryFn: () => myHRApi.getMyPayslips(filters),
  });
};

/**
 * Hook pour récupérer le détail d'un bulletin
 */
export const usePayslipDetail = (id: string) => {
  return useQuery({
    queryKey: ['my-hr', 'payslips', id],
    queryFn: () => myHRApi.getPayslipDetail(id),
    enabled: !!id,
  });
};

/**
 * Hook pour télécharger un bulletin PDF
 */
export const useDownloadMyPayslipPdf = () => {
  return useMutation({
    mutationFn: async (id: string) => {
      const blob = await myHRApi.downloadPayslipPdf(id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bulletin-${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
  });
};

// ============================================================
// PROFILE HOOKS
// ============================================================

/**
 * Hook pour récupérer mon profil
 */
export const useMyProfile = () => {
  return useQuery({
    queryKey: ['my-hr', 'profile'],
    queryFn: () => myHRApi.getMyProfile(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook pour mettre à jour mon profil
 */
export const useUpdateMyProfile = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { phone?: string; bank_rib?: string }) => myHRApi.updateMyProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-hr', 'profile'] });
    },
  });
};
