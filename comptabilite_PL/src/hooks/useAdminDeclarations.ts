import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { declarationsApi } from '@/lib/api/declarations';
import type { Declaration } from '@/lib/api/declarations';

export type AdminDeclaration = Declaration;

// Hook pour récupérer toutes les déclarations (admin)
export function useAdminDeclarations(status?: string) {
  return useQuery({
    queryKey: ['admin-declarations', status],
    queryFn: async () => {
      const declarations = await declarationsApi.getAll();

      // Filtrer par statut si fourni
      if (status && status !== 'all') {
        return declarations.filter(d => d.status === status);
      }

      return declarations;
    },
    refetchInterval: 30000, // Polling toutes les 30 secondes pour mise à jour temps réel
  });
}

// Hook pour approuver une déclaration
export function useApproveDeclaration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return declarationsApi.update({
        id,
        status: 'approuvee',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-declarations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-declaration'] });
    },
  });
}

// Hook pour rejeter une déclaration
export function useRejectDeclaration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return declarationsApi.update({
        id,
        status: 'refusee',
        rejection_reason: reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-declarations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-declaration'] });
    },
  });
}

// Hook pour demander des modifications
export function useRequestModifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const declaration = await declarationsApi.getById(id);
      if (!declaration) throw new Error('Déclaration non trouvée');

      return declarationsApi.update({
        id,
        form_data: declaration.form_data,
        status: 'en_cours',
        rejection_reason: reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-declarations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-declaration'] });
    },
  });
}

// Hook pour récupérer une déclaration par ID
export function useAdminDeclaration(id: string) {
  return useQuery({
    queryKey: ['admin-declaration', id],
    queryFn: () => declarationsApi.getById(id),
    enabled: !!id,
  });
}

// Alias pour compatibilité avec les composants
export const useRequestModification = useRequestModifications;

// Hook pour supprimer une déclaration
export function useDeleteAdminDeclaration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => declarationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-declarations'] });
    },
  });
}

// Hook pour récupérer les statistiques des déclarations
export function useDeclarationStats() {
  return useQuery({
    queryKey: ['declaration-stats'],
    queryFn: async () => {
      const declarations = await declarationsApi.getAll();

      return {
        total: declarations.length,
        soumises: declarations.filter(d => d.status === 'soumise').length,
        en_cours: declarations.filter(d => d.status === 'en_cours').length,
        approuvees: declarations.filter(d => d.status === 'approuvee').length,
        refusees: declarations.filter(d => d.status === 'refusee').length,
        brouillon: declarations.filter(d => d.status === 'brouillon').length,
        a_declarer: declarations.filter(d => d.status === 'a_declarer').length,
      };
    },
    refetchInterval: 30000, // Polling toutes les 30 secondes
  });
}

// Hook pour modifier les métadonnées d'une déclaration (admin seulement)
export function useUpdateDeclarationMetadata() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: string;
      segment_id?: string;
      city_id?: string;
      start_date?: string;
      end_date?: string;
      status?: Declaration['status'];
    }) => {
      return declarationsApi.update(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-declarations'] });
      queryClient.invalidateQueries({ queryKey: ['admin-declaration'] });
      queryClient.invalidateQueries({ queryKey: ['professor-declarations'] });
    },
  });
}
