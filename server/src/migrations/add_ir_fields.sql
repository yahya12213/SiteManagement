-- Migration: Ajout des champs pour le calcul IR (Impôt sur le Revenu)
-- Date: 2026-02-06

-- Situation familiale
ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS marital_status VARCHAR(20) DEFAULT 'single';
ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS spouse_dependent BOOLEAN DEFAULT false;
ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS dependent_children INTEGER DEFAULT 0;
ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS other_dependents INTEGER DEFAULT 0;

-- Catégorie professionnelle (pour frais professionnels)
ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS professional_category VARCHAR(20) DEFAULT 'normal';

-- Affiliations complémentaires
ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS cimr_affiliated BOOLEAN DEFAULT false;
ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS cimr_rate DECIMAL(5,2) DEFAULT 0;
ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS mutual_affiliated BOOLEAN DEFAULT false;
ALTER TABLE hr_employees ADD COLUMN IF NOT EXISTS mutual_contribution DECIMAL(10,2) DEFAULT 0;

-- Commentaires pour documentation
COMMENT ON COLUMN hr_employees.marital_status IS 'Situation matrimoniale: single, married, divorced, widowed';
COMMENT ON COLUMN hr_employees.spouse_dependent IS 'Conjoint à charge fiscale (ne travaille pas ou revenus faibles)';
COMMENT ON COLUMN hr_employees.dependent_children IS 'Nombre d enfants à charge (max 6, moins de 27 ans sauf handicapé)';
COMMENT ON COLUMN hr_employees.other_dependents IS 'Autres personnes à charge (parents, etc.)';
COMMENT ON COLUMN hr_employees.professional_category IS 'Catégorie professionnelle: normal (20%), increased (25%), special_35, special_40, special_45';
COMMENT ON COLUMN hr_employees.cimr_affiliated IS 'Affilié à la CIMR (retraite complémentaire)';
COMMENT ON COLUMN hr_employees.cimr_rate IS 'Taux de cotisation CIMR (3, 4 ou 6%)';
COMMENT ON COLUMN hr_employees.mutual_affiliated IS 'Affilié à une mutuelle';
COMMENT ON COLUMN hr_employees.mutual_contribution IS 'Cotisation mutuelle mensuelle en DH';
