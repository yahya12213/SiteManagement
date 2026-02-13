/**
 * API Client pour les analytics
 */
import { apiClient } from './client';

export interface OverviewStats {
  students: {
    total: number;
  };
  formations: {
    total: number;
  };
  sessions: {
    total: number;
    active: number;
  };
  enrollments: {
    total: number;
    completed: number;
    completion_rate: number;
  };
  videos: {
    total: number;
    completed: number;
    completion_rate: number;
  };
  tests: {
    total: number;
    passed: number;
    success_rate: number;
  };
}

export interface PopularFormation {
  id: string;
  title: string;
  description: string;
  price: number | string;
  enrollment_count: number;
  completed_count: number;
  completion_rate: number;
}

export interface EnrollmentTrend {
  month: string; // Format: 'YYYY-MM'
  enrollment_count: number;
  completed_count: number;
}

export interface TestPerformance {
  formation_id: string;
  formation_title: string;
  test_id: string;
  test_title: string;
  total_attempts: number;
  passed_attempts: number;
  success_rate: number;
  avg_score: number;
  avg_total_points: number;
}

export interface ActiveStudent {
  id: string;
  full_name: string;
  email: string;
  enrollments_count: number;
  videos_watched: number;
  videos_completed: number;
  tests_taken: number;
  tests_passed: number;
}

export interface StudentEnrollmentDetail {
  formation_id: string;
  formation_title: string;
  enrolled_at: string;
  completed_at: string | null;
  status: string;
  total_videos: number;
  completed_videos: number;
  total_tests: number;
  passed_tests: number;
}

export interface TestHistoryItem {
  id: string;
  test_id: string;
  test_title: string;
  formation_title: string;
  score: number;
  total_points: number;
  passed: boolean;
  submitted_at: string;
}

export interface StudentProgress {
  student: {
    id: string;
    full_name: string;
    email: string;
    created_at: string;
  };
  enrollments: StudentEnrollmentDetail[];
  test_history: TestHistoryItem[];
}

export interface FormationCompletionRate {
  id: string;
  title: string;
  total_enrollments: number;
  completed_enrollments: number;
  completion_rate: number;
}

export interface PeriodStats {
  period_days: number;
  stats: {
    new_enrollments: number;
    completed_formations: number;
    videos_completed: number;
    tests_total: number;
    tests_passed: number;
  };
}

/**
 * API pour les analytics
 */
export const analyticsApi = {
  /**
   * Récupérer les statistiques générales
   */
  getOverview: async (): Promise<{ success: boolean; overview: OverviewStats }> => {
    return apiClient.get('/analytics/overview');
  },

  /**
   * Récupérer les formations les plus populaires
   */
  getPopularFormations: async (limit: number = 10): Promise<{ success: boolean; formations: PopularFormation[] }> => {
    return apiClient.get('/analytics/popular-formations', { limit: limit.toString() });
  },

  /**
   * Récupérer les tendances d'inscriptions
   */
  getEnrollmentTrends: async (months: number = 6): Promise<{ success: boolean; trends: EnrollmentTrend[] }> => {
    return apiClient.get('/analytics/enrollment-trends', { months: months.toString() });
  },

  /**
   * Récupérer la performance des tests
   */
  getTestPerformance: async (): Promise<{ success: boolean; test_performance: TestPerformance[] }> => {
    return apiClient.get('/analytics/test-performance');
  },

  /**
   * Récupérer les étudiants les plus actifs
   */
  getActiveStudents: async (limit: number = 10): Promise<{ success: boolean; students: ActiveStudent[] }> => {
    return apiClient.get('/analytics/active-students', { limit: limit.toString() });
  },

  /**
   * Récupérer la progression d'un étudiant
   */
  getStudentProgress: async (studentId: string): Promise<StudentProgress> => {
    const response = await apiClient.get<{ success: boolean } & StudentProgress>(
      `/analytics/student-progress/${studentId}`
    );
    return {
      student: response.student,
      enrollments: response.enrollments,
      test_history: response.test_history,
    };
  },

  /**
   * Récupérer les taux de complétion par formation
   */
  getFormationCompletionRates: async (): Promise<{ success: boolean; data: FormationCompletionRate[] }> => {
    return apiClient.get('/analytics/formation-completion-rates');
  },

  /**
   * Récupérer les statistiques sur une période
   */
  getPeriodStats: async (days: number = 30): Promise<PeriodStats> => {
    const response = await apiClient.get<{ success: boolean } & PeriodStats>(
      '/analytics/period-stats',
      { period: days.toString() }
    );
    return {
      period_days: response.period_days,
      stats: response.stats,
    };
  },
};
