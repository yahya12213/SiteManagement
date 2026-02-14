/**
 * Realtime Mutation Hook
 *
 * Wrapper around useMutation that automatically broadcasts changes
 * to other connected clients via the RealtimeContext.
 *
 * Usage:
 * const mutation = useRealtimeMutation({
 *   mutationFn: (data) => api.create(data),
 *   channel: 'prospects',
 *   onSuccess: () => { ... }
 * });
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRealtime } from '@/contexts/RealtimeContext';
import type { RealtimeChannel } from '@/contexts/RealtimeContext';

interface RealtimeMutationOptions<TData, TVariables> {
  // Mutation function
  mutationFn: (variables: TVariables) => Promise<TData>;
  // Channel to broadcast the change to
  channel: RealtimeChannel;
  // Original onSuccess callback
  onSuccess?: (data: TData, variables: TVariables) => void;
  // Query keys to invalidate locally
  invalidateKeys?: string[][];
}

/**
 * Hook that wraps useMutation with realtime broadcasting
 */
export function useRealtimeMutation<TData = unknown, TVariables = void>(
  options: RealtimeMutationOptions<TData, TVariables>
) {
  const { broadcast } = useRealtime();
  const queryClient = useQueryClient();
  const { channel, onSuccess, invalidateKeys, mutationFn } = options;

  return useMutation({
    mutationFn,
    onSuccess: (data: TData, variables: TVariables) => {
      // Invalidate local queries
      if (invalidateKeys) {
        invalidateKeys.forEach(key => {
          queryClient.invalidateQueries({ queryKey: key });
        });
      }

      // Broadcast to other clients
      broadcast(channel);

      // Call original onSuccess if provided
      if (onSuccess) {
        onSuccess(data, variables);
      }
    },
  });
}

/**
 * Utility to create a mutation with realtime broadcast
 * Can be used in existing hooks without full refactor
 */
export function withRealtimeBroadcast<TData, TVariables>(
  mutationResult: {
    mutateAsync: (variables: TVariables) => Promise<TData>;
    [key: string]: unknown;
  },
  channel: RealtimeChannel,
  broadcast: (channel: RealtimeChannel) => void
) {
  const originalMutateAsync = mutationResult.mutateAsync;

  return {
    ...mutationResult,
    mutateAsync: async (variables: TVariables) => {
      const result = await originalMutateAsync(variables);
      broadcast(channel);
      return result;
    },
  };
}
