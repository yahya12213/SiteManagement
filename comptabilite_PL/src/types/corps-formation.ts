/**
 * Types pour Corps de Formation
 */

export interface CorpsFormation {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  order_index: number;
  segment_id?: string;
  segment_name?: string;
  segment_color?: string;
  created_at: string;
  updated_at: string;
  formations_count?: number; // Nombre de formations dans ce corps
}

export interface CreateCorpsFormationDto {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  order_index?: number;
  segment_id?: string;
}

export interface UpdateCorpsFormationDto {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  order_index?: number;
  segment_id?: string;
}

export interface CorpsFormationWithFormations extends CorpsFormation {
  formations: FormationSummary[];
}

export interface FormationSummary {
  id: string;
  title: string;
  description?: string;
  price?: number;
  level?: string;
  status: string;
  is_pack: boolean;
  created_at: string;
}
