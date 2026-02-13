import { apiClient } from './client';
import type {
  FormationSession,
  FormationStats,
  AvailableStudent,
  EnrolledStudent,
  CreateSessionInput,
  UpdateSessionInput,
  EnrollStudentsInput,
} from '@/types/formations';

export const formationsApi = {
  // Sessions
  getSessions: () => apiClient.get<FormationSession[]>('/formations/sessions'),

  getSession: (id: string) => apiClient.get<FormationSession>(`/formations/sessions/${id}`),

  createSession: (data: CreateSessionInput) =>
    apiClient.post<FormationSession>('/formations/sessions', data),

  updateSession: (id: string, data: UpdateSessionInput) =>
    apiClient.put<FormationSession>(`/formations/sessions/${id}`, data),

  deleteSession: (id: string) =>
    apiClient.delete<{ message: string; session: FormationSession }>(`/formations/sessions/${id}`),

  // Students
  getSessionStudents: (sessionId: string) =>
    apiClient.get<EnrolledStudent[]>(`/formations/sessions/${sessionId}/students`),

  enrollStudents: (sessionId: string, data: EnrollStudentsInput) =>
    apiClient.post<{ message: string; enrollments: any[] }>(
      `/formations/sessions/${sessionId}/enroll`,
      data
    ),

  unenrollStudent: (sessionId: string, studentId: string) =>
    apiClient.delete<{ message: string }>(
      `/formations/sessions/${sessionId}/enroll/${studentId}`
    ),

  getAvailableStudents: (sessionId?: string) => {
    const params = sessionId ? `?session_id=${sessionId}` : '';
    return apiClient.get<AvailableStudent[]>(`/formations/available-students${params}`);
  },

  // Stats
  getStats: () => apiClient.get<FormationStats>('/formations/stats'),
};
