-- Schéma complet pour le système de calcul comptable

-- Table des profils (utilisateurs)
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'professor')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table des segments
CREATE TABLE IF NOT EXISTS segments (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table des villes
CREATE TABLE IF NOT EXISTS cities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  segment_id TEXT NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table des segments affectés aux professeurs (many-to-many)
CREATE TABLE IF NOT EXISTS professor_segments (
  professor_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  segment_id TEXT NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  PRIMARY KEY (professor_id, segment_id)
);

-- Table des villes affectées aux professeurs (many-to-many)
CREATE TABLE IF NOT EXISTS professor_cities (
  professor_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  PRIMARY KEY (professor_id, city_id)
);

-- Table des fiches de calcul
CREATE TABLE IF NOT EXISTS calculation_sheets (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  template_data TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'published')),
  sheet_date TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Table des segments affectés aux fiches (many-to-many)
CREATE TABLE IF NOT EXISTS calculation_sheet_segments (
  sheet_id TEXT NOT NULL REFERENCES calculation_sheets(id) ON DELETE CASCADE,
  segment_id TEXT NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  PRIMARY KEY (sheet_id, segment_id)
);

-- Table des villes affectées aux fiches (many-to-many)
CREATE TABLE IF NOT EXISTS calculation_sheet_cities (
  sheet_id TEXT NOT NULL REFERENCES calculation_sheets(id) ON DELETE CASCADE,
  city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  PRIMARY KEY (sheet_id, city_id)
);

-- Table des déclarations de professeurs
CREATE TABLE IF NOT EXISTS professor_declarations (
  id TEXT PRIMARY KEY,
  professor_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  calculation_sheet_id TEXT NOT NULL REFERENCES calculation_sheets(id) ON DELETE CASCADE,
  segment_id TEXT NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
  city_id TEXT NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  form_data TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'brouillon' CHECK(status IN ('brouillon', 'soumise', 'en_cours', 'approuvee', 'refusee')),
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE,
  reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_cities_segment_id ON cities(segment_id);
CREATE INDEX IF NOT EXISTS idx_professor_segments_professor_id ON professor_segments(professor_id);
CREATE INDEX IF NOT EXISTS idx_professor_segments_segment_id ON professor_segments(segment_id);
CREATE INDEX IF NOT EXISTS idx_professor_cities_professor_id ON professor_cities(professor_id);
CREATE INDEX IF NOT EXISTS idx_professor_cities_city_id ON professor_cities(city_id);
CREATE INDEX IF NOT EXISTS idx_calculation_sheet_segments_sheet_id ON calculation_sheet_segments(sheet_id);
CREATE INDEX IF NOT EXISTS idx_calculation_sheet_segments_segment_id ON calculation_sheet_segments(segment_id);
CREATE INDEX IF NOT EXISTS idx_calculation_sheet_cities_sheet_id ON calculation_sheet_cities(sheet_id);
CREATE INDEX IF NOT EXISTS idx_calculation_sheet_cities_city_id ON calculation_sheet_cities(city_id);
CREATE INDEX IF NOT EXISTS idx_professor_declarations_professor_id ON professor_declarations(professor_id);
CREATE INDEX IF NOT EXISTS idx_professor_declarations_status ON professor_declarations(status);

-- Fonction pour mettre à jour updated_at automatiquement
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour calculation_sheets
CREATE TRIGGER set_timestamp_calculation_sheets
BEFORE UPDATE ON calculation_sheets
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Trigger pour professor_declarations
CREATE TRIGGER set_timestamp_professor_declarations
BEFORE UPDATE ON professor_declarations
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Activer Row Level Security (RLS) sur toutes les tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE professor_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE professor_cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculation_sheets ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculation_sheet_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculation_sheet_cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE professor_declarations ENABLE ROW LEVEL SECURITY;

-- Policies RLS (pour permettre l'accès en mode dev)
-- En production, ces policies devront être affinées selon les besoins de sécurité

-- Politique pour profiles (accès complet pour les utilisateurs authentifiés)
CREATE POLICY "Enable read access for authenticated users" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update for authenticated users" ON profiles
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete for authenticated users" ON profiles
  FOR DELETE USING (true);

-- Politique pour segments (accès complet)
CREATE POLICY "Enable all access for segments" ON segments
  FOR ALL USING (true);

-- Politique pour cities (accès complet)
CREATE POLICY "Enable all access for cities" ON cities
  FOR ALL USING (true);

-- Politique pour professor_segments (accès complet)
CREATE POLICY "Enable all access for professor_segments" ON professor_segments
  FOR ALL USING (true);

-- Politique pour professor_cities (accès complet)
CREATE POLICY "Enable all access for professor_cities" ON professor_cities
  FOR ALL USING (true);

-- Politique pour calculation_sheets (accès complet)
CREATE POLICY "Enable all access for calculation_sheets" ON calculation_sheets
  FOR ALL USING (true);

-- Politique pour calculation_sheet_segments (accès complet)
CREATE POLICY "Enable all access for calculation_sheet_segments" ON calculation_sheet_segments
  FOR ALL USING (true);

-- Politique pour calculation_sheet_cities (accès complet)
CREATE POLICY "Enable all access for calculation_sheet_cities" ON calculation_sheet_cities
  FOR ALL USING (true);

-- Politique pour professor_declarations (accès complet)
CREATE POLICY "Enable all access for professor_declarations" ON professor_declarations
  FOR ALL USING (true);
