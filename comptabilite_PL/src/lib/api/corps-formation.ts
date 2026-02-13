/**
 * API Client pour Corps de Formation
 */

import { apiClient } from './client';
import type {
  CorpsFormation,
  CreateCorpsFormationDto,
  UpdateCorpsFormationDto,
  CorpsFormationWithFormations
} from '@/types/corps-formation';
import type { Formation } from '@/types/cours';

export const corpsFormationApi = {
  /**
   * Récupérer tous les corps de formation
   */
  getAll: async (): Promise<CorpsFormation[]> => {
    const response = await apiClient.get<{ success: boolean; corps: CorpsFormation[] }>(
      '/corps-formation'
    );
    return response.corps;
  },

  /**
   * Récupérer un corps de formation par ID avec ses formations
   */
  getById: async (id: string): Promise<CorpsFormationWithFormations> => {
    const response = await apiClient.get<{ success: boolean; corps: CorpsFormationWithFormations }>(
      `/corps-formation/${id}`
    );
    return response.corps;
  },

  /**
   * Créer un nouveau corps de formation
   */
  create: async (data: CreateCorpsFormationDto): Promise<CorpsFormation> => {
    const response = await apiClient.post<{ success: boolean; corps: CorpsFormation; message: string }>(
      '/corps-formation',
      data
    );
    return response.corps;
  },

  /**
   * Modifier un corps de formation
   */
  update: async (id: string, data: UpdateCorpsFormationDto): Promise<CorpsFormation> => {
    const response = await apiClient.put<{ success: boolean; corps: CorpsFormation; message: string }>(
      `/corps-formation/${id}`,
      data
    );
    return response.corps;
  },

  /**
   * Supprimer un corps de formation
   */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete<{ success: boolean; message: string }>(`/corps-formation/${id}`);
  },

  /**
   * Supprimer un corps de formation en forçant le détachement des formations
   */
  deleteForce: async (id: string): Promise<{ formations_detached: number }> => {
    const response = await apiClient.delete<{
      success: boolean;
      message: string;
      formations_detached: number;
    }>(`/corps-formation/${id}?force=true`);
    return { formations_detached: response.formations_detached };
  },

  /**
   * Récupérer les formations unitaires d'un corps (pour création de pack)
   */
  getFormationsByCorps: async (corpsId: string): Promise<Formation[]> => {
    const response = await apiClient.get<{ success: boolean; formations: Formation[] }>(
      `/corps-formation/${corpsId}/formations`
    );
    return response.formations;
  },

  /**
   * Récupérer les statistiques globales
   */
  getStats: async (): Promise<{
    total_corps: number;
    total_formations: number;
    total_packs: number;
    total_formations_unitaires: number;
  }> => {
    const response = await apiClient.get<{
      success: boolean;
      stats: {
        total_corps: number;
        total_formations: number;
        total_packs: number;
        total_formations_unitaires: number;
      };
    }>('/corps-formation/stats/global');
    return response.stats;
  },

  /**
   * Dupliquer un corps de formation
   */
  duplicate: async (
    id: string,
    options?: { include_formations?: boolean }
  ): Promise<{
    corps: CorpsFormation;
    duplicated_formations: Formation[];
  }> => {
    const response = await apiClient.post<{
      success: boolean;
      corps: CorpsFormation;
      duplicated_formations: Formation[];
      message: string;
    }>(`/corps-formation/${id}/duplicate`, options || {});
    return {
      corps: response.corps,
      duplicated_formations: response.duplicated_formations
    };
  }
};
