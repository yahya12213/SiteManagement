-- ================================================================
-- DIAGNOSTIC SCRIPT: Utilisateur "Saadaoui Amine"
-- Vérifie les affectations de segments et villes
-- Vérifie pourquoi l'utilisateur voit 0 déclarations
-- ================================================================

-- ================================================================
-- ÉTAPE 1: IDENTIFIER L'UTILISATEUR
-- ================================================================
\echo '=== ÉTAPE 1: PROFIL UTILISATEUR ==='
SELECT
    id,
    username,
    full_name,
    role,
    role_id,
    created_at
FROM profiles
WHERE full_name ILIKE '%Saadaoui%'
   OR full_name ILIKE '%Amine%'
   OR username ILIKE '%Saadaoui%'
ORDER BY created_at DESC;

-- Note: Copiez l'ID de l'utilisateur pour les requêtes suivantes
-- Remplacez '<USER_ID>' par l'ID réel dans les requêtes ci-dessous

-- ================================================================
-- ÉTAPE 2: SEGMENTS ASSIGNÉS À L'UTILISATEUR
-- ================================================================
\echo '=== ÉTAPE 2: SEGMENTS ASSIGNÉS ==='
SELECT
    ps.professor_id,
    ps.segment_id,
    s.name as segment_name,
    s.color as segment_color,
    s.created_at as segment_created_at
FROM professor_segments ps
JOIN segments s ON ps.segment_id = s.id
WHERE ps.professor_id = '<USER_ID>'  -- REMPLACEZ ICI
ORDER BY s.name;

-- Si cette requête retourne 0 lignes → L'utilisateur n'a AUCUN segment assigné
-- Conséquence: Le filtre SBAC ajoute "1 = 0" → 0 déclarations visibles

-- ================================================================
-- ÉTAPE 3: VILLES ASSIGNÉES À L'UTILISATEUR
-- ================================================================
\echo '=== ÉTAPE 3: VILLES ASSIGNÉES ==='
SELECT
    pc.professor_id,
    pc.city_id,
    c.name as city_name,
    c.segment_id as city_segment_id,
    s.name as segment_name
FROM professor_cities pc
JOIN cities c ON pc.city_id = c.id
LEFT JOIN segments s ON c.segment_id = s.id
WHERE pc.professor_id = '<USER_ID>'  -- REMPLACEZ ICI
ORDER BY c.name;

-- Si cette requête retourne 0 lignes → L'utilisateur n'a AUCUNE ville assignée
-- Conséquence: Le filtre SBAC ajoute "1 = 0" → 0 déclarations visibles

-- ================================================================
-- ÉTAPE 4: DÉCLARATIONS QUI DEVRAIENT ÊTRE VISIBLES
-- ================================================================
\echo '=== ÉTAPE 4: DÉCLARATIONS DANS LE SCOPE DE L''UTILISATEUR ==='
SELECT
    pd.id,
    pd.segment_id,
    s.name as segment_name,
    pd.city_id,
    c.name as city_name,
    pd.professor_id,
    p.full_name as professor_name,
    pd.status,
    pd.start_date,
    pd.end_date,
    pd.created_at
FROM professor_declarations pd
LEFT JOIN segments s ON pd.segment_id = s.id
LEFT JOIN cities c ON pd.city_id = c.id
LEFT JOIN profiles p ON pd.professor_id = p.id
WHERE pd.segment_id IN (
    SELECT segment_id
    FROM professor_segments
    WHERE professor_id = '<USER_ID>'  -- REMPLACEZ ICI
)
AND pd.city_id IN (
    SELECT city_id
    FROM professor_cities
    WHERE professor_id = '<USER_ID>'  -- REMPLACEZ ICI
)
ORDER BY pd.created_at DESC;

-- Cette requête simule exactement ce que fait le filtre SBAC
-- Si elle retourne 0 lignes → Aucune déclaration ne correspond au scope de l'utilisateur

-- ================================================================
-- ÉTAPE 5: TOUTES LES DÉCLARATIONS (pour comparaison)
-- ================================================================
\echo '=== ÉTAPE 5: TOUTES LES DÉCLARATIONS EXISTANTES ==='
SELECT
    pd.id,
    pd.segment_id,
    s.name as segment_name,
    pd.city_id,
    c.name as city_name,
    pd.professor_id,
    p.full_name as professor_name,
    pd.status,
    COUNT(*) OVER() as total_declarations
