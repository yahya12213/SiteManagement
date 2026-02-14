import { apiClient } from './client';

export interface CalculationSheet {
  id: string;
  title: string;
  template_data: string;
  status: 'draft' | 'published';
  sheet_date: string;
  segment_ids?: string[];
  city_ids?: string[];
  created_at: string;
  updated_at: string;
}

export interface CreateCalculationSheetInput {
  id: string;
  title: string;
  template_data: string;
  status: 'draft' | 'published';
  sheet_date: string;
  segment_ids?: string[];
  city_ids?: string[];
}

export interface UpdateCalculationSheetInput {
  id: string;
  title?: string;
  template_data?: string;
  status?: 'draft' | 'published';
  sheet_date?: string;
  segment_ids?: string[];
  city_ids?: string[];
}

/**
 * Service API pour les fiches de calcul
 */
export const calculationSheetsApi = {
  /**
   * Récupérer toutes les fiches de calcul
   */
  async getAll(): Promise<CalculationSheet[]> {
    return apiClient.get<CalculationSheet[]>('/calculation-sheets');
  },

  /**
   * Récupérer une fiche par ID
   */
  async getById(id: string): Promise<CalculationSheet | null> {
    try {
      return await apiClient.get<CalculationSheet>(`/calculation-sheets/${id}`);
    } catch (error) {
      if (error instanceof Error && 'status' in error && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Créer une fiche de calcul
   */
  async create(sheet: CreateCalculationSheetInput): Promise<CalculationSheet> {
    return apiClient.post<CalculationSheet>('/calculation-sheets', sheet);
  },

  /**
   * Mettre à jour une fiche de calcul
   */
  async update(sheet: UpdateCalculationSheetInput): Promise<CalculationSheet> {
    const { id, ...data } = sheet;
    return apiClient.put<CalculationSheet>(`/calculation-sheets/${id}`, data);
  },

  /**
   * Supprimer une fiche de calcul
   */
  async delete(id: string): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(`/calculation-sheets/${id}`);
  },
};
