import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { progressApi } from '@/lib/api/progress';
import type {
  VideoProgress,
  TestAttempt,
  FormationProgress,
  TranscriptEntry,
} from '@/lib/api/progress';

// ============================================
// Video Progress Hooks
// ============================================

export function useMarkVideoComplete() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (videoId: string) => progressApi.markVideoComplete(videoId),
    onSuccess: () => {
      // Invalidate all progress queries that might be affected
      queryClient.invalidateQueries({ queryKey: ['video-progress'] });
      queryClient.invalidateQueries({ queryKey: ['formation-progress'] });
    },
  });
}

export function useRecordVideoWatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (videoId: string) => progressApi.recordVideoWatch(videoId),
    onSuccess: () => {
      // Optionally invalidate queries (lighter touch than markComplete)
      queryClient.invalidateQueries({ queryKey: ['video-progress'] });
    },
  });
}

export function useFormationVideoProgress(formationId: string | undefined) {
  return useQuery<VideoProgress[]>({
    queryKey: ['video-progress', formationId],
    queryFn: () => {
      if (!formationId) throw new Error('Formation ID required');
      return progressApi.getFormationVideoProgress(formationId);
    },
    enabled: !!formationId,
  });
}

// ============================================
// Test Attempt Hooks
// ============================================

export function useSubmitTestAttempt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      testId,
      data,
    }: {
      testId: string;
      data: {
        answers: Record<string, string>;
        score: number;
        total_points: number;
        passed: boolean;
      };
    }) => progressApi.submitTestAttempt(testId, data),
    onSuccess: (_, variables) => {
      // Invalidate test attempts and overall progress
      queryClient.invalidateQueries({ queryKey: ['test-attempts', variables.testId] });
      queryClient.invalidateQueries({ queryKey: ['test-attempts-formation'] });
      queryClient.invalidateQueries({ queryKey: ['formation-progress'] });
      queryClient.invalidateQueries({ queryKey: ['transcript'] });
    },
  });
}

export function useTestAttempts(testId: string | undefined) {
  return useQuery<TestAttempt[]>({
    queryKey: ['test-attempts', testId],
    queryFn: () => {
      if (!testId) throw new Error('Test ID required');
      return progressApi.getTestAttempts(testId);
    },
    enabled: !!testId,
  });
}

export function useFormationTestAttempts(formationId: string | undefined) {
  return useQuery<TestAttempt[]>({
    queryKey: ['test-attempts-formation', formationId],
    queryFn: () => {
      if (!formationId) throw new Error('Formation ID required');
      return progressApi.getFormationTestAttempts(formationId);
    },
    enabled: !!formationId,
  });
}

// ============================================
// Overall Progress Hooks
// ============================================

export function useFormationProgress(formationId: string | undefined) {
  return useQuery<FormationProgress>({
    queryKey: ['formation-progress', formationId],
    queryFn: () => {
      if (!formationId) throw new Error('Formation ID required');
      return progressApi.getFormationProgress(formationId);
    },
    enabled: !!formationId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useStudentTranscript(studentId: string | undefined) {
  return useQuery<TranscriptEntry[]>({
    queryKey: ['transcript', studentId],
    queryFn: () => {
      if (!studentId) throw new Error('Student ID required');
      return progressApi.getStudentTranscript(studentId);
    },
    enabled: !!studentId,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}
