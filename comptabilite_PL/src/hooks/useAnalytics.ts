/**
 * Hooks React Query pour les analytics
 */
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import {
  analyticsApi,
  type OverviewStats,
  type PopularFormation,
  type EnrollmentTrend,
  type TestPerformance,
  type ActiveStudent,
  type StudentProgress,
  type FormationCompletionRate,
  type PeriodStats,
} from '@/lib/api/analytics';

/**
 * Hook pour récupérer les statistiques générales
 */
export const useOverviewStats = (): UseQueryResult<{ success: boolean; overview: OverviewStats }> => {
  return useQuery({
    queryKey: ['analytics', 'overview'],
    queryFn: analyticsApi.getOverview,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 60 * 5, // Refresh automatique toutes les 5 minutes
  });
};

/**
 * Hook pour récupérer les formations populaires
 */
export const usePopularFormations = (limit: number = 10): UseQueryResult<{ success: boolean; formations: PopularFormation[] }> => {
  return useQuery({
    queryKey: ['analytics', 'popular-formations', limit],
    queryFn: () => analyticsApi.getPopularFormations(limit),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

/**
 * Hook pour récupérer les tendances d'inscriptions
 */
export const useEnrollmentTrends = (months: number = 6): UseQueryResult<{ success: boolean; trends: EnrollmentTrend[] }> => {
  return useQuery({
    queryKey: ['analytics', 'enrollment-trends', months],
    queryFn: () => analyticsApi.getEnrollmentTrends(months),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

/**
 * Hook pour récupérer la performance des tests
 */
export const useTestPerformance = (): UseQueryResult<{ success: boolean; test_performance: TestPerformance[] }> => {
  return useQuery({
    queryKey: ['analytics', 'test-performance'],
    queryFn: analyticsApi.getTestPerformance,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

/**
 * Hook pour récupérer les étudiants actifs
 */
export const useActiveStudents = (limit: number = 10): UseQueryResult<{ success: boolean; students: ActiveStudent[] }> => {
  return useQuery({
    queryKey: ['analytics', 'active-students', limit],
    queryFn: () => analyticsApi.getActiveStudents(limit),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Hook pour récupérer la progression d'un étudiant
 */
export const useStudentProgress = (studentId: string | null): UseQueryResult<StudentProgress> => {
  return useQuery({
    queryKey: ['analytics', 'student-progress', studentId],
    queryFn: () => {
      if (!studentId) {
        throw new Error('Student ID is required');
      }
      return analyticsApi.getStudentProgress(studentId);
    },
    enabled: !!studentId, // N'exécute la query que si studentId est fourni
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Hook pour récupérer les taux de complétion par formation
 */
export const useFormationCompletionRates = (): UseQueryResult<{ success: boolean; data: FormationCompletionRate[] }> => {
  return useQuery({
    queryKey: ['analytics', 'formation-completion-rates'],
    queryFn: analyticsApi.getFormationCompletionRates,
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
};

/**
 * Hook pour récupérer les statistiques sur une période
 */
export const usePeriodStats = (days: number = 30): UseQueryResult<PeriodStats> => {
  return useQuery({
    queryKey: ['analytics', 'period-stats', days],
    queryFn: () => analyticsApi.getPeriodStats(days),
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchInterval: 1000 * 60 * 5, // Refresh automatique toutes les 5 minutes
  });
};
