-- Migration 130: Refonte complète du système de pointage
-- Objectif: Unifier les deux modèles de données coexistants en un seul modèle clair
-- Principe: 1 ligne = 1 jour = 1 employé

-- =====================================================
-- PHASE 1: Créer les nouvelles tables
-- =====================================================

-- Table principale de pointage unifiée
CREATE TABLE IF NOT EXISTS hr_attendance_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES hr_employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,

  -- Timestamps d'action (timezone-aware)
  clock_in_at TIMESTAMP WITH TIME ZONE,
  clock_out_at TIMESTAMP WITH TIME ZONE,

  -- Horaire prévu (copié au moment du pointage pour historique)
  scheduled_start TIME,
  scheduled_end TIME,
  scheduled_break_minutes INTEGER DEFAULT 0,

  -- Calculs automatiques (calculés par le backend UNIQUEMENT)
  gross_worked_minutes INTEGER,         -- Temps brut (clock_out - clock_in)
  net_worked_minutes INTEGER,           -- Temps net (brut - pause)
  late_minutes INTEGER DEFAULT 0,       -- Retard à l'arrivée
  early_leave_minutes INTEGER DEFAULT 0,-- Départ anticipé
  overtime_minutes INTEGER DEFAULT 0,   -- Heures sup (si approuvées)

  -- Statut FINAL de la journée (jamais 'check_in'/'check_out')
  day_status VARCHAR(30) NOT NULL DEFAULT 'pending',

  -- Source et audit
  source VARCHAR(20) NOT NULL DEFAULT 'self_service',
  notes TEXT,

  -- Tracking de correction
  is_corrected BOOLEAN DEFAULT FALSE,
  corrected_by TEXT,
  correction_reason TEXT,
  corrected_at TIMESTAMP WITH TIME ZONE,
  original_clock_in TIME,
  original_clock_out TIME,

  -- Anomalies
  is_anomaly BOOLEAN DEFAULT FALSE,
  anomaly_type VARCHAR(50),
  anomaly_resolved BOOLEAN DEFAULT FALSE,
  anomaly_resolved_by TEXT,
  anomaly_resolved_at TIMESTAMP WITH TIME ZONE,
  anomaly_resolution_note TEXT,

  -- Métadonnées
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Contrainte d'unicité
  UNIQUE(employee_id, work_date)
);

-- Contraintes CHECK pour les valeurs valides
ALTER TABLE hr_attendance_daily DROP CONSTRAINT IF EXISTS valid_day_status;
ALTER TABLE hr_attendance_daily ADD CONSTRAINT valid_day_status CHECK (day_status IN (
  'pending', 'present', 'absent', 'late', 'partial', 'early_leave',
  'holiday', 'leave', 'weekend', 'recovery_off', 'recovery_day',
  'mission', 'training', 'sick'
));

ALTER TABLE hr_attendance_daily DROP CONSTRAINT IF EXISTS valid_source;
ALTER TABLE hr_attendance_daily ADD CONSTRAINT valid_source CHECK (source IN (
  'self_service', 'manual', 'correction', 'system', 'import'
));

