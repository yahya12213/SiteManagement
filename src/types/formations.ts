// Types pour les sessions de formation et inscriptions

export type SessionStatus = 'planned' | 'active' | 'completed' | 'cancelled';
export type EnrollmentStatus = 'enrolled' | 'completed' | 'dropped';

export interface Formation {
  id: string;
  title: string;
  description?: string;
  price?: number;
  duration_hours?: number;
  level?: string;
  association_date?: string;
}

export type SessionType = 'presentielle' | 'en_ligne';

export interface FormationSession {
  id: string;
  name: string;
  description?: string;
  formation_id?: string; // Legacy - kept for backward compatibility
  formation_title?: string; // Legacy - kept for backward compatibility
  formations?: Formation[]; // New - array of formations associated with this session
  corps_formation_id?: string; // Corps de Formation association
  session_type?: SessionType; // Type de session: présentielle ou en ligne
  meeting_platform?: string; // Plateforme de réunion (pour en_ligne)
  meeting_link?: string; // Lien de réunion (pour en_ligne)
  start_date: string;
  end_date: string;
  segment_id?: string;
  city_id?: string;
  segment_name?: string;
  city_name?: string;
  instructor_id?: string;
  instructor_name?: string;
  instructor_username?: string;
  max_capacity?: number;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
  enrolled_count?: number;
  students?: EnrolledStudent[];
}

export type PaymentStatus = 'paye' | 'partiel' | 'impaye' | 'surpaye';
export type ValidationStatus = 'valide' | 'non_valide';
export type PaymentMethod = 'especes' | 'virement' | 'cheque' | 'carte' | 'autre';

export interface StudentPayment {
  id: string;
  enrollment_id: string;
  amount: number;
  payment_date: string;
  payment_method?: PaymentMethod;
  note?: string;
  created_at: string;
  created_by?: string;
  created_by_name?: string;
}

export interface EnrolledStudent {
  enrollment_id: string;
  enrollment_date: string;
  enrollment_status: EnrollmentStatus;
  notes?: string;
  student_id: string;
  student_name: string;
  student_username: string;
  role?: string;
  // Payment fields
  discount_amount?: number;
  total_paid?: number;
  formation_price?: number;
  final_price?: number;
  remaining_amount?: number;
  payment_status?: PaymentStatus;
  payment_count?: number;
  // Validation fields
  validation_status?: ValidationStatus;
  validated_by?: string;
  validated_by_name?: string;
  validated_at?: string;
}

export interface FormationEnrollment {
  id: string;
  session_id: string;
  student_id: string;
  enrollment_date: string;
  status: EnrollmentStatus;
  notes?: string;
}

export interface AvailableStudent {
  id: string;
  username: string;
  full_name: string;
  role: string;
}

export interface FormationStats {
  sessions: {
    total: number;
    planned: number;
    active: number;
    completed: number;
    cancelled: number;
  };
  total_students_enrolled: number;
  top_sessions: Array<{
    id: string;
    name: string;
    enrollment_count: number;
  }>;
}

// Interfaces pour les inputs API
export interface CreateSessionInput {
  name: string;
  description?: string;
  formation_ids?: string[]; // New - array of formation IDs
  formation_id?: string; // Legacy - kept for backward compatibility
  corps_formation_id?: string; // Corps de Formation association
  start_date: string;
  end_date: string;
  segment_id?: string;
  city_id?: string;
  instructor_id?: string;
  max_capacity?: number;
  status?: SessionStatus;
}

export interface UpdateSessionInput {
  name?: string;
  description?: string;
  formation_ids?: string[]; // New - array of formation IDs
  formation_id?: string; // Legacy - kept for backward compatibility
  corps_formation_id?: string; // Corps de Formation association
  start_date?: string;
  end_date?: string;
  segment_id?: string;
  city_id?: string;
  instructor_id?: string;
  max_capacity?: number;
  status?: SessionStatus;
}

export interface EnrollStudentsInput {
  student_ids: string[];
}
