import { apiClient } from './client';

// ============================================
// Types
// ============================================

export interface VideoProgress {
  id: string;
  student_id: string;
  video_id: string;
  last_watched_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
  module_id?: string;
  video_title?: string;
}

export interface TestAttempt {
  id: string;
  student_id: string;
  test_id: string;
  score: number;
  total_points: number;
  passed: boolean;
  answers?: Record<string, string>;
  completed_at: string;
  created_at: string;
  module_id?: string;
  test_title?: string;
  passing_score?: number;
}

export interface FormationProgress {
  formation: {
    id: string;
    title: string;
    level?: string;
    passing_score_percentage: number;
  };
  video_progress: VideoProgress[];
  test_attempts: TestAttempt[];
  summary: {
    total_videos: number;
    completed_videos: number;
    total_tests: number;
    passed_tests: number;
    overall_progress: number;
  };
}

export interface TranscriptEntry {
  enrollment_id: string;
  enrolled_at: string;
  session_id: string;
  start_date: string;
  end_date: string;
  session_status: string;
  formation_id: string;
  formation_title: string;
  level?: string;
  passing_score_percentage: number;
  progress: {
    total_videos: number;
    completed_videos: number;
    total_tests: number;
    passed_tests: number;
    overall_progress: number;
  };
  test_scores: Array<{
    test_id: string;
    test_title: string;
    score: number;
    total_points: number;
    passed: boolean;
    completed_at: string;
  }>;
}

// ============================================
// API Functions
// ============================================

export const progressApi = {
  // Video progress
  async markVideoComplete(videoId: string): Promise<VideoProgress> {
    return apiClient.post<VideoProgress>(`/progress/videos/${videoId}/complete`, {});
  },

  async recordVideoWatch(videoId: string): Promise<VideoProgress> {
    return apiClient.post<VideoProgress>(`/progress/videos/${videoId}/watch`, {});
  },

  async getFormationVideoProgress(formationId: string): Promise<VideoProgress[]> {
    return apiClient.get<VideoProgress[]>(`/progress/formations/${formationId}/videos`);
  },

  // Test attempts
  async submitTestAttempt(testId: string, data: {
    answers: Record<string, string>;
    score: number;
    total_points: number;
    passed: boolean;
  }): Promise<TestAttempt> {
    return apiClient.post<TestAttempt>(`/progress/tests/${testId}/attempts`, data);
  },

  async getTestAttempts(testId: string): Promise<TestAttempt[]> {
    return apiClient.get<TestAttempt[]>(`/progress/tests/${testId}/attempts`);
  },

  async getFormationTestAttempts(formationId: string): Promise<TestAttempt[]> {
    return apiClient.get<TestAttempt[]>(`/progress/formations/${formationId}/tests`);
  },

  // Overall progress
  async getFormationProgress(formationId: string): Promise<FormationProgress> {
    return apiClient.get<FormationProgress>(`/progress/formations/${formationId}`);
  },

  async getStudentTranscript(studentId: string): Promise<TranscriptEntry[]> {
    return apiClient.get<TranscriptEntry[]>(`/progress/student/${studentId}/transcript`);
  },
};
