/**
 * API Client pour les certificats
 */
import { apiClient } from './client';

export interface Certificate {
  id: string;
  student_id: string;
  formation_id: string;
  certificate_number: string;
  issued_at: string;
  completion_date: string;
  grade: number | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Données jointes
  formation_title?: string;
  formation_description?: string;
  duration_hours?: number;
  student_name?: string;
  student_email?: string;
}

export interface GenerateCertificateInput {
  student_id: string;
  formation_id: string;
  completion_date: string;
  grade?: number;
  metadata?: Record<string, any>;
}

export interface CertificateVerification {
  success: boolean;
  valid: boolean;
  message?: string;
  certificate?: Certificate;
}

export interface CertificatesListResponse {
  success: boolean;
  certificates: Certificate[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
  };
}

/**
 * API pour les certificats
 */
export const certificatesApi = {
  /**
   * Générer un certificat
   */
  generate: async (data: GenerateCertificateInput): Promise<{ success: boolean; certificate: Certificate }> => {
    return apiClient.post('/certificates/generate', data);
  },

  /**
   * Récupérer tous les certificats d'un étudiant
   */
  getByStudent: async (studentId: string): Promise<{ success: boolean; certificates: Certificate[] }> => {
    return apiClient.get(`/certificates/student/${studentId}`);
  },

  /**
   * Récupérer un certificat par son ID
   */
  getById: async (id: string): Promise<{ success: boolean; certificate: Certificate }> => {
    return apiClient.get(`/certificates/${id}`);
  },

  /**
   * Vérifier un certificat par son numéro
   */
  verify: async (certificateNumber: string): Promise<CertificateVerification> => {
    return apiClient.get(`/certificates/verify/${certificateNumber}`);
  },

  /**
   * Récupérer tous les certificats (admin)
   */
  getAll: async (params?: {
    limit?: number;
    offset?: number;
    formation_id?: string;
  }): Promise<CertificatesListResponse> => {
    const queryParams: Record<string, string> = {};
    if (params?.limit) queryParams.limit = params.limit.toString();
    if (params?.offset) queryParams.offset = params.offset.toString();
    if (params?.formation_id) queryParams.formation_id = params.formation_id;

    return apiClient.get('/certificates', queryParams);
  },

  /**
   * Supprimer un certificat (admin)
   */
  delete: async (id: string): Promise<{ success: boolean; message: string }> => {
    return apiClient.delete(`/certificates/${id}`);
  },

  /**
   * Mettre à jour les métadonnées d'un certificat
   */
  updateMetadata: async (
    id: string,
    metadata: Record<string, any>
  ): Promise<{ success: boolean; certificate: Certificate }> => {
    return apiClient.patch(`/certificates/${id}/metadata`, { metadata });
  },
};
