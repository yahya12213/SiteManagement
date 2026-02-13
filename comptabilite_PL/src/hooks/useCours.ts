import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { coursApi } from '@/lib/api/cours';
import type {
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
  DocumentType,
} from '@/types/cours';

// ============================================
// Query Keys
// ============================================
export const coursKeys = {
  all: ['cours'] as const,
  formations: () => [...coursKeys.all, 'formations'] as const,
  formation: (id: string) => [...coursKeys.formations(), id] as const,
  formationTemplates: (formationId: string) => [...coursKeys.all, 'formation-templates', formationId] as const,
  modules: (formationId: string) => [...coursKeys.all, 'modules', formationId] as const,
  test: (id: string) => [...coursKeys.all, 'test', id] as const,
  stats: () => [...coursKeys.all, 'stats'] as const,
};

// ============================================
// Formations Hooks
// ============================================

/**
 * Récupère toutes les formations
 */
export function useFormations() {
  return useQuery({
    queryKey: coursKeys.formations(),
    queryFn: () => coursApi.getFormations(),
  });
}

/**
 * Récupère une formation avec tous ses modules, vidéos et tests
 */
export function useFormation(id: string | undefined) {
  return useQuery({
    queryKey: coursKeys.formation(id!),
    queryFn: () => coursApi.getFormation(id!),
    enabled: !!id,
  });
}

/**
 * Vérifie si l'étudiant a accès au contenu en ligne d'une formation
 */
export function useCheckOnlineAccess(formationId: string | undefined) {
  return useQuery({
    queryKey: [...coursKeys.formation(formationId!), 'online-access'] as const,
    queryFn: async () => {
      const response = await coursApi.checkOnlineAccess(formationId!);
      return response;
    },
    enabled: !!formationId,
  });
}

/**
 * Crée une nouvelle formation
 */
export function useCreateFormation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateFormationInput) => coursApi.createFormation(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coursKeys.formations() });
      queryClient.invalidateQueries({ queryKey: coursKeys.stats() });
    },
  });
}

/**
 * Met à jour une formation
 */
export function useUpdateFormation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFormationInput }) =>
      coursApi.updateFormation(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: coursKeys.formations() });
      queryClient.invalidateQueries({ queryKey: coursKeys.formation(id) });
    },
  });
}

/**
 * Supprime une formation
 */
export function useDeleteFormation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => coursApi.deleteFormation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coursKeys.formations() });
      queryClient.invalidateQueries({ queryKey: coursKeys.stats() });
    },
  });
}

// ============================================
// Formation Templates Hooks (Multi-template support)
// ============================================

/**
 * Récupère tous les templates associés à une formation
 */
export function useFormationTemplates(formationId: string | undefined) {
  return useQuery({
    queryKey: coursKeys.formationTemplates(formationId!),
    queryFn: () => coursApi.getFormationTemplates(formationId!),
    enabled: !!formationId,
  });
}

/**
 * Ajoute des templates à une formation
 */
export function useAddFormationTemplates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      formationId,
      template_ids,
      document_type = 'certificat',
    }: {
      formationId: string;
      template_ids: string[];
      document_type?: DocumentType;
    }) => coursApi.addFormationTemplates(formationId, template_ids, document_type),
    onSuccess: (_, { formationId }) => {
      queryClient.invalidateQueries({ queryKey: coursKeys.formationTemplates(formationId) });
      queryClient.invalidateQueries({ queryKey: coursKeys.formation(formationId) });
      queryClient.invalidateQueries({ queryKey: coursKeys.formations() });
    },
  });
}

/**
 * Supprime un template d'une formation
 */
export function useRemoveFormationTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      formationId,
      templateId,
    }: {
      formationId: string;
      templateId: string;
    }) => coursApi.removeFormationTemplate(formationId, templateId),
    onSuccess: (_, { formationId }) => {
      queryClient.invalidateQueries({ queryKey: coursKeys.formationTemplates(formationId) });
      queryClient.invalidateQueries({ queryKey: coursKeys.formation(formationId) });
      queryClient.invalidateQueries({ queryKey: coursKeys.formations() });
    },
  });
}

