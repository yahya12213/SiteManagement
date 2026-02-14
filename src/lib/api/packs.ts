/**
 * API Client pour Packs de Formations
 */

import { apiClient } from './client';
import type {
  Formation,
  CreatePackInput,
  UpdatePackInput
} from '@/types/cours';

export const packsApi = {
  /**
   * Créer un nouveau pack de formations
   */
  create: async (data: CreatePackInput): Promise<Formation> => {
    const response = await apiClient.post<{
      success: boolean;
      pack: Formation;
      formations_count: number;
    }>(
      '/cours/packs',
      data
    );
    return response.pack;
  },

  /**
   * Récupérer un pack par ID avec ses formations
   */
  getById: async (id: string): Promise<Formation> => {
    const response = await apiClient.get<{
      success: boolean;
      pack: Formation;
    }>(
      `/cours/packs/${id}`
    );
    return response.pack;
  },

  /**
   * Modifier un pack
   */
  update: async (id: string, data: UpdatePackInput): Promise<Formation> => {
    const response = await apiClient.put<{
      success: boolean;
      pack: Formation;
    }>(
      `/cours/packs/${id}`,
      data
    );
    return response.pack;
  },

  /**
   * Supprimer un pack
   */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete<{
      success: boolean;
      message: string;
    }>(
      `/cours/packs/${id}`
    );
  }
};
