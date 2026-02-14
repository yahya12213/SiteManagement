import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sessionsFormationApi } from '@/lib/api/sessions-formation';
import type {
  CreateSessionFormationInput,
  UpdateSessionFormationInput,
  AddEtudiantToSessionInput,
  UpdateEtudiantSessionInput,
  AddProfesseurToSessionInput,
  CreateSessionFichierInput,
} from '@/types/sessions';

// ============================================
// Query Keys
// ============================================
export const sessionsKeys = {
  all: ['sessions-formation'] as const,
  lists: () => [...sessionsKeys.all, 'list'] as const,
  list: (filters?: Record<string, any>) => [...sessionsKeys.lists(), { filters }] as const,
  details: () => [...sessionsKeys.all, 'detail'] as const,
  detail: (id: string) => [...sessionsKeys.details(), id] as const,
};

// ============================================
// Sessions Hooks
// ============================================

/**
 * Récupère toutes les sessions
 */
export function useSessionsFormation(params?: {
  ville_id?: string;
  segment_id?: string;
  formation_id?: string;
  statut?: string;
  annee?: string;
}) {
  return useQuery({
    queryKey: sessionsKeys.list(params),
    queryFn: () => sessionsFormationApi.getAll(params),
  });
}

/**
 * Récupère une session avec tous ses détails
 */
export function useSessionFormation(id: string | undefined) {
  return useQuery({
    queryKey: sessionsKeys.detail(id!),
    queryFn: () => sessionsFormationApi.getById(id!),
    enabled: !!id,
  });
}

/**
 * Crée une nouvelle session
 */
export function useCreateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSessionFormationInput) => sessionsFormationApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
    },
  });
}

/**
 * Met à jour une session
 */
export function useUpdateSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSessionFormationInput }) =>
      sessionsFormationApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(id) });
    },
  });
}

/**
 * Supprime une session
 */
export function useDeleteSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => sessionsFormationApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
    },
  });
}

// ============================================
// Étudiants Hooks
// ============================================

/**
 * Ajoute un étudiant à une session
 */
export function useAddEtudiantToSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AddEtudiantToSessionInput) => sessionsFormationApi.addEtudiant(data),
    onSuccess: (_, { session_id }) => {
      queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(session_id) });
      queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
    },
  });
}

/**
 * Met à jour l'inscription d'un étudiant (paiement)
 */
export function useUpdateEtudiantSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sessionId,
      etudiantId,
      data,
    }: {
      sessionId: string;
      etudiantId: string;
      data: UpdateEtudiantSessionInput;
    }) => sessionsFormationApi.updateEtudiant(sessionId, etudiantId, data),
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(sessionId) });
      queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
    },
  });
}

/**
 * Retire un étudiant d'une session
 */
export function useRemoveEtudiantFromSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, etudiantId }: { sessionId: string; etudiantId: string }) =>
      sessionsFormationApi.removeEtudiant(sessionId, etudiantId),
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(sessionId) });
      queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
    },
  });
}

// ============================================
// Professeurs Hooks
// ============================================

/**
 * Affecte un professeur à une session
 */
export function useAddProfesseurToSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: AddProfesseurToSessionInput) => sessionsFormationApi.addProfesseur(data),
    onSuccess: (_, { session_id }) => {
      queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(session_id) });
      queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
    },
  });
}

/**
 * Retire un professeur d'une session
 */
export function useRemoveProfesseurFromSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, professeurId }: { sessionId: string; professeurId: string }) =>
      sessionsFormationApi.removeProfesseur(sessionId, professeurId),
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(sessionId) });
      queryClient.invalidateQueries({ queryKey: sessionsKeys.lists() });
    },
  });
}

// ============================================
// Fichiers Hooks
// ============================================

/**
 * Ajoute un fichier (test ou présence)
 */
export function useAddFichierToSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      data: CreateSessionFichierInput & {
        file_url?: string;
        file_name?: string;
        file_size?: number;
      }
    ) => sessionsFormationApi.addFichier(data),
    onSuccess: (_, { session_id }) => {
      queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(session_id) });
    },
  });
}

/**
 * Supprime un fichier
 */
export function useDeleteFichierFromSession() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ fichierId }: { fichierId: string; sessionId: string }) =>
      sessionsFormationApi.deleteFichier(fichierId),
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: sessionsKeys.detail(sessionId) });
    },
  });
}