FROM professor_declarations pd
LEFT JOIN segments s ON pd.segment_id = s.id
LEFT JOIN cities c ON pd.city_id = c.id
LEFT JOIN profiles p ON pd.professor_id = p.id
ORDER BY pd.created_at DESC
LIMIT 20;

-- Cette requête montre toutes les déclarations pour voir ce qui existe

-- ================================================================
-- ÉTAPE 6: STATISTIQUES GLOBALES
-- ================================================================
\echo '=== ÉTAPE 6: STATISTIQUES GLOBALES ==='

-- Nombre total de segments
SELECT 'Total Segments' as metric, COUNT(*) as count FROM segments;

-- Nombre total de villes
SELECT 'Total Villes' as metric, COUNT(*) as count FROM cities;

-- Nombre total de déclarations
SELECT 'Total Déclarations' as metric, COUNT(*) as count FROM professor_declarations;

-- Nombre de professeurs avec segments assignés
SELECT 'Professeurs avec Segments' as metric, COUNT(DISTINCT professor_id) as count
FROM professor_segments;

-- Nombre de professeurs avec villes assignées
SELECT 'Professeurs avec Villes' as metric, COUNT(DISTINCT professor_id) as count
FROM professor_cities;

-- ================================================================
-- ÉTAPE 7: ANALYSE DE LA COUVERTURE
-- ================================================================
\echo '=== ÉTAPE 7: MATRICE SEGMENT × VILLE ==='
-- Voir quelles combinaisons segment-ville existent dans les déclarations
SELECT
    s.name as segment,
    c.name as ville,
    COUNT(pd.id) as nb_declarations
FROM professor_declarations pd
JOIN segments s ON pd.segment_id = s.id
JOIN cities c ON pd.city_id = c.id
GROUP BY s.name, c.name
ORDER BY s.name, c.name;

-- ================================================================
-- ÉTAPE 8: RECOMMANDATION
-- ================================================================
\echo '=== ÉTAPE 8: DIAGNOSTIC FINAL ==='
\echo ''
\echo 'INTERPRÉTATION DES RÉSULTATS:'
\echo '------------------------------'
\echo ''
\echo 'CAS 1: Si ÉTAPE 2 retourne 0 lignes'
\echo '  → L''utilisateur n''a AUCUN segment assigné'
\echo '  → Action: Assigner des segments via INSERT INTO professor_segments'
\echo ''
\echo 'CAS 2: Si ÉTAPE 3 retourne 0 lignes'
\echo '  → L''utilisateur n''a AUCUNE ville assignée'
\echo '  → Action: Assigner des villes via INSERT INTO professor_cities'
\echo ''
\echo 'CAS 3: Si ÉTAPE 2 ET 3 retournent des lignes, mais ÉTAPE 4 retourne 0'
\echo '  → L''utilisateur a des segments ET villes, mais aucune déclaration ne correspond'
\echo '  → Action: Créer une déclaration de test dans le scope de l''utilisateur'
\echo ''
\echo 'CAS 4: Si ÉTAPE 4 retourne des lignes'
\echo '  → Des déclarations existent dans le scope, MAIS le frontend ne les affiche pas'
\echo '  → Action: Vérifier les logs du serveur, bug possible dans le middleware SBAC'
\echo ''

-- ================================================================
-- EXEMPLE: ASSIGNER UN SEGMENT ET UNE VILLE
-- ================================================================
\echo '=== EXEMPLE: COMMANDES POUR ASSIGNER SCOPE ==='
\echo ''
\echo '-- 1. Assigner le segment "Prolean" (exemple)'
\echo 'INSERT INTO professor_segments (professor_id, segment_id)'
\echo 'SELECT ''<USER_ID>'', id FROM segments WHERE name = ''Prolean'' LIMIT 1;'
\echo ''
\echo '-- 2. Assigner la ville "Khemisset" (exemple)'
\echo 'INSERT INTO professor_cities (professor_id, city_id)'
\echo 'SELECT ''<USER_ID>'', id FROM cities WHERE name = ''Khemisset'' LIMIT 1;'
\echo ''
\echo '-- 3. Vérifier les affectations'
\echo 'SELECT * FROM professor_segments WHERE professor_id = ''<USER_ID>'';'
\echo 'SELECT * FROM professor_cities WHERE professor_id = ''<USER_ID>'';'
\echo ''
