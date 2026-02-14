-- Migration pour ajouter le rôle "gerant" et le statut "a_declarer"

-- 1. Modifier le CHECK constraint pour le rôle dans profiles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check CHECK(role IN ('admin', 'professor', 'gerant'));

-- 2. Créer table pour les segments assignés aux gérants
CREATE TABLE IF NOT EXISTS gerant_segments (
  gerant_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  segment_id TEXT NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  PRIMARY KEY (gerant_id, segment_id)
);

-- 3. Créer table pour les villes assignées aux gérants
CREATE TABLE IF NOT EXISTS gerant_cities (
  gerant_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  PRIMARY KEY (gerant_id, city_id)
);

-- 4. Ajouter colonnes pour tracer le créateur de la déclaration
ALTER TABLE professor_declarations
ADD COLUMN IF NOT EXISTS created_by TEXT,
ADD COLUMN IF NOT EXISTS creator_role TEXT CHECK(creator_role IN ('professor', 'gerant'));

-- 5. Modifier le CHECK constraint pour le statut
ALTER TABLE professor_declarations DROP CONSTRAINT IF EXISTS professor_declarations_status_check;
ALTER TABLE professor_declarations ADD CONSTRAINT professor_declarations_status_check
CHECK(status IN ('brouillon', 'a_declarer', 'soumise', 'en_cours', 'approuvee', 'refusee'));

-- 6. Mettre à jour les déclarations existantes (créées par professeurs)
UPDATE professor_declarations
SET created_by = professor_id,
    creator_role = 'professor'
WHERE created_by IS NULL;

-- 7. Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_gerant_segments_gerant_id ON gerant_segments(gerant_id);
CREATE INDEX IF NOT EXISTS idx_gerant_segments_segment_id ON gerant_segments(segment_id);
CREATE INDEX IF NOT EXISTS idx_gerant_cities_gerant_id ON gerant_cities(gerant_id);
CREATE INDEX IF NOT EXISTS idx_gerant_cities_city_id ON gerant_cities(city_id);
CREATE INDEX IF NOT EXISTS idx_professor_declarations_created_by ON professor_declarations(created_by);
CREATE INDEX IF NOT EXISTS idx_professor_declarations_creator_role ON professor_declarations(creator_role);

-- 8. Activer RLS sur les nouvelles tables
ALTER TABLE gerant_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE gerant_cities ENABLE ROW LEVEL SECURITY;

-- 9. Policies RLS pour gerant_segments (accès complet en dev)
CREATE POLICY "Enable all access for gerant_segments" ON gerant_segments
  FOR ALL USING (true);

-- 10. Policies RLS pour gerant_cities (accès complet en dev)
CREATE POLICY "Enable all access for gerant_cities" ON gerant_cities
  FOR ALL USING (true);
