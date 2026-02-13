/**
 * Types pour le système de templates de certificats
 */

export interface TemplateLayout {
  orientation: 'portrait' | 'landscape';
  format: 'a4' | 'letter' | 'badge' | 'custom';
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  customWidth?: number;
  customHeight?: number;
}

export interface TemplateColors {
  primary: string;
  secondary: string;
  text: string;
  background: string;
  [key: string]: string; // Permet des couleurs personnalisées supplémentaires
}

export interface TemplateFont {
  family: string;
  size: number;
  style: 'normal' | 'bold' | 'italic' | 'bolditalic';
  color?: string;
}

export interface TemplateElement {
  id: string;
  type: 'text' | 'line' | 'border' | 'rectangle' | 'circle' | 'image';

  // Position (peut être un nombre ou une expression comme "center", "pageWidth - 20")
  x?: string | number;
  y?: string | number;

  // Pour les textes
  content?: string;
  font?: string; // Référence à une police dans fonts
  fontSize?: number;
  fontStyle?: 'normal' | 'bold' | 'italic' | 'bolditalic';
  fontFamily?: string;
  align?: 'left' | 'center' | 'right';
  maxWidth?: string | number;
  // Options de gestion du débordement de texte
  wrapText?: boolean;      // Retour à la ligne si texte > width
  shrinkToFit?: boolean;   // Réduire la taille de police pour tenir dans width

  // Pour les couleurs
  color?: string;
  fillColor?: string;

  // Pour les lignes
  x1?: string | number;
  y1?: string | number;
  x2?: string | number;
  y2?: string | number;
  lineWidth?: number;

  // Pour les rectangles/bordures
  width?: string | number;
  height?: string | number;
  style?: string;

  // Pour les cercles
  radius?: number;

  // Pour les images
  source?: string;

  // Condition d'affichage (nom d'une propriété du certificat)
  condition?: string;

  // Format de date pour les éléments contenant des variables de date
  // 'numeric' = 01/01/2026, 'long' = 01 Janvier 2026, 'short' = 1 Jan 2026, 'full' = Mercredi 01 Janvier 2026
  dateFormat?: 'numeric' | 'long' | 'short' | 'full';

  // Autres propriétés possibles
  [key: string]: any;
}

/**
 * Représente une page individuelle d'un template (pour support recto-verso)
 */
export interface TemplatePage {
  id: string;                    // Identifiant unique de la page (ex: "page-1", "page-2")
  name: string;                  // Nom de la page (ex: "Recto", "Verso")
  background_image_url?: string; // Image d'arrière-plan spécifique à cette page
  background_image_type?: 'url' | 'upload'; // Type de background
  elements: TemplateElement[];   // Éléments visuels de cette page
}

export interface TemplateConfig {
  layout: TemplateLayout;
  colors: TemplateColors;
  fonts: Record<string, TemplateFont>;

  // Nouveau: Support multi-pages (recto-verso)
  pages?: TemplatePage[];        // Tableau de pages pour templates multi-faces

  // Deprecated: Garder pour rétrocompatibilité (sera migré vers pages[0])
  elements?: TemplateElement[];  // Legacy: éléments pour templates mono-page
}

export interface CertificateTemplate {
  id: string;
  name: string;
  description: string;
  template_config: TemplateConfig;
  folder_id: string;
  preview_image_url?: string;
  background_image_url?: string;
  background_image_type?: 'url' | 'upload';
  created_at: string;
  updated_at: string;

  // Frontend uniquement (JOIN avec template_folders)
  folder_name?: string;
  folder_parent_id?: string | null;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  template_config: TemplateConfig;
  folder_id?: string;
  background_image_url?: string;
  background_image_type?: 'url' | 'upload';
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  template_config?: TemplateConfig;
  folder_id?: string;
  background_image_url?: string;
  background_image_type?: 'url' | 'upload';
}

/**
 * Variables disponibles pour les templates
 */
export const TEMPLATE_VARIABLES = {
  // Étudiant
  '{student_name}': 'Nom complet de l\'étudiant',
  '{student_email}': 'Email de l\'étudiant',

  // Formation
  '{formation_title}': 'Titre de la formation',
  '{formation_description}': 'Description de la formation',
  '{duration_hours}': 'Durée en heures',

  // Dates
  '{completion_date}': 'Date de complétion (format long)',
  '{completion_date_short}': 'Date de complétion (format court)',
  '{issued_date}': 'Date d\'émission (format long)',
  '{issued_date_short}': 'Date d\'émission (format court)',
  '{current_year}': 'Année actuelle',
  '{current_date}': 'Date actuelle',

  // Certificat
  '{certificate_number}': 'Numéro du certificat',
  '{grade}': 'Note obtenue',
  '{grade_rounded}': 'Note arrondie',

  // Organisation (depuis metadata)
  '{organization_name}': 'Nom de l\'organisation',
  '{organization_address}': 'Adresse de l\'organisation',
  '{director_name}': 'Nom du directeur',
  '{logo_url}': 'URL du logo',
  '{signature_url}': 'URL de la signature',
} as const;

