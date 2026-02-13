import { apiClient } from './client';
import type {
  TemplateFolder,
  CreateFolderInput,
  UpdateFolderInput,
  MoveFolderInput,
} from '@/types/certificateTemplate';

export const templateFoldersApi = {
  /**
   * Get all folders (flat list)
   */
  getAll: async (): Promise<TemplateFolder[]> => {
    const response = await apiClient.get<{ success: boolean; folders: TemplateFolder[] }>('/template-folders');
    return response.folders;
  },

  /**
   * Get folder tree (hierarchical structure)
   */
  getTree: async (): Promise<TemplateFolder[]> => {
    const response = await apiClient.get<{ success: boolean; tree: TemplateFolder[] }>('/template-folders/tree');
    return response.tree;
  },

  /**
   * Get single folder with details
   */
  getById: async (id: string): Promise<TemplateFolder> => {
    const response = await apiClient.get<{ success: boolean; folder: TemplateFolder }>(`/template-folders/${id}`);
    return response.folder;
  },

  /**
   * Create new folder
   */
  create: async (data: CreateFolderInput): Promise<TemplateFolder> => {
    const response = await apiClient.post<{ success: boolean; folder: TemplateFolder; message: string }>('/template-folders', data);
    return response.folder;
  },

  /**
   * Update folder (rename)
   */
  update: async (id: string, data: UpdateFolderInput): Promise<TemplateFolder> => {
    const response = await apiClient.put<{ success: boolean; folder: TemplateFolder; message: string }>(`/template-folders/${id}`, data);
    return response.folder;
  },

  /**
   * Delete folder (only if empty)
   */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete<{ success: boolean; message: string }>(`/template-folders/${id}`);
  },

  /**
   * Move folder to new parent
   */
  move: async (id: string, data: MoveFolderInput): Promise<TemplateFolder> => {
    const response = await apiClient.post<{ success: boolean; folder: TemplateFolder; message: string }>(`/template-folders/${id}/move`, data);
    return response.folder;
  },
};
