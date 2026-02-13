-- ================================================================
-- DIAGNOSTIC RAPIDE: Utilisateur "Saadaoui Amine"
-- Une seule requête pour tout diagnostiquer
-- ================================================================

WITH user_info AS (
  -- Trouver l'utilisateur
  SELECT
    id,
    username,
    full_name,
    role
  FROM profiles
  WHERE full_name ILIKE '%Saadaoui%'
  LIMIT 1
),
user_segments AS (
  -- Segments assignés
  SELECT
    ui.id as user_id,
    COALESCE(array_agg(DISTINCT s.name) FILTER (WHERE s.id IS NOT NULL), ARRAY[]::text[]) as segments,
    COALESCE(array_agg(DISTINCT ps.segment_id) FILTER (WHERE ps.segment_id IS NOT NULL), ARRAY[]::text[]) as segment_ids
  FROM user_info ui
  LEFT JOIN professor_segments ps ON ps.professor_id = ui.id
  LEFT JOIN segments s ON ps.segment_id = s.id
  GROUP BY ui.id
),
user_cities AS (
  -- Villes assignées
  SELECT
    ui.id as user_id,
    COALESCE(array_agg(DISTINCT c.name) FILTER (WHERE c.id IS NOT NULL), ARRAY[]::text[]) as cities,
    COALESCE(array_agg(DISTINCT pc.city_id) FILTER (WHERE pc.city_id IS NOT NULL), ARRAY[]::uuid[]) as city_ids
  FROM user_info ui
  LEFT JOIN professor_cities pc ON pc.professor_id = ui.id
  LEFT JOIN cities c ON pc.city_id = c.id
  GROUP BY ui.id
),
visible_declarations AS (
  -- Déclarations qui DEVRAIENT être visibles
  SELECT
    COUNT(*) as count
  FROM professor_declarations pd
  WHERE pd.segment_id = ANY(ARRAY(SELECT unnest(segment_ids) FROM user_segments))
    AND pd.city_id = ANY(ARRAY(SELECT unnest(city_ids) FROM user_cities))
)
-- Résultat final
SELECT
  ui.id as user_id,
  ui.username,
  ui.full_name,
  ui.role,
  us.segments as "Segments Assignés",
  array_length(us.segment_ids, 1) as "Nombre Segments",
  uc.cities as "Villes Assignées",
  array_length(uc.city_ids, 1) as "Nombre Villes",
  vd.count as "Déclarations Visibles",
  (SELECT COUNT(*) FROM professor_declarations) as "Total Déclarations DB",
  CASE
    WHEN array_length(us.segment_ids, 1) IS NULL OR array_length(us.segment_ids, 1) = 0
      THEN '❌ PROBLÈME: Aucun segment assigné → Filtre SBAC bloque tout'
    WHEN array_length(uc.city_ids, 1) IS NULL OR array_length(uc.city_ids, 1) = 0
      THEN '❌ PROBLÈME: Aucune ville assignée → Filtre SBAC bloque tout'
    WHEN vd.count = 0
      THEN '⚠️  ATTENTION: Scope configuré mais aucune déclaration ne correspond'
    ELSE '✅ OK: Déclarations visibles dans le scope'
  END as "Diagnostic"
FROM user_info ui
CROSS JOIN user_segments us
CROSS JOIN user_cities uc
CROSS JOIN visible_declarations vd;

-- ================================================================
-- ACTION CORRECTIVE SI NÉCESSAIRE
-- ================================================================

-- Si "Nombre Segments" = 0, exécutez cette requête pour voir les segments disponibles:
-- SELECT id, name FROM segments ORDER BY name;

-- Si "Nombre Villes" = 0, exécutez cette requête pour voir les villes disponibles:
-- SELECT id, name, segment_id FROM cities ORDER BY name;

-- Pour assigner un segment:
-- INSERT INTO professor_segments (professor_id, segment_id)
-- VALUES ('<user_id_from_above>', '<segment_id_from_segments_list>');

-- Pour assigner une ville:
-- INSERT INTO professor_cities (professor_id, city_id)
-- VALUES ('<user_id_from_above>', '<city_id_from_cities_list>');
