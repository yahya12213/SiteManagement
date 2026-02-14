import { apiClient } from './client';

export type DeclarationStatus =
  | 'brouillon'
  | 'soumise'
  | 'en_cours'
  | 'approuvee'
  | 'refusee'
  | 'a_declarer';

export interface Declaration {
  id: string;
  professor_id: string;
  calculation_sheet_id: string;
  segment_id: string;
  city_id: string;
  start_date: string;
  end_date: string;
  form_data: string;
  status: DeclarationStatus;
  session_name: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  submitted_at?: string;
  reviewed_at?: string;
  // Champs jointures
  professor_name?: string;
  segment_name?: string;
  city_name?: string;
  sheet_title?: string;
  template_data?: string;
}

export interface CreateDeclarationInput {
  id: string;
  professor_id: string;
  calculation_sheet_id: string;
  segment_id: string;
  city_id: string;
  start_date: string;
  end_date: string;
  form_data?: string;
  status?: DeclarationStatus;
  session_name?: string;
}

export interface UpdateDeclarationInput {
  id: string;
  form_data?: string;
  status?: DeclarationStatus;
  rejection_reason?: string;
  segment_id?: string;
  city_id?: string;
  start_date?: string;
  end_date?: string;
  session_name?: string;
}

/**
 * Service API pour les déclarations
 */
export const declarationsApi = {
  /**
   * Récupérer toutes les déclarations (avec filtre optionnel par professeur ou utilisateur)
   */
  async getAll(professorId?: string, filterByUser?: boolean, viewAll?: boolean): Promise<Declaration[]> {
    const params: Record<string, string> = {};
    if (professorId) params.professor_id = professorId;
    if (filterByUser) params.filter_by_user = 'true';
    if (viewAll) params.view_all = 'true';
    return apiClient.get<Declaration[]>('/declarations', Object.keys(params).length > 0 ? params : undefined);
  },

  /**
   * Récupérer une déclaration par ID
   */
  async getById(id: string): Promise<Declaration | null> {
    try {
      return await apiClient.get<Declaration>(`/declarations/${id}`);
    } catch (error) {
      if (error instanceof Error && 'status' in error && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Créer une déclaration
   */
  async create(declaration: CreateDeclarationInput): Promise<Declaration> {
    return apiClient.post<Declaration>('/declarations', declaration);
  },

  /**
   * Mettre à jour une déclaration
   */
  async update(declaration: UpdateDeclarationInput): Promise<Declaration> {
    const { id, ...data } = declaration;
    return apiClient.put<Declaration>(`/declarations/${id}`, data);
  },

  /**
   * Supprimer une déclaration
   */
  async delete(id: string): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(`/declarations/${id}`);
  },
};
