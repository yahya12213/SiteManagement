import { apiClient } from './client';

export interface City {
  id: string;
  name: string;
  code: string;
  segment_id: string;
  segment_name?: string;
  segment_color?: string;
  created_at: string;
}

export interface CreateCityInput {
  name: string;
  code: string;
  segment_id: string;
}

export interface UpdateCityInput {
  id: string;
  name: string;
  code: string;
  segment_id: string;
}

/**
 * Service API pour les villes
 */
export const citiesApi = {
  /**
   * Récupérer toutes les villes (filtré par SBAC)
   */
  async getAll(): Promise<City[]> {
    return apiClient.get<City[]>('/cities');
  },

  /**
   * Récupérer TOUTES les villes sans filtrage SBAC
   * Utilisé pour la réassignation de prospects
   */
  async getAllUnfiltered(): Promise<City[]> {
    return apiClient.get<City[]>('/cities/all');
  },

  /**
   * Récupérer une ville par ID
   */
  async getById(id: string): Promise<City | null> {
    try {
      return await apiClient.get<City>(`/cities/${id}`);
    } catch (error) {
      // Si 404, retourner null au lieu de lancer une erreur
      if (error instanceof Error && 'status' in error && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Récupérer les villes par segment
   * @param segmentId - ID du segment
   * @param applyScope - Si true (défaut), applique le filtre SBAC. Si false, retourne toutes les villes du segment.
   */
  async getBySegment(segmentId: string, applyScope = true): Promise<City[]> {
    return apiClient.get<City[]>(`/cities/by-segment/${segmentId}?scope=${applyScope}`);
  },

  /**
   * Créer une ville
   */
  async create(id: string, city: CreateCityInput): Promise<City> {
    return apiClient.post<City>('/cities', { id, ...city });
  },

  /**
   * Mettre à jour une ville
   */
  async update(city: UpdateCityInput): Promise<City> {
    const { id, ...data } = city;
    return apiClient.put<City>(`/cities/${id}`, data);
  },

  /**
   * Supprimer une ville
   */
  async delete(id: string): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(`/cities/${id}`);
  },
};
