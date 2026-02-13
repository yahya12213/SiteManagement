/**
 * Hooks React Query - Gestion des prospects
 * Includes realtime synchronization via broadcast
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { prospectsApi, type ProspectFilters, type CreateProspectInput, type UpdateProspectInput, type ImportLine, type EndCallData } from '../lib/api/prospects';
import { useRealtime } from '@/contexts/RealtimeContext';

// ============================================================
// QUERY HOOKS
// ============================================================

/**
 * Hook pour récupérer la liste des prospects
 */
export const useProspects = (filters?: ProspectFilters) => {
  return useQuery({
    queryKey: ['prospects', filters],
    queryFn: () => prospectsApi.getAll(filters),
    refetchInterval: 30000, // Polling toutes les 30 secondes pour mise à jour temps réel
  });
};

/**
 * Hook pour récupérer un prospect par ID
 */
export const useProspect = (id: string) => {
  return useQuery({
    queryKey: ['prospects', id],
    queryFn: () => prospectsApi.getById(id),
    enabled: !!id,
  });
};

/**
 * Hook pour récupérer les pays supportés
 */
export const useCountryCodes = () => {
  return useQuery({
    queryKey: ['country-codes'],
    queryFn: () => prospectsApi.getCountryCodes(),
  });
};

/**
 * Hook pour récupérer les stats de nettoyage
 */
export const useCleaningStats = () => {
  return useQuery({
    queryKey: ['prospects', 'cleaning-stats'],
    queryFn: () => prospectsApi.getCleaningStats(),
  });
};

/**
 * Hook pour récupérer les prospects à supprimer
 */
export const useProspectsToDelete = (limit = 100, offset = 0) => {
  return useQuery({
    queryKey: ['prospects', 'to-delete', limit, offset],
    queryFn: () => prospectsApi.getProspectsToDelete(limit, offset),
  });
};

// ============================================================
// MUTATION HOOKS
// ============================================================

/**
 * Hook pour créer un nouveau prospect
 * Broadcasts to other clients for realtime sync
 */
export const useCreateProspect = () => {
  const queryClient = useQueryClient();
  const { broadcast } = useRealtime();

  return useMutation({
    mutationFn: (data: CreateProspectInput) => prospectsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      broadcast('prospects'); // Notify other clients
    },
  });
};

/**
 * Hook pour mettre à jour un prospect
 * Broadcasts to other clients for realtime sync
 */
export const useUpdateProspect = () => {
  const queryClient = useQueryClient();
  const { broadcast } = useRealtime();

  return useMutation({
    mutationFn: (data: UpdateProspectInput) => prospectsApi.update(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['prospects', variables.id] });
      broadcast('prospects'); // Notify other clients
    },
  });
};

/**
 * Hook pour supprimer un prospect
 * Broadcasts to other clients for realtime sync
 */
export const useDeleteProspect = () => {
  const queryClient = useQueryClient();
  const { broadcast } = useRealtime();

  return useMutation({
    mutationFn: (id: string) => prospectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      broadcast('prospects'); // Notify other clients
    },
  });
};

/**
 * Hook pour importer des prospects en masse
 * Broadcasts to other clients for realtime sync
 */
export const useImportProspects = () => {
  const queryClient = useQueryClient();
  const { broadcast } = useRealtime();

  return useMutation({
    mutationFn: ({ segment_id, lines }: { segment_id: string; lines: ImportLine[] }) =>
      prospectsApi.importBatch(segment_id, lines),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      broadcast('prospects'); // Notify other clients
    },
  });
};

/**
 * Hook pour démarrer un appel
 */
export const useStartCall = () => {
  return useMutation({
    mutationFn: (id: string) => prospectsApi.startCall(id),
  });
};

/**
 * Hook pour terminer un appel
 * Broadcasts to other clients for realtime sync
 */
export const useEndCall = () => {
  const queryClient = useQueryClient();
  const { broadcast } = useRealtime();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: EndCallData }) =>
      prospectsApi.endCall(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['prospects', variables.id] });
      broadcast('prospects'); // Notify other clients
    },
  });
};

/**
 * Hook pour réinjecter un prospect
 * Broadcasts to other clients for realtime sync
 */
export const useReinjectProspect = () => {
  const queryClient = useQueryClient();
  const { broadcast } = useRealtime();

  return useMutation({
    mutationFn: (id: string) => prospectsApi.reinject(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['prospects', id] });
      broadcast('prospects'); // Notify other clients
    },
  });
};

/**
 * Hook pour lancer le nettoyage batch
 * Broadcasts to other clients for realtime sync
 */
export const useBatchClean = () => {
  const queryClient = useQueryClient();
  const { broadcast } = useRealtime();

  return useMutation({
    mutationFn: (executeDeletion: boolean) => prospectsApi.batchClean(executeDeletion),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      queryClient.invalidateQueries({ queryKey: ['prospects', 'cleaning-stats'] });
      queryClient.invalidateQueries({ queryKey: ['prospects', 'to-delete'] });
      broadcast('prospects'); // Notify other clients
    },
  });
};
