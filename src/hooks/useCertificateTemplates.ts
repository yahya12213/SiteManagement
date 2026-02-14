import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { certificateTemplatesApi } from '@/lib/api/certificateTemplates';
import type { CreateTemplateInput, UpdateTemplateInput } from '@/types/certificateTemplate';

/**
 * Query keys pour les templates
 */
export const templateKeys = {
  all: ['certificate-templates'] as const,
  detail: (id: string) => ['certificate-templates', id] as const,
  customFonts: ['custom-fonts'] as const,
};

/**
 * Hook pour lister tous les templates
 */
export const useCertificateTemplates = () => {
  return useQuery({
    queryKey: templateKeys.all,
    queryFn: certificateTemplatesApi.getAll,
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (data) => data.templates, // Retourner directement le tableau des templates
  });
};

/**
 * Hook pour obtenir un template spécifique par ID
 */
export const useCertificateTemplate = (id: string | null) => {
  return useQuery({
    queryKey: templateKeys.detail(id || ''),
    queryFn: () => certificateTemplatesApi.getById(id!),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    select: (data) => data.template, // Retourner directement le template
  });
};

/**
 * Hook pour créer un nouveau template
 */
export const useCreateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTemplateInput) => certificateTemplatesApi.create(data),
    onSuccess: () => {
      // Invalider la liste des templates pour forcer un refresh
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
};

/**
 * Hook pour modifier un template existant
 */
export const useUpdateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTemplateInput }) =>
      certificateTemplatesApi.update(id, data),
    onSuccess: (_, variables) => {
      // Invalider à la fois la liste et le template spécifique
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
      queryClient.invalidateQueries({ queryKey: templateKeys.detail(variables.id) });
    },
  });
};

/**
 * Hook pour supprimer un template
 */
export const useDeleteTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => certificateTemplatesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
};

/**
 * Hook pour dupliquer un template
 */
export const useDuplicateTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => certificateTemplatesApi.duplicate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
};

/**
 * Hook pour dupliquer un template vers un autre dossier
 */
export const useDuplicateToFolder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, targetFolderId }: { id: string; targetFolderId: string }) =>
      certificateTemplatesApi.duplicateToFolder(id, targetFolderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
};

/**
 * Hook pour déplacer un template vers un autre dossier
 */
export const useMoveTemplate = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, targetFolderId }: { id: string; targetFolderId: string }) =>
      certificateTemplatesApi.update(id, { folder_id: targetFolderId }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
      queryClient.invalidateQueries({ queryKey: templateKeys.detail(variables.id) });
    },
  });
};

/**
 * Hook pour créer les templates par défaut (seed)
 */
export const useSeedDefaultTemplates = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => certificateTemplatesApi.seedDefaults(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
};

/**
 * Hook pour uploader un logo
 */
export const useUploadLogo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      certificateTemplatesApi.uploadLogo(id, file),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: templateKeys.detail(variables.id) });
    },
  });
};

/**
 * Hook pour uploader une signature
 */
export const useUploadSignature = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      certificateTemplatesApi.uploadSignature(id, file),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: templateKeys.detail(variables.id) });
    },
  });
};

/**
 * Hook pour récupérer toutes les polices personnalisées
 */
export const useCustomFonts = () => {
  return useQuery({
    queryKey: templateKeys.customFonts,
    queryFn: certificateTemplatesApi.getCustomFonts,
    staleTime: 5 * 60 * 1000, // 5 minutes
    select: (data) => data.fonts, // Retourner directement le tableau des fonts
  });
};

/**
 * Hook pour uploader une police personnalisée
 */
export const useUploadCustomFont = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ file, fontName }: { file: File; fontName: string }) =>
      certificateTemplatesApi.uploadCustomFont(file, fontName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.customFonts });
    },
  });
};

/**
 * Hook pour supprimer une police personnalisée
 */
export const useDeleteCustomFont = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => certificateTemplatesApi.deleteCustomFont(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.customFonts });
    },
  });
};
