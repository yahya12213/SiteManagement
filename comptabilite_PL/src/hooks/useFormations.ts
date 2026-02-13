import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formationsApi } from '@/lib/api/formations';
import type {
  CreateSessionInput,
  UpdateSessionInput,
  EnrollStudentsInput,
} from '@/types/formations';

// Query keys
export const formationKeys = {
  all: ['formations'] as const,
  sessions: () => [...formationKeys.all, 'sessions'] as const,
  session: (id: string) => [...formationKeys.all, 'session', id] as const,
  sessionStudents: (id: string) => [...formationKeys.all, 'session', id, 'students'] as const,
  availableStudents: (sessionId?: string) =>
    [...formationKeys.all, 'available-students', sessionId || 'all'] as const,
  stats: () => [...formationKeys.all, 'stats'] as const,
};

// Sessions queries
export function useSessions() {
  return useQuery({
    queryKey: formationKeys.sessions(),
    queryFn: formationsApi.getSessions,
  });
}

export function useSession(id: string) {
  return useQuery({
    queryKey: formationKeys.session(id),
    queryFn: () => formationsApi.getSession(id),
    enabled: !!id,
  });
}

export function useSessionStudents(sessionId: string) {
  return useQuery({
    queryKey: formationKeys.sessionStudents(sessionId),
    queryFn: () => formationsApi.getSessionStudents(sessionId),
    enabled: !!sessionId,
  });
}

export function useAvailableStudents(sessionId?: string) {
  return useQuery({
    queryKey: formationKeys.availableStudents(sessionId),
    queryFn: () => formationsApi.getAvailableStudents(sessionId),
  });
}

export function useFormationStats() {
  return useQuery({
    queryKey: formationKeys.stats(),
    queryFn: formationsApi.getStats,
  });
}

// Mutations
export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSessionInput) => formationsApi.createSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: formationKeys.sessions() });
      queryClient.invalidateQueries({ queryKey: formationKeys.stats() });
    },
  });
}

export function useUpdateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSessionInput }) =>
      formationsApi.updateSession(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: formationKeys.sessions() });
      queryClient.invalidateQueries({ queryKey: formationKeys.session(variables.id) });
      queryClient.invalidateQueries({ queryKey: formationKeys.stats() });
    },
  });
}

export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => formationsApi.deleteSession(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: formationKeys.sessions() });
      queryClient.invalidateQueries({ queryKey: formationKeys.stats() });
    },
  });
}

export function useEnrollStudents() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, data }: { sessionId: string; data: EnrollStudentsInput }) =>
      formationsApi.enrollStudents(sessionId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: formationKeys.session(variables.sessionId) });
      queryClient.invalidateQueries({
        queryKey: formationKeys.sessionStudents(variables.sessionId),
      });
      queryClient.invalidateQueries({ queryKey: formationKeys.sessions() });
      queryClient.invalidateQueries({ queryKey: formationKeys.availableStudents() });
      queryClient.invalidateQueries({ queryKey: formationKeys.stats() });
    },
  });
}

export function useUnenrollStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, studentId }: { sessionId: string; studentId: string }) =>
      formationsApi.unenrollStudent(sessionId, studentId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: formationKeys.session(variables.sessionId) });
      queryClient.invalidateQueries({
        queryKey: formationKeys.sessionStudents(variables.sessionId),
      });
      queryClient.invalidateQueries({ queryKey: formationKeys.sessions() });
      queryClient.invalidateQueries({ queryKey: formationKeys.availableStudents() });
      queryClient.invalidateQueries({ queryKey: formationKeys.stats() });
    },
  });
}
