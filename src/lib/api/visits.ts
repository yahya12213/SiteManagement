/**
 * API Client Visits - Gestion des visites physiques
 * Types TypeScript et client HTTP
 */

import { apiClient } from './client';

// ============================================================
// TYPES
// ============================================================

export interface Visit {
  id: string;
  nom?: string;
  prenom?: string;
  phone_raw?: string;
  phone_international: string;
  country_code?: string;
  country?: string;
  centre_ville_id: string;
  statut: 'inscrit' | 'non_inscrit';
  motif_non_inscription?: string;
  date_visite: string;
  commentaire?: string;
  created_at: string;
  created_by?: string;
  // Joined fields
  centre_ville_name?: string;
  segment_name?: string;
  created_by_name?: string;
  motif_label?: string;
  motif_description?: string;
}

export interface VisitStats {
  total: number;
  inscrits: number;
  non_inscrits: number;
}

export interface VisitFilters {
  centre_ville_id?: string;
  statut?: 'inscrit' | 'non_inscrit';
  motif_non_inscription?: string;
  date_from?: string;
  date_to?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateVisitInput {
  nom?: string;
  prenom?: string;
  phone: string;
  centre_ville_id: string;
  statut: 'inscrit' | 'non_inscrit';
  motif_non_inscription?: string;
  commentaire?: string;
}

export interface UpdateVisitInput {
  id: string;
  nom?: string;
  prenom?: string;
  statut?: 'inscrit' | 'non_inscrit';
  motif_non_inscription?: string;
  commentaire?: string;
}

export interface RejectionReason {
  id: string;
  label: string;
  description?: string;
}

export interface AnalyticsFilters {
  date_from?: string;
  date_to?: string;
  centre_ville_id?: string;
}

export interface GlobalAnalytics {
  total_visites: number;
  total_inscrits: number;
  total_non_inscrits: number;
  taux_conversion: number;
}

export interface ZonePerformance {
  ville_id: string;
  ville_name: string;
  total_visites: number;
  inscrits: number;
  non_inscrits: number;
  taux_conversion: number;
}

export interface CauseByCenter {
  ville_id: string;
  ville_name: string;
  motif_non_inscription: string;
  motif_label: string;
  count: number;
}

export interface TopReason {
  motif_non_inscription: string;
  motif_label: string;
  count: number;
  percentage: number;
}

export interface Evolution {
  date: string;
  total: number;
  inscrits: number;
  non_inscrits: number;
}

export interface VisitAnalytics {
  global: GlobalAnalytics;
  performance_by_zone: ZonePerformance[];
  causes_by_center: CauseByCenter[];
  top_reasons: TopReason[];
  evolution: Evolution[];
}

// ============================================================
// API CLIENT
// ============================================================

export const visitsApi = {
  /**
   * Récupérer la liste des visites avec filtres
   */
  async getAll(filters?: VisitFilters): Promise<{
    visits: Visit[];
    stats: VisitStats;
    pagination: {
      page: number;
      limit: number;
      total: number;
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

    return apiClient.get(`/visits?${params.toString()}`);
  },

  /**
   * Récupérer une visite par ID
   */
  async getById(id: string): Promise<Visit> {
    return apiClient.get(`/visits/${id}`);
  },

  /**
   * Créer une nouvelle visite
   */
  async create(data: CreateVisitInput): Promise<{
    message: string;
    visit: Visit;
  }> {
    return apiClient.post('/visits', data);
  },

  /**
   * Mettre à jour une visite
   */
  async update(data: UpdateVisitInput): Promise<{
    message: string;
    visit: Visit;
  }> {
    const { id, ...updateData } = data;
    return apiClient.put(`/visits/${id}`, updateData);
  },

  /**
   * Supprimer une visite
   */
  async delete(id: string): Promise<{ message: string }> {
    return apiClient.delete(`/visits/${id}`);
  },

  /**
   * Récupérer les motifs de non-inscription
   */
  async getRejectionReasons(): Promise<RejectionReason[]> {
    return apiClient.get('/visits/rejection-reasons');
  },

  /**
   * Récupérer les analytics des visites
   */
  async getAnalytics(filters?: AnalyticsFilters): Promise<VisitAnalytics> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
    }

    return apiClient.get(`/visits/analytics?${params.toString()}`);
  },

  /**
   * Exporter les visites en CSV
   */
  async exportCSV(filters?: AnalyticsFilters): Promise<Blob> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
    }

    const response = await fetch(`/api/visits/export/csv?${params.toString()}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
    });

    if (!response.ok) {
      throw new Error('Export failed');
    }

    return response.blob();
  },
};
