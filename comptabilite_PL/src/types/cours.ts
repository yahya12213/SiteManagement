// Types pour les formations en ligne (cours)

export type FormationLevel = 'debutant' | 'intermediaire' | 'avance';
export type FormationStatus = 'draft' | 'published';
export type ModuleType = 'video' | 'test' | 'document';
export type QuestionType = 'multiple_choice';
export type DocumentType = 'certificat' | 'attestation' | 'diplome' | 'autre';

// Template de certificat associé à une formation (relation many-to-many)
export interface FormationTemplate {
  id: string;
  formation_id: string;
  template_id: string;
  document_type: DocumentType;
  is_default: boolean;
  created_at: string;
  // Champs du JOIN avec certificate_templates
  template_name?: string;
  template_description?: string;
  folder_id?: string;
  preview_image_url?: string;
  background_image_url?: string;
}

// Formation (cours en ligne)
export interface Formation {
  id: string;
  title: string;
  description?: string;
  price?: number | string; // PostgreSQL DECIMAL est renvoyé comme string
  duration_hours?: number;
  level?: FormationLevel;
  thumbnail_url?: string;
  status: FormationStatus;
  passing_score_percentage: number;
  default_certificate_template_id?: string;
  certificate_template_name?: string; // Nom du template (depuis JOIN backend)
  // Multi-template support
  templates?: FormationTemplate[]; // Templates associés (relation many-to-many)
  // Nouveaux champs pour Corps de Formation & Packs
  corps_formation_id?: string;
  corps_formation_name?: string;
  is_pack?: boolean;
  certificate_template_id?: string;
  formations_count?: number; // Pour les packs: nombre de formations incluses
  formations?: PackFormation[]; // Pour les packs: formations incluses
  // Prime assistante pour les inscriptions
  prime_assistante?: number | string;
  created_at: string;
  updated_at: string;
  module_count?: number;
  modules?: FormationModule[];
}

// Formation incluse dans un pack
export interface PackFormation {
  id: string;
  title: string;
  description?: string;
  price?: number | string;
  duration_hours?: number;
  level?: FormationLevel;
  thumbnail_url?: string;
  order_index: number;
}

// Module de formation
export interface FormationModule {
  id: string;
  formation_id: string;
  title: string;
  description?: string;
  order_index: number;
  prerequisite_module_id?: string;
  module_type: ModuleType;
  created_at: string;
  videos?: ModuleVideo[];
  tests?: ModuleTest[];
}

// Vidéo d'un module
export interface ModuleVideo {
  id: string;
  module_id: string;
  title: string;
  youtube_url?: string;
  video_provider?: 'YOUTUBE' | 'VIMEO' | 'VDOCIPHER';
  video_id?: string;
  duration_seconds?: number;
  description?: string;
  order_index: number;
  created_at: string;
  is_completed?: boolean;
  duration_minutes?: number;
}

// Test d'un module
export interface ModuleTest {
  id: string;
  module_id: string;
  title: string;
  description?: string;
  passing_score: number;
  time_limit_minutes?: number;
  max_attempts?: number;
  show_correct_answers: boolean;
  created_at: string;
  questions?: TestQuestion[];
}

// Question de test
export interface TestQuestion {
  id: string;
  test_id: string;
  question_text: string;
  question_type: QuestionType;
  points: number;
  order_index: number;
  created_at: string;
  choices: QuestionChoice[];
}

// Choix de réponse
export interface QuestionChoice {
  id: string;
  question_id: string;
  choice_text: string;
  is_correct: boolean;
  order_index: number;
}

// Statistiques
export interface CoursStats {
  formations: {
    total: number;
    draft: number;
    published: number;
  };
  total_modules: number;
  total_videos: number;
  total_tests: number;
}

// ============================================
// Interfaces pour les inputs API
// ============================================

export interface CreateFormationInput {
  title: string;
  description?: string;
  price?: number;
  duration_hours?: number;
  level?: FormationLevel;
  thumbnail_url?: string;
  status?: FormationStatus;
  passing_score_percentage?: number;
  default_certificate_template_id?: string;
  corps_formation_id: string; // Obligatoire
  certificate_template_id?: string;
  prime_assistante?: number; // Prime versée à l'assistante par inscription
  // Multi-template support
  template_ids?: string[]; // IDs des templates à associer
  document_type?: DocumentType; // Type de document (par défaut: 'certificat')
}

export interface UpdateFormationInput {
  title?: string;
  description?: string;
  price?: number;
  duration_hours?: number;
  level?: FormationLevel;
  thumbnail_url?: string;
  status?: FormationStatus;
  passing_score_percentage?: number;
  default_certificate_template_id?: string;
  corps_formation_id?: string;
  certificate_template_id?: string;
  prime_assistante?: number; // Prime versée à l'assistante par inscription
  // Multi-template support
  template_ids?: string[]; // IDs des templates à associer
  document_type?: DocumentType; // Type de document
}

// ============================================
// Interfaces pour les Packs
// ============================================

export interface CreatePackInput {
  title: string;
  description?: string;
  corps_formation_id: string;
  price: number;
  certificate_template_id?: string;
  formation_ids: string[]; // IDs des formations à inclure
  level?: FormationLevel;
  thumbnail_url?: string;
}

export interface UpdatePackInput {
  title?: string;
  description?: string;
  price?: number;
  certificate_template_id?: string;
  formation_ids?: string[];
  level?: FormationLevel;
  thumbnail_url?: string;
}

export interface CreateModuleInput {
  title: string;
  description?: string;
  order_index?: number;
  prerequisite_module_id?: string;
  module_type: ModuleType;
}

export interface UpdateModuleInput {
  title?: string;
  description?: string;
  order_index?: number;
  prerequisite_module_id?: string;
  module_type?: ModuleType;
}

export interface CreateVideoInput {
  title: string;
  youtube_url: string;
  duration_seconds?: number;
  description?: string;
  order_index?: number;
}

export interface UpdateVideoInput {
  title?: string;
  youtube_url?: string;
  duration_seconds?: number;
  description?: string;
  order_index?: number;
}

export interface CreateTestInput {
  title: string;
  description?: string;
  passing_score?: number;
  time_limit_minutes?: number;
  max_attempts?: number;
  show_correct_answers?: boolean;
}

export interface UpdateTestInput {
  title?: string;
  description?: string;
  passing_score?: number;
  time_limit_minutes?: number;
  max_attempts?: number;
  show_correct_answers?: boolean;
}

export interface CreateQuestionInput {
  question_text: string;
  question_type?: QuestionType;
  points?: number;
  order_index?: number;
}

export interface UpdateQuestionInput {
  question_text?: string;
  question_type?: QuestionType;
  points?: number;
  order_index?: number;
}

export interface CreateChoiceInput {
  choice_text: string;
  is_correct?: boolean;
  order_index?: number;
}

export interface UpdateChoiceInput {
  choice_text?: string;
  is_correct?: boolean;
  order_index?: number;
}

// Interface pour le builder de test complet (création en une seule fois)
export interface CompleteTestInput {
  title: string;
  description?: string;
  passing_score?: number;
  time_limit_minutes?: number;
  max_attempts?: number;
  show_correct_answers?: boolean;
  questions: {
    question_text: string;
    points?: number;
    choices: {
      choice_text: string;
      is_correct: boolean;
    }[];
  }[];
}
