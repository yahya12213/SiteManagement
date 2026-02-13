/**
 * Hooks React Query pour les certificats
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query';
import {
  certificatesApi,
  type Certificate,
  type GenerateCertificateInput,
  type CertificateVerification,
  type CertificatesListResponse,
} from '@/lib/api/certificates';

/**
 * Hook pour récupérer les certificats d'un étudiant
 */
export const useStudentCertificates = (
  studentId: string | null
): UseQueryResult<{ success: boolean; certificates: Certificate[] }> => {
  return useQuery({
    queryKey: ['certificates', 'student', studentId],
    queryFn: () => {
      if (!studentId) {
        throw new Error('Student ID is required');
      }
      return certificatesApi.getByStudent(studentId);
    },
    enabled: !!studentId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Hook pour récupérer un certificat par son ID
 */
export const useCertificate = (
  certificateId: string | null
): UseQueryResult<{ success: boolean; certificate: Certificate }> => {
  return useQuery({
    queryKey: ['certificates', certificateId],
    queryFn: () => {
      if (!certificateId) {
        throw new Error('Certificate ID is required');
      }
      return certificatesApi.getById(certificateId);
    },
    enabled: !!certificateId,
    staleTime: 1000 * 60 * 10, // 10 minutes (les certificats changent rarement)
  });
};

/**
 * Hook pour vérifier un certificat par son numéro
 */
export const useVerifyCertificate = (
  certificateNumber: string | null
): UseQueryResult<CertificateVerification> => {
  return useQuery({
    queryKey: ['certificates', 'verify', certificateNumber],
    queryFn: () => {
      if (!certificateNumber) {
        throw new Error('Certificate number is required');
      }
      return certificatesApi.verify(certificateNumber);
    },
    enabled: !!certificateNumber,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

/**
 * Hook pour récupérer tous les certificats (admin)
 */
export const useAllCertificates = (params?: {
  limit?: number;
  offset?: number;
  formation_id?: string;
}): UseQueryResult<CertificatesListResponse> => {
  return useQuery({
    queryKey: ['certificates', 'all', params],
    queryFn: () => certificatesApi.getAll(params),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Hook pour générer un certificat
 */
export const useGenerateCertificate = (): UseMutationResult<
  { success: boolean; certificate: Certificate },
  Error,
  GenerateCertificateInput
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: certificatesApi.generate,
    onSuccess: (_data, variables) => {
      // Invalider les certificats de l'étudiant
      queryClient.invalidateQueries({
        queryKey: ['certificates', 'student', variables.student_id],
      });
      // Invalider la liste complète des certificats
      queryClient.invalidateQueries({
        queryKey: ['certificates', 'all'],
      });
    },
  });
};

/**
 * Hook pour supprimer un certificat (admin)
 */
export const useDeleteCertificate = (): UseMutationResult<
  { success: boolean; message: string },
  Error,
  string
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: certificatesApi.delete,
    onSuccess: () => {
      // Invalider toutes les queries de certificats
      queryClient.invalidateQueries({
        queryKey: ['certificates'],
      });
    },
  });
};

/**
 * Hook pour mettre à jour les métadonnées d'un certificat
 */
export const useUpdateCertificateMetadata = (): UseMutationResult<
  { success: boolean; certificate: Certificate },
  Error,
  { id: string; metadata: Record<string, any> }
> => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, metadata }) => certificatesApi.updateMetadata(id, metadata),
    onSuccess: (data) => {
      // Invalider le certificat spécifique
      queryClient.invalidateQueries({
        queryKey: ['certificates', data.certificate.id],
      });
      // Invalider les certificats de l'étudiant
      queryClient.invalidateQueries({
        queryKey: ['certificates', 'student', data.certificate.student_id],
      });
    },
  });
};
