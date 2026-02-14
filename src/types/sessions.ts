/**
 * Types pour le système de Sessions de Formation (Classes)
 */

export type SessionStatut = 'planifiee' | 'en_cours' | 'terminee' | 'annulee';
export type SessionType = 'presentielle' | 'en_ligne';
export type StatutPaiement = 'paye' | 'partiellement_paye' | 'impaye';
export type TypeFichier = 'test' | 'presence';
export type StudentStatus = 'valide' | 'abandonne';
export type DeliveryStatus = 'non_livree' | 'livree';

/**
 * Session de Formation (Classe)
 */
export interface SessionFormation {
  id: string;
  titre: string;
  description?: string;
  date_debut?: string;
  date_fin?: string;
  session_type: SessionType; // Type de session: présentielle ou en ligne
  ville_id?: string;
  ville_name?: string; // JOIN avec villes
  segment_id?: string;
  segment_name?: string; // JOIN avec segments
  segment_color?: string; // JOIN avec segments
  corps_formation_id?: string;
  corps_formation_name?: string; // JOIN avec corps_formation
  corps_formation_description?: string; // JOIN avec corps_formation
  meeting_platform?: string; // Plateforme de réunion (pour en_ligne)
  meeting_link?: string; // Lien de réunion (pour en_ligne)
  statut: SessionStatut;
  prix_total: number | string; // DECIMAL renvoyé comme string
  nombre_places: number;
  created_at: string;
  updated_at: string;

  // Compteurs calculés
  nombre_etudiants?: number;
  nombre_professeurs?: number;
  total_paye?: number | string;
  total_du?: number | string;
}

/**
 * Inscription d'un étudiant à une session
 */
export interface SessionEtudiant {
  id: string;
  session_id: string;
  student_id: string;
  formation_id?: string;
  statut_paiement: StatutPaiement;
  student_status?: StudentStatus;
  montant_total: number | string;
  montant_paye: number | string;
  montant_du: number | string;
  discount_amount?: number | string;
  discount_percentage?: number | string;
  discount_reason?: string;
  formation_original_price?: number | string;
  numero_bon?: string;
  statut_compte?: 'actif' | 'inactif' | 'suspendu' | 'diplome';
  date_inscription: string;
  original_date_inscription?: string; // Date d'inscription originale (préservée lors des changements de statut de livraison)
  created_at: string;
  updated_at: string;

  // Données de l'étudiant (JOIN)
  student_name?: string;
  student_first_name?: string;
  student_last_name?: string;
  student_email?: string;
  student_phone?: string;
  student_cin?: string;
  student_whatsapp?: string;
  student_birth_date?: string;
  student_birth_place?: string;
  student_address?: string;
  profile_image_url?: string;

  // Données de la formation (JOIN)
  formation_title?: string;
  formation_is_pack?: boolean;

  // Info documents générés
  has_documents?: boolean;

  // Statut de livraison des documents (pour sessions en ligne)
  delivery_status?: DeliveryStatus;
}

/**
 * Affectation d'un professeur à une session
 */
export interface SessionProfesseur {
  id: string;
  session_id: string;
  professeur_id: string;
  date_affectation: string;
  created_at: string;
  updated_at: string;

  // Données du professeur (JOIN)
  professeur_name?: string;
  professeur_email?: string;
  professeur_phone?: string;
}

/**
 * Fichier de test ou présence
 */
export interface SessionFichier {
  id: string;
  session_id: string;
  type: TypeFichier;
  titre: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  created_at: string;
  updated_at: string;
}

/**
 * Statistiques de paiement pour une session
 */
export interface SessionStatistiques {
  session_id: string;
  nombre_etudiants: number;
  prix_total: number;
  total_paye: number;
  total_partiellement_paye: number;
  total_impaye: number;
  pourcentage_paye: number;

  // Répartition par statut
  nombre_payes: number;
  nombre_partiellement_payes: number;
  nombre_impayes: number;
}

/**
 * Session détaillée avec toutes les relations
 */
export interface SessionFormationDetailed extends SessionFormation {
  etudiants?: SessionEtudiant[];
  professeurs?: SessionProfesseur[];
  fichiers?: SessionFichier[];
  statistiques?: SessionStatistiques;
}

// ============================================
// Interfaces pour les inputs API
// ============================================

export interface CreateSessionFormationInput {
  titre: string;
  description?: string;
  date_debut?: string;
  date_fin?: string;
  session_type: SessionType;
  ville_id?: string;
  segment_id?: string;
  corps_formation_id?: string;
  meeting_platform?: string;
  meeting_link?: string;
  statut?: SessionStatut;
  prix_total?: number;
  nombre_places?: number;
}

export interface UpdateSessionFormationInput {
  titre?: string;
  description?: string;
  date_debut?: string;
  date_fin?: string;
  session_type?: SessionType;
  ville_id?: string;
  segment_id?: string;
  corps_formation_id?: string;
  meeting_platform?: string;
  meeting_link?: string;
  statut?: SessionStatut;
  prix_total?: number;
  nombre_places?: number;
}

export interface AddEtudiantToSessionInput {
  session_id: string;
  student_id: string;
  formation_id: string; // Obligatoire: formation choisie par l'étudiant
  montant_total?: number;
  statut_paiement?: StatutPaiement;
}

export interface UpdateEtudiantSessionInput {
  statut_paiement?: StatutPaiement;
  montant_paye?: number;
  delivery_status?: DeliveryStatus;
}

export interface AddProfesseurToSessionInput {
  session_id: string;
  professeur_id: string;
}

export interface CreateSessionFichierInput {
  session_id: string;
  type: TypeFichier;
  titre: string;
}

/**
 * Options pour générer des documents en masse
 */
export interface GenerateDocumentsInput {
  session_id: string;
  student_ids: string[];
  document_type: 'badge' | 'certificat' | 'attestation' | 'cafatt' | 'jcbatt';
}
