-- Migration: Ajouter 'correction' à la contrainte CHECK de hr_attendance_records.source
-- Date: 2026-01-18
-- Bug: L'approbation des demandes de correction échoue car source='correction' viole la contrainte CHECK
-- Fichier affecté: server/src/services/approval-service.js lignes 477, 486

-- Supprimer l'ancienne contrainte
ALTER TABLE hr_attendance_records
DROP CONSTRAINT IF EXISTS hr_attendance_records_source_check;

-- Ajouter la nouvelle contrainte avec 'correction' inclus
ALTER TABLE hr_attendance_records
ADD CONSTRAINT hr_attendance_records_source_check
CHECK (source = ANY (ARRAY[
  'system'::text,
  'biometric'::text,
  'manual'::text,
  'import'::text,
  'self_service'::text,
  'correction'::text
]));
