-- Migration 133: Ajouter statut "overtime" pour les heures supplementaires
-- Permet d'afficher "Heures Sup" comme statut de pointage

-- Supprimer l'ancienne contrainte
ALTER TABLE hr_attendance_daily
DROP CONSTRAINT IF EXISTS hr_attendance_daily_day_status_check;

-- Ajouter la nouvelle contrainte avec 'overtime'
ALTER TABLE hr_attendance_daily
ADD CONSTRAINT hr_attendance_daily_day_status_check
CHECK (day_status IN ('pending', 'present', 'absent', 'late', 'partial',
  'early_leave', 'holiday', 'leave', 'weekend', 'recovery_off',
  'recovery_day', 'mission', 'training', 'sick', 'overtime'));
