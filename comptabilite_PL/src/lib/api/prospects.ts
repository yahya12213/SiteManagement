/**
 * API Client Prospects - Gestion des prospects
 * Types TypeScript et client HTTP
 */

import { apiClient } from './client';

// ============================================================
// TYPES
// ============================================================

export interface Prospect {
  id: string;
  phone_raw?: string;
  phone_international: string;
  country_code: string;
  country: string;
  statut_validation_numero: 'valide' | 'invalide' | 'a_verifier_manuelle';
  nom?: string;
  prenom?: string;
  cin?: string;
  segment_id: string;
  ville_id: string;
  assigned_to?: string;
  statut_contact: string;
  date_rdv?: string;
  rdv_centre_ville_id?: string;
  date_injection: string;
  decision_nettoyage?: 'laisser' | 'supprimer' | 'a_revoir_manuelle';
  commentaire?: string;
  is_auto_assigned: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
  // Joined fields
  segment_name?: string;
  ville_name?: string;
  assigned_to_name?: string;
  created_by_name?: string;
  total_call_duration?: number;
  assistantes_ville?: string;
}

export interface ProspectStats {
  total: number;
  non_contactes: number;
  avec_rdv: number;
  sans_rdv: number;
  inscrits_prospect: number;
  inscrits_session: number;
  appels_30s_count?: number;
  taux_conversion?: number;
  // Écart d'inscription
  inscription_objective?: number;
  inscription_gap?: number | null;
  expected_inscriptions?: number | null;
  total_working_days?: number;
  elapsed_working_days?: number;
  daily_objective?: number | null;
  period_start?: string;
  period_end?: string;
}