/**
 * Synchronise les templates d'une formation (ajoute les nouveaux, supprime les anciens)
 */
export function useSyncFormationTemplates() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      formationId,
      template_ids,
    }: {
      formationId: string;
      template_ids: string[];
    }) => coursApi.syncFormationTemplates(formationId, template_ids),
    onSuccess: (_, { formationId }) => {
      queryClient.invalidateQueries({ queryKey: coursKeys.formationTemplates(formationId) });
      queryClient.invalidateQueries({ queryKey: coursKeys.formation(formationId) });
      queryClient.invalidateQueries({ queryKey: coursKeys.formations() });
    },
  });
}

/**
 * Définit un template comme default pour une formation
 */
export function useSetDefaultTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      formationId,
      templateId,
    }: {
      formationId: string;
      templateId: string;
    }) => coursApi.setDefaultTemplate(formationId, templateId),
    onSuccess: (_, { formationId }) => {
      queryClient.invalidateQueries({ queryKey: coursKeys.formationTemplates(formationId) });
      queryClient.invalidateQueries({ queryKey: coursKeys.formation(formationId) });
      queryClient.invalidateQueries({ queryKey: coursKeys.formations() });
    },
  });
}

/**
 * Duplique une formation
 */
export function useDuplicateFormation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, options }: { id: string; options?: { include_modules?: boolean } }) =>
      coursApi.duplicateFormation(id, options),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coursKeys.formations() });
      queryClient.invalidateQueries({ queryKey: coursKeys.stats() });
    },
  });
}

// ============================================
// Modules Hooks
// ============================================

/**
 * Récupère tous les modules d'une formation
 */
export function useModules(formationId: string | undefined) {
  return useQuery({
    queryKey: coursKeys.modules(formationId!),
    queryFn: () => coursApi.getModules(formationId!),
    enabled: !!formationId,
  });
}

/**
 * Crée un nouveau module dans une formation
 */
export function useCreateModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ formationId, data }: { formationId: string; data: CreateModuleInput }) =>
      coursApi.createModule(formationId, data),
    onSuccess: (_, { formationId }) => {
      queryClient.invalidateQueries({ queryKey: coursKeys.modules(formationId) });
      queryClient.invalidateQueries({ queryKey: coursKeys.formation(formationId) });
      queryClient.invalidateQueries({ queryKey: coursKeys.stats() });
    },
  });
}

/**
 * Met à jour un module
 */
export function useUpdateModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateModuleInput }) =>
      coursApi.updateModule(id, data),
    onSuccess: (module) => {
      queryClient.invalidateQueries({ queryKey: coursKeys.modules(module.formation_id) });
      queryClient.invalidateQueries({ queryKey: coursKeys.formation(module.formation_id) });
    },
  });
}

/**
 * Supprime un module
 */
export function useDeleteModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => coursApi.deleteModule(id),
    onSuccess: (response) => {
      const formationId = response.module.formation_id;
      queryClient.invalidateQueries({ queryKey: coursKeys.modules(formationId) });
      queryClient.invalidateQueries({ queryKey: coursKeys.formation(formationId) });
      queryClient.invalidateQueries({ queryKey: coursKeys.stats() });
    },
  });
}

/**
 * Réorganise l'ordre d'un module
 */
export function useReorderModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, newOrderIndex }: { id: string; newOrderIndex: number }) =>
      coursApi.reorderModule(id, newOrderIndex),
    onSuccess: (module) => {
      queryClient.invalidateQueries({ queryKey: coursKeys.modules(module.formation_id) });
      queryClient.invalidateQueries({ queryKey: coursKeys.formation(module.formation_id) });
    },
  });
}

// ============================================
// Vidéos Hooks
// ============================================

/**
 * Crée une nouvelle vidéo dans un module
 */
