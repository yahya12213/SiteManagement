import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { PaymentFormData, PaymentHistoryResponse, PaymentResponse } from '@/types/payments';

/**
 * Hook to fetch payment history for a student in a session
 */
export const useStudentPayments = (sessionId: string, studentId: string) => {
  return useQuery<PaymentHistoryResponse>({
    queryKey: ['student-payments', sessionId, studentId],
    queryFn: async () => {
      const response = await apiClient.get<PaymentHistoryResponse>(
        `/sessions-formation/${sessionId}/etudiants/${studentId}/paiements`
      );
      return response;
    },
    enabled: !!sessionId && !!studentId,
  });
};

/**
 * Hook to record a new payment
 */
export const useRecordPayment = (sessionId: string, studentId: string) => {
  const queryClient = useQueryClient();

  return useMutation<PaymentResponse, Error, PaymentFormData>({
    mutationFn: async (paymentData: PaymentFormData) => {
      const response = await apiClient.post<PaymentResponse>(
        `/sessions-formation/${sessionId}/etudiants/${studentId}/paiements`,
        paymentData
      );
      return response;
    },
    onSuccess: () => {
      // Invalidate and refetch payment history
      queryClient.invalidateQueries({
        queryKey: ['student-payments', sessionId, studentId],
      });
      // Also invalidate session details to update totals
      queryClient.invalidateQueries({
        queryKey: ['session-formation', sessionId],
      });
    },
  });
};

/**
 * Hook to delete/cancel a payment
 */
export const useDeletePayment = (sessionId: string, studentId: string) => {
  const queryClient = useQueryClient();

  return useMutation<PaymentResponse, Error, string>({
    mutationFn: async (paymentId: string) => {
      const response = await apiClient.delete<PaymentResponse>(
        `/sessions-formation/${sessionId}/etudiants/${studentId}/paiements/${paymentId}`
      );
      return response;
    },
    onSuccess: () => {
      // Invalidate and refetch payment history
      queryClient.invalidateQueries({
        queryKey: ['student-payments', sessionId, studentId],
      });
      // Also invalidate session details to update totals
      queryClient.invalidateQueries({
        queryKey: ['session-formation', sessionId],
      });
    },
  });
};