ALTER TABLE hr_attendance_daily DROP CONSTRAINT IF EXISTS clock_out_after_in;
ALTER TABLE hr_attendance_daily ADD CONSTRAINT clock_out_after_in CHECK (
  clock_out_at IS NULL OR clock_in_at IS NULL OR clock_out_at > clock_in_at
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_attendance_daily_employee_date ON hr_attendance_daily(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_daily_date ON hr_attendance_daily(work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_daily_status ON hr_attendance_daily(day_status);
CREATE INDEX IF NOT EXISTS idx_attendance_daily_pending ON hr_attendance_daily(work_date) WHERE day_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_attendance_daily_anomaly ON hr_attendance_daily(is_anomaly, anomaly_resolved) WHERE is_anomaly = TRUE;

-- =====================================================
-- PHASE 2: Table d'audit pour les logs
-- =====================================================

CREATE TABLE IF NOT EXISTS hr_attendance_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id UUID REFERENCES hr_attendance_daily(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES hr_employees(id) ON DELETE SET NULL,
  work_date DATE,

  action VARCHAR(30) NOT NULL,

  old_values JSONB,
  new_values JSONB,

  reason TEXT,
  performed_by TEXT NOT NULL,
  performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Metadata
  ip_address VARCHAR(45),
  user_agent TEXT
);

-- Contrainte CHECK pour les actions valides
ALTER TABLE hr_attendance_audit DROP CONSTRAINT IF EXISTS valid_audit_action;
ALTER TABLE hr_attendance_audit ADD CONSTRAINT valid_audit_action CHECK (action IN (
  'clock_in', 'clock_out', 'manual_create', 'manual_edit',
  'correction_applied', 'status_change', 'system_absence',
  'overtime_approved', 'break_adjusted', 'deleted'
));

-- Index pour l'audit
CREATE INDEX IF NOT EXISTS idx_attendance_audit_attendance ON hr_attendance_audit(attendance_id);
CREATE INDEX IF NOT EXISTS idx_attendance_audit_employee ON hr_attendance_audit(employee_id);
CREATE INDEX IF NOT EXISTS idx_attendance_audit_date ON hr_attendance_audit(performed_at);
CREATE INDEX IF NOT EXISTS idx_attendance_audit_action ON hr_attendance_audit(action);

-- =====================================================
-- PHASE 3: Ajouter colonne de référence dans hr_attendance_correction_requests
-- =====================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'hr_attendance_correction_requests'
    AND column_name = 'attendance_daily_id'
  ) THEN
    ALTER TABLE hr_attendance_correction_requests
    ADD COLUMN attendance_daily_id UUID REFERENCES hr_attendance_daily(id) ON DELETE SET NULL;
  END IF;
END $$;

-- =====================================================
-- PHASE 4: Migration des données existantes
-- =====================================================

-- Fonction de migration pour convertir les anciens records
CREATE OR REPLACE FUNCTION migrate_attendance_to_daily() RETURNS void AS $$
DECLARE
  rec RECORD;
  v_clock_in TIMESTAMP WITH TIME ZONE;
  v_clock_out TIMESTAMP WITH TIME ZONE;
  v_work_date DATE;
  v_day_status VARCHAR(30);
  v_existing_id UUID;
BEGIN
  -- Parcourir tous les enregistrements de l'ancienne table groupés par employé et date
  FOR rec IN
    SELECT
      employee_id,
      COALESCE(DATE(clock_time), attendance_date) as work_date,
      MIN(CASE WHEN status IN ('check_in', 'late', 'weekend') THEN clock_time END) as clock_in_time,
      MAX(CASE WHEN status = 'check_out' THEN clock_time END) as clock_out_time,
      -- Pour l'ancien modèle (attendance_date + check_in/check_out TIME)
      MIN(check_in) as old_check_in,
      MAX(check_out) as old_check_out,
      MIN(attendance_date) as old_attendance_date,
      -- Prendre le statut non-action le plus significatif
      MAX(CASE
        WHEN status NOT IN ('check_in', 'check_out') THEN status
        ELSE NULL
      END) as final_status,
      MAX(worked_minutes) as worked_minutes,
      MAX(late_minutes) as late_minutes,
      MAX(early_leave_minutes) as early_leave_minutes,
      MAX(overtime_minutes) as overtime_minutes,
      MAX(scheduled_start) as scheduled_start,
      MAX(scheduled_end) as scheduled_end,
      bool_or(is_anomaly) as is_anomaly,
      MAX(anomaly_type) as anomaly_type,
      bool_or(anomaly_resolved) as anomaly_resolved,
      MAX(source) as source,
      MAX(notes) as notes,
      MAX(corrected_by) as corrected_by,
      MAX(correction_reason) as correction_reason,
      MAX(corrected_at) as corrected_at,
      MAX(original_check_in) as original_check_in,
      MAX(original_check_out) as original_check_out,
      MIN(created_at) as created_at
    FROM hr_attendance_records
    GROUP BY employee_id, COALESCE(DATE(clock_time), attendance_date)
  LOOP
    -- Déterminer la date de travail
    v_work_date := rec.work_date;

    -- Déterminer clock_in
    IF rec.clock_in_time IS NOT NULL THEN
      v_clock_in := rec.clock_in_time;
    ELSIF rec.old_check_in IS NOT NULL AND rec.old_attendance_date IS NOT NULL THEN
      v_clock_in := (rec.old_attendance_date || ' ' || rec.old_check_in)::TIMESTAMP WITH TIME ZONE;
    ELSE
      v_clock_in := NULL;
    END IF;

    -- Déterminer clock_out
    IF rec.clock_out_time IS NOT NULL THEN
      v_clock_out := rec.clock_out_time;
    ELSIF rec.old_check_out IS NOT NULL AND rec.old_attendance_date IS NOT NULL THEN
      v_clock_out := (rec.old_attendance_date || ' ' || rec.old_check_out)::TIMESTAMP WITH TIME ZONE;
    ELSE
      v_clock_out := NULL;
    END IF;

    -- CORRECTION: Si clock_out < clock_in (données invalides), les inverser
    IF v_clock_in IS NOT NULL AND v_clock_out IS NOT NULL AND v_clock_out < v_clock_in THEN
      DECLARE
        v_temp TIMESTAMP WITH TIME ZONE;
      BEGIN
        v_temp := v_clock_in;
        v_clock_in := v_clock_out;
        v_clock_out := v_temp;
        RAISE NOTICE 'Données inversées pour employé % date %: clock_in et clock_out échangés', rec.employee_id, v_work_date;
      END;
    END IF;

    -- Déterminer le statut final avec mapping des anciens statuts vers les nouveaux
    IF rec.final_status IS NOT NULL THEN
      -- Mapper les anciens statuts vers les statuts valides
      v_day_status := CASE rec.final_status
        -- Statuts valides (garder tels quels)
        WHEN 'pending' THEN 'pending'
        WHEN 'present' THEN 'present'
        WHEN 'absent' THEN 'absent'
        WHEN 'late' THEN 'late'
        WHEN 'partial' THEN 'partial'
        WHEN 'early_leave' THEN 'early_leave'
        WHEN 'holiday' THEN 'holiday'
        WHEN 'leave' THEN 'leave'
        WHEN 'weekend' THEN 'weekend'
        WHEN 'recovery_off' THEN 'recovery_off'
        WHEN 'recovery_day' THEN 'recovery_day'
        WHEN 'mission' THEN 'mission'
        WHEN 'training' THEN 'training'
        WHEN 'sick' THEN 'sick'
        -- Anciens statuts à mapper
        WHEN 'check_in' THEN 'pending'      -- Action → état pending
        WHEN 'check_out' THEN 'present'     -- Action → état present
        WHEN 'completed' THEN 'present'     -- Journée terminée → present
        WHEN 'half_day' THEN 'partial'      -- Demi-journée → partial
        WHEN 'on_leave' THEN 'leave'        -- Variante congé → leave
        WHEN 'recovery' THEN 'recovery_off' -- Variante récup → recovery_off
        WHEN 'sortie_anticipee' THEN 'early_leave' -- Départ anticipé (FR)
        -- Défaut pour tout autre statut inconnu
        ELSE 'present'
      END;
    ELSIF v_clock_out IS NOT NULL THEN
      IF rec.late_minutes > 0 THEN
        v_day_status := 'late';
      ELSIF rec.early_leave_minutes > 0 THEN
        v_day_status := 'early_leave';
      ELSE
        v_day_status := 'present';
      END IF;
    ELSIF v_clock_in IS NOT NULL THEN
      v_day_status := 'pending';
    ELSE
      v_day_status := 'absent';
    END IF;

    -- Vérifier si un enregistrement existe déjà
    SELECT id INTO v_existing_id
    FROM hr_attendance_daily
    WHERE employee_id = rec.employee_id AND work_date = v_work_date;

    IF v_existing_id IS NULL THEN
      -- Insérer le nouvel enregistrement
      INSERT INTO hr_attendance_daily (
        employee_id, work_date, clock_in_at, clock_out_at,
        scheduled_start, scheduled_end,
        net_worked_minutes, late_minutes, early_leave_minutes, overtime_minutes,
        day_status, source, notes,
        is_corrected, corrected_by, correction_reason, corrected_at,
        original_clock_in, original_clock_out,
        is_anomaly, anomaly_type, anomaly_resolved,
        created_at, updated_at
      ) VALUES (
        rec.employee_id, v_work_date, v_clock_in, v_clock_out,
        rec.scheduled_start::TIME, rec.scheduled_end::TIME,
        rec.worked_minutes, COALESCE(rec.late_minutes, 0),
        COALESCE(rec.early_leave_minutes, 0), COALESCE(rec.overtime_minutes, 0),
        v_day_status, COALESCE(rec.source, 'system'), rec.notes,
        rec.corrected_by IS NOT NULL, rec.corrected_by, rec.correction_reason, rec.corrected_at,
        rec.original_check_in, rec.original_check_out,
        COALESCE(rec.is_anomaly, FALSE), rec.anomaly_type, COALESCE(rec.anomaly_resolved, FALSE),
        COALESCE(rec.created_at, NOW()), NOW()
      );
    END IF;
  END LOOP;

  RAISE NOTICE 'Migration des données terminée';
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PHASE 5: Exécuter la migration des données
-- =====================================================

-- Exécuter la migration
SELECT migrate_attendance_to_daily();

-- =====================================================
-- PHASE 6: Renommer l'ancienne table (garde pour backup)
-- =====================================================

-- Vérifier si la table legacy existe déjà avant de renommer
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hr_attendance_records')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hr_attendance_records_legacy') THEN
    ALTER TABLE hr_attendance_records RENAME TO hr_attendance_records_legacy;
    RAISE NOTICE 'Table hr_attendance_records renommée en hr_attendance_records_legacy';
  ELSIF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hr_attendance_records_legacy') THEN
    RAISE NOTICE 'Table hr_attendance_records_legacy existe déjà';
  END IF;
END $$;

-- =====================================================
-- PHASE 7: Nettoyer
-- =====================================================

-- Supprimer la fonction de migration (optionnel, garder pour re-run)
-- DROP FUNCTION IF EXISTS migrate_attendance_to_daily();

-- =====================================================
-- RÉSUMÉ
-- =====================================================
-- Tables créées:
--   - hr_attendance_daily (nouvelle table principale unifiée)
--   - hr_attendance_audit (logs d'audit complets)
--
-- Table renommée:
--   - hr_attendance_records → hr_attendance_records_legacy
--
-- Données migrées automatiquement depuis hr_attendance_records
