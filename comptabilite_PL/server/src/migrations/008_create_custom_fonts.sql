-- Migration: Créer table pour les polices personnalisées
-- Date: 2025-11-03

-- Créer table custom_fonts
CREATE TABLE IF NOT EXISTS custom_fonts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  file_url TEXT NOT NULL,
  file_format VARCHAR(10) NOT NULL CHECK (file_format IN ('ttf', 'otf', 'woff', 'woff2')),
  file_size INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour recherche rapide par nom
CREATE INDEX IF NOT EXISTS idx_custom_fonts_name ON custom_fonts(name);

-- Commentaires
COMMENT ON TABLE custom_fonts IS 'Polices de caractères personnalisées uploadées par les administrateurs';
COMMENT ON COLUMN custom_fonts.name IS 'Nom de la police (unique)';
COMMENT ON COLUMN custom_fonts.file_url IS 'Chemin vers le fichier de police sur le serveur';
COMMENT ON COLUMN custom_fonts.file_format IS 'Format du fichier: ttf, otf, woff, ou woff2';
COMMENT ON COLUMN custom_fonts.file_size IS 'Taille du fichier en octets';
