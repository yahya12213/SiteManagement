-- Migration: Désactiver prime_rendement du référentiel
-- Date: 2026-02-06
-- Description: La prime de rendement est calculée automatiquement via les inscriptions,
--              elle ne doit pas apparaître dans la liste des primes configurables

-- Désactiver prime_rendement dans le référentiel
UPDATE hr_prime_types
SET is_active = false
WHERE code = 'prime_rendement';

-- Note: Cette prime existe toujours dans la table mais n'apparaîtra plus dans les listes
-- car la requête filtre sur is_active = true
