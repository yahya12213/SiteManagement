/**
 * API Client pour Sessions de Formation
 */

import { apiClient } from './client';
import type {
  SessionFormation,
  SessionFormationDetailed,
  CreateSessionFormationInput,
  UpdateSessionFormationInput,
  AddEtudiantToSessionInput,
  UpdateEtudiantSessionInput,
  AddProfesseurToSessionInput,
  CreateSessionFichierInput,
  SessionEtudiant,
  SessionProfesseur,
  SessionFichier,
} from '@/types/sessions';

export const sessionsFormationApi = {
  /**
   * Récupérer toutes les sessions
   */
  getAll: async (params?: {
    ville_id?: string;
    segment_id?: string;
    corps_formation_id?: string;
    statut?: string;
    annee?: string;
  }): Promise<SessionFormation[]> => {
    const queryParams = new URLSearchParams();
    if (params?.ville_id) queryParams.append('ville_id', params.ville_id);
    if (params?.segment_id) queryParams.append('segment_id', params.segment_id);
    if (params?.corps_formation_id) queryParams.append('corps_formation_id', params.corps_formation_id);
    if (params?.statut) queryParams.append('statut', params.statut);
    if (params?.annee) queryParams.append('annee', params.annee);

    const url = `/sessions-formation${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await apiClient.get<{ success: boolean; sessions: SessionFormation[] }>(url);
    return response.sessions;
  },

  /**
   * Récupérer une session avec tous ses détails
   */
  getById: async (id: string): Promise<SessionFormationDetailed> => {
    const response = await apiClient.get<{ success: boolean; session: SessionFormationDetailed }>(
      `/sessions-formation/${id}`
    );
    return response.session;
  },

  /**
   * Créer une nouvelle session
   */
  create: async (data: CreateSessionFormationInput): Promise<SessionFormation> => {
    const response = await apiClient.post<{ success: boolean; session: SessionFormation; message: string }>(
      '/sessions-formation',
      data
    );
    return response.session;
  },

  /**
   * Modifier une session
   */
  update: async (id: string, data: UpdateSessionFormationInput): Promise<SessionFormation> => {
    const response = await apiClient.put<{ success: boolean; session: SessionFormation; message: string }>(
      `/sessions-formation/${id}`,
      data
    );
    return response.session;
  },

  /**
   * Supprimer une session
   */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete<{ success: boolean; message: string }>(`/sessions-formation/${id}`);
  },

  // ============================================
  // GESTION DES ÉTUDIANTS
  // ============================================

  /**
   * Ajouter un étudiant à une session
   */
  addEtudiant: async (data: AddEtudiantToSessionInput): Promise<SessionEtudiant> => {
    const response = await apiClient.post<{
      success: boolean;
      inscription: SessionEtudiant;
      message: string;
    }>(`/sessions-formation/${data.session_id}/etudiants`, {
      student_id: data.student_id,
      formation_id: data.formation_id,
      montant_total: data.montant_total,
      statut_paiement: data.statut_paiement,
    });
    return response.inscription;
  },

  /**
   * Modifier l'inscription d'un étudiant (paiement)
   */
  updateEtudiant: async (
    sessionId: string,
    etudiantId: string,
    data: UpdateEtudiantSessionInput
  ): Promise<SessionEtudiant> => {
    const response = await apiClient.put<{
      success: boolean;
      inscription: SessionEtudiant;
      message: string;
    }>(`/sessions-formation/${sessionId}/etudiants/${etudiantId}`, data);
    return response.inscription;
  },

  /**
   * Retirer un étudiant d'une session
   */
  removeEtudiant: async (sessionId: string, etudiantId: string): Promise<void> => {
    await apiClient.delete<{ success: boolean; message: string }>(
      `/sessions-formation/${sessionId}/etudiants/${etudiantId}`
    );
  },

  // ============================================
  // GESTION DES PROFESSEURS
  // ============================================

  /**
   * Affecter un professeur à une session
   */
  addProfesseur: async (data: AddProfesseurToSessionInput): Promise<SessionProfesseur> => {
    const response = await apiClient.post<{
      success: boolean;
      affectation: SessionProfesseur;
      message: string;
    }>(`/sessions-formation/${data.session_id}/professeurs`, {
      professeur_id: data.professeur_id,
    });
    return response.affectation;
  },

  /**
   * Retirer un professeur d'une session
   */
  removeProfesseur: async (sessionId: string, professeurId: string): Promise<void> => {
    await apiClient.delete<{ success: boolean; message: string }>(
      `/sessions-formation/${sessionId}/professeurs/${professeurId}`
    );
  },

  // ============================================
  // GESTION DES FICHIERS
  // ============================================

  /**
   * Ajouter un fichier (test ou présence)
   */
  addFichier: async (
    data: CreateSessionFichierInput & {
      file_url?: string;
      file_name?: string;
      file_size?: number;
    }
  ): Promise<SessionFichier> => {
    const response = await apiClient.post<{
      success: boolean;
      fichier: SessionFichier;
      message: string;
    }>(`/sessions-formation/${data.session_id}/fichiers`, {
      type: data.type,
      titre: data.titre,
      file_url: data.file_url,
      file_name: data.file_name,
      file_size: data.file_size,
    });
    return response.fichier;
  },

  /**
   * Supprimer un fichier
   */
  deleteFichier: async (fichierId: string): Promise<void> => {
    await apiClient.delete<{ success: boolean; message: string }>(
      `/sessions-formation/fichiers/${fichierId}`
    );
  },
};
