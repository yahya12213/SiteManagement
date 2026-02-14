import { apiClient } from './client';

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  role: string; // Dynamic role from database (admin, gerant, professor, assistante, comptable, superviseur, etc.)
  segment_ids?: string[];
  city_ids?: string[];
  created_at: string;
}

export interface CreateProfileInput {
  id: string;
  username: string;
  password: string;
  full_name: string;
  role: string; // Dynamic role from database
  segment_ids?: string[];
  city_ids?: string[];
}

export interface UpdateProfileInput {
  id: string;
  username?: string;
  full_name?: string;
  role?: string; // Dynamic role from database
  password?: string;
  segment_ids?: string[];
  city_ids?: string[];
}

/**
 * Service API pour les profils utilisateurs
 */
export const profilesApi = {
  /**
   * Récupérer tous les profils
   */
  async getAll(): Promise<Profile[]> {
    return apiClient.get<Profile[]>('/profiles');
  },

  /**
   * Récupérer tous les professeurs seulement (server-side filtering by role='professor')
   */
  async getAllProfessors(): Promise<Profile[]> {
    return apiClient.get<Profile[]>('/profiles/professors?v=20251125');
  },

  /**
   * Récupérer les professeurs filtrés par segment et ville (server-side filtering)
   */
  async getProfessorsBySegmentCity(segmentId?: string, cityId?: string): Promise<Profile[]> {
    const params = new URLSearchParams();
    params.append('v', '20251125'); // cache buster
    if (segmentId) params.append('segment_id', segmentId);
    if (cityId) params.append('city_id', cityId);

    return apiClient.get<Profile[]>(`/profiles/professors?${params.toString()}`);
  },

  /**
   * Récupérer un profil par ID (avec segments et villes)
   */
  async getById(id: string): Promise<Profile | null> {
    try {
      return await apiClient.get<Profile>(`/profiles/${id}`);
    } catch (error) {
      if (error instanceof Error && 'status' in error && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /**
   * Créer un profil
   */
  async create(profile: CreateProfileInput): Promise<Profile> {
    return apiClient.post<Profile>('/profiles', profile);
  },

  /**
   * Mettre à jour un profil
   */
  async update(profile: UpdateProfileInput): Promise<Profile> {
    const { id, ...data } = profile;
    return apiClient.put<Profile>(`/profiles/${id}`, data);
  },

  /**
   * Supprimer un profil
   */
  async delete(id: string): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(`/profiles/${id}`);
  },
};