export function useCreateVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ moduleId, data }: { moduleId: string; data: CreateVideoInput }) =>
      coursApi.createVideo(moduleId, data),
    onSuccess: () => {
      // Invalider les queries de la formation parent pour rafraîchir les données
      queryClient.invalidateQueries({ queryKey: coursKeys.all });
    },
  });
}

/**
 * Met à jour une vidéo
 */
export function useUpdateVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateVideoInput }) =>
      coursApi.updateVideo(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coursKeys.all });
    },
  });
}

/**
 * Supprime une vidéo
 */
export function useDeleteVideo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => coursApi.deleteVideo(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coursKeys.all });
      queryClient.invalidateQueries({ queryKey: coursKeys.stats() });
    },
  });
}

// ============================================
// Tests Hooks
// ============================================

/**
 * Récupère un test avec toutes ses questions et choix
 */
export function useTest(id: string | undefined) {
  return useQuery({
    queryKey: coursKeys.test(id!),
    queryFn: () => coursApi.getTest(id!),
    enabled: !!id,
  });
}

/**
 * Crée un nouveau test dans un module
 */
export function useCreateTest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ moduleId, data }: { moduleId: string; data: CreateTestInput }) =>
      coursApi.createTest(moduleId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coursKeys.all });
      queryClient.invalidateQueries({ queryKey: coursKeys.stats() });
    },
  });
}

/**
 * Met à jour un test
 */
export function useUpdateTest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTestInput }) =>
      coursApi.updateTest(id, data),
    onSuccess: (test) => {
      queryClient.invalidateQueries({ queryKey: coursKeys.test(test.id) });
      queryClient.invalidateQueries({ queryKey: coursKeys.all });
    },
  });
}

/**
 * Supprime un test
 */
export function useDeleteTest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => coursApi.deleteTest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coursKeys.all });
      queryClient.invalidateQueries({ queryKey: coursKeys.stats() });
    },
  });
}

// ============================================
// Questions Hooks
// ============================================

/**
 * Crée une nouvelle question dans un test
 */
export function useCreateQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ testId, data }: { testId: string; data: CreateQuestionInput }) =>
      coursApi.createQuestion(testId, data),
    onSuccess: (question) => {
      queryClient.invalidateQueries({ queryKey: coursKeys.test(question.test_id) });
      queryClient.invalidateQueries({ queryKey: coursKeys.all });
    },
  });
}

/**
 * Met à jour une question
 */
export function useUpdateQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateQuestionInput }) =>
      coursApi.updateQuestion(id, data),
    onSuccess: (question) => {
      queryClient.invalidateQueries({ queryKey: coursKeys.test(question.test_id) });
      queryClient.invalidateQueries({ queryKey: coursKeys.all });
    },
  });
}

/**
 * Supprime une question
 */
export function useDeleteQuestion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => coursApi.deleteQuestion(id),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: coursKeys.test(response.question.test_id) });
      queryClient.invalidateQueries({ queryKey: coursKeys.all });
    },
  });
}

// ============================================
// Choix de Réponse Hooks
// ============================================

/**
 * Crée un nouveau choix de réponse pour une question
 */
export function useCreateChoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ questionId, data }: { questionId: string; data: CreateChoiceInput }) =>
      coursApi.createChoice(questionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coursKeys.all });
    },
  });
}

/**
 * Met à jour un choix de réponse
 */
export function useUpdateChoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateChoiceInput }) =>
      coursApi.updateChoice(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coursKeys.all });
    },
  });
}

/**
 * Supprime un choix de réponse
 */
export function useDeleteChoice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => coursApi.deleteChoice(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: coursKeys.all });
    },
  });
}

// ============================================
// Statistiques Hooks
// ============================================

/**
 * Récupère les statistiques des formations
 */
export function useCoursStats() {
  return useQuery({
    queryKey: coursKeys.stats(),
    queryFn: () => coursApi.getStats(),
  });
}
