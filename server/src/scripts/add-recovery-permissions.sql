-- Script pour ajouter les permissions de récupération d'heures
-- À exécuter après la migration 122

-- 1. Insérer les permissions dans la table permissions
INSERT INTO permissions (module, menu, action, code, label, description, sort_order, permission_type)
VALUES
  (
    'ressources_humaines',
    'gestion_horaires',
    'recuperation_voir',
    'ressources_humaines.gestion_horaires.recuperation.voir',
    'Voir Récupération',
    'Consulter les périodes et déclarations de récupération d''heures',
    100,
    'page'
  ),
  (
    'ressources_humaines',
    'gestion_horaires',
    'recuperation_creer_periode',
    'ressources_humaines.gestion_horaires.recuperation.creer_periode',
    'Gérer Récupération',
    'Créer, modifier et supprimer les périodes et déclarations de récupération',
    101,
    'bouton'
  )
ON CONFLICT (code) DO NOTHING;

-- 2. Assigner les permissions au rôle admin (a tous les droits par défaut)
-- (Pas besoin d'insertion, l'admin a accès à tout)

-- 3. Assigner les permissions aux rôles RH appropriés
-- Trouver les rôles qui ont déjà accès à la gestion des horaires

-- Assigner "voir" aux rôles qui peuvent voir la gestion des horaires
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.code = 'ressources_humaines.gestion_horaires.recuperation.voir'
  AND r.id IN (
    SELECT DISTINCT rp.role_id
    FROM role_permissions rp
    JOIN permissions perm ON rp.permission_id = perm.id
    WHERE perm.code LIKE 'ressources_humaines.gestion_horaires%'
       OR perm.module = 'ressources_humaines'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Assigner "gérer" (créer/modifier/supprimer) aux rôles qui peuvent créer des horaires
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE p.code = 'ressources_humaines.gestion_horaires.recuperation.creer_periode'
  AND r.id IN (
    SELECT DISTINCT rp.role_id
    FROM role_permissions rp
    JOIN permissions perm ON rp.permission_id = perm.id
    WHERE perm.code LIKE 'ressources_humaines.gestion_horaires.creer'
       OR perm.code LIKE 'ressources_humaines.gestion_horaires.modifier'
       OR perm.module = 'ressources_humaines'
  )
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Vérification: afficher les rôles qui ont reçu les permissions
SELECT
  r.name AS role_name,
  p.code AS permission_code,
  p.label AS permission_label
FROM roles r
JOIN role_permissions rp ON r.id = rp.role_id
JOIN permissions p ON rp.permission_id = p.id
WHERE p.code LIKE '%recuperation%'
ORDER BY r.name, p.code;
