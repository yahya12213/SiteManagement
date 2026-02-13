import { apiClient } from './client';

export interface Segment {
  id: string;
  name: string;
  color?: string;
  logo_url?: string;
  cnss_number?: string;
  identifiant_fiscal?: string;  // IF - Identifiant Fiscal
  registre_commerce?: string;   // RC - Registre de Commerce
  ice?: string;                 // ICE
  company_address?: string;     // Adresse siège social
  created_at: string;
}

export interface CreateSegmentInput {
  name: string;
  color: string;
  cnss_number?: string;
  identifiant_fiscal?: string;
  registre_commerce?: string;
  ice?: string;
  company_address?: string;
}

export interface UpdateSegmentInput {
  id: string;
  name: string;
  color: string;
  cnss_number?: string;
  identifiant_fiscal?: string;
  registre_commerce?: string;
  ice?: string;
  company_address?: string;
}

/**
 * Service API pour les segments
 */
export const segmentsApi = {
  /**
   * Récupérer tous les segments
   */
  async getAll(): Promise<Segment[]> {
    return apiClient.get<Segment[]>('/segments');
  },

  /**
   * Récupérer un segment par ID
   */
  async getById(id: string): Promise<Segment | null> {
    try {
      return await apiClient.get<Segment>(`/segments/${id}`);
    } catch (error) {
      if (error instanceof Error && 'status' in error && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Créer un segment
   */
  async create(id: string, segment: CreateSegmentInput): Promise<Segment> {
    return apiClient.post<Segment>('/segments', { id, ...segment });
  },

  /**
   * Mettre à jour un segment
   */
  async update(segment: UpdateSegmentInput): Promise<Segment> {
    const { id, ...data } = segment;
    return apiClient.put<Segment>(`/segments/${id}`, data);
  },

  /**
   * Supprimer un segment
   */
  async delete(id: string): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(`/segments/${id}`);
  },

  /**
   * Upload logo pour un segment
   */
  async uploadLogo(segmentId: string, file: File): Promise<{ success: boolean; segment: Segment }> {
    const formData = new FormData();
    formData.append('logo', file);
    return apiClient.post<{ success: boolean; segment: Segment }>(`/segments/${segmentId}/logo`, formData);
  },

  /**
   * Supprimer logo d'un segment
   */
  async deleteLogo(segmentId: string): Promise<{ success: boolean; segment: Segment }> {
    return apiClient.delete<{ success: boolean; segment: Segment }>(`/segments/${segmentId}/logo`);
  },
};
