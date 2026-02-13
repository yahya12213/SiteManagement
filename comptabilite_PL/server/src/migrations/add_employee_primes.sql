-- Migration: Ajout de la gestion des primes employé
-- Date: 2026-02-06
-- Description: Tables pour gérer les types de primes et les primes par employé

-- =====================================================
-- Table des types de primes (référentiel)
-- =====================================================
CREATE TABLE IF NOT EXISTS hr_prime_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  label VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(20) NOT NULL CHECK (category IN ('imposable', 'exoneree')),
  exemption_ceiling DECIMAL(10,2) DEFAULT 0,
  exemption_unit VARCHAR(20) DEFAULT 'month' CHECK (exemption_unit IN ('month', 'day', 'percent')),
  is_active BOOLEAN DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- =====================================================
-- Insérer les types de primes par défaut
-- =====================================================

-- PRIMES IMPOSABLES (intégralement soumises à l'IR)
INSERT INTO hr_prime_types (code, label, description, category, exemption_ceiling, exemption_unit, display_order) VALUES
('prime_rendement', 'Prime de rendement', 'Prime liée à la performance individuelle', 'imposable', 0, 'month', 1),
('prime_responsabilite', 'Prime de responsabilité', 'Prime liée à la fonction de responsabilité', 'imposable', 0, 'month', 2),
('indemnite_logement', 'Indemnité de logement', 'Avantage en nature logement', 'imposable', 0, 'month', 3),
('indemnite_voiture', 'Indemnité de voiture', 'Avantage véhicule de fonction', 'imposable', 0, 'month', 4),
('treizieme_mois', '13ème mois', 'Gratification annuelle de fin d''année', 'imposable', 0, 'month', 5),
('prime_exceptionnelle', 'Prime exceptionnelle', 'Primes ponctuelles diverses', 'imposable', 0, 'month', 6)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  exemption_ceiling = EXCLUDED.exemption_ceiling,
  exemption_unit = EXCLUDED.exemption_unit,
  display_order = EXCLUDED.display_order;

-- PRIMES EXONÉRÉES (avec plafonds d'exonération)
INSERT INTO hr_prime_types (code, label, description, category, exemption_ceiling, exemption_unit, display_order) VALUES
('prime_transport', 'Prime de transport', 'Indemnité transport domicile-travail (exonéré jusqu''à 500 DH/mois)', 'exoneree', 500, 'month', 10),
('prime_caisse', 'Prime de caisse', 'Prime pour manipulation de fonds (exonéré jusqu''à 190 DH/mois)', 'exoneree', 190, 'month', 11),
('prime_representation', 'Prime de représentation', 'Cadres dirigeants uniquement (exonéré jusqu''à 10% salaire base)', 'exoneree', 10, 'percent', 12),
('prime_panier', 'Prime de panier', 'Travail en équipe/posté (exonéré 2x SMIG horaire/jour soit ~40 DH)', 'exoneree', 40, 'day', 13),
('bons_repas', 'Bons de repas', 'Tickets restaurant (exonéré jusqu''à 20 DH/jour, max 20 jours)', 'exoneree', 20, 'day', 14),
('indemnite_deplacement', 'Indemnité de déplacement', 'Frais de mission professionnelle (exonéré si justificatifs)', 'exoneree', 0, 'month', 15)
ON CONFLICT (code) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  category = EXCLUDED.category,
  exemption_ceiling = EXCLUDED.exemption_ceiling,
  exemption_unit = EXCLUDED.exemption_unit,
  display_order = EXCLUDED.display_order;

-- =====================================================
-- Table des primes par employé
-- =====================================================
CREATE TABLE IF NOT EXISTS hr_employee_primes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  prime_type_code VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  frequency VARCHAR(20) DEFAULT 'monthly' CHECK (frequency IN ('monthly', 'daily', 'yearly', 'one_time')),
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(employee_id, prime_type_code)
);

-- =====================================================
-- Index pour performance
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_employee_primes_employee ON hr_employee_primes(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_primes_active ON hr_employee_primes(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_prime_types_category ON hr_prime_types(category);
CREATE INDEX IF NOT EXISTS idx_prime_types_active ON hr_prime_types(is_active) WHERE is_active = true;

-- =====================================================
-- Commentaires sur les tables
-- =====================================================
COMMENT ON TABLE hr_prime_types IS 'Référentiel des types de primes disponibles';
COMMENT ON TABLE hr_employee_primes IS 'Configuration des primes par employé';

COMMENT ON COLUMN hr_prime_types.category IS 'imposable = intégralement soumis à l''IR, exoneree = exonéré jusqu''au plafond';
COMMENT ON COLUMN hr_prime_types.exemption_ceiling IS 'Plafond d''exonération (0 si totalement imposable)';
COMMENT ON COLUMN hr_prime_types.exemption_unit IS 'Unité du plafond: month=mensuel, day=journalier, percent=% du salaire base';

COMMENT ON COLUMN hr_employee_primes.frequency IS 'Fréquence: monthly=mensuel, daily=journalier, yearly=annuel, one_time=ponctuel';
