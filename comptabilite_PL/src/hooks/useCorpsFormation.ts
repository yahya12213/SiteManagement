/**
 * React Query hooks pour Corps de Formation
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { corpsFormationApi } from '@/lib/api/corps-formation';
import type {
  CreateCorpsFormationDto,
  UpdateCorpsFormationDto
} from '@/types/corps-formation';

// Query keys
export const corpsFormationKeys = {
  all: ['corps-formation'] as const,
  lists: () => [...corpsFormationKeys.all, 'list'] as const,
  list: () => [...corpsFormationKeys.lists()] as const,
  details: () => [...corpsFormationKeys.all, 'detail'] as const,
  detail: (id: string) => [...corpsFormationKeys.details(), id] as const,
  stats: () => [...corpsFormationKeys.all, 'stats'] as const,
  formations: (corpsId: string) => [...corpsFormationKeys.detail(corpsId), 'formations'] as const,
};

/**
 * Hook pour récupérer tous les corps de formation
 */
export function useCorpsFormation() {
  return useQuery({
    queryKey: corpsFormationKeys.list(),
    queryFn: () => corpsFormationApi.getAll(),
  });
}

/**
 * Hook pour récupérer un corps de formation par ID
 */
export function useCorpsFormationById(id: string) {
  return useQuery({
    queryKey: corpsFormationKeys.detail(id),
    queryFn: () => corpsFormationApi.getById(id),
    enabled: !!id,
  });
}

/**
 * Hook pour récupérer les formations unitaires d'un corps
 */
export function useFormationsByCorps(corpsId: string) {
  return useQuery({
    queryKey: corpsFormationKeys.formations(corpsId),
    queryFn: () => corpsFormationApi.getFormationsByCorps(corpsId),
    enabled: !!corpsId,
  });
}

/**
 * Hook pour récupérer les statistiques
 */
export function useCorpsFormationStats() {
  return useQuery({
    queryKey: corpsFormationKeys.stats(),
    queryFn: () => corpsFormationApi.getStats(),
  });
}

/**
 * Hook pour créer un corps de formation
 */
export function useCreateCorpsFormation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCorpsFormationDto) => corpsFormationApi.create(data),
    onSuccess: () => {
      // Invalider le cache pour forcer le rechargement
      queryClient.invalidateQueries({ queryKey: corpsFormationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: corpsFormationKeys.stats() });
    },
  });
}

/**
 * Hook pour modifier un corps de formation
 */
export function useUpdateCorpsFormation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCorpsFormationDto }) =>
      corpsFormationApi.update(id, data),
    onSuccess: (_, variables) => {
      // Invalider le cache
      queryClient.invalidateQueries({ queryKey: corpsFormationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: corpsFormationKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: corpsFormationKeys.stats() });
    },
  });
}

/**
 * Hook pour supprimer un corps de formation
 */
export function useDeleteCorpsFormation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => corpsFormationApi.delete(id),
    onSuccess: () => {
      // Invalider le cache
      queryClient.invalidateQueries({ queryKey: corpsFormationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: corpsFormationKeys.stats() });
    },
  });
}

/**
 * Hook pour dupliquer un corps de formation
 */
export function useDuplicateCorpsFormation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, options }: { id: string; options?: { include_formations?: boolean } }) =>
      corpsFormationApi.duplicate(id, options),
    onSuccess: () => {
      // Invalider le cache pour forcer le rechargement
      queryClient.invalidateQueries({ queryKey: corpsFormationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: corpsFormationKeys.stats() });
    },
  });
}
