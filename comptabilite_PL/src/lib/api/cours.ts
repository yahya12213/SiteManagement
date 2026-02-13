import { apiClient } from './client';
import type {
  Formation,
  FormationModule,
  ModuleVideo,
  ModuleTest,
  TestQuestion,
  QuestionChoice,
  CoursStats,
  CreateFormationInput,
  UpdateFormationInput,
  CreateModuleInput,
  UpdateModuleInput,
  CreateVideoInput,
  UpdateVideoInput,
  CreateTestInput,
  UpdateTestInput,
  CreateQuestionInput,
  UpdateQuestionInput,
  CreateChoiceInput,
  UpdateChoiceInput,
  FormationTemplate,
  DocumentType,
} from '@/types/cours';

export const coursApi = {
  // ============================================
  // Formations
  // ============================================
  getFormations: () => apiClient.get<Formation[]>('/cours/formations'),

  getFormation: (id: string) => apiClient.get<Formation>(`/cours/formations/${id}`),

  createFormation: (data: CreateFormationInput) =>
    apiClient.post<Formation>('/cours/formations', data),

  updateFormation: (id: string, data: UpdateFormationInput) =>
    apiClient.put<Formation>(`/cours/formations/${id}`, data),

  deleteFormation: (id: string) =>
    apiClient.delete<{ message: string; formation: Formation }>(`/cours/formations/${id}`),

  checkOnlineAccess: (formationId: string) =>
    apiClient.get<{ success: boolean; hasOnlineAccess: boolean; message: string }>(
      `/cours/formations/${formationId}/check-online-access`
    ),

  // ============================================
  // Modules
  // ============================================
  getModules: (formationId: string) =>
    apiClient.get<FormationModule[]>(`/cours/formations/${formationId}/modules`),

  createModule: (formationId: string, data: CreateModuleInput) =>
    apiClient.post<FormationModule>(`/cours/formations/${formationId}/modules`, data),

  updateModule: (id: string, data: UpdateModuleInput) =>
    apiClient.put<FormationModule>(`/cours/modules/${id}`, data),

  deleteModule: (id: string) =>
    apiClient.delete<{ message: string; module: FormationModule }>(`/cours/modules/${id}`),

  reorderModule: (id: string, new_order_index: number) =>
    apiClient.put<FormationModule>(`/cours/modules/${id}/reorder`, { new_order_index }),

  // ============================================
  // Vidéos
  // ============================================
  createVideo: (moduleId: string, data: CreateVideoInput) =>
    apiClient.post<ModuleVideo>(`/cours/modules/${moduleId}/videos`, data),

  updateVideo: (id: string, data: UpdateVideoInput) =>
    apiClient.put<ModuleVideo>(`/cours/videos/${id}`, data),

  deleteVideo: (id: string) =>
    apiClient.delete<{ message: string; video: ModuleVideo }>(`/cours/videos/${id}`),

  // ============================================
  // Tests
  // ============================================
  createTest: (moduleId: string, data: CreateTestInput) =>
    apiClient.post<ModuleTest>(`/cours/modules/${moduleId}/tests`, data),

  getTest: (id: string) => apiClient.get<ModuleTest>(`/cours/tests/${id}`),

  updateTest: (id: string, data: UpdateTestInput) =>
    apiClient.put<ModuleTest>(`/cours/tests/${id}`, data),

  deleteTest: (id: string) =>
    apiClient.delete<{ message: string; test: ModuleTest }>(`/cours/tests/${id}`),

  // ============================================
  // Questions
  // ============================================
  createQuestion: (testId: string, data: CreateQuestionInput) =>
    apiClient.post<TestQuestion>(`/cours/tests/${testId}/questions`, data),

  updateQuestion: (id: string, data: UpdateQuestionInput) =>
    apiClient.put<TestQuestion>(`/cours/questions/${id}`, data),

  deleteQuestion: (id: string) =>
    apiClient.delete<{ message: string; question: TestQuestion }>(`/cours/questions/${id}`),

  // ============================================
  // Choix de réponse
  // ============================================
  createChoice: (questionId: string, data: CreateChoiceInput) =>
    apiClient.post<QuestionChoice>(`/cours/questions/${questionId}/choices`, data),

  updateChoice: (id: string, data: UpdateChoiceInput) =>
    apiClient.put<QuestionChoice>(`/cours/choices/${id}`, data),

  deleteChoice: (id: string) =>
    apiClient.delete<{ message: string; choice: QuestionChoice }>(`/cours/choices/${id}`),

  // ============================================
  // Statistiques
  // ============================================
  getStats: () => apiClient.get<CoursStats>('/cours/stats'),

  // ============================================
  // Formation Templates (Multi-template support)
  // ============================================
  getFormationTemplates: (formationId: string) =>
    apiClient.get<FormationTemplate[]>(`/formations/${formationId}/templates`),

  addFormationTemplates: (
    formationId: string,
    template_ids: string[],
    document_type: DocumentType = 'certificat'
  ) =>
    apiClient.post<{ success: boolean; templates: FormationTemplate[] }>(
      `/formations/${formationId}/templates`,
      { template_ids, document_type }
    ),

  removeFormationTemplate: (formationId: string, templateId: string) =>
    apiClient.delete<{ success: boolean }>(
      `/formations/${formationId}/templates/${templateId}`
    ),

  setDefaultTemplate: (formationId: string, templateId: string) =>
    apiClient.put<{ success: boolean }>(
      `/formations/${formationId}/templates/${templateId}/default`,
      {}
    ),

  syncFormationTemplates: (formationId: string, template_ids: string[]) =>
    apiClient.put<{
      success: boolean;
      added: number;
      removed: number;
      total: number;
      packs_updated: number;
    }>(`/formations/${formationId}/templates/sync`, { template_ids }),

  // ============================================
  // Duplication
  // ============================================
  duplicateFormation: async (
    id: string,
    options?: { include_modules?: boolean }
  ): Promise<{
    formation: Formation;
    duplicated_modules_count: number;
  }> => {
    const response = await apiClient.post<{
      success: boolean;
      formation: Formation;
      duplicated_modules_count: number;
      message: string;
    }>(`/cours/formations/${id}/duplicate`, options || {});
    return {
      formation: response.formation,
      duplicated_modules_count: response.duplicated_modules_count
    };
  },
};
