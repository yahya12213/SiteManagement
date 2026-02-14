/**
 * Hooks React Query - Portail Employé RH
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeePortalApi, type CreateRequestInput } from '../lib/api/employee-portal';

// ============================================================
// QUERY HOOKS
// ============================================================

/**
 * Hook pour récupérer le profil de l'employé connecté
 */
export const useEmployeeProfile = () => {
  return useQuery({
    queryKey: ['employee-portal', 'profile'],
    queryFn: () => employeePortalApi.getProfile(),
  });
};

/**
 * Hook pour récupérer les pointages du mois
 */
export const useEmployeeAttendance = (year?: number, month?: number) => {
  return useQuery({
    queryKey: ['employee-portal', 'attendance', year, month],
    queryFn: () => employeePortalApi.getAttendance(year, month),
  });
};

/**
 * Hook pour récupérer les demandes RH de l'employé
 */
export const useEmployeeRequests = () => {
  return useQuery({
    queryKey: ['employee-portal', 'requests'],
    queryFn: () => employeePortalApi.getRequests(),
  });
};

/**
 * Hook pour récupérer le statut de pointage du jour
 */
export const useTodayClocking = () => {
  return useQuery({
    queryKey: ['employee-portal', 'today-clocking'],
    queryFn: () => employeePortalApi.getTodayClocking(),
    refetchInterval: 60000, // Rafraîchir toutes les minutes
  });
};

/**
 * Hook pour récupérer les types de congés
 */
export const useLeaveTypes = () => {
  return useQuery({
    queryKey: ['employee-portal', 'leave-types'],
    queryFn: () => employeePortalApi.getLeaveTypes(),
  });
};

// ============================================================
// MUTATION HOOKS
// ============================================================

/**
 * Hook pour créer une nouvelle demande RH
 */
export const useCreateRequest = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateRequestInput | FormData) => employeePortalApi.createRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-portal', 'requests'] });
      queryClient.invalidateQueries({ queryKey: ['employee-portal', 'profile'] }); // Pour rafraîchir les soldes
    },
  });
};

/**
 * Hook pour pointer l'entrée
 */
export const useCheckIn = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => employeePortalApi.checkIn(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-portal', 'today-clocking'] });
      // Refetch pour mise à jour immédiate du tableau
      queryClient.refetchQueries({ queryKey: ['employee-portal', 'attendance'] });
    },
  });
};

/**
 * Hook pour pointer la sortie
 */
export const useCheckOut = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => employeePortalApi.checkOut(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-portal', 'today-clocking'] });
      // Refetch pour mise à jour immédiate du tableau
      queryClient.refetchQueries({ queryKey: ['employee-portal', 'attendance'] });
    },
  });
};
