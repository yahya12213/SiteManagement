-- Script pour corriger le calcul du montant_du (reste à payer)
-- Ce script recalcule montant_du = montant_total - montant_paye pour tous les étudiants

-- Vérifier d'abord les données incorrectes
SELECT
    se.id,
    s.full_name as student_name,
    se.montant_total,
    se.montant_paye,
    se.montant_du as montant_du_actuel,
    (se.montant_total - se.montant_paye) as montant_du_correct,
    se.discount_percentage,
    se.formation_original_price
FROM session_etudiants se
JOIN students s ON se.student_id = s.id
WHERE se.montant_du != (se.montant_total - se.montant_paye)
ORDER BY s.full_name;

-- Corriger les données (DÉCOMMENTER pour exécuter)
/*
UPDATE session_etudiants
SET
    montant_du = montant_total - montant_paye,
    statut_paiement = CASE
        WHEN montant_paye >= montant_total THEN 'paye'
        WHEN montant_paye > 0 THEN 'partiellement_paye'
        ELSE 'impaye'
    END,
    updated_at = NOW()
WHERE montant_du != (montant_total - montant_paye);
*/