/**
 * Presets de couleurs prédéfinis
 */
export const COLOR_PRESETS = {
  moderne: {
    name: 'Moderne',
    colors: {
      primary: '#3B82F6',
      secondary: '#6B7280',
      text: '#1F2937',
      background: '#FFFFFF',
    },
  },
  classique: {
    name: 'Classique',
    colors: {
      primary: '#3B82F6',
      secondary: '#FBBF24',
      text: '#1F2937',
      background: '#FFFFFF',
    },
  },
  elegant: {
    name: 'Élégant',
    colors: {
      primary: '#9333EA',
      secondary: '#F59E0B',
      text: '#1F2937',
      background: '#FFFFFF',
    },
  },
  corporate: {
    name: 'Corporate',
    colors: {
      primary: '#1E40AF',
      secondary: '#64748B',
      text: '#0F172A',
      background: '#FFFFFF',
    },
  },
} as const;

/**
 * Interface pour l'arrière-plan du template
 */
export interface BackgroundImage {
  type: 'url' | 'upload';
  value: string;
}

/**
 * Interface pour les polices personnalisées
 */
export interface CustomFont {
  id: string;
  name: string;
  file_url: string;
  file_format: 'ttf' | 'otf' | 'woff' | 'woff2';
  file_size?: number;
  created_at: string;
  updated_at?: string;
}

/**
 * Familles de polices disponibles (built-in + possibilité de custom)
 */
export const FONT_FAMILIES = [
  'helvetica',
  'times',
  'courier',
  'arial',
  'verdana',
  'georgia',
  'palatino',
  'garamond',
  'bookman',
  'trebuchet',
  'impact',
  'montserrat',
] as const;

/**
 * Styles de police disponibles
 */
export const FONT_STYLES = [
  'normal',
  'bold',
  'italic',
  'bolditalic',
] as const;

/**
 * Formats de page disponibles
 */
export const PAGE_FORMATS = [
  'a4',
  'letter',
  'badge',
] as const;

/**
 * Orientations de page disponibles
 */
export const PAGE_ORIENTATIONS = [
  'portrait',
  'landscape',
] as const;

/**
 * Template Folder (dossier hiérarchique)
 */
export interface TemplateFolder {
  id: string;
  name: string;
  parent_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;

  // Frontend uniquement (calculé)
  children?: TemplateFolder[];
  templates?: CertificateTemplate[];
  template_count?: number;
  child_folder_count?: number;
}

/**
 * Inputs pour créer/modifier des dossiers
 */
export interface CreateFolderInput {
  name: string;
  parent_id?: string | null;
}

export interface UpdateFolderInput {
  name: string;
}

export interface MoveFolderInput {
  new_parent_id?: string | null;
}

export interface MoveTemplateInput {
  folder_id: string;
}

/**
 * Utilitaires pour la migration et gestion multi-pages
 */

/**
 * Génère un ID unique pour une nouvelle page
 */
export function generatePageId(): string {
  return `page-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Migre un ancien template config (mono-page) vers le nouveau format (multi-pages)
 * Si le template a déjà des pages, le retourne tel quel
 */
export function migrateToMultiPage(config: TemplateConfig, templateBackground?: {
  url?: string;
  type?: 'url' | 'upload';
}): TemplateConfig {
  // Déjà migré: a un tableau de pages
  if (config.pages && config.pages.length > 0) {
    return config;
  }

  // Migration: créer une page "Recto" avec les éléments existants
  const rectoPage: TemplatePage = {
    id: generatePageId(),
    name: 'Recto',
    background_image_url: templateBackground?.url,
    background_image_type: templateBackground?.type,
    elements: config.elements || [],
  };

  return {
    ...config,
    pages: [rectoPage],
    // Garder elements pour rétrocompatibilité temporaire
    elements: config.elements,
  };
}

/**
 * Vérifie si un template config utilise le nouveau format multi-pages
 */
export function isMultiPageTemplate(config: TemplateConfig): boolean {
  return !!(config.pages && config.pages.length > 0);
}

/**
 * Récupère les pages d'un template, avec migration automatique si nécessaire
 */
export function getTemplatePages(config: TemplateConfig, templateBackground?: {
  url?: string;
  type?: 'url' | 'upload';
}): TemplatePage[] {
  if (isMultiPageTemplate(config)) {
    return config.pages!;
  }

  // Migration à la volée
  const migrated = migrateToMultiPage(config, templateBackground);
  return migrated.pages!;
}

/**
 * Crée une nouvelle page vierge pour un template
 */
export function createNewPage(name: string = 'Nouvelle page'): TemplatePage {
  return {
    id: generatePageId(),
    name,
    elements: [],
  };
}
