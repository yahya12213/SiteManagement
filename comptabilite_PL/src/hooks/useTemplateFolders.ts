import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { templateFoldersApi } from '@/lib/api/templateFolders';
import type {
  CreateFolderInput,
  UpdateFolderInput,
  MoveFolderInput,
} from '@/types/certificateTemplate';

/**
 * Get all folders (flat list)
 */
export const useTemplateFolders = () => {
  return useQuery({
    queryKey: ['template-folders'],
    queryFn: () => templateFoldersApi.getAll(),
  });
};

/**
 * Get folder tree (hierarchical)
 */
export const useTemplateFolderTree = () => {
  return useQuery({
    queryKey: ['template-folders-tree'],
    queryFn: () => templateFoldersApi.getTree(),
  });
};

/**
 * Get single folder by ID
 */
export const useTemplateFolder = (id: string | null) => {
  return useQuery({
    queryKey: ['template-folder', id],
    queryFn: () => (id ? templateFoldersApi.getById(id) : Promise.reject('No ID provided')),
    enabled: !!id,
  });
};

/**
 * Create new folder
 */
export const useCreateFolder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateFolderInput) => templateFoldersApi.create(data),
    onSuccess: () => {
      // Invalidate all folder queries
      queryClient.invalidateQueries({ queryKey: ['template-folders'] });
      queryClient.invalidateQueries({ queryKey: ['template-folders-tree'] });
      queryClient.invalidateQueries({ queryKey: ['certificate-templates'] });
    },
  });
};

/**
 * Update folder (rename)
 */
export const useUpdateFolder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFolderInput }) =>
      templateFoldersApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['template-folders'] });
      queryClient.invalidateQueries({ queryKey: ['template-folders-tree'] });
      queryClient.invalidateQueries({ queryKey: ['template-folder', variables.id] });
    },
  });
};

/**
 * Delete folder (only if empty)
 */
export const useDeleteFolder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => templateFoldersApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-folders'] });
      queryClient.invalidateQueries({ queryKey: ['template-folders-tree'] });
      queryClient.invalidateQueries({ queryKey: ['certificate-templates'] });
    },
  });
};

/**
 * Move folder to new parent
 */
export const useMoveFolder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: MoveFolderInput }) =>
      templateFoldersApi.move(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['template-folders'] });
      queryClient.invalidateQueries({ queryKey: ['template-folders-tree'] });
    },
  });
};
