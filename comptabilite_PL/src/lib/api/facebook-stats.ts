/**
 * API Client Facebook Stats - Gestion des declarations Facebook
 * Types TypeScript et client HTTP pour l'analyse publicite
 */

import { apiClient } from './client';

// ============================================================
// TYPES
// ============================================================

export interface FacebookStat {
  id: number;
  date: string;
  city_id: string;
  segment_id: string;
  declared_count: number;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  city_name?: string;
  segment_name?: string;
  segment_color?: string;
  created_by_name?: string;
}

export interface FacebookStatFilters {
  segment_id?: string;
  city_id?: string;
  date_start?: string;
  date_end?: string;
  page?: number;
  limit?: number;
}

export interface CreateFacebookStatInput {
  date: string;
  city_id: string;
  declared_count: number;
  notes?: string;
}

export interface ComparisonRow {
  date: string;
  facebook_count: number;
  database_count: number;
  difference: number;
  conversion_rate: number | null;
}

export interface ComparisonSummary {
  total_facebook: number;
  total_database: number;
  difference: number;
  overall_conversion_rate: string;
}

export interface ComparisonFilters {
  date_start: string;
  date_end: string;
}

export interface SegmentSummary {
  segment_id: string;
  segment_name: string;
  segment_color?: string;
  total_facebook: number;
  total_database: number;
  difference: number;
  conversion_rate: string | null;
}

// ============================================================
// API CLIENT
// ============================================================

export const facebookStatsApi = {
  /**
   * Recuperer la liste des stats Facebook avec filtres
   */
  async getAll(filters?: FacebookStatFilters): Promise<{
    stats: FacebookStat[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
    }

    return apiClient.get(`/facebook-stats?${params.toString()}`);
  },

  /**
   * Creer ou mettre a jour une stat Facebook (upsert)
   */
  async create(data: CreateFacebookStatInput): Promise<FacebookStat> {
    return apiClient.post('/facebook-stats', data);
  },

  /**
   * Supprimer une entree
   */
  async delete(id: number): Promise<{ message: string; deleted: FacebookStat }> {
    return apiClient.delete(`/facebook-stats/${id}`);
  },

  /**
   * Recuperer la comparaison Facebook vs BDD
   */
  async getComparison(filters: ComparisonFilters): Promise<{
    comparison: ComparisonRow[];
    summary: ComparisonSummary;
    filters: ComparisonFilters;
  }> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.append(key, String(value));
      }
    });

    return apiClient.get(`/facebook-stats/comparison?${params.toString()}`);
  },

  /**
   * Recuperer le resume par segment
   */
  async getSummary(filters: { date_start: string; date_end: string }): Promise<{
    summary_by_segment: SegmentSummary[];
    period: { date_start: string; date_end: string };
  }> {
    const params = new URLSearchParams();
    params.append('date_start', filters.date_start);
    params.append('date_end', filters.date_end);

    return apiClient.get(`/facebook-stats/summary?${params.toString()}`);
  },
};
