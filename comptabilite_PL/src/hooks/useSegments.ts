import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { segmentsApi } from '@/lib/api/segments';
import type { Segment, CreateSegmentInput, UpdateSegmentInput } from '@/lib/api/segments';
import { v4 as uuidv4 } from 'uuid';
import { useAuth } from '@/contexts/AuthContext';

// Ré-exporter les types pour compatibilité
export type { Segment, CreateSegmentInput, UpdateSegmentInput };

// Récupérer tous les segments
// Note: L'API applique automatiquement le filtrage SBAC (scope-based)
// donc les utilisateurs ne voient que leurs segments assignés
export const useSegments = () => {
  const { user } = useAuth();

  return useQuery<Segment[]>({
    queryKey: ['segments', user?.id],
    queryFn: () => segmentsApi.getAll(),
    enabled: !!user, // Enabled si l'utilisateur est connecté
  });
};

// Récupérer un segment par ID
export const useSegment = (id: string) => {
  return useQuery<Segment | null>({
    queryKey: ['segments', id],
    queryFn: () => segmentsApi.getById(id),
    enabled: !!id,
  });
};

// Créer un nouveau segment
export const useCreateSegment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateSegmentInput) => {
      const id = uuidv4();
      return segmentsApi.create(id, data);
    },
    onSuccess: () => {
      // Invalidate all segment-related queries
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      queryClient.invalidateQueries({ queryKey: ['professor-segments'] });
      queryClient.invalidateQueries({ queryKey: ['gerant-segments'] });
      queryClient.invalidateQueries({ queryKey: ['professors-by-segment-city'] });
      // Invalidate cities since they reference segments
      queryClient.invalidateQueries({ queryKey: ['cities'] });
      // Invalidate professors since they have segment assignments
      queryClient.invalidateQueries({ queryKey: ['professors'] });
    },
  });
};

// Mettre à jour un segment
export const useUpdateSegment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateSegmentInput) => segmentsApi.update(data),
    onSuccess: () => {
      // Invalidate all segment-related queries
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      queryClient.invalidateQueries({ queryKey: ['professor-segments'] });
      queryClient.invalidateQueries({ queryKey: ['gerant-segments'] });
      queryClient.invalidateQueries({ queryKey: ['professors-by-segment-city'] });
      // Invalidate cities since they reference segments
      queryClient.invalidateQueries({ queryKey: ['cities'] });
      // Invalidate professors since they have segment assignments
      queryClient.invalidateQueries({ queryKey: ['professors'] });
      // Also invalidate calculation sheets that filter by segment
      queryClient.invalidateQueries({ queryKey: ['published-sheets-segment'] });
    },
  });
};

// Supprimer un segment
export const useDeleteSegment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => segmentsApi.delete(id),
    onSuccess: () => {
      // Invalidate all segment-related queries
      queryClient.invalidateQueries({ queryKey: ['segments'] });
      queryClient.invalidateQueries({ queryKey: ['professor-segments'] });
      queryClient.invalidateQueries({ queryKey: ['gerant-segments'] });
      queryClient.invalidateQueries({ queryKey: ['professors-by-segment-city'] });
      // Invalidate cities since they reference segments
      queryClient.invalidateQueries({ queryKey: ['cities'] });
      // Invalidate professors since they have segment assignments
      queryClient.invalidateQueries({ queryKey: ['professors'] });
      // Also invalidate declarations since they reference segments
      queryClient.invalidateQueries({ queryKey: ['professor-declarations'] });
      queryClient.invalidateQueries({ queryKey: ['gerant-declarations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-declarations'] });
      // And calculation sheets that filter by segment
      queryClient.invalidateQueries({ queryKey: ['published-sheets-segment'] });
    },
  });
};

// Upload logo pour un segment
export const useUploadSegmentLogo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ segmentId, file }: { segmentId: string; file: File }) =>
      segmentsApi.uploadLogo(segmentId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
    },
  });
};

// Supprimer logo d'un segment
export const useDeleteSegmentLogo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (segmentId: string) => segmentsApi.deleteLogo(segmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] });
    },
  });
};