export interface ProspectFilters {
  segment_id?: string;
  ville_id?: string;
  statut_contact?: string;
  assigned_to?: string;
  decision_nettoyage?: string;
  country_code?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export interface CreateProspectInput {
  phone: string;
  nom?: string;
  prenom?: string;
  cin?: string;
  segment_id: string;
  ville_id: string;
}

export interface UpdateProspectInput {
  id: string;
  nom?: string;
  prenom?: string;
  cin?: string;
  statut_contact?: string;
  date_rdv?: string;
  rdv_centre_ville_id?: string;
  commentaire?: string;
}

export interface ImportLine {
  phone: string;
  ville: string;
}

export interface ImportResult {
  message: string;
  summary: {
    created: number;
    reinjected: number;
    errors: number;
  };
  details: Array<{
    original: ImportLine;
    status: 'created' | 'reinjected' | 'duplicate' | 'error';
    error?: string;
  }>;
}

export interface EndCallData {
  call_id: string;
  statut_contact: string;
  commentaire?: string;
  ville_id?: string;
  date_rdv?: string;
  rdv_centre_ville_id?: string;
  nom?: string;
  prenom?: string;
  cin?: string;
}

export interface CountryConfig {
  country_code: string;
  country: string;
  expected_national_length: number;
  region: string;
}

export interface CleaningStats {
  laisser: {
    total: number;
    non_contactes: number;
    avec_rdv: number;
  };
  supprimer: {
    total: number;
    non_contactes: number;
    avec_rdv: number;
  };
  a_revoir_manuelle: {
    total: number;
    non_contactes: number;
    avec_rdv: number;
  };
}

// ============================================================
// ÉCART DETAILS TYPES (2 types d'écart indépendants)
// ============================================================

// Écart Session: étudiants en sessions mais sans prospect "inscrit"
export interface EcartSessionStudent {
  student_id: string;
  nom: string;
  prenom: string;
  cin?: string;
  phone?: string;
  whatsapp?: string;
  sessions: Array<{
    session_id: string;
    session_name: string;
    ville_name: string;
    segment_name: string;
    enrolled_at: string;
  }>;
}

// Écart Prospect: prospects "inscrit" mais pas en session
export interface EcartProspectStudent {
  prospect_id: string;
  nom: string;
  prenom: string;
  phone_international: string;
  statut_contact: string;
  date_injection: string;
  ville_name?: string;
  segment_name?: string;
}

export interface EcartDetailsResponse {
  ecart_session: {
    count: number;
    students: EcartSessionStudent[];
  };
  ecart_prospect: {
    count: number;
    students: EcartProspectStudent[];
  };
}

// ============================================================
// API CLIENT
// ============================================================

export const prospectsApi = {
  /**
   * Récupérer la liste des prospects avec filtres
   */
  async getAll(filters?: ProspectFilters): Promise<{
    prospects: Prospect[];
    stats: ProspectStats;
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

    return apiClient.get(`/prospects?${params.toString()}`);
  },

  /**
   * Récupérer un prospect par ID
   */
  async getById(id: string): Promise<Prospect> {
    return apiClient.get(`/prospects/${id}`);
  },

  /**
   * Créer un nouveau prospect
   */
  async create(data: CreateProspectInput): Promise<{
    message: string;
    prospect: Prospect;
    assignment?: {
      assistante_name: string;
      ville_name: string;
    };
    reinjected?: boolean;
  }> {
    return apiClient.post('/prospects', data);
  },

  /**
   * Mettre à jour un prospect
   */
  async update(data: UpdateProspectInput): Promise<{
    message: string;
    prospect: Prospect;
  }> {
    const { id, ...updateData } = data;
    return apiClient.put(`/prospects/${id}`, updateData);
  },

  /**
   * Supprimer un prospect
   */
  async delete(id: string): Promise<{ message: string }> {
    return apiClient.delete(`/prospects/${id}`);
  },

  /**
   * Importer des prospects en masse
   */
  async importBatch(segment_id: string, lines: ImportLine[]): Promise<ImportResult> {
    return apiClient.post('/prospects/import', { segment_id, lines });
  },

  /**
   * Démarrer un appel
   */
  async startCall(id: string): Promise<{
    call_id: string;
    started_at: string;
  }> {
    return apiClient.post(`/prospects/${id}/start-call`, {});
  },

  /**
   * Terminer un appel
   */
  async endCall(id: string, data: EndCallData): Promise<{
    message: string;
    duration_seconds: number;
    reassignment?: {
      assigned_to: string;
      assistante_name: string;
      ville_id: string;
      ville_name: string;
    } | null;
  }> {
    return apiClient.post(`/prospects/${id}/end-call`, data);
  },

  /**
   * Réinjecter un prospect
   */
  async reinject(id: string): Promise<{
    message: string;
    prospect: Prospect;
  }> {
    return apiClient.post(`/prospects/${id}/reinject`, {});
  },

  /**
   * Lancer le nettoyage batch
   */
  async batchClean(executeDeletion: boolean = false): Promise<{
    message: string;
    clean_stats: {
      laisser: number;
      supprimer: number;
      a_revoir: number;
      total: number;
    };
    delete_stats?: {
      deleted: number;
    };
  }> {
    return apiClient.post('/prospects/batch-clean', { execute_deletion: executeDeletion });
  },

  /**
   * Récupérer les stats de nettoyage
   */
  async getCleaningStats(): Promise<CleaningStats> {
    return apiClient.get('/prospects/cleaning/stats');
  },

  /**
   * Récupérer les prospects à supprimer
   */
  async getProspectsToDelete(limit = 100, offset = 0): Promise<Prospect[]> {
    return apiClient.get(`/prospects/cleaning/to-delete?limit=${limit}&offset=${offset}`);
  },

  /**
   * Récupérer la liste des pays supportés
   */
  async getCountryCodes(): Promise<CountryConfig[]> {
    return apiClient.get('/prospects/country-codes');
  },

  /**
   * Récupérer les détails de l'écart entre inscrits prospect et session
   */
  async getEcartDetails(filters?: Pick<ProspectFilters, 'segment_id' | 'ville_id' | 'date_from' | 'date_to'>): Promise<EcartDetailsResponse> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
    }
    return apiClient.get(`/prospects/ecart-details?${params.toString()}`);
  },
};
