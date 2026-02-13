-- Migration: Activer justification obligatoire pour congé maladie
-- Date: 2026-01-18
-- Raison: Le formulaire de congé maladie doit permettre l'upload de certificats médicaux

-- Activer l'exigence de justificatif pour le type "Congé Maladie"
UPDATE hr_leave_types
SET requires_justification = true
WHERE code = 'SICK';

-- Vérification
SELECT code, name, requires_justification
FROM hr_leave_types
WHERE code = 'SICK';
